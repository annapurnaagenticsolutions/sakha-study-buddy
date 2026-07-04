import os
import sys
from huggingface_hub import snapshot_download

print("Downloading WebLLM Model (Phi-3-mini)...")
snapshot_download(
    repo_id="mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC",
    local_dir="models/Phi-3-mini-4k-instruct-q4f16_1-MLC",
    local_dir_use_symlinks=False
)

print("Downloading ONNX Embedding model for Transformers.js RAG...")
snapshot_download(
    repo_id="Xenova/all-MiniLM-L6-v2",
    local_dir="models/all-MiniLM-L6-v2",
    local_dir_use_symlinks=False
)

print("Models downloaded successfully!")
print("In your JavaScript, configure WebLLM appConfig to point to http://localhost:8080/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/")
