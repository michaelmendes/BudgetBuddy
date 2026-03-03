"""
Dashboard service for aggregating dashboard data.
"""
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.category_goal import CategoryGoal
from app.models.category_rollover import CategoryRollover
from app.models.transaction import Transaction
from app.schemas.dashboard import (
    DashboardCategoryProgress,
    DashboardNudge,
    DashboardResponse,
    DashboardStats,
)
from app.services.pay_cycle_service import PayCycleService
from app.services.social_service import SocialService


class DashboardService:
    """Service for assembling dashboard data."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, user_id: str) -> DashboardResponse:
        """Get the dashboard payload for a user."""
        pay_cycle_service = PayCycleService(self.db)
        social_service = SocialService(self.db)

        active_cycle = await pay_cycle_service.get_active(user_id)
        recent_cycles = await pay_cycle_service.list_by_user(user_id, limit=5, offset=0)
        friend_updates = await social_service.get_all_friends_progress(user_id)

        if not active_cycle:
            return DashboardResponse(
                active_pay_cycle=None,
                stats=None,
                nudges=[],
                category_progress=[],
                friend_updates=friend_updates,
                recent_cycles=recent_cycles,
            )

        categories_result = await self.db.execute(
            select(Category)
            .where(
                and_(
                    Category.user_id == user_id,
                    Category.is_archived == False,
                )
            )
            .order_by(Category.sort_order.asc(), Category.name.asc())
        )
        categories = list(categories_result.scalars().all())
        category_ids = [category.id for category in categories]

        goals_result = await self.db.execute(
            select(CategoryGoal)
            .join(Category)
            .where(Category.user_id == user_id)
        )
        goals_by_category = {
            goal.category_id: goal for goal in goals_result.scalars().all()
        }

        rollovers_by_category: dict[str, Decimal] = {}
        if category_ids:
            rollovers_result = await self.db.execute(
                select(CategoryRollover).where(
                    and_(
                        CategoryRollover.pay_cycle_id == active_cycle.id,
                        CategoryRollover.category_id.in_(category_ids),
                    )
                )
            )
            rollovers_by_category = {
                rollover.category_id: rollover.rollover_balance
                for rollover in rollovers_result.scalars().all()
            }

        transactions_result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.pay_cycle_id == active_cycle.id,
                    Transaction.user_id == user_id,
                )
            )
        )
        transactions = list(transactions_result.scalars().all())

        spent_by_category: dict[str, Decimal] = {}
        total_spent = Decimal("0.00")
        extra_income = Decimal("0.00")
        for transaction in transactions:
            if transaction.type == "expense":
                total_spent += transaction.amount
                spent_by_category[transaction.category_id] = (
                    spent_by_category.get(transaction.category_id, Decimal("0.00")) + transaction.amount
                )
            elif transaction.type == "income":
                extra_income += transaction.amount

        total_budget = active_cycle.income_amount + active_cycle.rollover_amount
        remaining = total_budget - total_spent + extra_income
        budget_used_percentage = self._percentage(total_spent, total_budget)

        today = datetime.now(timezone.utc).date()
        total_days = max(1, (active_cycle.end_date - active_cycle.start_date).days + 1)
        days_remaining = max(0, (active_cycle.end_date - today).days)
        elapsed_days = min(total_days, max(0, total_days - days_remaining))
        day_progress = round((elapsed_days / total_days) * 100, 1)

        category_progress = self._build_category_progress(
            categories=categories,
            goals_by_category=goals_by_category,
            rollovers_by_category=rollovers_by_category,
            spent_by_category=spent_by_category,
            cycle_income=active_cycle.income_amount,
        )
        nudges = self._build_nudges(
            category_progress=category_progress,
            remaining=remaining,
            days_remaining=days_remaining,
            budget_used_percentage=budget_used_percentage,
            day_progress=day_progress,
        )

        stats = DashboardStats(
            total_budget=total_budget,
            total_spent=total_spent,
            remaining=remaining,
            extra_income=extra_income,
            budget_used_percentage=budget_used_percentage,
            days_remaining=days_remaining,
            total_days=total_days,
            day_progress_percentage=day_progress,
        )

        return DashboardResponse(
            active_pay_cycle=active_cycle,
            stats=stats,
            nudges=nudges,
            category_progress=category_progress,
            friend_updates=friend_updates,
            recent_cycles=recent_cycles,
        )

    def _build_category_progress(
        self,
        categories: list[Category],
        goals_by_category: dict[str, CategoryGoal],
        rollovers_by_category: dict[str, Decimal],
        spent_by_category: dict[str, Decimal],
        cycle_income: Decimal,
    ) -> list[DashboardCategoryProgress]:
        """Build progress records for dashboard categories."""
        progress_items: list[DashboardCategoryProgress] = []

        for category in categories:
            goal = goals_by_category.get(category.id)
            rollover_amount = rollovers_by_category.get(category.id, Decimal("0.00"))
            spent = spent_by_category.get(category.id, Decimal("0.00"))

            budget_amount = Decimal("0.00")
            if goal:
                if goal.goal_type == "percentage":
                    budget_amount = (
                        cycle_income * goal.goal_value / Decimal("100")
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                else:
                    budget_amount = goal.goal_value

            effective_budget = budget_amount + rollover_amount
            remaining = effective_budget - spent
            completion_percentage = self._percentage(spent, effective_budget)
            has_activity = goal is not None or rollover_amount > 0 or spent > 0
            if not has_activity:
                continue

            progress_items.append(
                DashboardCategoryProgress(
                    category_id=category.id,
                    category_name=category.name,
                    category_icon=category.icon,
                    category_color=category.color,
                    goal_type=goal.goal_type if goal else None,
                    goal_value=goal.goal_value if goal else None,
                    budget_amount=budget_amount,
                    rollover_amount=rollover_amount,
                    effective_budget=effective_budget,
                    spent=spent,
                    remaining=remaining,
                    completion_percentage=completion_percentage,
                    is_over_budget=spent > effective_budget,
                )
            )

        progress_items.sort(
            key=lambda item: (
                not item.is_over_budget,
                -item.completion_percentage,
                item.category_name.lower(),
            )
        )
        return progress_items

    def _build_nudges(
        self,
        category_progress: list[DashboardCategoryProgress],
        remaining: Decimal,
        days_remaining: int,
        budget_used_percentage: float,
        day_progress: float,
    ) -> list[DashboardNudge]:
        """Build nudges for the active pay cycle."""
        nudges: list[DashboardNudge] = []

        for item in category_progress:
            if item.is_over_budget:
                nudges.append(
                    DashboardNudge(
                        id=f"over-budget-{item.category_id}",
                        type="warning",
                        category_id=item.category_id,
                        category_name=item.category_name,
                        percentage=round(item.completion_percentage, 1),
                        message=(
                            f"{item.category_name} is over budget by "
                            f"${abs(item.remaining):.2f}."
                        ),
                    )
                )
            elif item.completion_percentage >= 85:
                nudges.append(
                    DashboardNudge(
                        id=f"watch-{item.category_id}",
                        type="warning",
                        category_id=item.category_id,
                        category_name=item.category_name,
                        percentage=round(item.completion_percentage, 1),
                        message=f"{item.category_name} has used {item.completion_percentage:.0f}% of its budget.",
                    )
                )

            if len(nudges) >= 2:
                break

        if remaining > 0 and budget_used_percentage <= max(day_progress - 5, 0):
            nudges.append(
                DashboardNudge(
                    id="pace-ahead",
                    type="celebration",
                    message="You are spending below your current cycle pace.",
                )
            )

        if remaining > 0 and days_remaining > 0:
            daily_budget = (remaining / Decimal(days_remaining)).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
            nudges.append(
                DashboardNudge(
                    id="daily-budget",
                    type="tip",
                    message=f"You have about ${daily_budget:.2f} per day left for this cycle.",
                )
            )

        return nudges[:3]

    def _percentage(self, value: Decimal, total: Decimal) -> float:
        """Return a percentage rounded to one decimal place."""
        if total <= 0:
            return 0.0
        return round(float((value / total) * Decimal("100")), 1)
