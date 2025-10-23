from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)


SUPPORTED_MIME = {"image/png", "image/jpeg", "image/tiff", "image/bmp", "application/pdf"}


def extract_text(path: Path, mime_type: Optional[str]) -> Optional[str]:
    if mime_type not in SUPPORTED_MIME:
        return None
    try:
        if mime_type == "application/pdf":
            from pdf2image import convert_from_path  # type: ignore

            text_content: list[str] = []
            for image in convert_from_path(str(path)):
                text_content.append(pytesseract.image_to_string(image))
            return "\n".join(text_content).strip() or None
        image = Image.open(path)
        return pytesseract.image_to_string(image).strip() or None
    except Exception as exc:  # pragma: no cover - OCR errors shouldn't crash ingestion
        logger.warning("OCR failed for %s: %s", path, exc)
        return None
