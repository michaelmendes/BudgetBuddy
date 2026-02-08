"""
Recurring transaction service for automated transaction generation.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurring_transaction import RecurringTransaction
from app.models.transaction import Transaction
from app.models.pay_cycle import PayCycle
from app.models.category import Category
from app.schemas.recurring_transaction import RecurringTransactionCreate, RecurringTransactionUpdate
from app.core.exceptions import NotFoundException, BadRequestException


class RecurringTransactionService:
    """Service for recurring transaction operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(
        self, 
        recurring_id: str, 
        user_id: str
    ) -> Optional[RecurringTransaction]:
        """Get recurring transaction by ID."""
        result = await self.db.execute(
            select(RecurringTransaction).where(
                and_(
                    RecurringTransaction.id == recurring_id,
                    RecurringTransaction.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(
        self, 
        user_id: str, 
        active_only: bool = True
    ) -> List[RecurringTransaction]:
        """List recurring transactions for a user."""
        query = select(RecurringTransaction).where(
            RecurringTransaction.user_id == user_id
        )
        
        if active_only:
            query = query.where(RecurringTransaction.is_active == True)
        
        query = query.order_by(RecurringTransaction.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create(
        self, 
        user_id: str, 
        data: RecurringTransactionCreate
    ) -> RecurringTransaction:
        """Create a new recurring transaction."""
        # Validate category
        result = await self.db.execute(
            select(Category).where(
                and_(Category.id == data.category_id, Category.user_id == user_id)
            )
        )
        if not result.scalar_one_or_none():
            raise NotFoundException(detail="Category not found")
        
        recurring = RecurringTransaction(
            user_id=user_id,
            category_id=data.category_id,
            amount=data.amount,
            description=data.description,
            frequency=data.frequency,
            start_date=data.start_date,
            end_date=data.end_date,
            day_of_week=data.day_of_week,
            day_of_month=data.day_of_month,
            type=data.type,
        )
        self.db.add(recurring)
        await self.db.flush()
        return recurring
    
    async def update(
        self, 
        recurring_id: str, 
        user_id: str, 
        data: RecurringTransactionUpdate
    ) -> RecurringTransaction:
        """Update a recurring transaction."""
        recurring = await self.get_by_id(recurring_id, user_id)
        if not recurring:
            raise NotFoundException(detail="Recurring transaction not found")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Validate category if provided
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
        
        for field, value in update_data.items():
            setattr(recurring, field, value)
        
        await self.db.flush()
        return recurring
    
    async def deactivate(self, recurring_id: str, user_id: str) -> RecurringTransaction:
        """Deactivate a recurring transaction."""
        recurring = await self.get_by_id(recurring_id, user_id)
        if not recurring:
            raise NotFoundException(detail="Recurring transaction not found")
        
        recurring.is_active = False
        await self.db.flush()
        return recurring
    
    async def delete(self, recurring_id: str, user_id: str) -> None:
        """Delete a recurring transaction."""
        recurring = await self.get_by_id(recurring_id, user_id)
        if not recurring:
            raise NotFoundException(detail="Recurring transaction not found")
        
        await self.db.delete(recurring)
        await self.db.flush()
    
    async def generate_instances_for_cycle(
        self, 
        pay_cycle: PayCycle
    ) -> List[Transaction]:
        """Generate transaction instances for a pay cycle from recurring templates."""
        # Get active recurring transactions for user
        result = await self.db.execute(
            select(RecurringTransaction).where(
                and_(
                    RecurringTransaction.user_id == pay_cycle.user_id,
                    RecurringTransaction.is_active == True,
                    RecurringTransaction.start_date <= pay_cycle.end_date,
                )
            )
        )
        recurring_list = list(result.scalars().all())
        
        created_transactions = []
        
        for recurring in recurring_list:
            # Skip if end_date is before cycle start
            if recurring.end_date and recurring.end_date < pay_cycle.start_date:
                continue
            
            # Get dates for this recurring transaction within the cycle
            occurrence_dates = self._get_occurrence_dates(
                recurring=recurring,
                start_date=max(pay_cycle.start_date, recurring.start_date),
                end_date=min(
                    pay_cycle.end_date, 
                    recurring.end_date or pay_cycle.end_date
                ),
            )
            
            for occurrence_date in occurrence_dates:
                # Check if instance already exists
                existing = await self.db.execute(
                    select(Transaction).where(
                        and_(
                            Transaction.recurring_transaction_id == recurring.id,
                            Transaction.transaction_date == occurrence_date,
                            Transaction.pay_cycle_id == pay_cycle.id,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue
                
                # Create transaction instance
                transaction = Transaction(
                    user_id=pay_cycle.user_id,
                    pay_cycle_id=pay_cycle.id,
                    category_id=recurring.category_id,
                    recurring_transaction_id=recurring.id,
                    amount=recurring.amount,
                    description=recurring.description,
                    transaction_date=occurrence_date,
                    type=recurring.type,
                    is_recurring_instance=True,
                )
                self.db.add(transaction)
                created_transactions.append(transaction)
        
        await self.db.flush()
        return created_transactions
    
    def _get_occurrence_dates(
        self,
        recurring: RecurringTransaction,
        start_date: date,
        end_date: date,
    ) -> List[date]:
        """Calculate occurrence dates for a recurring transaction within a date range."""
        dates = []
        current = start_date
        
        while current <= end_date:
            if recurring.frequency == "weekly":
                # Weekly: check if day of week matches
                if current.weekday() == recurring.day_of_week:
                    dates.append(current)
                    current += timedelta(days=7)
                else:
                    current += timedelta(days=1)
            
            elif recurring.frequency == "biweekly":
                # Biweekly: check if day of week matches and week number
                if current.weekday() == recurring.day_of_week:
                    # Calculate weeks since start_date
                    weeks_diff = (current - recurring.start_date).days // 7
                    if weeks_diff % 2 == 0:
                        dates.append(current)
                    current += timedelta(days=7)
                else:
                    current += timedelta(days=1)
            
            elif recurring.frequency == "monthly":
                # Monthly: check if day of month matches
                target_day = min(recurring.day_of_month, self._days_in_month(current))
                if current.day == target_day:
                    dates.append(current)
                    # Move to next month
                    if current.month == 12:
                        current = date(current.year + 1, 1, 1)
                    else:
                        current = date(current.year, current.month + 1, 1)
                else:
                    current += timedelta(days=1)
        
        return dates
    
    @staticmethod
    def _days_in_month(d: date) -> int:
        """Get the number of days in a month."""
        if d.month == 12:
            next_month = date(d.year + 1, 1, 1)
        else:
            next_month = date(d.year, d.month + 1, 1)
        return (next_month - date(d.year, d.month, 1)).days
