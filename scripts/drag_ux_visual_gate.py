#!/usr/bin/env python3
"""
Visual-gate dispatcher for drag_ux_overhaul_20260909 (and reusable for any
track whose visual-gate protocol permits it).

Sends a collage image + a validation brief to a vision-capable model and
writes the raw verdict to a file. Per the track's visual_gate_protocol.md:
reviewers are ALWAYS hard to please and may only raise a score when the
acceptance criteria are met in the frame pixels — the brief must say so, and
this dispatcher never post-processes the verdict.

Reviewer selection (fleet rules): Muse Spark primary is unavailable when no
MUSE_SPARK_API_KEY resolves; MiniMax M3 is the documented Muse fallback and
is used here. NEVER falls back to a text-only reviewer.

Key chain: process env -> temp/secrets.env (KEY=VALUE lines). Values are
never printed (only prefix + length).

Usage:
  python scripts/drag_ux_visual_gate.py <collage.png> <brief.md> <out.txt> [--self-test]
"""
import base64
import json
import os
import re
import sys
import urllib.request

MODEL = "MiniMax-M3"
BASE_URL = "https://api.minimax.io/v1"


def resolve_key():
    key = os.environ.get("MINIMAX_API_KEY", "")
    if not key:
        secrets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "temp", "secrets.env")
        if os.path.isfile(secrets):
            for line in open(secrets, encoding="utf-8", errors="replace"):
                line = line.strip()
                if line.startswith("MINIMAX_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"')
                    break
    if not key:
        raise SystemExit("MINIMAX_API_KEY not resolvable (env or temp/secrets.env)")
    return key


SYSTEM_SCOPE = (
    "YOU ARE A SPATIAL/VISUAL VALIDATION REVIEWER. YOU ARE BLOCKED FROM: text "
    "extraction, OCR, label reading, performance or frame-rate adjudication, and "
    "any numeric benchmarking. OUTPUT ONLY: spatial and visual assertions about "
    "the image (layout, geometry, colors, containment, alignment, artifacts) and "
    "whether each acceptance criterion is MET or NOT MET in the frame pixels, "
    "naming the specific defect when NOT MET. YOU ARE ALWAYS HARD TO PLEASE: do "
    "NOT raise a score unless the criterion is actually satisfied by what is "
    "visible in the image; a claim not backed by pixels must be marked NOT MET. "
    "Respond in English with one line per criterion: "
    "CRITERION <id>: MET | NOT MET — <one-line pixel justification>"
)


def extract_json_text(resp_bytes):
    """Extract assistant message text from an OpenAI-compatible response."""
    data = json.loads(resp_bytes.decode("utf-8", errors="replace"))
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return json.dumps(data, indent=2)[:2000]


def dispatch(key, image_path, brief_path):
    frame_b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    brief = open(brief_path, encoding="utf-8").read()
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_SCOPE},
            {
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/png;base64,{frame_b64}", "detail": "high"}},
                    {"type": "text", "text": brief},
                ],
            },
        ],
        "temperature": 0.0,
        "max_tokens": 8000,
    }
    payload["messages"][0]["content"] += (
        "\nDo NOT include a <think> reasoning block in your answer — "
        "output only the CRITERION lines and a short justification per "
        "criterion, then stop."
    )
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        return extract_json_text(r.read())


def self_test():
    """Dry-run: verify payload + extraction logic without any HTTP call."""
    fake = json.dumps({
        "choices": [{"message": {"content": "CRITERION AC-1: MET — ghost visible mid-drag"}}]
    }).encode()
    out = extract_json_text(fake)
    assert "AC-1: MET" in out, out
    print("self-test OK")


def main():
    args = sys.argv[1:]
    if "--self-test" in args:
        self_test()
        return
    if len(args) != 3:
        raise SystemExit(
            "usage: python scripts/drag_ux_visual_gate.py <collage.png> <brief.md> <out.txt> [--self-test]"
        )
    image_path, brief_path, out_path = args
    key = resolve_key()
    print(f"reviewer: {MODEL} (key prefix={key[:6]}… len={len(key)})")
    verdict = dispatch(key, image_path, brief_path)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(verdict)
    print(f"verdict written: {out_path} ({len(verdict)} chars)")


if __name__ == "__main__":
    main()
