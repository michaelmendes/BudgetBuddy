"""
CategoryGoal Pydantic schemas.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class CategoryGoalBase(BaseModel):
    """Base category goal schema."""
    category_id: str
    goal_type: str = Field("fixed", pattern="^(percentage|fixed)$")
    goal_value: Decimal = Field(..., ge=0, decimal_places=2)
    
    @field_validator("goal_value")
    @classmethod
    def validate_goal_value(cls, v: Decimal, info) -> Decimal:
        goal_type = info.data.get("goal_type", "fixed")
        if goal_type == "percentage" and v > 100:
            raise ValueError("Percentage goal cannot exceed 100")
        return v


class CategoryGoalCreate(CategoryGoalBase):
    """Schema for creating a category goal."""
    pay_cycle_id: str


class CategoryGoalUpdate(BaseModel):
    """Schema for updating a category goal."""
    goal_type: Optional[str] = Field(None, pattern="^(percentage|fixed)$")
    goal_value: Optional[Decimal] = Field(None, ge=0, decimal_places=2)


class CategoryGoalResponse(CategoryGoalBase):
    """Schema for category goal response."""
    id: str
    pay_cycle_id: str
    rollover_balance: Decimal
    created_at: datetime
    
    # Computed fields
    effective_budget: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class CategoryGoalProgress(CategoryGoalResponse):
    """Category goal with progress information."""
    spent: Decimal = Decimal("0.00")
    remaining: Decimal = Decimal("0.00")
    completion_percentage: float = 0.0
    is_over_budget: bool = False
