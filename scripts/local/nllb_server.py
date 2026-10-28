#!/usr/bin/env python3
"""Small localhost-only NLLB translation server.

The process is started on demand by Electron and killed when the user stops the
engine. It loads a CTranslate2 INT8 model into RAM and exposes only two routes:

  GET  /health
  POST /translate   {"text": "...", "sourceCode": "eng_Latn", "targetCode": "tha_Thai"}
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

EVENT_PREFIX = "@@DODOI@@"
MAX_BODY_BYTES = 1_000_000
MAX_SOURCE_TOKENS = 800
MAX_DECODING_LENGTH = 512
MAX_OUTPUT_TOKENS = 1024

MODEL_DIR = Path(".")
TOKEN = os.environ.get("DODOI_LOCAL_TOKEN", "")
PARENT_PID = int(os.environ.get("DODOI_PARENT_PID", "0") or 0)

translator = None
tokenizer = None
loaded_at = 0.0
load_ms = 0
httpd = None
translate_lock = threading.Lock()

NO_SPACE_SCRIPTS = ("tha_Thai", "jpn_Jpan", "zho_Hans", "zho_Hant", "yue_Hant")


def emit(payload: dict) -> None:
    print(EVENT_PREFIX + json.dumps(payload, ensure_ascii=False), flush=True)


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def parent_watchdog() -> None:
    if PARENT_PID <= 0:
        return
    while True:
        try:
            if os.getppid() != PARENT_PID:
                log("Parent process exited; shutting down.")
                os._exit(0)
        except OSError:
            os._exit(0)
        time.sleep(2.0)


def token_count(text: str, source_code: str) -> int:
    return len(tokenizer.encode(text, src_lang=source_code))


def split_text(text: str, source_code: str, limit: int = MAX_SOURCE_TOKENS) -> list[str]:
    if not text.strip():
        return []
    try:
        if token_count(text, source_code) <= limit:
            return [text]
    except Exception:
        # If token counting fails, fall back to a conservative character limit.
        if len(text) <= limit * 3:
            return [text]

    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    if len(parts) > 1:
        chunks: list[str] = []
        current = ""
        for part in parts:
            candidate = f"{current} {part}".strip() if current else part
            try:
                candidate_length = token_count(candidate, source_code)
            except Exception:
                candidate_length = len(candidate) // 3
            if candidate_length <= limit:
                current = candidate
                continue

            if current:
                chunks.append(current)
            try:
                part_length = token_count(part, source_code)
            except Exception:
                part_length = len(part) // 3
            if part_length <= limit:
                current = part
            else:
                chunks.extend(split_text(part, source_code, limit))
                current = ""
        if current:
            chunks.append(current)
        return chunks

    words = re.split(r"(\s+)", text)
    if len(words) > 3:
        chunks = []
        current = ""
        for word in words:
            candidate = current + word
            try:
                candidate_length = token_count(candidate, source_code)
            except Exception:
                candidate_length = len(candidate) // 3
            if candidate_length <= limit:
                current = candidate
            else:
                if current.strip():
                    chunks.append(current.strip())
                current = word
        if current.strip():
            chunks.append(current.strip())
        if chunks:
            return chunks

    midpoint = max(1, len(text) // 2)
    return split_text(text[:midpoint], source_code, limit) + split_text(
        text[midpoint:], source_code, limit
    )


def translate_chunk(text: str, source_code: str, target_code: str) -> str:
    source_tokens = tokenizer.convert_ids_to_tokens(
        tokenizer.encode(text, src_lang=source_code)
    )
    if not source_tokens:
        return ""

    results = translator.translate_batch(
        [source_tokens],
        target_prefix=[[target_code]],
        beam_size=2,
        max_decoding_length=MAX_DECODING_LENGTH,
        max_batch_size=4,
        return_scores=False,
    )
    hypothesis = list(results[0].hypotheses[0])
    if hypothesis and hypothesis[0] == target_code:
        hypothesis = hypothesis[1:]
    if len(hypothesis) > MAX_OUTPUT_TOKENS:
        hypothesis = hypothesis[:MAX_OUTPUT_TOKENS]

    output = tokenizer.decode(
        tokenizer.convert_tokens_to_ids(hypothesis),
        skip_special_tokens=True,
    )
    return output.strip()


def translate_document(text: str, source_code: str, target_code: str) -> str:
    # Only the output language decides how translated chunks are joined.
    join_with_space = target_code not in NO_SPACE_SCRIPTS
    output_lines: list[str] = []

    for line in text.split("\n"):
        if not line.strip():
            output_lines.append("")
            continue

        chunks = split_text(line, source_code)
        translated = [translate_chunk(chunk, source_code, target_code) for chunk in chunks]
        translated = [chunk for chunk in translated if chunk]
        output_lines.append((" " if join_with_space else "").join(translated))

    return "\n".join(output_lines).strip()


class TranslationHandler(BaseHTTPRequestHandler):
    server_version = "DodoiNLLB/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format_string: str, *args) -> None:
        log(f"{self.address_string()} {format_string % args}")

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def authorized(self) -> bool:
        if not TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        if auth == f"Bearer {TOKEN}":
            return True
        self.send_json(401, {"error": {"message": "Unauthorized local request."}})
        return False

    def do_GET(self) -> None:
        if not self.authorized():
            return
        if self.path.split("?", 1)[0] != "/health":
            self.send_json(404, {"error": {"message": "Not found."}})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "model": MODEL_DIR.name,
                "device": "cpu",
                "computeType": "int8",
                "loadedAt": loaded_at,
                "loadMs": load_ms,
                "uptimeMs": int((time.time() - loaded_at) * 1000) if loaded_at else 0,
            },
        )

    def do_POST(self) -> None:
        if not self.authorized():
            return
        if self.path.split("?", 1)[0] != "/translate":
            self.send_json(404, {"error": {"message": "Not found."}})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413, {"error": {"message": "Request body is too large."}})
            return

        try:
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": {"message": "The request body is not valid JSON."}})
            return

        text = str(data.get("text") or "")
        source_code = str(data.get("sourceCode") or "eng_Latn")
        target_code = str(data.get("targetCode") or "")
        if not text.strip():
            self.send_json(400, {"error": {"message": "Type something to translate."}})
            return
        if not target_code:
            self.send_json(400, {"error": {"message": "A target language code is required."}})
            return

        started = time.time()
        try:
            with translate_lock:
                translated = translate_document(text, source_code, target_code)
        except Exception as error:
            log("Translation failed:\n" + traceback.format_exc())
            self.send_json(
                500,
                {
                    "error": {
                        "message": "The local NLLB engine could not translate this text.",
                        "detail": str(error),
                    }
                },
            )
            return

        if not translated:
            self.send_json(500, {"error": {"message": "The local engine returned an empty translation."}})
            return

        self.send_json(
            200,
            {
                "translation": translated,
                "sourceCode": source_code,
                "targetCode": target_code,
                "latencyMs": int((time.time() - started) * 1000),
            },
        )


def load_model(model_dir: Path) -> None:
    global translator, tokenizer, loaded_at, load_ms

    started = time.time()
    emit({"type": "loading", "message": "Loading the NLLB-200 INT8 model into memory…"})

    try:
        import ctranslate2
        from transformers import AutoTokenizer
    except Exception as error:
        emit(
            {
                "type": "error",
                "code": "LOCAL_DEPENDENCY_MISSING",
                "message": "The local Python runtime is missing CTranslate2 or Transformers.",
                "detail": str(error),
            }
        )
        raise SystemExit(2)

    try:
        tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        cpu_count = os.cpu_count() or 4
        translator = ctranslate2.Translator(
            str(model_dir),
            device="cpu",
            compute_type="int8",
            inter_threads=1,
            intra_threads=max(1, min(8, cpu_count // 2)),
        )
    except Exception as error:
        emit(
            {
                "type": "error",
                "code": "LOCAL_MODEL_LOAD_FAILED",
                "message": "Could not load the NLLB model. The INT8 files may be incomplete.",
                "detail": str(error),
            }
        )
        log(traceback.format_exc())
        raise SystemExit(2)

    loaded_at = time.time()
    load_ms = int((loaded_at - started) * 1000)
    log(f"Model loaded in {load_ms} ms.")


def install_signal_handlers() -> None:
    def stop(_signum, _frame) -> None:
        log("Shutdown requested.")
        if httpd is not None:
            threading.Thread(target=httpd.shutdown, daemon=True).start()

    for name in ("SIGTERM", "SIGINT"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), stop)


def main() -> int:
    global httpd

    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()

    global MODEL_DIR
    MODEL_DIR = Path(args.model_dir).expanduser().resolve()
    if not (MODEL_DIR / "model.bin").is_file():
        emit(
            {
                "type": "error",
                "code": "LOCAL_MODEL_MISSING",
                "message": "The INT8 model files are missing. Run Download & Convert again.",
                "detail": str(MODEL_DIR),
            }
        )
        return 2

    install_signal_handlers()
    threading.Thread(target=parent_watchdog, daemon=True).start()
    load_model(MODEL_DIR)

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), TranslationHandler)
        httpd.daemon_threads = True
    except OSError as error:
        emit(
            {
                "type": "error",
                "code": "LOCAL_SERVER_BIND_FAILED",
                "message": "Could not start the local translation server.",
                "detail": str(error),
            }
        )
        return 2

    port = httpd.server_address[1]
    emit({"type": "port", "port": port})
    emit(
        {
            "type": "ready",
            "port": port,
            "loadMs": load_ms,
            "model": MODEL_DIR.name,
        }
    )
    log(f"Listening on {args.host}:{port}.")

    try:
        httpd.serve_forever(poll_interval=0.5)
    finally:
        httpd.server_close()
        log("Server stopped; releasing model memory.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
