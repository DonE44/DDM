#!/usr/bin/env python3
"""
download-whisper-models.py

Downloads Xenova Whisper models from HuggingFace and caches them locally
in electron/models/ for bundling with the Electron release.

Models are cached locally to eliminate:
- HuggingFace 401/403 authentication errors
- Runtime download delays
- Network dependencies in production

Models downloaded (Xenova - PUBLIC, UNRESTRICTED):
  - whisper-small (~300 MB) - ~80% accuracy, fastest
  - whisper-base (~350 MB) - ~80-85% accuracy, good balance
  - whisper-small.en (~300 MB) - ~85% accuracy, English-only, faster

Total: ~1 GB (will be ~500 MB compressed in .asar)

These are the ONLY models that download without 401 errors from HuggingFace.
onnx-community models are GATED (require authentication).

Usage:
  python scripts/download-whisper-models.py [--output-dir DIRECTORY]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error
import shutil

# Xenova models - PUBLIC, UNRESTRICTED, optimized for transformers.js
# These are the ONLY models that download without 401 errors
# Focus on accuracy for professional lyric transcription
MODELS = {
    "Xenova/whisper-small": [
        "onnx/model.onnx",
        "onnx/model_quantized.onnx",
        "tokenizer.json",
        "config.json",
    ],
    "Xenova/whisper-base": [
        "onnx/model.onnx",
        "onnx/model_quantized.onnx",
        "tokenizer.json",
        "config.json",
    ],
    "Xenova/whisper-small.en": [
        "onnx/model.onnx",
        "onnx/model_quantized.onnx",
        "tokenizer.json",
        "config.json",
    ],
}


def get_hf_url(model_id: str, filename: str) -> str:
    """Construct HuggingFace raw CDN URL for a file."""
    # Use /blob/ for browser view, /raw/ for direct download
    return f"https://huggingface.co/{model_id}/raw/main/{filename}"


def download_file(url: str, dest_path: Path, chunk_size: int = 8192) -> bool:
    """
    Download a file from URL to dest_path with progress.
    Returns True if successful, False otherwise.
    """
    filename = url.split('/')[-1]
    print(f"  Downloading: {filename}")

    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0

            with open(dest_path, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    if total_size > 0:
                        pct = min(100, int(100 * downloaded / total_size))
                        mb = downloaded / (1024 * 1024)
                        total_mb = total_size / (1024 * 1024)
                        sys.stdout.write(f"\r    [{pct:3d}%] {mb:.1f}MB / {total_mb:.1f}MB")
                        sys.stdout.flush()

        if total_size > 0:
            sys.stdout.write("\r    [100%] Complete              \n")
        print(f"  ✓ Downloaded: {dest_path.name}")
        return True

    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {filename}")
        return False
    except urllib.error.URLError as e:
        print(f"  ✗ Network error: {e.reason}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Download Xenova Whisper models for offline use."
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory (default: electron/models/)",
    )
    args = parser.parse_args()

    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        # Relative to script location
        script_dir = Path(__file__).parent
        output_dir = script_dir.parent / "electron" / "models"

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n📦 Downloading Xenova Whisper models to: {output_dir}\n")
    print(f"   Small (~300 MB) - 80% accuracy, fastest")
    print(f"   Base (~350 MB) - 80-85% accuracy, balanced")
    print(f"   Small.en (~300 MB) - 85% accuracy, English-only")
    print(f"   Total: ~1 GB pre-download\n")
    print(f"   (Note: onnx-community models are GATED - use Xenova instead)\n")

    total_files = sum(len(files) for files in MODELS.values())
    downloaded = 0
    failed = 0

    for model_id, filenames in MODELS.items():
        print(f"\n🎯 Model: {model_id}")
        model_dir = output_dir / model_id
        model_dir.mkdir(parents=True, exist_ok=True)

        for filename in filenames:
            url = get_hf_url(model_id, filename)
            
            # Create subdirectories for nested files (e.g., onnx/model.onnx)
            dest = model_dir / filename
            dest.parent.mkdir(parents=True, exist_ok=True)

            # Skip if already exists
            if dest.exists():
                size_mb = dest.stat().st_size / (1024 * 1024)
                print(f"  ⊘ Already exists: {filename} ({size_mb:.1f}MB)")
                downloaded += 1
                continue

            if download_file(url, dest):
                downloaded += 1
            else:
                failed += 1

    print(f"\n{'='*60}")
    print(f"📊 Summary: {downloaded}/{total_files} files downloaded")
    if failed > 0:
        print(f"⚠️  {failed} files failed. Check errors above.")
        sys.exit(1)
    else:
        print(f"\n✅ All models ready!")
        print(f"   Location: {output_dir}")
        print(f"\n📝 Next step:")
        print(f"   Update Phase 2: Modify whisper-transcribe.cjs to use")
        print(f"   local cached models instead of downloading at runtime")


if __name__ == "__main__":
    main()

