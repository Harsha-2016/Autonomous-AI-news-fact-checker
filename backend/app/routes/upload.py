"""
POST /upload
------------
Accepts a multipart file upload, extracts plain text using
file_handler.py, then runs the EXACT SAME pipeline as POST /analyze.

This means zero duplication — upload is just a thin adapter that
converts "file" → "text" and delegates to the existing logic.

Attach to main.py with:
    from app.routes.upload import router as upload_router
    app.include_router(upload_router)
"""

import time
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from app.models.schemas import AnalyzeResponse, Verdict
from app.services.file_handler       import extract_text
from app.services.claim_extractor    import extract_claims
from app.services.evidence_retriever import retrieve_evidence
from app.services.nli_verifier       import verify_claim
from app.services.truth_scorer       import compute_truth_score, build_summary
from app.models.schemas              import ClaimResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# 10 MB hard limit — generous for any news article
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post(
    "",
    response_model=AnalyzeResponse,
    summary="Upload a file (PDF/DOCX/image/txt) and get a Truth Score",
)
async def upload_file(file: UploadFile = File(...)) -> AnalyzeResponse:
    t_start = time.perf_counter()

    # ── 1. Read and size-check ────────────────────────────────────────────
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds 10 MB limit ({len(raw) // 1024} KB received).",
        )

    filename = file.filename or "upload.bin"
    logger.info("Upload received: %s (%d bytes)", filename, len(raw))

    # ── 2. Extract text ───────────────────────────────────────────────────
    try:
        text = extract_text(raw, filename)
    except ValueError as exc:
        # Unsupported format
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        )
    except RuntimeError as exc:
        # Extraction failed (corrupt file, empty PDF, etc.)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    logger.info("Extracted %d chars from %s", len(text), filename)

    # ── 3. Run the same pipeline as /analyze ─────────────────────────────
    try:
        raw_claims = extract_claims(text, max_claims=6)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Claim extraction failed: {exc}",
        )

    if not raw_claims:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No checkable factual claims found in the file.",
        )

    claim_results: list[ClaimResult] = []
    total_sources = 0

    for claim_text in raw_claims:
        try:
            evidence = retrieve_evidence(claim_text, max_results=4)
        except Exception as exc:
            logger.warning("Evidence retrieval failed: %s", exc)
            evidence = []

        total_sources += len(evidence)

        try:
            verdict, confidence, explanation = verify_claim(claim_text, evidence)
        except Exception as exc:
            logger.warning("NLI failed: %s", exc)
            verdict, confidence, explanation = (
                Verdict.INSUFFICIENT, 0.3,
                "Verification could not be completed for this claim.",
            )

        claim_results.append(ClaimResult(
            claim=claim_text,
            verdict=verdict,
            confidence=confidence,
            evidence=evidence,
            explanation=explanation,
        ))

    truth_score, band, band_color = compute_truth_score(claim_results)
    summary = build_summary(truth_score, band, claim_results)

    elapsed_ms = int((time.perf_counter() - t_start) * 1000)
    logger.info(
        "Upload analysis done — file=%s score=%d band=%s time=%dms",
        filename, truth_score, band, elapsed_ms,
    )

    return AnalyzeResponse(
        truth_score=truth_score,
        band=band,
        band_color=band_color,
        summary=summary,
        claims=claim_results,
        total_claims=len(claim_results),
        supported_count=sum(1 for c in claim_results if c.verdict == Verdict.SUPPORTED),
        refuted_count=sum(1 for c in claim_results if c.verdict == Verdict.REFUTED),
        insufficient_count=sum(1 for c in claim_results if c.verdict == Verdict.INSUFFICIENT),
        sources_checked=total_sources,
        processing_time_ms=elapsed_ms,
    )