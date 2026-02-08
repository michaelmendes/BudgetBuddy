"""
Category Pydantic schemas.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    is_shared: bool = False


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    is_shared: Optional[bool] = None
    is_archived: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    id: str
    user_id: str
    is_archived: bool
    sort_order: int
    created_at: datetime
    
    class Config:
        from_attributes = True
