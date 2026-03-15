"""
Category service for managing spending categories.
"""
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.category_goal import CategoryGoal
from app.models.starting_amount import StartingAmount
from app.models.pay_cycle import PayCycle
from app.models.category_balance import CategoryBalance
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.core.exceptions import NotFoundException, ConflictException


class CategoryService:
    """Service for category operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, category_id: str, user_id: str) -> Optional[Category]:
        """Get category by ID for a specific user."""
        result = await self.db.execute(
            select(Category).where(
                and_(Category.id == category_id, Category.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(
        self, 
        user_id: str, 
        include_archived: bool = False
    ) -> List[Category]:
        """List categories for a user."""
        query = select(Category).where(Category.user_id == user_id)
        
        if not include_archived:
            query = query.where(Category.is_archived == False)
        
        query = query.order_by(Category.sort_order, Category.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create(self, user_id: str, data: CategoryCreate) -> Category:
        """Create a new category."""
        # Check for duplicate name
        existing = await self.db.execute(
            select(Category).where(
                and_(
                    Category.user_id == user_id,
                    Category.name == data.name,
                    Category.is_archived == False,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictException(detail="Category with this name already exists")
        
        category = Category(
            user_id=user_id,
            name=data.name,
            icon=data.icon,
            color=data.color,
            is_shared=data.is_shared,
            sort_order=data.sort_order,
        )
        self.db.add(category)
        await self.db.flush()

        starting_amount = data.starting_amount if data.starting_amount is not None else Decimal("0.00")
        await self._upsert_starting_amount(user_id=user_id, category_id=category.id, amount=starting_amount)
        await self._sync_active_cycle_balance(
            user_id=user_id,
            category_id=category.id,
            starting_amount=starting_amount,
        )

        if data.allocation_type and data.allocation_value is not None:
            await self._upsert_category_goal(
                user_id=user_id,
                category_id=category.id,
                goal_type=data.allocation_type,
                goal_value=data.allocation_value,
            )

        return category
    
    async def update(
        self, 
        category_id: str, 
        user_id: str, 
        data: CategoryUpdate
    ) -> Category:
        """Update a category."""
        category = await self.get_by_id(category_id, user_id)
        if not category:
            raise NotFoundException(detail="Category not found")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Check for duplicate name if updating name
        if "name" in update_data and update_data["name"] != category.name:
            existing = await self.db.execute(
                select(Category).where(
                    and_(
                        Category.user_id == user_id,
                        Category.name == update_data["name"],
                        Category.is_archived == False,
                        Category.id != category_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictException(detail="Category with this name already exists")
        
        for field, value in update_data.items():
            if field in {"allocation_type", "allocation_value"}:
                continue
            setattr(category, field, value)

        allocation_type = update_data.get("allocation_type")
        allocation_value = update_data.get("allocation_value")
        if allocation_type and allocation_value is not None:
            await self._upsert_category_goal(
                user_id=user_id,
                category_id=category.id,
                goal_type=allocation_type,
                goal_value=allocation_value,
            )
        
        await self.db.flush()
        return category
    
    async def archive(self, category_id: str, user_id: str) -> Category:
        """Archive a category (soft delete)."""
        category = await self.get_by_id(category_id, user_id)
        if not category:
            raise NotFoundException(detail="Category not found")
        
        category.is_archived = True
        await self.db.flush()
        return category
    
    async def unarchive(self, category_id: str, user_id: str) -> Category:
        """Restore an archived category."""
        result = await self.db.execute(
            select(Category).where(
                and_(
                    Category.id == category_id, 
                    Category.user_id == user_id,
                    Category.is_archived == True,
                )
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            raise NotFoundException(detail="Archived category not found")
        
        category.is_archived = False
        await self.db.flush()
        return category
    
    async def delete(self, category_id: str, user_id: str) -> None:
        """Permanently delete a category."""
        category = await self.get_by_id(category_id, user_id)
        if not category:
            raise NotFoundException(detail="Category not found")
        
        await self.db.delete(category)
        await self.db.flush()
    
    async def reorder(self, user_id: str, category_orders: dict[str, int]) -> List[Category]:
        """Reorder categories by updating sort_order."""
        categories = await self.list_by_user(user_id, include_archived=True)
        
        for category in categories:
            if category.id in category_orders:
                category.sort_order = category_orders[category.id]
        
        await self.db.flush()
        return await self.list_by_user(user_id, include_archived=True)

    async def _upsert_category_goal(
        self,
        user_id: str,
        category_id: str,
        goal_type: str,
        goal_value: Decimal,
    ) -> None:
        """Create or update the default goal allocation for a category."""
        goal_result = await self.db.execute(
            select(CategoryGoal).where(
                CategoryGoal.category_id == category_id
            )
        )
        existing_goal = goal_result.scalar_one_or_none()
        if existing_goal:
            existing_goal.goal_type = goal_type
            existing_goal.goal_value = goal_value
            return

        self.db.add(
            CategoryGoal(
                category_id=category_id,
                goal_type=goal_type,
                goal_value=goal_value,
            )
        )

    async def _upsert_starting_amount(self, user_id: str, category_id: str, amount: Decimal) -> None:
        """Create or update starting amount for a category."""
        result = await self.db.execute(
            select(StartingAmount).where(
                and_(
                    StartingAmount.user_id == user_id,
                    StartingAmount.category_id == category_id,
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.amount = amount
            return

        self.db.add(
            StartingAmount(
                user_id=user_id,
                category_id=category_id,
                amount=amount,
            )
        )

    async def _sync_active_cycle_balance(
        self,
        user_id: str,
        category_id: str,
        starting_amount: Decimal,
    ) -> None:
        """Create/update active-cycle balance row with selected starting amount."""
        active_cycle_result = await self.db.execute(
            select(PayCycle).where(
                and_(
                    PayCycle.user_id == user_id,
                    PayCycle.status == "active",
                )
            )
        )
        active_cycle = active_cycle_result.scalar_one_or_none()
        if not active_cycle:
            return

        balance_result = await self.db.execute(
            select(CategoryBalance).where(
                and_(
                    CategoryBalance.pay_cycle_id == active_cycle.id,
                    CategoryBalance.category_id == category_id,
                )
            )
        )
        cycle_balance = balance_result.scalar_one_or_none()
        if not cycle_balance:
            self.db.add(
                CategoryBalance(
                    pay_cycle_id=active_cycle.id,
                    category_id=category_id,
                    starting_balance=starting_amount,
                    spent=Decimal("0.00"),
                    paycheck_allocated=Decimal("0.00"),
                    closing_balance=starting_amount,
                )
            )
            return

        cycle_balance.starting_balance = starting_amount
        cycle_balance.closing_balance = starting_amount - cycle_balance.spent + cycle_balance.paycheck_allocated
