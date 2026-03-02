"""
User model for authentication and profile management.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Date, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.pay_cycle import PayCycle
    from app.models.category import Category
    from app.models.long_term_goal import LongTermGoal
    from app.models.friendship import Friendship
    from app.models.starting_amount import StartingAmount


class User(Base):
    """User model for authentication and profile."""
    
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    # Pay cycle settings
    default_pay_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    pay_frequency: Mapped[str] = mapped_column(
        String(20), default="biweekly"  # weekly, biweekly, monthly
    )
    next_pay_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    setup_completed: Mapped[bool] = mapped_column(default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    # Relationships
    pay_cycles: Mapped[List["PayCycle"]] = relationship(
        "PayCycle", back_populates="user", cascade="all, delete-orphan"
    )
    categories: Mapped[List["Category"]] = relationship(
        "Category", back_populates="user", cascade="all, delete-orphan"
    )
    long_term_goals: Mapped[List["LongTermGoal"]] = relationship(
        "LongTermGoal", back_populates="user", cascade="all, delete-orphan"
    )
    friendships_initiated: Mapped[List["Friendship"]] = relationship(
        "Friendship",
        foreign_keys="Friendship.requester_id",
        back_populates="requester",
        cascade="all, delete-orphan",
    )
    friendships_received: Mapped[List["Friendship"]] = relationship(
        "Friendship",
        foreign_keys="Friendship.addressee_id",
        back_populates="addressee",
        cascade="all, delete-orphan",
    )
    starting_amounts: Mapped[List["StartingAmount"]] = relationship(
        "StartingAmount", back_populates="user", cascade="all, delete-orphan"
    )
