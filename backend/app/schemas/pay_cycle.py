"""
PayCycle Pydantic schemas.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator


class PayCycleBase(BaseModel):
    """Base pay cycle schema."""
    start_date: date
    end_date: date
    income_amount: Decimal = Field(..., ge=0, decimal_places=2)
    
    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class PayCycleCreate(PayCycleBase):
    """Schema for creating a pay cycle."""
    pass


class PayCycleUpdate(BaseModel):
    """Schema for updating a pay cycle."""
    income_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    end_date: Optional[date] = None


class PayCycleResponse(PayCycleBase):
    """Schema for pay cycle response."""
    id: str
    user_id: str
    status: str
    previous_cycle: Optional[str] = None
    created_at: datetime
    closed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PayCycleSummaryResponse(BaseModel):
    """Schema for pay cycle summary."""
    id: str
    pay_cycle_id: str
    total_income: Decimal
    total_expenses: Decimal
    total_savings: Decimal
    net_balance: Decimal
    category_breakdown: dict
    goal_completion: dict
    variances: dict
    rollover_generated: Decimal
    generated_at: datetime
    
    class Config:
        from_attributes = True


class PayCycleCategoryBalanceResponse(BaseModel):
    """Category balance snapshot for a specific pay cycle."""
    category_id: str
    category_name: str
    category_icon: Optional[str] = None
    starting_balance: Decimal
    spent: Decimal
    paycheck_allocated: Decimal
    closing_balance: Decimal


class PayCycleWithSummary(PayCycleResponse):
    """Pay cycle with optional summary included."""
    summary: Optional[PayCycleSummaryResponse] = None


class PayCycleCloseAllocation(BaseModel):
    """Manual rollover allocation for a category when closing a cycle."""
    category_id: str
    amount: Decimal = Field(..., decimal_places=2)


class PayCycleCloseRequest(BaseModel):
    """Payload for closing a cycle with actual income and manual rollover allocations."""
    actual_income_amount: Decimal = Field(..., ge=0, decimal_places=2)
    category_allocations: List[PayCycleCloseAllocation] = Field(default_factory=list)
