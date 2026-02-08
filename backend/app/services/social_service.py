"""
Social service for friend progress visibility.
IMPORTANT: Never exposes raw monetary amounts - only percentages and completion status.
"""
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.friendship import Friendship
from app.models.pay_cycle import PayCycle
from app.models.category import Category
from app.models.category_goal import CategoryGoal
from app.models.transaction import Transaction
from app.schemas.social import FriendProgress, SharedCategoryProgress, LeaderboardEntry
from app.core.exceptions import ForbiddenException, NotFoundException


class SocialService:
    """
    Service for social features with privacy protection.
    NEVER exposes raw monetary amounts - only percentages.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_friend_progress(
        self, 
        user_id: str, 
        friend_id: str
    ) -> Optional[FriendProgress]:
        """
        Get a friend's progress on their shared categories.
        Only returns percentage-based metrics, never raw amounts.
        """
        # Verify friendship
        is_friend = await self._are_friends(user_id, friend_id)
        if not is_friend:
            raise ForbiddenException(detail="Not friends with this user")
        
        # Get friend's active pay cycle
        result = await self.db.execute(
            select(PayCycle).where(
                and_(PayCycle.user_id == friend_id, PayCycle.status == "active")
            )
        )
        pay_cycle = result.scalar_one_or_none()
        if not pay_cycle:
            return None
        
        # Get friend's info
        result = await self.db.execute(select(User).where(User.id == friend_id))
        friend = result.scalar_one()
        
        # Get shared categories only
        result = await self.db.execute(
            select(Category).where(
                and_(
                    Category.user_id == friend_id,
                    Category.is_shared == True,
                    Category.is_archived == False,
                )
            )
        )
        shared_categories = list(result.scalars().all())
        
        if not shared_categories:
            return FriendProgress(
                friend_id=friend_id,
                friend_display_name=friend.display_name,
                pay_cycle_start=pay_cycle.start_date,
                pay_cycle_end=pay_cycle.end_date,
                pay_cycle_status=pay_cycle.status,
                shared_categories=[],
                overall_budget_used_percentage=0.0,
                categories_on_track=0,
                categories_over_budget=0,
            )
        
        # Get goals for shared categories
        shared_category_ids = [c.id for c in shared_categories]
        result = await self.db.execute(
            select(CategoryGoal).where(
                and_(
                    CategoryGoal.pay_cycle_id == pay_cycle.id,
                    CategoryGoal.category_id.in_(shared_category_ids),
                )
            )
        )
        goals = {g.category_id: g for g in result.scalars().all()}
        
        # Get spending for shared categories
        result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.pay_cycle_id == pay_cycle.id,
                    Transaction.category_id.in_(shared_category_ids),
                    Transaction.type == "expense",
                )
            )
        )
        transactions = list(result.scalars().all())
        
        spending_by_category = {}
        for t in transactions:
            spending_by_category[t.category_id] = (
                spending_by_category.get(t.category_id, Decimal("0.00")) + t.amount
            )
        
        # Calculate progress (percentages only!)
        shared_progress = []
        total_budget = Decimal("0.00")
        total_spent = Decimal("0.00")
        on_track_count = 0
        over_budget_count = 0
        
        for category in shared_categories:
            goal = goals.get(category.id)
            spent = spending_by_category.get(category.id, Decimal("0.00"))
            
            if goal:
                if goal.goal_type == "percentage":
                    budget = (goal.goal_value / 100) * pay_cycle.income_amount
                else:
                    budget = goal.goal_value
                effective_budget = budget + goal.rollover_balance
            else:
                effective_budget = Decimal("0.00")
            
            total_budget += effective_budget
            total_spent += spent
            
            if effective_budget > 0:
                completion_pct = min(100.0, float((spent / effective_budget) * 100))
            else:
                completion_pct = 0.0
            
            is_over = spent > effective_budget
            is_on_track = not is_over and completion_pct <= 90  # Consider 90%+ as "close"
            
            if is_over:
                over_budget_count += 1
            elif is_on_track:
                on_track_count += 1
            
            shared_progress.append(SharedCategoryProgress(
                category_id=category.id,
                category_name=category.name,
                category_icon=category.icon,
                category_color=category.color,
                completion_percentage=round(completion_pct, 1),
                goal_type=goal.goal_type if goal else "fixed",
                is_on_track=is_on_track,
                is_over_budget=is_over,
            ))
        
        overall_pct = float((total_spent / total_budget) * 100) if total_budget > 0 else 0.0
        
        return FriendProgress(
            friend_id=friend_id,
            friend_display_name=friend.display_name,
            pay_cycle_start=pay_cycle.start_date,
            pay_cycle_end=pay_cycle.end_date,
            pay_cycle_status=pay_cycle.status,
            shared_categories=shared_progress,
            overall_budget_used_percentage=round(overall_pct, 1),
            categories_on_track=on_track_count,
            categories_over_budget=over_budget_count,
        )
    
    async def get_all_friends_progress(self, user_id: str) -> List[FriendProgress]:
        """Get progress for all friends."""
        # Get friend IDs
        result = await self.db.execute(
            select(Friendship).where(
                and_(
                    or_(
                        Friendship.requester_id == user_id,
                        Friendship.addressee_id == user_id,
                    ),
                    Friendship.status == "accepted",
                )
            )
        )
        friendships = list(result.scalars().all())
        
        friend_ids = []
        for f in friendships:
            friend_id = f.addressee_id if f.requester_id == user_id else f.requester_id
            friend_ids.append(friend_id)
        
        # Get progress for each friend
        progress_list = []
        for friend_id in friend_ids:
            progress = await self.get_friend_progress(user_id, friend_id)
            if progress:
                progress_list.append(progress)
        
        return progress_list
    
    async def get_leaderboard(self, user_id: str) -> List[LeaderboardEntry]:
        """
        Get a leaderboard of friends based on budget adherence.
        Only uses percentage-based metrics.
        """
        # Get all friends' progress
        all_progress = await self.get_all_friends_progress(user_id)
        
        # Calculate scores
        entries = []
        for progress in all_progress:
            if not progress.shared_categories:
                continue
            
            # Budget adherence: how well they stick to budgets (inverse of overspend)
            adherence = max(0, 100 - max(0, progress.overall_budget_used_percentage - 100))
            
            # Goals met percentage
            total_cats = len(progress.shared_categories)
            met_cats = progress.categories_on_track
            goals_met_pct = (met_cats / total_cats * 100) if total_cats > 0 else 0
            
            entries.append(LeaderboardEntry(
                rank=0,  # Will be set after sorting
                user_id=progress.friend_id,
                display_name=progress.friend_display_name,
                budget_adherence_score=round(adherence, 1),
                goals_met_percentage=round(goals_met_pct, 1),
                current_streak=0,  # Would need historical data
            ))
        
        # Sort by adherence score
        entries.sort(key=lambda x: x.budget_adherence_score, reverse=True)
        
        # Assign ranks
        for i, entry in enumerate(entries):
            entry.rank = i + 1
        
        return entries
    
    async def _are_friends(self, user1_id: str, user2_id: str) -> bool:
        """Check if two users are friends."""
        result = await self.db.execute(
            select(Friendship).where(
                and_(
                    or_(
                        and_(
                            Friendship.requester_id == user1_id,
                            Friendship.addressee_id == user2_id,
                        ),
                        and_(
                            Friendship.requester_id == user2_id,
                            Friendship.addressee_id == user1_id,
                        ),
                    ),
                    Friendship.status == "accepted",
                )
            )
        )
        return result.scalar_one_or_none() is not None
