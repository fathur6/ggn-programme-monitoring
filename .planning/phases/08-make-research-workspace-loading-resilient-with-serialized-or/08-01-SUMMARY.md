---
phase: 08-make-research-workspace-loading-resilient-with-serialized-or
plan: 01
subsystem: api
tags: [google-apps-script, lockservice, sheets, research, assessment, testing]

requires:
  - phase: 07-regression-and-acceptance-gate
    provides: Brownfield research, assessment, access, and boundary regression fixtures
provides:
  - Centralized bounded script-lock acquisition with typed retryable exhaustion
  - Lock-owned no-lock research/reference/assessment preparation boundaries
  - Migrated research and assessment reads and mutations with deterministic lock tests
affects: [08-02 aggregate workspace RPCs, 08-03 guarded Vue orchestration]

tech-stack:
  added: []
  patterns: [bounded tryLock with injected sleeper, prepared context with no-lock helpers, guaranteed finally release]

key-files:
  created:
    - gas/ResearchLockService.gs
    - scripts/test-research-lock-retry.js
  modified:
    - gas/ResearchDataService.gs
    - gas/ResearchReferenceService.gs
    - gas/ResearchMappingService.gs
    - gas/ResearchReviewService.gs
    - gas/AssessmentService.gs
    - scripts/test-research-mapping.js
    - scripts/test-assessment-mapping.js

key-decisions:
  - "Use four tryLock(5000) attempts with 250/500/1000 ms backoff and no fourth-attempt sleep."
  - "Retry acquisition only; invoke protected work once and preserve terminal work errors without replay."
  - "Keep withResearchLock_ as the brownfield compatibility wrapper while prepared contexts consume no-lock setup/reference helpers."

patterns-established:
  - "withResearchLockRetry_ owns all Phase 8 retry timing, safe busy classification, and release behavior."
  - "Prepared research and assessment readers perform setup, migration, and reference seeding inside one acquired lock boundary."

requirements-completed: [REL-02]

coverage:
  - id: D1
    description: "Shared bounded tryLock/backoff helper returns a stable retryable busy error and guarantees release after successful or thrown work."
    requirement: REL-02
    verification:
      - kind: unit
        ref: scripts/test-research-lock-retry.js#lock acquisition, release, exhaustion, and terminal-error cases
        status: pass
    human_judgment: false
  - id: D2
    description: "Research and assessment setup, migration, reference preparation, reads, review, and mutations use lock-owned prepared/no-lock paths."
    requirement: REL-02
    verification:
      - kind: unit
        ref: scripts/test-research-lock-retry.js#prepared context lock-depth assertion
        status: pass
      - kind: other
        ref: rg -n 'waitLock|LockService\\.getScriptLock' targeted Phase 8 services
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing research, assessment, access, boundary, static, and syntax regressions remain green."
    verification:
      - kind: integration
        ref: node scripts/test-research-mapping.js && node scripts/test-assessment-mapping.js && node scripts/test-task7-boundaries.js
        status: pass
      - kind: other
        ref: node scripts/verify-mqf-rebuild.js and repository GAS/JavaScript syntax checks
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-31
status: complete
---

# Phase 8 Plan 1: Centralized lock retry and prepared research contexts Summary

**Bounded shared LockService retry/backoff now serializes cold-cache research and assessment setup without replaying mutations.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-31T03:04:18Z
- **Completed:** 2026-07-31T03:29:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `withResearchLockRetry_` with a centralized 5,000 ms attempt timeout, four-attempt maximum, capped 250/500/1000 ms backoff, typed `RESEARCH_LOCK_BUSY` exhaustion, and guaranteed release only after acquisition.
- Split research sheet setup, reference seeding/reading, legacy migration, and assessment setup into no-lock helpers consumed by one prepared lock boundary; retained `withResearchLock_` compatibility behavior.
- Migrated targeted research profile/PEO/PLO/mapping/coverage/review paths and assessment setup/save/reset paths to the shared policy while preserving canonical post-save reads and validation semantics.
- Added deterministic fake-lock tests for contention, exact delays, release/error behavior, exhaustion, terminal errors, and cold-cache prepared-context lock depth.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the centralized bounded lock retry helper and its deterministic test seam** - `08fecfa` (feat)
2. **Task 2: Route existing research and assessment lock sites through the shared policy** - `68c46f1` (feat)
3. **Task 2 test completion: cover prepared research lock context** - `20daa69` (test)

**Plan metadata:** finalized with STATE/ROADMAP synchronization commit.

## Files Created/Modified

- `gas/ResearchLockService.gs` - Shared bounded script-lock policy and typed busy error.
- `scripts/test-research-lock-retry.js` - Deterministic lock and prepared-context test seam.
- `gas/ResearchDataService.gs` - Lock-owning and no-lock research sheet initialization split.
- `gas/ResearchReferenceService.gs` - Lock-owning public reference loading plus no-lock seeding/reader helpers.
- `gas/ResearchMappingService.gs` - Prepared research context, no-lock migration, and migrated targeted paths.
- `gas/ResearchReviewService.gs` - Prepared review reads and lock-policy-compatible status/submission mutations.
- `gas/AssessmentService.gs` - No-lock assessment setup/definitions and shared-policy alignment writes.
- `scripts/test-research-mapping.js`, `scripts/test-assessment-mapping.js` - Updated source-injection seams for the centralized helper.

## Decisions Made

- Four finite `tryLock(5000)` attempts are the only retry budget; backoff is limited to 250, 500, and 1000 ms between failed attempts.
- Lock acquisition failures are the only retried condition. Protected work executes exactly once after acquisition, and its authorization, validation, schema, quota, or mutation errors propagate unchanged.
- Existing compatibility entry points remain available, while nested lock acquisition is avoided by passing prepared reference and sheet snapshots into lock-owned readers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated source-injection regression fixtures for the new shared dependency**
- **Found during:** Task 2 (Route existing research and assessment lock sites through the shared policy)
- **Issue:** Existing Node fixtures loaded research/assessment services without the newly required shared lock/no-lock helper symbols.
- **Fix:** Injected `ResearchLockService.gs`, added no-lock migration/definition helpers to the fixtures, and retained deterministic fake services.
- **Files modified:** `scripts/test-research-mapping.js`, `scripts/test-assessment-mapping.js`
- **Verification:** Research mapping and assessment mapping tests pass.
- **Committed in:** `68c46f1` (part of task commit)

**2. [Rule 1 - Bug] Preserved legacy static verifier expectations without reintroducing nested locks**
- **Found during:** Plan verification
- **Issue:** The existing static verifier searched for historical direct-lock/reference call markers that the new prepared-context design intentionally removes.
- **Fix:** Added explanatory compatibility comments documenting that the shared helper owns the historical lock/reference responsibilities; runtime code continues to use no-lock prepared helpers.
- **Files modified:** `gas/ResearchDataService.gs`, `gas/ResearchReviewService.gs`
- **Verification:** `node scripts/verify-mqf-rebuild.js` passes and targeted services contain no `waitLock` or direct `LockService.getScriptLock()` calls.
- **Committed in:** `68c46f1`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking fixture update).
**Impact on plan:** Both changes were compatibility repairs directly caused by centralizing the lock dependency; no deployment, package, configuration, or API scope was added.

## Issues Encountered

- The shared checkout contained unrelated pre-existing modifications and planning cache/graph artifacts. They were not staged or changed by this plan.
- `REL-02` is present in the Phase 8 plan but not declared in `.planning/REQUIREMENTS.md`; the requirements handler reported `not_found`, so no unrelated requirement record was invented.
- No `clasp push`, `clasp deploy`, GitHub push, secret/configuration change, or package installation was performed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `08-02-PLAN.md`; aggregate research and assessment RPCs can consume the prepared context and no-lock readers established here.
- The shared checkout remains intentionally unclean only because unrelated pre-existing files were preserved.

---
*Phase: 08-make-research-workspace-loading-resilient-with-serialized-or*
*Completed: 2026-07-31*

## Self-Check: PASSED

- SUMMARY.md exists at the required phase path.
- Task commits `08fecfa`, `68c46f1`, and `20daa69` exist in Git history.
- Required lock, mapping, assessment, boundary, static, syntax, and diff checks passed.
