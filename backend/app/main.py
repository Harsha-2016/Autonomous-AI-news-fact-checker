import os
import json
import logging
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Tuple
from tavily import TavilyClient
from sentence_transformers import CrossEncoder
from dotenv import load_dotenv
import numpy as np
from app.services.file_handler import extract_text
from app.services.article_fetcher import resolve_user_input

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
env_path = os.path.join(project_root, ".env")
load_dotenv(env_path)
logger.info(f"Environment variables loaded from {env_path}")


def load_domain_weights() -> Dict[str, float]:
    scores = {
        "reuters.com": 0.95, "apnews.com": 0.95, "bbc.com": 0.92, 
        "isro.gov.in": 0.96, "rbi.org.in": 0.97, "who.int": 0.93, 
        "snopes.com": 0.85, "wikipedia.org": 0.90, "wikipedia.com": 0.90, 
        "reddit.com": 0.25, "thehindu.com": 0.95, "hindu.com": 0.95
    }
    path = os.path.join(project_root, "data", "domain_trust_scores.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            scores.update(json.load(f))
    except Exception as e:
        logger.warning(f"Could not load additional JSON domain scores: {e}")
    return scores


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Starting TruthLens Backend Core application")
    
    ml_models = {}
    
    # Load NLI model
    logger.info("Loading NLI model: cross-encoder/nli-deberta-v3-small")
    try:
        ml_models["nli_model"] = CrossEncoder(
            "cross-encoder/nli-deberta-v3-small",
            device="cpu"
        )
        logger.info("NLI model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load NLI model: {e}")
        ml_models["nli_model"] = None
    
    # Initialize Tavily client
    logger.info("Initializing Tavily API client")
    tavily_client = None
    try:
        api_key = os.getenv("TAVILY_API_KEY")
        if api_key:
            tavily_client = TavilyClient(api_key=api_key)
            logger.info("Tavily client initialized successfully")
        else:
            logger.warning("TAVILY_API_KEY not found in environment variables")
    except Exception as e:
        logger.error(f"Failed to initialize Tavily client: {e}")
    
    # Load domain weights
    domain_weights = load_domain_weights()
    logger.info(f"Loaded {len(domain_weights)} domain weights")
    
    # Store in app state
    app.state.ml_models = ml_models
    app.state.tavily_client = tavily_client
    app.state.domain_weights = domain_weights
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down TruthLens Backend Core application")
    app.state.ml_models.clear()
    app.state.tavily_client = None
    logger.info("Application shutdown complete")


app = FastAPI(
    title="TruthLens API",
    version="1.0.0",
    description="Autonomous AI fact-checking system for claim verification",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Data Models
class VerifyRequest(BaseModel):
    """Request model for claim verification."""
    claim: str


class VerifyResponse(BaseModel):
    """Response model for verification results."""
    truth_score: float
    verdict: str
    supporting_sources: List[str]
    sources: List[Dict[str, Any]]
    summary: str
    claim_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    score_components: Dict[str, float] = Field(default_factory=dict)
    confidence: float = 0.0


class SimplifyRequest(BaseModel):
    technical_verdict: str
    truth_score: float


class SimplifyResponse(BaseModel):
    simple_explanation: str


# Service Functions
def get_ground_truth(claim: str, tavily_client, domain_weights: Dict[str, float]) -> List[Dict[str, Any]]:
    """Retrieve evidence from trusted sources using Tavily API."""
    if not tavily_client:
        logger.warning("Tavily client is unavailable")
        return []
    
    try:
        # Truncate claim to 350 characters
        search_query = claim[:350].strip()
        
        # Build include_domains parameter
        trusted_domains = list(domain_weights.keys())
        
        # Search with timeout
        response = tavily_client.search(
            query=search_query,
            include_domains=trusted_domains,
            max_results=5,
            search_depth="basic"
        )
        
        # Process results
        sources = []
        from urllib.parse import urlparse
        
        for result in response.get("results", [])[:5]:
            url = result.get("url", "")
            domain = urlparse(url).netloc.replace("www.", "")
            weight = domain_weights.get(domain, 0.5)
            
            sources.append({
                "title": result.get("title", ""),
                "url": url,
                "content": result.get("content", ""),
                "domain": domain,
                "trust_score": weight
            })
        
        logger.info(f"Retrieved {len(sources)} evidence sources for claim")
        return sources
    
    except Exception as e:
        logger.error(f"Evidence retrieval failed: {e}")
        return []


def _softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exps = np.exp(shifted)
    return exps / np.sum(exps)


def _extract_claim_candidates(text: str, max_claims: int = 8) -> List[str]:
    """
    Extract likely factual claim candidates from input text.
    Keeps the strongest candidates to make verification deeper and more stable.
    """
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    cleaned: List[str] = []
    seen = set()

    for sentence in raw_sentences:
        candidate = re.sub(r"\s+", " ", sentence).strip(" -\t\r\n")
        if not candidate:
            continue
        if len(candidate) < 25 or len(candidate) > 450:
            continue

        lowered = candidate.lower()
        # Heuristic factuality filters:
        # - contains numbers/dates/entities cues
        # - excludes obvious opinion-only style
        factual_signals = bool(re.search(r"\d|%|\b(according to|reported|announced|confirmed|study|data|election|budget|deaths|cases)\b", lowered))
        opinion_only = bool(re.search(r"\b(i think|maybe|perhaps|should|could|might)\b", lowered))
        if not factual_signals or opinion_only:
            continue

        key = lowered
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(candidate)

    if not cleaned and text.strip():
        return [text.strip()[:450]]
    return cleaned[:max_claims]


def calculate_nli_scores(
    claim: str,
    evidence_list: List[Dict[str, Any]],
    nli_model
) -> List[Dict[str, Any]]:
    """Calculate NLI scores for claim-evidence pairs."""
    if not nli_model:
        logger.warning("NLI model is unavailable, using default scores")
        return [
            {**ev, "nli_score": 0.5}
            for ev in evidence_list
        ]
    
    results = []
    for evidence in evidence_list:
        # Truncate evidence to 1000 characters
        evidence_text = evidence.get("content", "")[:1000]
        
        # Create pair for NLI model
        pair = [claim, evidence_text]
        
        # Run inference and convert to calibrated probabilities.
        logits = np.array(nli_model.predict([pair])[0], dtype=np.float64)
        probs = _softmax(logits)
        contradiction_prob, entailment_prob, neutral_prob = (
            float(probs[0]),
            float(probs[1]),
            float(probs[2]),
        )

        # Calibrated evidence truth score in [0,1]:
        # use entailment-vs-contradiction signal as the primary driver,
        # while neutral reduces confidence rather than boosting truth.
        nli_score = 0.5 + 0.5 * (entailment_prob - contradiction_prob)
        nli_score = max(0.0, min(1.0, nli_score))
        nli_confidence = max(entailment_prob, contradiction_prob, neutral_prob)
        stance = (
            "supported" if entailment_prob >= contradiction_prob and entailment_prob >= neutral_prob
            else "refuted" if contradiction_prob >= entailment_prob and contradiction_prob >= neutral_prob
            else "insufficient"
        )
        
        results.append({
            **evidence,
            "nli_score": nli_score,
            "entailment_prob": entailment_prob,
            "contradiction_prob": contradiction_prob,
            "neutral_prob": neutral_prob,
            "nli_confidence": nli_confidence,
            "stance": stance,
        })
    
    return results


def calculate_truth_score(evidence_with_scores: List[Dict[str, Any]]) -> float:
    """Calculate final truth score based on weighted NLI scores and source weights."""
    if not evidence_with_scores:
        logger.info("No evidence available, returning default score of 50")
        return 50.0
    
    total_weighted_score = 0.0
    total_weights = 0.0
    
    for evidence in evidence_with_scores:
        nli_score = evidence.get("nli_score", 0.5)
        source_weight = evidence.get("trust_score", 0.5)
        weighted_score = nli_score * source_weight
        total_weighted_score += weighted_score
        total_weights += source_weight
        
        logger.debug(
            f"Domain: {evidence.get('domain', 'unknown')}, "
            f"NLI: {nli_score}, Weight: {source_weight}, "
            f"Weighted: {weighted_score}"
        )
    
    if total_weights <= 0:
        return 50.0
        
    # Calculate proper weighted average
    average_score = total_weighted_score / total_weights
    
    # Normalize to 1-100 range
    truth_score = round(max(1.0, min(100.0, average_score * 100)), 2)
    
    logger.info(f"Calculated truth score: {truth_score}")
    return truth_score


def score_single_claim(
    claim: str,
    evidence_with_scores: List[Dict[str, Any]],
) -> Tuple[float, float, str, Dict[str, int]]:
    """
    Returns:
      claim_score_0_100, claim_confidence_0_1, claim_verdict, stance_counts
    """
    if not evidence_with_scores:
        return 50.0, 0.25, "Insufficient", {"supported": 0, "refuted": 0, "insufficient": 0}

    total_weight = 0.0
    weighted_score = 0.0
    confidence_acc = 0.0
    stance_counts = {"supported": 0, "refuted": 0, "insufficient": 0}

    for ev in evidence_with_scores:
        trust = float(ev.get("trust_score", 0.5))
        nli_score = float(ev.get("nli_score", 0.5))
        nli_conf = float(ev.get("nli_confidence", 0.5))
        stance = ev.get("stance", "insufficient")
        stance_counts[stance] = stance_counts.get(stance, 0) + 1

        # Blend model stance with source reliability.
        # More reliable sources and more confident predictions matter more.
        evidence_weight = max(0.05, (0.60 * trust) + (0.40 * nli_conf))
        evidence_score = (0.88 * nli_score) + (0.12 * trust)

        weighted_score += evidence_score * evidence_weight
        confidence_acc += nli_conf * evidence_weight
        total_weight += evidence_weight

    if total_weight <= 0:
        return 50.0, 0.25, "Insufficient", stance_counts

    base_score = weighted_score / total_weight
    confidence = confidence_acc / total_weight

    # Contradiction-heavy evidence should strongly reduce score,
    # while support-heavy evidence should raise it.
    contradiction_ratio = stance_counts["refuted"] / max(1, len(evidence_with_scores))
    support_ratio = stance_counts["supported"] / max(1, len(evidence_with_scores))
    consistency_adjustment = (support_ratio * 0.20) - (contradiction_ratio * 0.28)

    final_score_01 = max(0.0, min(1.0, base_score + consistency_adjustment))
    claim_score = round(final_score_01 * 100, 2)
    verdict = classify_verdict(claim_score)
    return claim_score, round(confidence, 4), verdict, stance_counts


def deep_verify_claim(
    text: str,
    tavily_client,
    domain_weights: Dict[str, float],
    nli_model,
) -> Dict[str, Any]:
    """
    Decomposes input into factual claims, verifies each independently,
    then aggregates to a robust truth score.
    """
    claims = _extract_claim_candidates(text)
    if not claims:
        return {
            "truth_score": 50.0,
            "verdict": "Uncertain",
            "summary": "No checkable factual claims detected.",
            "sources": [],
            "supporting_sources": [],
            "claim_breakdown": [],
            "score_components": {"evidence_quality": 50.0, "coverage": 0.0, "consistency": 50.0},
            "confidence": 0.0,
        }

    all_sources: List[Dict[str, Any]] = []
    source_urls = set()
    claim_breakdown: List[Dict[str, Any]] = []
    claim_scores: List[float] = []
    claim_confidences: List[float] = []
    supported = refuted = insufficient = 0

    for claim in claims:
        evidence = get_ground_truth(claim, tavily_client, domain_weights)
        evidence_scored = calculate_nli_scores(claim, evidence, nli_model)
        score, confidence, verdict, stance_counts = score_single_claim(claim, evidence_scored)

        if verdict == "True":
            supported += 1
        elif verdict == "False":
            refuted += 1
        else:
            insufficient += 1

        claim_scores.append(score)
        claim_confidences.append(confidence)

        claim_breakdown.append({
            "claim": claim,
            "truth_score": score,
            "confidence": confidence,
            "verdict": verdict,
            "evidence_count": len(evidence_scored),
            "stance_counts": stance_counts,
        })

        for ev in evidence_scored:
            url = ev.get("url", "")
            if url and url in source_urls:
                continue
            if url:
                source_urls.add(url)
            all_sources.append(ev)

    # Aggregate components
    if claim_scores:
        evidence_quality = float(np.mean(claim_scores))
        confidence_component = float(np.mean(claim_confidences)) * 100.0
    else:
        evidence_quality = 50.0
        confidence_component = 0.0

    covered_claims = sum(1 for c in claim_breakdown if c["evidence_count"] > 0)
    coverage = (covered_claims / max(1, len(claim_breakdown))) * 100.0
    consistency = (supported / max(1, len(claim_breakdown))) * 100.0 - (refuted / max(1, len(claim_breakdown))) * 45.0 + 50.0
    consistency = max(1.0, min(100.0, consistency))
    contradiction_ratio = refuted / max(1, len(claim_breakdown))
    support_ratio = supported / max(1, len(claim_breakdown))

    # Final score prioritizes evidence quality + confidence, then coverage/consistency.
    final_score = (
        0.52 * evidence_quality +
        0.22 * confidence_component +
        0.13 * coverage +
        0.13 * consistency
    )
    # Global calibration: widen separation for obviously true/false sets.
    final_score += support_ratio * 8.0
    final_score -= contradiction_ratio * 18.0
    if coverage < 40.0:
        # Low coverage often means weak verification; pull toward skeptical side.
        final_score -= 6.0
    final_score = round(max(1.0, min(100.0, final_score)), 2)
    verdict = classify_verdict(final_score)

    summary = (
        f"Deep analysis checked {len(claim_breakdown)} claim(s): "
        f"{supported} supported, {refuted} refuted, {insufficient} uncertain. "
        f"Evidence coverage {coverage:.0f}% with confidence {confidence_component:.0f}%."
    )

    return {
        "truth_score": final_score,
        "verdict": verdict,
        "summary": summary,
        "sources": all_sources[:10],
        "supporting_sources": list(source_urls)[:10],
        "claim_breakdown": claim_breakdown,
        "score_components": {
            "evidence_quality": round(evidence_quality, 2),
            "coverage": round(coverage, 2),
            "consistency": round(consistency, 2),
            "confidence": round(confidence_component, 2),
        },
        "confidence": round(confidence_component / 100.0, 4),
    }


def classify_verdict(truth_score: float) -> str:
    """Classify truth score into categorical verdict."""
    if truth_score < 40:
        return "False"
    elif truth_score <= 65:
        return "Uncertain"
    else:
        return "True"


def generate_summary(verdict: str, truth_score: float, num_sources: int) -> str:
    """Generate human-readable summary of verification result."""
    if num_sources == 0:
        return "No evidence sources found for verification."
    
    source_text = f"{num_sources} source" if num_sources == 1 else f"{num_sources} sources"
    return f"Verified through {source_text}. Verdict: {verdict}. Truth Score: {truth_score:.1f}/100."


# API Endpoints
@app.post("/verify", response_model=VerifyResponse)
async def verify_claim(request: VerifyRequest) -> VerifyResponse:
    """
    Verify a claim against trusted sources.
    
    Args:
        request: VerifyRequest containing the claim to verify
    
    Returns:
        VerifyResponse with truth score, verdict, and supporting sources
    """
    raw_input = request.claim.strip()
    if not raw_input:
        logger.warning("Empty claim received")
        return VerifyResponse(
            truth_score=50.0,
            verdict="Uncertain",
            supporting_sources=[],
            sources=[],
            summary="No claim provided for verification."
        )

    try:
        claim, _source_url = resolve_user_input(raw_input)
    except ValueError as e:
        logger.warning("Input resolution failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    if not claim.strip():
        return VerifyResponse(
            truth_score=50.0,
            verdict="Uncertain",
            supporting_sources=[],
            sources=[],
            summary="No usable text after processing your input.",
        )

    # Allow longer articles (URL extraction); cap for model + API safety
    claim = claim[:20000]
    logger.info(f"Processing claim verification (length: {len(claim)})")
    
    # Deeper multi-claim verification for stronger truth scores.
    deep_result = deep_verify_claim(
        claim,
        app.state.tavily_client,
        app.state.domain_weights,
        app.state.ml_models.get("nli_model"),
    )
    
    logger.info(
        "Verification complete: verdict=%s, score=%s, claims=%d",
        deep_result["verdict"],
        deep_result["truth_score"],
        len(deep_result["claim_breakdown"]),
    )
    
    return VerifyResponse(
        truth_score=deep_result["truth_score"],
        verdict=deep_result["verdict"],
        supporting_sources=deep_result["supporting_sources"],
        sources=deep_result["sources"],
        summary=deep_result["summary"],
        claim_breakdown=deep_result["claim_breakdown"],
        score_components=deep_result["score_components"],
        confidence=deep_result["confidence"],
    )


@app.post("/api/analyze")
async def analyze_legacy(request: Dict[str, Any]) -> VerifyResponse:
    """
    Legacy endpoint for backward compatibility.
    Maps 'text' field to 'claim' and forwards to /verify endpoint.
    
    Args:
        request: Dictionary with 'text' field
    
    Returns:
        VerifyResponse with verification results
    """
    claim = request.get("text", "")
    verify_request = VerifyRequest(claim=claim)
    return await verify_claim(verify_request)


@app.post("/upload", response_model=VerifyResponse)
async def upload_and_analyze(file: UploadFile = File(...)) -> VerifyResponse:
    """
    Upload endpoint used by frontend FileUpload component.
    Extracts text from file/image and runs the same deep verify pipeline.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    filename = file.filename or "upload.bin"
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit.",
        )

    try:
        extracted_text = extract_text(raw, filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text extraction failed: {exc}",
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No extractable text found in file.",
        )

    return await verify_claim(VerifyRequest(claim=extracted_text))


@app.post("/simplify", response_model=SimplifyResponse)
async def simplify_verdict(request: SimplifyRequest) -> SimplifyResponse:
    score = request.truth_score
    
    # Template fallback definitions
    if score >= 80:
        fallback_exp = "This article is mostly true. Most claims match reliable sources."
    elif score >= 60:
        fallback_exp = "This article has both true and false information. Be careful."
    elif score >= 40:
        fallback_exp = "This article has more false than true information."
    else:
        fallback_exp = "This article is mostly false. Don't trust it."

    import requests
    hf_key = os.getenv("HF_API_KEY")
    if hf_key and hf_key.strip() and hf_key != "your_huggingface_token":
        try:
            prompt = f"Explain this fact-check result in 2-3 simple sentences a 12-year-old would understand. Use plain words, no jargon.\n\nTechnical verdict: {request.technical_verdict}\nTruth score: {request.truth_score}/100\n\nSimple explanation:\n"
            ans = requests.post(
                "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
                headers={"Authorization": f"Bearer {hf_key}"},
                json={"inputs": prompt, "parameters": {"max_new_tokens": 100, "return_full_text": False}},
                timeout=5
            )
            ans.raise_for_status()
            text = ans.json()[0]["generated_text"].strip()
            if text:
                return SimplifyResponse(simple_explanation=text)
        except Exception as e:
            logger.error(f"LLM simplification failed: {e}")
            pass
            
    return SimplifyResponse(simple_explanation=fallback_exp)
