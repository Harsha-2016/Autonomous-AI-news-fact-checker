import os
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from tavily import TavilyClient
from sentence_transformers import CrossEncoder
from dotenv import load_dotenv

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
        
        # Run inference
        scores = nli_model.predict([pair])
        
        # Map labels: 0=contradiction(0.0), 1=entailment(1.0), 2=neutral(0.5)
        label = scores[0].argmax()
        label_to_score = {0: 0.0, 1: 1.0, 2: 0.5}
        nli_score = label_to_score.get(int(label), 0.5)
        
        results.append({
            **evidence,
            "nli_score": nli_score
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
    claim = request.claim.strip()
    
    # Validate claim
    if not claim:
        logger.warning("Empty claim received")
        return VerifyResponse(
            truth_score=50.0,
            verdict="Uncertain",
            supporting_sources=[],
            sources=[],
            summary="No claim provided for verification."
        )
    
    # Truncate to 5000 characters
    claim = claim[:5000]
    logger.info(f"Processing claim verification (length: {len(claim)})")
    
    # Retrieve evidence
    evidence = get_ground_truth(
        claim,
        app.state.tavily_client,
        app.state.domain_weights
    )
    
    # Calculate NLI scores
    evidence_with_scores = calculate_nli_scores(
        claim,
        evidence,
        app.state.ml_models.get("nli_model")
    )
    
    # Calculate truth score
    truth_score = calculate_truth_score(evidence_with_scores)
    
    # Classify verdict
    verdict = classify_verdict(truth_score)
    
    # Extract supporting sources
    supporting_sources = [ev.get("url", "") for ev in evidence_with_scores]
    
    # Generate summary
    summary = generate_summary(verdict, truth_score, len(evidence_with_scores))
    
    logger.info(f"Verification complete: verdict={verdict}, score={truth_score}")
    
    return VerifyResponse(
        truth_score=truth_score,
        verdict=verdict,
        supporting_sources=supporting_sources,
        sources=evidence_with_scores,
        summary=summary
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
