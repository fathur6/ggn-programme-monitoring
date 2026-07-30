# Phase 7: Regression and Acceptance Gate — Specification

**Created:** 2026-07-30
**Ambiguity score:** 0.08 (gate: <= 0.20)
**Requirements:** 7 locked

## Goal

The Assessment Mapping increment can be accepted only when focused assessment tests, existing brownfield regressions, negative-boundary checks, and a durable gate report prove academic fidelity, security isolation, provenance integrity, SDG exclusion, and operational scope compliance.

## Background

The repository currently has Node/CommonJS static and syntax test scripts for research mapping, client behavior, access boundaries, MQF rebuild boundaries, and deployment-scope checks. These existing checks pass, but no Assessment Mapping implementation or assessment-specific fixtures exist yet. The Phase 7 gap is therefore a final evidence layer: tests must cover the new assessment contract and prove that existing `Pemetaan Program`, PEO/PLO, SDG, access, and deployment boundaries were not regressed. The final artifact must distinguish accepted, blocked, and unresolved gates rather than treating provisional academic inputs as approved.

## Requirements

1. **Academic fidelity tests**: Focused tests prove the approved Master and PhD profile behavior, wrong-level rejection, Viva taxonomy differences, approved Progress Item 9 wording, and exact Viva, Progress, and thesis totals/descriptors.
   - Current: Existing tests cover PLO/MQF/TF/SDG/SC behavior, but no Assessment Mapping fixtures or rubric fidelity tests exist.
   - Target: Assessment-specific fixtures and tests assert source/version identity, profile applicability, item counts/descriptors, taxonomy differences, and reconciled totals.
   - Acceptance: The assessment test command exits successfully only when all approved source fixtures match expected profile, wording, taxonomy, item-count, and total-mark assertions; a wrong-level or changed descriptor fixture fails.

2. **Primary SC cardinality tests**: Tests prove that every approved Progress Report item has one default Primary SC and that active assessment alignment rejects zero or multiple Primary SC values.
   - Current: Existing PLO mapping tests exercise its own SC behavior; no scalar Assessment Mapping Primary SC contract exists.
   - Target: Assessment fixtures use a scalar default Primary SC and negative tests cover empty and multi-value candidate payloads.
   - Acceptance: The test suite passes only when all approved Progress items have exactly one default Primary SC and both zero-selection and multi-selection validation cases are rejected.

3. **Canonical TF and provenance tests**: Tests prove TF is derived from effective MQF through the existing authority, client TF cannot become persisted authority, and PPS-default/faculty-override/reset behavior preserves provenance.
   - Current: `ResearchMappingService.gs` has existing MQF-to-TF derivation and research mapping tests, but no assessment projection or PPS/faculty provenance lifecycle tests.
   - Target: Assessment tests exercise default accepted, default deselected, faculty alternative selected, reset, and conflicting client TF cases against an unchanged PPS baseline.
   - Acceptance: The suite proves derived TF changes when effective MQF changes, conflicting client TF is rejected or ignored, default provenance remains green/inactive after deselection, faculty alternatives are active overrides, and the PPS fixture remains byte-for-byte unchanged.

4. **SDG exclusion tests**: Negative tests prove Assessment Mapping has no SDG rendering, API, DTO, validator, sheet, or persistence path while existing programme-mapping SDG behavior remains covered.
   - Current: SDG is a live and tested part of existing PLO mapping and review behavior; Assessment Mapping does not yet exist.
   - Target: Assessment fixtures, source scans, API payload assertions, and persistence checks keep SDG outside the assessment domain without weakening existing Pemetaan Program SDG coverage.
   - Acceptance: A negative assessment scan finds no assessment SDG field/control/key, an injected SDG payload cannot persist through assessment APIs, and existing SDG regression assertions continue to pass.

5. **Access, identity, and mutation-boundary tests**: Tests prove authorization, composite programme identity isolation, non-research rejection, invalid/cross-profile reference rejection, idempotent seed behavior, lock-protected writes, and canonical post-save state.
   - Current: Existing tests cover faculty/admin access boundaries, duplicate MQA identity handling, research eligibility, lock usage, and non-destructive reference seeding; assessment-specific endpoints and fixtures do not exist.
   - Target: Assessment tests use representative authorized, unauthorized, duplicate-MQA, non-research, malformed, cross-profile, repeated-seed, and concurrent-write cases.
   - Acceptance: Each negative case fails closed without mutating PPS or another programme, repeated initialization produces no duplicate definition rows, lock instrumentation proves writes are protected, and successful saves return canonical refreshed state.

6. **Existing regression and local verification suite**: Existing research mapping, client mapping, access, boundary, syntax, static, manifest, and scope checks remain passing.
   - Current: `scripts/test-research-mapping.js`, `scripts/test-research-mapping-client.js`, `scripts/test-task7-boundaries.js`, and `scripts/verify-mqf-rebuild.js` pass in the current checkout; README documents GAS syntax, manifest, ignore, and `git diff --check` checks.
   - Target: The final Phase 7 command set runs unchanged legacy checks alongside assessment checks and reports each result independently.
   - Acceptance: Every documented local verification command exits zero, `gas/Config.gs` and `gas/.clasp.json` remain ignored/untracked, no restricted file is staged, and `git diff --check` passes.

7. **Durable acceptance gate report**: Phase 7 writes a report that records passed, blocked, and unresolved academic, source, test, regression, and operational gates.
   - Current: The roadmap requires a final source/decision-register audit, but no Phase 7 gate report exists.
   - Target: A reviewable report identifies the exact test commands/results, source/version status, unresolved PPS/JAPSU decisions, review-policy status, deployment boundary, and final `ACCEPTED` or `BLOCKED` outcome.
   - Acceptance: The report is present, names every failed or unresolved gate, reports `BLOCKED` when any activation-blocking academic decision or required check is unresolved, and reports `ACCEPTED` only when all required gates pass.

## Boundaries

**In scope:**

- Assessment-specific fixtures and focused Node/CommonJS/static tests.
- Negative tests for study level, references, SC cardinality, TF authority, provenance, SDG absence, authorization, identity isolation, seed idempotency, and locking.
- Existing research-mapping, client, access, boundary, syntax, static, manifest, ignore, and whitespace regressions.
- A durable Phase 7 acceptance/gate report with explicit `ACCEPTED` or `BLOCKED` status.
- Local verification only, using the repository's documented test and syntax conventions.

**Out of scope:**

- New Assessment Mapping implementation or schema design — owned by earlier phases and consumed here as a verification target.
- Resolving PPS/JAPSU academic policy — Phase 7 reports unresolved decisions and fails closed rather than inventing values.
- Production or authorized test deployment/browser verification — local verification is deterministic; deployment checks require restricted institutional credentials and a separate operational gate.
- `clasp push`, `clasp deploy`, GitHub push/release, Linear updates, or secret/configuration edits — these are prohibited operational side effects.
- New UI design or accessibility implementation — owned by Phase 6; Phase 7 checks available static/client evidence only.

## Constraints

- Use the existing Node/CommonJS `assert`, `fs`, `vm`, source-extraction, fake Sheet, and fake LockService test conventions.
- Do not require Apps Script runtime credentials, configured Sheets, Drive, OAuth, browser sessions, or deployment access.
- Treat approved/versioned source fixtures as authoritative only when the Phase 1 academic gate has passed; draft/provisional fixtures must be marked as such.
- Keep existing PLO/SDG behavior testable and separate from Assessment Mapping.
- Acceptance is fail-closed: a missing, unresolved, or blocked required gate cannot be presented as passed.

## Acceptance Criteria

- [ ] Assessment fidelity tests pass for approved Master/PhD profiles, wrong-level rejection, Viva taxonomy, Progress Item 9, exact totals, descriptors, and source/version identity.
- [ ] Every approved Progress Report item has exactly one default Primary SC, and zero/multiple active Primary SC payloads fail validation.
- [ ] TF tests prove canonical MQF derivation, reject or ignore conflicting client TF, and cover default, deselected-default, faculty-alternative, reset, and unchanged-baseline provenance states.
- [ ] Assessment tests and source scans prove no SDG field, control, DTO key, validator, sheet, or persistence path exists, while existing Pemetaan Program SDG tests pass.
- [ ] Authorization and boundary tests pass for faculty/admin/grant scope, duplicate composite programme identities, non-research programmes, invalid references, cross-profile references, idempotent seeds, locked writes, and canonical post-save refresh.
- [ ] All existing README-documented local checks pass, including research mapping, client mapping, access/boundary regressions, MQF rebuild, GAS/JavaScript syntax, manifest JSON, ignore checks, and `git diff --check`.
- [ ] A durable gate report is written with independent command results and final status `ACCEPTED` only when all required academic/source/test/operational gates pass; otherwise it reports `BLOCKED` with actionable reasons.
- [ ] No `clasp push`, `clasp deploy`, deployment, GitHub push/release, Linear write, secret/config edit, or restricted-file staging occurs during Phase 7 verification.

## Edge Coverage

**Coverage:** 13/13 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| adjacency | R1 | ⛔ dismissed | Rubric/test assertions have no interval merge or touching-boundary semantics; source-order checks are covered separately. |
| empty | R1 | 🧪 backstop | Held-out tests cover empty, single-item, and missing-profile fixture behavior. |
| ordering | R1 | 🧪 backstop | Held-out tests assert stable source/category/item ordering. |
| adjacency | R2 | ⛔ dismissed | Primary-SC cardinality is scalar validation, not an interval/adjacency operation. |
| empty | R2 | 🧪 backstop | Held-out tests cover zero-selection and one-item/default fixture cases. |
| ordering | R2 | 🧪 backstop | Held-out tests assert deterministic Progress item order and default mapping alignment. |
| unclassified | R3 | ✅ covered | Acceptance explicitly checks client TF rejection/ignore and canonical recomputation from effective MQF. |
| unclassified | R4 | ✅ covered | Acceptance explicitly checks default, deselected, override, reset, and unchanged-baseline provenance states. |
| concurrency | R5 | 🧪 backstop | Held-out negative checks ensure SDG payloads cannot persist under repeated or concurrent assessment operations. |
| idempotency | R6 | 🧪 backstop | Held-out seed rerun checks assert no duplicate rows or destructive changes. |
| concurrency | R6 | 🧪 backstop | Held-out lock instrumentation checks protected writes and canonical post-save state. |
| boundary | R7 | ⛔ dismissed | Phase 7 has no academic numeric threshold algorithm; status is binary command/gate outcome. |
| precision | R7 | ⛔ dismissed | Academic rounding and score conversion are upstream contract decisions, not redefined by final regression. |

## Prohibitions (must-NOT)

**Coverage:** 3/3 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT claim `ACCEPTED` while authoritative PPS/JAPSU source, academic decision, source-version, or review-policy gates remain unresolved. | R7 | resolved | verification: judgment — gate report review must list unresolved blockers and use `BLOCKED`. |
| MUST NOT run deployment, clasp operations, GitHub push/release, Linear write-back, secret/config edits, or restricted-file staging as part of Phase 7. | R6/R7 | resolved | verification: judgment — worktree, command transcript, and final scope review. |
| MUST NOT expose SDG in Assessment Mapping or present draft/provisional rubric fixtures as approved academic authority. | R4/R7 | resolved | verification: test — negative source/API/DTO/persistence checks plus source-status assertions. |

## Ambiguity Report

| Dimension           | Score | Min  | Status | Notes |
|---------------------|-------|------|--------|-------|
| Goal Clarity        | 0.92  | 0.75 | ✓      | Final evidence artifact and blocked/accepted outcome are explicit. |
| Boundary Clarity    | 0.92  | 0.70 | ✓      | Local-only verification and no implementation/deployment scope are explicit. |
| Constraint Clarity  | 0.90  | 0.65 | ✓      | Existing Node/CommonJS/static conventions and fail-closed behavior are fixed. |
| Acceptance Criteria | 0.94  | 0.70 | ✓      | Each required evidence area has pass/fail checks. |
| **Ambiguity**       | **0.08** | **≤0.20** | **✓** | Weighted clarity: 0.92×0.35 + 0.92×0.25 + 0.90×0.20 + 0.94×0.20 = 0.92. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| Initial | Researcher | What exists today and what is missing? | Existing mapping/access/static regressions pass; assessment fixtures, assessment implementation, and final gate report do not exist. |
| 1 | Researcher + Simplifier | What is the minimum final evidence, how do unresolved academic decisions behave, and are browser checks required? | Produce tests plus a durable gate report; fail closed on unresolved PPS/JAPSU decisions; local static/Node verification only. |
| Edge probe | Failure analysis | Which empty, order, idempotency, concurrency, provenance, and threshold edges matter? | Backstop meaningful test edges; explicitly cover TF/provenance; dismiss interval/academic-rounding edges as not applicable to Phase 7. |
| Prohibition probe | Boundary/safety | What could final acceptance silently become that is not wanted? | Keep judgment prohibition against false acceptance and side effects; keep test prohibition against SDG/draft-source leakage. |

---

*Phase: 07-regression-and-acceptance-gate*
*Spec created: 2026-07-30*
*Next step: /gsd-discuss-phase 7 — implementation decisions (test harness, fixtures, gate report shape, and command orchestration)*
