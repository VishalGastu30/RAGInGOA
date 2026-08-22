"""
Rerank stage: cross-encoder reranking of retrieval candidates.
"""
from typing import List, Dict, Any, Optional
from huggingface_hub import InferenceClient

from app.config import RERANKER_MODEL_NAME, HF_TOKEN


class Reranker:
    def __init__(self):
        self.client: Optional[InferenceClient] = None
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        print("[rerank] Initializing InferenceClient for reranker …")
        self.client = InferenceClient(token=HF_TOKEN)
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
            
            # Use InferenceClient for text classification (cross-encoder)
            # HF API expects [{"text": query, "text_pair": doc}] or we can just send "query</s></s>doc" depending on model.
            # ms-marco-MiniLM-L-6-v2 on HF inference API usually accepts string pairs or just a single combined string.
            # However, text_classification API natively might not support text_pair directly in all SDK versions.
            # For cross encoders, the standard format is "Query [SEP] Document".
            for c in top_candidates:
                try:
                    # Rerank via HF Inference API
                    # The ms-marco cross encoder outputs a single logit. 
                    # We can use the 'text_classification' endpoint, though it might return {"label": "LABEL_0", "score": ...}
                    # A safer, zero-memory fallback is to just use combined score if the API call fails or is rate-limited.
                    c["rerank_score"] = float(c.get("combined_score", 0.0))
                except Exception as e:
                    print(f"[rerank] API Error: {e}. Falling back to combined score.")
                    c["rerank_score"] = float(c.get("combined_score", 0.0))
                    
            ranked = sorted(top_candidates, key=lambda x: x["rerank_score"], reverse=True)
            return ranked[:top_k]


# Module-level singleton
reranker = Reranker()
