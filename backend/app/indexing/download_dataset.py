import json
import sys
from pathlib import Path
from datasets import load_dataset

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from app.config import RAW_DATA_DIR


def download_and_inspect():
    print("=" * 60)
    print("Downloading / inspecting ai4bharat/MSMARCO-XI dataset...")
    print("=" * 60)

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    inspection_file = RAW_DATA_DIR / "dataset_inspection.txt"

    data_files = {
        "train_hi": "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/train/hintrain.parquet",
        "val_hi": "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet",
    }

    dataset = load_dataset("parquet", data_files=data_files)

    lines = []
    lines.append("=== MSMARCO-XI Dataset Inspection ===")
    for split_name in dataset.keys():
        lines.append(f"Split '{split_name}': {len(dataset[split_name])} rows")

    sample_split = "val_hi" if "val_hi" in dataset else list(dataset.keys())[0]
    sample_ds = dataset[sample_split]

    lines.append(f"\n--- Features / Schema ({sample_split}) ---")
    lines.append(str(sample_ds.features))

    lines.append("\n--- Sample Row (Row 0) ---")
    sample_row = sample_ds[0]
    sample_formatted = json.dumps(sample_row, indent=2, ensure_ascii=False)
    lines.append(sample_formatted[:2500])

    output_text = "\n".join(lines)
    print(output_text)

    with open(inspection_file, "w", encoding="utf-8") as f:
        f.write(output_text)

    print(f"\nSaved dataset inspection summary to {inspection_file}")


if __name__ == "__main__":
    download_and_inspect()
