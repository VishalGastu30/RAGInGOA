"""
FastAPI app — route definitions for the Voice RAG system.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import AskRequest, AskResponse
from app.pipeline.retrieval import retrieval_engine
from app.pipeline.rerank import reranker
from app.pipeline.orchestrator import run_pipeline
from app.pipeline.stream_generator import run_pipeline_stream
from app.pipeline.generation import translate_to_english
from app.db.logging_db import init_db, get_recent_logs
from app.config import BACKEND_PORT
from app.pipeline.stt import transcribe as stt_transcribe
import time


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy models once at startup."""
    print("[startup] Initialising database …")
    init_db()
    print("[startup] Loading retrieval engine …")
    retrieval_engine.load()
    print("[startup] Loading reranker …")
    reranker.load()
    print("[startup] All models loaded — ready to serve.")
    yield


app = FastAPI(
    title="Voice RAG — HH Goa 2026",
    description="Voice-first RAG system over MSMARCO-XI",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ───────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/ask")
def ask(req: AskRequest):
    result = run_pipeline(
        audio_base64=req.audio_base64,
        text=req.text,
        language_hint=req.language_hint,
        strategy=req.strategy,
    )
    return result


@app.post("/api/ask-stream")
def ask_stream(req: AskRequest):
    generator = run_pipeline_stream(
        audio_base64=req.audio_base64,
        text=req.text,
        language_hint=req.language_hint,
        strategy=req.strategy,
    )
    return StreamingResponse(generator, media_type="text/event-stream")


@app.get("/api/guardrail-log")
def guardrail_log(limit: int = 20):
    logs = get_recent_logs(limit=limit)
    return {"logs": logs}


@app.get("/api/latency-stats")
def latency_stats():
    """
    Return aggregate latency stats from the last N queries in the log.
    """
    import json
    logs = get_recent_logs(limit=200)

    retrieval_times = []
    rerank_times = []
    total_times = []

    for log in logs:
        t = log.get("timings", {})
        if isinstance(t, str):
            t = json.loads(t)
        if t.get("retrieval"):
            retrieval_times.append(t["retrieval"])
        if t.get("rerank"):
            rerank_times.append(t["rerank"])
        if t.get("total"):
            total_times.append(t["total"])

    def percentiles(data):
        if not data:
            return {"p50": 0, "p70": 0, "p90": 0, "p100": 0}
        s = sorted(data)
        n = len(s)
        return {
            "p50": s[int(n * 0.5)] if n > 0 else 0,
            "p70": s[int(n * 0.7)] if n > 0 else 0,
            "p90": s[int(n * 0.9)] if n > 0 else 0,
            "p100": s[-1] if n > 0 else 0,
        }

    return {
        "sample_count": len(logs),
        "retrieval_ms": percentiles(retrieval_times),
        "rerank_ms": percentiles(rerank_times),
        "retrieval_plus_rerank_ms": percentiles(
            [r + rr for r, rr in zip(retrieval_times, rerank_times)]
            if retrieval_times and rerank_times and len(retrieval_times) == len(rerank_times)
            else []
        ),
        "total_ms": percentiles(total_times),
    }


class TranslateRequest(BaseModel):
    text: str


@app.post("/api/translate")
async def translate_endpoint(request: TranslateRequest):
    translated = translate_to_english(request.text)
    return {"translated": translated}


class TranscribeRequest(BaseModel):
    audio_base64: str
    language_hint: str = None


@app.post("/api/transcribe")
def transcribe_endpoint(req: TranscribeRequest):
    t0 = time.time()
    try:
        text = stt_transcribe(req.audio_base64, req.language_hint)
        duration = int((time.time() - t0) * 1000)
        return {"transcript": text, "stt_ms": duration}
    except Exception as e:
        return {"transcript": f"Error transcribing: {str(e)}", "stt_ms": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
