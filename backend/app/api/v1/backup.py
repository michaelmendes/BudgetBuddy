"""Local backup endpoints."""
from fastapi import APIRouter

from app.api.v1.deps import CurrentUser
from app.schemas.backup import (
    LocalBackupDefaultResponse,
    LocalBackupRequest,
    LocalBackupResponse,
)
from app.services.backup_service import BackupService

router = APIRouter()


@router.get("/default-destination", response_model=LocalBackupDefaultResponse)
async def get_default_destination(current_user: CurrentUser):
    """Return default local backup destination for current machine."""
    _ = current_user
    service = BackupService()
    return LocalBackupDefaultResponse(default_directory=str(service.get_default_backup_directory()))


@router.post("/local", response_model=LocalBackupResponse)
async def create_local_backup(data: LocalBackupRequest, current_user: CurrentUser):
    """Replicate finance.db to a local destination selected by user."""
    _ = current_user
    service = BackupService()
    result = service.backup_database(
        destination_directory=data.destination_directory,
        file_name=data.file_name,
    )
    return LocalBackupResponse(**result)
