from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_router
from app.api import documents as documents_router
from app.core.config import get_settings
from app.core.database import engine, init_db
from app.models.user import User
from app.auth.security import get_password_hash
from app.services.ingest import ShareWatcherManager
from sqlmodel import Session

settings = get_settings()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router)
    app.include_router(documents_router.router)

    @app.on_event("startup")
    async def startup_event() -> None:
        init_db()
        _ensure_admin_user()
        watcher_manager = ShareWatcherManager(lambda: Session(engine))
        documents_router.init_watcher_manager(watcher_manager)

        async def refresh_loop() -> None:
            while True:
                await watcher_manager.refresh()
                await asyncio.sleep(max(5, settings.watch_interval_seconds))

        app.state.watcher_manager = watcher_manager
        app.state.watcher_task = asyncio.create_task(refresh_loop())

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        task: Optional[asyncio.Task] = getattr(app.state, "watcher_task", None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        manager: Optional[ShareWatcherManager] = getattr(app.state, "watcher_manager", None)
        if manager:
            await manager.stop()

    return app


def _ensure_admin_user() -> None:
    from sqlmodel import Session, select

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == settings.admin_default_username)).first()
        if not user:
            user = User(
                username=settings.admin_default_username,
                hashed_password=get_password_hash(settings.admin_default_password),
                is_active=True,
            )
            session.add(user)
            session.commit()
            logger.info("Created default admin user '%s'", settings.admin_default_username)


app = create_app()
