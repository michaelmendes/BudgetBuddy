"""
Category model for organizing transactions.
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.transaction import Transaction
    from app.models.category_goal import CategoryGoal
    from app.models.category_rollover import CategoryRollover
    from app.models.recurring_transaction import RecurringTransaction
    from app.models.starting_amount import StartingAmount


class Category(Base):
    """Category model for organizing transactions."""
    
    __tablename__ = "categories"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Social visibility - if True, friends can see percentage progress
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="categories")
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction", back_populates="category", cascade="all, delete-orphan"
    )
    goals: Mapped[List["CategoryGoal"]] = relationship(
        "CategoryGoal", back_populates="category", cascade="all, delete-orphan"
    )
    rollovers: Mapped[List["CategoryRollover"]] = relationship(
        "CategoryRollover", back_populates="category", cascade="all, delete-orphan"
    )
    recurring_transactions: Mapped[List["RecurringTransaction"]] = relationship(
        "RecurringTransaction", back_populates="category", cascade="all, delete-orphan"
    )
    starting_amounts: Mapped[List["StartingAmount"]] = relationship(
        "StartingAmount", back_populates="category", cascade="all, delete-orphan"
    )
