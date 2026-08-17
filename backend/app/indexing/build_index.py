import json
import os
import pickle
import faiss
import numpy as np
from pathlib import Path
from tqdm import tqdm
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from app.config import RAW_DATA_DIR, VECTOR_INDEX_PATH, EMBEDDING_MODEL_NAME
from app.indexing.chunking import build_all_chunks

def build_indexes():
    VECTOR_INDEX_PATH.mkdir(parents=True, exist_ok=True)
    passages_file = RAW_DATA_DIR / "passages.jsonl"
    
    if not passages_file.exists():
        print(f"Error: {passages_file} not found. Run build_cleaned_passages.py first.")
        return

    print("Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    
    print("Reading passages...")
    passages = []
    with open(passages_file, "r", encoding="utf-8") as f:
        for line in f:
            passages.append(json.loads(line))

    print(f"Loaded {len(passages)} passages.")

    all_chunks = []
    
    print("Chunking passages...")
    for p in tqdm(passages, desc="Chunking"):
        chunks = build_all_chunks(p, model)
        all_chunks.extend(chunks)

    print(f"Total chunks created: {len(all_chunks)}")

    # We will build one combined FAISS index and one combined BM25 index.
    # At query time, we can fetch top K from FAISS and top K from BM25, and filter by strategy if needed.
    
    texts = [c["text"] for c in all_chunks]
    
    print("Building BM25 Index...")
    tokenized_texts = [text.split() for text in texts]
    bm25 = BM25Okapi(tokenized_texts)
    
    # Save BM25 and metadata
    print("Saving BM25 and chunk metadata...")
    with open(VECTOR_INDEX_PATH / "bm25_index.pkl", "wb") as f:
        pickle.dump(bm25, f)
        
    with open(VECTOR_INDEX_PATH / "chunk_metadata.json", "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False)

    print("Computing embeddings for FAISS...")
    # Encode in batches
    batch_size = 256
    embeddings = []
    for i in tqdm(range(0, len(texts), batch_size), desc="Embedding"):
        batch_texts = texts[i:i+batch_size]
        emb = model.encode(batch_texts, normalize_embeddings=True, convert_to_numpy=True)
        embeddings.append(emb)
        
    embeddings = np.vstack(embeddings).astype('float32')

    print("Building FAISS Index...")
    d = embeddings.shape[1]
    # Inner product (cosine similarity since embeddings are normalized)
    faiss_index = faiss.IndexFlatIP(d)
    faiss_index.add(embeddings)

    print("Saving FAISS Index...")
    faiss.write_index(faiss_index, str(VECTOR_INDEX_PATH / "faiss_index.bin"))

    print("=" * 50)
    print("Index build complete!")
    print(f"Saved to {VECTOR_INDEX_PATH}")
    print("=" * 50)

if __name__ == "__main__":
    build_indexes()
