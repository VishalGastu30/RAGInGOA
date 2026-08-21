# Voice-Enabled RAG System — MSMARCO-XI (HH Goa 2026, Task 2)

A high-performance, voice-first Retrieval-Augmented Generation (RAG) system with hybrid multi-strategy retrieval, cross-encoder reranking, semantic caching, and strict guardrails.

## Features & Differentiators

- **Voice Input (Sarvam STT)**: Supports Indic and code-mixed (Hinglish) queries via Sarvam's Saaras speech API.
- **Multi-Strategy Chunking**: Parallel indexing with Small (1-2 sentences), Medium (overlapping window), and Semantic chunking strategies.
- **Sub-200ms Retrieval**: FAISS vector search + BM25 keyword search running in-memory achieving **35ms P50 latency**.
- **Semantic Caching**: Instant response (<10ms) for near-duplicate questions.
- **Stage-by-Stage Latency Breakdown**: Live execution timing breakdown for STT, retrieval, reranking, generation, and guardrails.
- **Strict Guardrails & Refusal**: Dual-pass checks (Retrieval confidence check & LLM Grounding check) with transparent refusal reasons and live audit logging.
- **Evaluation & Benchmarks**: Real P50 / P70 / P90 / P100 latency reporting and retrieval accuracy evaluation scripts.

## Benchmark Results

```
============================================================
LATENCY BENCHMARK RESULTS (n=100 queries, EN + HI + Hinglish)
============================================================
Retrieval Only:        P50 = 22 ms   P70 = 23 ms   P90 = 29 ms   P100 = 186 ms   (Mean = 25 ms)
Rerank Only:           P50 = 78 ms   P70 = 79 ms   P90 = 80 ms   P100 = 146 ms   (Mean = 80 ms)
Retrieval + Rerank:    P50 = 100 ms  P70 = 102 ms  P90 = 108 ms  P100 = 267 ms   (Mean = 105 ms)
============================================================
```

> **Note on 200ms Target:** Vector + BM25 retrieval comfortably beats the 200ms target at **P50 = 22ms**, **P70 = 23ms**, **P90 = 29ms**, and **P100 = 186ms**. Combined with cross-encoder reranking, the total retrieval pipeline runs in just **100ms at P50** and **108ms at P90**.

## Architecture

```
User (Browser Mic) ──► Frontend (React 19 + Vite)
                            │
                            ▼
                    Backend (FastAPI)
                            │
     ┌──────────────────────┴──────────────────────┐
     │ 1. Sarvam STT                               │
     │ 2. Semantic Cache Lookup                    │
     │ 3. Multi-Strategy Retrieval (FAISS + BM25)  │
     │ 4. Cross-Encoder Reranking                  │
     │ 5. Guardrail A (Retrieval Confidence Check) │
     │ 6. Groq Generation (Structured JSON)        │
     │ 7. Guardrail B (Grounding & Refusal Check)  │
     │ 8. SQLite Audit Logging & Timing Stats      │
     └─────────────────────────────────────────────┘
```

## Local Development & Setup

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run dataset extraction & build FAISS + BM25 indexes
python3 -m app.indexing.build_cleaned_passages 1000
python3 -m app.indexing.build_index

# Start FastAPI server
python3 -m app.main
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Running Benchmarks & Evaluation

```bash
# Run latency benchmark
python3 backend/scripts/run_latency_benchmark.py --n 100

# Run retrieval accuracy evaluation
python3 backend/scripts/evaluate_retrieval.py --n 200
```

`#RAGInGoa`
