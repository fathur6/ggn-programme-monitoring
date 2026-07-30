# Feature Landscape

**Domain:** Faculty-editable postgraduate research assessment mapping and academic governance
**Researched:** 2026-07-30
**Scope:** Pemetaan Pentaksiran for Master and PhD research programmes

## Research Basis and Confidence

The strongest evidence is the current application and its local design/test artifacts. The existing UI already establishes grouped programme selection, programme-scoped access, tabbed workspaces, editable parent/child records, explicit save state, dirty-navigation protection, server-side validation, review warnings, coverage matrices, and audit fields (`UpdatedAt`/`UpdatedBy`). The current research mapping implementation is therefore the governing UX convention for this increment.

No local JAPSU rubric document or assessment-reference data file was found in the repository. Exact rubric wording, descriptors, score allocations, study-level profiles, and academic interpretation must therefore be treated as PPS/JAPSU inputs, not inferred from generic postgraduate practice. External web research was attempted through the configured research seam but was unavailable because no search provider credential was present. Confidence is **medium for reuse of current application behavior** and **low for unresolved academic policy decisions**.

## Table Stakes

Missing any of these makes the workspace unsafe or incomplete for faculty and PPS review.

| Feature | User-facing, testable behavior | Complexity | Academic / product boundary |
|---------|--------------------------------|------------|-----------------------------|
| Third programme-workspace tab | An authorized research programme exposes `Maklumat Program`, existing `Pemetaan Program` behavior, and a third `Pemetaan Pentaksiran` tab without changing the first two. Tab switching preserves the selected programme and shows loading/error state. | Med | Assessment Mapping is additive; do not replace or merge the existing programme-mapping flow. |
| Study-level-specific instrument loading | A Master programme loads only the approved Master assessment profiles; a PhD programme loads only the approved PhD profiles. An explicit mismatch is rejected server-side rather than hidden by the client. | High | The brief names thesis, viva, and progress instruments. The exact profile-to-level matrix still requires PPS/JAPSU confirmation. |
| Instrument → optional category → item hierarchy | The UI renders each assessment instrument, optional category groups, and rubric items in stable order. Thesis categories 1–4 are represented where supplied by the source rubric; categories are not fabricated when the source has none. | High | Categories are optional in the normalized model. Whether every thesis instrument must contain categories 1–4 is unresolved. |
| Faithful rubric content | Seeded item text, descriptors, labels, and mark allocations are displayed without paraphrase or invented items. The UI identifies the source/version used for the baseline. | High | Rubric documents are the source of truth; draft versus approved status must be visible or otherwise recorded. |
| Reconciled marks | Item marks roll up to category subtotals when categories exist and to instrument totals. The system displays expected versus calculated totals and blocks submission when reconciliation fails. Rounding and treatment of blank/zero marks are deterministic. | High | Exact totals, weighting, decimal precision, and rounding rules require PPS/JAPSU confirmation. |
| Faculty editing at the correct layer | Faculty can edit programme-specific alignment and any explicitly approved override fields. A save returns canonical records and refreshes derived values, consistent with the existing PLO save flow. | High | Do not assume faculty may edit PPS rubric wording, descriptors, or mark allocations; that authority needs confirmation. |
| Separate PPS baseline and faculty alignment | The effective item view distinguishes PPS default values from the faculty-selected active value. Faculty changes are stored in a programme-specific layer and cannot overwrite or mutate the PPS baseline. | High | This is a core auditability requirement, not an optional version-history enhancement. |
| Mapping fields per assessment item | Each item can expose the valid MQF reference(s), taxonomy value, canonical TF derived from the existing MQF→TF authority, and one active Primary SC. Invalid reference IDs are rejected by the server. | High | MQF and taxonomy cardinality, and whether canonical TF is singular or a displayed set, need academic confirmation. |
| Exactly one Primary SC | An item has zero or one value while incomplete, and exactly one active Primary SC before the relevant review/submission gate. Selecting a second SC replaces or is rejected; it never creates supporting/multiple SC values. | Med | Primary-SC-only behavior is authoritative in the brief. The allowed SC set and category labels should come from approved reference data. |
| No SDG in this workspace | No SDG selector, SDG column, SDG validation, SDG readiness metric, or SDG persistence is present in Pemetaan Pentaksiran. Existing SDG behavior remains only in Pemetaan Program. | Med | This is an explicit scope boundary, not an unresolved feature choice. |
| Programme-scoped authorization | Faculty users can view/edit only programmes within their faculty or an explicit valid temporary grant; Graduate School administrators retain the existing wider scope. Unknown, cross-profile, and non-research records fail closed server-side. | High | Reuse `requireProgrammeAccess_`, composite programme identity, and existing access-request rules. |
| Review validation and actionable errors | Missing mappings, invalid references, broken hierarchy, wrong study-level profile, mark-total mismatch, or missing Primary SC appear as record-level issues. Warnings do not silently become passing data; critical blockers prevent submission. | High | Reuse the existing Draft / Needs attention / Ready for review / Submitted style, but confirm whether assessment review has separate status semantics. |
| Save state and concurrency protection | Loading, saving, saved, dirty, and error states are visible. Leaving with unsaved changes prompts. Sheet writes use the existing lock pattern and return the latest canonical state. | Med | The current UI already establishes these expectations; assessment mapping should not create a parallel save model. |
| Responsive and accessible review UI | Instrument cards and item tables work at the existing mobile breakpoint; long matrices scroll inside a contained region; labels, table headers, focus order, and keyboard navigation are usable. | Med | Reuse current card/chip/table language rather than introducing a disconnected CRUD screen. |

## Differentiators

These are the audit/provenance behaviors that make the feature valuable to PPS and JAPSU rather than merely a rubric editor.

| Feature | Value proposition | Complexity | Recommendation |
|---------|-------------------|------------|----------------|
| Provenance badges and legend | Every value is visibly classified as PPS default, faculty override, inherited/effective, or derived. Reviewers can understand the current result without opening raw Sheets. | Med | Build in the MVP; this is the clearest UI expression of the core data model. |
| Baseline-versus-effective comparison | A reviewer can compare the PPS baseline with the active faculty value at instrument, category, and item level, including changed fields and mark impacts. | High | Build after the basic editor, but reserve the data shape now. |
| Revert to PPS default | A faculty override can be removed deliberately, restoring the current PPS baseline without deleting the baseline or creating an ambiguous null state. | Med | Build if PPS confirms that faculty may revert their own alignment; record actor and time. |
| Immutable change history | Each override records programme, instrument/category/item identity, before/after values, actor, timestamp, source version, and optional reason. History is read-only to faculty and reviewable by PPS. | High | Plan as a first-class audit record, not as a best-effort Sheet timestamp. |
| Source-document lineage | The baseline exposes source document name/version/status and a stable source key for each instrument/category/item. A reviewer can identify which rubric revision produced the row. | High | Implement source keys before seeding; do not fabricate URLs or document versions. |
| Default-update impact detection | If PPS publishes a new baseline, the system identifies programmes with active overrides, inherited values, stale source versions, and affected mark totals. It does not silently rebase faculty choices. | High | Defer to a later governance phase unless PPS requires migration handling in the first release. |
| Effective mapping review pack | PPS can review one read-oriented snapshot showing instrument totals, item mappings, provenance state, unresolved issues, and source version without editing the workspace. | High | Prefer this over a graph view for the assessment increment; the existing Coverage Matrix establishes the pattern. |
| Academic decision rationale | Faculty can attach a short rationale to an override or Primary SC selection, while the PPS baseline remains untouched. | Med | Useful for panel review, but confirm whether rationale is required, optional, or disallowed. |
| Reference-integrity diagnostics | When a reference changes or becomes inactive, affected items are marked stale/invalid with a clear repair path instead of silently remapping them. | High | Build only after PPS confirms the lifecycle of MQF, taxonomy, TF, and SC reference rows. |

## Anti-Features

Features and behaviors to explicitly avoid in the initial roadmap.

| Anti-feature | Why avoid | What to do instead |
|--------------|-----------|--------------------|
| SDG mapping in Assessment Mapping | It duplicates an existing flow and violates the explicit scope boundary. | Keep SDG controls and metrics in `Pemetaan Program` only. |
| Multiple or supporting SC selections | It conflicts with the one active Primary SC rule and creates ambiguous audit output. | Store and validate exactly one Primary SC for a complete item; show an incomplete state before selection. |
| Manual TF editing | It creates a second source of truth and can contradict the established MQF→TF derivation. | Derive TF server-side from current approved MQF relationships and label it as derived. |
| Overwriting PPS defaults | It destroys the baseline needed to explain what changed and who changed it. | Store immutable PPS rows separately from programme-specific faculty alignment. |
| Silent inheritance or silent fallback | A missing study-level profile, seed row, or reference could appear valid while actually using the wrong source. | Show explicit Not loaded / Not available / Inherited states and fail closed on profile mismatch. |
| Fabricated or normalized rubric text | Invented wording or “helpful” paraphrasing would make the mapping academically unauditable. | Seed exact source text and require a source-document decision when data is missing. |
| Student records, marks, or per-student grading | This increment defines programme assessment mappings, not assessment operations or student information. | Store rubric structure and mapping metadata only. |
| Course/CLO/DCI/credit-hour concepts | These belong to a different model and would reintroduce the legacy course-based boundary. | Keep Assessment Mapping instrument-centric and research-programme-specific. |
| Cross-level shared profiles without a versioned policy | Master and PhD instruments may differ; sharing can leak wrong rubric text or totals. | Key profile selection by canonical study level and approved source profile. |
| Client-only authorization or validation | Browser checks can be bypassed and are inconsistent with existing security conventions. | Guard every read/write endpoint and revalidate profile, identity, references, cardinality, and totals server-side. |
| “AI” or automatic academic mapping as authority | Suggested MQF, taxonomy, TF, or SC values could be mistaken for approved academic decisions. | If suggestions are ever added, make them non-authoritative, explainable, and separately approved; defer for MVP. |
| Destructive migration or bulk rebase | Existing mappings and PPS history could be lost during seed/profile updates. | Additive Sheets, stable IDs, explicit migration, and confirmation-gated changes only. |

## Feature Dependencies

```text
Canonical programme identity + study-level detection
  → authorized assessment workspace loading
  → approved Master/PhD seed profiles and source lineage
  → normalized instrument/category/item records
  → mark reconciliation and rubric integrity checks
  → PPS baseline layer + programme-specific faculty alignment layer
  → item mapping validation (MQF, taxonomy, Primary SC)
  → server-derived TF and effective/provenance projection
  → review issues, coverage, and submission status
  → responsive editor, comparison/audit view, and verification tests
```

| Dependency | Required work | Verification dependency |
|------------|---------------|--------------------------|
| Programme and study level | Reuse programme identity rather than MQA code alone where duplicates exist; confirm canonical Master/PhD detection source. | Tests for Master, PhD, non-research, unknown, and duplicate-MQA cases. |
| Seed/reference layer | Additive, immutable PPS seed storage with source version/key; preserve exact source text and marks. | Fixtures from approved rubric documents; tests must fail on fabricated/missing rows. |
| Normalized assessment schema | Separate instrument, optional category, and item records; stable IDs; order; profile/source identity; totals. | Round-trip tests and orphan/duplicate identity tests. |
| Provenance schema | Baseline, active override, effective value, source version, actor/time, and override status must be distinguishable. | Tests for inherited, overridden, reset, stale, and unchanged states. |
| Mapping services | Validate MQF/taxonomy/SC against active references; derive canonical TF using existing authority; do not persist SDG. | TF derivation, one-Primary-SC, invalid-reference, and SDG-exclusion tests. |
| Access and API | Reuse authenticated programme-scoped wrappers and server-side fail-closed profile checks. | Faculty isolation, temporary access, cross-profile, and non-research rejection tests. |
| UI | Extend existing programme context, tab, card, chip, dirty-state, toast, review, and contained-matrix conventions. | Static UI checks, JavaScript syntax, keyboard checks, desktop/390px UAT. |
| Governance/review | Define whether assessment readiness rolls into the existing dashboard and whether submit/approve uses the existing status machine. | Regression tests for existing PLO mapping and governance/deadline behavior. |

## MVP Recommendation

Prioritize:

1. **Correct profile loading** for authorized Master and PhD research programmes, with server-side rejection of wrong-level, unknown, and non-research profiles.
2. **Faithful normalized rubric hierarchy** for thesis, viva, and progress instruments, including optional categories, thesis categories 1–4 where present, exact descriptors, stable order, and reconciled totals.
3. **Separate PPS defaults and programme-specific faculty alignment**, with visible provenance and no baseline mutation.
4. **Item-level MQF, taxonomy, derived TF, and exactly one Primary SC behavior**, with SDG absent from the feature.
5. **Review and verification loop** covering missing data, mark mismatch, source/profile mismatch, invalid references, SC cardinality, access scope, dirty state, and existing mapping regressions.

Defer: full baseline comparison/history UI, default-update impact migration, export/review packs, rationale analytics, reference lifecycle tooling, and any automatic academic suggestions. Do not defer the underlying provenance fields needed to support those later features.

## Unresolved Academic Decisions

These are roadmap gates, not implementation details. Do not invent answers from generic rubric conventions.

| Decision requiring confirmation | Why it matters | Decision owner / evidence needed |
|-------------------------------|----------------|----------------------------------|
| Approved versus draft source status for each Master and PhD instrument | Determines whether a profile can be loaded for editing, shown as draft, or used for submission. | PPS/JAPSU; approved/draft rubric documents and effective dates. |
| Exact instrument matrix | Confirm which thesis, viva voce, and progress instruments apply to Master versus PhD and whether any instrument is optional. | PPS/JAPSU-approved profile matrix. |
| Thesis category semantics | Confirm the names, order, and meaning of categories 1–4, and whether they apply to all thesis instruments. | JAPSU rubric source; do not infer from category numbers alone. |
| Mark reconciliation | Define item/category/instrument total equations, weighting, decimal precision, blank versus zero, rounding, and whether a faculty override may change marks. | PPS/JAPSU assessment policy and sample approved rubrics. |
| Faculty edit authority | Decide whether faculty can override only mappings, or also item descriptors, category labels, marks, and instrument metadata. | PPS governance policy; this controls the override schema and permissions. |
| MQF cardinality | Current PLO behavior permits multiple MQF domains. Confirm whether assessment items use one domain or multiple domains. | PPS/JAPSU mapping guidance. |
| Taxonomy cardinality and taxonomy family | Confirm whether each item has exactly one taxonomy value, multiple values, or a taxonomy family-specific value. | PPS/JAPSU mapping guidance; current code only proves accepted taxonomy IDs, not assessment policy. |
| Canonical TF semantics | Existing derivation can produce multiple TFs from MQF relationships. Confirm whether Assessment Mapping displays/stores all derived TFs or selects one canonical TF. | PPS/JAPSU and existing TF reference authority. |
| Primary SC reference and completeness gate | Confirm the approved SC vocabulary, whether one SC is mandatory for every item or only before submission, and whether SC category coverage is also required. | PPS/JAPSU; the one-Primary-SC rule itself is fixed by the brief. |
| Provenance lifecycle | Define what PPS default, inherited, overridden, reset, stale, and retired mean; determine whether overrides survive a new PPS source version. | PPS governance policy and source-version policy. |
| Assessment review workflow | Decide whether assessment mapping has its own status or participates in the existing research programme review/submission statuses. | PPS/JAPSU governance workflow. |
| Override rationale and audit retention | Decide whether rationale is mandatory, who can see it, and how long immutable history must be retained. | PPS audit/quality-assurance policy. |
| Study-level authority | Confirm whether level comes from Programme metadata, a canonical profile field, or an explicit PPS-maintained selector. | Application owner plus PPS data dictionary. |

## Sources

- `.planning/PROJECT.md` — authoritative increment scope, explicit study-level, provenance, SC-cardinality, and SDG boundaries; **local brief, high relevance; academic details still pending confirmation**.
- `gas/Index.html` — current tabs, programme context, loading/error/save states, review panel, coverage matrix, and responsive workspace language; **direct local UI evidence**.
- `gas/JavaScript.html` — programme identity use, dirty-state protection, keyboard tab navigation, mapping save order, and derived refresh behavior; **direct local client evidence**.
- `gas/ResearchMappingService.gs` — server-side reference validation, TF derivation, programme-specific persistence, locks, and updated-by/time fields; **direct local service evidence**.
- `gas/ResearchReferenceService.gs` — additive reference seeding and active-reference exposure; **direct local service evidence**.
- `gas/ResearchReviewService.gs` — critical versus warning validation, review status, and guarded submission; **direct local governance evidence**.
- `gas/Auth.gs` and `gas/Code.gs` — fail-closed authentication, programme scope, composite identity, and guarded API conventions; **direct local security evidence**.
- `scripts/test-research-mapping.js`, `scripts/test-research-mapping-client.js`, `scripts/test-coor-access.js`, `scripts/test-task7-boundaries.js` — current verification expectations and regression boundaries; **direct local test evidence**.
- `docs/superpowers/specs/2026-07-21-postgraduate-research-mapping-design.md` and `README.md` — existing domain model and migration boundaries; **local design documentation**.
- Repository search for rubric/JAPSU/assessment files — **no local rubric source found; absence is a research gap, not evidence that no source exists elsewhere**.
