"""
PayCycle service for managing budget periods.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pay_cycle import PayCycle
from app.models.pay_cycle_summary import PayCycleSummary
from app.models.category_goal import CategoryGoal
from app.models.transaction import Transaction
from app.schemas.pay_cycle import PayCycleCreate, PayCycleUpdate
from app.core.exceptions import NotFoundException, BadRequestException


class PayCycleService:
    """Service for pay cycle operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, pay_cycle_id: str, user_id: str) -> Optional[PayCycle]:
        """Get pay cycle by ID for a specific user."""
        result = await self.db.execute(
            select(PayCycle)
            .options(selectinload(PayCycle.summary))
            .where(and_(PayCycle.id == pay_cycle_id, PayCycle.user_id == user_id))
        )
        return result.scalar_one_or_none()
    
    async def get_active(self, user_id: str) -> Optional[PayCycle]:
        """Get the active pay cycle for a user."""
        result = await self.db.execute(
            select(PayCycle)
            .options(selectinload(PayCycle.category_goals))
            .where(and_(PayCycle.user_id == user_id, PayCycle.status == "active"))
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(self, user_id: str, limit: int = 20, offset: int = 0) -> List[PayCycle]:
        """List pay cycles for a user."""
        result = await self.db.execute(
            select(PayCycle)
            .options(selectinload(PayCycle.summary))
            .where(PayCycle.user_id == user_id)
            .order_by(PayCycle.start_date.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    async def create(self, user_id: str, data: PayCycleCreate) -> PayCycle:
        """Create a new pay cycle."""
        # Check for overlapping cycles
        existing = await self.db.execute(
            select(PayCycle).where(
                and_(
                    PayCycle.user_id == user_id,
                    PayCycle.start_date <= data.end_date,
                    PayCycle.end_date >= data.start_date,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise BadRequestException(detail="Pay cycle dates overlap with existing cycle")
        
        # Determine status
        today = datetime.now(timezone.utc).date()
        if data.start_date <= today <= data.end_date:
            status = "active"
        elif data.start_date > today:
            status = "upcoming"
        else:
            status = "closed"
        
        pay_cycle = PayCycle(
            user_id=user_id,
            start_date=data.start_date,
            end_date=data.end_date,
            income_amount=data.income_amount,
            status=status,
        )
        self.db.add(pay_cycle)
        await self.db.flush()
        return pay_cycle
    
    async def update(self, pay_cycle_id: str, user_id: str, data: PayCycleUpdate) -> PayCycle:
        """Update a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot update a closed pay cycle")
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pay_cycle, field, value)
        
        await self.db.flush()
        return pay_cycle
    
    async def activate(self, pay_cycle_id: str, user_id: str) -> PayCycle:
        """Activate a pay cycle (deactivates current active cycle)."""
        # Deactivate current active cycle
        current_active = await self.get_active(user_id)
        if current_active and current_active.id != pay_cycle_id:
            raise BadRequestException(
                detail="Another cycle is active. Close it first."
            )
        
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot activate a closed pay cycle")
        
        pay_cycle.status = "active"
        await self.db.flush()
        return pay_cycle
    
    async def close(
        self, 
        pay_cycle_id: str, 
        user_id: str, 
        rollover_service: "RolloverService",
        goal_service: "GoalService",
    ) -> PayCycle:
        """Close a pay cycle, generate summary, and process rollovers."""
        from app.services.rollover_service import RolloverService
        from app.services.goal_service import GoalService
        
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Pay cycle is already closed")
        
        # Generate summary
        summary = await self._generate_summary(pay_cycle, goal_service)
        self.db.add(summary)
        
        # Process rollovers to next cycle
        await rollover_service.process_rollovers(pay_cycle)
        
        # Update status
        pay_cycle.status = "closed"
        pay_cycle.closed_at = datetime.now(timezone.utc)
        
        await self.db.flush()
        return pay_cycle
    
    async def _generate_summary(self, pay_cycle: PayCycle, goal_service: "GoalService") -> PayCycleSummary:
        """Generate summary statistics for a pay cycle."""
        # Get all transactions for this cycle
        result = await self.db.execute(
            select(Transaction).where(Transaction.pay_cycle_id == pay_cycle.id)
        )
        transactions = list(result.scalars().all())
        
        # Calculate totals
        total_income = sum(t.amount for t in transactions if t.type == "income")
        total_expenses = sum(t.amount for t in transactions if t.type == "expense")
        total_savings = pay_cycle.income_amount - total_expenses
        net_balance = pay_cycle.income_amount + total_income - total_expenses
        
        # Get category goals with progress
        result = await self.db.execute(
            select(CategoryGoal)
            .options(selectinload(CategoryGoal.category))
            .where(CategoryGoal.pay_cycle_id == pay_cycle.id)
        )
        goals = list(result.scalars().all())
        
        category_breakdown = {}
        goal_completion = {}
        variances = {}
        total_rollover = Decimal("0.00")
        
        for goal in goals:
            category = goal.category
            category_transactions = [t for t in transactions if t.category_id == category.id]
            spent = sum(t.amount for t in category_transactions if t.type == "expense")
            
            # Calculate effective budget
            if goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * pay_cycle.income_amount
            else:
                budget = goal.goal_value
            effective_budget = budget + goal.rollover_balance
            
            # Completion percentage
            if effective_budget > 0:
                completion_pct = min(100, float((spent / effective_budget) * 100))
            else:
                completion_pct = 100 if spent == 0 else 0
            
            # Variance
            variance = effective_budget - spent
            variance_pct = float((variance / effective_budget) * 100) if effective_budget > 0 else 0
            
            # Rollover for unused budget
            unused = max(Decimal("0.00"), variance)
            total_rollover += unused
            
            category_breakdown[category.id] = {
                "name": category.name,
                "spent": float(spent),
                "budget": float(effective_budget),
                "percentage": round(completion_pct, 2),
            }
            
            goal_completion[category.id] = {
                "goal_type": goal.goal_type,
                "goal_value": float(goal.goal_value),
                "spent": float(spent),
                "completion_percentage": round(completion_pct, 2),
                "met": spent <= effective_budget,
            }
            
            variances[category.id] = {
                "planned": float(effective_budget),
                "actual": float(spent),
                "variance": float(variance),
                "variance_percentage": round(variance_pct, 2),
            }
        
        return PayCycleSummary(
            pay_cycle_id=pay_cycle.id,
            total_income=total_income,
            total_expenses=total_expenses,
            total_savings=total_savings,
            net_balance=net_balance,
            category_breakdown=category_breakdown,
            goal_completion=goal_completion,
            variances=variances,
            rollover_generated=total_rollover,
        )
    
    async def get_summary(self, pay_cycle_id: str, user_id: str) -> Optional[PayCycleSummary]:
        """Get summary for a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        return pay_cycle.summary
    
    async def delete(self, pay_cycle_id: str, user_id: str) -> None:
        """Delete a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "active":
            raise BadRequestException(detail="Cannot delete an active pay cycle")
        
        await self.db.delete(pay_cycle)
        await self.db.flush()
