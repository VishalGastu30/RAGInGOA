# PLAN.md — Voice-Enabled RAG System (HH Goa 2026, Task 2)

This document is the full build spec for an AI coding agent (Antigravity). Follow it in order. Do not skip the guardrail, latency-measurement, or harness sections — they are graded requirements, not optional polish.

---

## 1. What we are building

A **voice-first RAG (Retrieval-Augmented Generation) system**. A user speaks a question into a browser, the system:

1. Transcribes speech to text (Sarvam STT)
2. Retrieves relevant passages from the **MSMARCO-XI** dataset using a hybrid, multi-strategy retrieval pipeline
3. Sends the retrieved context + question to an LLM (Groq) to generate a grounded answer
4. Runs the answer through guardrails (off-topic check, retrieval-confidence check, grounding check) before returning it
5. Refuses to answer ("I don't have enough information") when the dataset doesn't support an answer, instead of hallucinating

The system must be measurably fast, must report real latency statistics (P50/P70/P100), must be built as a proper orchestrated pipeline (not one giant function), and must be deployed as a live, working website.

### Official task requirements (must all be satisfied)
- [ ] Voice input via Sarvam **or** ElevenLabs (we are using **Sarvam**)
- [ ] Chunking strategy is **multi-method**, not a single fixed-size split
- [ ] Chunking + vector DB retrieval completes in **under 200ms** (see §8 for exact scope of this claim)
- [ ] Report real **P50 / P70 / P100** latency numbers from a batch test, not a single cherry-picked run
- [ ] System runs inside a **harness** — structured orchestration, not a single raw prompt-in/text-out call
- [ ] System has **guardrails** — off-topic detection, hallucination/grounding checks, and visible refusal behavior
- [ ] GitHub repo, live working link, 2 short videos, promotion posts with `#RAGInGoa`

### Our specific differentiators (build these — they're what separates us from a baseline submission)
1. **Semantic cache** — near-duplicate questions get an instant cached answer instead of re-running the full pipeline. This directly attacks the 200ms constraint with a provable mechanism, not just optimization.
2. **Honest stage-by-stage latency breakdown** — we show STT time, retrieval time, generation time, and guardrail time separately in the demo UI, rather than making a single vague "under 200ms" claim that falls apart under a follow-up question.
3. **Real retrieval accuracy number** — evaluate retrieval against MSMARCO-XI's labeled correct passages across ~200 held-out questions (e.g. "correct passage in top-5 87% of the time"), not just a live demo vibe-check.
4. **Hindi / code-mixed ("Hinglish") demo queries** — MSMARCO-XI is Indic and Sarvam supports Indian languages; most competing teams will only demo in English. We show at least 2 non-English or code-mixed queries working end to end.
5. **Visible guardrail log** — a running trace of every question asked, whether the system answered or refused, and why, shown live in the demo.

---

## 2. High-level architecture

```
                          🎤 USER (browser, mic button)
                                    │
                          Frontend (Vercel — React)
                                    │  HTTPS request (audio blob)
                                    ▼
                    Backend (Render/Railway — FastAPI, always-on)
                                    │
        ┌───────────────────────────────────────────────────────┐
        │                     ORCHESTRATOR                       │
        │                                                        │
        │   1. STT Stage        → Sarvam API → transcript        │
        │   2. Query Stage      → clean/validate/detect lang     │
        │   3. Cache Stage      → semantic cache lookup           │
        │        │hit → skip to step 6 with cached answer         │
        │        │miss → continue                                │
        │   4. Retrieval Stage  → vector search + BM25 → merge   │
        │   5. Rerank Stage     → cross-encoder → top-k passages │
        │   6. Guardrail A      → relevance threshold check       │
        │        │below threshold → REFUSE, return early         │
        │   7. Generation Stage → Groq LLM → structured JSON     │
        │   8. Guardrail B      → grounding/hallucination check  │
        │        │not grounded → REFUSE, return early             │
        │   9. Cache write      → store question+answer vector   │
        │  10. Response         → JSON with answer + timings     │
        └───────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          Frontend renders answer +
                          latency breakdown + sources
```

Each numbered stage is its own function/module with its own try/except, timeout, and fallback — this satisfies the "harness" requirement. Nothing is a single monolithic call.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite) | Free, fast, simple deploy to Vercel |
| Frontend hosting | Vercel | Free tier, great for static/React frontends |
| Backend framework | FastAPI (Python) | Async support, easy structured request/response, fast to build |
| Backend hosting | Render **or** Railway | Free tier that stays running (unlike Vercel serverless, which can't hold FAISS in memory reliably) |
| Speech-to-text | Sarvam (Saaras) | Indic-language and code-mixed speech support |
| LLM (generation) | Groq (Llama 3.x or similar, via Groq API) | OpenAI-compatible API, very fast inference, supports structured/JSON output |
| Vector DB | FAISS (in-memory) | Free, local, no network hop — critical for the 200ms retrieval target |
| Keyword search | `rank_bm25` (Python) | Free, simple, complements vector search for exact-term queries |
| Embeddings | A free multilingual sentence-embedding model (e.g. `sentence-transformers` multilingual MiniLM or similar), run locally | Free, no per-call cost, fast enough to precompute offline |
| Reranker | Lightweight cross-encoder (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`), local | Free, improves top-k precision over raw similarity scores |
| Logging/analytics DB | SQLite | Zero-setup, file-based, free — good enough for latency logs and guardrail traces. **Not** used in the hot retrieval path. |
| Dataset | `ai4bharat/MSMARCO-XI` (Hugging Face) | Provided by the task |
| Repo hosting | GitHub | Required deliverable |

**Explicitly avoid:** paid vector DBs (Pinecone, etc.), paid embedding APIs (OpenAI embeddings), paid hosting tiers. Everything above has a $0 tier sufficient for this project.

---

## 4. Repository structure

```
voice-rag-goa/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, route definitions
│   │   ├── config.py                # env vars, constants, thresholds
│   │   ├── pipeline/
│   │   │   ├── orchestrator.py      # runs the full stage pipeline, timing, error handling
│   │   │   ├── stt.py               # Sarvam STT wrapper
│   │   │   ├── query_processing.py  # clean text, detect language, validate
│   │   │   ├── semantic_cache.py    # cache lookup/write logic
│   │   │   ├── retrieval.py         # vector search + BM25 + merge
│   │   │   ├── rerank.py            # cross-encoder reranking
│   │   │   ├── generation.py        # Groq call, prompt template, structured output parsing
│   │   │   └── guardrails.py        # relevance threshold + grounding check
│   │   ├── indexing/
│   │   │   ├── build_index.py       # one-time offline script: dataset → chunks → embeddings → FAISS index
│   │   │   ├── chunking.py          # multi-strategy chunkers (small/medium/large/semantic)
│   │   │   └── metadata.py          # chunk metadata schema
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic request/response models
│   │   └── db/
│   │       └── logging_db.py        # SQLite logging (queries, timings, guardrail decisions)
│   ├── scripts/
│   │   ├── run_latency_benchmark.py # runs N test queries, computes P50/P70/P100
│   │   └── evaluate_retrieval.py    # measures retrieval accuracy vs. dataset ground truth
│   ├── data/
│   │   ├── raw/                     # downloaded MSMARCO-XI
│   │   └── index/                   # built FAISS index + chunk metadata (generated, gitignored if large)
│   ├── requirements.txt
│   └── Dockerfile                   # optional, for Render/Railway deploy consistency
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── MicButton.jsx
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── LatencyDashboard.jsx  # shows STT/retrieval/generation/guardrail timings live
│   │   │   └── GuardrailLog.jsx      # shows recent answer/refuse decisions + reasons
│   │   ├── api/
│   │   │   └── client.js             # calls to backend endpoint
│   │   └── main.jsx
│   ├── package.json
│   └── vercel.json
│
├── README.md                         # setup instructions, architecture summary, latency results, demo links
├── PLAN.md                           # this file
└── .env.example
```

---

## 5. Dataset preparation (`indexing/`)

1. Download `ai4bharat/MSMARCO-XI` from Hugging Face.
2. Inspect fields: queries, answers, passages, language, query_type, query_id, passage_id (confirm exact field names once downloaded — the agent should print `.features` and a few sample rows before writing the parsing code).
3. Clean text: strip HTML artifacts, normalize whitespace, drop empty/duplicate passages.
4. Persist a normalized intermediate file (e.g. `data/raw/passages.jsonl`) with fields: `passage_id, text, language, source_query_ids`.

### Chunking strategy — must be multi-method (graded requirement)

Build **three parallel chunk sets** from the same passages, each stored with metadata tagging which strategy produced it:

| Strategy | Size | Purpose |
|---|---|---|
| Small chunks | ~1–2 sentences / ~50–100 tokens | Precise factual lookups ("What year did X happen?") |
| Medium/fixed chunks | ~150–300 tokens, with ~20% overlap between neighbors | General-purpose default |
| Semantic chunks | Variable length, split at topic/meaning boundaries (e.g. using embedding-similarity drops between sentences, or a simple sentence-window + similarity-threshold merge) | Broader "explain X" questions needing more context |

Each chunk record stores metadata: `chunk_id, passage_id, strategy ("small"/"medium"/"semantic"), language, query_type (if inheritable), text, token_count`.

Build **one FAISS index per strategy** (or one combined index with a `strategy` filter field — pick whichever is simpler to implement correctly; a combined index with metadata filtering is preferred if time allows).

### Embeddings & index build
1. Load a free multilingual sentence-embedding model locally.
2. Precompute embeddings for every chunk in every strategy (**this happens offline, once**, not at query time — this is what makes the 200ms target achievable).
3. Build a FAISS index (flat or IVF, whichever is fast enough for the dataset size — start with flat for correctness, switch to IVF only if the dataset is large enough to need it).
4. Build a parallel BM25 index over the same chunk text for keyword search.
5. Save both indexes + chunk metadata to `data/index/` so the backend loads them once at startup and keeps them in memory.

---

## 6. Retrieval pipeline (`pipeline/retrieval.py`, `pipeline/rerank.py`)

```
query text
    │
    ├──► vector search (FAISS, top ~20)
    │
    └──► BM25 keyword search (top ~20)
    │
    ▼
merge + dedupe candidates
    │
    ▼
cross-encoder reranker scores each candidate against the query
    │
    ▼
top 3–5 passages returned, with scores
```

- Query-time strategy selection: use simple heuristics (query length, presence of question words like "what/why/how", presence of quoted exact terms) to decide whether to weight small/medium/semantic chunks more heavily for this query. Keep this heuristic simple and explainable — this is a talking point for the demo, not a place to over-engineer.
- Retrieval must run entirely in-memory. No network calls in this stage.
- Return each passage with its similarity/rerank score — these scores feed Guardrail A (§8).

---

## 7. Semantic cache (`pipeline/semantic_cache.py`) — differentiator #1

Purpose: near-duplicate questions should skip the full pipeline and return instantly.

1. On each incoming query, embed it (same embedding model as chunking).
2. Compare against a small in-memory store of `{question_embedding, question_text, final_answer, sources}` from recent queries.
3. If cosine similarity to the closest cached question is above a high threshold (e.g. 0.92 — tune empirically), return the cached answer immediately, skip retrieval/generation/guardrails, and mark the response as `"cache_hit": true`.
4. If no close match, run the full pipeline, and on success, write the new question+answer into the cache.
5. Cache can be a simple in-memory Python list/dict for the hackathon scope (persistence not required, but a SQLite-backed version is a nice-to-have if time allows).
6. **Important for the demo:** log and visibly show cache hits vs. misses and their respective latencies — this is the clearest proof that the cache works.

---

## 8. Latency: what "under 200ms" actually covers

Be precise and honest about this in the README and demo — do not claim end-to-end voice-to-answer is under 200ms, because that is not achievable once a real LLM API call is included.

**Scope of the 200ms claim:** chunking + vector DB retrieval + reranking (i.e., pipeline stages 4–5 in §2), measured from "transcript already available" to "top-k passages selected."

**What we report separately, honestly, stage by stage:**
```
Speech-to-text (Sarvam):        ~X ms   (not claimed under 200ms)
Retrieval + rerank (our target): ~Y ms  ← this is what we claim <200ms, and prove it
LLM generation (Groq):           ~Z ms  (not claimed under 200ms)
Guardrail checks:                ~W ms
Total end-to-end:                sum
```

Showing this breakdown, unprompted, in the demo video and README is one of our differentiators — it's more convincing than a vague blanket claim.

### Benchmark script (`scripts/run_latency_benchmark.py`)
1. Take a test set of at least 100–200 questions (sample from MSMARCO-XI queries; include a handful of intentionally off-topic questions to also test guardrail latency).
2. For each question, run the pipeline with transcript already provided (i.e., skip STT for this specific benchmark, since STT depends on external audio/network and isn't the part being measured for the 200ms claim).
3. Record wall-clock time for each stage separately per query.
4. Compute P50, P70, P100 (and ideally P90/P99 as bonus) for the retrieval+rerank stage specifically, and also report them for full pipeline latency as a secondary, clearly-labeled number.
5. Output results to a JSON/CSV file and a simple summary printed to console, formatted like:
```
Retrieval+Rerank latency (ms):  P50=42   P70=58   P90=87   P100=134
Full pipeline latency (ms):     P50=612  P70=740  P90=920  P100=1450
```
6. This script's output feeds directly into the frontend's `LatencyDashboard` component and the README.

### `scripts/evaluate_retrieval.py` — differentiator #3
1. Use MSMARCO-XI's labeled query→correct-passage pairs (a held-out sample, ~200 queries).
2. For each query, run retrieval and check whether the correct passage appears in the top-5 returned results.
3. Report: `Top-5 retrieval accuracy: XX%`. Also break this down by chunk strategy if time allows (does semantic chunking outperform fixed-size on certain query types?).

---

## 9. Generation stage (`pipeline/generation.py`)

- Call Groq's chat completions API (OpenAI-compatible).
- System prompt instructs: answer **only** using the provided context; if the context is insufficient, explicitly say so rather than guessing.
- Request **structured output** (JSON), e.g.:
```json
{
  "answer": "string",
  "grounded": true,
  "confidence": 0.91,
  "sources": ["passage_123", "passage_456"]
}
```
- Set a reasonable timeout (e.g. 5s) with a fallback response ("The answer service is temporarily unavailable, please try again") if Groq times out or errors — this is part of the harness requirement.
- Keep the prompt and injected context as short as possible (top 3–5 passages only) to keep generation fast and cheap.

---

## 10. Guardrails (`pipeline/guardrails.py`) — graded requirement

Two checks, run at two different points in the pipeline:

**Guardrail A — Retrieval confidence check (runs before generation)**
- If the top retrieved passage's similarity/rerank score is below a set threshold, skip the LLM call entirely and return: `"I don't have enough information in the provided dataset to answer that."`
- This also protects latency — we avoid an unnecessary Groq call when we already know the answer won't be dataset-grounded.

**Guardrail B — Grounding / hallucination check (runs after generation)**
- After Groq generates an answer, verify that its claims are actually supported by the retrieved passages. Two acceptable approaches, pick one based on time budget:
  - **Simple/fast:** trust the `"grounded"` and `"confidence"` fields Groq itself returns via structured output, and reject if `grounded: false` or `confidence` below a threshold.
  - **More rigorous:** a second, lightweight LLM call (or even a keyword/entailment heuristic) that checks the generated answer's key claims against the retrieved context independently.
- If not grounded, replace the answer with the refusal message and log why.

**Off-topic detection**
- Can be folded into Guardrail A: if the best retrieval score is very low, the query is very likely off-topic relative to the dataset (e.g. "capital of India" against a dataset that doesn't cover it). No separate model needed unless time allows a dedicated classifier.

**Logging (differentiator #5)**
- Every decision (answered / refused, and why) gets written to the SQLite logging DB with timestamp, query text, decision, and relevant scores.
- Frontend's `GuardrailLog` component polls or fetches recent entries and displays them live during the demo.

---

## 11. Harness / orchestration (`pipeline/orchestrator.py`)

- One function coordinates all stages in order, each wrapped individually in try/except with a defined timeout and fallback:
```
run_pipeline(audio_or_text_input):
    try: transcript = stt_stage(...)          except -> return error, stage="stt"
    try: clean_query = query_processing(...)  except -> return error, stage="query"
    cache_result = semantic_cache.lookup(clean_query)
    if cache_result: return cache_result with cache_hit=True

    try: candidates = retrieval_stage(...)    except -> return error, stage="retrieval"
    try: ranked = rerank_stage(...)           except -> ranked = candidates (fallback: skip rerank, don't fail)

    if guardrail_a_below_threshold(ranked): return refusal

    try: generated = generation_stage(...)    except -> return fallback message, stage="generation"

    if not guardrail_b_passes(generated, ranked): return refusal

    semantic_cache.write(clean_query, generated)
    log_to_db(...)
    return final_response_with_timings
```
- Every stage's duration is measured (`time.perf_counter()` before/after) and included in the final response JSON under a `timings` object — this feeds the frontend dashboard directly.
- No single giant function does everything — each stage is independently testable.

---

## 12. Backend API contract (`app/main.py`, `models/schemas.py`)

### `POST /api/ask`
**Request:**
```json
{
  "audio_base64": "string, optional — raw audio if using voice",
  "text": "string, optional — used if text input is provided instead of audio (useful for testing/benchmarking)",
  "language_hint": "string, optional"
}
```
(Exactly one of `audio_base64` or `text` should be provided.)

**Response:**
```json
{
  "transcript": "string",
  "answer": "string",
  "answered": true,
  "refusal_reason": null,
  "sources": ["passage_123", "passage_456"],
  "cache_hit": false,
  "timings_ms": {
    "stt": 410,
    "retrieval": 38,
    "rerank": 12,
    "generation": 540,
    "guardrails": 4,
    "total": 1004
  }
}
```

### `GET /api/latency-stats`
Returns the latest benchmark results (P50/P70/P100 for retrieval and full pipeline) for the frontend dashboard.

### `GET /api/guardrail-log?limit=20`
Returns the most recent N logged decisions (answered/refused + reason) for the frontend guardrail log panel.

### `GET /api/health`
Basic health check — also useful for a keep-alive ping to prevent the Render/Railway free tier from sleeping (see §13).

---

## 13. Frontend (`frontend/`)

**Pages/components:**
- `MicButton` — press-and-hold or tap-to-record, sends audio to backend.
- `ChatWindow` — shows conversation: user's transcribed question, system's answer or refusal.
- `LatencyDashboard` — live/last-run display of stage-by-stage timings (from `timings_ms` in the response, and from `/api/latency-stats` for the aggregate P50/P70/P100 view). This is a key demo visual.
- `GuardrailLog` — shows recent answer/refuse decisions with reasons, polling `/api/guardrail-log`.

**UX flow:**
1. User taps mic, speaks question.
2. Audio sent to backend `/api/ask`.
3. While waiting, show a loading state that reflects pipeline stage if possible (nice-to-have: stream stage-by-stage via WebSocket or SSE so the UI shows "Transcribing → Searching → Thinking → Checking" live; acceptable fallback: single loading spinner, show timings only after response returns).
4. Render answer, sources, cache-hit indicator, and per-stage timings.
5. Update the guardrail log and latency dashboard panels.

**Also support text input** (not just voice) as a fallback/testing path — makes the benchmark scripts and demo more robust if the mic has issues live.

---

## 14. Deployment

- **Frontend → Vercel.** Connect GitHub repo, auto-deploy on push. Set backend URL as an environment variable (`VITE_BACKEND_URL`).
- **Backend → Render or Railway** (pick one; Render is a reasonable default). Must be a persistent service (not serverless functions) so the FAISS index and embedding model stay loaded in memory between requests — this is essential for the 200ms retrieval claim to hold on live requests, not just in local benchmarks.
- On backend startup: load FAISS index, BM25 index, chunk metadata, embedding model, and reranker model into memory **once**, before accepting requests.
- **Keep-alive:** free tiers on Render/Railway sleep after inactivity, and cold start can take 10–30 seconds. Set up a simple external ping (e.g. a free uptime-monitoring service, or a scheduled ping from the frontend/a cron job) hitting `/api/health` every few minutes. Regardless, manually "wake" the backend a minute or two before recording the demo video or before judges are expected to test the live link.
- Submit the **Vercel link** as the "live working link" per the task's submission form; ensure the backend is awake and reachable when that link is tested.

---

## 15. Environment variables (`.env.example`)

```
SARVAM_API_KEY=
GROQ_API_KEY=
BACKEND_PORT=8000
VECTOR_INDEX_PATH=./data/index
LOG_DB_PATH=./data/logs.db
RETRIEVAL_SCORE_THRESHOLD=0.35
CACHE_SIMILARITY_THRESHOLD=0.92
```
(Agent: adjust threshold values empirically once real data is indexed — these are starting points, not final values.)

---

## 16. Build order / phases (target: 5 remaining days before Aug 22 deadline)

| Phase | Work | Target day |
|---|---|---|
| 1 | Download + inspect MSMARCO-XI, build cleaned passage set | Day 1 |
| 2 | Implement multi-strategy chunking + build FAISS + BM25 indexes offline | Day 1–2 |
| 3 | Basic retrieval pipeline (vector + BM25 + merge, no rerank yet) working via a text-only `/api/ask` | Day 2 |
| 4 | Add reranker, add Groq generation stage with structured output | Day 2–3 |
| 5 | Add guardrails A & B, add SQLite logging | Day 3 |
| 6 | Add Sarvam STT, wire up voice input end to end | Day 3 |
| 7 | Add semantic cache | Day 3–4 |
| 8 | Run `run_latency_benchmark.py` and `evaluate_retrieval.py`, get real numbers, tune thresholds | Day 4 |
| 9 | Build frontend (mic button, chat window, latency dashboard, guardrail log), connect to backend | Day 4 |
| 10 | Deploy backend (Render/Railway) + frontend (Vercel), verify live link, set up keep-alive | Day 4–5 |
| 11 | Record 2 videos (90s process video, full demo video including a Hindi/code-mixed query), write README with real latency numbers | Day 5 |
| 12 | Post both videos on Instagram, X, LinkedIn per member, with `#RAGInGoa`, ensure ≥1 public Instagram account, fill submission form | Day 5 |

---

## 17. Submission checklist

- [ ] GitHub repo (public, clean structure matching §4, README with setup + architecture + real latency numbers)
- [ ] Live working link (Vercel frontend, backend awake/reachable)
- [ ] Video 1: 90s team/process video
- [ ] Video 2: full end-to-end demo (include at least one refusal example, one cache-hit example, one Hindi/code-mixed example, and the live latency dashboard)
- [ ] All videos posted on Instagram, X, LinkedIn — by every team member individually, each with `#RAGInGoa`
- [ ] At least 1 public Instagram account among the team
- [ ] Submission form filled: https://forms.gle/MNvCjcv23Hn2Eeu58
- [ ] Double-check: no paid services actually enabled/billed anywhere in the stack

---

## 18. Notes for the coding agent

- Confirm exact MSMARCO-XI field names by inspecting the dataset before writing parsing code — don't assume field names from this doc.
- Keep all threshold values (`RETRIEVAL_SCORE_THRESHOLD`, `CACHE_SIMILARITY_THRESHOLD`) configurable via env vars and tune them empirically once real embeddings are computed — the numbers in this doc are reasonable starting guesses, not final values.
- Prefer correctness and a working end-to-end path over premature optimization — get all 10 pipeline stages functioning end to end first (even if retrieval takes 300ms initially), then optimize the retrieval stage down toward the 200ms target.
- Every external API call (Sarvam, Groq) must have a timeout and a graceful fallback — no unhandled exceptions should ever reach the user as a raw error.
