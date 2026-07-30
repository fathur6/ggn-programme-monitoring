# GGN Academic Management

## What This Is

GGN Academic Management is an internal Google Apps Script and Vue-based workspace for UniSZA postgraduate research programme information, MQF-aligned programme mapping, governance review, access control, and faculty readiness. The current project increment adds a `Pemetaan Pentaksiran` workspace that lets faculty align assessment instruments and rubric items to MQF domains, derived TF mappings, and one Primary Sustainability Competency while preserving PPS defaults for auditability.

## Core Value

Faculty and PPS users can maintain trustworthy, auditable postgraduate programme mappings without losing the authoritative defaults or existing programme-review workflows.

## Requirements

### Validated

- Existing postgraduate programme information and programme-mapping flows are relied upon and must remain compatible — existing application behavior, to be verified against the live codebase during planning.
- The application uses Google Apps Script services, Google Sheets-backed records, Vue-based UI state, authenticated APIs, and existing MQF/reference-data conventions — existing architecture, to be verified during planning.

### Active

- [ ] Faculty can open a third `Pemetaan Pentaksiran` tab alongside `Maklumat Program` and `Pemetaan Program`.
- [ ] Master and PhD programmes load only the correct study-level assessment instrument profiles.
- [ ] Assessment data is normalized as instrument, optional category, and item records with thesis categories 1–4 and reconciled marks.
- [ ] Assessment items expose MQF, taxonomy, canonical derived TF, and exactly one Primary SC mapping.
- [ ] PPS defaults remain immutable and visibly distinguishable from faculty-selected active overrides.
- [ ] Faculty alignment is programme-specific, access-controlled, validated, and persisted separately from PPS defaults.
- [ ] Seed definitions faithfully represent the approved or draft JAPSU rubric documents without fabricated item text.
- [ ] Focused tests cover study-level loading, rubric totals, descriptors, SC cardinality, provenance states, TF derivation, SDG exclusion, and regression of existing PLO mapping tests.

### Out of Scope

- SDG mapping in Assessment Mapping — SDG remains only in the existing `Pemetaan Program` flow.
- Supporting or multiple SC selections — each assessment item has exactly one active Primary SC.
- Overwriting PPS source definitions — faculty alignment is stored as a separate programme-specific layer.
- Student assessment records or per-student grading — this increment defines programme assessment mappings only.
- Deployment, `clasp push`, `clasp deploy`, GitHub push, release, Linear write-back, or secret/configuration changes — operational side effects are explicitly excluded.

## Context

- Repository: `fathur6/ggn-programme-monitoring.git`, Google Apps Script application with `gas/` services and HTML/Vue client templates.
- Relevant implementation areas named by the brief include `Index.html`, `JavaScript.html`, `Styles.html`, `ProgrammeService.gs`, `ResearchDataService.gs`, `ResearchReferenceService.gs`, `ResearchMappingService.gs`, `ResearchReviewService.gs`, and existing research-mapping tests.
- The feature must reuse existing access-control helpers, Google Sheet service patterns, reference data, validation, save feedback, responsive cards, and MQF → TF derivation rather than introducing parallel conventions.
- Seed sources are local JAPSU 2026 draft rubric documents for Master thesis, PhD thesis, Viva Voce, and Progress Report evaluation. Their exact wording, score allocations, and mapping data must be preserved.
- The repository already contains graphify artifacts under `.planning/graphs/`; these are existing knowledge-graph outputs and are not application requirements.

## Constraints

- **Compatibility**: Preserve `Maklumat Program`, existing `Pemetaan Program`, PEO/PLO review, and submission behavior.
- **Data integrity**: Keep PPS defaults/provenance immutable and store faculty overrides separately per programme.
- **Academic correctness**: Apply study-level-specific instruments, exact rubric totals, canonical MQF → TF derivation, and one Primary SC.
- **Security**: Reuse existing authenticated API and programme authorization helpers; reject unknown or cross-profile records server-side.
- **UI consistency**: Extend the existing tab, card, chip, validation, dirty-state, and responsive design language; do not create a disconnected CRUD page.
- **Deployment**: Do not run clasp push/deploy or modify `.clasp.json`, credential, OAuth, or secret configuration files.
- **Verification**: Add focused tests and retain existing research-mapping regression coverage.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat PPS defaults and faculty alignment as separate data concepts | Auditability requires the original baseline to remain available after edits | — Pending |
| Derive TF through the existing MQF → TF authority | Prevent conflicting TF sources of truth across mapping features | — Pending |
| Use one Primary SC per assessment item | Matches the academic rule and makes validation unambiguous | — Pending |
| Keep assessment mapping free of SDG data | SDG belongs to the existing programme-mapping scope only | — Pending |
| Use rubric documents as seed sources | Prevents fabricated assessment wording and preserves approved mark allocations | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? Move them to Out of Scope with a reason.
2. Requirements validated? Move them to Validated with a phase reference.
3. New requirements emerged? Add them to Active.
4. Decisions to log? Add them to Key Decisions.
5. Confirm that the product description still matches the application.

**After each milestone**:
1. Review all sections.
2. Recheck the Core Value.
3. Audit Out of Scope reasons.
4. Update Context with current state and evidence.

---
*Last updated: 2026-07-30 after project initialization from the Assessment Mapping brief*
