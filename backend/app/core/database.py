from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_fts_tables()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@contextmanager
def session_scope() -> Iterator[Session]:
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _ensure_fts_tables() -> None:
    db_path = settings.database_url.replace("sqlite:///", "")
    if not db_path:
        return
    path = Path(db_path)
    if not path.exists():
        return
    with engine.connect() as connection:
        connection.exec_driver_sql(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                document_id UNINDEXED,
                content
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON document
            BEGIN
                INSERT INTO documents_fts(rowid, document_id, content)
                VALUES (new.id, new.id, coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.ocr_text, ''));
            END;
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON document
            BEGIN
                UPDATE documents_fts SET content = coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.ocr_text, '')
                WHERE document_id = new.id;
            END;
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON document
            BEGIN
                DELETE FROM documents_fts WHERE document_id = old.id;
            END;
            """
        )
