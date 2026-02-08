"""
Goal endpoints (category goals and long-term goals).
"""
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Query

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.category_goal import (
    CategoryGoalCreate, 
    CategoryGoalUpdate, 
    CategoryGoalResponse,
    CategoryGoalProgress,
)
from app.schemas.long_term_goal import (
    LongTermGoalCreate,
    LongTermGoalUpdate,
    LongTermGoalResponse,
    LongTermGoalContribution,
)
from app.services.goal_service import GoalService

router = APIRouter()


# ==================== Category Goals ====================

@router.get("/category", response_model=List[CategoryGoalProgress])
async def list_category_goals(
    current_user: CurrentUser,
    db: DbSession,
    pay_cycle_id: str = Query(...),
):
    """List all category goals for a pay cycle with progress."""
    service = GoalService(db)
    return await service.list_goals_for_cycle(pay_cycle_id, current_user.id)


@router.post("/category", response_model=CategoryGoalResponse, status_code=201)
async def create_category_goal(
    data: CategoryGoalCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new category goal."""
    service = GoalService(db)
    return await service.create_category_goal(current_user.id, data)


@router.get("/category/{goal_id}", response_model=CategoryGoalResponse)
async def get_category_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific category goal."""
    service = GoalService(db)
    goal = await service.get_category_goal(goal_id, current_user.id)
    if not goal:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Category goal not found")
    return goal


@router.patch("/category/{goal_id}", response_model=CategoryGoalResponse)
async def update_category_goal(
    goal_id: str,
    data: CategoryGoalUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a category goal."""
    service = GoalService(db)
    return await service.update_category_goal(goal_id, current_user.id, data)


@router.delete("/category/{goal_id}", status_code=204)
async def delete_category_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete a category goal."""
    service = GoalService(db)
    await service.delete_category_goal(goal_id, current_user.id)


@router.post("/category/copy")
async def copy_goals_to_cycle(
    current_user: CurrentUser,
    db: DbSession,
    source_cycle_id: str = Query(...),
    target_cycle_id: str = Query(...),
):
    """Copy category goals from one pay cycle to another."""
    service = GoalService(db)
    created = await service.copy_goals_to_cycle(
        source_cycle_id, 
        target_cycle_id, 
        current_user.id
    )
    return {"copied_count": len(created)}


# ==================== Long-Term Goals ====================

@router.get("/long-term", response_model=List[LongTermGoalResponse])
async def list_long_term_goals(
    current_user: CurrentUser,
    db: DbSession,
    status: Optional[str] = Query(None, pattern="^(active|completed|cancelled)$"),
):
    """List all long-term goals."""
    service = GoalService(db)
    return await service.list_long_term_goals(current_user.id, status)


@router.post("/long-term", response_model=LongTermGoalResponse, status_code=201)
async def create_long_term_goal(
    data: LongTermGoalCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new long-term goal."""
    service = GoalService(db)
    return await service.create_long_term_goal(current_user.id, data)


@router.get("/long-term/{goal_id}", response_model=LongTermGoalResponse)
async def get_long_term_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific long-term goal."""
    service = GoalService(db)
    goal = await service.get_long_term_goal(goal_id, current_user.id)
    if not goal:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Long-term goal not found")
    return goal


@router.patch("/long-term/{goal_id}", response_model=LongTermGoalResponse)
async def update_long_term_goal(
    goal_id: str,
    data: LongTermGoalUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a long-term goal."""
    service = GoalService(db)
    return await service.update_long_term_goal(goal_id, current_user.id, data)


@router.post("/long-term/{goal_id}/contribute", response_model=LongTermGoalResponse)
async def add_contribution(
    goal_id: str,
    data: LongTermGoalContribution,
    current_user: CurrentUser,
    db: DbSession,
):
    """Add a contribution to a long-term goal."""
    service = GoalService(db)
    return await service.add_contribution(goal_id, current_user.id, data.amount)


@router.delete("/long-term/{goal_id}", status_code=204)
async def delete_long_term_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete a long-term goal."""
    service = GoalService(db)
    await service.delete_long_term_goal(goal_id, current_user.id)
