"""
Friendship Pydantic schemas.
"""
from datetime import datetime
from pydantic import BaseModel, Field


class FriendshipCreate(BaseModel):
    """Schema for creating a friendship request."""
    addressee_email: str = Field(..., description="Email of the user to befriend")


class FriendshipUpdate(BaseModel):
    """Schema for updating friendship status."""
    status: str = Field(..., pattern="^(accepted|blocked)$")


class FriendshipResponse(BaseModel):
    """Schema for friendship response."""
    id: str
    requester_id: str
    addressee_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class FriendInfo(BaseModel):
    """Schema for friend information."""
    id: str
    display_name: str
    email: str
    friendship_id: str
    status: str
