"""Service for local database replication/backups."""
from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import BadRequestException


class BackupService:
    """Handles filesystem operations for local DB backups."""
    DEFAULT_BACKUP_SUBFOLDER = "BudgetBuddy"

    def get_default_backup_directory(self) -> Path:
        """Return default backup directory, preferring OneDrive if present."""
        home = Path.home()
        candidates: list[Path] = []

        env_candidates = [
            os.getenv("OneDrive"),
            os.getenv("OneDriveConsumer"),
            os.getenv("OneDriveCommercial"),
        ]
        candidates.extend(Path(value).expanduser() for value in env_candidates if value)

        candidates.extend(
            [
                home / "OneDrive",
                home / "OneDrive - Personal",
                home / "OneDrive - Business",
                home / "Library" / "CloudStorage" / "OneDrive-Personal",
                home / "Library" / "CloudStorage" / "OneDrive-Business",
            ]
        )

        for candidate in candidates:
            if candidate.exists() and candidate.is_dir():
                return candidate / self.DEFAULT_BACKUP_SUBFOLDER

        return home / self.DEFAULT_BACKUP_SUBFOLDER

    def backup_database(self, destination_directory: str, file_name: str) -> dict:
        """Copy the configured SQLite database file to destination path."""
        source_path = self._resolve_sqlite_path(settings.DATABASE_URL)
        if not source_path.exists() or not source_path.is_file():
            raise BadRequestException(detail=f"Database file not found: {source_path}")

        destination_dir = Path(destination_directory).expanduser()
        try:
            destination_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise BadRequestException(detail=f"Could not create destination directory: {exc}") from exc

        destination_path = self._next_available_destination_path(destination_dir, file_name)

        try:
            copied_path = Path(shutil.copy2(source_path, destination_path))
        except OSError as exc:
            raise BadRequestException(detail=f"Failed to copy database: {exc}") from exc

        return {
            "source_path": str(source_path),
            "destination_path": str(copied_path),
            "bytes_copied": copied_path.stat().st_size,
            "created_at": datetime.now(timezone.utc),
        }

    def _next_available_destination_path(self, destination_dir: Path, file_name: str) -> Path:
        """Return a non-conflicting destination path by appending numeric suffix."""
        candidate = destination_dir / file_name
        if not candidate.exists():
            return candidate

        stem = candidate.stem
        suffix = candidate.suffix
        counter = 1
        while True:
            numbered = destination_dir / f"{stem}-{counter}{suffix}"
            if not numbered.exists():
                return numbered
            counter += 1

    def _resolve_sqlite_path(self, database_url: str) -> Path:
        """Resolve sqlite path from SQLAlchemy URL string."""
        if not database_url.startswith("sqlite"):
            raise BadRequestException(detail="Local backup is only available for SQLite databases")

        if "///" not in database_url:
            raise BadRequestException(detail="Invalid SQLite database URL")

        raw_path = database_url.split("///", maxsplit=1)[1]
        path = Path(raw_path).expanduser()
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        return path
