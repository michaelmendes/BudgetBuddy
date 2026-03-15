"""
User service for authentication and profile management.
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.category import Category
from app.models.starting_amount import StartingAmount
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.starting_amount import StartingAmountSaveRequest
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
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()
    
    
    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        # Check if email or username already exists
        existing_email = await self.get_by_email(user_data.email)
        if existing_email:
            raise ConflictException(detail="Email already registered")
        
        existing_username = await self.get_by_username(user_data.username)
        if existing_username:
            raise ConflictException(detail="Username already taken")
        
        user = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            display_name=user_data.display_name,
            default_pay_amount=user_data.default_pay_amount,
            pay_frequency=user_data.pay_frequency,
            next_pay_date=user_data.next_pay_date,
        )
        self.db.add(user)
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictException(detail="Username or email already exists")
        return user
    
    
    async def update(self, user_id: str, user_data: UserUpdate) -> User:
        """Update user profile."""
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException(detail="User not found")

        update_data = user_data.model_dump(exclude_unset=True)
        if "username" in update_data and update_data["username"] != user.username:
            existing_username = await self.get_by_username(update_data["username"])
            if existing_username and existing_username.id != user.id:
                raise ConflictException(detail="Username already taken")

        for field, value in update_data.items():
            setattr(user, field, value)

        await self.db.flush()
        return user

    async def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        """Change password for an authenticated user."""
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException(detail="User not found")

        if not verify_password(current_password, user.password_hash):
            raise UnauthorizedException(detail="Current password is incorrect")

        user.password_hash = get_password_hash(new_password)
        await self.db.flush()
    
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


    async def reset_password(self, username: str, email: str, new_password: str) -> None:
        """Reset a user's password."""
        # Find the user by username and email
        result = await self.db.execute(
            select(User).where(User.username == username, User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise NotFoundException(detail="User not found with the provided username and email")

        # Update the user's password hash
        user.password_hash = get_password_hash(new_password)
        await self.db.flush()

    async def list_starting_amounts(self, user_id: str) -> list[StartingAmount]:
        result = await self.db.execute(
            select(StartingAmount).where(StartingAmount.user_id == user_id)
        )
        return list(result.scalars().all())

    async def save_starting_amounts(self, user_id: str, payload: StartingAmountSaveRequest) -> list[StartingAmount]:
        category_ids = [item.category_id for item in payload.items]
        if category_ids:
            category_result = await self.db.execute(
                select(Category.id).where(Category.user_id == user_id, Category.id.in_(category_ids))
            )
            valid_ids = {row.id for row in category_result.all()}
            invalid_ids = [category_id for category_id in category_ids if category_id not in valid_ids]
            if invalid_ids:
                raise NotFoundException(detail="One or more categories not found")

        existing_result = await self.db.execute(
            select(StartingAmount).where(StartingAmount.user_id == user_id)
        )
        existing_by_category = {row.category_id: row for row in existing_result.scalars().all()}
        payload_by_category = {item.category_id: item.amount for item in payload.items}

        # Upsert entries in payload
        for category_id, amount in payload_by_category.items():
            existing = existing_by_category.get(category_id)
            if existing:
                existing.amount = amount
            else:
                self.db.add(
                    StartingAmount(
                        user_id=user_id,
                        category_id=category_id,
                        amount=amount,
                    )
                )

        # Remove entries not included in payload to keep source of truth in the wizard.
        for category_id, row in existing_by_category.items():
            if category_id not in payload_by_category:
                await self.db.delete(row)

        await self.db.flush()
        return await self.list_starting_amounts(user_id)

    async def complete_setup(self, user_id: str) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        user.setup_completed = True
        await self.db.flush()
        await self.db.refresh(user)
        return user
