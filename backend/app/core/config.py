from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    app_name: str = "MyHyra DMS"
    secret_key: str = "change-this-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    database_url: str = "sqlite:///./data/app.db"
    storage_dir: Path = Path("./data/raw")
    import_shares_root: Path = Path("./data/import_shares")
    watch_interval_seconds: int = 5
    enable_ocr: bool = True
    allow_user_registration: bool = True
    admin_default_username: str = "admin"
    admin_default_password: str = "admin123"
    cors_origins: List[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("storage_dir", "import_shares_root", pre=True)
    def _expand_path(cls, value: str | Path) -> Path:
        path = Path(value)
        return path.expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    settings.import_shares_root.mkdir(parents=True, exist_ok=True)
    os.makedirs(Path(settings.database_url.replace("sqlite:///", "")).parent, exist_ok=True)
    return settings
