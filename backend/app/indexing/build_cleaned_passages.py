import json
import re
import hashlib
from pathlib import Path
from datasets import load_dataset
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from app.config import RAW_DATA_DIR

def clean_text(text: str) -> str:
    """Strip HTML artifacts and normalize whitespace."""
    if not text:
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def get_passage_id(text: str) -> str:
    """Generate a stable passage ID from its text."""
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def build_cleaned_passages(max_queries: int = None):
    print("=" * 60)
    print("Building cleaned passages from MSMARCO-XI...")
    print("=" * 60)

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_file = RAW_DATA_DIR / "passages.jsonl"
    
    data_files = {
        "val_hi": str(RAW_DATA_DIR / "hinval.parquet")
    }
    
    dataset = load_dataset("parquet", data_files=data_files)
    
    # We will deduplicate passages in memory.
    # passage_id -> { "passage_id": ..., "text": ..., "language": ..., "source_query_ids": set() }
    passages_db = {}
    
    count = 0
    for split in dataset.keys():
        print(f"Processing split: {split}")
        for row in tqdm(dataset[split], desc=split):
            query_id = row.get("query_id")
            
            # Process Hindi translated passages
            translated = row.get("passages", {}).get("Translated_passages", [])
            for text in translated:
                cleaned = clean_text(text)
                if not cleaned:
                    continue
                pid = get_passage_id(cleaned)
                if pid not in passages_db:
                    passages_db[pid] = {
                        "passage_id": pid,
                        "text": cleaned,
                        "language": "hi",
                        "source_query_ids": set()
                    }
                if query_id is not None:
                    passages_db[pid]["source_query_ids"].add(query_id)
            
            # Process English passages
            english = row.get("passages", {}).get("English_passages", [])
            for text in english:
                cleaned = clean_text(text)
                if not cleaned:
                    continue
                pid = get_passage_id(cleaned)
                if pid not in passages_db:
                    passages_db[pid] = {
                        "passage_id": pid,
                        "text": cleaned,
                        "language": "en",
                        "source_query_ids": set()
                    }
                if query_id is not None:
                    passages_db[pid]["source_query_ids"].add(query_id)
            
            count += 1
            if max_queries and count >= max_queries:
                break
        
        if max_queries and count >= max_queries:
            break

    print(f"Total unique passages found: {len(passages_db)}")
    print(f"Saving to {out_file}...")
    
    with open(out_file, "w", encoding="utf-8") as f:
        for p in passages_db.values():
            p["source_query_ids"] = list(p["source_query_ids"])
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
            
    print("Done!")

if __name__ == "__main__":
    # You can pass an integer argument to limit the number of queries processed for testing
    import sys
    max_queries = int(sys.argv[1]) if len(sys.argv) > 1 else None
    build_cleaned_passages(max_queries)
