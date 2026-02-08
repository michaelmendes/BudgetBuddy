"""
Friendship endpoints.
"""
from typing import List
from fastapi import APIRouter

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.friendship import FriendshipCreate, FriendshipResponse, FriendInfo
from app.services.friendship_service import FriendshipService

router = APIRouter()


@router.get("", response_model=List[FriendInfo])
async def list_friends(
    current_user: CurrentUser,
    db: DbSession,
):
    """List all accepted friends."""
    service = FriendshipService(db)
    return await service.list_friends(current_user.id)


@router.get("/requests/received", response_model=List[FriendshipResponse])
async def list_received_requests(
    current_user: CurrentUser,
    db: DbSession,
):
    """List pending friend requests received."""
    service = FriendshipService(db)
    return await service.list_pending_requests(current_user.id)


@router.get("/requests/sent", response_model=List[FriendshipResponse])
async def list_sent_requests(
    current_user: CurrentUser,
    db: DbSession,
):
    """List pending friend requests sent."""
    service = FriendshipService(db)
    return await service.list_sent_requests(current_user.id)


@router.post("/request", response_model=FriendshipResponse, status_code=201)
async def send_friend_request(
    data: FriendshipCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Send a friend request to another user by email."""
    service = FriendshipService(db)
    return await service.send_request(current_user.id, data)


@router.post("/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Accept a friend request."""
    service = FriendshipService(db)
    return await service.accept_request(friendship_id, current_user.id)


@router.post("/{friendship_id}/reject", status_code=204)
async def reject_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Reject/delete a friend request."""
    service = FriendshipService(db)
    await service.reject_request(friendship_id, current_user.id)


@router.post("/{friendship_id}/block", response_model=FriendshipResponse)
async def block_user(
    friendship_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Block a user."""
    service = FriendshipService(db)
    return await service.block_user(friendship_id, current_user.id)


@router.delete("/{friendship_id}", status_code=204)
async def unfriend(
    friendship_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove a friend."""
    service = FriendshipService(db)
    await service.unfriend(friendship_id, current_user.id)
