import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

# API Keys
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Server Config
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))

# Paths
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"

_v_env = os.getenv("VECTOR_INDEX_PATH")
if _v_env:
    _vp = Path(_v_env)
    VECTOR_INDEX_PATH = _vp if _vp.is_absolute() else (BASE_DIR / _vp).resolve()
else:
    VECTOR_INDEX_PATH = DATA_DIR / "index"

_l_env = os.getenv("LOG_DB_PATH")
if _l_env:
    _lp = Path(_l_env)
    LOG_DB_PATH = _lp if _lp.is_absolute() else (BASE_DIR / _lp).resolve()
else:
    LOG_DB_PATH = DATA_DIR / "logs.db"

# Pipeline Thresholds
RETRIEVAL_SCORE_THRESHOLD = float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", 0.35))
CACHE_SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", 0.92))

# Model Specs
EMBEDDING_MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
RERANKER_MODEL_NAME = os.getenv(
    "RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
GROQ_MODEL_NAME = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")
