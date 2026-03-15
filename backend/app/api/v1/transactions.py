"""
Transaction endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from app.api.v1.deps import DbSession, CurrentUser
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionBatchCreate,
    TransactionResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter()


@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    pay_cycle_id: str = Query(..., description="Pay cycle to list transactions for"),
    category_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, pattern="^(expense|income)$"),
):
    """List transactions for a pay cycle."""
    service = TransactionService(db)
    return await service.list_by_pay_cycle(
        pay_cycle_id, 
        current_user.id,
        category_id=category_id,
        transaction_type=type,
    )


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create a new transaction."""
    service = TransactionService(db)
    return await service.create(current_user.id, data)


@router.post("/batch", response_model=List[TransactionResponse], status_code=201)
async def create_transactions_batch(
    data: TransactionBatchCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Create multiple transactions for one category in a single request."""
    service = TransactionService(db)
    return await service.create_batch(current_user.id, data)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Get a specific transaction."""
    service = TransactionService(db)
    transaction = await service.get_by_id(transaction_id, current_user.id)
    if not transaction:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(detail="Transaction not found")
    return transaction


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    data: TransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update a transaction."""
    service = TransactionService(db)
    return await service.update(transaction_id, current_user.id, data)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete a transaction."""
    service = TransactionService(db)
    await service.delete(transaction_id, current_user.id)


@router.get("/summary/by-category")
async def get_category_totals(
    current_user: CurrentUser,
    db: DbSession,
    pay_cycle_id: str = Query(...),
):
    """Get total spending per category for a pay cycle."""
    service = TransactionService(db)
    totals = await service.get_category_totals(pay_cycle_id, current_user.id)
    return {k: float(v) for k, v in totals.items()}


@router.get("/summary/totals")
async def get_totals(
    current_user: CurrentUser,
    db: DbSession,
    pay_cycle_id: str = Query(...),
):
    """Get total income and expenses for a pay cycle."""
    service = TransactionService(db)
    totals = await service.get_totals_by_type(pay_cycle_id, current_user.id)
    return {k: float(v) for k, v in totals.items()}
