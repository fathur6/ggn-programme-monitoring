---
phase: 08-make-research-workspace-loading-resilient-with-serialized-or
plan: 02
subsystem: api
tags: [google-apps-script, sheets, rpc, research, assessment, testing]

requires:
  - phase: 08-01
    provides: bounded lock retry, prepared research/assessment contexts, and no-lock setup/reference helpers
provides:
  - Aggregate research workspace RPC with seven endpoint-attributed partial-success envelopes
  - Lazy assessment aggregate RPC sharing one prepared setup/capture context for mapping and review
  - Deterministic server tests for cold start, partial failure, authorization, read purity, and assessment semantics
affects: [08-03 guarded Vue orchestration, endpoint-specific retries, stale-response protection]

tech-stack:
  added: []
  patterns: [prepared Sheet snapshot followed by pure projection, stable safe error envelopes with server diagnostics, shared assessment context with strict review projection]

key-files:
  created:
    - gas/ResearchWorkspaceService.gs
    - scripts/test-research-workspace.js
  modified:
    - gas/Code.gs
    - gas/ResearchDataService.gs
    - gas/ResearchMappingService.gs
    - gas/ResearchReviewService.gs
    - gas/AssessmentService.gs

key-decisions:
  - "Capture research rows and legacy fallback data inside one prepared lock boundary, then derive all seven DTOs outside the lock without public-endpoint fan-out or TF repair writes."
  - "Keep assessment mapping and strict Primary SC review as independent envelopes computed from one prepared definitions/alignment/reference snapshot only when the assessment tab requests it."
  - "Use stable endpoint/error codes and safe client messages while logging endpoint attribution and diagnostic detail only on the server."

patterns-established:
  - "Aggregate readers return {ok, data, error, retryable} per capability and fail closed at authentication, programme, or shared setup boundaries."
  - "Targeted legacy readers and mutation paths remain available; aggregate read projections consume detached captured rows and never invoke write-repair helpers."

requirements-completed: [REL-01, REL-03, REL-04]

coverage:
  - id: D1
    description: "Initial research loading exposes one aggregate RPC with profile, PEO, PLO, references, mappings, coverage, and review envelopes from one prepared snapshot."
    requirement: REL-01
    verification:
      - kind: integration
        ref: scripts/test-research-workspace.js --research-server
        status: pass
      - kind: other
        ref: research aggregate static acceptance and git diff --check
        status: pass
    human_judgment: false
  - id: D2
    description: "Lazy assessment loading exposes independent mapping and strict-review envelopes from one shared setup/projection context while preserving existing mutation compatibility."
    requirement: REL-03
    verification:
      - kind: integration
        ref: scripts/test-research-workspace.js --assessment-server
        status: pass
      - kind: unit
        ref: scripts/test-assessment-mapping.js
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic regression coverage proves partial success, safe error metadata, authorization isolation, bounded busy errors, read purity, and brownfield compatibility."
    requirement: REL-04
    verification:
      - kind: integration
        ref: scripts/test-research-mapping.js, scripts/test-assessment-mapping.js, scripts/test-task7-boundaries.js
        status: pass
      - kind: other
        ref: scripts/verify-mqf-rebuild.js plus JavaScript/GAS syntax and manifest checks
        status: pass
    human_judgment: false

duration: 18 min
completed: 2026-07-31
status: complete
---

# Phase 8 Plan 2: Aggregate research and assessment RPCs Summary

**Aggregate research and lazy assessment RPCs now share prepared Sheet snapshots, preserve partial success, and expose stable safe endpoint errors without read-time mutation.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-31T03:33:00Z
- **Completed:** 2026-07-31T03:50:50Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `getResearchWorkspaceApi` with one authenticated prepared setup/migration/reference/capture boundary and pure profile, PEO, PLO, reference, mapping, coverage, and review projections.
- Added independent endpoint envelopes with stable codes, safe messages, retryability, server-side endpoint diagnostics, and fail-closed top-level authorization/setup errors.
- Added lazy `getAssessmentWorkspaceApi` using one prepared definitions/alignment/reference context while retaining non-review mapping semantics and strict Primary SC review validation.
- Added deterministic fake LockService/Sheets/auth tests for shared lock ownership, cold-start setup, composite identity, partial failures, read purity, busy exhaustion, reference signature, assessment aggregation, and compatibility regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the aggregate research snapshot RPC and endpoint envelopes** - `5baec0f` (feat)
2. **Task 2: Add the shared-context assessment mapping and review aggregate** - `881afa4` (feat)
3. **Task 3: Prove aggregate cold-start, partial-failure, read-purity, and shared-assessment behavior** - `18379e3` (test)

## Files Created/Modified

- `gas/ResearchWorkspaceService.gs` - Prepared research snapshot, pure projections, stable envelopes, and authenticated aggregate builder.
- `gas/Code.gs` - Public research and assessment aggregate wrappers; existing targeted wrappers remain available.
- `gas/ResearchDataService.gs` - Detached no-lock workspace row capture helper.
- `gas/ResearchMappingService.gs` - Pure mapping projection that does not repair stored TF rows.
- `gas/ResearchReviewService.gs` - Reusable review-result projection preserving existing status semantics.
- `gas/AssessmentService.gs` - Lock-released prepared assessment context, aggregate mapping/review builder, and shared review projection helper.
- `scripts/test-research-workspace.js` - Deployment-free aggregate server and regression test harness.

## Decisions Made

- Aggregate research reads capture once under the prepared lock and project outside it; targeted wrappers continue to support compatibility refreshes.
- Assessment remains lazy and separate from the initial research response; mapping and review share setup but retain their different validation requirements.
- Diagnostics are logged with endpoint and stable code, while client envelopes expose only safe messages and retryability.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The shared checkout contained pre-existing `gas/Index.html`, `gas/JavaScript.html`, `gas/Styles.html`, planning graph artifacts, and a research cache. They were preserved and not staged by this plan.
- Pre-existing assessment targeted wrappers in `gas/Code.gs` were preserved as unrelated worktree changes while the new aggregate wrappers were committed separately.
- The requirements handler reported `REL-01`, `REL-03`, and `REL-04` as not found in `.planning/REQUIREMENTS.md`; no unrelated requirement records were invented.

## Authentication Gates

None.

## Known Stubs

None found in the files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `08-03-PLAN.md`; the client can consume the aggregate contracts, apply endpoint-specific retries, and add stale-generation guards without changing server DTO semantics.

---
*Phase: 08-make-research-workspace-loading-resilient-with-serialized-or*
*Completed: 2026-07-31*

## Self-Check: PASSED

- Required summary path was created.
- Task commits `5baec0f`, `881afa4`, and `18379e3` exist in Git history.
- Research and assessment aggregate tests, existing mapping/assessment/boundary regressions, MQF static checks, JavaScript/GAS syntax checks, manifest validation, and `git diff --check` passed.
