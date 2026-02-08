"""
Recurring transaction endpoints.
"""
from typing import List
from fastapi import APIRouter, Query

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.recurring_transaction import (
    RecurringTransactionCreate, 
    RecurringTransactionUpdate, 
    RecurringTransactionResponse,
)
from app.services.recurring_service import RecurringTransactionService
from app.services.pay_cycle_service import PayCycleService

router = APIRouter()


@router.get("", response_model=List[RecurringTransactionResponse])
async def list_recurring_transactions(
    current_user: CurrentUser,
    db: DbSession,
    active_only: bool = Query(True),
):
    """List all recurring transactions."""
    service = RecurringTransactionService(db)
    return await service.list_by_user(current_user.id, active_only)


@router.post("", response_model=RecurringTransactionResponse, status_code=201)
async def create_recurring_transaction(
    data: RecurringTransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new recurring transaction."""
    service = RecurringTransactionService(db)
    return await service.create(current_user.id, data)


@router.get("/{recurring_id}", response_model=RecurringTransactionResponse)
async def get_recurring_transaction(
    recurring_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific recurring transaction."""
    service = RecurringTransactionService(db)
    recurring = await service.get_by_id(recurring_id, current_user.id)
    if not recurring:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Recurring transaction not found")
    return recurring


@router.patch("/{recurring_id}", response_model=RecurringTransactionResponse)
async def update_recurring_transaction(
    recurring_id: str,
    data: RecurringTransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a recurring transaction."""
    service = RecurringTransactionService(db)
    return await service.update(recurring_id, current_user.id, data)


@router.post("/{recurring_id}/deactivate", response_model=RecurringTransactionResponse)
async def deactivate_recurring_transaction(
    recurring_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Deactivate a recurring transaction."""
    service = RecurringTransactionService(db)
    return await service.deactivate(recurring_id, current_user.id)


@router.delete("/{recurring_id}", status_code=204)
async def delete_recurring_transaction(
    recurring_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete a recurring transaction."""
    service = RecurringTransactionService(db)
    await service.delete(recurring_id, current_user.id)


@router.post("/generate-for-cycle")
async def generate_recurring_for_cycle(
    current_user: CurrentUser,
    db: DbSession,
    pay_cycle_id: str = Query(...),
):
    """
    Generate transaction instances from recurring templates for a pay cycle.
    Returns the list of created transactions.
    """
    recurring_service = RecurringTransactionService(db)
    pay_cycle_service = PayCycleService(db)
    
    pay_cycle = await pay_cycle_service.get_by_id(pay_cycle_id, current_user.id)
    if not pay_cycle:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Pay cycle not found")
    
    created = await recurring_service.generate_instances_for_cycle(pay_cycle)
    return {"created_count": len(created), "transactions": created}
