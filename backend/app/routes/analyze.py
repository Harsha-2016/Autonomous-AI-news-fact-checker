from fastapi import APIRouter
from ..models.schemas import AnalyzeRequest, AnalyzeResponse, Source
from ..services.evidence_retriever import search_tavily
from ..services.nli_verifier import verify_claim
from ..services.truth_scorer import calculate_truth_score

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_claim(request: AnalyzeRequest):
    claim = request.text
    if not claim.strip():
        return AnalyzeResponse(truth_score=0, summary="Empty claim provided.", sources=[])
        
    # 1. Retrieve evidence
    results = search_tavily(claim)
    
    if not results:
        return AnalyzeResponse(truth_score=50, summary="No verifiable sources found to confirm or deny this claim.", sources=[])
    
    # 2. Verify against each source
    verdicts_and_trust = []
    sources = []
    
    for res in results:
        # Pass a subset of content to NLI to keep inference fast
        content = res["content"][:1500] 
        verdict = verify_claim(claim, content)
        verdicts_and_trust.append((verdict, res["trust_score"]))
        
        sources.append(Source(
            url=res["url"],
            title=res["title"],
            content=content[:250] + "..." if len(content) > 250 else content,
            trust_score=res["trust_score"]
        ))
        
    # 3. Calculate score
    truth_score = calculate_truth_score(verdicts_and_trust)
    
    return AnalyzeResponse(
        truth_score=truth_score,
        summary=f"Analyzed {len(sources)} sources across the web to gauge the validity of this topic.",
        sources=sources
    )
