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
LATENCY BENCHMARK RESULTS (n=30 queries)
============================================================
Retrieval Only:        P50 = 35 ms   P70 = 36 ms   P90 = 47 ms   P100 = 151 ms   (Mean = 37 ms)
Rerank Only:           P50 = 806 ms  P70 = 1005 ms P90 = 1200 ms P100 = 1392 ms  (Mean = 832 ms)
Retrieval + Rerank:    P50 = 937 ms  P70 = 1051 ms P90 = 1228 ms P100 = 1436 ms  (Mean = 870 ms)
============================================================
```

> **Note on 200ms Target:** Vector + BM25 retrieval comfortably beats the 200ms target at **P50 = 35ms**, **P70 = 36ms**, and **P90 = 47ms**.

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
