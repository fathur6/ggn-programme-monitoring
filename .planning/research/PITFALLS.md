# Domain Pitfalls

**Domain:** JAPSU postgraduate assessment-rubric extraction, mapping, validation, and audit provenance
**Researched:** 2026-07-30

The four local DOCX files are draft JAPSU 2026 sources, not a substitute for a later approved institutional version. Counts and quotations below were checked from the rubric tables, not from paragraph text alone. Confidence is high for the extracted counts and wording; it is low for requirements that are mentioned in the brief but are not specified in the local documents.

## Critical Pitfalls

### Pitfall 1: Treating a display section as one scored item

**What goes wrong:** The thesis forms have 20 rubric descriptors but only 18 marks rows. Sections 7 and 11 each contain two descriptors but are scored as `/10`; the remaining descriptors are generally `/5`. A model that counts only the 18 marks rows loses two assessment items, while a model that gives every descriptor `/5` produces the wrong total.

**Warning signs:** A thesis profile reports 18 items instead of 20; Section 7 or Section 11 has only one descriptor; the sum is not 100; a score is stored against a section without an item identifier.

**Actionable prevention:** Seed explicit item records beneath section/category records. Store `maxMark` per item, preserve section grouping separately, and assert both `descriptorCount = 20` and `sum(maxMark) = 100` for Master and PhD. Treat `/10` as the section allocation across its two descriptors unless the academic owner confirms a different split; do not silently invent a split in the seed.

**Evidence/source:** `JAPSU - Rubric for Master Thesis Report.docx`, Tables 1–8 contain 20 descriptor rows across Sections 1–11; Table 10 has 18 scored rows and `Total marks /100`. The PhD file has the same 20-descriptor/18-mark-row structure and `/100` total in Tables 1–10.

**Roadmap phase:** Phase 1 — source extraction and normalized seed contract.

### Pitfall 2: Arithmetic drift in the four source profiles

**What goes wrong:** The four source categories are distinct profiles: Master Thesis Report, PhD Thesis Report, Viva Voce, and Progress Report. Their totals are not interchangeable: Master = 100, PhD = 100, Viva = 25, and Progress = 50. Reusing one generic “assessment” total or adding category totals together will make validation and UI summaries wrong.

**Warning signs:** Viva displays `/100`, Progress displays `/25`, a study-level switch changes only the title but not item count or total, or a save accepts a score above the profile total.

**Actionable prevention:** Make category and study level part of the seed identity. Validate each profile independently: Viva has 5 items × `/5` = 25; Progress has 10 items × `/5` = 50; each thesis has the source marks rows summing to 100. Add arithmetic fixtures that fail on missing, duplicated, or extra items.

**Evidence/source:** Viva `JAPSU - Report for Examination of Viva Voce.docx`, Table 1 has 5 rubric rows and Table 3 has five `/5` rows plus `TOTAL MARKS /25`. Progress `JAPSU - Rubric for Progress Report Evaluation.docx`, Table 1 has 10 criteria rows and Table 2 has `Total Score / 50`. The two thesis files have `Total marks /100` in Table 10.

**Roadmap phase:** Phase 1 — source extraction and normalized seed contract.

### Pitfall 3: Silently “fixing” Progress Item 9

**What goes wrong:** Progress Item 9 is almost a duplicate of Item 8, but the local source does not label it as a replacement or provide an alternate approved descriptor. The current Item 9 text is: “The candidate organizes and integrates scholarly writing values by critically evaluating and producing coherent academic work that systematically incorporates evidence, demonstrates logical flow, and adheres to established conventions.” Implementing an invented correction would violate source fidelity; retaining it without a decision may violate the brief’s required replacement.

**Warning signs:** Item 9 differs from the accepted fixture by punctuation, “organizes” spelling, or one phrase; a seed generator overwrites the source wording without recording why; requirements say “replacement descriptor” but no exact string is available to the implementer.

**Actionable prevention:** Put the exact replacement string in the requirements/seed acceptance fixture before implementation. Preserve the current DOCX text and source version as provenance, record the replacement as an explicit approved override, and test exact equality after normalization rules are applied. Do not derive Item 9 from Item 8 or paraphrase it.

**Evidence/source:** `JAPSU - Rubric for Progress Report Evaluation.docx`, Table 1, row 9 (`Critical thinking skill`) contains the quoted descriptor. The same file does not contain a second Item 9 descriptor, revision note, or “replacement” marker; neither `.planning/PROJECT.md` nor the local source files supplies the replacement text.

**Roadmap phase:** Phase 0 — requirements clarification, before Phase 1 seeding.

### Pitfall 4: Collapsing Master and PhD taxonomy into one value

**What goes wrong:** Master and PhD use different taxonomy levels and sometimes different emphasis for the same section. For example, thesis title/abstract are Master C5 but PhD C6; methodology’s MQF2 item is Master C5 but PhD C6; digital skills are Master A4 but PhD A5; ethics is Master A4 but PhD A5. Progress Item 1 is Master A4/PhD A5 and Item 6 is Master P4/PhD P5. Viva rows also carry paired Master A4/PhD A5 values.

**Warning signs:** A study-level toggle changes only the title; a single taxonomy field is shared by both levels; PhD records contain the Master level; or validation accepts a taxonomy that is valid for the other level only.

**Actionable prevention:** Store level-specific variants on the same logical item, or use separate immutable profile rows keyed by `instrumentCategory + studyLevel + itemCode`. Validate the active profile server-side and retain the exact source label separately from canonical taxonomy IDs. Add tests for every item where Master and PhD differ, including Progress Items 1 and 6 and the thesis methodology cluster.

**Evidence/source:** Master and PhD thesis Tables 1–8; Progress Table 1 rows 1 and 6; Viva Table 1 rows 1–5. The source also contains legitimate repeated SC7 in Viva, so taxonomy/SC uniqueness must not be inferred from global uniqueness.

**Roadmap phase:** Phase 2 — study-level profile loading and academic validation.

### Pitfall 5: Treating source MQF/taxonomy labels as safe canonical IDs

**What goes wrong:** Source labels mix display names, MQF codes, taxonomy codes, and competency text. The PhD Results and Discussion rows include strings such as `MQF2 - Cognitive Skills (MQF2) (C6)` and `MQF3e - Numeracy Skills (MQF3e) (A5)`, while other rows use shorter forms. Blind string parsing or normalization can erase source wording or derive the wrong MQF/taxonomy value.

**Warning signs:** A seed changes “Practical Skill” to “Practical Skills” in the displayed descriptor; duplicate parenthetical codes disappear; the same source row maps to a different MQF domain after re-seeding; or TF is manually entered despite an MQF change.

**Actionable prevention:** Maintain separate fields for `sourceLabel`, canonical `mqfId`, canonical taxonomy ID, and display text. Use the existing MQF → TF authority for derived TF and reject incompatible stored TF values server-side. Require an explicit review decision for source inconsistencies rather than silently canonicalizing them.

**Evidence/source:** PhD thesis Table 6, rows for Sections 9b and 9c contain the duplicated MQF wording; Master/PhD thesis Tables 1–8 contain mixed MQF and taxonomy display forms. Existing `ResearchMappingService.gs` derives TF from MQF references; existing `ResearchReferenceService.gs` validates reference IDs and rejects malformed TF JSON.

**Roadmap phase:** Phase 1 — extraction schema; Phase 2 — server-side academic validation.

### Pitfall 6: Inventing Primary SC mappings and presenting them as source facts

**What goes wrong:** The Viva form explicitly includes SC values, but the thesis and Progress forms do not have an SC column. The brief requires one default Primary SC per Progress item, so those defaults are a curated mapping requirement, not text extracted from the Progress DOCX. A fabricated mapping becomes indistinguishable from PPS-approved provenance.

**Warning signs:** Progress seed rows claim an SC was “from JAPSU” when the source has none; an item has zero or multiple active Primary SCs; a repeated SC7 in Viva is rejected as a duplicate; or a faculty override is stored as the default.

**Actionable prevention:** Mark each mapping as `sourceDerived` or `PpsCuratedDefault`, require exactly one default Primary SC for every Progress item, and obtain/record the approved mapping table before seeding. Preserve source SCs for Viva exactly, including SC7 on both Communication and Personal Skills. Validate cardinality and reference membership on the server, not only in Vue.

**Evidence/source:** Progress Table 1 contains MQF/taxonomy text but no SC field. Viva Table 1 explicitly maps its five rows to SC5, SC7, SC6, SC8, and SC7. `.planning/PROJECT.md` requires one Primary SC per assessment item but does not define the ten Progress defaults.

**Roadmap phase:** Phase 0 — confirm academic mapping; Phase 2 — mapping validation.

### Pitfall 7: Losing provenance when a faculty override is deselected

**What goes wrong:** If the current value is used as the only stored value, deselecting a faculty choice can erase evidence that the PPS default existed. The UI may also show green/blue state only through color, making the audit state ambiguous.

**Warning signs:** After clearing a faculty selection, the PPS value is blank or appears as a new faculty value; a reloaded page cannot distinguish “never overridden” from “override removed”; audit history contains only the final value; or green/blue is the sole indicator.

**Actionable prevention:** Persist immutable PPS baseline rows and programme-specific faculty override rows separately. Compute current state as `override ?? baseline`, while retaining `baselineSource`, `overrideSource`, timestamps, and actor. Deselecting an override must remove or close only the override and leave the PPS baseline/provenance visible as green plus text such as “PPS default.” Use text, icon, and accessible status labels in addition to color; test the full select → save → deselect → reload sequence.

**Evidence/source:** `.planning/PROJECT.md` requirements 24–25 and constraints 48–49 require immutable PPS defaults, separate faculty overrides, and provenance distinction. The local DOCX files provide rubric content but no provenance model. Existing `ResearchReferenceService.gs` uses append-only seed-by-code behavior, which is a useful integrity precedent but is not sufficient by itself for programme overrides.

**Roadmap phase:** Phase 3 — provenance persistence, authorization, and audit views.

### Pitfall 8: Reusing the existing PLO mapping payload and leaking SDG into Assessment Mapping

**What goes wrong:** Existing research mapping rows contain `SDGIdsJson`, and existing review validation warns or requires SDG. Reusing that service for assessments can expose SDG controls, persist SDG fields, or make an assessment item fail because it has no SDG. The brief explicitly excludes SDG from Assessment Mapping.

**Warning signs:** Assessment API payloads contain `sdgIds`; assessment sheets include an SDG column; a shared validator emits `PLO_SDG_MISSING`; or changing an assessment SC changes programme SDG coverage.

**Actionable prevention:** Define a separate assessment schema and API contract that has no SDG field at all. Keep SDG references and PLO validation confined to `Pemetaan Program`; add negative tests that inspect seed rows, API JSON, UI labels, and persisted Sheets for SDG keys. Reuse access-control and locking helpers, not the SDG-bearing data model.

**Evidence/source:** `.planning/PROJECT.md` Out of Scope 31 and Active 27 explicitly exclude SDG from assessment mapping. Existing `ResearchDataService.gs` defines `PR_SDGReference` and `PR_PLOMappings.SDGIdsJson`; `ResearchReviewService.gs` emits `PLO_SDG_MISSING` and `SDG_REQUIRED`; `test-research-mapping.js` intentionally tests SDG in the existing PLO flow.

**Roadmap phase:** Phase 2 — assessment service boundary; Phase 5 — regression and schema audit.

## Moderate Pitfalls

### Pitfall 9: Non-idempotent or destructive seeding

**What goes wrong:** First-use Google Sheets creation or a source refresh can duplicate rubric rows, overwrite a faculty override, or clear locally added reference data. A draft source may also change wording between versions without an audit record.

**Warning signs:** Two rows share an item code; opening the tab changes data; `clearContents()` is used for seed refresh; a source update changes a saved default in place; concurrent first loads create duplicate sheets/rows.

**Actionable prevention:** Use stable source/category/study-level/item keys, append missing seed rows only, use `LockService`, retain source version/hash and extraction timestamp, and never overwrite programme-specific overrides during seed refresh. Add tests for repeated initialization, malformed rows, inactive rows, and concurrent-safe behavior. Existing tests already expect missing approved references to be seeded without clearing custom rows; apply that pattern to a new assessment boundary.

**Evidence/source:** Existing `ResearchReferenceService.gs` seeds by code under a script lock and does not clear sheets; `test-research-mapping.js` asserts malformed/inactive rows are ignored and existing rows are preserved. The four files reside under `JAPSU 2026/Draf JAPSU 2026`, so draft/version provenance matters.

**Roadmap phase:** Phase 1 — seed importer; Phase 3 — persistence and migration.

### Pitfall 10: Confusing a 1–5 attainment rating with marks allocation

**What goes wrong:** Every rubric uses a 1–5 scoring/attainment scale, but thesis Sections 7 and 11 allocate `/10`, while Viva and Progress total their five-point item scores directly. Treating `/10` as a 1–5 maximum, or summing section ratings without a defined conversion, produces invalid totals.

**Warning signs:** A thesis item accepts 6–10 despite a 1–5 descriptor scale; total is calculated from raw section count rather than `maxMark`; Progress accepts decimal marks without a decision; or UI displays “score” and “mark” interchangeably.

**Actionable prevention:** Model `ratingScaleMin`, `ratingScaleMax`, and `maxMark` independently. Make the rating-to-mark conversion for the two `/10` thesis sections an explicit academic decision; until confirmed, do not claim the conversion is source-derived. Validate boundaries and totals per profile and label fields unambiguously in the UI.

**Evidence/source:** Master/PhD thesis Tables 1–8 show 1–5 scales while Table 10 assigns `/10` to Section 7 and Section 11. Viva Table 1 has a 1–5 attainment scale and Table 3 assigns `/5` to each of five items. Progress Table 0 defines 1–5 as Strongly Disagree through Strongly Agree and Table 2 totals `/50`.

**Roadmap phase:** Phase 2 — scoring validation; Phase 4 — score-entry UI.

### Pitfall 11: Omitting bilingual and language-fidelity requirements

**What goes wrong:** The forms instruct that the report be prepared in the student’s thesis-writing language. Progress criteria contain Malay/English labels, and several labels or punctuation forms are irregular. Translating, deduplicating, or “correcting” text in the seed changes the rubric users are meant to audit.

**Warning signs:** Malay labels disappear; source text is silently grammar-corrected; a seed diff contains many wording changes; a long descriptor is truncated in the database; or comments cannot be tied back to the source row.

**Actionable prevention:** Preserve the exact source text, including bilingual labels and line/group boundaries, in an immutable source field. Keep localization/display transformations separate from seed content. Store source filename, table, row, and source version on every item, and test representative multilingual strings and long descriptors.

**Evidence/source:** Master and PhD paragraph 2 say to prepare the report in the same language as the student’s thesis; Progress paragraph 2 says the same. Progress Table 1 includes bilingual criteria such as `Interest and commitment / Minat dan komitmen` and `Kemahiran komunikasi bertulis`.

**Roadmap phase:** Phase 1 — extraction fidelity; Phase 4 — accessible rendering.

### Pitfall 12: Treating merged DOCX cells and table layout as ordinary paragraphs

**What goes wrong:** The rubric content is in tables, including descriptors, scoring scales, comments, marks, result options, and examiner fields. Paragraph-only extraction sees the title and instructions but misses the authoritative item text and can misread merged cells as duplicates.

**Warning signs:** A seed contains titles but no descriptors; Section 6 or 8 loses its second/third item; score scale labels are detached from the item; or table row numbers differ after a library re-serializes merged cells.

**Actionable prevention:** Use table-aware extraction with stable source coordinates (document filename, table number, row, and logical item code). Review the generated manifest against the rendered DOCX, especially thesis Tables 1–10 and the Viva/Progress marks tables. Do not use a generic paragraph scraper as the source of truth.

**Evidence/source:** The four DOCX files contain respectively 15, 15, 5, and 3 tables; the authoritative rubric rows are in those tables. Paragraph extraction alone does not expose the thesis descriptors or the Viva/Progress item rows.

**Roadmap phase:** Phase 1 — extraction tooling and source manifest.

### Pitfall 13: Relying on color alone for green PPS and blue faculty states

**What goes wrong:** Green/blue provenance can be invisible to color-blind users, lost in high-contrast mode, or meaningless in a text export. Similar colors may also make a faculty override look like a PPS default.

**Warning signs:** There is no text label for provenance; a status is communicated only by CSS class; keyboard users cannot identify the active Primary SC; mobile cards hide the source label; or contrast fails against white/grey backgrounds.

**Actionable prevention:** Pair color with visible text, icon/shape, and programmatic status (`aria-label`, `aria-describedby`, or a table column). Make the baseline and override values separately readable, ensure focus order for scoring controls, and test keyboard-only, screen-reader, zoom, high contrast, and 390px layouts. Follow existing client tests that require scoped table headers, focusable scroll regions, and explicit accessible checked/not-checked labels.

**Evidence/source:** `.planning/PROJECT.md` requires green PPS provenance and blue faculty overrides in the brief context; existing `test-research-mapping-client.js` checks ARIA naming, table `scope`, keyboard navigation, focusable matrix scrolling, and explicit checked/not-checked labels. The DOCX forms contain long descriptors and five-column scales that will stress responsive layouts.

**Roadmap phase:** Phase 4 — assessment UI and accessibility verification.

## Minor Pitfalls

### Pitfall 14: Treating source typos and terminology inconsistencies as implementation authority

**What goes wrong:** The documents contain small inconsistencies such as `Ph.D.` versus `PhD`, `Practical Skill` versus `Practical Skills`, and `Integrated Problem Solving` versus `Integrated Problem-Solving`. Correcting these in place can break exact-source tests; preserving them as canonical IDs can break filtering.

**Warning signs:** Display labels are used as lookup keys; a punctuation-only source update creates duplicate items; or seed review cannot show whether a change was editorial or academic.

**Actionable prevention:** Keep stable canonical codes and exact source labels in different fields. Normalize only identifiers and document the normalization rules; do not normalize displayed descriptors. Add a source-diff report that distinguishes spelling/punctuation changes from item-code, mark, taxonomy, or descriptor changes.

**Evidence/source:** All four DOCX files show variant capitalization, punctuation, and terminology in table labels. Existing reference validation separates canonical codes from titles/descriptions; use the same boundary for assessment seeds.

**Roadmap phase:** Phase 1 — seed normalization rules; Phase 5 — source-diff audit.

### Pitfall 15: Assuming academic ambiguities are resolved by the software schema

**What goes wrong:** The local files do not answer several brief-level decisions: the exact Progress Item 9 replacement, the ten Progress Primary SC defaults, the conversion for thesis `/10` sections, and whether the “four categories” are UI categories or source profiles. A convenient schema can silently encode an academic decision that has no owner approval.

**Warning signs:** Requirements use words such as “default,” “replacement,” or “category” without a cited source row; a developer chooses a split or mapping to make totals pass; or later reviewers cannot identify who approved a non-source value.

**Actionable prevention:** Maintain an unresolved academic-decision register with owner, decision date, source/brief evidence, and affected seed keys. Block final seed approval and submission validation on unresolved cardinality or replacement decisions; allow draft rendering only with a visible “pending confirmation” status. Do not treat a passing unit test as approval of an academic interpretation.

**Evidence/source:** The four local DOCX files provide exact rubric wording, MQF/taxonomy text, Viva SCs, and totals, but do not specify Progress Primary SC mappings or an Item 9 replacement. `.planning/PROJECT.md` states the required behavior but leaves those exact values out.

**Roadmap phase:** Phase 0 — requirements and academic-owner confirmation; Phase 5 — release gate.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| 0. Requirements confirmation | Implementing an absent Item 9 replacement, SC defaults, or score conversion by inference | Obtain exact strings/mappings and record decisions before seeding; keep unresolved fields blocked |
| 1. Source extraction and seeds | Paragraph-only extraction, wrong item counts, fabricated wording, destructive re-seeding | Use table-aware manifests, stable item keys, source text/version fields, arithmetic fixtures, and lock-protected append-only seeding |
| 2. Profile loading and validation | Master/PhD taxonomy collapse, cross-profile records, invalid TF, multiple Primary SCs | Key records by category + study level; validate profile membership, MQF/TF compatibility, and `PrimarySC.length === 1` server-side |
| 3. Provenance and persistence | Faculty overrides overwriting PPS defaults or disappearing after deselection | Store immutable PPS baseline and programme-specific override separately; compute current state without deleting provenance |
| 4. UI and accessibility | Color-only provenance, inaccessible long descriptors, ambiguous rating/mark controls | Textual provenance labels, labelled radio groups, keyboard/focus tests, responsive table/card review, and screen-reader assertions |
| 5. Audit and regression | SDG leakage, source drift, or passing totals despite wrong content | Negative SDG schema tests, exact descriptor fixtures, source-diff report, all existing research-mapping regressions, and fixture arithmetic checks |

## Sources

- `JAPSU - Rubric for Master Thesis Report.docx` — Tables 1–10 (20 descriptors, 18 marks rows, total `/100`), Table 12 (result options).
- `JAPSU - Rubric for PhD Thesis Report.docx` — Tables 1–10 (20 descriptors, 18 marks rows, total `/100`), Table 12 (result options).
- `JAPSU - Report for Examination of Viva Voce.docx` — Table 1 (5 items, MQF/taxonomy/SC/descriptors), Table 3 (five `/5` items, total `/25`).
- `JAPSU - Rubric for Progress Report Evaluation.docx` — Table 0 (1–5 scale), Table 1 (10 criteria), Table 2 (total `/50`).
- `.planning/PROJECT.md` — assessment requirements, PPS/faculty provenance, exact-total and SDG constraints, and unresolved project decisions.
- `gas/ResearchReferenceService.gs`, `gas/ResearchMappingService.gs`, `gas/ResearchReviewService.gs` — existing seed, lock, reference validation, MQF→TF, access, and SDG-bearing PLO patterns.
- `scripts/test-research-mapping.js`, `scripts/test-research-mapping-client.js` — existing idempotent-seed, reference, accessibility, keyboard, and regression-test conventions.
