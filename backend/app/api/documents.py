from __future__ import annotations

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlmodel import Session, select

from app.auth.deps import get_current_user
from app.core.database import get_session
from app.models.document import Document, ImportShare, Tag
from app.models.user import User
from app.core.config import get_settings
from app.schemas.documents import DocumentRead, ShareCreate, ShareRead, TagCreate, TagRead
from app.services.ingest import ShareWatcherManager, ingest_upload

router = APIRouter(prefix="/documents", tags=["documents"])

watcher_manager: Optional[ShareWatcherManager] = None
settings = get_settings()


def init_watcher_manager(manager: ShareWatcherManager) -> None:
    global watcher_manager
    watcher_manager = manager


@router.get("/", response_model=List[DocumentRead])
def list_documents(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    query: Optional[str] = Query(default=None, description="Full text search query"),
    tags: Optional[List[int]] = Query(default=None),
) -> List[Document]:
    statement = select(Document)
    if query:
        document_ids = _search_document_ids(session, query)
        if document_ids:
            statement = statement.where(Document.id.in_(document_ids))
        else:
            return []
    if tags:
        statement = statement.where(Document.tags.any(Tag.id.in_(tags)))  # type: ignore[arg-type]
    statement = statement.order_by(Document.created_at.desc())
    documents = session.exec(statement).all()
    return documents


@router.post("/upload", response_model=DocumentRead)
async def upload_document(
    tags: Optional[List[str]] = Query(default=None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Document:
    document = await ingest_upload(file, session=session, tags=tags)
    return document


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> Document:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{document_id}/download")
def download_document(document_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> FileResponse:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return FileResponse(document.stored_path, filename=document.original_filename)


@router.delete("/{document_id}")
def delete_document(document_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> dict[str, bool]:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    session.delete(document)
    session.commit()
    return {"deleted": True}


@router.get("/tags", response_model=List[TagRead])
def list_tags(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> List[Tag]:
    return session.exec(select(Tag)).all()


@router.post("/tags", response_model=TagRead)
def create_tag(tag_in: TagCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> Tag:
    existing = session.exec(select(Tag).where(Tag.name == tag_in.name)).first()
    if existing:
        return existing
    tag = Tag(name=tag_in.name)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.get("/shares", response_model=List[ShareRead])
def list_shares(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> List[ImportShare]:
    return session.exec(select(ImportShare)).all()


@router.post("/shares", response_model=ShareRead)
def create_share(share_in: ShareCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)) -> ImportShare:
    data = share_in.dict()
    if share_in.managed:
        base_path = settings.import_shares_root / share_in.path
        base_path.mkdir(parents=True, exist_ok=True)
        data["path"] = str(base_path)
    share = ImportShare(**data)
    session.add(share)
    session.commit()
    session.refresh(share)
    if watcher_manager:
        asyncio.create_task(watcher_manager.refresh())
    return share


def _search_document_ids(session: Session, query: str) -> List[int]:
    results = session.exec(
        text("SELECT document_id FROM documents_fts WHERE documents_fts MATCH :query"),
        {"query": query},
    ).fetchall()
    return [row[0] for row in results]
