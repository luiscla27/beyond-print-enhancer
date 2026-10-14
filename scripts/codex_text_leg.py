#!/usr/bin/env python3
"""codex_text_leg.py — the CODEX text leg for the border prompt corpus.

Tests whether the REVISED prompts survive the PRODUCT'S OWN parser and sanitizer,
end-to-end: prompt -> codex (OpenAI provider) -> JSON patch ->
parseModelOutput + validateSvg + edge-band/probe checks the gallery harness uses.

Usage (from repo root):
  python scripts/codex_text_leg.py [--rounds FILE] [--only id,id]
                                   [--leg codex|deepseek|both] [--resume]

Outputs (all under temp/scratch/):
  textleg_<legs>_<rounds>/<id>.{prompt.txt,svg,answer.json}
  textleg_<legs>_<rounds>/summary.json

No tracked file is touched.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SC = ROOT / "temp" / "scratch"

# --- key resolution (never printed) ---

def _secret(name: str) -> str:
    if k := os.environ.get(name):
        return k.strip()
    for line in (SC / "secrets.env").read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


# --- external callers ---

def build_prompt(instruction: str) -> str:
    """The PRODUCT'S OWN prompt composer (js/ai_layout.js buildMessages), the same
    wire format the generator sends — never a re-typed system prompt."""
    helper = SC / "codex_text_leg.js"
    return subprocess.run(
        ["node", "-e",
         "const t=require(process.argv[1]);let s='';process.stdin.on('data',"
         "(d)=>{s+=d});process.stdin.on('end',()=>{"
         "console.log(t.buildPrompt(s))})",
         str(helper)],
        capture_output=True, timeout=60, check=True,
        input=instruction.encode("utf-8"),
    ).stdout.decode("utf-8")


def codex_answer(prompt: str, out_file: Path) -> str:
    if out_file.exists() and out_file.stat().st_size > 20:
        return out_file.read_text(encoding="utf-8")
    bin_ = ROOT / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
    if not bin_.exists():
        bin_ = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
    if not bin_.exists():
        raise RuntimeError("codex.js not found")
    proc = subprocess.run(
        ["node", str(bin_), "exec", "--skip-git-repo-check", "-s",
         "read-only", "-o", str(out_file), "-"],
        input=prompt.encode("utf-8"), stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE, timeout=900,
    )
    if proc.returncode != 0:
        raise RuntimeError("codex.js exited %d: %s" % (
            proc.returncode, proc.stderr.decode("utf-8", "replace")[:400]))
    if not out_file.exists() or out_file.stat().st_size <= 20:
        raise RuntimeError("codex.js produced no answer file")
    return out_file.read_text(encoding="utf-8")


def deepseek_answer(prompt: str, out_file: Path) -> str:
    # Delegated to a tiny script: the seat spends a large reasoning budget
    # before emitting content, so a small max_tokens returns empty content
    # with the JSON inside `reasoning_content`.
    if out_file.exists() and out_file.stat().st_size > 20:
        return out_file.read_text(encoding="utf-8")
    helper = SC / "deepseek_call.js"
    if not helper.exists():
        raise RuntimeError("deepseek_call.js helper missing")
    proc = subprocess.run(
        ["node", str(helper)], input=prompt.encode("utf-8"),
        capture_output=True, timeout=900,
    )
    if proc.returncode != 0:
        raise RuntimeError("deepseek_call.js exited %d: %s" % (
            proc.returncode, proc.stderr.decode("utf-8", "replace")[:200]))
    text = proc.stdout.decode("utf-8")
    if len(text.strip()) <= 20:
        raise RuntimeError("deepseek_call.js returned an empty answer")
    out_file.write_text(text, encoding="utf-8")
    return text


# --- product parser ---

def parse_answer(text: str) -> dict:
    """Through the PRODUCT'S OWN parser (js/ai_layout.js parseModelOutput +
    validateSvg), via the node bridge in temp/scratch/codex_text_leg.js — the
    module cannot be imported from Python directly (it is CommonJS)."""
    helper = SC / "codex_text_leg.js"
    out = subprocess.run(
        ["node", "-e",
         "const t=require(process.argv[1]);let s='';process.stdin.on('data',"
         "(d)=>{s+=d});process.stdin.on('end',()=>{const r=t.parseAnswer(s);"
         "console.log(JSON.stringify(r))})",
         str(helper), text],
        capture_output=True, timeout=120, input=text.encode("utf-8"),
    )
    if out.returncode != 0:
        return {"ok": False, "code": "bridge_error",
                "svg": None, "error": out.stderr.decode("utf-8", "replace")[:200]}
    return json.loads(out.stdout.decode("utf-8"))


# --- probes ---

def probe(svg: str) -> dict:
    return {
        "viewBox": (re.search(r'viewBox="([^"]+)"', svg) or [None, None])[1],
        "elements": len(re.findall(r"<[a-zA-Z]", svg)),
        "paths": svg.count("<path"),
        "rects": svg.count("<rect"),
        "circles": svg.count("<circle"),
        "dasharray": "stroke-dasharray" in svg,
        "gradients": bool(re.search(r"<linearGradient|<radialGradient|url\(#", svg)),
        "styleAttr": ' style="' in svg,
        "classAttr": ' class="' in svg,
    }


# --- main ---

def main() -> None:
    args = sys.argv[1:]
    rounds_file = "border_prompts_final.json"
    only: list[str] = []
    legs = ["codex"]
    resume = False
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--rounds" and i + 1 < len(args):
            rounds_file = args[i + 1]; i += 2
        elif a == "--only" and i + 1 < len(args):
            only = args[i + 1].split(","); i += 2
        elif a == "--leg" and i + 1 < len(args):
            legs = args[i + 1].split(","); i += 2
        elif a == "--resume":
            resume = True; i += 1
        else:
            i += 1

    prompts = json.loads((SC / rounds_file).read_text(encoding="utf-8"))["prompts"]
    out_dir = SC / ("textleg_" + "+".join(legs) + "_" + re.sub(r"[^0-9]", "", rounds_file))
    out_dir.mkdir(parents=True, exist_ok=True)
    summary_path = out_dir / "summary.json"
    summary = (
        json.loads(summary_path.read_text(encoding="utf-8"))
        if resume and summary_path.exists()
        else []
    )
    seen = {e["id"] + ":" + e["leg"] for e in summary}

    for did, entry in prompts.items():
        if only and did not in only:
            continue
        for leg in legs:
            key = f"{did}:{leg}"
            if resume and key in seen:
                continue
            answer_file = out_dir / f"{did}.{leg}.answer.json"
            prompt_file = out_dir / f"{did}.{leg}.prompt.txt"
            prompt_text = build_prompt(entry["instruction"])
            prompt_file.write_text(prompt_text, encoding="utf-8")
            try:
                if leg == "codex":
                    answer = codex_answer(prompt_text, answer_file)
                else:
                    answer = deepseek_answer(prompt_text, answer_file)
            except Exception as e:
                summary.append(
                    {
                        "id": did,
                        "leg": leg,
                        "ok": False,
                        "code": f"{leg}_error",
                        "error": str(e)[:200],
                    }
                )
                continue
            r = parse_answer(answer)
            r["leg"] = leg
            r["viewBoxTarget"] = entry["viewBox"]
            if r["ok"]:
                r["probe"] = probe(r["svg"])
                (out_dir / f"{did}.{leg}.svg").write_text(r["svg"], encoding="utf-8")
            summary.append({"id": did, "leg": leg, **r})
            print(
                f"{'OK' if r['ok'] else 'REFUSED'} {did} leg={leg} {r['code']}"
                + (f" {json.dumps(r.get('probe'))}" if r["ok"] else "")
            )
            summary_path.write_text(
                json.dumps(summary, indent=2), encoding="utf-8"
            )


if __name__ == "__main__":
    main()
