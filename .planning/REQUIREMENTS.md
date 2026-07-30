# Requirements: GGN Academic Management Assessment Mapping

**Defined:** 2026-07-30
**Core Value:** Faculty and PPS users can maintain trustworthy, auditable postgraduate programme mappings without losing authoritative defaults or existing programme-review workflows.

## v1 Requirements

Requirements for the initial Assessment Mapping increment. Academic-source requirements remain gated by the approved PPS/JAPSU contract.

### Academic Contract and Sources

- [ ] **ACAD-01**: The project records an authoritative source/version/status for the Master thesis, PhD thesis, Viva Voce, and Progress Report instrument definitions before activating seed data.
- [ ] **ACAD-02**: The approved source contract preserves exact instrument, category, item, descriptor, score, and mark-allocation wording without fabricated or silently paraphrased content.
- [ ] **ACAD-03**: The approved contract defines the Master/PhD instrument matrix, thesis category 1–4 semantics, taxonomy values, MQF cardinality, canonical TF presentation, and review/submission applicability.
- [ ] **ACAD-04**: The approved contract resolves Progress Report Item 9 replacement wording and the ten Progress Report default Primary SC mappings with explicit PPS-curated provenance.
- [ ] **ACAD-05**: The approved contract defines mark reconciliation, blank/zero behavior, precision, rounding, thesis rating/mark conversion, and faculty edit authority.

### Assessment Definitions and Data

- [ ] **DATA-01**: The system stores assessment instrument definitions in additive normalized records with stable IDs, study-level applicability, source lineage, total marks, ordering, and active state.
- [ ] **DATA-02**: The system stores optional assessment categories and preserves the approved four-category thesis hierarchy and ordering where the source requires it.
- [ ] **DATA-03**: The system stores assessment item definitions with stable instrument/category membership, code, title, descriptor, maximum marks, ordering, default MQF, taxonomy, exactly one default Primary SC, and provenance metadata.
- [ ] **DATA-04**: The system stores faculty alignment separately from PPS definitions using programme-specific item identity, active mapping values, optional note, actor, and timestamp fields.
- [ ] **DATA-05**: PPS definition records are immutable to faculty APIs and seed initialization is additive, idempotent, source-versioned, and protected against destructive reseeding.
- [ ] **DATA-06**: Instrument, category, and item totals reconcile exactly to the approved rubric totals, including Viva Voce total 25, Progress Report total 50, and confirmed thesis totals.
- [ ] **DATA-07**: Assessment records do not overload PEO/PLO records or legacy mapping sheets and contain no SDG fields, persistence, or source-of-truth references.

### Server Projection and Validation

- [ ] **MAP-01**: An authorized Master research programme loads only the approved Master assessment profiles and rejects PhD-only or unknown instrument/item references server-side.
- [ ] **MAP-02**: An authorized PhD research programme loads only the approved PhD assessment profiles and rejects Master-only or unknown instrument/item references server-side.
- [ ] **MAP-03**: The server computes an effective assessment item by applying a programme-specific faculty alignment over the immutable PPS baseline and returns both active value and provenance.
- [ ] **MAP-04**: The server derives TF from the effective MQF selection using the existing canonical MQF-to-TF reference logic and never trusts or persists conflicting client-supplied TF data.
- [ ] **MAP-05**: The server validates MQF, taxonomy, and Primary SC values against active reference data and rejects unknown, inactive, cross-profile, or cross-instrument values.
- [ ] **MAP-06**: Every active assessment item has exactly one active Primary SC at the configured completeness/review gate; zero and multiple selections are rejected for submission.
- [ ] **MAP-07**: The server validates hierarchy membership, study-level applicability, marks, references, and SDG absence for every read and save request.
- [ ] **MAP-08**: The effective assessment DTO contains no SDG selector, SDG field, SDG metric, or SDG persistence key.

### Access, Persistence, and Governance

- [ ] **GOV-01**: Assessment read and save APIs reuse existing authentication, programme authorization, research-programme eligibility, and composite programme identity rules.
- [ ] **GOV-02**: Faculty alignment changes affect only the selected programme and cannot mutate another programme or the PPS baseline.
- [ ] **GOV-03**: Faculty alignment writes are batchable, lock-protected, actor/timestamp audited, and return a canonical refreshed effective projection.
- [ ] **GOV-04**: Assessment review exposes actionable critical and warning issues from the canonical validator without changing existing PEO/PLO/SDG review semantics.
- [ ] **GOV-05**: The project explicitly defines whether assessment critical issues participate in the existing review/submission status gate before enabling submission blocking.

### User Workspace

- [ ] **UI-01**: The visible existing mapping tab is labeled `Pemetaan Program`, and a third accessible tab labeled `Pemetaan Pentaksiran` is added without regressing `Maklumat Program` or programme mapping behavior.
- [ ] **UI-02**: The Assessment Mapping workspace uses the existing programme hero, tabs, cards, status chips, buttons, alerts, save feedback, dirty-state, responsive, and accessibility conventions.
- [ ] **UI-03**: Instruments render as parent cards with study level, description, total marks, source/default state, and nested categories/items in stable order.
- [ ] **UI-04**: Thesis instruments render the approved Categories 1–4 with child items and aggregate marks; Viva Voce and Progress Report do not receive invented categories.
- [ ] **UI-05**: Each item displays code, title, descriptor, marks, MQF, taxonomy, derived TF, one Primary SC control, optional note, validation state, and parent context.
- [ ] **UI-06**: Green provenance styling and accessible text identify PPS defaults; the green indication remains after faculty deselection, while active non-default faculty selections use blue styling and text.
- [ ] **UI-07**: The workspace includes a concise accessible legend explaining PPS default, faculty alignment, and active selection without relying on color alone.
- [ ] **UI-08**: The UI supports aggregate loading, controlled dirty/save/error feedback, keyboard navigation, readable nested cards, contained long content, and smaller-screen layouts.
- [ ] **UI-09**: The UI provides no SDG controls, SDG labels, SDG persistence behavior, or SDG validation in Assessment Mapping.

### Verification and Regression

- [ ] **TEST-01**: Tests prove Master and PhD profile loading, wrong-level rejection, Viva taxonomy differences, approved Progress Item 9 wording, and exact Viva/Progress/thesis totals.
- [ ] **TEST-02**: Tests prove every Progress Report item has exactly one approved default Primary SC and that zero/multiple active Primary SC selections are rejected.
- [ ] **TEST-03**: Tests prove TF follows existing MQF-to-TF derivation and that client-supplied conflicting TF cannot become persisted authority.
- [ ] **TEST-04**: Tests prove PPS default accepted is green/active, PPS default deselected remains green/inactive, faculty alternative is blue/active, and the PPS baseline is unchanged.
- [ ] **TEST-05**: Tests prove Assessment Mapping has no SDG rendering, API, DTO, validation, or persistence path.
- [ ] **TEST-06**: Tests prove programme authorization, composite identity isolation, non-research rejection, invalid references, cross-profile references, idempotent seed behavior, and lock-protected save semantics.
- [ ] **TEST-07**: Existing research mapping, client mapping, access, boundary, and relevant syntax/static tests remain passing.

## v2 Requirements

Deferred until the v1 contract and core workspace are accepted.

### Governance Enhancements

- **V2-GOV-01**: PPS users can inspect immutable baseline-versus-effective comparison history.
- **V2-GOV-02**: The system records a full immutable before/after alignment history with rationale and retention policy.
- **V2-GOV-03**: PPS can detect source-version changes and identify affected programmes without silently rebasing faculty overrides.
- **V2-GOV-04**: Users can generate a review-pack/export snapshot for governance panels.

### Reference Lifecycle

- **V2-REF-01**: The system reports stale mappings when MQF, taxonomy, TF, or SC references change or deactivate.
- **V2-REF-02**: Authorized users can manage source-version migration and explicit alignment remediation.

## Out of Scope

| Feature | Reason |
|---------|--------|
| SDG mapping in Assessment Mapping | SDG remains exclusively in `Pemetaan Program`. |
| Supporting or multiple SC values | The assessment model requires exactly one Primary SC. |
| Manual TF editing or assessment-specific TF tables | TF must remain derived from canonical MQF-to-TF logic. |
| Student assessment records, grading, or marks | This increment maps programme assessment definitions, not student assessment operations. |
| Course/CLO/credit-hour mapping | Assessment Mapping is instrument-centric and research-programme-specific. |
| AI-generated academic mapping | Academic mappings require approved PPS/JAPSU authority. |
| Destructive migration or silent PPS rebase | Existing baselines and faculty auditability must be preserved. |
| Deployment or release operations | No clasp push/deploy, GitHub push, release, or production side effect is part of this project initialization. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACAD-01–05 | Phase 1: Academic Contract and Source Gate | Pending |
| DATA-01–07 | Phase 2: Normalized Definitions and Idempotent Seed | Pending |
| MAP-01–08 | Phase 3: Effective Projection and Canonical Validation | Pending |
| GOV-01–03 | Phase 4: Authorized Persistence and Faculty Alignment | Pending |
| GOV-04–05 | Phase 5: Review and Submission Readiness | Pending |
| UI-01–09 | Phase 6: Pemetaan Pentaksiran Workspace | Pending |
| TEST-01–07 | Phase 7: Regression and Acceptance Gate | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after project research synthesis*
