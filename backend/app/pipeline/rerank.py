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

        # Check if query contains Devanagari/Hindi characters
        has_devanagari = any('\u0900' <= char <= '\u097f' for char in query)
        
        if has_devanagari:
            print("[rerank] Indic query detected. Bypassing English cross-encoder, using combined_score.")
            for c in candidates:
                c["rerank_score"] = c.get("combined_score", 0.0)
            ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
            return ranked[:top_k]
        else:
            # Sort by combined_score first, take top 5 candidates to minimize CPU cross-encoder latency (<30ms)
            top_candidates = sorted(candidates, key=lambda x: x.get("combined_score", 0.0), reverse=True)[:5]
            pairs = [(query, c["chunk"]["text"]) for c in top_candidates]
            scores = self.model.predict(pairs)
            for i, c in enumerate(top_candidates):
                c["rerank_score"] = float(scores[i])
            ranked = sorted(top_candidates, key=lambda x: x["rerank_score"], reverse=True)
            return ranked[:top_k]


# Module-level singleton
reranker = Reranker()
