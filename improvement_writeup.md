# RAGInGOA — Full Improvement Writeup
### Hacker House Goa 2026 | Task 2: Voice-Enabled Indic RAG

---

## What's Been Done So Far

The core pipeline is functionally complete:
- **STT**: Sarvam `saaras:v3` speech-to-text in transcribe mode
- **Chunking**: Hybrid (semantic sentence + fixed token) chunking strategy
- **Retrieval**: FAISS flat-IP (dense) + BM25 (sparse) with Reciprocal Rank Fusion
- **Re-ranking**: Cross-encoder reranking of top candidates
- **Generation**: Gemini answer generation over retrieved context
- **Translation**: Sarvam translate endpoint for Hindi/Marathi output → English
- **Guardrails**: Query guardrail with refusal/audit logging
- **Frontend**: Neobrutalist light/dark theme, real HH Goa logo lockup, floating Goa Explorer modal

---

## FRONTEND IMPROVEMENTS

### 1. UX — Voice Flow Polish
| Issue | Fix |
|---|---|
| No waveform visualization during recording | Add live `<canvas>` AudioContext waveform using Web Audio API |
| Mic button feedback is weak | Add pulsing red ring + "RECORDING..." live counter badge |
| STT latency feels slow with no progress | Add animated "Transcribing..." skeleton in textarea while waiting |
| No indication of speaking language | Auto-detect script (Hindi/Marathi/English) from realtime SpeechRecognition API and show language badge |
| Textarea is small (48px height) | Auto-grow textarea height as text grows (CSS `field-sizing: content` or JS min-height trick) |

### 2. UX — Response Display
| Issue | Fix |
|---|---|
| Only the last assistant message is shown on the right panel | Render all assistant messages in scrollable list, not just the latest |
| No streaming / live typing effect | Stream tokens from `/api/query` using `EventSource` or chunked response and render word-by-word |
| Hindi/Marathi responses render as plain text | Add proper `lang="hi"` / `lang="mr"` attribute and use a Devanagari-optimized Google Font (Noto Sans Devanagari) |
| Sources list is plain | Expandable accordion-style source cards with relevance score bar |
| No copy-to-clipboard on response | Add [COPY] button on every assistant message |
| Translate button appears even on English answers | Only show [TRANSLATE TO ENGLISH] if the response is detected to be non-English |

### 3. UX — Layout & Responsiveness
| Issue | Fix |
|---|---|
| App is not usable on mobile at all | Add a responsive mobile view — single column, collapsible footer panels |
| Footer telemetry/audit panels overlap content | Make footer collapsible (toggle with button) rather than resize-only |
| Keyboard shortcut missing | Add `Ctrl+Enter` to submit, `Esc` to close modal, `M` to start/stop mic |
| No session history between page loads | Persist conversation history to `localStorage` and restore on reload |
| Strategy selector is a text dropdown, not visual | Replace with styled toggle group buttons (Dense / Hybrid / Sparse) |

### 4. Design
| Issue | Fix |
|---|---|
| Floating [EXPLORE GOA] button covers content on smaller screens | Move to a side drawer toggle instead |
| Dark mode has no animated background | Add subtle moving starfield CSS animation for dark mode |
| No sponsor logos shown anywhere | Add a horizontal scrolling sponsor marquee in the footer using the logos from `/backend/app/logos/` (Devfolio, Aptos, Polygon, etc.) |
| Hacker House green `#1B5E20` is very dark | Test against a brighter emerald `#2E7D32` or use HH official green |

---

## BACKEND IMPROVEMENTS

### 5. STT — Speech-to-Text Pipeline
| Issue | Fix |
|---|---|
| No language detection before sending to STT | Pre-detect language from audio characteristics or add a language selector on frontend |
| No streaming STT | Use WebSocket-based Sarvam streaming API for real-time partial transcription |
| No audio pre-processing | Add VAD (Voice Activity Detection) to trim leading/trailing silence before sending |
| Base64 over HTTP is inefficient for large audio | Switch to multipart/form-data upload directly instead of base64 encoded JSON body |
| No audio quality validation | Reject audio below minimum SNR or shorter than 0.5s with a clear error message |

### 6. Chunking & Indexing
| Issue | Fix |
|---|---|
| Only two chunking strategies | Add a **hierarchical chunking** strategy: paragraph → sentence → phrase, and store at multiple levels |
| No chunk deduplication | Hash chunks and deduplicate before indexing to reduce index size |
| No incremental indexing | Add `/api/admin/index` endpoint that can append new documents without full reindex |
| Fixed embedding model (`all-MiniLM-L6-v2`) | Evaluate `intfloat/multilingual-e5-large` which handles Indic scripts natively — likely better recall for Hindi queries |
| No chunk quality scoring | Filter out chunks below a minimum quality score (too short, too many numbers, etc.) |

### 7. Retrieval & Re-ranking
| Issue | Fix |
|---|---|
| RRF k=60 is a fixed default | Make RRF `k` configurable via the `/api/query` payload |
| Re-ranker runs on all top-k | Cap the re-ranker input to top-20 only (default top-100 is very slow) |
| No query expansion | Add HyDE (Hypothetical Document Embedding): generate a fake "ideal answer" and embed that for retrieval |
| No multilingual query normalization | Transliterate Roman-script Hindi ("kya haal hai") to Devanagari before embedding |
| BM25 index is in-memory only | Persist BM25 index to disk so it survives restarts without full re-indexing |

### 8. Answer Generation
| Issue | Fix |
|---|---|
| System prompt is generic | Add a Goa-specific system prompt prefix ("You are a Goa travel and culture assistant...") |
| No answer faithfulness check | Add a post-generation faithfulness check: verify every claim in the answer appears in at least one source chunk |
| No citation format | Return structured citations `[1][2]` in the answer and link them to source chunks in the UI |
| Language mismatch between query and answer | Detect query language and instruct Gemini to answer in the same language explicitly |
| No response caching | Add a Redis/SQLite LRU cache for identical queries (TTL: 1 hour) |

### 9. Translation
| Issue | Fix |
|---|---|
| Translation is triggered manually | Add an auto-detect flag: if response is Hindi/Marathi, show the translation immediately alongside |
| Translation latency is not tracked | Wire up `translation_ms` into the latency dashboard telemetry |
| No language display | Show source language of the response as a badge (e.g. `[HINDI]`, `[MARATHI]`) |

### 10. Guardrails
| Issue | Fix |
|---|---|
| Guardrail is a simple keyword list | Upgrade to a semantic classifier: embed the query and compare cosine distance to off-topic cluster centroids |
| Guardrail log is not persistent | Write guardrail logs to a SQLite DB so they persist across restarts |
| No rate limiting | Add per-IP rate limiting (10 queries/minute) to prevent abuse |

### 11. API & DevEx
| Issue | Fix |
|---|---|
| No `/api/health` endpoint | Add a health check endpoint returning version, model names, index stats |
| No API documentation | Add FastAPI auto-docs at `/docs` and `/redoc` |
| CORS is wide open (`*`) | Restrict CORS to the Vite dev server origin in development |
| No request logging | Add structured JSON request logging (request ID, latency, status) to stdout |
| No tests | Add at minimum: unit tests for chunking logic, integration test for the full `/api/query` pipeline |

---

## PRIORITY ORDER FOR SUBMISSION

Given the task evaluation criteria, here's what to focus on first:

```
HIGH IMPACT (do these)
├── Multilingual embedding model (multilingual-e5-large)
├── Streaming response tokens to frontend (EventSource)
├── Waveform visualization during recording
├── Citation format [1][2] in response linked to sources
├── Auto-language detection + answer in same language as query
└── Sponsor marquee in footer (judges will notice the event branding)

MEDIUM IMPACT (do if time)
├── HyDE query expansion
├── Response faithfulness check
├── Mobile responsive layout
└── Translation latency in dashboard

LOW PRIORITY (nice to have)
├── BM25 persistence to disk
├── Redis response cache
└── Per-IP rate limiting
```

---

## FILES TO CREATE/MODIFY

| File | Change |
|---|---|
| `frontend/src/App.jsx` | Streaming SSE response, waveform canvas, auto-language badge |
| `frontend/src/index.css` | Mobile breakpoints, sponsor marquee styles, Devanagari font import |
| `frontend/src/components/MicButton.jsx` | Web Audio API waveform, improved recording feedback |
| `backend/app/pipeline/retriever.py` | HyDE, multilingual embedding option |
| `backend/app/pipeline/generator.py` | Citation-format output, language-match instruction |
| `backend/app/pipeline/stt.py` | Multipart upload instead of base64 |
| `backend/app/main.py` | `/api/health`, streaming `/api/query`, structured logging |
| `backend/app/pipeline/guardrail.py` | Semantic guardrail, SQLite logging |
