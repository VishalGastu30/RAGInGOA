import os
import numpy as np
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv("/home/vishal/Projects/RAGInGOA/.env")
token = os.getenv("HF_TOKEN")
if not token:
    print("No token")
    exit(1)

client = InferenceClient(token=token)
try:
    print("Testing embeddings...")
    res = client.feature_extraction(text="Hello world", model="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    vec = np.array(res)
    print(f"Embedding shape: {vec.shape}")
except Exception as e:
    print(f"Embedding error: {type(e)} {e}")

