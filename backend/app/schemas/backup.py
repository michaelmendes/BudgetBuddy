"""Schemas for local database backups."""
from datetime import datetime
from pydantic import BaseModel, Field


class LocalBackupDefaultResponse(BaseModel):
    """Default destination for local backups."""
    default_directory: str


class LocalBackupRequest(BaseModel):
    """Request to copy the SQLite database to a local directory."""
    destination_directory: str = Field(..., min_length=1)
    file_name: str = Field(default="finance.db", min_length=1)


class LocalBackupResponse(BaseModel):
    """Result of a local backup operation."""
    source_path: str
    destination_path: str
    bytes_copied: int
    created_at: datetime
