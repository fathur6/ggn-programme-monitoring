# Roadmap: GGN Academic Management Assessment Mapping

## Overview

This increment adds an auditable `Pemetaan Pentaksiran` workspace to the existing Google Apps Script/Vue application without disturbing `Maklumat Program` or `Pemetaan Program`. The work is intentionally gated: the approved PPS/JAPSU academic contract comes before final seed activation, immutable normalized definitions come before projection, canonical validation comes before persistence and review, stable server DTOs come before Vue work, and a distinct final regression gate proves both the new assessment boundary and existing research-mapping compatibility.

## Gates and sequencing

- **Hard academic gate:** Phase 1 must record the authoritative/versioned source contract and resolve all activation-blocking PPS/JAPSU decisions. Phase 2 may prepare schema scaffolding, but final seed activation and submission-ready interpretation remain blocked until this gate passes.
- **Canonical server gate:** Phase 3 owns the effective projection and validator used by persistence, review, and the client. No client-only study-level, TF, marks, SDG, or Primary SC authority is allowed.
- **Governance gate:** Phase 5 records whether assessment critical issues participate in the existing review/submission status gate before any UI communicates readiness.
- **Acceptance gate:** Phase 7 is a separate final phase; all unresolved academic gates, SDG-boundary failures, or legacy regressions prevent acceptance.

## Phases

- [ ] **Phase 1: Academic Contract and Source Gate** - Establish the authoritative PPS/JAPSU contract, source register, and activation-blocking decision record.
- [ ] **Phase 2: Normalized Definitions and Idempotent Seed** - Add the immutable assessment definition layer and safe, source-versioned seed path.
- [ ] **Phase 3: Effective Projection and Canonical Validation** - Build the pure server model for profile selection, effective mappings, totals, references, TF, and Primary SC validity.
- [ ] **Phase 4: Authorized Persistence and Faculty Alignment** - Persist programme-specific alignment through authenticated, locked, batch APIs without mutating PPS defaults.
- [ ] **Phase 5: Review and Submission Readiness** - Integrate canonical assessment issues into review while preserving existing PEO/PLO/SDG semantics.
- [ ] **Phase 6: Pemetaan Pentaksiran Workspace** - Add the accessible, responsive third tab after the server DTO and governance behavior are stable.
- [ ] **Phase 7: Regression and Acceptance Gate** - Prove academic fidelity, security, provenance, SDG exclusion, UI behavior, and brownfield non-regression.

## Phase Details

### Phase 1: Academic Contract and Source Gate
**Goal**: PPS/JAPSU owners and implementers have one authoritative, versioned academic contract that is safe to encode, with unresolved decisions visible rather than inferred.
**Depends on**: Nothing (first phase)
**Requirements**: ACAD-01, ACAD-02, ACAD-03, ACAD-04, ACAD-05
**Deliverables**:
  - Source register for Master thesis, PhD thesis, Viva Voce, and Progress Report with document identity, authority, version, status, effective date, and evidence location.
  - Table-aware reviewed manifest preserving exact instrument/category/item text, descriptors, marks, ordering, source coordinates, and stable source keys; no fabricated or silently paraphrased content.
  - Approved Master/PhD matrix, thesis Categories 1–4 semantics, taxonomy/MQF cardinality, canonical TF presentation, review/submission applicability, and study-level authority.
  - Explicit decision records for Progress Item 9 replacement wording, all ten Progress default Primary SC mappings with PPS-curated provenance, mark reconciliation/rounding/blank-zero behavior, thesis rating-to-mark conversion, and faculty edit authority.
  - Unresolved-decision register with owner, evidence, affected seed keys, and an activation status.
**Success Criteria** (what must be TRUE):
  1. A reviewer can identify the authoritative source/version/status for each of the four instruments and trace every seeded value to a source coordinate or an explicitly approved PPS-curated decision.
  2. The contract states exactly which Master and PhD profiles, optional instruments, thesis categories, taxonomy values, MQF values, TF presentation, and review/submission rules apply.
  3. Progress Item 9 has an exact approved replacement decision, and every Progress item has one approved default Primary SC with provenance distinguished from source-derived mappings.
  4. A reviewer can determine how item, category, and instrument marks reconcile, including `/10` thesis sections, blank versus zero, precision, rounding, and faculty edit authority.
  5. The activation gate is visibly blocked while any material academic decision is unresolved and can be marked passed only with the required PPS/JAPSU evidence.
**Research / confirmation flag**: **Required — hard PPS/JAPSU confirmation gate.** Local DOCX findings are provisional until authority, version, and approval status are reconciled.
**Plans**: TBD

### Phase 2: Normalized Definitions and Idempotent Seed
**Goal**: The application has an additive, immutable PPS assessment-definition layer whose active rows faithfully represent the approved contract and can be initialized repeatedly without destructive effects.
**Depends on**: Phase 1 hard academic gate; schema scaffolding may be prepared earlier, but final seed activation requires Phase 1 to pass.
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Deliverables**:
  - Assessment-specific normalized sheets/headers for instruments, optional categories, items, and programme alignments, with stable IDs, source lineage, ordering, active state, actor/time fields, and no legacy-sheet reuse.
  - Reviewed seed manifest and append-only, source-versioned, lock-protected initializer that rejects schema mismatch and is idempotent.
  - Immutable PPS definitions including exact source text, default mappings, provenance, category hierarchy, and approved totals; faculty alignment is a separate logical layer.
  - Seed arithmetic and integrity fixtures for thesis descriptor/mark structure, Viva 25, Progress 50, and confirmed thesis totals.
**Success Criteria** (what must be TRUE):
  1. An approved Master/PhD/Viva/Progress profile can be represented as stable instrument, category, and item records with exact source text, order, applicability, lineage, and active state.
  2. Thesis categories 1–4 appear only where the approved contract requires them, while Viva Voce and Progress Report do not receive invented categories.
  3. PPS definition rows remain read-only to faculty concepts, and programme alignment rows can exist without copying or overwriting the PPS baseline.
  4. Re-running initialization produces no duplicate definitions, does not clear custom/reference data, and does not alter existing legacy research sheets or programme flows.
  5. Each active profile's item, category, and instrument totals reconcile exactly to its approved rubric, or remains visibly inactive/blocked when the academic contract has not passed.
**Research / confirmation flag**: **Required only for supplied-source extraction or manifest review.** The Sheets/lock pattern is established locally; no seed may bypass the Phase 1 contract.
**Plans**: TBD

### Phase 3: Effective Projection and Canonical Validation
**Goal**: A pure server-side assessment model computes one authoritative effective workspace and actionable validation result before any public write path or UI depends on it.
**Depends on**: Phases 1–2, plus existing programme identity and MQF/reference helpers.
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08
**Deliverables**:
  - Study-level profile selection using canonical server programme metadata (`Masters`/`Doctorate`) and hierarchy joins for instruments, categories, and items.
  - Effective-value overlay of immutable PPS defaults with programme alignment candidates, including explicit provenance and reset semantics.
  - Canonical mark reconciliation, reference validation, Primary SC cardinality validation, record-level critical/warning issues, and an SDG-free DTO.
  - TF derivation through the existing MQF-to-TF authority, with a documented deterministic canonical presentation if the approved contract requires one value.
  - Pure Node/static fixtures that exercise wrong-level, cross-profile, invalid-reference, totals, cardinality, TF, and SDG-negative cases.
**Success Criteria** (what must be TRUE):
  1. A Master or PhD workspace projection contains only the approved applicable profiles, and a wrong-level, unknown, orphaned, or cross-instrument reference is rejected rather than hidden by presentation.
  2. The effective value is visibly distinguishable as PPS default or faculty override while the immutable baseline remains available for comparison and validation.
  3. Changing effective MQF values recomputes TF through the existing canonical relationship; client-supplied or persisted conflicting TF cannot become authoritative.
  4. The validator reports exact total mismatches, invalid MQF/taxonomy/SC references, and zero or multiple Primary SC values at the contract-defined completeness gate.
  5. The effective DTO and validator contain no SDG selector, field, metric, persistence key, or hidden SDG requirement.
**Research / confirmation flag**: **Targeted confirmation required** for singular versus plural TF semantics, score conversion, MQF/taxonomy cardinality, and the Primary SC completeness gate if not fully resolved in Phase 1.
**Plans**: TBD

### Phase 4: Authorized Persistence and Faculty Alignment
**Goal**: Authorized faculty can safely save programme-specific assessment alignment while PPS definitions and other programmes remain unchanged.
**Depends on**: Phase 3 canonical projection and validator.
**Requirements**: GOV-01, GOV-02, GOV-03
**Deliverables**:
  - Thin public `Code.gs` read/save/reset wrappers and private assessment service helpers using existing authentication, programme authorization, research eligibility, and composite identity rules.
  - Batch alignment upsert/reset path keyed by `(ProgrammeId, ItemId)`, with applicable profile membership and active-reference checks before writing.
  - Lock-protected writes with authenticated actor/time audit fields, cache invalidation, canonical refreshed effective response, and fail-closed error handling.
**Success Criteria** (what must be TRUE):
  1. An authorized faculty user, administrator, or valid temporary grant can read and edit only the permitted research programme; non-research, unknown, ambiguous-MQA, and out-of-scope requests fail closed.
  2. Saving or resetting an alignment changes only the selected programme's alignment layer, leaves PPS definitions and another programme unchanged, and returns the refreshed effective projection with provenance.
  3. A batch containing malformed, wrong-level, cross-profile, invalid-reference, multiple-Primary-SC, SDG, or client-TF data is rejected server-side without a partial baseline mutation.
  4. Concurrent alignment writes are lock-protected, record authenticated actor/time fields, and leave the client with a canonical saved or actionable failed state.
**Research / confirmation flag**: **Standard repository pattern with security-focused confirmation.** No deployment/configuration research or side effect is in scope.
**Plans**: TBD

### Phase 5: Review and Submission Readiness
**Goal**: Existing research review and submission workflows consume the same canonical assessment validation without importing SDG behavior or changing established PEO/PLO semantics.
**Depends on**: Phases 3–4.
**Requirements**: GOV-04, GOV-05
**Deliverables**:
  - Assessment review projection with applicable-profile handling, critical issues, warnings, reconciled metrics, provenance context, and record-level remediation.
  - Explicit decision and implementation for whether assessment critical issues participate in the existing review/submission status gate.
  - Regression boundary in `ResearchReviewService.gs` keeping PEO/PLO/SDG validation and existing statuses semantically separate.
**Success Criteria** (what must be TRUE):
  1. Review consumers can see actionable assessment critical and warning issues from the canonical validator, including profile, hierarchy, total, reference, and Primary SC failures.
  2. Submission is blocked only for an applicable assessment profile with unresolved contract-defined critical issues, according to the recorded governance decision.
  3. A programme without an applicable assessment profile is not incorrectly blocked, and warnings do not silently present as passed critical data.
  4. Existing PEO/PLO review, SDG requirements, coverage, and submission semantics remain unchanged outside the added assessment section.
**Research / confirmation flag**: **Required if the PPS/JAPSU review/submission policy is not explicit.** Do not enable submission blocking from an inferred status rule.
**Plans**: TBD

### Phase 6: Pemetaan Pentaksiran Workspace
**Goal**: Faculty and PPS users can use an accessible, responsive third assessment tab backed entirely by stable server DTOs, canonical validation, and governed save behavior.
**Depends on**: Phase 5, and therefore Phases 1–4; stable aggregate read/write DTOs and review results are prerequisites.
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09
**Deliverables**:
  - Third `Pemetaan Pentaksiran` tab integrated with the existing programme hero/tab semantics while preserving `Maklumat Program` and `Pemetaan Program` behavior.
  - Vue 2.7 assessment state and aggregate RPC loading/save/reset flow using existing loading, dirty, error, toast, and refresh conventions.
  - Ordered instrument/category/item cards with totals, descriptors, mappings, derived TF, one Primary SC control, validation messages, baseline values, and provenance legend.
  - Responsive/accessibility treatment for long content, keyboard navigation, focus/ARIA state, contained scrolling, and smaller screens.
**Success Criteria** (what must be TRUE):
  1. An authorized research programme can switch among `Maklumat Program`, `Pemetaan Program`, and `Pemetaan Pentaksiran` without losing programme context or regressing the first two flows.
  2. Instruments render in stable hierarchy/order with study level, source/default state, exact text, aggregate totals, thesis Categories 1–4 where approved, and no invented Viva/Progress categories.
  3. Each item exposes code, title, descriptor, marks, MQF, taxonomy, derived TF, exactly one Primary SC control, optional note, parent context, and canonical validation state.
  4. PPS baseline values remain green with text/icon/accessible provenance after deselection, while active faculty alternatives are blue with equivalent non-color text; the legend explains both states.
  5. Loading, dirty, saving, saved, error, keyboard, responsive, and long-content behaviors are usable, and the workspace contains no SDG control, label, persistence, or validation path.
**Research / confirmation flag**: **No broad research phase.** Perform targeted UAT/accessibility checks and confirm final academic labels/copy against the Phase 1 contract.
**UI hint**: yes
**Plans**: TBD

### Phase 7: Regression and Acceptance Gate
**Goal**: The increment is demonstrably faithful, secure, non-leaking, and compatible with the existing brownfield application, with unresolved academic gates preventing false acceptance.
**Depends on**: All prior phases; pure validator tests may start in Phase 3, but final acceptance is distinct here.
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Deliverables**:
  - Focused assessment fixtures/tests for source fidelity, study-level loading, totals, descriptors, taxonomy differences, Progress Item 9, Primary SC cardinality, TF derivation, and provenance lifecycle.
  - Negative-boundary tests for SDG absence, invalid/cross-profile references, authorization/composite identity isolation, non-research access, idempotent seeding, and lock-protected saves.
  - Existing research mapping/client mapping/access/boundary regressions plus JavaScript/GAS syntax, static, manifest, and scope checks.
  - Final source/decision-register audit stating which gates passed, which remain blocked, and why acceptance is or is not allowed.
**Success Criteria** (what must be TRUE):
  1. Focused tests prove Master/PhD profile behavior, Viva/Progress/thesis totals and descriptors, taxonomy differences, approved Progress Item 9, and one approved default Primary SC per Progress item.
  2. Tests prove canonical MQF-to-TF derivation, PPS-default/faculty-override lifecycle, reset/deselection provenance, unchanged PPS baseline, and rejection of zero or multiple active Primary SC values.
  3. Negative tests prove that SDG is absent from assessment rendering, API, DTO, validation, sheets, and persistence while existing `Pemetaan Program` SDG behavior remains covered.
  4. Authorization, composite identity, non-research, invalid-reference, cross-profile, idempotent-seed, lock, and canonical post-save tests pass alongside all existing research-mapping regressions.
  5. Acceptance is refused, with an actionable gate report, if any authoritative source/version, academic decision, review policy, regression, or deployment-boundary check is unresolved; no deployment or secret/config change is performed.
**Research / confirmation flag**: **No new platform research.** Failures return to the academic decision register or implementation; they are not hidden with permissive fixtures.
**Plans**: TBD

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Academic Contract and Source Gate | 0/TBD | Not started | - |
| 2. Normalized Definitions and Idempotent Seed | 0/TBD | Not started | - |
| 3. Effective Projection and Canonical Validation | 0/TBD | Not started | - |
| 4. Authorized Persistence and Faculty Alignment | 0/TBD | Not started | - |
| 5. Review and Submission Readiness | 0/TBD | Not started | - |
| 6. Pemetaan Pentaksiran Workspace | 0/TBD | Not started | - |
| 7. Regression and Acceptance Gate | 0/TBD | Not started | - |

## Coverage Validation

| Requirement group | Phase | Status |
|-------------------|-------|--------|
| ACAD-01–05 | Phase 1 | Mapped exactly once |
| DATA-01–07 | Phase 2 | Mapped exactly once |
| MAP-01–08 | Phase 3 | Mapped exactly once |
| GOV-01–03 | Phase 4 | Mapped exactly once |
| GOV-04–05 | Phase 5 | Mapped exactly once |
| UI-01–09 | Phase 6 | Mapped exactly once |
| TEST-01–07 | Phase 7 | Mapped exactly once |

**Coverage:** 53/53 declared v1 requirements mapped; 0 unmapped; 0 duplicated.
