#!/usr/bin/env python3
"""Vision-gate dispatcher for byok_ai_layout_20260915 (AC-V1-lite), reviewer-selectable.

Derived from scripts/drag_ux_visual_gate.py, with the ONE thing that file could not do made
possible: pick the reviewer. The fleet rule for visual gates is that Muse Spark is primary
and MiniMax M3 is Muse's last-resort fallback, and that a visual gate NEVER falls back to a
text-only model (DeepSeek Flash is not a visual reviewer, so it is not wired here at all).

Key chain: process env -> temp/secrets.env (KEY=VALUE lines). Values are never printed, only
a prefix + length, so a run log cannot leak a credential — the same discipline the product's
own BYOK code is held to.

The scope block is verbatim from the fleet's visual-review skill: spatial/visual assertions
only, no OCR, and an explicit "hard to please" instruction that a score may only be raised
when the acceptance criterion is visible in the frame.

Usage:
  python scripts/byok_vision_gate.py --muse    <collage.png> <brief.md> <out.txt>
  python scripts/byok_vision_gate.py --minimax <collage.png> <brief.md> <out.txt>
"""
import base64
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "perf"))
from model_call_telemetry import call_model  # noqa: E402  (track runtime_perf_20261015)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

REVIEWERS = {
    "muse": {
        "model": "muse-spark-1.2-contributor",
        "base_url": os.environ.get("MUSE_SPARK_API_URL", "https://api.meta.ai/v1").rstrip("/"),
        "key_env": "MUSE_SPARK_API_KEY",
    },
    "minimax": {
        "model": "MiniMax-M3",
        "base_url": "https://api.minimax.io/v1",
        "key_env": "MINIMAX_API_KEY",
    },
}

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
    "CRITERION <id>: MET | NOT MET - <one-line pixel justification>"
)


def resolve_key(env_name):
    key = os.environ.get(env_name, "").strip()
    if key:
        return key
    secrets = os.path.join(ROOT, "temp", "secrets.env")
    if os.path.isfile(secrets):
        for line in open(secrets, encoding="utf-8", errors="replace"):
            line = line.strip()
            if line.startswith("export "):
                line = line[len("export "):]
            if line.startswith(env_name + "="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                if v:
                    return v
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
            v, _ = winreg.QueryValueEx(k, env_name)
            if v:
                return str(v).strip()
    except Exception:
        pass
    raise SystemExit("%s not resolvable (env, temp/secrets.env, or HKCU\\Environment)" % env_name)


def extract_text(resp_bytes):
    """The reviewer's text, ALWAYS a string.

    MEASURED DEFECT, FIXED 2026-10-06 (track byok_border_prompt_adoption_20261006). This used
    to return `message.content` raw, and a REASONING-HEAVY answer can legitimately be null:
    Muse Spark spends its whole completion budget inside `reasoning_tokens` and returns
    `content: null` with `finish_reason: "length"`. MEASURED on round-31's canonical cells —
    at `max_tokens` 8000 the SAME image that answers in ~5000 tokens came back null with
    8000/8000 reasoning tokens; at 16000 it answered (5239 completion, 5178 of them reasoning).
    The old contract turned that into `write() argument must be str, not None` inside the
    caller, i.e. a crash in the seat driver instead of a recorded answer — the exact "a
    reasoning-only answer is not evidence" class the archived track already met at 2000 tokens.
    So: the budget is raised, and an unreadable answer is returned as a NAMED string carrying
    the finish reason and the reasoning-token count, which is what a caller must record.
    """
    data = json.loads(resp_bytes.decode("utf-8", errors="replace"))
    try:
        choice = data["choices"][0]
        msg = choice.get("message") or {}
        content = msg.get("content")
        if isinstance(content, str) and content.strip():
            return content
        usage = data.get("usage") or {}
        details = usage.get("completion_tokens_details") or {}
        return (
            "(NO READABLE ANSWER — finish_reason=%s, completion_tokens=%s, reasoning_tokens=%s; "
            "a reasoning-only completion is NOT a verdict and must not be read as one)"
            % (choice.get("finish_reason"), usage.get("completion_tokens"),
               details.get("reasoning_tokens"))
        )
    except (KeyError, IndexError, TypeError):
        return json.dumps(data, indent=2)[:2000]


def dispatch(review, image_path, brief_path):
    key = resolve_key(review["key_env"])
    print("reviewer: %s @ %s (key prefix=%s... len=%d)" % (
        review["model"], review["base_url"], key[:6], len(key)))
    frame_b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    brief = open(brief_path, encoding="utf-8").read()
    system = SYSTEM_SCOPE + (
        "\nDo NOT include a reasoning block in your answer - output only the "
        "criterion lines with a short justification each, then stop."
    )
    payload = {
        "model": review["model"],
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": "data:image/png;base64," + frame_b64, "detail": "high"}},
                    {"type": "text", "text": brief},
                ],
            },
        ],
        "temperature": 0.0,
        "max_tokens": 16000,
    }
    req = urllib.request.Request(
        review["base_url"] + "/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST",
    )

    # BUDGETED + OBSERVED (track runtime_perf_20261015). Before this, the call's only bound was
    # `urlopen(timeout=420)`, and a socket timeout bounds each READ rather than the whole call, so a
    # slowly-trickling response could outlive it; and the call emitted no terminal event anywhere, so
    # the area's own model traffic was invisible. The declared budget for this site lives in
    # scripts/perf/budgets.json (with its reason), and the terminal event lands in
    # temp/perf/model_calls.jsonl.
    def transport(timeout_s):
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            return r.read()

    result = call_model(
        site="scripts/byok_vision_gate.py",
        role="reasonix-agent",
        model=review["model"],
        provider=review["base_url"],
        fingerprint_material=frame_b64 + "\n" + brief,
        transport=transport,
    )
    if not result.ok:
        raise RuntimeError(
            "vision seat call %s after %dms (class=%s, attempts=%s, error=%s)"
            % (result.status, result.duration_ms, result.request_class, result.attempts,
               result.error))
    return extract_text(result.value)


def main():
    args = sys.argv[1:]
    which = "muse"
    if args and args[0] in ("--muse", "--minimax"):
        which = args.pop(0)[2:]
    if len(args) != 3:
        raise SystemExit(
            "usage: byok_vision_gate.py [--muse|--minimax] <collage.png> <brief.md> <out.txt>")
    image_path, brief_path, out_path = args
    verdict = dispatch(REVIEWERS[which], image_path, brief_path)
    parent = os.path.dirname(os.path.abspath(out_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(verdict)
    print("verdict written: %s (%d chars)" % (out_path, len(verdict)))


if __name__ == "__main__":
    main()
