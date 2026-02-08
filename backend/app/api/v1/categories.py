"""
Category endpoints.
"""
from typing import List, Dict
from fastapi import APIRouter, Query

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import CategoryService

router = APIRouter()


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    current_user: CurrentUser,
    db: DbSession,
    include_archived: bool = Query(False),
):
    """List all categories for the current user."""
    service = CategoryService(db)
    return await service.list_by_user(current_user.id, include_archived)


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new category."""
    service = CategoryService(db)
    return await service.create(current_user.id, data)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific category."""
    service = CategoryService(db)
    category = await service.get_by_id(category_id, current_user.id)
    if not category:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Category not found")
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a category."""
    service = CategoryService(db)
    return await service.update(category_id, current_user.id, data)


@router.post("/{category_id}/archive", response_model=CategoryResponse)
async def archive_category(
    category_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Archive a category (soft delete)."""
    service = CategoryService(db)
    return await service.archive(category_id, current_user.id)


@router.post("/{category_id}/unarchive", response_model=CategoryResponse)
async def unarchive_category(
    category_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Restore an archived category."""
    service = CategoryService(db)
    return await service.unarchive(category_id, current_user.id)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Permanently delete a category."""
    service = CategoryService(db)
    await service.delete(category_id, current_user.id)


@router.post("/reorder", response_model=List[CategoryResponse])
async def reorder_categories(
    orders: Dict[str, int],
    current_user: CurrentUser,
    db: DbSession,
):
    """Reorder categories by updating sort_order values."""
    service = CategoryService(db)
    return await service.reorder(current_user.id, orders)
