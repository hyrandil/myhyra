from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path
from typing import Callable, Dict, Iterable, Optional

from tempfile import NamedTemporaryFile

from fastapi import UploadFile
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.database import session_scope
from app.models.document import Document, ImportShare, Tag
from app.services import ocr
from app.services.storage import storage_manager

logger = logging.getLogger(__name__)
settings = get_settings()

SessionFactory = Callable[[], Session]


class ShareWatcherManager:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory
        self._tasks: Dict[int, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def refresh(self) -> None:
        async with self._lock:
            shares = self._load_active_shares()
            share_ids = {share.id for share in shares if share.id is not None}
            for share_id, task in list(self._tasks.items()):
                if task.done():
                    self._tasks.pop(share_id, None)
            # Stop watchers that are no longer active
            for share_id, task in list(self._tasks.items()):
                if share_id not in share_ids:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:  # pragma: no cover
                        pass
                    self._tasks.pop(share_id, None)
            # Start watchers for new shares
            for share in shares:
                if share.id is None or share.id in self._tasks:
                    continue
                task = asyncio.create_task(self._watch_share(share))
                self._tasks[share.id] = task

    async def stop(self) -> None:
        async with self._lock:
            for task in self._tasks.values():
                task.cancel()
            for task in self._tasks.values():
                try:
                    await task
                except asyncio.CancelledError:  # pragma: no cover
                    pass
            self._tasks.clear()

    def _load_active_shares(self) -> Iterable[ImportShare]:
        with self._session_factory() as session:
            shares = session.exec(select(ImportShare).where(ImportShare.active == True)).all()  # noqa: E712
            for share in shares:
                session.expunge(share)
        return shares

    async def _watch_share(self, share: ImportShare) -> None:
        from watchfiles import awatch

        path = Path(share.path)
        while not path.exists():
            if share.managed:
                path.mkdir(parents=True, exist_ok=True)
                break
            logger.warning("Share path does not exist: %s", path)
            await asyncio.sleep(max(5, settings.watch_interval_seconds))
        logger.info("Watching share %s at %s", share.name, path)
        try:
            async for changes in awatch(path, recursive=share.recursive):
                for _, changed_path in changes:
                    file_path = Path(changed_path)
                    if file_path.is_file():
                        await ingest_file(file_path, share)
        except asyncio.CancelledError:  # pragma: no cover
            logger.info("Share watcher cancelled: %s", share.name)
            raise
        except Exception as exc:  # pragma: no cover - we log errors but keep service alive
            logger.exception("Watcher for %s crashed: %s", share.name, exc)


async def ingest_upload(upload_file: UploadFile, session: Session, tags: Optional[list[str]] = None) -> Document:
    suffix = Path(upload_file.filename or "upload").suffix
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(upload_file.file, tmp)
        temp_path = Path(tmp.name)
    document = await ingest_file(temp_path, None, session=session, tags=tags, delete_source=True)
    return document


async def ingest_file(
    path: Path,
    share: Optional[ImportShare],
    session: Optional[Session] = None,
    tags: Optional[list[str]] = None,
    delete_source: bool = True,
) -> Document:
    session_provided = session is not None
    context = None
    if not session_provided:
        context = session_scope()
        session = context.__enter__()
    assert session is not None
    try:
        stored_path, mime_type, size, checksum = storage_manager.save(path)
        ocr_text = ocr.extract_text(stored_path, mime_type) if settings.enable_ocr else None
        document = Document(
            title=path.stem,
            original_filename=path.name,
            stored_path=str(stored_path),
            mime_type=mime_type,
            size_bytes=size,
            checksum=checksum,
            imported_from_share_id=share.id if share else None,
            ocr_text=ocr_text,
        )
        if tags:
            document.tags = [_get_or_create_tag(session, tag_name) for tag_name in tags]
        session.add(document)
        session.commit()
        session.refresh(document)
        logger.info("Ingested document %s", document.id)
        return document
    finally:
        if delete_source and path.exists():
            try:
                path.unlink()
            except Exception as exc:
                logger.warning("Failed to delete %s: %s", path, exc)
        if not session_provided and context is not None:
            context.__exit__(None, None, None)


def _get_or_create_tag(session: Session, tag_name: str) -> Tag:
    tag = session.exec(select(Tag).where(Tag.name == tag_name)).first()
    if not tag:
        tag = Tag(name=tag_name)
        session.add(tag)
        session.commit()
        session.refresh(tag)
    return tag
