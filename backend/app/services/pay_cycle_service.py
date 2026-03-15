"""
PayCycle service for managing budget periods.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pay_cycle import PayCycle
from app.models.pay_cycle_summary import PayCycleSummary
from app.models.category_goal import CategoryGoal
from app.models.category_balance import CategoryBalance
from app.models.starting_amount import StartingAmount
from app.models.category import Category
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
            .options(selectinload(PayCycle.category_balances))
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
        # Determine whether this is the user's first cycle
        cycle_count_result = await self.db.execute(
            select(PayCycle.id).where(PayCycle.user_id == user_id)
        )
        is_first_cycle = cycle_count_result.first() is None

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
        
        # Determine status on creation.
        # Past cycles should still require an explicit manual close action.
        today = datetime.now(timezone.utc).date()
        if data.start_date > today:
            status = "upcoming"
        else:
            status = "active"

        previous_cycle_result = await self.db.execute(
            select(PayCycle.id)
            .where(
                and_(
                    PayCycle.user_id == user_id,
                    PayCycle.end_date < data.start_date,
                )
            )
            .order_by(PayCycle.end_date.desc())
            .limit(1)
        )
        previous_cycle_row = previous_cycle_result.first()
        previous_cycle_id = previous_cycle_row.id if previous_cycle_row else None

        next_cycle_result = await self.db.execute(
            select(PayCycle)
            .where(
                and_(
                    PayCycle.user_id == user_id,
                    PayCycle.start_date > data.end_date,
                )
            )
            .order_by(PayCycle.start_date.asc())
            .limit(1)
        )
        next_cycle = next_cycle_result.scalar_one_or_none()
        
        pay_cycle = PayCycle(
            user_id=user_id,
            start_date=data.start_date,
            end_date=data.end_date,
            income_amount=data.income_amount,
            status=status,
            previous_cycle=previous_cycle_id,
        )
        self.db.add(pay_cycle)
        await self.db.flush()

        if next_cycle:
            next_cycle.previous_cycle = pay_cycle.id

        await self._initialize_cycle_balances(
            user_id=user_id,
            pay_cycle_id=pay_cycle.id,
            previous_cycle_id=previous_cycle_id,
            is_first_cycle=is_first_cycle,
        )

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
        actual_income_amount: Optional[Decimal] = None,
        category_allocations: Optional[dict[str, Decimal]] = None,
    ) -> PayCycle:
        """Close a pay cycle, generate summary, and process rollovers."""
        from app.services.rollover_service import RolloverService
        from app.services.goal_service import GoalService
        
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Pay cycle is already closed")

        if actual_income_amount is not None:
            pay_cycle.income_amount = actual_income_amount

        if category_allocations is not None:
            await self._validate_manual_allocations(pay_cycle, user_id, category_allocations)
        
        # Generate summary
        summary = await self._generate_summary(pay_cycle, goal_service)
        self.db.add(summary)
        
        # Process rollovers to next cycle
        if category_allocations is not None:
            await rollover_service.process_manual_rollovers(pay_cycle, category_allocations)
        else:
            await rollover_service.process_rollovers(pay_cycle)
        
        # Update status
        pay_cycle.status = "closed"
        pay_cycle.closed_at = datetime.now(timezone.utc)
        
        await self.db.flush()
        return pay_cycle

    async def _validate_manual_allocations(
        self,
        pay_cycle: PayCycle,
        user_id: str,
        category_allocations: dict[str, Decimal],
    ) -> None:
        """Validate that manual allocations match the close-screen allocation rule."""
        # Validate categories belong to the user.
        categories_result = await self.db.execute(
            select(Category.id).where(Category.user_id == user_id)
        )
        valid_category_ids = {row.id for row in categories_result.all()}
        invalid_ids = [category_id for category_id in category_allocations if category_id not in valid_category_ids]
        if invalid_ids:
            raise BadRequestException(detail="Allocations contain invalid categories")

        # Close-page rule: actual paycheck - allocated total must equal 0.
        allocated_total = sum(category_allocations.values(), Decimal("0.00"))
        if allocated_total != pay_cycle.income_amount:
            raise BadRequestException(detail="Category allocations must exactly equal the actual paycheck amount")
    
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
            .join(Category)
            .where(Category.user_id == pay_cycle.user_id)
        )
        goals = list(result.scalars().all())
        goals_by_category = {goal.category_id: goal for goal in goals}

        balance_result = await self.db.execute(
            select(CategoryBalance).where(CategoryBalance.pay_cycle_id == pay_cycle.id)
        )
        starting_by_category = {
            balance.category_id: balance.starting_balance
            for balance in balance_result.scalars().all()
        }
        
        category_breakdown = {}
        goal_completion = {}
        variances = {}
        total_rollover = Decimal("0.00")
        
        category_ids = set(goals_by_category.keys()) | set(starting_by_category.keys())
        categories_by_id = {goal.category_id: goal.category for goal in goals}
        missing_category_ids = category_ids - set(categories_by_id.keys())
        if missing_category_ids:
            category_result = await self.db.execute(
                select(Category).where(Category.id.in_(missing_category_ids))
            )
            categories_by_id.update({category.id: category for category in category_result.scalars().all()})

        for category_id in category_ids:
            goal = goals_by_category.get(category_id)
            category = categories_by_id.get(category_id)
            if not category:
                continue
            category_transactions = [t for t in transactions if t.category_id == category.id]
            spent = sum(t.amount for t in category_transactions if t.type == "expense")
            
            # Calculate effective budget
            if goal and goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * pay_cycle.income_amount
            elif goal:
                budget = goal.goal_value
            else:
                budget = Decimal("0.00")
            starting_balance = starting_by_category.get(category_id, Decimal("0.00"))
            effective_budget = budget + starting_balance
            
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
                "goal_type": goal.goal_type if goal else "fixed",
                "goal_value": float(goal.goal_value) if goal else 0.0,
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

    async def _initialize_cycle_balances(
        self,
        user_id: str,
        pay_cycle_id: str,
        previous_cycle_id: Optional[str],
        is_first_cycle: bool,
    ) -> None:
        """Create category balance rows for a new cycle."""
        categories_result = await self.db.execute(
            select(Category.id).where(Category.user_id == user_id)
        )
        category_ids = [row.id for row in categories_result.all()]

        starting_by_category: dict[str, Decimal] = {category_id: Decimal("0.00") for category_id in category_ids}

        if previous_cycle_id:
            previous_result = await self.db.execute(
                select(CategoryBalance).where(CategoryBalance.pay_cycle_id == previous_cycle_id)
            )
            for balance in previous_result.scalars().all():
                starting_by_category[balance.category_id] = balance.closing_balance
        elif is_first_cycle:
            starting_amounts_result = await self.db.execute(
                select(StartingAmount).where(StartingAmount.user_id == user_id)
            )
            for item in starting_amounts_result.scalars().all():
                starting_by_category[item.category_id] = item.amount

        for category_id in category_ids:
            starting_balance = starting_by_category.get(category_id, Decimal("0.00"))
            self.db.add(
                CategoryBalance(
                    category_id=category_id,
                    pay_cycle_id=pay_cycle_id,
                    starting_balance=starting_balance,
                    spent=Decimal("0.00"),
                    paycheck_allocated=Decimal("0.00"),
                    closing_balance=starting_balance,
                )
            )
        await self.db.flush()
    
    async def get_summary(self, pay_cycle_id: str, user_id: str) -> Optional[PayCycleSummary]:
        """Get summary for a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        return pay_cycle.summary

    async def list_category_balances(self, pay_cycle_id: str, user_id: str) -> list[dict]:
        """Get category balances for a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")

        result = await self.db.execute(
            select(CategoryBalance, Category)
            .join(Category, Category.id == CategoryBalance.category_id)
            .where(
                and_(
                    CategoryBalance.pay_cycle_id == pay_cycle_id,
                    Category.user_id == user_id,
                )
            )
            .order_by(Category.sort_order.asc(), Category.name.asc())
        )

        return [
            {
                "category_id": balance.category_id,
                "category_name": category.name,
                "category_icon": category.icon,
                "starting_balance": balance.starting_balance,
                "spent": balance.spent,
                "paycheck_allocated": balance.paycheck_allocated,
                "closing_balance": balance.closing_balance,
            }
            for balance, category in result.all()
        ]
    
    async def delete(self, pay_cycle_id: str, user_id: str) -> None:
        """Delete a pay cycle."""
        pay_cycle = await self.get_by_id(pay_cycle_id, user_id)
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "active":
            raise BadRequestException(detail="Cannot delete an active pay cycle")
        
        await self.db.delete(pay_cycle)
        await self.db.flush()
