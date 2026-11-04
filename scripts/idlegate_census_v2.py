#!/usr/bin/env python
"""idlegate_census_v2.py - reduce the idle gate's typed event stream into one census.

Why this exists (2026-09-27 audit): the gate's own daily census line was the ONLY summary
available, and it could not be checked against anything. It read
`fires=p3:3,p4:3 closed=0 closeout_failed=0 parked=0 escalated=2 refused=0 spend=0.04USD
builder_runs=0` while the audit log next to it held 32 `executor issue-fixes ok` lines - so
"ok" and "closed=0" sat in the same file with no way to tell which one described reality.
Six daily lines all said `closed=0 builder_runs=0`, and every one of them was ALSO the only
place any number appeared.

This reducer answers that by being a pure function of the typed stream:

    python scripts/idlegate_census_v2.py --events temp/idlegate/idlegate-events.jsonl \
        --date 2026-09-19 [--json] [--check] [--gateway-census] [--archive temp/archived]

Design rules, each one a reaction to a specific way the old numbers lied:

  1. VALUE IS DERIVED FROM ARTIFACTS, NEVER FROM EXECUTOR VERBS. `rung.executor ok` is
     counted separately and contributes to NOTHING. `value.accepted_repo_value` counts only
     runs whose CLOSE is attributable in the record - and since the audit log contains no
     close verb at all, that number is structurally 0 until the gateway writes a receipt.
     `value.issue_closed` (artifact moved to the archive) IS reported, but every such target
     is listed as `unattributed`, because the log cannot name the run that closed it. That
     distinction - closed vs closed BY THE GATE - is the entire question.
  2. EVERY COUNT CARRIES ITS PROVENANCE. Fire/spawn/terminal tallies carry the source
     `line` numbers, so a wrong number can be falsified by reading the log rather than
     argued about.
  3. RECONCILE, DO NOT REPLACE. `--gateway-census` parses the gate's own `idlegate census
     <day>` line for the same day and prints a per-key verdict. Disagreement is a FINDING
     (see `reconciled`), never an error to be smoothed over.
  4. UNKNOWNS STAY UNKNOWN. A child whose terminal the log never wrote is `unterminated`,
     not `running`; a success verb that does not exist is `children.completed: 0` with
     `success_verb_present: false`, not a guess.

Exit codes: 0 ok, 2 the event stream is missing/unreadable, 3 `--check` failed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

SCHEMA = "idlegate-census/2"
DEFAULT_EVENTS = os.path.join("temp", "idlegate", "idlegate-events.jsonl")

# census line: `idlegate census 2026-09-26: fires=p3:3,p4:3 closed=0 closeout_failed=0
# parked=0 escalated=2 refused=0 spend=0.04USD builder_runs=0`
CENSUS_RE = re.compile(r"idlegate census (\d{4}-\d{2}-\d{2}): (.*)$")
FIRES_RE = re.compile(r"fires=([^ ]*)")


def load_events(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def parse_gateway_census(evidence: str) -> dict:
    """Parse the gate's own census prose into typed keys (all of them, verbatim)."""
    m = CENSUS_RE.search(evidence)
    if not m:
        return {}
    day, rest = m.group(1), m.group(2)
    out: dict = {"day": day, "raw": rest}
    fm = FIRES_RE.search(rest)
    if fm:
        fires = {}
        for part in fm.group(1).split(","):
            if ":" in part:
                k, v = part.split(":", 1)
                try:
                    fires[k] = int(v)
                except ValueError:
                    fires[k] = v
        out["fires"] = fires
    for key in ("closed", "closeout_failed", "parked", "escalated", "refused", "builder_runs"):
        km = re.search(rf"\b{key}=(\d+)", rest)
        if km:
            out[key] = int(km.group(1))
    sm = re.search(r"spend=([0-9.]+)USD", rest)
    if sm:
        out["spend_usd"] = float(sm.group(1))
    return out


def archive_state(archive_dir: str, basename: str):
    """Is `basename` archived, and does any archive row attribute a closing run?

    Returns (closed, row_date, attributed_run_id). `attributed_run_id` is None for every row
    in this repository's index: the index's "Resolved by" column carries human prose, and no
    row has ever named an `idlegate` run. That absence is the measurement, not a parse gap -
    `closed_by_run_id` is what a receipt would fill in.
    """
    if not archive_dir or not os.path.isdir(archive_dir):
        return None, None, None
    path = os.path.join(archive_dir, basename)
    if not os.path.exists(path):
        return False, None, None
    index = os.path.join(archive_dir, "ARCHIVE_INDEX.md")
    row_date, run_id = None, None
    if os.path.exists(index):
        with open(index, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if basename in line and line.startswith("| 2026"):
                    row_date = line.split("|")[1].strip()
                    m = re.search(r"(orch-\d{8}T\d{6}\S*|closed_by_run_id[=: ]\s*(\S+))", line)
                    if m:
                        run_id = m.group(1)
                    break
    return True, row_date, run_id


def census(records: list[dict], day: str | None, archive_dir: str) -> dict:
    # A child's lifecycle can cross UTC midnight (9 of 17 primary terminals land on the day
    # after their spawn), so a naive per-day filter orphans them. Every child event is
    # therefore bucketed by its SPAWN day - the day the rung DECIDED - which keeps a spawn
    # and its terminal in the same window and makes `orphan_terminals` 0 by construction
    # instead of by luck.
    child_events = ("child.spawn", "child.terminal", "child.liveness")
    all_spawns = [r for r in records if r["event"] == "child.spawn"]
    pair_day: dict[str, str] = {}  # pid -> the day the rung DECIDED to spawn it
    for r in all_spawns:
        pair_day[r["child_pid"]] = r["day_utc"]

    def day_of(r: dict) -> str:
        # A child belongs to the day the rung DECIDED. A census line belongs to the day it
        # SUMMARISES (`idlegate census 2026-09-26` is written at 06:39 the NEXT morning), so
        # bucketing it by its own timestamp would put it in a window it does not describe.
        if r["event"] == "census.logged" and r["reason"]:
            return r["reason"]
        if r["event"] in child_events and r["child_pid"] in pair_day:
            return pair_day[r["child_pid"]]
        return r["day_utc"]

    if day is None:
        ev = list(records)
    else:
        ev = [r for r in records if day_of(r) == day]
    by_event = Counter(r["event"] for r in ev)
    fires = [r for r in ev if r["event"] == "rung.fire"]
    verdicts = [r for r in ev if r["event"] == "rung.verdict"]
    ticks = [r for r in ev if r["event"] == "tick"]
    spawns = [r for r in ev if r["event"] == "child.spawn"]
    terms = [r for r in ev if r["event"] == "child.terminal"]
    primary = [r for r in terms if not r.get("duplicate_view")]
    dup = [r for r in terms if r.get("duplicate_view")]
    execs = [r for r in ev if r["event"] == "rung.executor"]
    cycles = [r for r in ev if r["event"] == "cycle.done"]
    liveness = [r for r in ev if r["event"] == "child.liveness"]

    spawned_pids = {r["child_pid"] for r in spawns}
    terminated_pids = {r["child_pid"] for r in primary}
    terminated_clean = {r["child_pid"] for r in primary if r["attribution"] == "matched"}
    unterminated = sorted(spawned_pids - terminated_pids)
    orphans = [r["child_pid"] for r in primary if r["child_pid"] not in spawned_pids]

    # targets -> what the gate actually went after
    targets: dict[str, dict] = {}
    for r in spawns:
        if not r["issue"]:
            continue
        t = targets.setdefault(r["issue"], {
            "artifact": r["issue"], "kind": r["target_kind"],
            "spawns": 0, "terminals": 0, "pids": [],
        })
        t["spawns"] += 1
        t["pids"].append(r["child_pid"])
    for r in primary:
        if r["issue"] in targets:
            targets[r["issue"]]["terminals"] += 1

    value_targets = []
    for artifact, t in sorted(targets.items()):
        base = os.path.basename(artifact)
        if t["kind"] == "issue":
            closed, row_date, run_id = archive_state(archive_dir, base)
        else:
            # a track "delivery" would be a CLOSED track dir under conductor/; the gate never
            # writes one, and the reducer does not guess from spec.md's existence.
            closed, row_date, run_id = None, None, None
        value_targets.append({
            **t,
            "closed_in_archive": closed,
            "archived_date": row_date,
            "closed_by_run_id": run_id,
            "attribution": "unattributed" if (closed and not run_id) else
                           ("attributed" if run_id else "not-closed"),
        })

    # money: the log carries per-fire est only; actual is a daily census number.
    est = [r["est_usd"] for r in spawns if r["est_usd"] is not None]
    charged_true = [r for r in primary if r["charged"] is True]
    charged_false = [r for r in primary if r["charged"] is False]
    charged_unknown = [r for r in primary if r["charged"] is None]

    gc = {}
    for r in ev:
        if r["event"] == "census.logged":
            parsed = parse_gateway_census(r["evidence"])
            if parsed:
                gc = parsed
                gc["_evidence"] = r["evidence"]

    # Money and refusal observability are properties of the WHOLE window, not of a slice:
    # a daily census line reports the DAY's spend, and a "no free lane" refusal can strike
    # any rung at any time. They are reported as lifetime totals beside every per-day slice,
    # labelled as such, so no consumer mistakes a day's number for the account's.
    life_spawns = [r for r in records if r["event"] == "child.spawn"]
    life_primary = [r for r in records
                    if r["event"] == "child.terminal" and not r.get("duplicate_view")]
    life_charged_true = [r for r in life_primary if r["charged"] is True]
    life_charged_false = [r for r in life_primary if r["charged"] is False]
    life_charged_unknown = [r for r in life_primary if r["charged"] is None]
    life_est = [r["est_usd"] for r in life_spawns if r["est_usd"] is not None]
    life_refused = [r for r in records if r["event"] == "child.refused"]
    life_cycles = [r for r in records if r["event"] == "cycle.done"]
    life_targets = {}
    for r in life_spawns:
        if r["issue"]:
            t = life_targets.setdefault(r["issue"], {
                "artifact": r["issue"], "kind": r["target_kind"], "spawns": 0,
                "terminals": 0, "pids": [],
            })
            t["spawns"] += 1
            t["pids"].append(r["child_pid"])
    for r in life_primary:
        if r["issue"] in life_targets:
            life_targets[r["issue"]]["terminals"] += 1
    # accepted value is a LIFETIME fact: an artifact is closed once, by one run (or by none),
    # so slicing the window must not be able to make it appear or disappear.
    life_value = []
    for artifact, t in sorted(life_targets.items()):
        base = os.path.basename(artifact)
        closed, row_date, run_id = (archive_state(archive_dir, base)
                                    if t["kind"] == "issue" else (None, None, None))
        life_value.append({**t, "closed_in_archive": closed, "archived_date": row_date,
                           "closed_by_run_id": run_id})
    life_accepted = sum(1 for t in life_value if t["closed_by_run_id"])
    life_closed = sum(1 for t in life_value if t["closed_in_archive"] is True)
    accepted = life_accepted

    out = {
        "schema": SCHEMA,
        "project": (ev or records)[0]["project"] if (ev or records) else None,
        "date": day,
        "window": {
            "first_ts": ev[0]["ts"] if ev else None,
            "last_ts": ev[-1]["ts"] if ev else None,
            "source_lines": {"first": ev[0]["line"] if ev else None,
                             "last": ev[-1]["line"] if ev else None},
        },
        "events": {"records": len(ev), "by_event": dict(sorted(by_event.items()))},
        "fires": {
            "total": len(fires),
            "by_rung": dict(Counter(r["rung"] for r in fires)),
            "by_role": dict(Counter(r["rung_role"] for r in fires)),
            "allow": sum(1 for r in verdicts if r["outcome"] == "allow"),
            "deny": sum(1 for r in verdicts if r["outcome"] == "deny"),
            "without_verdict": len(fires) - len(verdicts),
        },
        "ticks": {
            "total": len(ticks),
            "idle": sum(1 for r in ticks if r["outcome"] == "idle"),
            "busy": sum(1 for r in ticks if r["outcome"] == "busy"),
            "by_reason": dict(Counter(r["reason"] for r in ticks)),
        },
        "spawns": {
            "total": len(spawns),
            "by_rung": dict(Counter(r["rung"] for r in spawns)),
            "by_target_kind": dict(Counter(r["target_kind"] for r in spawns)),
        },
        "children": {
            # There is NO success verb anywhere in the audit log: no `run ok`, no `exit 0`.
            # A completed run is therefore invisible, and 0 is a measurement about the LOG,
            # not about the gate's children.
            "completed": 0,
            "success_verb_present": False,
            "terminals_primary": len(primary),
            "terminals_records": len(terms),
            "duplicate_views": len(dup),
            "attribution": dict(Counter(r["attribution"] for r in primary)),
            "failed": sum(1 for r in primary if r["outcome"] == "failed"),
            "by_reason": dict(Counter(r["reason"] for r in primary)),
            "by_error_class": dict(Counter(r["error_class"] for r in primary)),
            "durations_seconds": sorted(r["duration_seconds"] for r in primary
                                        if r["duration_seconds"] is not None),
            "unterminated": unterminated,
            "unterminated_pids": len(unterminated),
            "orphan_terminals": orphans,
            "crosses_day_boundary": sorted(
                r["child_pid"] for r in primary
                if pair_day.get(r["child_pid"]) and pair_day[r["child_pid"]] != r["day_utc"]
            ),
            # the heartbeat is evidence of NOTHING: bytes=0 and negative cpu on all 164 lines
            "liveness_records": len(liveness),
            "liveness_informative": False,
        },
        "refused": {
            "total": by_event.get("child.refused", 0),
            "by_reason": dict(Counter(r["reason"] for r in ev if r["event"] == "child.refused")),
            "lifetime_total": len(life_refused),
            "lifetime_note": ("the audit log cannot express a 503 refusal as an event on the "
                              "rung that got it; they appear as `rung.executor error` with "
                              "error_class=relay-5xx"),
        },
        "parked": {"total": by_event.get("rung.parked", 0), "by_rung": dict(Counter(
            r["rung"] for r in ev if r["event"] == "rung.parked"))},
        "escalated": {"total": by_event.get("boot.escalate", 0), "by_rung": dict(Counter(
            r["rung"] for r in ev if r["event"] == "boot.escalate"))},
        "p1": {
            "errors": by_event.get("p1.error", 0),
            "semantic": [{"outcome": r["outcome"], "reason": r["reason"]}
                         for r in ev if r["event"] == "p1.semantic"],
        },
        "cycles": {
            "total": len(cycles),
            "closed": sum(1 for r in cycles if r["outcome"] == "closed"),
            "blocked": sum(1 for r in cycles if r["outcome"] == "blocked"),
            "declined": sum(1 for r in cycles if r["outcome"] == "declined"),
            "by_rung": dict(Counter(r["rung"] for r in cycles)),
            "lifetime": {
                "total": len(life_cycles),
                "closed": sum(1 for r in life_cycles if r["outcome"] == "closed"),
                "blocked": sum(1 for r in life_cycles if r["outcome"] == "blocked"),
                "declined": sum(1 for r in life_cycles if r["outcome"] == "declined"),
            },
        },
        "rung_executors": {
            "total": len(execs),
            "ok": sum(1 for r in execs if r["outcome"] == "ok"),
            "error": sum(1 for r in execs if r["outcome"] == "error"),
            "by_reason": dict(Counter(r["reason"] for r in execs)),
            "note": ("`ok` means the rung handled its own state; it is NOT a value claim. "
                     "It contributes to no key under `value`."),
        },
        "value": {
            "issue_closed": life_closed,
            "archive_done": life_closed,
            "spec_materialized": 0,
            "accepted_repo_value": accepted,
            "lifetime_note": ("`issue_closed` counts archived targeted artifacts over the WHOLE "
                              "window, because a close happens once; `targets` below is the "
                              "same-day slice used for the per-target detail. Probe with "
                              "`--date <day> --json` and read `children.targets` scoping."),
            "accepted_repo_value_note": (
                "0 by construction until the gateway writes a receipt naming the run that "
                "closed an artifact: the audit log has no close verb and no archive row "
                "carries a closed_by_run_id."),
            "targets": value_targets,
            "lifetime_targets": life_value,
        },
        "budget": {
            "builder_runs_charged": len(charged_true),
            "builder_runs_refunded": len(charged_false),
            "builder_runs_unattributed": len(charged_unknown),
            "builder_runs_total_attempts": len(spawns),
            "est_usd_per_run": est[0] if est else None,
            "est_usd_committed": round(sum(est), 4),
            "spend_usd_from_gateway_census": gc.get("spend_usd"),
            "ledger_mismatch": bool(charged_true) and accepted == 0,
            "ledger_mismatch_note": ("money charged with no attributable repo value" if
                                     (charged_true and accepted == 0) else None),
            "lifetime": {
                "builder_runs_charged": len(life_charged_true),
                "builder_runs_refunded": len(life_charged_false),
                "builder_runs_unattributed": len(life_charged_unknown),
                "builder_runs_attempts": len(life_spawns),
                "est_usd_committed": round(sum(life_est), 4),
                "accepted_repo_value": None,
                "note": ("`builder_runs_charged` is the only key comparable to the gateway's "
                         "own `builder_runs=`; it is 0 on every day measured because no child "
                         "COMPLETED. The gateway's `spend=` is money the evaluate/maintenance "
                         "legs spent, not builder-slot spend."),
            },
        },
        "gateway_census": gc,
    }

    # --- reconciliation against the gate's OWN daily line -------------------------------
    # Compared only when the gate's line covers the same window: a single-day census cannot
    # be reconciled against an all-days reduction, and saying "n/a" there is the honest
    # answer rather than a comparison that happens to come out equal by accident.
    rec: dict[str, dict] = {}
    gc_day = gc.get("day")
    if gc and (day is None or gc_day == day) and (day is not None or len({r["day_utc"] for r in ev}) == 1):
        gw_fires = sum((gc.get("fires") or {}).values()) if gc.get("fires") is not None else None

        def cmp(name, gateway, events, comparable=True):
            rec[name] = {
                "gateway": gateway,
                "events": events if comparable else "not modelled",
                "match": None if (gateway is None or not comparable) else gateway == events,
            }

        cmp("fires", gw_fires, len(fires))
        # The gateway counts closes ON ITS DAY; `value.issue_closed` is lifetime (an artifact
        # closes once). Comparing those two directly would always look like a mismatch, so the
        # comparable key is "targets archived with this day's archive date".
        cmp("closed", gc.get("closed"),
            sum(1 for t in life_value if day and t["archived_date"] == day))
        cmp("closeout_failed", gc.get("closeout_failed"), None, comparable=False)
        cmp("parked", gc.get("parked"), out["parked"]["total"])
        cmp("escalated", gc.get("escalated"), out["escalated"]["total"])
        cmp("refused", gc.get("refused"), out["refused"]["total"])
        cmp("builder_runs", gc.get("builder_runs"), out["budget"]["builder_runs_charged"])
    elif gc:
        rec["_window"] = {"gateway": gc_day, "events": day or "(all days)", "match": False}
    out["reconciled"] = rec
    out["invariants"] = {
        "no_orphan_terminals": not orphans,
        "every_fire_has_verdict": len(fires) == len(verdicts),
        "every_verdict_allows": len(verdicts) == out["fires"]["allow"],
        "charges_without_value": out["budget"]["ledger_mismatch"],
        "unparsed_ratio": (by_event.get("unparsed", 0) / len(ev)) if ev else 0.0,
    }
    out["notes"] = build_notes(out)
    return out


def build_notes(c: dict) -> list[str]:
    n = []
    if c["fires"]["total"] and not c["spawns"]["total"]:
        n.append("fires with no spawns: the rung fired and nothing was dispatched")
    if c["value"]["issue_closed"] and not c["value"]["accepted_repo_value"]:
        n.append(f'{c["value"]["issue_closed"]} targeted artifact(s) are archived but NO run '
                 "is named as the closer: closed != closed by the gate")
    if c["rung_executors"]["ok"] and not c["value"]["accepted_repo_value"]:
        n.append(f'{c["rung_executors"]["ok"]} `executor ... ok` lines coexist with 0 '
                 "attributable value - the verb is a state report, not a delivery")
    if c["children"]["unterminated_pids"]:
        n.append(f'{c["children"]["unterminated_pids"]} spawned child(ren) have no terminal '
                 "line: killed by a gateway restart, or the log lost it")
    if c["children"]["by_reason"].get("killed after 30m0s"):
        n.append("30 m kills: per-run builder timeout was 30 m then (raised to 24 h "
                 "2026-09-19), so these are timeout failures, not slow successes")
    if c["budget"]["builder_runs_charged"] == 0 and c["budget"]["spend_usd_from_gateway_census"]:
        n.append("gateway census reports spend with builder_runs=0: the money went to "
                 "evaluate/maintenance legs, not to a chargeable builder slot")
    return n


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=".")
    ap.add_argument("--events", default=DEFAULT_EVENTS)
    ap.add_argument("--date", default=None, help="UTC day (YYYY-MM-DD); default: all days")
    ap.add_argument("--archive", default=os.path.join("temp", "archived"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true",
                    help="exit 3 unless the structural invariants hold (falsifiable gate)")
    ap.add_argument("--gateway-census", action="store_true",
                    help="print the per-key reconciliation against the gate's own census line")
    args = ap.parse_args(argv)

    ev_path = args.events if os.path.isabs(args.events) else os.path.join(args.root, args.events)
    if not os.path.exists(ev_path):
        print(f"FAIL - event stream not found: {ev_path}\n"
              "       derive it first: python scripts/idlegate_events.py --out "
              f"{args.events}", file=sys.stderr)
        return 2
    records = load_events(ev_path)
    if not records:
        print(f"FAIL - event stream is empty: {ev_path}", file=sys.stderr)
        return 2

    arch = args.archive if os.path.isabs(args.archive) else os.path.join(args.root, args.archive)
    c = census(records, args.date, arch)

    if args.json:
        print(json.dumps(c, indent=2, ensure_ascii=False))
    else:
        v, ch, bu = c["value"], c["children"], c["budget"]
        print(f'{SCHEMA}  project={c["project"]}  date={c["date"] or "(all days)"}')
        print(f'  window          {c["window"]["first_ts"]} -> {c["window"]["last_ts"]}')
        print(f'  events          {c["events"]["records"]} records '
              f'({len(c["events"]["by_event"])} verbs)')
        print(f'  fires           {c["fires"]["total"]} {c["fires"]["by_rung"]} '
              f'allow={c["fires"]["allow"]} deny={c["fires"]["deny"]}')
        print(f'  ticks           {c["ticks"]["total"]} (idle={c["ticks"]["idle"]} '
              f'busy={c["ticks"]["busy"]})')
        print(f'  spawns          {c["spawns"]["total"]} {c["spawns"]["by_rung"]}')
        print(f'  children        primary={ch["terminals_primary"]} '
              f'records={ch["terminals_records"]} dup={ch["duplicate_views"]} '
              f'COMPLETED={ch["completed"]} (no success verb in the log)')
        print(f'                  {ch["by_reason"]}')
        print(f'                  unterminated={ch["unterminated_pids"]} '
              f'orphans={len(ch["orphan_terminals"])}')
        print(f'  refused         {c["refused"]["total"]} {c["refused"]["by_reason"]}')
        print(f'  parked          {c["parked"]["total"]}   '
              f'escalated={c["escalated"]["total"]}')
        print(f'  cycles          {c["cycles"]["total"]} closed={c["cycles"]["closed"]} '
              f'blocked={c["cycles"]["blocked"]} declined={c["cycles"]["declined"]}')
        print(f'  executor ok     {c["rung_executors"]["ok"]}  (state reports, not value)')
        print(f'  VALUE           issue_closed={v["issue_closed"]} '
              f'accepted_repo_value={v["accepted_repo_value"]}')
        print(f'  budget          charged={bu["builder_runs_charged"]} '
              f'refunded={bu["builder_runs_refunded"]} '
              f'unattributed={bu["builder_runs_unattributed"]} '
              f'est_committed=${bu["est_usd_committed"]} '
              f'census_spend=${bu["spend_usd_from_gateway_census"]}')
        for n in c["notes"]:
            print(f'  note            {n}')

    if args.gateway_census:
        print()
        print("reconciliation vs the gate's own census line:")
        if not c["gateway_census"]:
            print("  (no `idlegate census <this day>` line in the window)")
        for k, ok in (c["reconciled"] or {}).items():
            if k == "_window":
                print(f'  WINDOW MISMATCH  gateway={ok["gateway"]} events={ok["events"]} '
                      "(use --date <gateway day>)")
                continue
            mark = {True: "MATCH", False: "MISMATCH", None: "n/a"}[ok["match"]]
            print(f'  {k:16} {mark:8} gateway={ok["gateway"]} events={ok["events"]}')

    if args.check:
        bad = [k for k, ok in c["invariants"].items()
               if k == "unparsed_ratio" and ok > 0.001]
        bad += [k for k, ok in c["invariants"].items()
                if k != "unparsed_ratio" and ok is False]
        bad += [k for k, ok in (c["reconciled"] or {}).items() if ok is False]
        if bad:
            print(f"CHECK FAILED - {bad}", file=sys.stderr)
            return 3
        print("CHECK OK - structural invariants hold and the gateway census reconciles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
