"""
Category service for managing spending categories.
"""
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
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
            setattr(category, field, value)
        
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
