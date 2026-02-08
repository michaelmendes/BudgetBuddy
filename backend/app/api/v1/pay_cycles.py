"""
Pay cycle endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.pay_cycle import (
    PayCycleCreate, 
    PayCycleUpdate, 
    PayCycleResponse, 
    PayCycleWithSummary,
    PayCycleSummaryResponse,
)
from app.services.pay_cycle_service import PayCycleService
from app.services.rollover_service import RolloverService
from app.services.goal_service import GoalService

router = APIRouter()


@router.get("", response_model=List[PayCycleWithSummary])
async def list_pay_cycles(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List all pay cycles for the current user."""
    service = PayCycleService(db)
    cycles = await service.list_by_user(current_user.id, limit, offset)
    return cycles


@router.get("/active", response_model=Optional[PayCycleResponse])
async def get_active_pay_cycle(
    current_user: CurrentUser,
    db: DbSession,
):
    """Get the currently active pay cycle."""
    service = PayCycleService(db)
    return await service.get_active(current_user.id)


@router.post("", response_model=PayCycleResponse, status_code=201)
async def create_pay_cycle(
    data: PayCycleCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new pay cycle."""
    service = PayCycleService(db)
    return await service.create(current_user.id, data)


@router.get("/{pay_cycle_id}", response_model=PayCycleWithSummary)
async def get_pay_cycle(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific pay cycle."""
    service = PayCycleService(db)
    cycle = await service.get_by_id(pay_cycle_id, current_user.id)
    if not cycle:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Pay cycle not found")
    return cycle


@router.patch("/{pay_cycle_id}", response_model=PayCycleResponse)
async def update_pay_cycle(
    pay_cycle_id: str,
    data: PayCycleUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a pay cycle."""
    service = PayCycleService(db)
    return await service.update(pay_cycle_id, current_user.id, data)


@router.post("/{pay_cycle_id}/activate", response_model=PayCycleResponse)
async def activate_pay_cycle(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Activate a pay cycle."""
    service = PayCycleService(db)
    return await service.activate(pay_cycle_id, current_user.id)


@router.post("/{pay_cycle_id}/close", response_model=PayCycleWithSummary)
async def close_pay_cycle(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Close a pay cycle.
    This will:
    1. Generate a summary with totals, goal completion, and variances
    2. Calculate and apply rollover amounts to the next cycle
    3. Mark the cycle as closed
    """
    pay_cycle_service = PayCycleService(db)
    rollover_service = RolloverService(db)
    goal_service = GoalService(db)
    
    cycle = await pay_cycle_service.close(
        pay_cycle_id, 
        current_user.id, 
        rollover_service,
        goal_service,
    )
    return cycle


@router.get("/{pay_cycle_id}/summary", response_model=Optional[PayCycleSummaryResponse])
async def get_pay_cycle_summary(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get the summary for a pay cycle (only available after closing)."""
    service = PayCycleService(db)
    return await service.get_summary(pay_cycle_id, current_user.id)


@router.get("/{pay_cycle_id}/potential-rollover")
async def get_potential_rollover(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Preview what would roll over if the cycle closed now."""
    service = RolloverService(db)
    return await service.calculate_potential_rollover(pay_cycle_id, current_user.id)


@router.delete("/{pay_cycle_id}", status_code=204)
async def delete_pay_cycle(
    pay_cycle_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete a pay cycle (not allowed for active cycles)."""
    service = PayCycleService(db)
    await service.delete(pay_cycle_id, current_user.id)
