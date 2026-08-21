"""
Orchestrator: runs the full stage pipeline with timing, error handling, and fallbacks.
"""
import time
from typing import Dict, Any, Optional

from app.pipeline.stt import transcribe
from app.pipeline.query_processing import process_query
from app.pipeline.semantic_cache import semantic_cache
from app.pipeline.retrieval import retrieval_engine
from app.pipeline.rerank import reranker
from app.pipeline.guardrails import (
    guardrail_a_retrieval_confidence,
    guardrail_b_grounding_check,
    REFUSAL_MESSAGE,
)
from app.pipeline.generation import generate_answer
from app.db.logging_db import log_query


def _ms(start: float, end: float) -> int:
    return int((end - start) * 1000)


def run_pipeline(
    audio_base64: Optional[str] = None,
    text: Optional[str] = None,
    language_hint: Optional[str] = None,
    strategy: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full pipeline: STT → query processing → cache → retrieval → rerank →
    guardrail A → generation → guardrail B → cache write → response.
    """
    pipeline_start = time.perf_counter()
    timings: Dict[str, int] = {}

    # ── 1. STT Stage ──
    transcript = ""
    if audio_base64:
        try:
            t0 = time.perf_counter()
            transcript = transcribe(audio_base64, language_hint)
            timings["stt"] = _ms(t0, time.perf_counter())
        except Exception as e:
            timings["stt"] = _ms(t0, time.perf_counter())
            timings["total"] = _ms(pipeline_start, time.perf_counter())
            return _error_response(
                f"Speech-to-text failed: {str(e)[:150]}",
                transcript="",
                timings=timings,
            )
    elif text:
        transcript = text
        timings["stt"] = 0
    else:
        timings["total"] = 0
        return _error_response(
            "No audio or text input provided.",
            transcript="",
            timings=timings,
        )

    # ── 2. Query Processing ──
    clean_text, detected_lang = process_query(transcript)
    if not clean_text:
        timings["total"] = _ms(pipeline_start, time.perf_counter())
        return _error_response("Empty query after processing.", transcript=transcript, timings=timings)

    # ── 3. Semantic Cache Lookup ──
    t0 = time.perf_counter()
    query_embedding = retrieval_engine.embed_query(clean_text)
    cache_result = semantic_cache.lookup(query_embedding, clean_text)
    cache_time = _ms(t0, time.perf_counter())

    if cache_result:
        timings["retrieval"] = 0
        timings["rerank"] = 0
        timings["generation"] = 0
        timings["guardrails"] = cache_time
        timings["total"] = _ms(pipeline_start, time.perf_counter())

        cache_sources = cache_result.get("sources", [])
        detailed_cache_sources = []
        for src in cache_sources:
            if isinstance(src, dict):
                detailed_cache_sources.append(src)
            elif isinstance(src, str):
                chunk = retrieval_engine.chunk_map.get(src)
                if chunk:
                    detailed_cache_sources.append({
                        "chunk_id": src,
                        "text": chunk["text"],
                        "strategy": chunk["strategy"],
                        "score": 1.0,
                    })
                else:
                    detailed_cache_sources.append({
                        "chunk_id": src,
                        "text": "Cached passage content",
                        "strategy": "hybrid",
                        "score": 1.0,
                    })

        log_query(
            query_text=clean_text,
            answered=True,
            refusal_reason=None,
            cache_hit=True,
            answer=cache_result["answer"],
            sources=[s if isinstance(s, str) else s.get("chunk_id") for s in cache_sources],
            timings=timings,
        )

        return {
            "transcript": transcript,
            "answer": cache_result["answer"],
            "answered": True,
            "refusal_reason": None,
            "sources": detailed_cache_sources,
            "cache_hit": True,
            "timings_ms": timings,
        }

    # ── 4. Retrieval Stage ──
    try:
        t0 = time.perf_counter()
        candidates = retrieval_engine.search(clean_text, top_k=20, final_k=20, strategy=strategy)
        timings["retrieval"] = _ms(t0, time.perf_counter())
    except Exception as e:
        timings["retrieval"] = _ms(t0, time.perf_counter())
        timings["total"] = _ms(pipeline_start, time.perf_counter())
        return _error_response(f"Retrieval failed: {str(e)[:150]}", transcript=transcript, timings=timings)

    # ── 5. Rerank Stage ──
    try:
        t0 = time.perf_counter()
        ranked = reranker.rerank(clean_text, candidates, top_k=5)
        timings["rerank"] = _ms(t0, time.perf_counter())
    except Exception:
        # Fallback: skip rerank, use top 5 from retrieval
        timings["rerank"] = 0
        ranked = candidates[:5]

    # ── 6. Guardrail A — Retrieval Confidence ──
    t_guard_start = time.perf_counter()
    passes_a, reason_a = guardrail_a_retrieval_confidence(ranked)
    if not passes_a:
        timings["guardrails"] = _ms(t_guard_start, time.perf_counter())
        timings["generation"] = 0
        timings["total"] = _ms(pipeline_start, time.perf_counter())

        log_query(
            query_text=clean_text,
            answered=False,
            refusal_reason=reason_a,
            cache_hit=False,
            answer=REFUSAL_MESSAGE,
            sources=[],
            timings=timings,
            top_retrieval_score=ranked[0].get("rerank_score", 0) if ranked else 0,
        )

        return {
            "transcript": transcript,
            "answer": REFUSAL_MESSAGE,
            "answered": False,
            "refusal_reason": reason_a,
            "sources": [],
            "cache_hit": False,
            "timings_ms": timings,
        }

    # ── 7. Generation Stage ──
    try:
        t_gen = time.perf_counter()
        generated = generate_answer(clean_text, ranked)
        timings["generation"] = _ms(t_gen, time.perf_counter())
    except Exception as e:
        timings["generation"] = _ms(t_gen, time.perf_counter())
        timings["total"] = _ms(pipeline_start, time.perf_counter())
        return _error_response(
            f"Generation failed: {str(e)[:150]}",
            transcript=transcript,
            timings=timings,
        )

    # ── 8. Guardrail B — Grounding Check ──
    passes_b, reason_b = guardrail_b_grounding_check(generated)
    timings["guardrails"] = _ms(t_guard_start, time.perf_counter())

    if not passes_b:
        timings["total"] = _ms(pipeline_start, time.perf_counter())

        log_query(
            query_text=clean_text,
            answered=False,
            refusal_reason=reason_b,
            cache_hit=False,
            answer=REFUSAL_MESSAGE,
            sources=[],
            timings=timings,
        )

        return {
            "transcript": transcript,
            "answer": REFUSAL_MESSAGE,
            "answered": False,
            "refusal_reason": reason_b,
            "sources": [],
            "cache_hit": False,
            "timings_ms": timings,
        }

    # ── 9. Cache Write & Final Response ──
    answer_text = generated.get("answer", "")
    source_ids = generated.get("sources", [])

    detailed_sources = []
    for r in ranked:
        chunk = r["chunk"]
        if not source_ids or chunk["chunk_id"] in source_ids:
            detailed_sources.append({
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "strategy": chunk["strategy"],
                "score": float(r.get("combined_score", 0.0)),
            })

    semantic_cache.write(query_embedding, clean_text, answer_text, detailed_sources)

    timings["total"] = _ms(pipeline_start, time.perf_counter())

    log_query(
        query_text=clean_text,
        answered=True,
        refusal_reason=None,
        cache_hit=False,
        answer=answer_text,
        sources=source_ids,
        timings=timings,
        top_retrieval_score=ranked[0].get("rerank_score", 0) if ranked else 0,
    )

    return {
        "transcript": transcript,
        "answer": answer_text,
        "answered": True,
        "refusal_reason": None,
        "sources": detailed_sources,
        "cache_hit": False,
        "timings_ms": timings,
    }


def _error_response(message: str, transcript: str, timings: Dict[str, int]) -> Dict[str, Any]:
    return {
        "transcript": transcript,
        "answer": message,
        "answered": False,
        "refusal_reason": message,
        "sources": [],
        "cache_hit": False,
        "timings_ms": timings,
    }
