"""
User endpoints.
"""
from fastapi import APIRouter

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.starting_amount import StartingAmountSaveRequest, StartingAmountItem
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


@router.get("/me/starting-amounts", response_model=list[StartingAmountItem])
async def get_starting_amounts(
    current_user: CurrentUser,
    db: DbSession,
):
    service = UserService(db)
    amounts = await service.list_starting_amounts(current_user.id)
    return [
        StartingAmountItem(category_id=item.category_id, amount=item.amount)
        for item in amounts
    ]


@router.put("/me/starting-amounts", response_model=list[StartingAmountItem])
async def save_starting_amounts(
    payload: StartingAmountSaveRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    service = UserService(db)
    amounts = await service.save_starting_amounts(current_user.id, payload)
    return [
        StartingAmountItem(category_id=item.category_id, amount=item.amount)
        for item in amounts
    ]


@router.post("/me/complete-setup", response_model=UserResponse)
async def complete_setup(
    current_user: CurrentUser,
    db: DbSession,
):
    service = UserService(db)
    return await service.complete_setup(current_user.id)
