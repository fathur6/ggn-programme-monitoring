---
phase: 08-make-research-workspace-loading-resilient-with-serialized-or
plan: 03
subsystem: ui
tags: [vue, google-apps-script, rpc, research, assessment, resilience, testing]

requires:
  - phase: 08-02
    provides: aggregate research and lazy assessment RPCs with endpoint envelopes
provides:
  - Guarded Vue orchestration for aggregate research and lazy assessment workspace reads
  - Endpoint-specific loading, safe errors, and allowlisted targeted read retries
  - Deterministic client concurrency and brownfield regression coverage
affects: [research workspace, assessment workspace, client regression suite]

tech-stack:
  added: []
  patterns: [generation and canonical programme guards, endpoint-keyed partial-success state, fluent google.script.run test doubles]

key-files:
  created:
    - scripts/test-research-workspace-client.js
  modified:
    - gas/JavaScript.html
    - gas/Index.html

key-decisions:
  - "Initial research loading uses one getResearchWorkspaceApi call; assessment mapping and review remain lazy behind one getAssessmentWorkspaceApi call."
  - "Endpoint envelopes commit independently, preserve successful DTOs, and expose only allowlisted read retries; mutation methods are never replayed."
  - "Every workspace read callback is guarded by the monotonic load generation and canonical selected programme identity."

patterns-established:
  - "Research and assessment capability errors are stored as {endpoint, code, message, retryable} objects with independent loading flags."
  - "Aggregate mapping data passes through the legacy keyed-object adapter with one-value SDG/SC/TF normalization and derivedTFIds compatibility."

requirements-completed: [REL-03, REL-04]

coverage:
  - id: D1
    description: "Vue research and assessment orchestration consumes aggregate RPCs, applies partial envelopes independently, preserves mapping normalization, and rejects stale responses."
    requirement: REL-03
    verification:
      - kind: unit
        ref: scripts/test-research-workspace-client.js --orchestration
        status: pass
      - kind: unit
        ref: scripts/test-research-workspace-client.js --stale
        status: pass
    human_judgment: false
  - id: D2
    description: "The workspace visibly identifies research and assessment endpoint failures with accessible, targeted retry controls while retaining successful panels and mutation error semantics."
    requirement: REL-03
    verification:
      - kind: other
        ref: scripts/test-research-workspace-client.js --ui
        status: pass
      - kind: unit
        ref: scripts/test-research-mapping-client.js
        status: pass
    human_judgment: false
  - id: D3
    description: "Client resilience and all existing research, assessment, access, boundary, MQF, syntax, manifest, ignore, and whitespace regressions remain green."
    requirement: REL-04
    verification:
      - kind: integration
        ref: node scripts/test-research-workspace-client.js --all && for test in scripts/test-*.js; do node "$test"; done
        status: pass
      - kind: other
        ref: node scripts/verify-mqf-rebuild.js; JavaScript/GAS syntax; manifest; ignore; git diff --check
        status: pass
    human_judgment: false

duration: 17 min
completed: 2026-07-31
status: complete
---

# Phase 8 Plan 3: Guarded research workspace client orchestration Summary

**Aggregate-first Vue workspace loading now preserves partial success, attributes endpoint failures with local retries, and ignores stale programme responses under deterministic out-of-order RPC tests.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-31T03:53:00Z
- **Completed:** 2026-07-31T04:10:37Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Replaced the seven-call research fan-out with one guarded research aggregate call and independent capability-envelope commits.
- Added lazy aggregate assessment loading, endpoint-keyed loading/error state, allowlisted read retries, safe endpoint attribution, and generation/programme stale-response guards.
- Added deterministic fluent-RPC client tests for one-call boundaries, mapping normalization, partial success, targeted retries, no-argument reference retry, assessment independence, and reverse-order callbacks.
- Kept successful workspace panels usable during sibling failures and restored the existing assessment item fallback controls instead of leaving a placeholder branch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace workspace fan-out with guarded aggregate orchestration and endpoint retry state** - `2e804cc` (feat)
2. **Task 2: Render endpoint-specific non-blocking errors and actions in the workspace** - `543a1c5` (feat)
3. **Task 3: Verify client concurrency behavior and preserve the complete regression suite** - `cb90446` (test)

Additional correctness fixes:

- `1d02217` - distinguish assessment endpoint diagnostics from research review
- `e120684` - restore assessment item fallback rendering

## Files Created/Modified

- `gas/JavaScript.html` - Aggregate Vue orchestration, endpoint state, retries, mapping adapter, and generation guards.
- `gas/Index.html` - Non-blocking endpoint alerts, fatal aggregate presentation, accessible retry controls, and assessment fallback rendering.
- `scripts/test-research-workspace-client.js` - Deterministic client/static/regression test harness with fake fluent RPC calls.

## Decisions Made

- Initial research reads and lazy assessment reads use their dedicated aggregate RPCs; existing public readers remain targeted retry paths.
- Read failures never call `researchFailure()`, so partial read errors do not mark unsaved mutations dirty.
- The reference retry intentionally calls `getResearchReferencesApi()` without a programme argument and relies on server-side current-user authentication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Distinguished assessment review diagnostics from research review**
- **Found during:** Task 2 UI verification
- **Issue:** Shared endpoint label rendering described an assessment `review` failure as a research review failure.
- **Fix:** Added explicit assessment endpoint context and matching static regression assertion.
- **Files modified:** `gas/Index.html`, `scripts/test-research-workspace-client.js`
- **Verification:** `node scripts/test-research-workspace-client.js --all`
- **Committed in:** `1d02217`

**2. [Rule 1 - Bug] Replaced a literal assessment item placeholder with functional controls**
- **Found during:** final stub scan
- **Issue:** The existing non-category assessment branch contained a literal `...`, preventing Viva/Progress item rendering.
- **Fix:** Restored descriptor, MQF, taxonomy, Primary SC, derived TF, provenance, note, and validation rendering for fallback items.
- **Files modified:** `gas/Index.html`
- **Verification:** client/UI regression checks, JavaScript syntax, and full regression suite.
- **Committed in:** `e120684`

---

**Total deviations:** 2 auto-fixed (Rule 1: 2 bugs)
**Impact on plan:** Both fixes were directly required for correct endpoint attribution and complete assessment UI behavior; no architectural scope changed.

## Issues Encountered

- The shared checkout retained pre-existing `gas/Code.gs`, `gas/Styles.html`, planning graph artifacts, and research cache changes. They were preserved and not staged by this plan.
- No deployment, `clasp push`, `clasp deploy`, browser authentication, package installation, or external side effect was performed.

## Authentication Gates

None.

## Known Stubs

None in the plan-created or plan-modified functionality. Existing input `placeholder` attributes are intentional form guidance, not missing data sources.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 8 implementation plans are complete. The aggregate server contracts, guarded client orchestration, endpoint-specific recovery UX, and full deployment-free regression suite are ready for phase verification.

---
*Phase: 08-make-research-workspace-loading-resilient-with-serialized-or*
*Completed: 2026-07-31*

## Self-Check: PASSED

- Required summary, implementation, UI, and deterministic client test files exist.
- Task commits `2e804cc`, `543a1c5`, `cb90446`, `1d02217`, and `e120684` exist in Git history.
- Full client, existing `scripts/test-*.js`, MQF, syntax, manifest, ignore, and whitespace verification passed.
