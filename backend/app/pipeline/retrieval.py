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

HINDI_STOPWORDS = {
    'के', 'में', 'की', 'है', 'को', 'से', 'का', 'एक', 'और', 'पर', 'भी', 
    'हो', 'था', 'गा', 'गी', 'गे', 'थी', 'थे', 'हैं', 'कि', 'इस', 'ही', 'तो', 'जो'
}


class RetrievalEngine:
    """Loads FAISS + BM25 indexes at startup and serves queries."""

    def __init__(self):
        self.model: Optional[SentenceTransformer] = None
        self.faiss_index = None
        self.bm25_index: Optional[BM25Okapi] = None
        self.chunks: List[Dict[str, Any]] = []
        self.chunk_map: Dict[str, Dict[str, Any]] = {}
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
        self.chunk_map = {c["chunk_id"]: c for c in self.chunks}

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
        strategy: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search: FAISS (vector) + BM25 (keyword).
        Returns merged, deduped candidates with scores.
        """
        if not self._loaded:
            raise RuntimeError("RetrievalEngine not loaded — call .load() first")

        # Normalize strategy string
        if strategy:
            strategy = strategy.lower().strip()
            if strategy not in ["small", "medium", "semantic"]:
                strategy = None

        # --- FAISS ---
        q_vec = self.embed_query(query)
        # Search a larger pool if strategy-filtering is active to avoid starving candidates
        faiss_search_k = top_k * 4 if strategy else top_k
        faiss_scores, faiss_ids = self.faiss_index.search(q_vec, faiss_search_k)
        faiss_scores = faiss_scores[0]
        faiss_ids = faiss_ids[0]

        candidates: Dict[int, Dict[str, Any]] = {}
        for idx, score in zip(faiss_ids, faiss_scores):
            if idx < 0:
                continue
            chunk = self.chunks[int(idx)]
            if strategy and chunk.get("strategy") != strategy:
                continue
            candidates[int(idx)] = {
                "chunk_idx": int(idx),
                "chunk": chunk,
                "faiss_score": float(score),
                "bm25_score": 0.0,
            }
            if len(candidates) >= top_k:
                break

        # --- BM25 ---
        # Strip punctuation and filter Hindi stop words to prevent noise matching
        punc = '?!.,;:()[]{}'
        clean_q = query
        for char in punc:
            clean_q = clean_q.replace(char, ' ')
        tokenized_query = [w for w in clean_q.split() if w not in HINDI_STOPWORDS]
        if not tokenized_query:
            tokenized_query = query.split()
        bm25_scores = self.bm25_index.get_scores(tokenized_query)
        # Sort indices descending by score
        sorted_indices = np.argsort(bm25_scores)[::-1]
        
        bm25_count = 0
        for idx in sorted_indices:
            idx = int(idx)
            chunk = self.chunks[idx]
            if strategy and chunk.get("strategy") != strategy:
                continue
            if idx in candidates:
                candidates[idx]["bm25_score"] = float(bm25_scores[idx])
            else:
                try:
                    c_vec = self.faiss_index.reconstruct(idx)
                    f_score = float(np.dot(q_vec[0], c_vec))
                except Exception:
                    f_score = 0.0
                candidates[idx] = {
                    "chunk_idx": idx,
                    "chunk": chunk,
                    "faiss_score": f_score,
                    "bm25_score": float(bm25_scores[idx]),
                }
            bm25_count += 1
            if bm25_count >= top_k:
                break

        # --- Merge scores (simple weighted combination) ---
        for c in candidates.values():
            # Normalize BM25 into roughly 0-1 range
            c["combined_score"] = c["faiss_score"] * 0.7 + min(c["bm25_score"] / 20.0, 1.0) * 0.3

        # Sort by combined score descending, take top final_k
        results = sorted(candidates.values(), key=lambda x: x["combined_score"], reverse=True)[:final_k]
        return results


# Module-level singleton
retrieval_engine = RetrievalEngine()
