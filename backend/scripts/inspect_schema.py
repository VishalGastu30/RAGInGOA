from datasets import load_dataset
import json

data_files = {
    "train_hi": "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/train/hintrain.parquet",
    "val_hi": "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet",
}

print("Loading dataset in streaming mode...")
dataset = load_dataset("parquet", data_files=data_files, streaming=True)

print("--- Features ---")
for split in dataset.keys():
    print(f"Split {split}:")
    print(dataset[split].features)

print("--- Sample ---")
sample_row = next(iter(dataset["val_hi"]))
print(json.dumps(sample_row, indent=2, ensure_ascii=False)[:2500])
