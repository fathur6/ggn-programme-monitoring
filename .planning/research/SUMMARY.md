# Project Research Summary

**Project:** GGN Academic Management — Assessment Mapping increment  
**Domain:** Faculty-editable postgraduate research assessment-rubric mapping and academic governance  
**Researched:** 2026-07-30  
**Confidence:** MEDIUM overall; HIGH for existing repository boundaries, MEDIUM for the proposed software shape, and LOW for unresolved PPS/JAPSU policy decisions

## Executive Summary

This increment is an additive `Pemetaan Pentaksiran` workspace inside an existing Google Apps Script/Vue application. It is not a new assessment-management product and must not become one: the scope is programme-level mapping for Master and PhD research instruments, not student records, per-student grading, or course/CLO modelling. The repository evidence supports retaining the current HtmlService/Vue 2.7 single-page architecture, Google Sheets research tables, authenticated `google.script.run` APIs, composite programme identity, existing authorization helpers, canonical MQF→TF derivation, locking, review conventions, and local Node-based verification. [STACK.md; ARCHITECTURE.md; PROJECT.md]

The recommended implementation is a narrow, additive assessment domain: immutable PPS definition rows for instruments/categories/items, separate programme-specific faculty alignment rows, a server-computed effective projection with explicit provenance, and batch read/save APIs. Server validation must own study-level profile selection, programme authorization, rubric membership, reference validity, mark reconciliation, and the exactly-one Primary SC gate. TF must be derived from effective MQF values through the existing authority; SDG must be absent from Assessment Mapping and remain confined to `Pemetaan Program`. The UI should be the final integration layer, extending the existing third tab, cards, chips, review feedback, dirty-state handling, keyboard semantics, and responsive behavior rather than creating a disconnected CRUD page. [ARCHITECTURE.md; FEATURES.md]

The largest risk is not framework complexity but academic source ambiguity. The research reports agree that exact rubric text, source/version lineage, study-level applicability, totals, taxonomy variants, Progress Primary SC defaults, and the Progress Item 9 replacement cannot safely be inferred. The local source evidence is also not fully reconciled: `PITFALLS.md` reports four draft JAPSU 2026 DOCX files and extracts counts, while `FEATURES.md` reports that no rubric files were found in the repository. Treat those DOCX findings as provisional until PPS/JAPSU supplies the authoritative, versioned payload. Requirements must therefore begin with an explicit academic contract and decision register; final seed activation and submission readiness should remain blocked while material decisions are unresolved. [FEATURES.md; PITFALLS.md]

## Key Findings

### Recommended Stack

The stack is an observed brownfield constraint, not a modernization opportunity. `gas/appsscript.json` uses Apps Script V8 and the existing web-app execution model; `Index.html` loads Vue 2.7.14 from a CDN and creates one Vue instance; server/client code is in HtmlService partials with no package manifest or bundler. Google Sheets and the existing `ResearchDataService.gs` provide the persistence convention, while `LockService` protects first-use sheet creation and read-modify-write mutations. [STACK.md, "Recommended Stack"]

**Core technologies and conventions:**

- **Google Apps Script HtmlService/V8**: retain the existing authenticated web app and server boundary; do not add a web server or alter deployment configuration. [STACK.md]
- **Vue 2.7.14 via CDN and one Vue instance**: add the third tab and assessment state to the existing app; do not introduce Vue 3, Vuex, Vite, SFCs, or a second client store. [STACK.md]
- **Google Sheets via `SpreadsheetApp`**: add assessment-specific `PR_*` sheets and preserve legacy `Programme`, MQA-detail, and current PLO sheets. [STACK.md; ARCHITECTURE.md]
- **`google.script.run`**: prefer one aggregate workspace read and one bounded batch save, with explicit success/failure handlers and serializable DTOs. Avoid uncontrolled RPC fan-out. [STACK.md; ARCHITECTURE.md]
- **Existing research services**: reuse programme resolution, composite identity, reference validation, lock, date/user, and MQF→TF helpers; keep assessment persistence in a separate `ResearchAssessmentService.gs` boundary. [STACK.md; ARCHITECTURE.md]
- **Existing CSS and accessibility conventions**: extend the current cards, chips, grids, contained matrix scrolling, focus treatment, and mobile breakpoint rather than establishing a new design system. [STACK.md; FEATURES.md]

Critical compatibility requirements are the existing `Masters`/`Doctorate` study-level vocabulary, composite `programmeId` (`faculty::progCode::mqaCode`) where MQA codes can duplicate, server-side authorization on every call, and no changes to `.clasp.json`, OAuth/secret configuration, deployment files, or deployment behavior. Local verification is Node/CommonJS/static extraction and syntax checking; no credentials, authenticated Apps Script session, `clasp push`, or `clasp deploy` is required for this increment. [STACK.md]

### Expected Features

**Must have (table stakes):**

- **Third programme tab** — add `Pemetaan Pentaksiran` alongside the two existing research tabs without changing their behavior. [FEATURES.md]
- **Correct Master/PhD profile loading** — select instruments from authoritative server-side study level and reject wrong-level, unknown, non-research, or cross-profile records. [FEATURES.md]
- **Faithful normalized rubric hierarchy** — represent instruments, optional categories, and items with stable IDs/order; preserve supplied thesis categories 1–4 only when confirmed by source. Preserve exact prompts, descriptors, labels, marks, and source/version lineage; never fabricate text. [FEATURES.md; ARCHITECTURE.md]
- **Deterministic marks** — reconcile item, category, and instrument totals and show expected versus calculated values; block relevant review/submission on mismatch. Keep rating scale and marks allocation separate until the `/10` thesis-section conversion is decided. [FEATURES.md; PITFALLS.md]
- **Separate PPS baseline and faculty alignment** — PPS defaults are immutable; faculty changes are programme-specific, auditable, and visibly distinguishable as active overrides. [PROJECT.md; FEATURES.md]
- **Item mappings** — expose valid MQF and taxonomy values, derive TF through the existing canonical relationship, and require exactly one active Primary SC at the agreed completeness gate. [PROJECT.md; FEATURES.md]
- **Explicit SDG exclusion** — no SDG selector, field, validator, readiness metric, persistence, or API key in Assessment Mapping. Existing SDG behavior remains only in `Pemetaan Program`. [PROJECT.md; FEATURES.md; PITFALLS.md]
- **Authorization, review, save, and accessibility** — reuse existing programme scope, fail closed server-side, expose actionable record-level issues, protect dirty navigation, lock writes, return canonical post-save state, and support keyboard/mobile/screen-reader use. [STACK.md; FEATURES.md]

**Should have (differentiators):**

- Provenance badges and a legend for PPS default, faculty override, inherited/effective, and derived values — recommended for the MVP because provenance is the core value proposition. [FEATURES.md]
- Baseline-versus-effective comparison at instrument/category/item level — build after the basic editor, but reserve provenance and source-version fields now. [FEATURES.md]
- Revert-to-PPS-default and immutable change history — useful audit capabilities, but require an explicit PPS decision on authority, rationale, and retention. [FEATURES.md]
- Source-document lineage and an effective review snapshot — prioritize stable source keys now; defer richer review-pack/export behavior unless governance requires it immediately. [FEATURES.md]

**Defer (v2+):**

- Full comparison/history UI, default-update impact migration, exports/review packs, rationale analytics, reference-lifecycle tooling, automatic academic suggestions, AI mapping, student assessment records, and bulk rebase. [FEATURES.md]
- Do not defer the underlying provenance, source version, stable identity, and actor/time fields needed to support these later features. [FEATURES.md; ARCHITECTURE.md]

### Architecture Approach

Keep the feature as an additive research-domain slice: `Index.html`/`JavaScript.html`/`Styles.html` call thin public `Code.gs` wrappers, which authenticate and authorize through existing helpers before reaching a new `ResearchAssessmentService.gs`. That service reads immutable definition sheets, overlays one programme/item alignment row when present, validates the candidate workspace, derives TF from effective MQF, reconciles totals, and returns an effective DTO containing both value and provenance. Assessment review should add an assessment section to the existing review result without making the existing PLO validator understand instruments or importing its SDG rules. [ARCHITECTURE.md]

**Major components:**

1. **Academic contract and seed inventory** — approved source documents, source status/version, stable instrument/category/item keys, exact text/marks, explicit curated mappings, and unresolved-decision register. This is a requirements/seed boundary, not a faculty API.
2. **PPS definition layer** — additive immutable instrument, optional category, and item rows. A conceptual minimum is `PR_AssessmentInstruments`, `PR_AssessmentCategories`, and `PR_AssessmentItems`; exact headers remain subject to the approved source contract. [ARCHITECTURE.md]
3. **Programme alignment layer** — one logical `(ProgrammeId, ItemId)` row for faculty-selected mapping overrides, with explicit override state/note and actor/time. Absence means PPS default; reset removes only the alignment. [ARCHITECTURE.md]
4. **Assessment projection/validation service** — study-level filtering, hierarchy joins, effective-value overlay, reference validation, mark reconciliation, Primary SC cardinality, canonical TF derivation, and fail-closed profile membership.
5. **Authorized API and persistence boundary** — narrow aggregate read and batch save/reset wrappers; composite identity and access checks before data access; `LockService` around writes; canonical refreshed response after save.
6. **Review integration** — assessment critical issues and metrics added without changing existing PEO/PLO/SDG semantics; submission is gated only when an applicable assessment profile has unresolved critical issues.
7. **Vue workspace and verification** — third tab, isolated assessment state/methods, provenance display, responsive editor, and focused plus existing regression tests.

The architecture must not copy defaults into programme rows at load time, persist manual TF, key alignments by MQA code alone, reuse `PR_PLOMappings`, rely on client-only filtering/cardinality, or make the UI authoritative for authorization, totals, or derivation. [ARCHITECTURE.md]

### Critical Pitfalls

1. **Rubric structure and arithmetic drift** — the reported draft thesis sources contain 20 descriptors but 18 scored rows, with Sections 7 and 11 sharing `/10` allocations; the four reported profiles have different totals (Master 100, PhD 100, Viva 25, Progress 50). Seed explicit item records, preserve grouping, assert exact counts/totals, and do not invent a `/10` split or treat rating scales as marks. These figures require confirmation against the authoritative source payload because the documents were not found in the repository checkout. [PITFALLS.md; FEATURES.md]
2. **Unresolved academic mappings** — Progress has no SC column in the reported source, yet the brief requires one default Primary SC per item; Progress Item 9 is described as requiring a replacement without an exact replacement string. Obtain approved values and record them as `PpsCuratedDefault`/explicit approved override, never as extracted source facts. [PITFALLS.md]
3. **Master/PhD collapse** — taxonomy and some source emphasis differ by study level. Key immutable profiles by study level and validate the server-selected profile; do not let a title toggle change presentation while retaining the wrong data. [PITFALLS.md; FEATURES.md]
4. **Provenance destruction** — overwriting defaults, copying all defaults into faculty rows, or deleting the distinction after deselection makes audit impossible. Keep baseline and alignment sheets separate; compute `override ?? baseline`, show textual provenance, and test select→save→deselect→reload. [PITFALLS.md; ARCHITECTURE.md]
5. **SDG and derived-data leakage** — reusing PLO payloads or validators can add SDG requirements or manual TF to assessment records. Define a separate DTO/schema with no SDG field, ignore client TF, derive from effective MQF, and add negative schema/API/UI/persistence tests. [PITFALLS.md; FEATURES.md]

Additional implementation hazards are destructive/non-idempotent seeding, table-unaware DOCX extraction, loss of bilingual/long descriptor fidelity, source labels being used as canonical IDs, and color-only provenance/accessibility. Mitigations are stable source keys, append-only locked seed initialization, table-aware source manifests, separate display/canonical fields, and text/icon/programmatic status alongside color. [PITFALLS.md]

## Implications for Roadmap

Based on the dependency graph and unresolved academic decisions, the roadmap should be a gated sequence. The UI must not lead: a third tab without a server-enforced contract would create a misleading client-only feature. Seed approval is the first hard gate; pure projection/validation should precede API writes; review should consume the same canonical validation result; the client should follow stable DTOs; and the final gate must include SDG exclusion and existing mapping regressions. [ARCHITECTURE.md; FEATURES.md]

### Phase 1: Academic Contract and Source Inventory

**Rationale:** Rubric content, marks, source status, study-level applicability, and curated mappings are the highest-uncertainty dependencies. Software must not encode missing PPS/JAPSU decisions by inference.  
**Delivers:** An approved/draft source register; exact Master/PhD/Viva/Progress profile matrix; stable source/document/version/item keys; item/category semantics; totals and scoring rules; Progress Item 9 replacement; ten Progress Primary SC defaults; MQF/taxonomy cardinality; canonical TF display semantics; faculty edit authority; provenance lifecycle; and review/submission policy. Keep an unresolved-decision register with owner and evidence.  
**Addresses:** Faithful rubric content, study-level loading, reconciled marks, exactly-one Primary SC, source lineage, and provenance requirements.  
**Avoids:** Display-section-versus-item loss, arithmetic drift, fabricated text/mappings, taxonomy collapse, and treating draft documents as approved authority.  
**Research flag:** **Required.** This phase needs PPS/JAPSU confirmation, not generic web research.

### Phase 2: Normalized Schema, Sheet Initialization, and Idempotent Seed

**Rationale:** The effective projection and all later APIs depend on immutable, versioned definitions with unambiguous identity.  
**Delivers:** Additive assessment headers/sheets, table-aware reviewed seed manifest, immutable PPS definition rows, optional category handling, exact source fields, canonical/reference fields, source-derived versus curated provenance, stable keys, and append-only/lock-protected idempotent initialization. Keep seed operations out of ordinary faculty routing and reject header/schema mismatch rather than shifting columns silently.  
**Uses:** `ResearchDataService.gs`, `ensureResearchSheets_()`, `LockService`, existing reference seeding conventions, and Apps Script Sheets.  
**Implements:** PPS definition components; no changes to legacy research sheets, programme tabs, `.clasp.json`, or deployment configuration.  
**Avoids:** Destructive reseeding, duplicate rows, merged-cell extraction errors, fabricated descriptors, source/version loss, and mutation of faculty overrides.  
**Research flag:** **Required if source payload or extraction tooling is not already supplied.** The Apps Script sheet pattern itself is standard, but academic seed approval is not.

### Phase 3: Pure Effective Projection and Academic Validation

**Rationale:** Validate the domain logic independently before exposing writes or UI state. This provides a single canonical result for APIs, review, and client rendering.  
**Delivers:** Study-level profile selection; instrument/category/item joins; effective default/override calculation; exact item/category/instrument reconciliation; separate rating/max-mark semantics; MQF/taxonomy/SC validation; exactly one Primary SC; TF derivation via existing `deriveTFIds_()` or an explicitly approved deterministic canonical wrapper; SDG-free DTOs; and record-level critical/warning issues.  
**Implements:** Assessment projection/validation service and focused pure Node tests with fake references/Sheets.  
**Avoids:** Wrong-level profiles, manual TF, multiple SCs, client-only validation, SDG leakage, and passing totals with wrong content.  
**Research flag:** **Targeted research/confirmation required** for singular-versus-plural TF semantics, MQF/taxonomy cardinality, score conversion, and completeness gates; implementation patterns are otherwise established locally.

### Phase 4: Authorized Persistence and Faculty Alignment

**Rationale:** Once the candidate workspace is correct, add the security and mutation boundary without changing the baseline.  
**Delivers:** Thin `Code.gs` wrappers and private `ResearchAssessmentService.gs` helpers; aggregate authorized read; batch save/reset; composite programme identity; research eligibility; applicable profile membership; active-reference validation; immutable PPS enforcement; one alignment row per programme/item; lock-protected writes; actor/time fields; and canonical post-save refresh.  
**Addresses:** Programme-scoped authorization, faculty alignment, visible provenance, concurrency protection, save state, and future audit history.  
**Avoids:** MQA-only cross-contamination, cross-profile writes, baseline overwrites, ambiguous nulls, stale client-derived TF, and partial saves.  
**Research flag:** **Standard repository pattern with security-focused planning.** No deployment research is needed; access and negative-test design are mandatory.

### Phase 5: Review and Readiness Integration

**Rationale:** Review must consume server validation rather than duplicate it, and it should be added only after assessment persistence has a stable canonical projection.  
**Delivers:** Assessment critical issues, warnings, metrics, and applicable-profile handling in existing review DTOs; explicit decision on whether assessment participates in current submission statuses; submission blocking only for unresolved applicable critical issues. Preserve existing PEO/PLO/SDG review behavior unchanged.  
**Implements:** The assessment section in `ResearchReviewService.gs` while keeping its existing PLO/SDG policy separate.  
**Avoids:** Making SDG a hidden Assessment requirement, changing existing research mapping semantics, or allowing a UI-only “ready” state.  
**Research flag:** **Required for PPS/JAPSU workflow confirmation** if assessment readiness/status is not already specified; otherwise the integration pattern is standard locally.

### Phase 6: Vue Workspace, Provenance Presentation, and Accessibility

**Rationale:** The client depends on stable aggregate DTOs and review results; building it later prevents UI assumptions from becoming the data model.  
**Delivers:** The third `Pemetaan Pentaksiran` tab; isolated root Vue state initialized up front; aggregate loading; editable active alignment values with read-only PPS baseline; provenance text/icon/chips; exact rubric hierarchy and totals; review issues; save/dirty/error feedback; reset behavior if approved; keyboard tab semantics; contained long-content scrolling; and responsive 390px/mobile presentation.  
**Uses:** Vue 2.7 reactivity rules, existing `google.script.run` handlers, `researchLoading`/save/dirty patterns, `showToast()`, current tab ARIA semantics, and existing CSS tokens.  
**Avoids:** Second Vue instance/store, client authority, color-only state, inaccessible rubric tables, uncontrolled RPC fan-out, and a disconnected CRUD page.  
**Research flag:** **Skip broad research-phase** for the application patterns; perform targeted UAT/accessibility checks and confirm any unresolved academic labels before finalizing copy.

### Phase 7: Regression, Source Audit, and Acceptance Gate

**Rationale:** This increment crosses academic data, authorization, persistence, UI, and existing PLO/SDG boundaries; the release gate must prove both addition and non-regression.  
**Delivers:** Focused tests for study-level loading, exact descriptors/counts/totals, rating/mark handling, provenance lifecycle, SC cardinality, TF derivation, SDG absence, invalid references, identity/access isolation, idempotent seeding, review gates, JavaScript/GAS syntax, manifest/ignore checks, and existing research-mapping regressions.  
**Avoids:** Passing arithmetic with wrong source content, source drift, SDG keys in any layer, accidental legacy changes, and false confidence from unexecuted authenticated services.  
**Research flag:** **No new platform research.** Remaining failures should return to the academic decision register or repository implementation, not be papered over with fixtures.

### Phase Ordering Rationale

- **Source before schema:** source/version, study-level, mark, and mapping decisions determine stable records; schema-first implementation would encode guesses.
- **Schema before projection:** immutable definitions and keys are prerequisites for effective-value/provenance calculation.
- **Projection before writes:** one pure validator avoids inconsistent rules between read, save, review, and UI.
- **Authorization with persistence:** every mutation must resolve identity/profile and validate before writing under lock.
- **Review before UI:** submission/readiness must use canonical server issues, not client-only status.
- **UI after DTO stability:** the third tab should present an authoritative model, not invent one.
- **Verification last but incremental:** pure tests can begin in Phase 3, while final acceptance must preserve existing mapping behavior and prove the hard SDG boundary.

### Research Flags

Phases likely needing deeper research or explicit planning confirmation:

- **Phase 1:** PPS/JAPSU approval, source status/version, exact instrument matrix, category semantics, marks/reconciliation, Progress Item 9, Progress Primary SC defaults, taxonomy/MQF cardinality, TF semantics, faculty authority, and review lifecycle.
- **Phase 2:** table-aware extraction and source manifest if the authoritative DOCX/seed payload is supplied outside the repository; no implementation should proceed from unverified local extracts.
- **Phase 3:** singular canonical TF policy, score conversion, and Primary SC completeness gate.
- **Phase 5:** whether assessment readiness joins the existing review/submission state machine.

Phases with standard patterns (skip broad `--research-phase`):

- **Phase 4:** existing authorization, composite identity, Sheets rows, locks, and batch mutation patterns are documented and locally tested, though security cases still require focused tests.
- **Phase 6:** existing Vue/HtmlService tab, state, RPC, CSS, and accessibility conventions are directly observable.
- **Phase 7:** existing Node/static/syntax regression harnesses are available; only assessment fixtures and negative-boundary assertions are new.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct repository inspection and existing local checks establish Apps Script V8, Vue 2.7.14, Sheets, RPC, locks, service boundaries, and verification commands. Official platform docs are supporting context only. [STACK.md] |
| Features | MEDIUM | Existing UI/UX and explicit project boundaries are strong; academic rubric/profile details are low confidence because source availability and PPS/JAPSU decisions are unresolved. [FEATURES.md] |
| Architecture | MEDIUM-HIGH | Existing component boundaries and integration patterns are HIGH confidence; proposed assessment sheets/DTOs and singular TF behavior remain recommendations pending source/contract approval. [ARCHITECTURE.md] |
| Pitfalls | MEDIUM | Existing code-boundary and explicit-scope pitfalls are HIGH confidence; extracted DOCX counts/wording are reported as high by the researcher but are not verifiable from this repository checkout. [PITFALLS.md; FEATURES.md] |

**Overall confidence:** MEDIUM. The implementation direction is clear, but the seed contract and several academic policies are not yet safe to treat as requirements.

### Gaps to Address

- **Authoritative JAPSU source payload:** reconcile the `FEATURES.md` report that no rubric files are in the repository with `PITFALLS.md`'s reported four draft DOCX sources. Supply approved/versioned documents or a reviewed seed manifest before Phase 2; do not commit fabricated fallback text.
- **Progress Item 9:** obtain the exact approved replacement string, source/version, and whether it is a PPS-curated correction or source text.
- **Progress Primary SC defaults:** obtain the ten approved defaults and provenance; source-derived and PPS-curated mappings must remain distinguishable.
- **Thesis `/10` scoring:** define rating-to-mark conversion, blank versus zero, decimals, rounding, and whether faculty can override allocations.
- **Profile matrix/categories:** confirm Master versus PhD applicability, optional instruments, thesis categories 1–4 names/order/meaning, and draft-versus-approved usability/submission rules.
- **Mapping cardinality:** confirm one versus multiple MQF domains, taxonomy family/cardinality, whether the UI presents all derived TFs or one deterministic canonical TF, and the exact Primary SC completeness gate.
- **Faculty authority and provenance lifecycle:** define editable fields, reset behavior, rationale requirement, stale/default-update handling, actor visibility, and history retention.
- **Review workflow:** decide whether assessment has a separate status or contributes to existing research review/submission states, without importing SDG requirements.
- **Study-level authority:** confirm the authoritative programme field and canonical `Masters`/`Doctorate` mapping; never accept a browser-provided level.

Until these gaps are resolved, the roadmap may implement scaffolding, pure validators, and draft rendering marked pending confirmation, but must block final seed activation and any submission-ready interpretation of unresolved academic values.

## Sources

### Primary (HIGH confidence)

- `.planning/PROJECT.md` — increment scope, active requirements, hard boundaries, constraints, and pending decisions.
- `.planning/research/STACK.md` — repository-observed stack, integration points, local verification, and platform citations.
- `.planning/research/FEATURES.md` — current application conventions, table stakes, differentiators, anti-features, dependencies, MVP recommendation, and unresolved academic decisions.
- `.planning/research/ARCHITECTURE.md` — proposed additive service/sheet boundary, data flow, security boundary, seed strategy, patterns, anti-patterns, and phase dependency graph.
- `.planning/research/PITFALLS.md` — reported draft JAPSU table counts/wording, source-extraction risks, provenance/SDG hazards, and phase-specific mitigations. Treat DOCX-derived claims as provisional until the source files are supplied in the repository or otherwise approved.
- Live repository files cited by the research: `gas/Code.gs`, `Auth.gs`, `ProgrammeService.gs`, `ResearchDataService.gs`, `ResearchReferenceService.gs`, `ResearchMappingService.gs`, `ResearchReviewService.gs`, `Index.html`, `JavaScript.html`, `Styles.html`, `README.md`, and existing `scripts/test-*.js` checks.

### Secondary (MEDIUM confidence)

- Reported local draft source set under `JAPSU 2026/Draf JAPSU 2026`: Master Thesis Report, PhD Thesis Report, Viva Voce, and Progress Report DOCX files — reported counts and wording in `PITFALLS.md`, pending repository/source reconciliation and PPS/JAPSU approval.
- `docs/superpowers/specs/2026-07-21-postgraduate-research-mapping-design.md` — existing local research mapping domain/migration context as cited by `FEATURES.md`.

### Tertiary (LOW confidence / supporting only)

- Google Apps Script HTML Service communication: <https://developers.google.com/apps-script/guides/html/communication> — RPC serialization, handlers, concurrency, and private-function conventions.
- Google Apps Script V8 runtime: <https://developers.google.com/apps-script/guides/v8-runtime> — runtime context and limitations.
- Google Apps Script Spreadsheet Service and LockService: <https://developers.google.com/apps-script/reference/spreadsheet> and <https://developers.google.com/apps-script/reference/lock/lock-service> — supporting platform guidance, not academic policy.
- Vue 2 reactivity guidance: <https://v2.vuejs.org/v2/guide/reactivity.html> — root-property and array update constraints; repository behavior remains authoritative.

---
*Research completed: 2026-07-30*  
*Ready for roadmap: yes, with Phase 1 academic-contract gates*  
*Operational boundary: no application/deployment/secret changes, push/deploy, or Linear write-back are included.*
