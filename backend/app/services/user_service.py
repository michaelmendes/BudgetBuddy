"""
User service for authentication and profile management.
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password
from app.core.exceptions import NotFoundException, ConflictException, UnauthorizedException


class UserService:
    """Service for user-related operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        # Check if email already exists
        existing = await self.get_by_email(user_data.email)
        if existing:
            raise ConflictException(detail="Email already registered")
        
        user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            display_name=user_data.display_name,
            default_pay_amount=user_data.default_pay_amount,
            pay_frequency=user_data.pay_frequency,
            next_pay_date=user_data.next_pay_date,
        )
        self.db.add(user)
        await self.db.flush()
        return user
    
    async def update(self, user_id: str, user_data: UserUpdate) -> User:
        """Update user profile."""
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await self.db.flush()
        return user
    
    async def authenticate(self, email: str, password: str) -> User:
        """Authenticate user with email and password."""
        user = await self.get_by_email(email)
        if not user:
            raise UnauthorizedException(detail="Invalid email or password")
        
        if not verify_password(password, user.password_hash):
            raise UnauthorizedException(detail="Invalid email or password")
        
        return user
    
    async def delete(self, user_id: str) -> None:
        """Delete a user."""
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        
        await self.db.delete(user)
        await self.db.flush()
