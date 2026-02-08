"""
PayCycleSummary model for aggregated cycle statistics.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import String, Numeric, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.pay_cycle import PayCycle


class PayCycleSummary(Base):
    """PayCycleSummary model for aggregated pay cycle statistics."""
    
    __tablename__ = "pay_cycle_summaries"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    pay_cycle_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("pay_cycles.id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True, 
        index=True
    )
    
    # Totals
    total_income: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_expenses: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_savings: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    
    # JSON fields for detailed breakdowns
    # category_breakdown: {category_id: {name, spent, budget, percentage}}
    category_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # goal_completion: {category_id: {goal_type, goal_value, spent, completion_percentage, met}}
    goal_completion: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # variances: {category_id: {planned, actual, variance, variance_percentage}}
    variances: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Total rollover generated for next cycle
    rollover_generated: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    
    # Timestamps
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # Relationships
    pay_cycle: Mapped["PayCycle"] = relationship("PayCycle", back_populates="summary")
