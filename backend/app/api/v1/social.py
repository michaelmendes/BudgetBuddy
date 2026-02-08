"""
Social endpoints for viewing friend progress.
IMPORTANT: These endpoints ONLY expose percentage-based metrics, never raw amounts.
"""
from typing import List, Optional
from fastapi import APIRouter

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.social import FriendProgress, LeaderboardEntry
from app.services.social_service import SocialService

router = APIRouter()


@router.get("/friends", response_model=List[FriendProgress])
async def get_all_friends_progress(
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get progress for all friends.
    
    Returns ONLY:
    - Category names and completion percentages
    - Whether they are on track or over budget
    - Overall budget usage percentage
    
    NEVER returns raw monetary amounts.
    """
    service = SocialService(db)
    return await service.get_all_friends_progress(current_user.id)


@router.get("/friends/{friend_id}", response_model=Optional[FriendProgress])
async def get_friend_progress(
    friend_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific friend's progress on shared categories.
    
    Returns ONLY percentage-based metrics for privacy.
    Only shows categories the friend has marked as shared (is_shared=true).
    """
    service = SocialService(db)
    return await service.get_friend_progress(current_user.id, friend_id)


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a leaderboard of friends based on budget adherence.
    
    Ranking is based on:
    - Budget adherence score (how well they stick to budgets)
    - Goals met percentage
    
    All metrics are percentage-based for privacy.
    """
    service = SocialService(db)
    return await service.get_leaderboard(current_user.id)
