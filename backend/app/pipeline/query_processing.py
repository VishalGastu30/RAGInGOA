"""
Query processing stage: clean text, detect language, validate.
"""
import re
from typing import Tuple


def clean_query(text: str) -> str:
    """Normalize whitespace, strip leading/trailing junk."""
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text


def detect_language(text: str) -> str:
    """
    Simple heuristic language detection.
    Returns 'hi' if majority of chars are Devanagari, else 'en'.
    """
    devanagari_count = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    total_alpha = sum(1 for c in text if c.isalpha())
    if total_alpha == 0:
        return "en"
    if devanagari_count / total_alpha > 0.3:
        return "hi"
    return "en"


def process_query(raw_text: str) -> Tuple[str, str]:
    """
    Returns (cleaned_query, detected_language).
    """
    cleaned = clean_query(raw_text)
    lang = detect_language(cleaned)
    return cleaned, lang
