# Voice-Enabled RAG System — MSMARCO-XI (HH Goa 2026, Task 2)

A high-performance, voice-first Retrieval-Augmented Generation (RAG) system with hybrid multi-strategy retrieval, cross-encoder reranking, semantic caching, and strict guardrails.

## Features & Differentiators

- **Voice Input (Sarvam STT)**: Supports Indic and code-mixed (Hinglish) queries via Sarvam's Saaras speech API.
- **Multi-Strategy Chunking**: Parallel indexing with Small (sentence), Medium (fixed overlapping window), and Semantic chunking strategies.
- **Sub-200ms Retrieval**: FAISS vector search + BM25 keyword search running in-memory for sub-200ms candidate retrieval & reranking.
- **Semantic Caching**: Instant response (<10ms) for near-duplicate questions.
- **Stage-by-Stage Latency Breakdown**: Live execution timing breakdown for STT, retrieval, reranking, generation, and guardrails.
- **Strict Guardrails & Refusal**: Dual-pass checks (Retrieval confidence check & LLM Grounding check) with transparent refusal reasons and live audit logging.
- **Evaluation & Benchmarks**: Real P50 / P70 / P100 latency reporting and retrieval accuracy evaluation against ground-truth MSMARCO-XI data.

## Architecture

```
User (Browser Mic) ──► Frontend (React + Vite)
                            │
                            ▼
                    Backend (FastAPI)
                            │
     ┌──────────────────────┴──────────────────────┐
     │ 1. Sarvam STT                               │
     │ 2. Semantic Cache Lookup                     │
     │ 3. Multi-Strategy Retrieval (FAISS + BM25)  │
     │ 4. Cross-Encoder Reranking                  │
     │ 5. Guardrail A (Retrieval Confidence Check) │
     │ 6. Groq Generation (Structured JSON)         │
     │ 7. Guardrail B (Grounding & Refusal Check)   │
     │ 8. SQLite Audit Logging & Timing Stats      │
     └─────────────────────────────────────────────┘
```

## Setup & Running

See backend and frontend setup guides once setup is complete.
`#RAGInGoa`
