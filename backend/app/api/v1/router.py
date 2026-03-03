"""
API router aggregation.
"""
from fastapi import APIRouter

from app.api.v1 import (
    auth,
    users,
    dashboard,
    pay_cycles,
    categories,
    transactions,
    recurring,
    goals,
    friends,
    social,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(pay_cycles.router, prefix="/pay-cycles", tags=["Pay Cycles"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(recurring.router, prefix="/recurring", tags=["Recurring Transactions"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(friends.router, prefix="/friends", tags=["Friendships"])
api_router.include_router(social.router, prefix="/social", tags=["Social"])
