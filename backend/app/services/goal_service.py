"""
Goal service for managing category goals and long-term goals.
"""
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category_goal import CategoryGoal
from app.models.long_term_goal import LongTermGoal
from app.models.pay_cycle import PayCycle
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category_goal import CategoryGoalCreate, CategoryGoalUpdate, CategoryGoalProgress
from app.schemas.long_term_goal import LongTermGoalCreate, LongTermGoalUpdate
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException


class GoalService:
    """Service for goal-related operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ==================== Category Goals ====================
    
    async def get_category_goal(
        self, 
        goal_id: str, 
        user_id: str
    ) -> Optional[CategoryGoal]:
        """Get a category goal by ID."""
        result = await self.db.execute(
            select(CategoryGoal)
            .options(selectinload(CategoryGoal.category), selectinload(CategoryGoal.pay_cycle))
            .where(CategoryGoal.id == goal_id)
            .join(PayCycle)
            .where(PayCycle.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def list_goals_for_cycle(
        self, 
        pay_cycle_id: str, 
        user_id: str
    ) -> List[CategoryGoalProgress]:
        """List all category goals for a pay cycle with progress."""
        # Validate pay cycle
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.id == pay_cycle_id, PayCycle.user_id == user_id)
            )
        )
        pay_cycle = result.scalar_one_or_none()
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        # Get goals with categories
        result = await self.db.execute(
            select(CategoryGoal)
            .options(selectinload(CategoryGoal.category))
            .where(CategoryGoal.pay_cycle_id == pay_cycle_id)
        )
        goals = list(result.scalars().all())
        
        # Get spending per category
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
        
        # Calculate progress for each goal
        progress_list = []
        for goal in goals:
            spent = spending_by_category.get(goal.category_id, Decimal("0.00"))
            
            # Calculate effective budget
            if goal.goal_type == "percentage":
                budget = (goal.goal_value / 100) * pay_cycle.income_amount
            else:
                budget = goal.goal_value
            effective_budget = budget + goal.rollover_balance
            
            remaining = effective_budget - spent
            completion_pct = float((spent / effective_budget) * 100) if effective_budget > 0 else 0
            
            progress = CategoryGoalProgress(
                id=goal.id,
                category_id=goal.category_id,
                pay_cycle_id=goal.pay_cycle_id,
                goal_type=goal.goal_type,
                goal_value=goal.goal_value,
                rollover_balance=goal.rollover_balance,
                created_at=goal.created_at,
                effective_budget=effective_budget,
                spent=spent,
                remaining=remaining,
                completion_percentage=min(100, round(completion_pct, 2)),
                is_over_budget=spent > effective_budget,
            )
            progress_list.append(progress)
        
        return progress_list
    
    async def create_category_goal(
        self, 
        user_id: str, 
        data: CategoryGoalCreate
    ) -> CategoryGoal:
        """Create a category goal."""
        # Validate pay cycle
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.id == data.pay_cycle_id, PayCycle.user_id == user_id)
            )
        )
        pay_cycle = result.scalar_one_or_none()
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot add goals to closed pay cycle")
        
        # Validate category
        result = await self.db.execute(
            select(Category).where(
                and_(Category.id == data.category_id, Category.user_id == user_id)
            )
        )
        if not result.scalar_one_or_none():
            raise NotFoundException(detail="Category not found")
        
        # Check for existing goal
        result = await self.db.execute(
            select(CategoryGoal).where(
                and_(
                    CategoryGoal.category_id == data.category_id,
                    CategoryGoal.pay_cycle_id == data.pay_cycle_id,
                )
            )
        )
        if result.scalar_one_or_none():
            raise ConflictException(detail="Goal already exists for this category in this cycle")
        
        goal = CategoryGoal(
            category_id=data.category_id,
            pay_cycle_id=data.pay_cycle_id,
            goal_type=data.goal_type,
            goal_value=data.goal_value,
        )
        self.db.add(goal)
        await self.db.flush()
        return goal
    
    async def update_category_goal(
        self, 
        goal_id: str, 
        user_id: str, 
        data: CategoryGoalUpdate
    ) -> CategoryGoal:
        """Update a category goal."""
        goal = await self.get_category_goal(goal_id, user_id)
        if not goal:
            raise NotFoundException(detail="Category goal not found")
        
        if goal.pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot update goals in closed pay cycle")
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(goal, field, value)
        
        await self.db.flush()
        return goal
    
    async def delete_category_goal(self, goal_id: str, user_id: str) -> None:
        """Delete a category goal."""
        goal = await self.get_category_goal(goal_id, user_id)
        if not goal:
            raise NotFoundException(detail="Category goal not found")
        
        if goal.pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot delete goals from closed pay cycle")
        
        await self.db.delete(goal)
        await self.db.flush()
    
    async def copy_goals_to_cycle(
        self, 
        source_cycle_id: str, 
        target_cycle_id: str, 
        user_id: str
    ) -> List[CategoryGoal]:
        """Copy category goals from one cycle to another."""
        # Get source goals
        source_goals = await self.list_goals_for_cycle(source_cycle_id, user_id)
        
        # Validate target cycle
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.id == target_cycle_id, PayCycle.user_id == user_id)
            )
        )
        target_cycle = result.scalar_one_or_none()
        if not target_cycle:
            raise NotFoundException(detail="Target pay cycle not found")
        
        created_goals = []
        for source in source_goals:
            goal = CategoryGoal(
                category_id=source.category_id,
                pay_cycle_id=target_cycle_id,
                goal_type=source.goal_type,
                goal_value=source.goal_value,
            )
            self.db.add(goal)
            created_goals.append(goal)
        
        await self.db.flush()
        return created_goals
    
    # ==================== Long-Term Goals ====================
    
    async def get_long_term_goal(
        self, 
        goal_id: str, 
        user_id: str
    ) -> Optional[LongTermGoal]:
        """Get a long-term goal by ID."""
        result = await self.db.execute(
            select(LongTermGoal).where(
                and_(LongTermGoal.id == goal_id, LongTermGoal.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_long_term_goals(
        self, 
        user_id: str, 
        status: Optional[str] = None
    ) -> List[LongTermGoal]:
        """List long-term goals for a user."""
        query = select(LongTermGoal).where(LongTermGoal.user_id == user_id)
        
        if status:
            query = query.where(LongTermGoal.status == status)
        
        query = query.order_by(LongTermGoal.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_long_term_goal(
        self, 
        user_id: str, 
        data: LongTermGoalCreate
    ) -> LongTermGoal:
        """Create a long-term goal."""
        goal = LongTermGoal(
            user_id=user_id,
            name=data.name,
            description=data.description,
            target_amount=data.target_amount,
            current_amount=data.current_amount,
            target_date=data.target_date,
        )
        self.db.add(goal)
        await self.db.flush()
        return goal
    
    async def update_long_term_goal(
        self, 
        goal_id: str, 
        user_id: str, 
        data: LongTermGoalUpdate
    ) -> LongTermGoal:
        """Update a long-term goal."""
        goal = await self.get_long_term_goal(goal_id, user_id)
        if not goal:
            raise NotFoundException(detail="Long-term goal not found")
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(goal, field, value)
        
        # Auto-complete if target reached
        if goal.current_amount >= goal.target_amount and goal.status == "active":
            goal.status = "completed"
        
        await self.db.flush()
        return goal
    
    async def add_contribution(
        self, 
        goal_id: str, 
        user_id: str, 
        amount: Decimal
    ) -> LongTermGoal:
        """Add a contribution to a long-term goal."""
        goal = await self.get_long_term_goal(goal_id, user_id)
        if not goal:
            raise NotFoundException(detail="Long-term goal not found")
        
        if goal.status != "active":
            raise BadRequestException(detail="Cannot contribute to inactive goal")
        
        goal.current_amount += amount
        
        # Auto-complete if target reached
        if goal.current_amount >= goal.target_amount:
            goal.status = "completed"
        
        await self.db.flush()
        return goal
    
    async def delete_long_term_goal(self, goal_id: str, user_id: str) -> None:
        """Delete a long-term goal."""
        goal = await self.get_long_term_goal(goal_id, user_id)
        if not goal:
            raise NotFoundException(detail="Long-term goal not found")
        
        await self.db.delete(goal)
        await self.db.flush()
