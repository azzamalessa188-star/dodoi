#!/usr/bin/env python3
"""Download NLLB-200 and convert it to a CTranslate2 INT8 model.

The parent Electron process reads line-delimited JSON events from stdout. All
normal logging goes to stderr so the protocol stays clean.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import threading
import time
from pathlib import Path

EVENT_PREFIX = "@@DODOI@@"
EXPECTED_INT8_BYTES = 3_500_000_000
TOKENIZER_FILES = (
    "sentencepiece.bpe.model",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "generation_config.json",
)


def emit(payload: dict) -> None:
    print(EVENT_PREFIX + json.dumps(payload, ensure_ascii=False), flush=True)


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def fail(code: str, message: str, detail: str = "") -> None:
    emit({"type": "error", "code": code, "message": message, "detail": detail})
    log(f"{code}: {message}\n{detail}")
    raise SystemExit(2)


def directory_size(path: Path) -> int:
    total = 0
    try:
        for root, _dirs, files in os.walk(path):
            for name in files:
                try:
                    total += (Path(root) / name).stat().st_size
                except OSError:
                    pass
    except OSError:
        return total
    return total


def human_gb(value: float) -> str:
    return f"{value / 1_000_000_000:.1f} GB"


def allowed_file(name: str) -> bool:
    if name in (".gitattributes", "README.md"):
        return False
    return name.endswith((".bin", ".json", ".model", ".txt", ".safetensors", ".spm"))


def monitor_directory(directory: Path, stage: str, total_bytes: int, expected_bytes: int, stop: threading.Event) -> None:
    last_size = -1
    while not stop.wait(1.0):
        size = directory_size(directory)
        if size == last_size:
            continue
        last_size = size

        if total_bytes > 0:
            percent = min(99, int((size / total_bytes) * 100))
            message = f"Downloading NLLB-200 · {human_gb(size)} of {human_gb(total_bytes)}"
        elif expected_bytes > 0:
            percent = min(95, int((size / expected_bytes) * 100))
            message = f"Converting to INT8 · {human_gb(size)} of ~{human_gb(expected_bytes)}"
        else:
            percent = None
            message = "Downloading NLLB-200…"

        emit(
            {
                "type": "progress",
                "stage": stage,
                "percent": percent,
                "bytes": size,
                "totalBytes": total_bytes or expected_bytes or 0,
                "message": message,
            }
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default="facebook/nllb-200-3.3B")
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--quantization", default="int8")
    parser.add_argument("--keep-source", action="store_true")
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    try:
        from huggingface_hub import HfApi, snapshot_download
    except Exception as error:  # pragma: no cover - environment failure
        fail(
            "LOCAL_DEPENDENCY_MISSING",
            "The Hugging Face downloader is not installed in the local Python environment.",
            str(error),
        )
        return 2

    source_dir.mkdir(parents=True, exist_ok=True)

    try:
        api = HfApi()
        info = api.model_info(args.repo, files_metadata=True)
        siblings = list(info.siblings or [])
    except Exception as error:
        fail(
            "LOCAL_DOWNLOAD_FAILED",
            "Could not read the NLLB repository on Hugging Face. Check your internet connection.",
            str(error),
        )
        return 2

    files = [
        sibling
        for sibling in siblings
        if sibling.rfilename and allowed_file(sibling.rfilename)
    ]
    total_bytes = sum(int(getattr(sibling, "size", 0) or 0) for sibling in files)
    if not files:
        fail("LOCAL_DOWNLOAD_FAILED", "The Hugging Face repository did not list any model files.")
        return 2

    emit(
        {
            "type": "stage",
            "stage": "download",
            "message": (
                f"Downloading {args.repo} · {human_gb(total_bytes)} from Hugging Face"
                if total_bytes
                else f"Downloading {args.repo} from Hugging Face"
            ),
            "totalBytes": total_bytes,
        }
    )

    stop = threading.Event()
    monitor = threading.Thread(
        target=monitor_directory,
        args=(source_dir, "download", total_bytes, 0, stop),
        daemon=True,
    )
    monitor.start()

    try:
        snapshot_download(
            repo_id=args.repo,
            local_dir=str(source_dir),
            allow_patterns=[
                "*.bin",
                "*.json",
                "*.model",
                "*.txt",
                "*.safetensors",
                "*.spm",
            ],
            ignore_patterns=[".gitattributes", "README.md"],
            max_workers=4,
            token=os.environ.get("HF_TOKEN") or None,
        )
    except Exception as error:
        stop.set()
        monitor.join(timeout=2)
        fail(
            "LOCAL_DOWNLOAD_FAILED",
            "The NLLB download failed. Check your internet connection and free disk space, then try again.",
            str(error),
        )
        return 2
    finally:
        stop.set()
        monitor.join(timeout=2)

    weight_files = [
        file
        for file in source_dir.iterdir()
        if file.is_file()
        and file.suffix in (".bin", ".safetensors")
        and file.stat().st_size > 100_000_000
    ]
    if not weight_files:
        fail(
            "LOCAL_DOWNLOAD_INCOMPLETE",
            "The NLLB weights were not found after the download.",
            f"Looked in {source_dir}",
        )
        return 2

    emit(
        {
            "type": "stage",
            "stage": "convert",
            "message": "Converting NLLB-200 to CTranslate2 INT8. This is the slow part…",
        }
    )

    try:
        from ctranslate2.converters import TransformersConverter
    except Exception as error:
        fail(
            "LOCAL_DEPENDENCY_MISSING",
            "CTranslate2 is not installed in the local Python environment.",
            str(error),
        )
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    copy_files = [name for name in TOKENIZER_FILES if (source_dir / name).is_file()]

    stop_convert = threading.Event()
    convert_monitor = threading.Thread(
        target=monitor_directory,
        args=(output_dir, "convert", 0, EXPECTED_INT8_BYTES, stop_convert),
        daemon=True,
    )
    convert_monitor.start()

    try:
        try:
            converter = TransformersConverter(
                str(source_dir),
                load_as_float16=True,
                low_cpu_mem_usage=True,
                copy_files=copy_files,
            )
        except TypeError:
            # Older CTranslate2 releases do not support the memory-saving flags.
            converter = TransformersConverter(str(source_dir), copy_files=copy_files)

        converter.convert(
            str(output_dir),
            quantization=args.quantization,
            force=True,
        )
    except Exception as error:
        stop_convert.set()
        convert_monitor.join(timeout=2)
        fail(
            "LOCAL_CONVERSION_FAILED",
            "CTranslate2 could not convert NLLB-200 to INT8. This usually means the machine ran out of RAM during conversion.",
            str(error),
        )
        return 2
    finally:
        stop_convert.set()
        convert_monitor.join(timeout=2)

    for name in TOKENIZER_FILES:
        source = source_dir / name
        target = output_dir / name
        if source.is_file() and not target.exists():
            shutil.copy2(source, target)

    model_bin = output_dir / "model.bin"
    config_file = output_dir / "config.json"
    if not model_bin.is_file() or model_bin.stat().st_size == 0 or not config_file.is_file():
        fail(
            "LOCAL_CONVERSION_INCOMPLETE",
            "The converted model is missing its model.bin or config.json file.",
            str(output_dir),
        )
        return 2

    output_bytes = directory_size(output_dir)
    metadata = {
        "repo": args.repo,
        "quantization": args.quantization,
        "convertedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bytes": output_bytes,
        "engine": "ctranslate2",
    }
    (output_dir / "dodoi-model.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )

    source_removed = False
    keep_source = args.keep_source or os.environ.get("DODOI_KEEP_MODEL_SOURCE") == "1"
    if not keep_source:
        try:
            shutil.rmtree(source_dir)
            source_removed = True
        except OSError as error:
            log(f"Could not remove the source weights: {error}")

    emit(
        {
            "type": "stage",
            "stage": "finalize",
            "message": "Finalizing the INT8 model…",
        }
    )
    emit(
        {
            "type": "done",
            "message": "Model ready.",
            "modelBytes": output_bytes,
            "sourceRemoved": source_removed,
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("Interrupted.")
        raise SystemExit(130)
