"""
RecurringTransaction Pydantic schemas.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class RecurringTransactionBase(BaseModel):
    """Base recurring transaction schema."""
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    frequency: str = Field(..., pattern="^(weekly|biweekly|monthly)$")
    start_date: date
    end_date: Optional[date] = None
    type: str = Field("expense", pattern="^(expense|income)$")
    
    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class RecurringTransactionCreate(RecurringTransactionBase):
    """Schema for creating a recurring transaction."""
    category_id: str
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    
    @model_validator(mode="after")
    def validate_day_fields(self):
        if self.frequency in ("weekly", "biweekly"):
            if self.day_of_week is None:
                raise ValueError("day_of_week required for weekly/biweekly frequency")
        elif self.frequency == "monthly":
            if self.day_of_month is None:
                raise ValueError("day_of_month required for monthly frequency")
        return self


class RecurringTransactionUpdate(BaseModel):
    """Schema for updating a recurring transaction."""
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = Field(None, max_length=500)
    category_id: Optional[str] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class RecurringTransactionResponse(RecurringTransactionBase):
    """Schema for recurring transaction response."""
    id: str
    user_id: str
    category_id: str
    day_of_week: Optional[int]
    day_of_month: Optional[int]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
