"""
Generation stage: call Groq LLM with retrieved context, get structured JSON answer.
"""
import json
from typing import List, Dict, Any
from openai import OpenAI

from app.config import GROQ_API_KEY, GROQ_MODEL_NAME

SYSTEM_PROMPT = """You are a helpful assistant that answers questions using ONLY the provided context passages.
Rules:
1. Answer the question using ONLY information found in the context passages below.
2. If the context does not contain enough information to answer, set "grounded" to false and say you don't have enough information.
3. Keep your answer concise and factual.
4. Always respond in the same language as the question (if the question is in Hindi, answer in Hindi).

Respond with valid JSON in this exact format:
{
  "answer": "your answer here",
  "grounded": true,
  "confidence": 0.91,
  "sources": ["chunk_id_1", "chunk_id_2"]
}
"""


def build_context(passages: List[Dict[str, Any]]) -> str:
    """Build context string from top passages."""
    parts = []
    for i, p in enumerate(passages):
        chunk = p["chunk"]
        parts.append(f"[Passage {i+1} | id={chunk['chunk_id']}]\n{chunk['text']}")
    return "\n\n".join(parts)


def generate_answer(
    query: str,
    passages: List[Dict[str, Any]],
    timeout: float = 10.0,
) -> Dict[str, Any]:
    """
    Call Groq to generate an answer grounded in the retrieved passages.
    Returns parsed structured output dict.
    """
    if not GROQ_API_KEY:
        return {
            "answer": "Generation service unavailable (no API key configured).",
            "grounded": False,
            "confidence": 0.0,
            "sources": [],
        }

    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )

    context = build_context(passages)
    user_message = f"Context passages:\n{context}\n\nQuestion: {query}"

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0,
            max_tokens=1024,
            timeout=timeout,
        )

        raw = response.choices[0].message.content.strip()

        # Try to extract JSON from the response
        # Sometimes models wrap it in ```json ... ```
        if raw.startswith("```"):
            lines = raw.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```") and not in_block:
                    in_block = True
                    continue
                elif line.strip().startswith("```") and in_block:
                    break
                elif in_block:
                    json_lines.append(line)
            raw = "\n".join(json_lines)

        parsed = json.loads(raw)
        return parsed

    except json.JSONDecodeError:
        # LLM didn't return valid JSON — wrap raw text
        return {
            "answer": raw if raw else "Failed to parse generation output.",
            "grounded": False,
            "confidence": 0.0,
            "sources": [],
        }
    except Exception as e:
        return {
            "answer": f"The answer service is temporarily unavailable. Error: {str(e)[:100]}",
            "grounded": False,
            "confidence": 0.0,
            "sources": [],
        }


def translate_to_english(text: str) -> str:
    """Translate the input text into fluent English using Groq."""
    if not GROQ_API_KEY:
        return "Translation service unavailable (no API key configured)."

    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional translator. Translate the user input text directly into fluent English. Output ONLY the translated English text. Do not add any preamble, explanation, quotes, or notes."
                },
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        translated = response.choices[0].message.content.strip()
        return translated
    except Exception as e:
        return f"Translation failed: {str(e)}"
