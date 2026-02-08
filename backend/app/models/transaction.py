"""
Transaction model for individual financial transactions.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Date, Numeric, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.pay_cycle import PayCycle
    from app.models.category import Category
    from app.models.recurring_transaction import RecurringTransaction


class Transaction(Base):
    """Transaction model for individual income/expense entries."""
    
    __tablename__ = "transactions"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pay_cycle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pay_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Optional link to recurring transaction template
    recurring_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("recurring_transactions.id", ondelete="SET NULL"), nullable=True
    )
    
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    
    # Type: expense or income
    type: Mapped[str] = mapped_column(String(20), default="expense")
    
    # Flag if this was auto-generated from recurring transaction
    is_recurring_instance: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    pay_cycle: Mapped["PayCycle"] = relationship("PayCycle", back_populates="transactions")
    category: Mapped["Category"] = relationship("Category", back_populates="transactions")
    recurring_transaction: Mapped[Optional["RecurringTransaction"]] = relationship(
        "RecurringTransaction", back_populates="instances"
    )
