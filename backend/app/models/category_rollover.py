"""
CategoryRollover model for cycle-specific carry-forward balances.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import String, Numeric, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.pay_cycle import PayCycle


class CategoryRollover(Base):
    """Carry-forward balance for a category in a specific pay cycle."""

    __tablename__ = "category_rollovers"
    __table_args__ = (
        UniqueConstraint("category_id", "pay_cycle_id", name="uq_category_pay_cycle_rollover"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pay_cycle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pay_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rollover_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    category: Mapped["Category"] = relationship("Category", back_populates="rollovers")
    pay_cycle: Mapped["PayCycle"] = relationship("PayCycle", back_populates="category_rollovers")
