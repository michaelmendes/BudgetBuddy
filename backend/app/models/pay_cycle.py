"""
PayCycle model representing a user's pay period.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Date, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.transaction import Transaction
    from app.models.category_balance import CategoryBalance
    from app.models.pay_cycle_summary import PayCycleSummary


class PayCycle(Base):
    """PayCycle model representing a budget period."""
    
    __tablename__ = "pay_cycles"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    income_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    
    # Status: active, closed, upcoming
    status: Mapped[str] = mapped_column(String(20), default="upcoming", index=True)
    
    # Previous cycle in user's timeline.
    previous_cycle: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("pay_cycles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="pay_cycles")
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction", back_populates="pay_cycle", cascade="all, delete-orphan"
    )
    category_balances: Mapped[List["CategoryBalance"]] = relationship(
        "CategoryBalance", back_populates="pay_cycle", cascade="all, delete-orphan"
    )
    summary: Mapped[Optional["PayCycleSummary"]] = relationship(
        "PayCycleSummary", back_populates="pay_cycle", uselist=False, cascade="all, delete-orphan"
    )
