"""
File Upload Handler — backend/app/services/file_handler.py
-----------------------------------------------------------
Extracts plain text from uploaded files so they can be fed
into the same analyze pipeline as typed text.

Supported formats
  .txt           — read directly
  .pdf           — PyMuPDF (fitz) — fast, no Tesseract needed for text-PDFs
                   Falls back to pytesseract OCR for scanned/image PDFs
  .docx          — python-docx
  .png/.jpg/.jpeg — Tesseract OCR via pytesseract

Install deps (add to requirements.txt):
  pymupdf
  python-docx
  pytesseract
  Pillow

System dep (install once on your machine):
  sudo apt install tesseract-ocr          # Linux / WSL
  brew install tesseract                  # macOS
  # Windows: download installer from https://github.com/UB-Mannheim/tesseract/wiki
"""

import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Max characters we'll pass to the pipeline — keeps NLI inference fast
MAX_CHARS = 8000


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Dispatch to the right extractor based on file extension.
    Returns clean plain text (≤ MAX_CHARS).
    Raises ValueError for unsupported formats.
    Raises RuntimeError if extraction itself fails.
    """
    suffix = Path(filename).suffix.lower()

    extractors = {
        ".txt":  _from_txt,
        ".pdf":  _from_pdf,
        ".docx": _from_docx,
        ".png":  _from_image,
        ".jpg":  _from_image,
        ".jpeg": _from_image,
    }

    if suffix not in extractors:
        raise ValueError(
            f"Unsupported file type '{suffix}'. "
            "Accepted: .txt, .pdf, .docx, .png, .jpg, .jpeg"
        )

    try:
        raw = extractors[suffix](file_bytes)
    except Exception as exc:
        logger.error("Text extraction failed for %s: %s", filename, exc)
        raise RuntimeError(f"Could not extract text from '{filename}': {exc}") from exc

    cleaned = _clean(raw)
    if len(cleaned) < 30:
        raise RuntimeError(
            "Extracted text is too short (< 30 characters). "
            "The file may be empty, image-only, or encrypted."
        )

    return cleaned[:MAX_CHARS]


# ── Extractors ───────────────────────────────────────────────────────────────

def _from_txt(data: bytes) -> str:
    # Try UTF-8 first, fall back to latin-1
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def _from_pdf(data: bytes) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError("PyMuPDF not installed. Run: pip install pymupdf")

    doc = fitz.open(stream=data, filetype="pdf")
    pages_text = []

    for page in doc:
        text = page.get_text("text")
        pages_text.append(text)

    full_text = "\n".join(pages_text)

    # If the PDF is image-based (scanned), text will be empty → use OCR
    if len(full_text.strip()) < 50:
        logger.info("PDF appears to be image-based — falling back to OCR")
        full_text = _pdf_ocr_fallback(doc)

    doc.close()
    return full_text


def _pdf_ocr_fallback(doc) -> str:
    """Render each PDF page as an image and OCR it."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        raise RuntimeError(
            "pytesseract or Pillow not installed. "
            "Run: pip install pytesseract Pillow  and install Tesseract binary."
        )

    texts = []
    for page in doc:
        # Render at 200 DPI for good OCR quality
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        texts.append(pytesseract.image_to_string(img, lang="eng"))
    return "\n".join(texts)


def _from_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")

    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def _from_image(data: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        raise RuntimeError(
            "pytesseract or Pillow not installed. "
            "Run: pip install pytesseract Pillow  and install Tesseract binary."
        )

    img = Image.open(io.BytesIO(data))

    # Convert to RGB — Tesseract doesn't like RGBA PNGs
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # Upscale small images for better OCR accuracy
    w, h = img.size
    if w < 1000:
        scale = max(2, 1000 // w)
        img = img.resize((w * scale, h * scale), Image.LANCZOS)

    text = pytesseract.image_to_string(img, lang="eng")
    return text


# ── Cleanup ──────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    import re
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove page-number artifacts (e.g. "- 3 -" or just "3")
    text = re.sub(r"^\s*[-–—]?\s*\d+\s*[-–—]?\s*$", "", text, flags=re.MULTILINE)
    # Normalize whitespace within lines
    lines = [" ".join(line.split()) for line in text.splitlines()]
    return "\n".join(lines).strip()