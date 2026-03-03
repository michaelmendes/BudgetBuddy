"""
Dashboard schemas.
"""
from typing import List, Optional
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.pay_cycle import PayCycleResponse, PayCycleWithSummary
from app.schemas.social import FriendProgress


class DashboardStats(BaseModel):
    """Aggregate stats for the active pay cycle."""

    total_budget: Decimal
    total_spent: Decimal
    remaining: Decimal
    extra_income: Decimal
    budget_used_percentage: float = Field(..., ge=0)
    days_remaining: int = Field(..., ge=0)
    total_days: int = Field(..., ge=1)
    day_progress_percentage: float = Field(..., ge=0, le=100)


class DashboardNudge(BaseModel):
    """A lightweight dashboard nudge."""

    id: str
    type: str = Field(..., pattern="^(warning|celebration|tip)$")
    message: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    percentage: Optional[float] = None


class DashboardCategoryProgress(BaseModel):
    """Progress for a category in the active pay cycle."""

    category_id: str
    category_name: str
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    goal_type: Optional[str] = None
    goal_value: Optional[Decimal] = None
    budget_amount: Decimal
    rollover_amount: Decimal
    effective_budget: Decimal
    spent: Decimal
    remaining: Decimal
    completion_percentage: float = Field(..., ge=0)
    is_over_budget: bool


class DashboardResponse(BaseModel):
    """Dashboard payload for the main application dashboard."""

    active_pay_cycle: Optional[PayCycleResponse] = None
    stats: Optional[DashboardStats] = None
    nudges: List[DashboardNudge] = Field(default_factory=list)
    category_progress: List[DashboardCategoryProgress] = Field(default_factory=list)
    friend_updates: List[FriendProgress] = Field(default_factory=list)
    recent_cycles: List[PayCycleWithSummary] = Field(default_factory=list)
