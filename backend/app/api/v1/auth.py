"""
Authentication endpoints.
"""
from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserPasswordReset
from app.services.user_service import UserService
from app.core.security import create_access_token
from app.core.config import settings

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    service = UserService(db)
    user = await service.create(user_data)
    return user


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Login and get access token."""
    service = UserService(db)
    user = await service.authenticate(credentials.email, credentials.password)
    
    access_token = create_access_token(
        user_id=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return Token(access_token=access_token)


@router.post("/reset-password")
async def reset_password(
    payload: UserPasswordReset,
    db: AsyncSession = Depends(get_db),
):
    user_service = UserService(db)
    await user_service.reset_password(
        username=payload.username,
        email=payload.email,
        new_password=payload.new_password,
    )
    return {"message": "Password reset successfully"}