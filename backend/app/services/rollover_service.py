"""
Balance service for handling category balances between pay cycles.
"""
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pay_cycle import PayCycle
from app.models.category_goal import CategoryGoal
from app.models.category_balance import CategoryBalance
from app.models.category import Category
from app.models.transaction import Transaction


class RolloverService:
    """Service for managing per-cycle category balances."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_rollovers(self, closed_cycle: PayCycle) -> Decimal:
        """
        Auto-close category balances using goal-derived paycheck allocations.
        Returns total closing balance across categories.
        """
        # Get all category goals for the closed cycle.
        result = await self.db.execute(
            select(CategoryGoal)
            .join(Category)
            .where(Category.user_id == closed_cycle.user_id)
        )
        goals = list(result.scalars().all())
        goals_by_category = {goal.category_id: goal for goal in goals}

        balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == closed_cycle.id)
        )
        balances_by_category = {
            balance.category_id: balance
            for balance in balance_result.scalars().all()
        }

        tx_result = await self.db.execute(
            select(Transaction)
            .where(
                and_(
                    Transaction.pay_cycle_id == closed_cycle.id,
                    Transaction.type == "expense",
                )
            )
        )
        spent_by_category: dict[str, Decimal] = {}
        for tx in tx_result.scalars().all():
            spent_by_category[tx.category_id] = (
                spent_by_category.get(tx.category_id, Decimal("0.00")) + tx.amount
            )

        total_closing_balance = Decimal("0.00")
        category_ids = set(goals_by_category.keys()) | set(balances_by_category.keys()) | set(spent_by_category.keys())
        for category_id in category_ids:
            goal = goals_by_category.get(category_id)
            balance = balances_by_category.get(category_id)
            starting_balance = balance.starting_balance if balance else Decimal("0.00")

            # Automatic paycheck allocation derived from goal.
            if goal and goal.goal_type == "percentage":
                paycheck_allocated = (goal.goal_value / 100) * closed_cycle.income_amount
            elif goal:
                paycheck_allocated = goal.goal_value
            else:
                paycheck_allocated = Decimal("0.00")

            spent = spent_by_category.get(category_id, Decimal("0.00"))
            closing_balance = starting_balance - spent + paycheck_allocated
            total_closing_balance += closing_balance

            await self._set_cycle_balance(
                pay_cycle_id=closed_cycle.id,
                category_id=category_id,
                starting_balance=starting_balance,
                spent=spent,
                paycheck_allocated=paycheck_allocated,
                closing_balance=closing_balance,
            )

        await self._sync_next_cycle_starting_balances(closed_cycle)
        await self.db.flush()
        return total_closing_balance

    async def process_manual_rollovers(
        self,
        closed_cycle: PayCycle,
        category_allocations: dict[str, Decimal],
    ) -> Decimal:
        """
        Apply user-defined paycheck allocations and finalize cycle balances.
        Closing balance formula: starting_balance - spent + paycheck_allocated.
        Returns total closing balance across categories.
        """
        balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == closed_cycle.id)
        )
        balances_by_category = {
            balance.category_id: balance
            for balance in balance_result.scalars().all()
        }

        tx_result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.pay_cycle_id == closed_cycle.id,
                    Transaction.type == "expense",
                )
            )
        )
        spent_by_category: dict[str, Decimal] = {}
        for tx in tx_result.scalars().all():
            spent_by_category[tx.category_id] = (
                spent_by_category.get(tx.category_id, Decimal("0.00")) + tx.amount
            )

        category_ids = (
            set(category_allocations.keys())
            | set(balances_by_category.keys())
            | set(spent_by_category.keys())
        )

        total_closing_balance = Decimal("0.00")
        for category_id in category_ids:
            balance = balances_by_category.get(category_id)
            starting_balance = balance.starting_balance if balance else Decimal("0.00")
            spent_amount = spent_by_category.get(category_id, Decimal("0.00"))
            paycheck_allocated = category_allocations.get(category_id, Decimal("0.00"))
            closing_balance = starting_balance - spent_amount + paycheck_allocated
            total_closing_balance += closing_balance

            await self._set_cycle_balance(
                pay_cycle_id=closed_cycle.id,
                category_id=category_id,
                starting_balance=starting_balance,
                spent=spent_amount,
                paycheck_allocated=paycheck_allocated,
                closing_balance=closing_balance,
            )

        await self._sync_next_cycle_starting_balances(closed_cycle)
        await self.db.flush()
        return total_closing_balance

    async def _get_next_cycle(self, current_cycle: PayCycle) -> Optional[PayCycle]:
        """Get the next pay cycle after the current one via previous_cycle link."""
        linked_result = await self.db.execute(
            select(PayCycle).where(
                and_(
                    PayCycle.user_id == current_cycle.user_id,
                    PayCycle.previous_cycle == current_cycle.id,
                )
            )
            .order_by(PayCycle.start_date)
            .limit(1)
        )
        return linked_result.scalar_one_or_none()

    async def _set_cycle_balance(
        self,
        pay_cycle_id: str,
        category_id: str,
        starting_balance: Decimal,
        spent: Decimal,
        paycheck_allocated: Decimal,
        closing_balance: Decimal,
    ) -> CategoryBalance:
        """Create or update the per-category balance record for a cycle."""
        result = await self.db.execute(
            select(CategoryBalance).where(
                and_(
                    CategoryBalance.pay_cycle_id == pay_cycle_id,
                    CategoryBalance.category_id == category_id,
                )
            )
        )
        cycle_balance = result.scalar_one_or_none()
        if cycle_balance:
            cycle_balance.starting_balance = starting_balance
            cycle_balance.spent = spent
            cycle_balance.paycheck_allocated = paycheck_allocated
            cycle_balance.closing_balance = closing_balance
        else:
            cycle_balance = CategoryBalance(
                pay_cycle_id=pay_cycle_id,
                category_id=category_id,
                starting_balance=starting_balance,
                spent=spent,
                paycheck_allocated=paycheck_allocated,
                closing_balance=closing_balance,
            )
            self.db.add(cycle_balance)

        await self.db.flush()
        return cycle_balance

    async def _sync_next_cycle_starting_balances(self, closed_cycle: PayCycle) -> None:
        """
        If the next cycle already exists and is not closed, keep its
        starting balances aligned with the just-closed cycle's closing balances.
        """
        next_cycle = await self._get_next_cycle(closed_cycle)
        if not next_cycle or next_cycle.status == "closed":
            return

        closed_balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == closed_cycle.id)
        )
        closed_by_category = {
            balance.category_id: balance
            for balance in closed_balance_result.scalars().all()
        }

        next_balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == next_cycle.id)
        )
        next_by_category = {
            balance.category_id: balance
            for balance in next_balance_result.scalars().all()
        }

        for category_id, closed_balance in closed_by_category.items():
            next_balance = next_by_category.get(category_id)
            if next_balance:
                next_balance.starting_balance = closed_balance.closing_balance
                if next_balance.spent == Decimal("0.00") and next_balance.paycheck_allocated == Decimal("0.00"):
                    next_balance.closing_balance = next_balance.starting_balance
            else:
                self.db.add(
                    CategoryBalance(
                        pay_cycle_id=next_cycle.id,
                        category_id=category_id,
                        starting_balance=closed_balance.closing_balance,
                        spent=Decimal("0.00"),
                        paycheck_allocated=Decimal("0.00"),
                        closing_balance=closed_balance.closing_balance,
                    )
                )

    async def calculate_potential_rollover(
        self,
        pay_cycle_id: str,
        user_id: str
    ) -> dict:
        """
        Calculate potential rollover amounts without actually processing them.
        Useful for showing users what they would close with now.
        """
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.id == pay_cycle_id, PayCycle.user_id == user_id)
            )
        )
        pay_cycle = result.scalar_one_or_none()
        if not pay_cycle:
            return {"error": "Pay cycle not found"}

        # Get goals
        result = await self.db.execute(
            select(CategoryGoal)
            .join(Category)
            .where(Category.user_id == user_id)
        )
        goals = list(result.scalars().all())
        goals_by_category = {goal.category_id: goal for goal in goals}

        balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == pay_cycle_id)
        )
        starting_by_category = {
            balance.category_id: balance.starting_balance
            for balance in balance_result.scalars().all()
        }

        # Get spending
        result = await self.db.execute(
            select(Transaction)
            .where(
                and_(
                    Transaction.pay_cycle_id == pay_cycle_id,
                    Transaction.type == "expense",
                )
            )
        )
        transactions = list(result.scalars().all())

        spending_by_category = {}
        for t in transactions:
            spending_by_category[t.category_id] = (
                spending_by_category.get(t.category_id, Decimal("0.00")) + t.amount
            )

        rollovers = {}
        total = Decimal("0.00")

        category_ids = set(goals_by_category.keys()) | set(starting_by_category.keys())
        categories_by_id = {}
        if category_ids:
            categories_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories_by_id = {category.id: category for category in categories_result.scalars().all()}

        for category_id in category_ids:
            goal = goals_by_category.get(category_id)
            if goal and goal.goal_type == "percentage":
                paycheck_allocated = (goal.goal_value / 100) * pay_cycle.income_amount
            elif goal:
                paycheck_allocated = goal.goal_value
            else:
                paycheck_allocated = Decimal("0.00")

            starting_balance = starting_by_category.get(category_id, Decimal("0.00"))
            spent = spending_by_category.get(category_id, Decimal("0.00"))
            closing_balance = starting_balance - spent + paycheck_allocated
            category = categories_by_id.get(category_id)

            rollovers[category_id] = {
                "category_name": category.name if category else "Unknown",
                "starting_balance": float(starting_balance),
                "spent": float(spent),
                "paycheck_allocated": float(paycheck_allocated),
                "closing_balance": float(closing_balance),
            }
            total += closing_balance

        return {
            "pay_cycle_id": pay_cycle_id,
            "categories": rollovers,
            "total_potential_rollover": float(total),
        }
