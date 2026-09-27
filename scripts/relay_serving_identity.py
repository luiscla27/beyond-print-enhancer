#!/usr/bin/env python3
"""relay_serving_identity.py — is the process serving THIS project's relay port
actually running the relay unit this project has pinned?

Why this exists
---------------
The framework re-stamp of 2026-09-24 changed the vendored relay unit on disk
(`modelstack.lock` unit `982956cc7eeb…`, 183 files) while a relay process was
already listening on this project's port. "The unit is on disk" and "the running
process serves that unit" are DIFFERENT claims, and only the second one decides
whether the fleet is talking to the fixed relay. Nothing else in the toolchain
can tell them apart: `msf validate`, `drift_check` and the housekeeping guard all
read the WORKTREE, and the worktree was already correct. This gate reads the
PROCESS.

It resolves the listening PID for the port, reads that process's argv and
creation time, locates the relay tree the process actually imports from, and
compares that tree against this project's own `modelstack.lock` pins — the same
pins `drift_check` verifies. It prints EXACTLY ONE verdict:

  PROVENANCE-OK   served tree matches the pinned unit AND the process started
                  after that tree landed (so it cannot be serving older bytes)
  STALE-PROCESS   served tree matches the pins, but the process started BEFORE
                  the newest served source file — a restart is owed
  STALE-UNIT      the served tree does not match the pins (or the pins are
                  missing/unreadable): the process is serving a different unit
  PATH-MISMATCH   a listener exists but its argv is not a relay entry point for
                  this project (wrong script, wrong layout, wrong --project)
  UNKNOWN-PID     no listener on the port, or its process facts are unreadable

Exit status is 0 only for PROVENANCE-OK, so the gate is usable in a script.

Three things it deliberately does NOT do. It never restarts anything — the fleet
rule is that relay restarts are operator-run (`deploy_all.ps1` ticks), so this
gate only reports the debt. It never reads the served tree's own
`modelstack.lock` as the authority: the SERVED tree is judged against THIS
project's pins, so a wrong unit on either side shows up as STALE-UNIT rather than
being self-certified by the tree under suspicion. And it never puts an absolute
path or a PID into a receipt — `--emit-row` tokenizes the module
(`orch:vendor/relay/reasonix_proxy.py`) and hashes the tokenized argv, because
this project is declared public.

Usage:
  python scripts/relay_serving_identity.py              # this project, port from reasonix.toml
  python scripts/relay_serving_identity.py --port 38116
  python scripts/relay_serving_identity.py --emit-row    # + the attestation ledger row (JSON)
  python scripts/relay_serving_identity.py --json        # full evidence as JSON
  python scripts/relay_serving_identity.py --self-test    # prove all 5 verdicts are reachable
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

VERDICT_OK = "PROVENANCE-OK"
VERDICT_STALE_PROCESS = "STALE-PROCESS"
VERDICT_STALE_UNIT = "STALE-UNIT"
VERDICT_PATH_MISMATCH = "PATH-MISMATCH"
VERDICT_UNKNOWN_PID = "UNKNOWN-PID"
VERDICTS = (VERDICT_OK, VERDICT_STALE_PROCESS, VERDICT_STALE_UNIT,
            VERDICT_PATH_MISMATCH, VERDICT_UNKNOWN_PID)

#: The relay entry point, relative to a project root. Both this project and the
#: orchestrator tree it is actually served from use the framework's vendored
#: layout, so the served path must end with exactly this.
RELAY_ENTRY_TAIL = os.path.join("vendor", "relay", "reasonix_proxy.py")

#: Short, STABLE aliases so a receipt can name the serving tree without carrying
#: an absolute path (a public project's records must not leak the operator's
#: local layout). An unknown tree falls back to its own directory name, which is
#: still relative and still says which tree it was.
TREE_ALIASES = {
    "dndbeyond-printenhance": "dnd",
    "telegram_orchestrator": "orch",
}

REDACTION_POLICY = "strip-user-home-and-absolute-drive-paths"

#: A Windows absolute path or a POSIX one; used only to decide whether an argv
#: token is a path that must be tokenized before it is written down.
_ABS_PATH_RE = re.compile(r"^(?:[A-Za-z]:[\\/]|\\\\|/)")


def _run(cmd, timeout=25):
    """Run a command, returning (exit_code, stdout). Never raises for a non-zero
    exit: the callers turn a failure into a VERDICT, which is the whole point of
    a gate that must always answer with one of five words."""
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            # Keep the child's console hidden: this runs from an agent turn and
            # must not flash a window on the operator's desktop.
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError) as exc:  # noqa: BLE001
        return 1, "%s" % exc
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def lock_path(root):
    return os.path.join(root, "modelstack.lock")


def load_pins(root):
    """(pins, whole_lock) — `({}, {})` when the lock is unreadable, which the
    caller must treat as STALE-UNIT, never as 'nothing to check'."""
    try:
        with open(lock_path(root), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}, {}
    files = data.get("files")
    if not isinstance(files, dict):
        files = {}
    return files, data


def relay_pins(pins):
    """The pins the relay process actually imports at startup.

    Split out from the whole pin set on purpose, because the two questions need
    different evidence: "is the served overlay the pinned unit?" is answered by
    ALL pins, while "was the process started after its code landed?" must be
    answered by the files THIS process loads — a `tools/` file touched later
    would otherwise make a healthy process look stale.
    """
    return {rel: digest for rel, digest in pins.items()
            if rel.startswith("relay/")}


def overlay_home(root):
    """The directory the lock's `files` pins are relative to.

    In this project's layout the vendored overlay sits at `<root>/vendor/` and
    the pins are relative to THAT (`vendor/relay/…` pins as `relay/…` —
    MEASURED: all 183 pins resolve under `vendor/`, none under the root). A
    non-vendored project keeps its overlay at its root, so both are supported and
    the presence of `vendor/` decides.
    """
    candidate = os.path.join(root, "vendor")
    return candidate if os.path.isdir(candidate) else root


def _sha256_norm(path):
    """sha256 with EOLs normalised to `\\n` — the SAME recipe `modelstack.lock`
    pins are cut with (the framework sync's `_sha256`), so a CRLF and an LF
    checkout of one file compare equal instead of looking like drift."""
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError:
        return None
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def listening_pid(port):
    """The PID listening on 127.0.0.1:<port>, or None.

    Reads `netstat -ano` rather than binding the port: binding would CONFLICT
    with the very process being inspected.
    """
    code, out = _run(["netstat", "-ano", "-p", "TCP"])
    if code != 0:
        return None
    suffix = ":%d" % port
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[0].upper() != "TCP":
            continue
        local, state, pid = parts[1], parts[3].upper(), parts[4]
        if state != "LISTENING" or not local.endswith(suffix):
            continue
        if not pid.isdigit():
            continue
        return int(pid)
    return None


def _parse_cim_datetime(value):
    """CIM hands back a .NET DateTime; `ConvertTo-Json` renders it either as an
    ISO string or as `/Date(…)/`. Both spellings are handled so a PowerShell
    version difference cannot silently turn a real fact into UNKNOWN-PID."""
    if not value:
        return None
    if isinstance(value, dict):  # {"value": ..., "DateTime": ...}
        value = value.get("DateTime") or value.get("value")
    text = str(value).strip()
    match = re.match(r"^/Date\((-?\d+)", text)
    if match:
        try:
            return datetime.fromtimestamp(int(match.group(1)) / 1000.0, timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _split_argv(command_line):
    """Split a Windows command line into argv.

    Deliberately a small parser: it honours double quotes (the form Windows
    writes for a path with spaces) and does not try to be `CommandLineToArgvW`.
    A relay argv is a script path plus flags, so this is enough, and anything it
    cannot parse degrades into PATH-MISMATCH rather than a wrong PROVENANCE-OK.
    """
    if not command_line:
        return []
    argv, current, quoted = [], [], False
    for char in str(command_line):
        if char == '"':
            quoted = not quoted
            continue
        if char in " \t" and not quoted:
            if current:
                argv.append("".join(current))
                current = []
            continue
        current.append(char)
    if current:
        argv.append("".join(current))
    return argv


def probe_http(port, timeout=10):
    """Ask the relay ITSELF who it is: `GET /reload/status` on the loopback.

    A second, INDEPENDENT channel beside `argv`: the OS says which script a PID
    runs, and the process says which PID and catalog it is. When the two agree
    the evidence is corroborated; when they disagree the listener is not the
    process the argv describes, which is worth a PATH-MISMATCH rather than a
    silent pass. Returns `{"reachable": bool, "reported_pid", "catalog_revision",
    "draining"}`.
    """
    import urllib.error
    import urllib.request
    url = "http://127.0.0.1:%d/reload/status" % port
    try:
        # No proxy: a local relay must never be reached through one, and a
        # system proxy that intercepts loopback would make this probe lie.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, OSError, ValueError):
        return {"reachable": False}
    if not isinstance(payload, dict):
        return {"reachable": False}
    return {
        "reachable": True,
        "reported_pid": payload.get("pid"),
        "catalog_revision": payload.get("catalog_revision"),
        "draining": payload.get("draining"),
        "schema": payload.get("schema"),
    }


def probe_process(port):
    """The REAL probe: `{"pid", "created", "argv"}` for the port's listener, or
    None when nothing is listening. Injectable so the self-test can judge a
    recorded process without a listener — and so the gate's verdicts are provable
    rather than asserted."""
    pid = listening_pid(port)
    if pid is None:
        return None
    script = (
        "$p = Get-CimInstance Win32_Process -Filter 'ProcessId=%d'; "
        "if ($p) { $p | Select-Object ProcessId,CreationDate,CommandLine | "
        "ConvertTo-Json -Compress }" % pid
    )
    code, out = _run(["powershell", "-NoProfile", "-NonInteractive",
                      "-ExecutionPolicy", "Bypass", "-Command", script])
    payload = None
    if code == 0:
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    payload = json.loads(line)
                except ValueError:
                    payload = None
    payload = payload or {}
    return {
        "pid": pid,
        "created": _parse_cim_datetime(payload.get("CreationDate")),
        "argv": _split_argv(payload.get("CommandLine")),
    }


def served_script(argv):
    """The `.py` the process runs (first argv token that is one)."""
    for token in argv or []:
        if token.lower().endswith(".py"):
            return token
    return None


def tree_alias(tree_dir):
    leaf = os.path.basename(os.path.normpath(tree_dir)).lower()
    return TREE_ALIASES.get(leaf, leaf)


def tokenize_module(script):
    """`<project-alias>:vendor/relay/reasonix_proxy.py` — relative, drive-free,
    and still specific enough to name WHICH tree is serving. The alias comes from
    the PROJECT directory (three levels above the script:
    `<project>/vendor/relay/reasonix_proxy.py`), because the interesting identity
    is *which project's overlay* is serving, not which subdirectory."""
    project_dir = os.path.dirname(os.path.dirname(os.path.dirname(script)))
    rel = os.path.relpath(script, project_dir).replace(os.sep, "/")
    return "%s:%s" % (tree_alias(project_dir), rel)


def tokenize_argv(argv, script):
    """The argv with absolute paths replaced by tokens, so a reader can
    recompute the recorded `argv_sha256` from the record alone."""
    tokens = []
    for token in argv or []:
        if script and token == script:
            tokens.append(tokenize_module(token))
        elif _ABS_PATH_RE.match(token):
            tokens.append("<path>")
        else:
            tokens.append(token)
    return tokens


def inspect(root, port, project, probe=probe_process, http=probe_http, now=None):
    """Run every check and return the full evidence dict. One function so the
    CLI, the self-test and any future caller share exactly one verdict."""
    now = now or datetime.now(timezone.utc)
    pins, lock = load_pins(root)
    relay = relay_pins(pins)

    evidence = {
        "type": "relay_serving_identity",
        "project": project,
        "port": port,
        "checked_utc": now.isoformat(),
        "lock": {
            "path_token": "modelstack.lock",
            "unit_revision": lock.get("unit_revision"),
            "framework_revision": lock.get("framework_revision"),
            "relay_pins": len(relay),
            "unit_pins": len(pins),
        },
        "pid": None,
        "pid_in_receipt": False,
        "local_paths_included": False,
        "redaction_policy": REDACTION_POLICY,
        "served_module_token": None,
        "project_module_token": None,
        "argv_tokens": None,
        "argv_sha256": None,
        "process_created_utc": None,
        "newest_served_source_utc": None,
        "relay_self_report": None,
        "pins_checked": 0,
        "pins_matched": 0,
        "pin_mismatches": [],
        "unit_pins_checked": 0,
        "unit_pins_matched": 0,
        "unit_pin_mismatches": [],
        "verdict": VERDICT_UNKNOWN_PID,
        "reason": "",
    }

    if not relay:
        evidence["verdict"] = VERDICT_STALE_UNIT
        evidence["reason"] = ("modelstack.lock carries no readable relay pins at "
                              "%s — the served unit cannot be judged"
                              % lock_path(root))
        return evidence

    facts = probe(port)
    if not facts or not facts.get("pid"):
        evidence["reason"] = "no TCP listener on 127.0.0.1:%d" % port
        return evidence
    evidence["pid"] = facts["pid"]
    argv = facts.get("argv") or []
    created = facts.get("created")
    evidence["process_created_utc"] = created.isoformat() if created else None

    # The relay's OWN answer, recorded even when it cannot be used: "the process
    # did not answer" and "the process answered with somebody else's identity" are
    # different findings, and a receipt that omitted the attempt could not say
    # which one happened.
    self_report = http(port)
    evidence["relay_self_report"] = self_report
    if self_report and self_report.get("reachable"):
        reported = self_report.get("reported_pid")
        if reported is not None and reported != evidence["pid"]:
            evidence["verdict"] = VERDICT_PATH_MISMATCH
            evidence["reason"] = (
                "the process listening on %d reports pid %s while the OS reports "
                "%s — the argv describes a different process than the one "
                "answering" % (port, reported, evidence["pid"]))
            return evidence

    script = served_script(argv)
    if not script:
        evidence["verdict"] = VERDICT_PATH_MISMATCH
        evidence["reason"] = "listener argv names no .py entry point"
        return evidence

    evidence["served_module_token"] = tokenize_module(script)
    tokens = tokenize_argv(argv, script)
    evidence["argv_tokens"] = tokens
    evidence["argv_sha256"] = hashlib.sha256(
        "\0".join(tokens).encode("utf-8")).hexdigest()

    if not script.replace("/", os.sep).endswith(RELAY_ENTRY_TAIL):
        evidence["verdict"] = VERDICT_PATH_MISMATCH
        evidence["reason"] = ("served entry point is not a vendored relay (%s)"
                              % evidence["served_module_token"])
        return evidence
    if project and "--project" in argv:
        index = argv.index("--project")
        named = argv[index + 1] if index + 1 < len(argv) else ""
        if named != project:
            evidence["verdict"] = VERDICT_PATH_MISMATCH
            evidence["reason"] = ("served entry point serves project %r, not %r"
                                  % (named, project))
            return evidence
    if not os.path.isfile(script):
        evidence["verdict"] = VERDICT_PATH_MISMATCH
        evidence["reason"] = ("served entry point does not exist on disk (%s)"
                              % evidence["served_module_token"])
        return evidence

    served_root = os.path.dirname(os.path.dirname(os.path.dirname(script)))
    served_tree = overlay_home(served_root)
    newest = None
    for rel, digest in sorted(relay.items()):
        path = os.path.join(served_tree, rel.replace("/", os.sep))
        evidence["pins_checked"] += 1
        actual = _sha256_norm(path)
        if actual is None:
            evidence["pin_mismatches"].append({"rel": rel, "issue": "missing"})
            continue
        if actual != digest:
            evidence["pin_mismatches"].append({"rel": rel, "issue": "hash"})
            continue
        evidence["pins_matched"] += 1
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        newest = mtime if newest is None else max(newest, mtime)

    # The WHOLE unit, not just the relay subset: a served overlay that matches
    # every pin but the relay files is a tree from a different unit, and saying
    # so is the difference between "the relay is current" and "the tree is".
    for rel, digest in sorted(pins.items()):
        path = os.path.join(served_tree, rel.replace("/", os.sep))
        evidence["unit_pins_checked"] += 1
        actual = _sha256_norm(path)
        if actual is None:
            evidence["unit_pin_mismatches"].append({"rel": rel,
                                                    "issue": "missing"})
            continue
        if actual != digest:
            evidence["unit_pin_mismatches"].append({"rel": rel, "issue": "hash"})
            continue
        evidence["unit_pins_matched"] += 1

    if newest is not None:
        evidence["newest_served_source_utc"] = datetime.fromtimestamp(
            newest, timezone.utc).isoformat()

    if evidence["unit_pin_mismatches"]:
        evidence["verdict"] = VERDICT_STALE_UNIT
        evidence["reason"] = (
            "%d of %d unit pins do not match the served overlay — the relay "
            "imports modules from the whole tree, so a relay-only match is not "
            "enough" % (len(evidence["unit_pin_mismatches"]),
                        evidence["unit_pins_checked"]))
        return evidence

    if evidence["pin_mismatches"]:
        evidence["verdict"] = VERDICT_STALE_UNIT
        evidence["reason"] = ("%d of %d relay pins do not match the served tree"
                              % (len(evidence["pin_mismatches"]),
                                 evidence["pins_checked"]))
        return evidence

    if created is None:
        evidence["verdict"] = VERDICT_UNKNOWN_PID
        evidence["reason"] = ("served unit matches the pins, but the process "
                              "creation time is unreadable — 'started after the "
                              "code landed' cannot be shown")
        return evidence

    if newest is not None and created.timestamp() < newest:
        evidence["verdict"] = VERDICT_STALE_PROCESS
        evidence["reason"] = ("process started %s, before the newest served "
                              "source file %s — a relay restart is owed"
                              % (evidence["process_created_utc"],
                                 evidence["newest_served_source_utc"]))
        return evidence

    evidence["verdict"] = VERDICT_OK
    evidence["reason"] = ("served tree matches all %d relay pins and the process "
                          "started after the newest served source"
                          % evidence["pins_matched"])
    return evidence


def attestation_row(evidence, row_id):
    """The append-only ledger row (docs/governance/msf_live_attestations.jsonl).

    Carries the PID (the ledger is the OPERATIONAL record, read by the operator
    who can act on it) while the public receipt does not — `pid_in_attestation` /
    `pid_in_receipt` are recorded so a reader never has to guess which record
    holds which fact.
    """
    return {
        "schema_version": 1,
        "id": row_id,
        "project": evidence["project"],
        "port": evidence["port"],
        "unit_revision": evidence["lock"]["unit_revision"],
        "framework_revision": evidence["lock"]["framework_revision"],
        "served_module_token": evidence["served_module_token"],
        "pid": evidence["pid"],
        "pid_in_attestation": True,
        "pid_in_receipt": False,
        "local_paths_included": False,
        "redaction_policy": REDACTION_POLICY,
        "process_created_utc": evidence["process_created_utc"],
        "module_mtime_utc": evidence["newest_served_source_utc"],
        "argv_sha256": evidence["argv_sha256"],
        "relay_reported_pid": (evidence.get("relay_self_report") or {}).get(
            "reported_pid"),
        "relay_reported_catalog_revision": (
            evidence.get("relay_self_report") or {}).get("catalog_revision"),
        "pins_checked": evidence["pins_checked"],
        "pins_matched": evidence["pins_matched"],
        "unit_pins_checked": evidence["unit_pins_checked"],
        "unit_pins_matched": evidence["unit_pins_matched"],
        "verdict": evidence["verdict"],
        "evidence_class": "process_probe",
        "checked_utc": evidence["checked_utc"],
        "notes": evidence["reason"],
    }


def _port_from_config(root):
    """The relay port this project's own config points at.

    Read from a provider `base_url` pointing at loopback — that IS the relay the
    agent dials. Deliberately NOT "the first 127.0.0.1:<port> in the file": this
    project's `[bot.control] addr` is also loopback (37918), and picking that one
    would point the gate at the gateway process instead of the relay, i.e. a
    PATH-MISMATCH that looks like a relay defect. Falls back to the pinned 38116
    only when no provider base_url can be read.
    """
    try:
        with open(os.path.join(root, "reasonix.toml"), encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return 38116
    match = re.search(r"^\s*base_url\s*=\s*[\"']http://127\.0\.0\.1:(\d{2,5})",
                      text, re.M)
    return int(match.group(1)) if match else 38116


# --- self-test ------------------------------------------------------------- #
def _fixture(root, served, pin_digest):
    """One synthetic project: a lock with a single relay pin, plus the served
    tree the pin describes."""
    os.makedirs(os.path.join(root, "vendor", "relay"), exist_ok=True)
    with open(os.path.join(root, "vendor", "relay", "reasonix_proxy.py"),
              "w", encoding="utf-8", newline="\n") as fh:
        fh.write(served)
    with open(lock_path(root), "w", encoding="utf-8") as fh:
        json.dump({"unit_revision": "f" * 64, "framework_revision": "e" * 40,
                   "files": {"relay/reasonix_proxy.py": pin_digest}}, fh)
    return os.path.join(root, "vendor", "relay", "reasonix_proxy.py")


def _fixed_probe(script, created, pid=4242):
    return lambda _port: {
        "pid": pid, "created": created,
        "argv": ["C:\\python\\pythonw.exe", script, "--project", "fixture"],
    }


#: The self-test's default relay answer: the listener does not speak the reload
#: surface. Used everywhere EXCEPT the case that proves the disagreement branch,
#: so "unreachable" cannot be mistaken for "corroborated".
_NO_HTTP = lambda _port: {"reachable": False}  # noqa: E731


def self_test():
    """Prove every verdict is REACHABLE. A gate whose five words cannot all be
    produced is a gate that only knows how to say OK."""
    seen = {}
    tmp = tempfile.mkdtemp(prefix="relay_identity_selftest_")
    try:
        digest = hashlib.sha256(b"body\n").hexdigest()

        # 1. PROVENANCE-OK — pins match, process started after the code landed.
        root = os.path.join(tmp, "ok")
        script = _fixture(root, "body\n", digest)
        mtime = os.path.getmtime(script)
        ok = inspect(root, 1, "fixture", http=_NO_HTTP,
                     probe=_fixed_probe(script, datetime.fromtimestamp(
                         mtime + 60, timezone.utc)))
        seen[VERDICT_OK] = ok["verdict"]

        # 2. STALE-PROCESS — same tree, process older than the code.
        stale = inspect(root, 1, "fixture", http=_NO_HTTP,
                        probe=_fixed_probe(script, datetime.fromtimestamp(
                            mtime - 60, timezone.utc)))
        seen[VERDICT_STALE_PROCESS] = stale["verdict"]

        # 3. STALE-UNIT — the served bytes are not the pinned bytes.
        other = os.path.join(tmp, "stale_unit")
        script2 = _fixture(other, "DIFFERENT\n", digest)
        unit = inspect(other, 1, "fixture", http=_NO_HTTP,
                       probe=_fixed_probe(script2, datetime.fromtimestamp(
                           os.path.getmtime(script2) + 60, timezone.utc)))
        seen[VERDICT_STALE_UNIT] = unit["verdict"]

        # 3b. STALE-UNIT when the lock itself is unreadable (fails CLOSED).
        empty = os.path.join(tmp, "no_lock")
        os.makedirs(os.path.join(empty, "vendor", "relay"), exist_ok=True)
        seen[VERDICT_STALE_UNIT + ":no-lock"] = inspect(
            empty, 1, "fixture", probe=lambda _p: None)["verdict"]

        # 4. PATH-MISMATCH — a listener, but not a relay entry point.
        wrong = inspect(root, 1, "fixture", http=_NO_HTTP,
                        probe=_fixed_probe(os.path.join(tmp, "other.py"),
                                           datetime.now(timezone.utc)))
        seen[VERDICT_PATH_MISMATCH] = wrong["verdict"]

        # 4b. PATH-MISMATCH — a relay, but serving a different project.
        other_project = inspect(
            root, 1, "fixture", http=_NO_HTTP,
            probe=lambda _p: {"pid": 7, "created": datetime.now(timezone.utc),
                              "argv": ["C:\\python\\pythonw.exe", script,
                                       "--project", "somebody-else"]})
        seen[VERDICT_PATH_MISMATCH + ":other-project"] = other_project["verdict"]

        # 4c. PATH-MISMATCH — the OS and the relay disagree about the PID.
        disagreement = inspect(
            root, 1, "fixture",
            probe=_fixed_probe(script, datetime.fromtimestamp(
                mtime + 60, timezone.utc)),
            http=lambda _p: {"reachable": True, "reported_pid": 999,
                             "catalog_revision": "x"})
        seen[VERDICT_PATH_MISMATCH + ":pid-disagreement"] = disagreement["verdict"]

        # 5. UNKNOWN-PID — nothing listening.
        seen[VERDICT_UNKNOWN_PID] = inspect(root, 1, "fixture",
                                            probe=lambda _p: None)["verdict"]

        # 5b. UNKNOWN-PID — a listener whose facts are unreadable.
        blind = inspect(root, 1, "fixture", http=_NO_HTTP,
                        probe=lambda _p: {"pid": 9, "created": None,
                                          "argv": ["python.exe", script]})
        seen[VERDICT_UNKNOWN_PID + ":no-clock"] = blind["verdict"]

        # 5c. A corroborating relay answer must NOT change a passing verdict:
        # the extra channel may only ever DEMOTE, never promote.
        agreeing = inspect(
            root, 1, "fixture",
            probe=_fixed_probe(script, datetime.fromtimestamp(
                mtime + 60, timezone.utc)),
            http=lambda _p: {"reachable": True, "reported_pid": 4242,
                             "catalog_revision": "2026-09-18.1"})
        seen[VERDICT_OK + ":corroborated"] = agreeing["verdict"]
        seen["corroboration_recorded"] = (
            "relay_reported_pid" in attestation_row(agreeing, "x")
            and attestation_row(agreeing, "x")["relay_reported_pid"] == 4242)

        # The tokenizer must not leak an absolute path into a receipt.
        row = attestation_row(ok, "fixture-relay-20260924")
        leaks = [value for value in json.dumps(row).split('"')
                 if _ABS_PATH_RE.match(value) and value != "<path>"]
        leaked = bool(leaks)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    expected = {
        VERDICT_OK: VERDICT_OK,
        VERDICT_OK + ":corroborated": VERDICT_OK,
        VERDICT_STALE_PROCESS: VERDICT_STALE_PROCESS,
        VERDICT_STALE_UNIT: VERDICT_STALE_UNIT,
        VERDICT_STALE_UNIT + ":no-lock": VERDICT_STALE_UNIT,
        VERDICT_PATH_MISMATCH: VERDICT_PATH_MISMATCH,
        VERDICT_PATH_MISMATCH + ":other-project": VERDICT_PATH_MISMATCH,
        VERDICT_PATH_MISMATCH + ":pid-disagreement": VERDICT_PATH_MISMATCH,
        VERDICT_UNKNOWN_PID: VERDICT_UNKNOWN_PID,
        VERDICT_UNKNOWN_PID + ":no-clock": VERDICT_UNKNOWN_PID,
        "corroboration_recorded": True,
    }
    failures = ["%s -> %s (want %s)" % (case, seen.get(case), want)
                for case, want in expected.items() if seen.get(case) != want]
    if leaked:
        failures.append("attestation row leaked an absolute path: %s" % leaks)
    if failures:
        print("SELF-TEST FAIL")
        for line in failures:
            print("  %s" % line)
        return 1
    print("SELF-TEST OK — %d/%d verdicts reachable, no absolute path in the row"
          % (len(VERDICTS), len(VERDICTS)))
    for case in sorted(seen):
        print("  %-40s %s" % (case, seen[case]))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Verdict on whether the process serving this project's "
                    "relay port runs the relay unit this project has pinned.")
    parser.add_argument("--root", default=ROOT,
                        help="project root holding modelstack.lock")
    parser.add_argument("--port", type=int, default=None,
                        help="relay port (default: this project's own config)")
    parser.add_argument("--project", default=None,
                        help="project name the listener must serve")
    parser.add_argument("--row-id", default=None,
                        help="id for --emit-row (default <project>-relay-<date>)")
    parser.add_argument("--emit-row", action="store_true",
                        help="also print the attestation ledger row as JSON")
    parser.add_argument("--json", action="store_true",
                        help="print the full evidence as JSON")
    parser.add_argument("--self-test", action="store_true",
                        help="prove all five verdicts are reachable, then exit")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    root = os.path.abspath(args.root)
    project = args.project or os.path.basename(root)
    port = args.port if args.port is not None else _port_from_config(root)

    evidence = inspect(root, port, project)
    # The token a receipt would name for THIS project's own copy, so a reader can
    # compare it against served_module_token without reading the worktree.
    evidence["project_module_token"] = "%s:vendor/relay/reasonix_proxy.py" % (
        tree_alias(root))

    if args.json:
        print(json.dumps(evidence, indent=2, sort_keys=True))
    else:
        print(evidence["verdict"])
        print("  %s" % evidence["reason"])
        print("  port=%s pid=%s served=%s pins=%d/%d"
              % (evidence["port"], evidence["pid"],
                 evidence["served_module_token"],
                 evidence["pins_matched"], evidence["pins_checked"]))
    if args.emit_row:
        row_id = args.row_id or "%s-relay-%s" % (
            project, datetime.now(timezone.utc).strftime("%Y%m%d"))
        print(json.dumps(attestation_row(evidence, row_id), sort_keys=True))

    return 0 if evidence["verdict"] == VERDICT_OK else 1


if __name__ == "__main__":
    sys.exit(main())
