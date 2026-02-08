"""
Transaction service for managing financial transactions.
"""
from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transaction import Transaction
from app.models.pay_cycle import PayCycle
from app.models.category import Category
from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.core.exceptions import NotFoundException, BadRequestException


class TransactionService:
    """Service for transaction operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, transaction_id: str, user_id: str) -> Optional[Transaction]:
        """Get transaction by ID."""
        result = await self.db.execute(
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(
                and_(Transaction.id == transaction_id, Transaction.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_by_pay_cycle(
        self, 
        pay_cycle_id: str, 
        user_id: str,
        category_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
    ) -> List[Transaction]:
        """List transactions for a pay cycle."""
        query = (
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(
                and_(
                    Transaction.pay_cycle_id == pay_cycle_id,
                    Transaction.user_id == user_id,
                )
            )
        )
        
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if transaction_type:
            query = query.where(Transaction.type == transaction_type)
        
        query = query.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create(self, user_id: str, data: TransactionCreate) -> Transaction:
        """Create a new transaction."""
        # Validate pay cycle exists and belongs to user
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.id == data.pay_cycle_id, PayCycle.user_id == user_id)
            )
        )
        pay_cycle = result.scalar_one_or_none()
        if not pay_cycle:
            raise NotFoundException(detail="Pay cycle not found")
        
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot add transaction to closed pay cycle")
        
        # Validate category exists and belongs to user
        result = await self.db.execute(
            select(Category).where(
                and_(Category.id == data.category_id, Category.user_id == user_id)
            )
        )
        if not result.scalar_one_or_none():
            raise NotFoundException(detail="Category not found")
        
        # Validate date is within pay cycle
        if not (pay_cycle.start_date <= data.transaction_date <= pay_cycle.end_date):
            raise BadRequestException(
                detail="Transaction date must be within pay cycle dates"
            )
        
        transaction = Transaction(
            user_id=user_id,
            pay_cycle_id=data.pay_cycle_id,
            category_id=data.category_id,
            amount=data.amount,
            description=data.description,
            transaction_date=data.transaction_date,
            type=data.type,
        )
        self.db.add(transaction)
        await self.db.flush()
        return transaction
    
    async def update(
        self, 
        transaction_id: str, 
        user_id: str, 
        data: TransactionUpdate
    ) -> Transaction:
        """Update a transaction."""
        transaction = await self.get_by_id(transaction_id, user_id)
        if not transaction:
            raise NotFoundException(detail="Transaction not found")
        
        # Check if pay cycle is closed
        result = await self.db.execute(
            select(PayCycle).where(PayCycle.id == transaction.pay_cycle_id)
        )
        pay_cycle = result.scalar_one()
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot update transaction in closed pay cycle")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Validate new category if provided
        if "category_id" in update_data:
            result = await self.db.execute(
                select(Category).where(
                    and_(
                        Category.id == update_data["category_id"], 
                        Category.user_id == user_id
                    )
                )
            )
            if not result.scalar_one_or_none():
                raise NotFoundException(detail="Category not found")
        
        # Validate new date if provided
        if "transaction_date" in update_data:
            new_date = update_data["transaction_date"]
            if not (pay_cycle.start_date <= new_date <= pay_cycle.end_date):
                raise BadRequestException(
                    detail="Transaction date must be within pay cycle dates"
                )
        
        for field, value in update_data.items():
            setattr(transaction, field, value)
        
        await self.db.flush()
        return transaction
    
    async def delete(self, transaction_id: str, user_id: str) -> None:
        """Delete a transaction."""
        transaction = await self.get_by_id(transaction_id, user_id)
        if not transaction:
            raise NotFoundException(detail="Transaction not found")
        
        # Check if pay cycle is closed
        result = await self.db.execute(
            select(PayCycle).where(PayCycle.id == transaction.pay_cycle_id)
        )
        pay_cycle = result.scalar_one()
        if pay_cycle.status == "closed":
            raise BadRequestException(detail="Cannot delete transaction from closed pay cycle")
        
        await self.db.delete(transaction)
        await self.db.flush()
    
    async def get_category_totals(
        self, 
        pay_cycle_id: str, 
        user_id: str
    ) -> dict[str, Decimal]:
        """Get total spending per category for a pay cycle."""
        result = await self.db.execute(
            select(
                Transaction.category_id,
                func.sum(Transaction.amount).label("total")
            )
            .where(
                and_(
                    Transaction.pay_cycle_id == pay_cycle_id,
                    Transaction.user_id == user_id,
                    Transaction.type == "expense",
                )
            )
            .group_by(Transaction.category_id)
        )
        return {row.category_id: row.total or Decimal("0.00") for row in result.all()}
    
    async def get_totals_by_type(
        self, 
        pay_cycle_id: str, 
        user_id: str
    ) -> dict[str, Decimal]:
        """Get total income and expenses for a pay cycle."""
        result = await self.db.execute(
            select(
                Transaction.type,
                func.sum(Transaction.amount).label("total")
            )
            .where(
                and_(
                    Transaction.pay_cycle_id == pay_cycle_id,
                    Transaction.user_id == user_id,
                )
            )
            .group_by(Transaction.type)
        )
        totals = {row.type: row.total or Decimal("0.00") for row in result.all()}
        return {
            "income": totals.get("income", Decimal("0.00")),
            "expense": totals.get("expense", Decimal("0.00")),
        }
