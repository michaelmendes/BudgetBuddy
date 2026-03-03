"""
CategoryGoal model for default budget targets per category.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.database import Base

if TYPE_CHECKING:
    from app.models.category import Category


class CategoryGoal(Base):
    """CategoryGoal model storing per-category targets independent of pay cycles."""
    
    __tablename__ = "category_goals"
    __table_args__ = (
        UniqueConstraint("category_id", name="uq_category_goal_category"),
    )
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Goal type: percentage (of income) or fixed (absolute amount)
    goal_type: Mapped[str] = mapped_column(String(20), default="fixed")
    
    # Goal value: percentage (0-100) or fixed amount
    goal_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    category: Mapped["Category"] = relationship("Category", back_populates="goals")
