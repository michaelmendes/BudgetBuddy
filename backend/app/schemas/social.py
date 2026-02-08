"""
Social feature schemas - exposes only percentages, never raw amounts.
"""
from datetime import date
from pydantic import BaseModel, Field
from typing import List, Optional


class SharedCategoryProgress(BaseModel):
    """
    Shared category progress for social features.
    NEVER exposes raw amounts - only percentages and completion status.
    """
    category_id: str
    category_name: str
    category_icon: Optional[str]
    category_color: Optional[str]
    
    # Only percentage-based metrics - no raw amounts
    completion_percentage: float = Field(..., ge=0, le=100)
    goal_type: str  # "percentage" or "fixed" (but never the actual values)
    is_on_track: bool
    is_over_budget: bool


class FriendProgress(BaseModel):
    """Friend's overall progress for social comparison."""
    friend_id: str
    friend_display_name: str
    
    # Pay cycle info (no amounts)
    pay_cycle_start: date
    pay_cycle_end: date
    pay_cycle_status: str
    
    # Only shared categories
    shared_categories: List[SharedCategoryProgress]
    
    # Aggregate metrics (percentages only)
    overall_budget_used_percentage: float
    categories_on_track: int
    categories_over_budget: int


class LeaderboardEntry(BaseModel):
    """Leaderboard entry for gamification."""
    rank: int
    user_id: str
    display_name: str
    
    # Percentage-based score
    budget_adherence_score: float  # 0-100, how well they stick to budgets
    goals_met_percentage: float  # What % of goals were met
    
    # Streak data
    current_streak: int  # Pay cycles with all goals met
