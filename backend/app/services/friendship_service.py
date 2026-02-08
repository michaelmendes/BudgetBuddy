"""
Friendship service for managing user connections.
"""
from typing import Optional, List
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friendship import FriendshipCreate, FriendInfo
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException


class FriendshipService:
    """Service for friendship operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, friendship_id: str, user_id: str) -> Optional[Friendship]:
        """Get friendship by ID where user is involved."""
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
            .where(
                and_(
                    Friendship.id == friendship_id,
                    or_(
                        Friendship.requester_id == user_id,
                        Friendship.addressee_id == user_id,
                    ),
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def list_friends(self, user_id: str) -> List[FriendInfo]:
        """List all accepted friends for a user."""
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
            .where(
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
        
        friends = []
        for f in friendships:
            friend_user = f.addressee if f.requester_id == user_id else f.requester
            friends.append(FriendInfo(
                id=friend_user.id,
                display_name=friend_user.display_name,
                email=friend_user.email,
                friendship_id=f.id,
                status=f.status,
            ))
        return friends
    
    async def list_pending_requests(self, user_id: str) -> List[Friendship]:
        """List pending friend requests received by user."""
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.requester))
            .where(
                and_(
                    Friendship.addressee_id == user_id,
                    Friendship.status == "pending",
                )
            )
        )
        return list(result.scalars().all())
    
    async def list_sent_requests(self, user_id: str) -> List[Friendship]:
        """List pending friend requests sent by user."""
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.addressee))
            .where(
                and_(
                    Friendship.requester_id == user_id,
                    Friendship.status == "pending",
                )
            )
        )
        return list(result.scalars().all())
    
    async def send_request(self, user_id: str, data: FriendshipCreate) -> Friendship:
        """Send a friend request."""
        # Find addressee by email
        result = await self.db.execute(
            select(User).where(User.email == data.addressee_email)
        )
        addressee = result.scalar_one_or_none()
        if not addressee:
            raise NotFoundException(detail="User not found with that email")
        
        if addressee.id == user_id:
            raise BadRequestException(detail="Cannot send friend request to yourself")
        
        # Check for existing friendship
        result = await self.db.execute(
            select(Friendship).where(
                or_(
                    and_(
                        Friendship.requester_id == user_id,
                        Friendship.addressee_id == addressee.id,
                    ),
                    and_(
                        Friendship.requester_id == addressee.id,
                        Friendship.addressee_id == user_id,
                    ),
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            if existing.status == "blocked":
                raise BadRequestException(detail="Cannot send request to this user")
            raise ConflictException(detail="Friendship already exists")
        
        friendship = Friendship(
            requester_id=user_id,
            addressee_id=addressee.id,
            status="pending",
        )
        self.db.add(friendship)
        await self.db.flush()
        return friendship
    
    async def accept_request(self, friendship_id: str, user_id: str) -> Friendship:
        """Accept a friend request."""
        friendship = await self.get_by_id(friendship_id, user_id)
        if not friendship:
            raise NotFoundException(detail="Friendship not found")
        
        # Only addressee can accept
        if friendship.addressee_id != user_id:
            raise BadRequestException(detail="Only the recipient can accept a friend request")
        
        if friendship.status != "pending":
            raise BadRequestException(detail="Request is not pending")
        
        friendship.status = "accepted"
        await self.db.flush()
        return friendship
    
    async def reject_request(self, friendship_id: str, user_id: str) -> None:
        """Reject/delete a friend request."""
        friendship = await self.get_by_id(friendship_id, user_id)
        if not friendship:
            raise NotFoundException(detail="Friendship not found")
        
        await self.db.delete(friendship)
        await self.db.flush()
    
    async def block_user(self, friendship_id: str, user_id: str) -> Friendship:
        """Block a user."""
        friendship = await self.get_by_id(friendship_id, user_id)
        if not friendship:
            raise NotFoundException(detail="Friendship not found")
        
        friendship.status = "blocked"
        await self.db.flush()
        return friendship
    
    async def unfriend(self, friendship_id: str, user_id: str) -> None:
        """Remove a friend."""
        friendship = await self.get_by_id(friendship_id, user_id)
        if not friendship:
            raise NotFoundException(detail="Friendship not found")
        
        await self.db.delete(friendship)
        await self.db.flush()
    
    async def are_friends(self, user1_id: str, user2_id: str) -> bool:
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
