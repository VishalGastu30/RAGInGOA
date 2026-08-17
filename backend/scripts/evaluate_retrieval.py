#!/usr/bin/env python3
"""
Retrieval accuracy evaluation: measures Top-5 accuracy vs MSMARCO-XI
labeled correct passages over a held-out sample of queries.

Usage:
    python3 scripts/evaluate_retrieval.py [--n 200]
"""
import sys
import json
import argparse
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from datasets import load_dataset
from app.pipeline.retrieval import retrieval_engine
from app.config import RAW_DATA_DIR


def evaluate_retrieval(n: int = 200):
    print("[eval] Loading models …")
    retrieval_engine.load()

    # Load the validation split of hinval.parquet (already downloaded)
    parquet_path = RAW_DATA_DIR / "hinval.parquet"
    if not parquet_path.exists():
        print(f"hinval.parquet not found at {parquet_path}. Download it first.")
        return

    print("[eval] Loading dataset …")
    ds = load_dataset("parquet", data_files={"val": str(parquet_path)})["val"]

    # Filter to rows that have at least one selected passage
    rows_with_answer = []
    for row in ds:
        is_selected = row["passages"]["is_selected"]
        if any(s == 1 for s in is_selected):
            rows_with_answer.append(row)
        if len(rows_with_answer) >= n:
            break

    print(f"[eval] Evaluating on {len(rows_with_answer)} queries …")

    top1_hits = 0
    top5_hits = 0
    strategy_hits = {"small": 0, "medium": 0, "semantic": 0}
    strategy_total = {"small": 0, "medium": 0, "semantic": 0}

    for i, row in enumerate(rows_with_answer):
        query = row["query"]  # Hindi query
        passages = row["passages"]
        eng_passages = passages["English_passages"]
        hi_passages = passages["Translated_passages"]
        is_selected = passages["is_selected"]

        # Collect correct passage texts
        correct_texts = set()
        for text, sel in zip(hi_passages, is_selected):
            if sel == 1:
                correct_texts.add(text.strip()[:200])  # first 200 chars as fingerprint
        for text, sel in zip(eng_passages, is_selected):
            if sel == 1:
                correct_texts.add(text.strip()[:200])

        if not correct_texts:
            continue

        # Run retrieval
        candidates = retrieval_engine.search(query, top_k=20, final_k=20)

        # Check if any correct passage appears in top-1 and top-5
        def is_hit(candidates_slice):
            for c in candidates_slice:
                chunk_text = c["chunk"]["text"].strip()[:200]
                for ct in correct_texts:
                    if chunk_text in ct or ct in chunk_text:
                        return True, c["chunk"]["strategy"]
            return False, None

        hit1, strat1 = is_hit(candidates[:1])
        hit5, strat5 = is_hit(candidates[:5])

        if hit1:
            top1_hits += 1
        if hit5:
            top5_hits += 1
            if strat5 in strategy_hits:
                strategy_hits[strat5] += 1

        for c in candidates[:5]:
            s = c["chunk"]["strategy"]
            if s in strategy_total:
                strategy_total[s] += 1

        if (i + 1) % 20 == 0:
            print(f"  {i+1}/{len(rows_with_answer)} — Top-5 so far: {top5_hits/(i+1)*100:.1f}%")

    total = len(rows_with_answer)
    print("\n" + "=" * 60)
    print("RETRIEVAL ACCURACY RESULTS")
    print("=" * 60)
    print(f"Queries evaluated:  {total}")
    print(f"Top-1 accuracy:     {top1_hits}/{total} = {top1_hits/total*100:.1f}%")
    print(f"Top-5 accuracy:     {top5_hits}/{total} = {top5_hits/total*100:.1f}%")
    print("=" * 60)

    out = {
        "n_queries": total,
        "top1_hits": top1_hits,
        "top5_hits": top5_hits,
        "top1_accuracy_pct": round(top1_hits / total * 100, 1),
        "top5_accuracy_pct": round(top5_hits / total * 100, 1),
    }
    out_file = Path(__file__).parent.parent / "data" / "retrieval_eval_results.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nResults saved to {out_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=200)
    args = parser.parse_args()
    evaluate_retrieval(n=args.n)
