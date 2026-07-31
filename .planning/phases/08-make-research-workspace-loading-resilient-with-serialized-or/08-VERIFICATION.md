---
phase: 08-make-research-workspace-loading-resilient-with-serialized-or
verified: 2026-07-31T04:35:47Z
status: human_needed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/12
  gaps_closed:
    - "Independent projection envelopes for profile, PEO, PLO, and mapping"
    - "Uniquely qualified assessment endpoint diagnostics and logs"
    - "Populated programme-A to programme-B stale-state isolation"
    - "Deterministic coverage for the remediation cases and full regressions"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "In an authorized test deployment, load populated programme A, switch to programme B while A RPCs are delayed, and let callbacks resolve out of order."
    expected: "No profile, PEO, PLO, mapping, reference, coverage, review, or assessment data from A is visible in B; B data appears when its response completes."
    why_human: "The deterministic stale test proves the state transition, but real Apps Script RPC timing and the complete authenticated user flow require a browser/session."
  - test: "In an authorized test deployment, force assessment mapping and assessment review failures independently."
    expected: "The UI identifies assessment/mapping and assessment/review separately, preserves the successful sibling data, offers the correct retry, and server logs retain the qualified endpoint and ASSESSMENT error code."
    why_human: "The server/client harness proves the contracts and log strings, but the deployed Apps Script log and browser presentation require the authorized external environment."
  - test: "Exercise the partial-failure recovery UI with keyboard navigation at a narrow viewport."
    expected: "aria-live/role=alert status is announced, endpoint-specific retry buttons are reachable and usable, and successful panels remain readable without relying on color."
    why_human: "Visual appearance, focus behavior, responsive layout, and end-user flow cannot be established by static checks; no deployment was started per instruction."
---

# Phase 8: Research Workspace Loading Resilience Verification Report

**Phase Goal:** Research programme workspaces remain usable under cold-start concurrency and slow Sheet operations: lock-sensitive reads are serialized or aggregated, transient lock contention retries with bounded backoff, and partial failures identify the exact endpoint without masking successful data.

**Verified:** 2026-07-31T04:35:47Z
**Status:** HUMAN NEEDED — automated implementation verification passed; no code gaps remain.
**Re-verification:** Yes — after remediation commit `9287144`

## Linear Context

The repository maps to the Linear project **GGN Academic Management**. Its latest project update is a baseline inventory update and contains no Phase 8 acceptance decision or active Phase 8 issue. This verification therefore uses the checked-in roadmap, plans, prior verification, and code/tests as the acceptance contract.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Initial research loading uses one aggregate call; assessment is lazy behind a separate aggregate call. | ✓ VERIFIED | `JavaScript.html:683-723,825-857`; `test-research-workspace.js --research-server/--assessment-server` and client `--all` pass. |
| 2 | One prepared server snapshot supplies profile, PEO, PLO, references, mappings, coverage, and research review. | ✓ VERIFIED | `ResearchWorkspaceService.gs:58-69,146-178`; aggregate test confirms one preparation lock and no nested lock. |
| 3 | Aggregate preparation/read projection avoids nested lock acquisition and hidden post-capture repair while targeted wrappers remain available. | ✓ VERIFIED | Prepared/no-lock helpers remain wired; aggregate purity assertion passes; existing targeted mapping/assessment regressions pass. |
| 4 | Lock-sensitive setup and mutations use one bounded four-attempt `tryLock(5000)` policy with 250/500/1000 ms backoff. | ✓ VERIFIED | `ResearchLockService.gs` shared helper; `test-research-lock-retry.js` passes exact budget/delay assertions. |
| 5 | Acquired locks release exactly once on success or thrown work; failed acquisition does not release or run protected work; mutation work is not replayed. | ✓ VERIFIED | Deterministic lock test covers success, thrown work, exhaustion, and terminal error paths. |
| 6 | Exhaustion is stable retryable `RESEARCH_LOCK_BUSY` and authorization/validation failures remain fail-closed. | ✓ VERIFIED | Lock and aggregate tests pass four-attempt busy classification; research, assessment, mapping, and boundary regressions pass. |
| 7 | Every aggregate capability has an independent envelope and partial success never loses successful data. | ✓ VERIFIED | `ResearchWorkspaceService.gs:151-177` defers profile/PEO/PLO/mapping/coverage/review production into individual envelope producers; `test-research-workspace.js:164-182` injects deterministic profile, PEO, PLO, and mapping failures and asserts sibling/reference preservation. |
| 8 | Failed endpoints are named in UI and logs with targeted retry actions. | ✓ VERIFIED | `AssessmentService.gs:469-475` emits `assessment/mapping` and `assessment/review` with `ASSESSMENT_*` codes; client/UI tests assert distinct diagnostics, visible endpoint context, and retry controls. |
| 9 | Targeted read retries preserve successful data and never replay save/reset mutations. | ✓ VERIFIED | `JavaScript.html:725-750,862-883`; client orchestration test passes targeted coverage/reference/assessment retry and no-save/reset assertions. |
| 10 | Earlier programme/load-generation responses cannot corrupt current programme state. | ✓ VERIFIED | `openProgramme` clears all research DTOs at `JavaScript.html:571-604`; generation/programme guards are at `620-623,687-710`; populated A→B reverse-order test passes in `test-research-workspace-client.js --stale`. |
| 11 | Deterministic tests cover cold-start, retries, endpoint attribution, partial success, stale safety, lock boundaries, and regressions. | ✓ VERIFIED | Full Phase 8 suite passes, including both server aggregate modes, client `--all`, every existing `scripts/test-*.js` regression, MQF/static/syntax/manifest/ignore/whitespace checks. |
| 12 | Existing research mapping, assessment, authorization, review, syntax, manifest, and static behavior remains testable. | ✓ VERIFIED | `test-research-mapping.js`, `test-research-mapping-client.js`, `test-assessment-mapping.js`, `test-task7-boundaries.js`, access/MQF tests, syntax checks, manifest JSON, and `git diff --check` all pass. |

**Score:** 12/12 truths verified (0 present-but-behavior-unverified).

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `gas/ResearchLockService.gs` | Shared bounded lock policy | ✓ VERIFIED | Substantive helper with typed busy error, injected sleeper, bounded retry, and `finally` release; used by research/assessment paths. |
| `gas/ResearchWorkspaceService.gs` | Aggregate research snapshot and independent envelopes | ✓ VERIFIED | 182-line substantive service; authenticated snapshot, pure projections, per-capability envelopes, and qualified diagnostics. |
| `gas/AssessmentService.gs` | Lazy aggregate assessment mapping/review | ✓ VERIFIED | Shared prepared context with independent mapping/review envelopes and assessment-qualified diagnostics. |
| `gas/Code.gs` | Public aggregate and targeted RPC wrappers | ✓ VERIFIED | Aggregate wrappers and compatibility targeted wrappers are present and wired. |
| `gas/JavaScript.html` | Guarded aggregate orchestration/retries | ✓ VERIFIED | Aggregate calls, endpoint state, allowlisted read retries, generation guards, and programme-switch reset are wired into Vue. |
| `gas/Index.html` | Non-blocking endpoint alerts/retries | ✓ VERIFIED | Research and assessment endpoint regions retain successful panels and expose accessible, endpoint-specific retry controls. |
| `scripts/test-research-workspace.js` | Server projection/envelope tests | ✓ VERIFIED | Deterministic projection-failure, partial-success, assessment attribution, lock, purity, and authorization cases pass. |
| `scripts/test-research-workspace-client.js` | Client concurrency/diagnostic tests | ✓ VERIFIED | Deterministic aggregate, retry, qualified diagnostic, populated A→B stale-state, UI, and regression checks pass. |

All artifacts pass existence, substantive, wiring, and (for dynamic data) data-flow checks.

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `ResearchDataService.gs` | `ResearchLockService.gs` | `ensureResearchSheets_` → shared retry helper | ✓ WIRED | Existing lock-sensitive setup uses the centralized policy. |
| `ResearchMappingService.gs` | `ResearchLockService.gs` | compatibility lock wrapper and prepared context | ✓ WIRED | Targeted and aggregate paths share the lock policy without nested acquisition. |
| `AssessmentService.gs` | `ResearchLockService.gs` | assessment setup/save/reset | ✓ WIRED | Assessment setup and mutations use the shared policy. |
| `ResearchWorkspaceService.gs` | `ResearchLockService.gs` | `withPreparedResearchContext_` | ✓ WIRED | One setup/migration/reference/capture boundary feeds the aggregate snapshot. |
| `ResearchWorkspaceService.gs` | mapping/review services | pure snapshot projection helpers | ✓ WIRED | Mappings, coverage, and review consume captured data and preserve DTO semantics. |
| `JavaScript.html` | `Code.gs` | aggregate RPC calls with selected identity | ✓ WIRED | Initial and lazy calls use `getResearchWorkspaceApi(programmeId)` and `getAssessmentWorkspaceApi(programmeId)`. |
| `JavaScript.html` | `Index.html` | endpoint error state → labels/retries | ✓ WIRED | Vue endpoint-keyed state drives visible alerts and retry actions. |
| `JavaScript.html` | itself | generation/programme guards | ✓ WIRED | Workspace read callbacks call `isCurrentResearchRead` before state commits. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ResearchWorkspaceService.gs` | `snapshot.rows`, `snapshot.references` | Captured Sheet ranges and prepared reference rows inside `withPreparedResearchContext_` | Yes | ✓ FLOWING |
| `JavaScript.html` | research/assessment DTO state | Aggregate RPC success envelopes and targeted read wrappers | Yes | ✓ FLOWING |
| `Index.html` | workspace panels and endpoint alerts | Vue DTO/error/loading state rendered by the template | Yes | ✓ FLOWING; prior-programme state is cleared before the next load. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Lock contention, exact backoff, release, exhaustion, terminal error | `node scripts/test-research-lock-retry.js` | Passed | ✓ PASS |
| Research aggregate cold-start, independent projection failures, partial success, purity, auth, busy error | `node scripts/test-research-workspace.js --research-server` | Passed | ✓ PASS |
| Lazy assessment aggregate, qualified mapping/review diagnostics, strict Primary SC, inverse partial success | `node scripts/test-research-workspace.js --assessment-server` | Passed | ✓ PASS |
| Client orchestration, qualified logs, targeted retries, UI contracts, stale safety | `node scripts/test-research-workspace-client.js --all` | Passed | ✓ PASS |
| Named populated programme-A → programme-B stale transition | `node scripts/test-research-workspace-client.js --stale` | Passed | ✓ PASS |
| Existing regressions | `node scripts/test-coor-access.js`, `test-mqf-overdue.js`, `test-research-mapping.js`, `test-research-mapping-client.js`, `test-assessment-mapping.js`, `test-task7-boundaries.js` | All passed | ✓ PASS |

## Probe Execution

No `probe-*.sh` files are declared or discovered for Phase 8. The phase uses deterministic Node harnesses; all declared server/client and regression commands were run directly.

## Requirements Coverage

`REL-01` through `REL-04` are Phase 8 roadmap/plan requirements and are not defined in `.planning/REQUIREMENTS.md`; no orphaned Phase 8 IDs are present there.

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REL-01 | 08-02 | Serialize/aggregate lock-sensitive workspace reads | ✓ SATISFIED | One research aggregate and one lazy assessment aggregate; one-lock/no-nested-lock tests pass. |
| REL-02 | 08-01 | Central bounded retry/backoff and guaranteed release | ✓ SATISFIED | Shared retry helper and deterministic release/exhaustion tests pass. |
| REL-03 | 08-02, 08-03 | Endpoint-specific errors, partial success, stale-response protection | ✓ SATISFIED | Independent research/assessment envelopes, qualified diagnostics, A→B reset/guards, and client tests pass. |
| REL-04 | 08-01, 08-02, 08-03 | Concurrency/partial-failure/stale tests and full regressions | ✓ SATISFIED | Full Phase 8 suite and static/syntax/manifest checks pass. |

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `gas/AssessmentService.gs` | Empty-array JSON parse fallback | Info | Intentional defensive normalization; not rendered as a static data source. |
| `gas/ResearchReferenceService.gs` | Empty/null defensive reference fallbacks | Info | Intentional malformed/empty-reference handling; no user-visible stub path. |
| `gas/PEOService.gs`, `gas/PLOService.gs` | Legacy direct long lock waits | Warning | Outside the Phase 8 aggregate workspace call graph and not modified by remediation; retained brownfield surface, not a Phase 8 verification failure. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in the Phase 8 implementation/test files. No implementation stub or hardcoded rendered data source was found.

## Human Verification Required

Automated verification is complete, but the following residual checks require an authorized test deployment/session. No deployment was started and no production data was changed.

### 1. Programme switch under delayed RPCs

**Test:** Populate programme A, open programme B while A callbacks are pending, and allow responses to resolve out of order.
**Expected:** B never displays A's profile, PEO/PLO, mappings, references, coverage, review, or assessment state; B data appears when its response completes.
**Why human:** The deterministic client test passes, but real Apps Script callback timing and the authenticated browser flow are external/runtime behavior.

### 2. Assessment endpoint diagnostics in the deployed environment

**Test:** Force assessment mapping and assessment review failures independently.
**Expected:** The UI names `assessment/mapping` and `assessment/review` separately, preserves the successful sibling, exposes the correct retry, and Apps Script logs contain the qualified endpoint and `ASSESSMENT_*` code.
**Why human:** The local server/client harness proves the contract; deployed Apps Script logging and browser rendering require the authorized environment.

### 3. Accessible responsive recovery UI

**Test:** Navigate the partial-failure alerts and retry controls by keyboard at a narrow viewport while a sibling endpoint is failed.
**Expected:** Alerts are announced, focus remains usable, retry controls operate only on the selected endpoint, and successful panels remain readable without color-only meaning.
**Why human:** Visual, responsive, focus, and end-user flow quality cannot be established by static checks.

## Gaps Summary

Remediation commit `9287144` closes all four gaps from the prior `8/12` verification: profile/PEO/PLO/mapping projection failures are now captured by independent envelope producers; assessment diagnostics use qualified endpoint names and `ASSESSMENT_*` codes in both server and client logs; `openProgramme` clears all prior research DTOs before starting a new generation; and deterministic tests cover each remediation path plus the complete regression suite. The automated implementation result is therefore **PASS, 12/12**. Overall workflow status is `human_needed` only because authorized deployed/browser verification was not run, as required by the no-deploy instruction.

---

_Verified: 2026-07-31T04:35:47Z_  
_Verifier: the agent (gsd-verifier)_
