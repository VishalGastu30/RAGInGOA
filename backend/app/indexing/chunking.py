import json
import uuid
import numpy as np
import nltk
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
from tqdm import tqdm

for pkg in ['punkt', 'punkt_tab']:
    try:
        nltk.data.find(f'tokenizers/{pkg}')
    except (LookupError, Exception):
        try:
            nltk.download(pkg, quiet=True)
        except Exception:
            pass

def split_into_sentences(text: str) -> List[str]:
    # Simple wrapper for nltk sent_tokenize
    return nltk.sent_tokenize(text)

def chunk_small(text: str) -> List[str]:
    """Small chunks: ~1-2 sentences."""
    sentences = split_into_sentences(text)
    chunks = []
    for i in range(0, len(sentences), 2):
        chunk = " ".join(sentences[i:i+2])
        if len(chunk.strip()) > 0:
            chunks.append(chunk.strip())
    return chunks

def chunk_medium(text: str, max_words=150, overlap_words=30) -> List[str]:
    """Medium chunks: ~150-300 tokens with overlap."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i+max_words]
        chunk_text = " ".join(chunk_words)
        if len(chunk_text.strip()) > 0:
            chunks.append(chunk_text)
        i += (max_words - overlap_words)
    return chunks

def chunk_semantic(text: str, model: SentenceTransformer, threshold=0.6) -> List[str]:
    """Semantic chunks: group sentences based on embedding similarity."""
    sentences = split_into_sentences(text)
    if len(sentences) <= 2:
        return [text]

    # Precompute embeddings for all sentences
    embeddings = model.encode(sentences, convert_to_tensor=False)

    chunks = []
    current_chunk = [sentences[0]]
    current_emb = embeddings[0]

    for i in range(1, len(sentences)):
        # Compute cosine similarity between current sentence and the running chunk embedding
        sim = np.dot(current_emb, embeddings[i]) / (np.linalg.norm(current_emb) * np.linalg.norm(embeddings[i]) + 1e-10)
        
        if sim >= threshold:
            current_chunk.append(sentences[i])
            # Update running embedding (simple average)
            current_emb = (current_emb * (len(current_chunk)-1) + embeddings[i]) / len(current_chunk)
        else:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentences[i]]
            current_emb = embeddings[i]

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks

def build_all_chunks(passage: Dict[str, Any], semantic_model: SentenceTransformer) -> List[Dict[str, Any]]:
    text = passage["text"]
    passage_id = passage["passage_id"]
    language = passage["language"]

    all_chunk_records = []

    # Small
    for c_text in chunk_small(text):
        all_chunk_records.append({
            "chunk_id": str(uuid.uuid4()),
            "passage_id": passage_id,
            "strategy": "small",
            "language": language,
            "text": c_text,
            "word_count": len(c_text.split())
        })

    # Medium
    for c_text in chunk_medium(text):
        all_chunk_records.append({
            "chunk_id": str(uuid.uuid4()),
            "passage_id": passage_id,
            "strategy": "medium",
            "language": language,
            "text": c_text,
            "word_count": len(c_text.split())
        })

    # Semantic
    for c_text in chunk_semantic(text, semantic_model):
        all_chunk_records.append({
            "chunk_id": str(uuid.uuid4()),
            "passage_id": passage_id,
            "strategy": "semantic",
            "language": language,
            "text": c_text,
            "word_count": len(c_text.split())
        })

    return all_chunk_records
