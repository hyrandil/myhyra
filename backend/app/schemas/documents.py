from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class TagRead(TagBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class DocumentCreate(DocumentBase):
    tags: Optional[List[str]] = None


class DocumentRead(DocumentBase):
    id: int
    original_filename: str
    mime_type: Optional[str]
    size_bytes: Optional[int]
    checksum: Optional[str]
    imported_from_share_id: Optional[int]
    ocr_text: Optional[str]
    created_at: datetime
    tags: List[TagRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ShareBase(BaseModel):
    name: str
    path: str
    managed: bool = False
    recursive: bool = True
    active: bool = True


class ShareCreate(ShareBase):
    pass


class ShareRead(ShareBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
