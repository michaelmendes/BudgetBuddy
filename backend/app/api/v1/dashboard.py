"""
Dashboard endpoints.
"""
from fastapi import APIRouter

from app.api.v1.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: CurrentUser,
    db: DbSession,
):
    """Get dashboard data for the current user."""
    service = DashboardService(db)
    return await service.get_dashboard(current_user.id)
