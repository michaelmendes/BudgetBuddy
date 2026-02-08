"""
CategoryGoal model for budget targets per category per pay cycle.
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
    from app.models.pay_cycle import PayCycle


class CategoryGoal(Base):
    """CategoryGoal model linking categories to pay cycles with budget targets."""
    
    __tablename__ = "category_goals"
    __table_args__ = (
        UniqueConstraint("category_id", "pay_cycle_id", name="uq_category_pay_cycle"),
    )
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pay_cycle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pay_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Goal type: percentage (of income) or fixed (absolute amount)
    goal_type: Mapped[str] = mapped_column(String(20), default="fixed")
    
    # Goal value: percentage (0-100) or fixed amount
    goal_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    
    # Rolled over from previous cycle
    rollover_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    category: Mapped["Category"] = relationship("Category", back_populates="goals")
    pay_cycle: Mapped["PayCycle"] = relationship("PayCycle", back_populates="category_goals")
    
    @property
    def effective_budget(self) -> Decimal:
        """Calculate the effective budget including rollover."""
        if self.goal_type == "percentage":
            # Percentage calculation requires pay cycle income
            base = (self.goal_value / 100) * self.pay_cycle.income_amount
        else:
            base = self.goal_value
        return base + self.rollover_balance
