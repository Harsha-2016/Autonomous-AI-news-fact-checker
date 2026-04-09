"""
Fetch and extract main article text from a public URL for fact-checking.
Uses trafilatura for boilerplate removal.
"""
from __future__ import annotations

import logging
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Reasonable cap after extraction (verify pipeline truncates further as needed)
MAX_ARTICLE_CHARS = 18_000


def looks_like_http_url(text: str) -> bool:
    t = text.strip()
    if not t or "\n" in t:
        return False
    return bool(re.match(r"^https?://\S+$", t, re.IGNORECASE))


def fetch_article_text(url: str) -> str:
    """
    Download page and extract readable article/body text.
    Raises ValueError with a user-facing message on failure.
    """
    try:
        import trafilatura
    except ImportError as e:
        raise ValueError(
            "Article extraction is not available (trafilatura not installed)."
        ) from e

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Invalid URL. Use http:// or https:// links.")

    downloaded = trafilatura.fetch_url(url.strip())
    if not downloaded:
        raise ValueError(
            "Could not download this page. The site may block automated access or the link may be invalid."
        )

    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=True,
        no_fallback=False,
    )
    if not text or len(text.strip()) < 80:
        raise ValueError(
            "Could not extract readable article text from this page. Try pasting the article text instead."
        )

    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) > MAX_ARTICLE_CHARS:
        cleaned = cleaned[:MAX_ARTICLE_CHARS]
    logger.info("Extracted %d chars from URL", len(cleaned))
    return cleaned


def resolve_user_input(raw: str) -> Tuple[str, Optional[str]]:
    """
    If input is a single-line URL, fetch article text. Otherwise return text as-is.

    Returns:
        (text_for_pipeline, source_url_or_none)
    """
    if not raw or not raw.strip():
        return "", None

    s = raw.strip()
    if looks_like_http_url(s):
        article = fetch_article_text(s)
        return article, s.strip()
    return s, None
