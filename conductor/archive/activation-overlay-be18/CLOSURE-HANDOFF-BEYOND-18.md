**Status:** OPEN — awaiting the verifier-role trusted channel (operator; see §3)

**Track:** `activation-overlay-be18` (archived, complete) · **Fixed by:** commit `54cda05` (local only — never pushed, per the fleet never-push rule), implementation tree byte-identical to the tested tree (`git diff 54cda05 HEAD -- js test` = empty).

## 1. What is done

BEYOND-18's defect is fixed, red→green verified, and measured on camera:

- Contract: `npx mocha test/unit/activation_overlay_contract.test.js` → 6/6.
- Repro (host boot): `BEYOND18_HOST=1 npx mocha test/browser_e2e/beyond18_activation_overlay_repro.spec.js` → 3/3, **mid-boot snapshot observed the overlay `active` while boot work was still running**.
- Capture: `OVERLAY_SHOTS=1 npx mocha test/browser_e2e/beyond18_activation_overlay_capture.spec.js` → 2/2 (self-verifying pixel assertions, not DOM-state trust).
- Full suite 2241 passing / 0 failing; eslint + `node --check` clean.

## 2. What is already on the tracker

- Closure comment `7-92` (full narrative + commands) and attachments `12-2` / `12-3` (`be18-mid-boot-active.png`, `be18-post-boot-dismissed.png`), both read back from YouTrack.
- The issue sits at **State=Triage** — the contract's own entry state (RF-07, `instance.py:101`). This is CONFORMING, not neglect: 173/173 fleet issues measured in Triage before the accept rung existed (that measurement produced `accept.py`).

## 3. What only the operator's verifier channel can do — the honest reason this card exists

The terminal state this defect earns is **Done + Fixed** (`close.py`: `Fixed` closes only into `Done`; administrative resolutions may never reach `Done`, RF-06). That edge is gated by the trusted verifier channel, and this session CANNOT walk it — three measured blockers:

1. **Credential:** the channel binds through `supervisor.bind_actor(role="verifier")`, which resolves `YOUTRACK_CONSULTANT_CHALLENGER_AGENT_TOKEN` (from `[youtrack] role_verifier`) from env or the fleet store (`modelstack_framework/temp/secrets.env`). No role credential exists in this session's environment (only model-provider keys). The shared `YOUTRACK_TOKEN` is explicitly NOT a role credential — riding it is the defect the broker refuses.
2. **Trusted declarations:** `[youtrack]` in `reasonix.toml` has `project_key`/`authority`/`role_*` but NOT the three facts the supervisor reads (`scope_revision` ≥ 1, `repository_identity` = owner repo, `approved_integration_ref` = a `refs/heads/<branch>` ref). `trusted_inputs()` returns refusals for all three; the prover's ancestry comparison needs them.
3. **RF-15 separation:** the submitter and the verifier must be DIFFERENT identities (`EVIDENCE_SELF_VERIFICATION_REFUSED`; the project's own comment: consultant-challenger "does not do the work"). A session that both implements and adjudicates is exactly what the policy forbids.

**Operator recipe when the channel is available** (PLAN-first, all instruments are `plan` by default):

1. Accept: `python vendor/youtrack/accept.py plan --issue BEYOND-18 --root .` then `--apply` (Triage→Open; the only edge the accept rung offers — `--automation Ready` needs an operator approvalRef).
2. Declare the three `[youtrack]` facts in `reasonix.toml`, then submit evidence as the OWNER seat: manifest per `framework/youtrack/schemas/evidence.schema.json` — `landing.kind="code"`, `implementationCommit=54cda05…`, `integrationHead=<the approved ref's tip>`, `testedTreeOid=8733d791f46422eda8af044eb60348577e482df1` (= `54cda05^{tree}`; the suite ran on exactly this tree), ≥1 testRun with zero exit and a sha256'd artifact, `ancestryVerified=true`, `noPushPerformed=true`; `review.verdict="Pending"` with a DIFFERENT reviewerIdentity; attestation method `trusted-runner-channel`.
   `python vendor/youtrack/submit_evidence.py plan --manifest <path> --issue BEYOND-18 --root .` → `--apply` (records state=PENDING under the owner credential).
3. The VERIFIER seat (consultant-challenger, out-of-band) then re-submits/re-adjudicates: same manifest with `review.verdict="Accepted"` — `adjudicate` measures the tree itself (`git merge-base --is-ancestor 54cda05 <integrationHead>`, cat-file -e both commits, is-shallow-repository) and records VERIFIED. Any tree drift between run and landing is refused by name (`EVIDENCE_TESTED_TREE_MISMATCH_REFUSED`) — hence the byte-identical diff in §1.
4. Close: `python vendor/youtrack/close.py plan --issue BEYOND-18 --resolution Fixed --to Done --evidence-ref "commit 54cda05 + store evidenceId" --root .` → `--apply`. The citation lands in the issue's `Closure Evidence Ref` field in the same mutation.

**What was NOT done, on purpose:** closing BEYOND-18 as `Closed/No Action` (legal from Triage, proven by a PLAN run) would be a false attestation — the defect was fixed by CODE, and `close.py`'s own docstring says an act must never guess a resolution; a no-code resolution masquerading as a Fixed fix is what RF-16 forbids. The card therefore sits at the conforming entry state with its evidence already attached, pending the one channel that can make the DONE attestation true.

## 4. Filed by

Reasonix session (builder/owner seat), 2026-11-01, project dndbeyond-printenhance. Local commits `54cda05` (fix + track) and `d14e818` (archived closure frames) — pending local-only, never pushed.
