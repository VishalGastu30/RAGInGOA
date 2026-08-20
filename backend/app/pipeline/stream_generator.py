import json
import time
from typing import List, Dict, Any, Generator
from openai import OpenAI

from app.config import GROQ_API_KEY, GROQ_MODEL_NAME
from app.pipeline.stt import transcribe
from app.pipeline.query_processing import process_query
from app.pipeline.retrieval import retrieval_engine
from app.pipeline.rerank import reranker
from app.pipeline.guardrails import guardrail_a_retrieval_confidence, REFUSAL_MESSAGE

STREAM_SYSTEM_PROMPT = """You are a helpful assistant that answers questions using ONLY the provided context passages.
Rules:
1. Answer the question using ONLY information found in the context passages below.
2. If the context does not contain enough information to answer, you MUST refuse by replying exactly: "I don't have enough information in the provided dataset to answer that."
3. Keep your answer concise and factual.
4. Always respond in the same language as the question (if the question is in Hindi, answer in Hindi).
"""

def build_context(passages: List[Dict[str, Any]]) -> str:
    parts = []
    for i, p in enumerate(passages):
        chunk = p["chunk"]
        parts.append(f"[Passage {i+1} | id={chunk['chunk_id']}]\n{chunk['text']}")
    return "\n\n".join(parts)

def run_pipeline_stream(
    audio_base64: str = None,
    text: str = None,
    language_hint: str = None,
    strategy: str = None,
) -> Generator[str, None, None]:
    """
    Generator that yields SSE chunks:
    data: {"token": "..."}
    data: {"sources": [...], "timings_ms": {...}}
    """
    pipeline_start = time.perf_counter()
    timings = {}

    # 1. STT Stage
    transcript = ""
    if audio_base64:
        try:
            t0 = time.perf_counter()
            transcript = transcribe(audio_base64, language_hint)
            timings["stt"] = int((time.perf_counter() - t0) * 1000)
        except Exception as e:
            err_msg = f"Speech-to-text failed: {str(e)[:150]}"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"
            return
    elif text:
        transcript = text
        timings["stt"] = 0
    else:
        yield f"data: {json.dumps({'error': 'No input provided.'})}\n\n"
        return

    # Yield the transcript first so UI knows what was heard
    yield f"data: {json.dumps({'transcript': transcript})}\n\n"

    # 2. Query Processing
    clean_text, detected_lang = process_query(transcript)
    if not clean_text:
        yield f"data: {json.dumps({'error': 'Empty query after cleaning.'})}\n\n"
        return

    # 3. Retrieval Stage
    t0 = time.perf_counter()
    try:
        candidates = retrieval_engine.search(clean_text, top_k=20, final_k=20, strategy=strategy)
        timings["retrieval"] = int((time.perf_counter() - t0) * 1000)
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Retrieval failed: {str(e)[:100]}'})}\n\n"
        return

    # 4. Rerank Stage
    t0 = time.perf_counter()
    try:
        ranked = reranker.rerank(clean_text, candidates, top_k=5)
        timings["rerank"] = int((time.perf_counter() - t0) * 1000)
    except Exception:
        timings["rerank"] = 0
        ranked = candidates[:5]

    # 5. Guardrail A Check
    t_guard = time.perf_counter()
    passes_a, reason_a = guardrail_a_retrieval_confidence(ranked)
    timings["guardrails"] = int((time.perf_counter() - t_guard) * 1000)

    if not passes_a:
        # Refuse immediately
        yield f"data: {json.dumps({'token': REFUSAL_MESSAGE})}\n\n"
        timings["total"] = int((time.perf_counter() - pipeline_start) * 1000)
        yield f"data: {json.dumps({'sources': [], 'timings_ms': timings, 'refusal_reason': reason_a})}\n\n"
        return

    # 6. Stream Generation
    if not GROQ_API_KEY:
        yield f"data: {json.dumps({'token': 'Generation service unavailable.'})}\n\n"
        return

    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )
    context_str = build_context(ranked)
    user_msg = f"Context passages:\n{context_str}\n\nQuestion: {clean_text}"

    t_gen_start = time.perf_counter()
    try:
        response_stream = client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": STREAM_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
            max_tokens=512,
            stream=True,
        )

        for chunk in response_stream:
            token = chunk.choices[0].delta.content
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"

        timings["generation"] = int((time.perf_counter() - t_gen_start) * 1000)

    except Exception as e:
        yield f"data: {json.dumps({'error': f'Generation error: {str(e)[:100]}'})}\n\n"
        return

    # Final metadata
    timings["total"] = int((time.perf_counter() - pipeline_start) * 1000)
    detailed_sources = [
        {
            "chunk_id": r["chunk"]["chunk_id"],
            "text": r["chunk"]["text"],
            "strategy": r["chunk"]["strategy"],
            "score": float(r.get("combined_score", 0.0)),
        }
        for r in ranked
    ]
    yield f"data: {json.dumps({'sources': detailed_sources, 'timings_ms': timings})}\n\n"
