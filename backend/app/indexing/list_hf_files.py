from huggingface_hub import list_repo_files

files = list_repo_files("ai4bharat/MSMARCO-XI", repo_type="dataset")
print("Repo files count:", len(files))
print("Sample files:")
for f in files[:20]:
    print(" -", f)
