from pydantic import BaseModel
from typing import List, Optional

class AnalyzeRequest(BaseModel):
    text: str

class Source(BaseModel):
    url: str
    title: str
    content: str
    trust_score: float

class AnalyzeResponse(BaseModel):
    truth_score: int
    summary: str
    sources: List[Source]
