# TruthLens Backend Core - Design Document

## Overview

This document provides the technical design for the TruthLens Backend Core feature. It translates requirements into architectural decisions, component specifications, and implementation patterns.

## Architecture

### High-Level Flow

```
User Request (POST /verify)
    ↓
Request Validation
    ↓
Evidence Retrieval (Tavily API)
    ↓
NLI Inference (CrossEncoder Model)
    ↓
Truth Score Calculation
    ↓
Verdict Classification
    ↓
Response Formatting
    ↓
Return VerifyResponse (HTTP 200)
```

### Component Architecture

```
FastAPI Application
├── Lifespan Manager
│   ├── NLI Model Loader (startup)
│   ├── Tavily Client Initializer (startup)
│   └── Resource Cleanup (shutdown)
├── API Routes
│   ├── POST /verify
│   └── POST /api/analyze (legacy)
├── Services
│   ├── Evidence Retriever
│   ├── NLI Verifier
│   ├── Truth Scorer
│   └── Configuration Loader
└── Models
    ├── VerifyRequest
    └── VerifyResponse
```

## Component Specifications

### 1. Lifespan Manager

**Purpose:** Initialize and manage application-level resources (NLI model, Tavily client, domain weights)

**Responsibilities:**
- Load NLI model at startup on CPU device
- Initialize Tavily API client with TAVILY_API_KEY from .env
- Load domain trust scores from configuration
- Clean up resources on shutdown

**Implementation Pattern:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ml_models = {}
    try:
        ml_models["nli_model"] = CrossEncoder("cross-encoder/nli-deberta-v3-small", device="cpu")
        logger.info("NLI model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load NLI model: {e}")
    
    tavily_client = None
    try:
        api_key = os.getenv("TAVILY_API_KEY")
        if api_key:
            tavily_client = TavilyClient(api_key=api_key)
            logger.info("Tavily client initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Tavily client: {e}")
    
    domain_weights = load_domain_weights()
    
    app.state.ml_models = ml_models
    app.state.tavily_client = tavily_client
    app.state.domain_weights = domain_weights
    
    yield
    
    # Shutdown
    app.state.ml_models.clear()
    app.state.tavily_client = None
```

**Error Handling:**
- If NLI model fails to load: log error, set to None, continue (graceful degradation)
- If Tavily client fails to initialize: log warning, set to None, continue (graceful degradation)
- If domain weights fail to load: use predefined weights, log warning

### 2. Configuration Loader

**Purpose:** Load and validate domain trust scores from configuration files

**Responsibilities:**
- Load predefined domain weights
- Load additional weights from `data/domain_trust_scores.json`
- Merge configurations (file weights override predefined)
- Validate weight values (0.0-1.0 range)

**Implementation Pattern:**
```python
def load_domain_weights() -> Dict[str, float]:
    # Predefined weights
    weights = {
        "reuters.com": 0.95,
        "apnews.com": 0.95,
        "bbc.com": 0.92,
        "isro.gov.in": 0.96,
        "rbi.org.in": 0.97,
        "who.int": 0.93,
        "snopes.com": 0.85,
        "wikipedia.org": 0.60,
        "reddit.com": 0.25
    }
    
    # Load from file if exists
    try:
        with open("data/domain_trust_scores.json") as f:
            file_weights = json.load(f)
            weights.update(file_weights)
    except Exception as e:
        logger.warning(f"Could not load domain weights from file: {e}")
    
    # Validate weights
    for domain, weight in weights.items():
        if not (0.0 <= weight <= 1.0):
            logger.warning(f"Invalid weight for {domain}: {weight}, using 0.5")
            weights[domain] = 0.5
    
    return weights
```

**Default Weight:** 0.5 for unknown domains

### 3. Evidence Retriever

**Purpose:** Search for evidence from trusted domains using Tavily API

**Responsibilities:**
- Query Tavily API with claim text (max 350 chars)
- Restrict searches to predefined trusted domains
- Extract and structure search results
- Handle API failures gracefully
- Assign source weights based on domain

**Implementation Pattern:**
```python
async def get_ground_truth(claim: str, tavily_client, domain_weights) -> List[Dict]:
    if not tavily_client:
        return []
    
    try:
        # Truncate claim to 350 characters
        search_query = claim[:350]
        
        # Build include_domains parameter
        trusted_domains = list(domain_weights.keys())
        
        # Search with timeout
        results = await asyncio.wait_for(
            tavily_client.search(search_query, include_domains=trusted_domains),
            timeout=12.0
        )
        
        # Process results (limit to 5)
        evidence = []
        for result in results.get("results", [])[:5]:
            domain = extract_domain(result["url"])
            weight = domain_weights.get(domain, 0.5)
            
            evidence.append({
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "content": result.get("content", ""),
                "domain": domain,
                "trust_score": weight
            })
        
        return evidence
    
    except asyncio.TimeoutError:
        logger.error("Tavily API request timed out")
        return []
    except Exception as e:
        logger.error(f"Evidence retrieval failed: {e}")
        return []
```

**Timeout:** 12 seconds for Tavily API requests

**Result Limit:** 5 results maximum

**Domain Extraction:** Parse domain from URL using urllib.parse

### 4. NLI Verifier

**Purpose:** Apply Natural Language Inference to assess claim-evidence relationships

**Responsibilities:**
- Create claim-evidence pairs
- Truncate evidence to 1000 characters
- Run NLI model inference
- Map model outputs to normalized scores (0.0-1.0)
- Handle model unavailability

**Implementation Pattern:**
```python
def calculate_nli_scores(claim: str, evidence_list: List[Dict], nli_model) -> List[Dict]:
    if not nli_model:
        # Default scores when model unavailable
        return [
            {**ev, "nli_score": 0.5}
            for ev in evidence_list
        ]
    
    results = []
    for evidence in evidence_list:
        # Truncate evidence to 1000 characters
        evidence_text = evidence["content"][:1000]
        
        # Create pair for NLI model
        pair = [claim, evidence_text]
        
        # Run inference
        scores = nli_model.predict([pair])
        
        # Map labels: 0=contradiction(0.0), 1=entailment(1.0), 2=neutral(0.5)
        label = scores.argmax()
        label_to_score = {0: 0.0, 1: 1.0, 2: 0.5}
        nli_score = label_to_score.get(label, 0.5)
        
        results.append({
            **evidence,
            "nli_score": nli_score
        })
    
    return results
```

**Label Mapping:**
- 0 (Contradiction) → 0.0
- 1 (Entailment) → 1.0
- 2 (Neutral) → 0.5

**Evidence Truncation:** 1000 characters maximum

### 5. Truth Scorer

**Purpose:** Calculate final truth score based on weighted NLI verdicts and source reliability

**Responsibilities:**
- Calculate weighted average of NLI scores and source weights
- Normalize result to 1-100 range
- Handle edge cases (no sources, model unavailable)
- Log scoring details

**Implementation Pattern:**
```python
def calculate_truth_score(evidence_with_scores: List[Dict]) -> float:
    if not evidence_with_scores:
        return 50.0  # Default for no sources
    
    total_weighted_score = 0.0
    for evidence in evidence_with_scores:
        nli_score = evidence.get("nli_score", 0.5)
        source_weight = evidence.get("trust_score", 0.5)
        weighted_score = nli_score * source_weight
        total_weighted_score += weighted_score
        
        logger.debug(
            f"Domain: {evidence['domain']}, "
            f"NLI: {nli_score}, Weight: {source_weight}, "
            f"Weighted: {weighted_score}"
        )
    
    # Calculate average
    average_score = total_weighted_score / len(evidence_with_scores)
    
    # Normalize to 1-100 range
    truth_score = max(1.0, min(100.0, average_score * 100))
    
    return truth_score
```

**Formula:** `Score = Σ(NLI_Score × Source_Weight) / Total_Sources × 100`

**Range:** 1-100 (clamped)

**Default:** 50 (Uncertain) when no sources available

### 6. Verdict Classifier

**Purpose:** Classify truth score into categorical verdict

**Responsibilities:**
- Map truth score to verdict category
- Apply threshold logic

**Implementation Pattern:**
```python
def classify_verdict(truth_score: float) -> str:
    if truth_score < 40:
        return "False"
    elif truth_score <= 65:
        return "Uncertain"
    else:
        return "True"
```

**Thresholds:**
- < 40: "False"
- 40-65: "Uncertain"
- > 65: "True"

### 7. API Routes

#### POST /verify

**Request Schema (VerifyRequest):**
```python
class VerifyRequest(BaseModel):
    claim: str  # Required, non-empty
```

**Response Schema (VerifyResponse):**
```python
class VerifyResponse(BaseModel):
    truth_score: float  # 1-100
    verdict: str  # "True", "False", "Uncertain"
    supporting_sources: List[str]  # URLs
    sources: List[Dict]  # Detailed source info
    summary: str  # Human-readable summary
```

**Implementation Pattern:**
```python
@app.post("/verify")
async def verify_claim(request: VerifyRequest) -> VerifyResponse:
    claim = request.claim.strip()
    
    # Validate claim
    if not claim:
        return VerifyResponse(
            truth_score=50.0,
            verdict="Uncertain",
            supporting_sources=[],
            sources=[],
            summary="No claim provided for verification."
        )
    
    # Truncate to 5000 characters
    claim = claim[:5000]
    
    # Retrieve evidence
    evidence = await get_ground_truth(
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
    supporting_sources = [ev["url"] for ev in evidence_with_scores]
    
    # Generate summary
    summary = generate_summary(verdict, truth_score, len(evidence_with_scores))
    
    return VerifyResponse(
        truth_score=truth_score,
        verdict=verdict,
        supporting_sources=supporting_sources,
        sources=evidence_with_scores,
        summary=summary
    )
```

**Error Handling:**
- Empty claim → return default response (50, Uncertain)
- No sources → return default response (50, Uncertain)
- Model unavailable → return default response (50, Uncertain)
- Tavily API failure → return default response (50, Uncertain)

**HTTP Status:** Always 200 OK (graceful degradation)

#### POST /api/analyze (Legacy)

**Purpose:** Backward compatibility endpoint

**Implementation Pattern:**
```python
@app.post("/api/analyze")
async def analyze_legacy(request: Dict) -> VerifyResponse:
    # Map "text" field to "claim"
    claim = request.get("text", "")
    verify_request = VerifyRequest(claim=claim)
    return await verify_claim(verify_request)
```

### 8. CORS Configuration

**Implementation Pattern:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Data Models

### VerifyRequest
```python
class VerifyRequest(BaseModel):
    claim: str
```

### VerifyResponse
```python
class VerifyResponse(BaseModel):
    truth_score: float
    verdict: str
    supporting_sources: List[str]
    sources: List[Dict[str, Any]]
    summary: str
```

### Source Detail Structure
```python
{
    "title": str,
    "url": str,
    "content": str,
    "domain": str,
    "trust_score": float,
    "nli_score": float
}
```

## Performance Considerations

### Latency Budget (30-second SLA)

- Tavily API search: 12 seconds (timeout)
- NLI inference (5 sources): ~5 seconds
- Request validation & response formatting: ~1 second
- Buffer: 12 seconds

### Optimization Strategies

1. **Model Loading:** Load NLI model once at startup (not per-request)
2. **Async Processing:** Use FastAPI async/await for concurrent requests
3. **Result Limiting:** Cap evidence to 5 results to reduce NLI inference time
4. **Evidence Truncation:** Limit evidence text to 1000 chars to speed up inference
5. **Timeout Handling:** Fail fast on Tavily API timeout (12 seconds)

### Concurrency

- FastAPI handles concurrent requests natively with async/await
- NLI model and Tavily client are thread-safe (read-only during requests)
- Domain weights dictionary is immutable after initialization

## Error Handling Strategy

### Graceful Degradation

All errors result in HTTP 200 with default response (truth_score=50, verdict="Uncertain"):
- Missing TAVILY_API_KEY
- NLI model load failure
- Tavily API timeout or failure
- No evidence found
- Empty claim

### Logging

- **INFO:** Model initialization, Tavily client initialization
- **WARNING:** Configuration load failures, invalid domain weights
- **ERROR:** Model load failures, API request failures
- **DEBUG:** Per-source scoring details

## Security Considerations

1. **Input Validation:** Truncate claim to 5000 characters
2. **API Key Management:** Load TAVILY_API_KEY from .env (not hardcoded)
3. **CORS:** Allow all origins (frontend integration)
4. **Timeout Protection:** 12-second timeout on Tavily API requests

## Testing Strategy

### Unit Tests
- Configuration loader (valid/invalid weights)
- Verdict classifier (threshold logic)
- Truth score calculation (weighted average)
- NLI score mapping (label to score conversion)

### Integration Tests
- End-to-end verification flow
- Tavily API integration (with mocks)
- NLI model inference
- Error handling (missing API key, model failure)

### Property-Based Tests
- Truth score calculation: weighted average properties
- Verdict classification: threshold consistency
- Evidence processing: idempotence of truncation

## Deployment Considerations

1. **Environment Variables:** TAVILY_API_KEY must be set
2. **Model Download:** First startup will download NLI model (~500MB)
3. **CPU Requirement:** NLI model runs on CPU (no GPU required)
4. **Memory:** ~2GB for NLI model + application overhead
5. **Startup Time:** ~30-60 seconds (model download + initialization)

## Future Enhancements

1. Model caching to avoid re-download
2. Evidence caching for repeated claims
3. Batch verification endpoint
4. Custom domain weight configuration per request
5. Detailed explanation generation for verdicts
6. Multi-language support
