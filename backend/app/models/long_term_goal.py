"""
LongTermGoal model for savings targets.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Date, Numeric, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class LongTermGoal(Base):
    """LongTermGoal model for multi-cycle savings targets."""
    
    __tablename__ = "long_term_goals"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    target_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    # Status: active, completed, cancelled
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="long_term_goals")
    
    @property
    def progress_percentage(self) -> float:
        """Calculate progress towards the goal."""
        if self.target_amount == 0:
            return 100.0
        return float((self.current_amount / self.target_amount) * 100)
