"""
API dependencies for dependency injection.
"""
from typing import Annotated
from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException
from app.models.user import User
from app.services.user_service import UserService


async def get_current_user(
    authorization: Annotated[str, Header()],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from the JWT token."""
    if not authorization.startswith("Bearer "):
        raise UnauthorizedException(detail="Invalid authorization header")
    
    token = authorization[7:]  # Remove "Bearer " prefix
    token_data = decode_access_token(token)
    
    if not token_data:
        raise UnauthorizedException(detail="Invalid or expired token")
    
    user_service = UserService(db)
    user = await user_service.get_by_id(token_data.user_id)
    
    if not user:
        raise UnauthorizedException(detail="User not found")
    
    return user


# Type aliases for cleaner dependency injection
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
