"""
Semantic cache: near-duplicate questions get an instant cached answer.
"""
import numpy as np
from typing import Optional, Dict, Any, List

from app.config import CACHE_SIMILARITY_THRESHOLD


class SemanticCache:
    """In-memory semantic cache for recent question→answer pairs."""

    def __init__(self, threshold: float = CACHE_SIMILARITY_THRESHOLD):
        self.threshold = threshold
        # Each entry: {"embedding": np.ndarray, "question": str, "answer": str, "sources": list}
        self.entries: List[Dict[str, Any]] = []
        self.max_entries = 200

    def lookup(self, query_embedding: np.ndarray, query_text: str) -> Optional[Dict[str, Any]]:
        """
        Check if a semantically similar question exists in cache.
        Returns cached result dict or None.
        """
        if not self.entries:
            return None

        q = query_embedding.flatten()
        best_sim = -1.0
        best_entry = None

        for entry in self.entries:
            cached_emb = entry["embedding"].flatten()
            sim = float(np.dot(q, cached_emb) / (np.linalg.norm(q) * np.linalg.norm(cached_emb) + 1e-10))
            if sim > best_sim:
                best_sim = sim
                best_entry = entry

        if best_sim >= self.threshold and best_entry is not None:
            return {
                "answer": best_entry["answer"],
                "sources": best_entry["sources"],
                "cache_similarity": best_sim,
                "cached_question": best_entry["question"],
            }
        return None

    def write(self, query_embedding: np.ndarray, question: str, answer: str, sources: List[Any]):
        """Store a new question→answer pair."""
        if len(self.entries) >= self.max_entries:
            self.entries.pop(0)  # evict oldest

        self.entries.append({
            "embedding": query_embedding.copy(),
            "question": question,
            "answer": answer,
            "sources": sources,
        })


# Module-level singleton
semantic_cache = SemanticCache()
