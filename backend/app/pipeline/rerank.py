"""
Rerank stage: cross-encoder reranking of retrieval candidates.
"""
from typing import List, Dict, Any, Optional
from sentence_transformers import CrossEncoder

from app.config import RERANKER_MODEL_NAME


class Reranker:
    def __init__(self):
        self.model: Optional[CrossEncoder] = None
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        print("[rerank] Loading cross-encoder model …")
        self.model = CrossEncoder(RERANKER_MODEL_NAME)
        self._loaded = True
        print("[rerank] Ready")

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Re-score candidates with the cross-encoder and return top_k."""
        if not self._loaded:
            raise RuntimeError("Reranker not loaded — call .load() first")

        if not candidates:
            return []

        pairs = [(query, c["chunk"]["text"]) for c in candidates]
        scores = self.model.predict(pairs)

        for i, c in enumerate(candidates):
            c["rerank_score"] = float(scores[i])

        ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return ranked[:top_k]


# Module-level singleton
reranker = Reranker()
