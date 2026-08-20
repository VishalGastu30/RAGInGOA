from pydantic import BaseModel
from typing import List, Optional, Dict

class AskRequest(BaseModel):
    audio_base64: Optional[str] = None
    text: Optional[str] = None
    language_hint: Optional[str] = None
    strategy: Optional[str] = None

class Timings(BaseModel):
    stt: Optional[int] = 0
    retrieval: Optional[int] = 0
    rerank: Optional[int] = 0
    generation: Optional[int] = 0
    guardrails: Optional[int] = 0
    total: Optional[int] = 0

class AskResponse(BaseModel):
    transcript: str
    answer: str
    answered: bool
    refusal_reason: Optional[str] = None
    sources: List[Dict] = []
    cache_hit: bool = False
    timings_ms: Timings
