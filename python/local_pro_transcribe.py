#!/usr/bin/env python3
import argparse
import json
import sys
import time
from typing import Any, Dict, List


def _safe_num(value: Any, default: float = 0.0) -> float:
    try:
        v = float(value)
        if v != v:
            return default
        return v
    except Exception:
        return default


def _json_out(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()


def _progress(stage: str, message: str, **extra: Any) -> None:
    payload: Dict[str, Any] = {"stage": stage, "message": message}
    payload.update(extra)
    sys.stderr.write("FW_PROGRESS " + json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stderr.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description="FluxAura Local Pro Faster-Whisper bridge")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--language", default="auto")
    parser.add_argument("--word-timestamps", action="store_true")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--vad-filter", action="store_true")
    parser.add_argument("--initial-prompt", default="")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    started = time.time()

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as exc:
        _json_out({
            "ok": False,
            "error": f"faster-whisper import failed: {exc}",
            "text": "",
            "segments": [],
            "words": [],
            "language": "en",
            "duration": 0.0,
            "timings": {"totalMs": 0},
        })
        return 1

    requested_device = str(args.device or "cpu").strip().lower()
    requested_compute_type = str(args.compute_type or "int8").strip().lower()

    if requested_device == "cuda":
        try:
            import torch  # type: ignore
            if not torch.cuda.is_available():
                _json_out({
                    "ok": False,
                    "error": "CUDA was requested but no CUDA-capable GPU is available.",
                    "text": "",
                    "segments": [],
                    "words": [],
                    "language": "en",
                    "duration": 0.0,
                    "timings": {"totalMs": 0},
                })
                return 1
        except Exception:
            _json_out({
                "ok": False,
                "error": "CUDA was requested but PyTorch CUDA runtime is unavailable.",
                "text": "",
                "segments": [],
                "words": [],
                "language": "en",
                "duration": 0.0,
                "timings": {"totalMs": 0},
            })
            return 1

    _progress("model-load", f"Loading {args.model} model ({requested_device}/{requested_compute_type})...")
    model = WhisperModel(args.model, device=requested_device, compute_type=requested_compute_type)

    language = None if args.language == "auto" else args.language

    transcribe_started = time.time()
    _progress("transcribe-start", "Transcription started.")
    segments_iter, info = model.transcribe(
        args.audio,
        language=language,
        beam_size=max(1, int(args.beam_size)),
        vad_filter=bool(args.vad_filter),
        word_timestamps=bool(args.word_timestamps),
        initial_prompt=(args.initial_prompt or None),
    )

    segments: List[Dict[str, Any]] = []
    words: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []
    first_start = None
    last_end = 0.0
    last_heartbeat = transcribe_started

    for seg in segments_iter:
        start = _safe_num(getattr(seg, "start", 0.0), 0.0)
        end = _safe_num(getattr(seg, "end", start + 0.5), start + 0.5)
        text = str(getattr(seg, "text", "") or "").strip()
        if not text:
            continue

        segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
        full_text_parts.append(text)

        if first_start is None:
            first_start = start
        if end > last_end:
            last_end = end

        seg_words = getattr(seg, "words", None)
        if isinstance(seg_words, list):
            for w in seg_words:
                w_text = str(getattr(w, "word", "") or "")
                w_start = _safe_num(getattr(w, "start", start), start)
                w_end = _safe_num(getattr(w, "end", w_start + 0.2), w_start + 0.2)
                if not w_text.strip():
                    continue
                words.append({"start": round(w_start, 3), "end": round(w_end, 3), "text": w_text})

        now = time.time()
        if (now - last_heartbeat) >= 1.0:
            _progress(
                "transcribing",
                f"Transcribed {len(segments)} segments...",
                segmentCount=len(segments),
                elapsedSec=round(now - transcribe_started, 1),
            )
            last_heartbeat = now

    total_ms = int((time.time() - started) * 1000)
    transcribe_ms = int((time.time() - transcribe_started) * 1000)

    text = " ".join(full_text_parts).strip()
    duration = round(max(last_end, _safe_num(getattr(info, "duration", 0.0), 0.0)), 3)

    _progress(
        "done",
        "Transcription complete.",
        segmentCount=len(segments),
        wordCount=len(words),
        elapsedSec=round(time.time() - transcribe_started, 1),
    )

    _json_out({
        "ok": True,
        "text": text,
        "segments": segments,
        "words": words,
        "language": str(getattr(info, "language", "en") or "en"),
        "duration": duration,
        "timings": {
            "totalMs": total_ms,
            "transcribeMs": transcribe_ms,
            "firstStartSec": round(first_start, 3) if first_start is not None else None,
            "segmentCount": len(segments),
            "wordCount": len(words),
        },
    })
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        _json_out({
            "ok": False,
            "error": f"local_pro_transcribe.py crashed: {exc}",
            "text": "",
            "segments": [],
            "words": [],
            "language": "en",
            "duration": 0.0,
            "timings": {"totalMs": 0},
        })
        raise
