#!/usr/bin/env python3
"""agy_oauth_bridge.py — complete the AGY Google-OAuth sign-in round trip over
Telegram (dndbeyond-printenhance's copy of the fleet bridge; the visual gates'
AGY reviewer rung and the codex lane's fallback backend both recover through it).

WHY: AGY (Antigravity CLI) authenticates with the Google AI Code OAuth
subscription. When the stored token is missing/expired, `agy -p` prints a
confirmation URL (accounts.google.com/...) and waits for the authorization
code on stdin — but agent sessions cannot open a browser, and the bot used to
have no way to receive the code back (the user's reply was just queued and the
pending login expired). This bridge closes the loop:

  1. it runs AGY with a LIVE stdin and detects the confirmation URL;
  2. it sends the user a CLICKABLE sign-in link to their Telegram chat
     (MarkdownV2 link — underscores in snake_case params survive) with the
     instruction to reply `/agyc <code>`;
  3. the bot gateway (reasonix.exe, `/agyc` command) writes the code to
     the shared drop dir (<project>/temp/agy_oauth/code.txt) while this
     bridge's pending marker exists;
  4. the bridge pastes the code into the waiting AGY process's stdin, AGY
     exchanges it (PKCE), stores the token, and reports AUTH OK.

The code is bound by PKCE to the process that printed the URL — it can ONLY
be fed to that same live process (a fresh AGY run starts a new challenge), so
the wait loop keeps the process alive and the URL it sends is always the live
one. The URL itself is never logged, never written to a file, and redacted
from all output; the code is deleted from the drop dir the moment it is read.

USAGE (integration):
    from agy_oauth_bridge import wait_for_code
    ok, summary = wait_for_code(agy_cmd, model, effort, print_timeout, wait_seconds)

USAGE (CLI):
    # Probe auth state; if AGY needs sign-in, enter the live wait loop and
    # complete the login (waits up to --wait-code seconds for /agyc):
    python tools/agy_oauth_bridge.py --check [--agy-cmd <exe>]
        [--model gemini-3.8-flash] [--wait-code 480]

    # Test extraction/redaction on canned text (no network):
    python tools/agy_oauth_bridge.py --probe "https://accounts.google.com/o/oauth2/v2/auth?client_id=x"

    # Manually push a sign-in link to the user's Telegram (recovery):
    python tools/agy_oauth_bridge.py --send <url>

LIVENESS / WINDOW (2026-08-19 hardening):
    * AGY prints the URL and then accepts the code on stdin for a FIXED ~60 s
      (measured on agy 1.1.15: exits at ~60.5 s with --print-timeout 60s AND at
      ~61.0 s with --print-timeout 120s — the flag caps, never extends, the
      wait). The bridge waits at most AGY_MAX_STDIN_WAIT and the Telegram
      caption tells the user to reply within ~1 minute. NEVER wrap this bridge
      in a shell `timeout` shorter than the wait — the wait must outlive the
      user's reply, and a killed bridge must not leave a trusted marker.
    * While waiting, the bridge HEARTBEATS <drop>/pending.txt every 15 s. The
      bot gateway only accepts /agyc when that marker is fresher than 150 s
      (shared TTL), so a bridge killed by a short timeout/hard kill cannot
      leave a marker the gateway keeps trusting ("captured" with nobody
      listening). Stale markers are cleaned by the next run; a FRESH marker
      makes a second run refuse (no stacked links).
    * `--agy-cmd` defaults to AGY_CMD env -> PATH -> AppData\\Local\\agy\\bin,
      so the documented command works in agent shells where `agy` is absent.
    * AUTO-TRIGGER RATE LIMIT (2026-08-20): auto_trigger claims a cooldown
      slot (`<drop>/last_trigger.txt`, O_CREAT|O_EXCL) ATOMICALLY in the parent
      BEFORE spawning the child, so at most ONE sign-in link per project per
      TRIGGER_COOLDOWN_SECONDS (15 min). Repeated gate failures within the
      window get "already sent — reply /agyc to it" instead of a stacked
      bridge. This fixes the 2026-08-19/20 spam: 20 links in ~16 h on
      HighResUppercore, every wait timing out, with concurrent bridges
      (interleaved log lines) racing on code.txt across PKCE challenges.
    * RE-ARM ON TIMEOUT: with `--rearm N` (auto_trigger passes REARM_ATTEMPTS=3)
      the bridge re-runs the live wait up to N times from ONE trigger, each
      with a FRESH AGY challenge + fresh link, so the user gets several minutes
      of total window instead of one 55 s shot.

ENV:
    AGY_OAUTH_CONTROL_URL  — bot gateway /send endpoint (default THIS project's
                             bot: http://127.0.0.1:37918/send for
                             dndbeyond-printenhance)
    AGY_OAUTH_CHAT_ID      — the user's Telegram chat id (default 8747671286)
    AGY_OAUTH_DROP_DIR     — shared drop dir (default <project root>/temp/agy_oauth;
                             the gateway writes code.txt here on /agyc)

SECURITY:
    * The OAuth URL is one-time/confirmational and user-scoped — it is sent ONLY
      to the project's own Telegram chat (the user's chat, per AGENTS.md), never
      logged, never written to any file, and redacted from gate logs.
    * The authorization code is written to the drop dir by the gateway only
      while a pending marker exists, delivered atomically (tmp+rename), deleted
      by this bridge as soon as it is read, and never echoed.
    * The Telegram control API is the localhost bot gateway
      (http://127.0.0.1:37915/send, per-project bot chat) — see AGENTS.md
      "Telegram file delivery".
"""
import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request

# Google OAuth authorization/confirmation URLs printed by AGY during the
# consumer-OAuth flow (accounts.google.com/o/oauth2/...; also covers bare
# accounts.google.com continuation URLs). HOST BOUNDARY ENFORCED: after
# ".com" only a path (/...), whitespace, or end-of-string is accepted — a
# lookalike host like accounts.google.com.evil.com does NOT match.
OAUTH_URL_RE = re.compile(
    r"https://accounts\.google\.com(?:/[^\s\"'<>)\]]*)?(?![A-Za-z0-9.\-])")

# Telegram delivery — this project's bot chat ONLY (AGENTS.md "Telegram file
# delivery"; the user rejects cross-project delivery). Overridable via env.
CONTROL_URL = os.environ.get("AGY_OAUTH_CONTROL_URL", "http://127.0.0.1:37918/send")
CHAT_ID = os.environ.get("AGY_OAUTH_CHAT_ID", "8747671286")
FALLBACK_TOKEN = "telegram-control-token-change-me"

REDACTED = "<oauth-confirmation-link-sent-to-user-via-telegram>"

# Drop dir: where the bot gateway (`/agyc`) and this bridge exchange the
# authorization code. Default <project root>/temp/agy_oauth — the gateway runs
# with the project dir as its cwd, so both sides agree on the path.
DEFAULT_WAIT_SECONDS = 480  # Google's pending-login window; keep under it
PENDING_MARKER = "pending.txt"
CODE_FILE = "code.txt"

# AGY's own stdin wait (measured 2026-08-19, agy 1.1.15): `agy -p` prints the
# confirmation URL and then accepts the code on stdin for a FIXED ~60 s
# (verified: exits at ~60.5 s with --print-timeout 60s AND at ~61.0 s with
# --print-timeout 120s; the flag only caps, never extends, the wait). The
# bridge therefore waits at most AGY_MAX_STDIN_WAIT for the code and tells the
# user to reply within ~1 minute; a longer wait is impossible with one AGY
# process (PKCE binds the code to it). Re-run (or the gate auto-trigger) arms a
# fresh link.
AGY_MAX_STDIN_WAIT = 55

# Liveness contract with the bot gateway (internal/bot/gateway.go, shared
# binary): while this bridge is waiting for /agyc it HEARTBEATS pending.txt
# every HEARTBEAT_SECONDS; the gateway only accepts a code when the marker is
# fresher than PENDING_TTL_SECONDS. A bridge killed by a short shell timeout or
# a hard kill therefore cannot leave a marker that the gateway keeps trusting:
# after PENDING_TTL_SECONDS the gateway honestly refuses ("no login waiting")
# and the next bridge run cleans the stale marker. Keep the Go constant
# (agyOAuthPendingTTL) in lockstep with PENDING_TTL_SECONDS.
HEARTBEAT_SECONDS = 15
PENDING_TTL_SECONDS = 150

# Auto-trigger rate limit (2026-08-20): the visual gates call auto_trigger on
# EVERY auth-required AGY failure, so without a cooldown the user got a fresh
# sign-in link every few minutes (20 links in ~16 h on HighResUppercore, all# timed out). TRIGGER_COOLDOWN_SECONDS bounds how often ONE project may push a
# new link; within the window auto_trigger refuses and points at the existing
# one. The marker is claimed ATOMICALLY by the parent BEFORE spawning so the
# guard is effective immediately (the child only writes pending.txt after its
# ~60-90 s probe — the old check raced and stacked concurrent bridges, which
# also stole each other's code.txt across PKCE challenges).
TRIGGER_MARKER = "last_trigger.txt"
TRIGGER_COOLDOWN_SECONDS = 900  # 15 min between auto-triggered links
REARM_ATTEMPTS = 3              # one trigger -> up to 3 live waits (fresh link each)
REARM_GAP_SECONDS = 30          # gap between re-arm waits

AGY_STDIN_WAIT_GRACE_SECONDS = 30  # extra print budget after the code is fed


def extract_oauth_url(text):
    """Return the first Google OAuth URL in `text`, or None."""
    if not text:
        return None
    m = OAUTH_URL_RE.search(text)
    return m.group(0) if m else None


def redact_oauth_urls(text):
    """Replace any Google OAuth URL in `text` with a placeholder (for logs)."""
    if not text:
        return text
    return OAUTH_URL_RE.sub(REDACTED, text)


def _resolve_control_token():
    """Token chain: process env -> temp/secrets.env -> hardcoded fallback
    (the AGENTS.md documented fallback; the localhost gateway accepts it)."""
    tok = os.environ.get("REASONIX_BOT_CONTROL_TOKEN", "").strip()
    if tok:
        return tok
    secrets = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "temp", "secrets.env")
    try:
        with open(secrets, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("export "):
                    line = line[len("export "):]
                if line.startswith("REASONIX_BOT_CONTROL_TOKEN="):
                    v = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if v:
                        return v
    except OSError:
        pass
    return FALLBACK_TOKEN


def send_telegram_message(text):
    """POST the text to the project's Telegram bot chat. Returns (ok, detail).

    WARNING (security): if the control token resolves to the documented
    FALLBACK_TOKEN (no REASONIX_BOT_CONTROL_TOKEN in env/secrets.env), the
    localhost gateway accepts that constant — a KNOWN pre-existing local
    attack surface of the bot config, NOT something this bridge introduces.
    It is used only to keep the user-mandated OAuth-link delivery working;
    a loud stderr warning is emitted whenever it is used so degraded auth is
    never silent. Set REASONIX_BOT_CONTROL_TOKEN to remove the warning.
    """
    token = _resolve_control_token()
    if token == FALLBACK_TOKEN:
        sys.stderr.write(
            "[agy_oauth_bridge] WARNING: using the documented FALLBACK control token "
            "(REASONIX_BOT_CONTROL_TOKEN not set). Any local process can already POST "
            "to the bot gateway with this constant — set REASONIX_BOT_CONTROL_TOKEN "
            "in env or temp/secrets.env to harden.\n")
    payload = json.dumps({
        "connection_id": "telegram",
        "chat_id": CHAT_ID,
        "text": text,
        "media_urls": [],
    }).encode("utf-8")
    req = urllib.request.Request(
        CONTROL_URL, data=payload,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", "replace")
            return True, f"telegram http {resp.status}: {body[:120]}"
    except Exception as e:  # network / gateway down / 4xx
        return False, f"telegram send failed: {e}"


def build_auth_caption(url, prompt_extra=""):
    """The Telegram message for a live sign-in link. The URL is delivered as a
    MarkdownV2 LINK ([label](url)) — link URLs only escape \\ and ')', so the
    underscores in snake_case query params (client_id, user_code, ...) survive
    the gateway's MarkdownV2 conversion and the link stays clickable (verified
    2026-08-18: bare-URL text had every underscore stripped as italic)."""
    caption = (
        "AGY (Antigravity CLI) needs you to complete Google sign-in.\n"
        "1. Open this link in an ALREADY-LOGGED-IN account and confirm:\n"
        "[Open the AGY sign-in link](" + url + ")\n"
        "2. After confirming, the browser shows an authorization code.\n"
        "3. Reply to THIS bot with:\n"
        "/agyc <the code shown in the browser>\n"
        "The code expires in about a minute — reply quickly. If it expires, "
        "send /agylogin for a fresh link whenever you're ready."
    )
    if prompt_extra:
        caption += "\n\n" + prompt_extra
    return caption


def handle_auth_required(agy_output, prompt_extra=""):
    """Legacy helper: detect an OAuth URL in AGY output and send the sign-in
    instructions to Telegram. Returns 'sent' | 'no_url' | 'send_failed:...' |
    'none'. NOTE: the URL in already-returned output belongs to a DEAD process
    (it failed fast on stdin EOF) — prefer wait_for_code() so the user always
    gets the LIVE link and the code can actually complete the login.
    """
    url = extract_oauth_url(agy_output or "")
    if url is None:
        return "none"
    ok, detail = send_telegram_message(build_auth_caption(url, prompt_extra))
    return "sent" if ok else f"send_failed:{detail}"


def _drop_dir():
    d = os.environ.get("AGY_OAUTH_DROP_DIR", "").strip()
    if d:
        return d
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(project_root, "temp", "agy_oauth")


def _resolve_agy_cmd():
    """Locate the agy executable WITHOUT relying on PATH alone: agent shells
    often lack `agy` (the gates use tools/vision_engine.resolve_agy_cmd for the
    same reason). Chain: AGY_CMD env -> PATH -> the known Antigravity install
    dir (C:\\Users\\<user>\\AppData\\Local\\agy\\bin)."""
    cmd = os.environ.get("AGY_CMD", "").strip()
    if cmd:
        return cmd
    cmd = shutil.which("agy")
    if cmd:
        return cmd
    candidate = os.path.join(os.path.expanduser("~"),
                             "AppData", "Local", "agy", "bin", "agy.exe")
    if os.path.isfile(candidate):
        return candidate
    return "agy"  # let subprocess raise FileNotFoundError with a clear message


def _pending_fresh(path):
    """True when `path` (pending.txt) exists and is fresher than the TTL —
    i.e. a live bridge is heartbeating it. A stale marker means the wait that
    armed it is dead (killed bridge) and must never be trusted."""
    try:
        return (time.time() - os.path.getmtime(path)) < PENDING_TTL_SECONDS
    except OSError:
        return False


def _trigger_fresh(path):
    """True when `path` (last_trigger.txt) exists and is fresher than the
    auto-trigger cooldown — i.e. a sign-in link was already pushed recently."""
    try:
        return (time.time() - os.path.getmtime(path)) < TRIGGER_COOLDOWN_SECONDS
    except OSError:
        return False


def _claim_trigger(drop):
    """Atomically claim the auto-trigger cooldown slot (parent side, BEFORE
    spawning the child): create last_trigger.txt with O_CREAT|O_EXCL so two
    concurrent gate failures cannot both pass the guard. Returns True when
    this call won the slot (or the old slot was stale), False when a fresh
    slot exists (a link was already sent within the cooldown)."""
    try:
        os.makedirs(drop, exist_ok=True)
    except OSError:
        return False
    path = os.path.join(drop, TRIGGER_MARKER)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    except OSError:
        if not _trigger_fresh(path):
            # Stale slot: reclaim it (a dead bridge must not block forever).
            try:
                fd = os.open(path, os.O_WRONLY | os.O_TRUNC)
            except OSError:
                return False
        else:
            return False
    try:
        os.write(fd, str(time.time()).encode("ascii"))
    finally:
        os.close(fd)
    return True


def auto_trigger(agy_cmd):
    """Spawn a DETACHED `--check` wait so the LIVE sign-in link reaches the
    user's Telegram automatically when a gate hits auth-required (user-mandated
    2026-08-19; installed in every project's gate). The child runs THIS module
    with its own console/process group (CREATE_NO_WINDOW + DETACHED_PROCESS +
    CREATE_NEW_PROCESS_GROUP, breakaway where the job allows), so it survives
    the gate's exit, shell `timeout`s, and session teardown. It heartbeats
    <drop>/pending.txt every 15 s; the gateway only accepts /agyc while that
    marker is fresher than PENDING_TTL_SECONDS.

    Rate limit (2026-08-20): the cooldown slot is claimed ATOMICALLY here in
    the parent, so at most ONE sign-in link per project per
    TRIGGER_COOLDOWN_SECONDS — repeated gate failures within the window just
    point at the existing link instead of stacking bridges (the old guard only
    checked pending.txt, which the child writes ~60-90 s after spawn, so
    concurrent gate failures all passed it and spammed the user; stacked
    bridges also raced on code.txt and broke each other's PKCE round trips).

    The child inherits REASONIX_BOT_CONTROL_TOKEN when a real token resolves,
    so the send never falls back to the documented constant.

    Returns a short human-readable status for the gate's failure note (the URL
    is never logged)."""
    bridge = os.path.abspath(__file__)
    drop = _drop_dir()
    try:
        if _pending_fresh(os.path.join(drop, PENDING_MARKER)):
            return ("a sign-in wait is already active (no new link sent — "
                    "reply /agyc to the existing one)")
    except OSError:
        pass
    if not _claim_trigger(drop):
        return ("a sign-in link was already sent within the last "
                f"{TRIGGER_COOLDOWN_SECONDS // 60} min (no new link sent — "
                "reply /agyc to the existing one)")
    try:
        logf = open(os.path.join(drop, "auto_trigger.log"), "ab")
    except OSError as e:
        return f"bridge spawn failed (drop dir): {e}"
    argv = [sys.executable, bridge, "--check", "--agy-cmd", agy_cmd,
            "--wait-code", "480", "--rearm", str(REARM_ATTEMPTS)]
    env = dict(os.environ)
    tok = _resolve_control_token()
    if tok and tok != FALLBACK_TOKEN:
        env["REASONIX_BOT_CONTROL_TOKEN"] = tok
    flags = 0
    if os.name == "nt":
        flags = (getattr(subprocess, "CREATE_NO_WINDOW", 0)
                 | getattr(subprocess, "DETACHED_PROCESS", 0)
                 | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                 | getattr(subprocess, "CREATE_BREAKAWAY_FROM_JOB", 0))
    try:
        subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                         stdout=logf, stderr=subprocess.STDOUT,
                         creationflags=flags, close_fds=True, env=env)
        logf.close()
        return ("the sign-in link was auto-sent to your Telegram (bridge "
                "auto-triggered)")
    except OSError:
        # A job that forbids breakaway fails CreateProcess with the flag set.
        try:
            subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                             stdout=logf, stderr=subprocess.STDOUT,
                             creationflags=(flags
                                            & ~getattr(subprocess,
                                                       "CREATE_BREAKAWAY_FROM_JOB", 0)),
                             close_fds=True, env=env)
            logf.close()
            return ("the sign-in link was auto-sent to your Telegram (bridge "
                    "auto-triggered)")
        except OSError as e:
            return f"bridge spawn failed: {e}"


def _cleanup_stale(drop):
    """Remove marker/code leftovers from a DEAD run: a stale authorization
    code is bound to a dead PKCE challenge and must never be fed to a new AGY
    process, and a stale pending marker would let the gateway accept /agyc
    before this flow's own URL is out. NEVER removes a FRESH marker (a live
    bridge is waiting on it) — callers must check _pending_fresh() first."""
    for name in (PENDING_MARKER, CODE_FILE, CODE_FILE + ".tmp"):
        try:
            os.remove(os.path.join(drop, name))
        except OSError:
            pass


def _read_code(path):
    """Read + delete the code the gateway dropped. Returns the code or None
    (missing / empty / absurd / multiline). The gateway writes atomically
    (tmp + rename), so a seen file is always complete."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            code = f.read().strip()
        os.remove(path)
    except OSError:
        return None
    if not code or len(code) > 4096 or any(c in code for c in "\r\n"):
        return None
    return code


def wait_for_code(agy_cmd, model, effort, print_timeout, wait_seconds,
                  prompt_extra=""):
    """Complete the AGY Google sign-in round trip.

    Runs `agy -p "hi"` with a LIVE stdin, sends the confirmation URL to
    Telegram (the live one, from this very process), writes the pending marker
    so the bot gateway accepts /agyc, polls the drop dir for the code the
    user replied with, pastes it into AGY's stdin, and waits for AGY to finish
    the exchange.

    NOTE ON THE WINDOW (measured 2026-08-19): AGY accepts the code on stdin for
    a FIXED ~60 s (independent of --print-timeout — verified with 60s and 120s
    flags). This bridge therefore waits at most AGY_MAX_STDIN_WAIT and the
    caption tells the user to reply within ~1 minute; a fresh link requires a
    re-run. The pending marker is HEARTBEATED every HEARTBEAT_SECONDS so the
    gateway can tell this wait is alive; a bridge killed by a short shell
    timeout or a hard kill leaves a marker that goes stale after
    PENDING_TTL_SECONDS and is refused by the gateway + cleaned by the next
    run. SIGINT/SIGTERM also clean the marker best-effort (Windows
    TerminateProcess cannot run handlers, so the TTL is the real backstop).

    Returns (ok, summary). The URL and code never appear in the summary.
    """
    drop = _drop_dir()
    try:
        os.makedirs(drop, exist_ok=True)
    except OSError as e:
        return False, f"drop dir unavailable: {e}"
    pending_path = os.path.join(drop, PENDING_MARKER)
    code_path = os.path.join(drop, CODE_FILE)

    # Concurrency guard: if a LIVE wait is already armed (fresh heartbeat), do
    # NOT clean its marker and do NOT stack a second link/AGY challenge — the
    # user should act on the existing one. Only stale leftovers are removed.
    if _pending_fresh(pending_path):
        return False, ("a sign-in wait is already active — no new link sent; "
                       "reply /agyc <code> to the existing one (or wait "
                       f"{PENDING_TTL_SECONDS}s for it to expire)")
    _cleanup_stale(drop)

    argv = [agy_cmd, "-p", "hi", "--model", model, "--effort", effort,
            "--output-format", "json", "--disable-slash-commands",
            "--print-timeout", f"{print_timeout}s"]
    try:
        proc = subprocess.Popen(
            argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, encoding="utf-8",
            errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except FileNotFoundError:
        return False, f"agy executable not found: {agy_cmd}"

    lines = []

    def _reader():
        try:
            for line in proc.stdout:
                lines.append(line)
        except Exception:
            pass

    threading.Thread(target=_reader, daemon=True).start()

    # Best-effort cleanup on SIGINT/SIGTERM so an interactive Ctrl-C (or an
    # MSYS `timeout` that delivers SIGTERM) does not leave a stale marker.
    def _on_signal(signum, frame):
        try:
            os.remove(pending_path)
        except OSError:
            pass
        if proc.poll() is None:
            try:
                proc.kill()
            except Exception:
                pass
        sys.exit(128 + signum)

    try:
        signal.signal(signal.SIGINT, _on_signal)
        signal.signal(signal.SIGTERM, _on_signal)
    except (ValueError, OSError):
        pass  # not the main thread / unsupported — TTL is the backstop

    deadline = time.time() + max(1, min(int(wait_seconds), AGY_MAX_STDIN_WAIT))
    url_sent = False
    code_sent = False
    outcome = ""
    last_beat = 0.0
    try:
        while time.time() < deadline:
            joined = "".join(lines)
            if not url_sent:
                url = extract_oauth_url(joined)
                if url:
                    url_sent = True
                    try:
                        with open(pending_path, "w", encoding="utf-8") as f:
                            f.write("pending\n")
                        last_beat = time.time()
                    except OSError as e:
                        outcome = f"pending marker failed: {e}"
                    ok, detail = send_telegram_message(
                        build_auth_caption(url, prompt_extra))
                    if not ok:
                        outcome = f"url send failed: {detail}"
            # Heartbeat: keep the marker fresh so the gateway's liveness check
            # (pending mtime < PENDING_TTL_SECONDS) sees this wait as alive.
            if url_sent and time.time() - last_beat >= HEARTBEAT_SECONDS:
                try:
                    with open(pending_path, "w", encoding="utf-8") as f:
                        f.write("pending\n")
                    last_beat = time.time()
                except OSError:
                    pass
            if not code_sent:
                code = _read_code(code_path)
                if code:
                    try:
                        proc.stdin.write(code + "\n")
                        proc.stdin.flush()
                        code_sent = True
                    except Exception as e:  # broken pipe etc.
                        outcome = f"code feed failed: {e}"
                        break
            if code_sent:
                # The code is in AGY's stdin — it must finish the token
                # exchange + the "hi" print on its own. Give it the print
                # budget, then reap it either way.
                grace = time.time() + int(print_timeout) + AGY_STDIN_WAIT_GRACE_SECONDS
                while time.time() < grace and proc.poll() is None:
                    time.sleep(0.5)
                break
            if proc.poll() is not None:
                break
            time.sleep(0.5)
    finally:
        try:
            os.remove(pending_path)
        except OSError:
            pass

    if proc.poll() is None and not code_sent:
        proc.kill()
    try:
        proc.stdin.close()
    except Exception:
        pass
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()

    out = "".join(lines)
    if not url_sent:
        return False, "no OAuth URL in agy output: " + redact_oauth_urls(out)[:300]
    if not code_sent:
        return False, ("timed out waiting for /agyc — AGY accepts the code "
                       f"for only ~{AGY_MAX_STDIN_WAIT}s (fixed, verified); re-run "
                       "to get a fresh sign-in link")
    if '"status":"SUCCESS"' in out or '"status": "SUCCESS"' in out:
        return True, "authenticated — the AGY token is stored; next runs work"
    return False, ("code delivered but AGY did not complete: "
                   + redact_oauth_urls(out)[-300:])


def _run_agy_hi(agy_cmd, model, effort, timeout):
    """Probe auth state: `agy -p "hi"` (stdin EOF -> fail fast) and return
    (is_authenticated, raw_output)."""
    try:
        proc = subprocess.run(
            [agy_cmd, "-p", "hi", "--model", model, "--effort", effort,
             "--output-format", "json", "--disable-slash-commands",
             "--print-timeout", f"{timeout}s"],
            capture_output=True, text=True, timeout=timeout + 30,
            encoding="utf-8", errors="replace",
            stdin=subprocess.DEVNULL)
    except FileNotFoundError:
        return False, f"agy executable not found: {agy_cmd}"
    except subprocess.TimeoutExpired:
        return False, f"agy timed out after {timeout}s"
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    if '"status":"SUCCESS"' in out or '"status": "SUCCESS"' in out:
        return True, out
    return False, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="probe AGY auth; if sign-in is required, run the live wait loop "
                         "and complete the login (sends the link, waits for /agyc)")
    ap.add_argument("--probe", metavar="TEXT",
                    help="print extraction/redaction results for canned text (no network)")
    ap.add_argument("--send", metavar="URL",
                    help="manually push a sign-in link to the user's Telegram")
    ap.add_argument("--agy-cmd", default=_resolve_agy_cmd(),
                    help="agy executable (default: AGY_CMD env, else PATH, else "
                         "the known AppData\\Local\\agy\\bin install dir)")
    ap.add_argument("--model", default=os.environ.get("AGY_MODEL", "gemini-3.8-flash"))
    ap.add_argument("--effort", default=os.environ.get("AGY_EFFORT", "low"))
    ap.add_argument("--timeout", type=int, default=60,
                    help="seconds for the AGY probe call to respond; the live wait "
                         "passes max(timeout, wait-code) as AGY's --print-timeout so "
                         "AGY keeps accepting the code for the whole window")
    ap.add_argument("--wait-code", type=int, default=DEFAULT_WAIT_SECONDS,
                    help="seconds to wait for the /agyc reply before giving up "
                         f"(default {DEFAULT_WAIT_SECONDS}; 0 = report the link and exit)")
    ap.add_argument("--rearm", type=int, default=1,
                    help="on a /agyc timeout, re-run the live wait up to N times "
                         "with a fresh AGY challenge + fresh link from ONE trigger "
                         f"(default 1; auto_trigger passes {REARM_ATTEMPTS})")
    args = ap.parse_args()

    if args.probe is not None:
        url = extract_oauth_url(args.probe)
        print("extracted:", url)
        print("redacted :", redact_oauth_urls(args.probe))
        print("caption  :", build_auth_caption(args.probe).replace("\n", " | "))
        return

    if args.send:
        ok, detail = send_telegram_message(build_auth_caption(args.send))
        print("sent" if ok else detail)
        return

    if args.check:
        ok_auth, out = _run_agy_hi(args.agy_cmd, args.model, args.effort, args.timeout)
        if ok_auth:
            print("AGY AUTH: OK (authenticated)")
            return
        if extract_oauth_url(out) is None:
            print("AGY AUTH: FAILED (no OAuth link in output) —",
                  redact_oauth_urls(out)[:300])
            return
        if args.wait_code <= 0:
            # Debug/legacy: just push the link, do not wait for the code.
            ok, detail = send_telegram_message(build_auth_caption(extract_oauth_url(out)))
            print("AGY AUTH: REQUIRED — link pushed to Telegram" if ok
                  else f"AGY AUTH: REQUIRED — send failed: {detail}")
            return
        print(f"AGY AUTH: REQUIRED — live sign-in wait started "
              f"(AGY accepts the code for ~{AGY_MAX_STDIN_WAIT}s — reply fast); "
              "reply /agyc <code> to the bot when the browser shows the code. "
              "IMPORTANT: never wrap this bridge in a shell `timeout` shorter "
              "than the wait — the wait must outlive the user's reply",
              flush=True)
        # AGY's stdin code window is a FIXED ~60 s (measured; --print-timeout
        # only caps it). Pass a generous print-timeout for the exchange +
        # response print after the code is fed; the loop deadline already caps
        # the wait at AGY_MAX_STDIN_WAIT.
        # Re-arm on timeout (2026-08-20): one trigger may re-run the live wait
        # up to --rearm times, each with a FRESH AGY challenge + fresh link,
        # so the user gets several minutes total from ONE link push instead of
        # the gates re-triggering a new bridge every few minutes.
        last_summary = ""
        for attempt in range(max(1, args.rearm)):
            ok, summary = wait_for_code(args.agy_cmd, args.model, args.effort,
                                        max(args.timeout, args.wait_code), args.wait_code)
            last_summary = summary
            if ok:
                print("AGY AUTH: OK — " + summary)
                return
            if "timed out waiting for /agyc" not in summary:
                # Non-timeout failure (no URL / send failed) — a fresh
                # challenge will not help; stop.
                print("AGY AUTH: FAILED — " + summary)
                return
            if attempt + 1 < max(1, args.rearm):
                print(f"AGY AUTH: FAILED — {summary} — re-arming a fresh "
                      f"challenge ({attempt + 2}/{max(1, args.rearm)})",
                      flush=True)
                time.sleep(REARM_GAP_SECONDS)
        print("AGY AUTH: FAILED — " + last_summary)
        return

    ap.print_help()


if __name__ == "__main__":
    main()
