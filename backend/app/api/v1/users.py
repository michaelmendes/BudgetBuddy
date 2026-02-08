"""
User endpoints.
"""
from fastapi import APIRouter

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.user import UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: CurrentUser):
    """Get the current user's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update the current user's profile."""
    service = UserService(db)
    user = await service.update(current_user.id, user_data)
    return user


@router.delete("/me", status_code=204)
async def delete_current_user(
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete the current user's account."""
    service = UserService(db)
    await service.delete(current_user.id)
