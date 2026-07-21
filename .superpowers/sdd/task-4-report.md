# Task 4 Report

## Scope

Implemented postgraduate research review validation, status transitions, submission checks, coverage metrics, and GovernanceService integration.

## Implementation

- Added `gas/ResearchReviewService.gs` with:
  - `validateResearchProgramme_`
  - Critical validation for PLO code, statement, parent PEO, MQF domains, TF derivation, and PEO child coverage.
  - Non-blocking warnings for missing SDG/SC mappings, broad statements, and MQF concentration.
  - Configurable required-policy handling for SDG, SC, and broad-statement rules.
  - Review metrics and PEO coverage output.
  - Programme-scoped review, status-save, and submission APIs.
  - Script locking and server-side `updatedAt`/`updatedBy` audit fields.
  - String serialization for returned dates.
- Added Code.gs wrappers for review, status, and submission endpoints.
- Updated GovernanceService to route Masters/Doctorate research programmes through server-side review results without using legacy readiness fields or document readiness.
- Extended research mapping tests with RED validation assertions, status transitions, metrics, successful submission, and server-side rejection after persisted data becomes invalid.
- Extended static verification for the new service, wrappers, access guards, locks, audit fields, and dashboard integration.

## Verification

All passed:

- `node scripts/test-research-mapping.js`
- `node scripts/test-mqf-overdue.js`
- `node scripts/verify-mqf-rebuild.js`
- `node scripts/test-coor-access.js`
- `git diff --cached --check`

The required RED run failed before implementation because `validateResearchProgramme_` was missing. The subsequent green runs passed.

## Commit

`2c7df3b feat: add postgraduate research review status`

Only these Task 4 files were committed:

- `gas/ResearchReviewService.gs`
- `gas/Code.gs`
- `gas/GovernanceService.gs`
- `scripts/test-research-mapping.js`
- `scripts/verify-mqf-rebuild.js`

## Concerns

- Apps Script deployment/runtime behavior was not exercised; verification used the repository's Node-based boundary and static checks.
- Existing untracked `.DS_Store` files remain untouched.
- `gas/Config.gs` and `gas/.clasp.json` were not read, modified, staged, or committed.

## Task 4 Review Fixes

- Restricted research status mutation to the explicit transition matrix. Editors can save only Draft, Needs attention, and Ready for review; Submitted requires the guarded submit API; Approved and Returned for revision require Graduate School admin access.
- Made submission validation and Submitted persistence one fresh-snapshot research-lock transaction.
- Recomputed current review status after persisted-data edits so critical errors demote stale Submitted/Approved/Returned for revision statuses to Needs attention.
- Scoped non-admin university dashboard aggregation to the user faculty before computing programme detail, while preserving aggregate status output and admin drill-down capability.
- Made research mapping complete only when every PLO has valid MQF and derived TF state, with `ploWithValidTF` metrics.
- Added behavioral tests for transition and role restrictions, atomic submission locking, stale submitted data, non-admin dashboard scope, and partial mapping readiness.

## Review Fix Verification

Exact required command results:

```text
$ node scripts/test-research-mapping.js
Research mapping boundary tests passed.

$ node scripts/test-mqf-overdue.js
MQF overdue tests passed.

$ node scripts/verify-mqf-rebuild.js
MQF rebuild static checks passed.

$ node scripts/test-coor-access.js
COOR access behavior tests passed.

$ git diff --check
(no output; passed)
```
