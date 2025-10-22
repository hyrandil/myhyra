from __future__ import annotations

import hashlib
import mimetypes
import shutil
from pathlib import Path
from typing import Optional

from app.core.config import get_settings

settings = get_settings()


class StorageManager:
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = base_dir or settings.storage_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, source: Path, filename: Optional[str] = None) -> tuple[Path, str, int, str]:
        filename = filename or source.name
        destination = self.base_dir / filename
        counter = 1
        while destination.exists():
            destination = self.base_dir / f"{destination.stem}_{counter}{destination.suffix}"
            counter += 1
        shutil.copy2(source, destination)
        checksum = self._checksum(destination)
        mime_type, _ = mimetypes.guess_type(str(destination))
        size = destination.stat().st_size
        return destination, mime_type or "application/octet-stream", size, checksum

    def delete(self, path: Path) -> None:
        if path.exists():
            path.unlink()

    def _checksum(self, path: Path) -> str:
        sha256 = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()


storage_manager = StorageManager()
