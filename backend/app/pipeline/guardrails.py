"""
Guardrails: retrieval confidence check (A) and grounding check (B).
"""
from typing import List, Dict, Any, Tuple

from app.config import RETRIEVAL_SCORE_THRESHOLD

REFUSAL_MESSAGE = "I don't have enough information in the provided dataset to answer that."
UNSAFE_REFUSAL_MESSAGE = "Request rejected: unsafe or inappropriate content detected."

UNSAFE_KEYWORDS = [
    "ignore previous instructions", "system prompt", "jailbreak",
    "hack", "exploit", "malware", "weapon", "violence",
]

def guardrail_input_safety(query: str) -> Tuple[bool, str]:
    """
    Input Guardrail — runs BEFORE retrieval.
    Checks for unsafe/inappropriate inputs or prompt injection attempts.
    Returns (passes, reason).
    """
    if not query or not query.strip():
        return False, "Empty query provided."

    lowered = query.lower()
    for kw in UNSAFE_KEYWORDS:
        if kw in lowered:
            return False, f"Unsafe or prompt injection input detected: '{kw}'."

    return True, ""


def guardrail_a_retrieval_confidence(
    ranked_candidates: List[Dict[str, Any]],
    threshold: float = RETRIEVAL_SCORE_THRESHOLD,
) -> Tuple[bool, str]:
    """
    Guardrail A — runs BEFORE generation.
    Returns (passes, reason).
    If the top reranked passage score is below threshold, refuse.
    """
    if not ranked_candidates:
        return False, "No passages retrieved."

    # rerank_score is a cross-encoder logit (unbounded); combined_score is cosine-based (0-1).
    # Use combined_score (cosine) for the threshold check — reranker is used for ordering, not filtering.
    top_combined = ranked_candidates[0].get("combined_score", 1.0)

    if top_combined < threshold:
        return False, f"Top retrieval score ({top_combined:.3f}) below threshold ({threshold})."

    return True, ""


def guardrail_b_grounding_check(
    generated: Dict[str, Any],
) -> Tuple[bool, str]:
    """
    Guardrail B — runs AFTER generation.
    Checks the structured output from Groq for grounding.
    Returns (passes, reason).
    """
    grounded = generated.get("grounded", True)
    confidence = generated.get("confidence", 1.0)

    if not grounded:
        return False, "LLM flagged the answer as not grounded in the provided context."

    if confidence < 0.4:
        return False, f"LLM confidence too low ({confidence:.2f})."

    return True, ""
