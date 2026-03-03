"""
Rollover service for handling unused budget carryover between pay cycles.
"""
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pay_cycle import PayCycle
from app.models.category_goal import CategoryGoal
from app.models.category_rollover import CategoryRollover
from app.models.category import Category
from app.models.transaction import Transaction


class RolloverService:
    """Service for managing budget rollovers between pay cycles."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def process_rollovers(self, closed_cycle: PayCycle) -> Decimal:
        """
        Process rollovers from a closed pay cycle to the next cycle.
        Returns total rollover amount.
        """
        # Get the next pay cycle (if exists)
        next_cycle = await self._get_next_cycle(closed_cycle)
        
        # Get all category goals for the closed cycle
        result = await self.db.execute(
            select(CategoryGoal)
            .join(Category)
            .where(Category.user_id == closed_cycle.user_id)
        )
        goals = list(result.scalars().all())
        goals_by_category = {goal.category_id: goal for goal in goals}

        rollover_result = await self.db.execute(
            select(CategoryRollover).where(CategoryRollover.pay_cycle_id == closed_cycle.id)
        )
        rollover_by_category = {
            rollover.category_id: rollover.rollover_balance
            for rollover in rollover_result.scalars().all()
        }
        
        # Get spending per category
        result = await self.db.execute(
            select(Transaction)
            .where(
                and_(
                    Transaction.pay_cycle_id == closed_cycle.id,
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
        
        total_rollover = Decimal("0.00")
        
        category_ids = set(goals_by_category.keys()) | set(rollover_by_category.keys())
        for category_id in category_ids:
            goal = goals_by_category.get(category_id)
            # Calculate effective budget
            if goal and goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * closed_cycle.income_amount
            elif goal:
                budget = goal.goal_value
            else:
                budget = Decimal("0.00")
            effective_budget = budget + rollover_by_category.get(category_id, Decimal("0.00"))
            
            # Calculate unused amount
            spent = spending_by_category.get(category_id, Decimal("0.00"))
            unused = max(Decimal("0.00"), effective_budget - spent)
            total_rollover += unused
            
            # Apply to next cycle if it exists
            if next_cycle and unused > 0:
                await self._apply_rollover_to_next_cycle(
                    next_cycle=next_cycle,
                    category_id=category_id,
                    rollover_amount=unused,
                )
        
        # Update the closed cycle's rollover amount for record keeping
        closed_cycle.rollover_amount = total_rollover
        await self.db.flush()
        
        return total_rollover

    async def process_manual_rollovers(
        self,
        closed_cycle: PayCycle,
        category_allocations: dict[str, Decimal],
    ) -> Decimal:
        """
        Apply user-defined rollover allocations to the next cycle.
        Returns total rollover amount applied.
        """
        next_cycle = await self._get_next_cycle(closed_cycle)
        if not next_cycle:
            closed_cycle.rollover_amount = Decimal("0.00")
            await self.db.flush()
            return Decimal("0.00")

        total_rollover = Decimal("0.00")
        for category_id, rollover_amount in category_allocations.items():
            if rollover_amount <= 0:
                continue
            total_rollover += rollover_amount
            await self._apply_rollover_to_next_cycle(
                next_cycle=next_cycle,
                category_id=category_id,
                rollover_amount=rollover_amount,
            )

        closed_cycle.rollover_amount = total_rollover
        await self.db.flush()
        return total_rollover
    
    async def _get_next_cycle(self, current_cycle: PayCycle) -> Optional[PayCycle]:
        """Get the next pay cycle after the current one."""
        result = await self.db.execute(
            select(PayCycle)
            .where(
                and_(
                    PayCycle.user_id == current_cycle.user_id,
                    PayCycle.start_date > current_cycle.end_date,
                )
            )
            .order_by(PayCycle.start_date)
            .limit(1)
        )
        return result.scalar_one_or_none()
    
    async def _apply_rollover_to_next_cycle(
        self,
        next_cycle: PayCycle,
        category_id: str,
        rollover_amount: Decimal,
    ) -> CategoryRollover:
        """Apply rollover amount to the corresponding category rollover in the next cycle."""
        result = await self.db.execute(
            select(CategoryRollover).where(
                and_(
                    CategoryRollover.pay_cycle_id == next_cycle.id,
                    CategoryRollover.category_id == category_id,
                )
            )
        )
        next_rollover = result.scalar_one_or_none()
        
        if next_rollover:
            next_rollover.rollover_balance += rollover_amount
        else:
            next_rollover = CategoryRollover(
                category_id=category_id,
                pay_cycle_id=next_cycle.id,
                rollover_balance=rollover_amount,
            )
            self.db.add(next_rollover)
        
        await self.db.flush()
        return next_rollover
    
    async def calculate_potential_rollover(
        self, 
        pay_cycle_id: str, 
        user_id: str
    ) -> dict:
        """
        Calculate potential rollover amounts without actually processing them.
        Useful for showing users what they would roll over if cycle closed now.
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

        rollover_result = await self.db.execute(
            select(CategoryRollover).where(CategoryRollover.pay_cycle_id == pay_cycle_id)
        )
        rollover_by_category = {
            rollover.category_id: rollover.rollover_balance
            for rollover in rollover_result.scalars().all()
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
        
        category_ids = set(goals_by_category.keys()) | set(rollover_by_category.keys())
        categories_by_id = {}
        if category_ids:
            categories_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories_by_id = {category.id: category for category in categories_result.scalars().all()}

        for category_id in category_ids:
            goal = goals_by_category.get(category_id)
            if goal and goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * pay_cycle.income_amount
            elif goal:
                budget = goal.goal_value
            else:
                budget = Decimal("0.00")
            effective_budget = budget + rollover_by_category.get(category_id, Decimal("0.00"))
            
            spent = spending_by_category.get(category_id, Decimal("0.00"))
            unused = max(Decimal("0.00"), effective_budget - spent)
            category = categories_by_id.get(category_id)
            
            rollovers[category_id] = {
                "category_name": category.name if category else "Unknown",
                "budget": float(effective_budget),
                "spent": float(spent),
                "potential_rollover": float(unused),
            }
            total += unused
        
        return {
            "pay_cycle_id": pay_cycle_id,
            "categories": rollovers,
            "total_potential_rollover": float(total),
        }
