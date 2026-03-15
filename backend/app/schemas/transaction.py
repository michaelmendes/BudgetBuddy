"""
Transaction Pydantic schemas.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    """Base transaction schema."""
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: date
    type: str = Field("expense", pattern="^(expense|income)$")


class TransactionCreate(TransactionBase):
    """Schema for creating a transaction."""
    category_id: str
    pay_cycle_id: str


class TransactionBatchItem(BaseModel):
    """Schema for a single transaction item in a batch request."""
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: date


class TransactionBatchCreate(BaseModel):
    """Schema for batch transaction creation."""
    pay_cycle_id: str
    category_id: str
    type: str = Field("expense", pattern="^(expense|income)$")
    transactions: List[TransactionBatchItem] = Field(..., min_length=1)


class TransactionUpdate(BaseModel):
    """Schema for updating a transaction."""
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: Optional[date] = None
    category_id: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(expense|income)$")


class TransactionResponse(TransactionBase):
    """Schema for transaction response."""
    id: str
    user_id: str
    pay_cycle_id: str
    category_id: str
    recurring_transaction_id: Optional[str]
    is_recurring_instance: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionWithCategory(TransactionResponse):
    """Transaction with category name included."""
    category_name: str
    category_color: Optional[str]
