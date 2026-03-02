"""
Rollover service for handling unused budget carryover between pay cycles.
"""
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pay_cycle import PayCycle
from app.models.category_goal import CategoryGoal
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
            .options(selectinload(CategoryGoal.category))
            .where(CategoryGoal.pay_cycle_id == closed_cycle.id)
        )
        goals = list(result.scalars().all())
        
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
        
        for goal in goals:
            # Calculate effective budget
            if goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * closed_cycle.income_amount
            else:
                budget = goal.goal_value
            effective_budget = budget + goal.rollover_balance
            
            # Calculate unused amount
            spent = spending_by_category.get(goal.category_id, Decimal("0.00"))
            unused = max(Decimal("0.00"), effective_budget - spent)
            total_rollover += unused
            
            # Apply to next cycle if it exists
            if next_cycle and unused > 0:
                await self._apply_rollover_to_next_cycle(
                    next_cycle=next_cycle,
                    category_id=goal.category_id,
                    rollover_amount=unused,
                    original_goal=goal,
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

        result = await self.db.execute(
            select(CategoryGoal)
            .options(selectinload(CategoryGoal.category))
            .where(CategoryGoal.pay_cycle_id == closed_cycle.id)
        )
        current_goals = list(result.scalars().all())
        goals_by_category = {goal.category_id: goal for goal in current_goals}

        total_rollover = Decimal("0.00")
        for category_id, rollover_amount in category_allocations.items():
            if rollover_amount <= 0:
                continue
            original_goal = goals_by_category.get(category_id)
            total_rollover += rollover_amount
            await self._apply_rollover_to_next_cycle(
                next_cycle=next_cycle,
                category_id=category_id,
                rollover_amount=rollover_amount,
                original_goal=original_goal,
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
        original_goal: Optional[CategoryGoal] = None,
    ) -> CategoryGoal:
        """Apply rollover amount to the corresponding goal in the next cycle."""
        # Check if goal already exists for this category in next cycle
        result = await self.db.execute(
            select(CategoryGoal).where(
                and_(
                    CategoryGoal.pay_cycle_id == next_cycle.id,
                    CategoryGoal.category_id == category_id,
                )
            )
        )
        next_goal = result.scalar_one_or_none()
        
        if next_goal:
            # Add rollover to existing goal
            next_goal.rollover_balance += rollover_amount
        else:
            # Create new goal with rollover
            next_goal = CategoryGoal(
                category_id=category_id,
                pay_cycle_id=next_cycle.id,
                goal_type=original_goal.goal_type if original_goal else "fixed",
                goal_value=original_goal.goal_value if original_goal else Decimal("0.00"),
                rollover_balance=rollover_amount,
            )
            self.db.add(next_goal)
        
        await self.db.flush()
        return next_goal
    
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
            .options(selectinload(CategoryGoal.category))
            .where(CategoryGoal.pay_cycle_id == pay_cycle_id)
        )
        goals = list(result.scalars().all())
        
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
        
        for goal in goals:
            if goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * pay_cycle.income_amount
            else:
                budget = goal.goal_value
            effective_budget = budget + goal.rollover_balance
            
            spent = spending_by_category.get(goal.category_id, Decimal("0.00"))
            unused = max(Decimal("0.00"), effective_budget - spent)
            
            rollovers[goal.category_id] = {
                "category_name": goal.category.name,
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
