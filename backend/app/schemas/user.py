"""
User Pydantic schemas.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=2, max_length=50)


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str = Field(..., min_length=8, max_length=100)
    default_pay_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    pay_frequency: str = Field("biweekly", pattern="^(weekly|biweekly|monthly)$")
    next_pay_date: Optional[date] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    username: Optional[str] = Field(None, min_length=2, max_length=50)
    default_pay_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    pay_frequency: Optional[str] = Field(None, pattern="^(weekly|biweekly|monthly)$")
    next_pay_date: Optional[date] = None
    setup_completed: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user response (excludes password)."""
    id: str
    default_pay_amount: Optional[Decimal]
    pay_frequency: str
    next_pay_date: Optional[date]
    setup_completed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for token payload."""
    sub: str
    exp: datetime


class UserPasswordReset(BaseModel):
    """Schema for password reset."""
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., pattern=r'^\S+@\S+\.\S+$')
    new_password: str = Field(..., min_length=8)
