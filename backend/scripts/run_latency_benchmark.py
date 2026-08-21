#!/usr/bin/env python3
"""
Latency benchmark: run N test queries, compute P50/P70/P90/P100 for
retrieval+rerank stage and full pipeline.

Usage:
    python3 scripts/run_latency_benchmark.py [--n 100]
"""
import sys
import json
import time
import argparse
import random
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.pipeline.retrieval import retrieval_engine
from app.pipeline.rerank import reranker
from app.db.logging_db import init_db


def percentiles(data):
    if not data:
        return {}
    s = sorted(data)
    n = len(s)
    return {
        "p50": s[int(n * 0.50)],
        "p70": s[int(n * 0.70)],
        "p90": s[int(n * 0.90)],
        "p100": s[-1],
        "mean": int(sum(s) / n),
        "n": n,
    }


def run_benchmark(n: int = 100):
    init_db()

    print("[benchmark] Loading models …")
    retrieval_engine.load()
    reranker.load()

    # Load sample queries from the passages file
    raw_file = Path(__file__).parent.parent / "data" / "raw" / "passages_full.jsonl"
    fallback_file = Path(__file__).parent.parent / "data" / "raw" / "passages.jsonl"

    source_file = raw_file if raw_file.exists() else fallback_file
    if not source_file.exists():
        print(f"No passages file found at {source_file}. Run build_cleaned_passages.py first.")
        return

    # Build a test set of queries from passage texts (simulate real questions)
    all_passages = []
    with open(source_file, "r", encoding="utf-8") as f:
        for line in f:
            p = json.loads(line)
            if p.get("text"):
                all_passages.append(p["text"])

    # Build short "queries" from passage text prefixes
    queries = []
    for text in random.sample(all_passages, min(n * 2, len(all_passages))):
        # Take first sentence / first 80 chars as a query
        first_sent = text.split(".")[0][:100].strip()
        if len(first_sent) > 10:
            queries.append(first_sent)
        if len(queries) >= n:
            break

    # Also add Indic/Hinglish & off-topic queries to test multilingual guardrail latency
    special_test_queries = [
        "What is the capital of France?",
        "Who won the cricket world cup?",
        "Best recipe for biryani",
        "Latest iPhone features",
        "निगम क्या होता है?",
        "भारत की राजधानी क्या है?",
        "Kya Corporation legal entity hai?",
        "Goa me best beach konsa hai?",
        "What is the definition of gross income?",
        "कंपनी अधिनियम क्या है?",
    ]
    queries = queries[:max(n - len(special_test_queries), 0)] + special_test_queries
    random.shuffle(queries)
    queries = queries[:n]

    from app.pipeline.orchestrator import run_pipeline

    print(f"[benchmark] Running {len(queries)} queries through orchestrated pipeline …\n")

    retrieval_times = []
    rerank_times = []
    combined_times = []
    full_pipeline_times = []

    for i, query in enumerate(queries, 1):
        res = run_pipeline(text=query)
        timings = res.get("timings_ms", {})
        ret_ms = timings.get("retrieval", 0)
        rrk_ms = timings.get("rerank", 0)
        tot_ms = timings.get("total", 0)

        retrieval_times.append(ret_ms)
        rerank_times.append(rrk_ms)
        combined_times.append(ret_ms + rrk_ms)
        full_pipeline_times.append(tot_ms)

        if i % 10 == 0:
            print(f"  {i}/{len(queries)} done — last ret={ret_ms}ms rrk={rrk_ms}ms total={tot_ms}ms (answered={res.get('answered')})")

    print("\n" + "=" * 70)
    print("LATENCY BENCHMARK RESULTS (P50 / P70 / P90 / P100 Analytics)")
    print("=" * 70)

    ret = percentiles(retrieval_times)
    rer = percentiles(rerank_times)
    com = percentiles(combined_times)
    pipe = percentiles(full_pipeline_times)

    print(f"Retrieval only (ms):        P50={ret['p50']:>5}  P70={ret['p70']:>5}  P90={ret['p90']:>5}  P100={ret['p100']:>5}  Mean={ret['mean']:>5}")
    print(f"Rerank only (ms):           P50={rer['p50']:>5}  P70={rer['p70']:>5}  P90={rer['p90']:>5}  P100={rer['p100']:>5}  Mean={rer['mean']:>5}")
    print(f"Retrieval+Rerank (ms):      P50={com['p50']:>5}  P70={com['p70']:>5}  P90={com['p90']:>5}  P100={com['p100']:>5}  Mean={com['mean']:>5}")
    print(f"Full Pipeline (ms):         P50={pipe['p50']:>5}  P70={pipe['p70']:>5}  P90={pipe['p90']:>5}  P100={pipe['p100']:>5}  Mean={pipe['mean']:>5}")
    print("=" * 70)

    # Save results to JSON
    out = {
        "n_queries": len(queries),
        "retrieval_ms": ret,
        "rerank_ms": rer,
        "retrieval_plus_rerank_ms": com,
        "full_pipeline_ms": pipe,
    }
    out_file = Path(__file__).parent.parent / "data" / "benchmark_results.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nResults saved to {out_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=200, help="Number of queries to benchmark")
    args = parser.parse_args()
    run_benchmark(n=args.n)
