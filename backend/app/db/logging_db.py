"""
Logging DB for queries, timings, and guardrail decisions.
Supports PostgreSQL (via psycopg2) if DATABASE_URL is set, else local SQLite.
"""
import json
import time
from typing import Optional, List, Dict, Any

from app.config import LOG_DB_PATH, DATABASE_URL

_is_postgres = bool(DATABASE_URL)

if _is_postgres:
    import psycopg2
    from psycopg2.extras import DictCursor
else:
    import sqlite3


def _get_conn():
    if _is_postgres:
        conn = psycopg2.connect(DATABASE_URL)
        # We will use DictCursor for dictionary-like row access
        return conn, conn.cursor(cursor_factory=DictCursor)
    else:
        LOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(LOG_DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn, conn.cursor()


def init_db():
    """Create tables if they don't exist."""
    conn, cursor = _get_conn()
    
    if _is_postgres:
        # PostgreSQL uses SERIAL for autoincrement
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS query_log (
                id SERIAL PRIMARY KEY,
                timestamp DOUBLE PRECISION NOT NULL,
                query_text TEXT NOT NULL,
                answered INTEGER NOT NULL,
                refusal_reason TEXT,
                cache_hit INTEGER NOT NULL DEFAULT 0,
                answer TEXT,
                sources TEXT,
                timings_json TEXT,
                top_retrieval_score DOUBLE PRECISION
            )
        """)
    else:
        # SQLite uses AUTOINCREMENT
        cursor.execute("""
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
    cursor.close()
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
    conn, cursor = _get_conn()
    
    # Use appropriate parameter placeholder
    placeholder = "%s" if _is_postgres else "?"
    
    query = f"""INSERT INTO query_log
           (timestamp, query_text, answered, refusal_reason, cache_hit, answer, sources, timings_json, top_retrieval_score)
           VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})"""
           
    cursor.execute(
        query,
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
    cursor.close()
    conn.close()


def get_recent_logs(limit: int = 20) -> List[Dict[str, Any]]:
    conn, cursor = _get_conn()
    
    # Use appropriate parameter placeholder
    placeholder = "%s" if _is_postgres else "?"
    
    cursor.execute(f"SELECT * FROM query_log ORDER BY id DESC LIMIT {placeholder}", (limit,))
    rows = cursor.fetchall()
    
    cursor.close()
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
