"""
Retrieval stage: FAISS vector search + BM25 keyword search, merged and deduped.
"""
import json
import pickle
import time
import numpy as np
import faiss
from pathlib import Path
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

from app.config import VECTOR_INDEX_PATH, EMBEDDING_MODEL_NAME


class RetrievalEngine:
    """Loads FAISS + BM25 indexes at startup and serves queries."""

    def __init__(self):
        self.model: Optional[SentenceTransformer] = None
        self.faiss_index = None
        self.bm25_index: Optional[BM25Okapi] = None
        self.chunks: List[Dict[str, Any]] = []
        self._loaded = False

    # ------------------------------------------------------------------
    def load(self):
        """Called once at app startup."""
        if self._loaded:
            return

        print("[retrieval] Loading embedding model …")
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)

        print("[retrieval] Loading FAISS index …")
        faiss_path = str(VECTOR_INDEX_PATH / "faiss_index.bin")
        self.faiss_index = faiss.read_index(faiss_path)

        print("[retrieval] Loading BM25 index …")
        with open(VECTOR_INDEX_PATH / "bm25_index.pkl", "rb") as f:
            self.bm25_index = pickle.load(f)

        print("[retrieval] Loading chunk metadata …")
        with open(VECTOR_INDEX_PATH / "chunk_metadata.json", "r", encoding="utf-8") as f:
            self.chunks = json.load(f)

        print(f"[retrieval] Ready — {len(self.chunks)} chunks, dim={self.faiss_index.d}")
        self._loaded = True

    # ------------------------------------------------------------------
    def embed_query(self, text: str) -> np.ndarray:
        vec = self.model.encode([text], normalize_embeddings=True, convert_to_numpy=True)
        return vec.astype("float32")

    # ------------------------------------------------------------------
    def search(
        self,
        query: str,
        top_k: int = 20,
        final_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search: FAISS (vector) + BM25 (keyword).
        Returns merged, deduped candidates with scores.
        """
        if not self._loaded:
            raise RuntimeError("RetrievalEngine not loaded — call .load() first")

        # --- FAISS ---
        q_vec = self.embed_query(query)
        faiss_scores, faiss_ids = self.faiss_index.search(q_vec, top_k)
        faiss_scores = faiss_scores[0]
        faiss_ids = faiss_ids[0]

        candidates: Dict[int, Dict[str, Any]] = {}
        for idx, score in zip(faiss_ids, faiss_scores):
            if idx < 0:
                continue
            candidates[int(idx)] = {
                "chunk_idx": int(idx),
                "chunk": self.chunks[int(idx)],
                "faiss_score": float(score),
                "bm25_score": 0.0,
            }

        # --- BM25 ---
        tokenized_query = query.split()
        bm25_scores = self.bm25_index.get_scores(tokenized_query)
        bm25_top_indices = np.argsort(bm25_scores)[::-1][:top_k]

        for idx in bm25_top_indices:
            idx = int(idx)
            if idx in candidates:
                candidates[idx]["bm25_score"] = float(bm25_scores[idx])
            else:
                candidates[idx] = {
                    "chunk_idx": idx,
                    "chunk": self.chunks[idx],
                    "faiss_score": 0.0,
                    "bm25_score": float(bm25_scores[idx]),
                }

        # --- Merge scores (simple weighted combination) ---
        for c in candidates.values():
            # Normalize BM25 into roughly 0-1 range
            c["combined_score"] = c["faiss_score"] * 0.7 + min(c["bm25_score"] / 20.0, 1.0) * 0.3

        # Sort by combined score descending, take top final_k
        results = sorted(candidates.values(), key=lambda x: x["combined_score"], reverse=True)[:final_k]
        return results


# Module-level singleton
retrieval_engine = RetrievalEngine()
