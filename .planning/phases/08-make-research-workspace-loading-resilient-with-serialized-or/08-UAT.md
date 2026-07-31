---
status: testing
phase: 08-make-research-workspace-loading-resilient-with-serialized-or
source: [08-VERIFICATION.md]
started: 2026-07-31T00:00:00.000Z
updated: 2026-07-31T00:00:00.000Z
---

## Current Test

number: 1
name: Programme switch under delayed RPCs
expected: |
  After loading programme A, open programme B while A callbacks are pending. No A profile, PEO, PLO, mapping, coverage, or review data is visible in B.
awaiting: user response

## Tests

### 1. Programme switch under delayed RPCs
expected: After loading programme A, opening programme B while A callbacks are pending leaves no A research DTO visible in B.
result: [pending]

### 2. Assessment endpoint diagnostics
expected: Forced assessment mapping and review failures name each endpoint in the UI, and Apps Script logs distinguish `assessment/mapping` from `assessment/review`.
result: [pending]

### 3. Accessible responsive recovery UI
expected: At a narrow viewport, endpoint failures retain sibling panels, announce errors through `aria-live`, support keyboard focus, and make retry buttons usable.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
