"""
RecurringTransaction model for automated transaction templates.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Date, Numeric, Boolean, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.category import Category
    from app.models.transaction import Transaction


class RecurringTransaction(Base):
    """RecurringTransaction model for automated transaction generation."""
    
    __tablename__ = "recurring_transactions"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Frequency: weekly, biweekly, monthly
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # Date range for the recurring transaction
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    # For weekly/biweekly: day of week (0=Monday, 6=Sunday)
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # For monthly: day of month (1-31)
    day_of_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Type: expense or income
    type: Mapped[str] = mapped_column(String(20), default="expense")
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    category: Mapped["Category"] = relationship("Category", back_populates="recurring_transactions")
    instances: Mapped[List["Transaction"]] = relationship(
        "Transaction", back_populates="recurring_transaction"
    )
