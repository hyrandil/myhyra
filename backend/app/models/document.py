from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class DocumentTagLink(SQLModel, table=True):
    document_id: Optional[int] = Field(default=None, foreign_key="document.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)


class ImportShare(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    path: str
    managed: bool = Field(default=False, description="Whether the application manages this directory")
    recursive: bool = Field(default=True)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    documents: list["Document"] = Relationship(back_populates="import_share")


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    documents: list["Document"] = Relationship(back_populates="tags", link_model=DocumentTagLink)


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: Optional[str] = Field(default=None, index=True)
    description: Optional[str] = Field(default=None)
    original_filename: str
    stored_path: str
    mime_type: Optional[str] = Field(default=None, index=True)
    size_bytes: Optional[int] = Field(default=None)
    checksum: Optional[str] = Field(default=None, index=True)
    imported_from_share_id: Optional[int] = Field(default=None, foreign_key="importshare.id")
    ocr_text: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    tags: list[Tag] = Relationship(back_populates="documents", link_model=DocumentTagLink)
    import_share: Optional[ImportShare] = Relationship(back_populates="documents")
