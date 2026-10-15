# Terminal model-call telemetry schema (`perf-model-call/1`)

Track `runtime_perf_20261015`. This is the contract `scripts/perf/model_call_telemetry.py` and
`scripts/perf/model_call_telemetry.js` write and `scripts/perf/validate_model_call_telemetry.js`
enforces. One store, one shape, both runtimes.

Store: `temp/perf/model_calls.jsonl` (override with `--store` or `MODEL_CALL_TELEMETRY_STORE`).
Append-only JSONL, one object per line. The directory is under `temp/`, which this repository
gitignores, so runtime telemetry is never a committed artifact.

## Why a PROJECT store and not `temp/modelstack/telemetry.jsonl`

Measured (track spec §F-2): every one of the 45,589 terminal `model_call_*` rows in the framework's
relay store is `producer=reasonix_proxy` / `call_origin=relay`. That store is the RELAY's own
accounting, and `scripts/utility_telemetry.py` computes the project's cost-to-useful ratios from it.
A project script appending relay-shaped rows there would be counted as relay traffic by every
consumer of that file. The area's calls therefore go to their own store, and the report reads the two
as two populations and never subtracts one from the other.

## Events

A logical call emits, in order:

| event | when | carries |
| --- | --- | --- |
| `model_call_started` | once, before the first attempt | `budget_s`, `session_cap_s` |
| `model_call_progress_tick` | only for a call past the progress threshold | `elapsed_ms` |
| `model_call_terminal` | EXACTLY ONCE, whatever the outcome | `status`, `duration_ms`, the flags |

`model_call_progress_tick` is emitted on a timer while the transport is running, so a headless CLI
gate — which has no UI and no user watching — still has a surface that says "this is still working".

## Fields on every record

| field | type | meaning |
| --- | --- | --- |
| `schema` | string | `perf-model-call/1` |
| `event` | string | one of the three above |
| `ts` | string | UTC, millisecond precision, `...Z` |
| `call_id` | string | ties the lifecycle together; ONE terminal per id |
| `site` | string | the calling script's repo-relative path (e.g. `scripts/muse_gate.py`) |
| `role` | string | the invoking role (`reasonix-agent`, `maintenance`) |
| `model` | string | the model label; `unknown` is allowed ONLY with `model_cause` |
| `provider` | string | the endpoint or transport identifier the call went to |
| `request_class` | string | the declared budget class (see `latency-budgets.md`) |
| `fingerprint_hash` | string | `sha256:` + 16 hex over model/provider/site + a HASH of the request material |

## Terminal-only fields

| field | type | means |
| --- | --- | --- |
| `status` | string | `success` \| `error` \| `timeout` \| `cancelled` — REQUIRED |
| `duration_ms` | number | wall-clock of the whole logical call, retries included — REQUIRED |
| `timeout_flag` | bool | `true` iff `status=timeout` |
| `cancel_flag` | bool | `true` iff `status=cancelled` |
| `cache_hit_flag` | bool | `true` iff this caller shared another call's result |
| `cache_age_ms` | number\|null | age of a cached result (null until a cacheable class exists) |
| `cache_policy` | string | `disabled` \| `coalesce` |
| `attempts` | number | how many transport attempts the chain used |
| `budget_s` | number | the per-attempt budget THIS call ran under (so a record is self-describing) |
| `session_cap_s` | number | the cap on the whole retry chain |
| `error_class` / `error_code` | string\|null | the failure's type and a truncated message |

## The three rules the schema exists to make checkable

1. **A terminal event on every outcome.** A failure, a budget expiry and a cancel are terminal
   telemetry, never an omission. The validator fails on a `model_call_started` with no terminal, so
   "the call died" cannot be recorded as "the call was never made".
2. **`duration_ms` always present on a terminal event.** This is AC-1's own clause: it is what the
   dossier could not say for 1,093 rows, and what makes a p95 possible at all.
3. **`model=unknown` needs a cause.** A record may not say "unknown" and stop: `model_cause` names
   why, so the unknown rate is actionable rather than a dump.

## Privacy

Raw prompt text is NEVER stored. `fingerprint_hash` is a digest over the model, the provider, the
site and a SHA-256 of the request material, truncated to 16 hex characters — enough to identify a
REPEAT (that is what `cache_hit_flag` and the redundancy analysis need) and not enough to reconstruct
anything. The section is intentionally short: the only prompt-shaped value that leaves the helper is
this digest, and `cache_age_ms`/`cache_policy` exist so a future cache can be audited without ever
storing a prompt.
