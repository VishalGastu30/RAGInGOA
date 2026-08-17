"""
SQLite logging DB for queries, timings, and guardrail decisions.
"""
import sqlite3
import json
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.config import LOG_DB_PATH


def _get_conn() -> sqlite3.Connection:
    LOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(LOG_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS query_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            query_text TEXT NOT NULL,
            answered INTEGER NOT NULL,
            refusal_reason TEXT,
            cache_hit INTEGER NOT NULL DEFAULT 0,
            answer TEXT,
            sources TEXT,
            timings_json TEXT,
            top_retrieval_score REAL
        )
    """)
    conn.commit()
    conn.close()


def log_query(
    query_text: str,
    answered: bool,
    refusal_reason: Optional[str],
    cache_hit: bool,
    answer: Optional[str],
    sources: Optional[List[str]],
    timings: Optional[Dict[str, Any]],
    top_retrieval_score: Optional[float] = None,
):
    conn = _get_conn()
    conn.execute(
        """INSERT INTO query_log
           (timestamp, query_text, answered, refusal_reason, cache_hit, answer, sources, timings_json, top_retrieval_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            time.time(),
            query_text,
            1 if answered else 0,
            refusal_reason,
            1 if cache_hit else 0,
            answer,
            json.dumps(sources or []),
            json.dumps(timings or {}),
            top_retrieval_score,
        ),
    )
    conn.commit()
    conn.close()


def get_recent_logs(limit: int = 20) -> List[Dict[str, Any]]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM query_log ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "timestamp": row["timestamp"],
            "query_text": row["query_text"],
            "answered": bool(row["answered"]),
            "refusal_reason": row["refusal_reason"],
            "cache_hit": bool(row["cache_hit"]),
            "answer": row["answer"],
            "sources": json.loads(row["sources"]) if row["sources"] else [],
            "timings": json.loads(row["timings_json"]) if row["timings_json"] else {},
            "top_retrieval_score": row["top_retrieval_score"],
        })
    return results
