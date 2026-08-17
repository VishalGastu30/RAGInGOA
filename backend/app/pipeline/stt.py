"""
STT stage: Sarvam speech-to-text wrapper.
"""
import base64
import requests
from typing import Optional

from app.config import SARVAM_API_KEY

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text-translate"


def transcribe(audio_base64: str, language_hint: Optional[str] = None) -> str:
    """
    Send audio to Sarvam STT and return transcript text.
    audio_base64: base64-encoded audio bytes (wav/mp3/webm).
    """
    if not SARVAM_API_KEY:
        raise RuntimeError("SARVAM_API_KEY not configured.")

    # Decode base64 to bytes for file upload
    audio_bytes = base64.b64decode(audio_base64)

    headers = {
        "api-subscription-key": SARVAM_API_KEY,
    }

    files = {
        "file": ("audio.wav", audio_bytes, "audio/wav"),
    }

    data = {
        "model": "saaras:v2",
    }

    if language_hint:
        lang_map = {"hi": "hi-IN", "en": "en-IN"}
        data["language_code"] = lang_map.get(language_hint, "hi-IN")
    else:
        data["language_code"] = "hi-IN"

    try:
        resp = requests.post(
            SARVAM_STT_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        return result.get("transcript", "")
    except requests.exceptions.Timeout:
        raise RuntimeError("Sarvam STT request timed out.")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Sarvam STT error: {str(e)[:200]}")
