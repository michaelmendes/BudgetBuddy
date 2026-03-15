"""
Category Pydantic schemas.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=50)
    is_shared: bool = False


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    sort_order: int = 0
    starting_amount: Optional[Decimal] = Field(None, decimal_places=2)
    allocation_type: Optional[str] = Field(None, pattern="^(percentage|fixed)$")
    allocation_value: Optional[Decimal] = Field(None, ge=0, decimal_places=2)

    @model_validator(mode="after")
    def validate_allocation(self):
        has_type = self.allocation_type is not None
        has_value = self.allocation_value is not None

        if has_type or has_value:
            if not (has_type and has_value):
                raise ValueError("allocation_type and allocation_value must be provided together")
            if self.allocation_type == "percentage" and self.allocation_value > 100:
                raise ValueError("Percentage allocation cannot exceed 100")
        return self


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=50)
    is_shared: Optional[bool] = None
    is_archived: Optional[bool] = None
    sort_order: Optional[int] = None
    allocation_type: Optional[str] = Field(None, pattern="^(percentage|fixed)$")
    allocation_value: Optional[Decimal] = Field(None, ge=0, decimal_places=2)

    @model_validator(mode="after")
    def validate_allocation(self):
        has_type = self.allocation_type is not None
        has_value = self.allocation_value is not None

        if has_type or has_value:
            if not (has_type and has_value):
                raise ValueError("allocation_type and allocation_value must be provided together")
            if self.allocation_type == "percentage" and self.allocation_value > 100:
                raise ValueError("Percentage allocation cannot exceed 100")
        return self


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    id: str
    user_id: str
    is_archived: bool
    sort_order: int
    created_at: datetime
    
    class Config:
        from_attributes = True
