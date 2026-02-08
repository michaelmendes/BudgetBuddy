"""
LongTermGoal Pydantic schemas.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class LongTermGoalBase(BaseModel):
    """Base long-term goal schema."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    target_amount: Decimal = Field(..., gt=0, decimal_places=2)
    target_date: Optional[date] = None


class LongTermGoalCreate(LongTermGoalBase):
    """Schema for creating a long-term goal."""
    current_amount: Decimal = Field(Decimal("0.00"), ge=0, decimal_places=2)


class LongTermGoalUpdate(BaseModel):
    """Schema for updating a long-term goal."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    target_amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    current_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    target_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(active|completed|cancelled)$")


class LongTermGoalResponse(LongTermGoalBase):
    """Schema for long-term goal response."""
    id: str
    user_id: str
    current_amount: Decimal
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Computed
    progress_percentage: float
    
    class Config:
        from_attributes = True


class LongTermGoalContribution(BaseModel):
    """Schema for adding contribution to a goal."""
    amount: Decimal = Field(..., gt=0, decimal_places=2)
