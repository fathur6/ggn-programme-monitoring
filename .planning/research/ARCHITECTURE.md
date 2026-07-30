# Architecture Patterns

**Domain:** Assessment Mapping extension for the GGN Academic Management Google Apps Script/Vue application
**Researched:** 2026-07-30
**Confidence:** HIGH for the existing application boundaries; MEDIUM for the proposed assessment schema until the approved JAPSU source documents are available in the repository

## Recommended Architecture

Keep Assessment Mapping as an additive research-domain slice inside the existing `gas/` application. Do not add a second backend, a second authorization model, a per-programme assessment sheet, or a second MQF-to-TF mapping table.

```text
Index.html + JavaScript.html + Styles.html
        │  google.script.run
        ▼
Code.gs public API wrappers
        │
        ├── Auth.gs
        │     getCurrentUser_ → requireProgrammeAccess_
        │     resolveProgramme_ / faculty ownership / admin or grant scope
        │
        ├── ProgrammeService.gs
        │     Programme sheet → programmeId, MQA code, faculty, StudyLevel
        │
        ├── ResearchAssessmentService.gs  (new)
        │     effective assessment projection, validation, override writes
        │
        ├── ResearchDataService.gs
        │     PR_* headers, lazy sheet creation, spreadsheet access
        │
        ├── ResearchReferenceService.gs
        │     MQF, TF, SC and existing reference validation
        │
        └── ResearchReviewService.gs
              assessment readiness issues added to the existing review result

Google Sheets
  PR_AssessmentInstruments  (immutable PPS/default definitions)
  PR_AssessmentCategories   (optional thesis category definitions)
  PR_AssessmentItems        (immutable rubric items and default mappings)
  PR_AssessmentAlignments   (programme-specific faculty overrides only)
  PR_MQFReference / PR_TFReference / PR_SCReference
```

The key design is an **effective-value projection**. An item is read from the PPS definition sheet, then a programme-specific alignment row is applied when one exists. The response includes both the effective value and its provenance (`PPS default` or `Faculty override`). A reset removes the alignment row; it does not copy or mutate the default.

This matches the existing additive pattern: `ResearchDataService.gs` declares `RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_()` creates missing `PR_*` sheets lazily under a script lock, and `ResearchMappingService.gs` stores programme-scoped normalized rows rather than modifying the existing `Programme` or legacy MQA tabs. The current README explicitly defines the research boundary as `ProgrammeProfile → PEO/PLO/MQF/Taxonomy → PLO mappings → TF/SDG/SC` and says course-based data is not transformed or deleted.

### Component Boundaries

| Component | Responsibility | Concrete existing/proposed symbols | Communicates With |
|-----------|----------------|------------------------------------|-------------------|
| Programme identity | Resolve canonical programme, faculty, study level, and research eligibility | `gas/ProgrammeService.gs`: `getProgrammes_()`, `programmeIdentity_()`, `resolveProgramme_()`, `isResearchProgramme_()` | `Auth.gs`, assessment service, `Code.gs`, client programme directory |
| Authentication and authorization | Authenticate domain users and enforce programme scope before detail access or mutation | `gas/Auth.gs`: `getCurrentUser_()`, `canViewProgramme_()`, `requireProgrammeAccess_()`, `requireResearchProgrammeAccess_()`; `AccessRequestService.gs`: `getActiveAccessGrant_()` | Every assessment API; `ProgrammeService.gs` |
| Research sheet registry | Declare headers, create missing sheets, expose the bound spreadsheet | `gas/ResearchDataService.gs`: `RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_()`, `getResearchProgrammeKey_()` | All research services; `Auth.gs:getSpreadsheet()` |
| PPS assessment definitions | Own immutable instrument/category/item defaults and source provenance | New `gas/ResearchAssessmentService.gs` (or a separate seed file if the seed payload is large) | Assessment read projection; admin-only seed/migration process |
| Assessment effective projection | Filter definitions by study level, apply an override if present, derive TF, and calculate reconciled marks | New: `getResearchAssessmentWorkspaceApi_()`, `assessmentEffectiveItem_()`, `deriveAssessmentTF_()`, `validateAssessmentWorkspace_()` | Sheet registry, references, programme/auth boundary, review service |
| Programme alignment persistence | Store only programme/item-specific faculty choices; never write PPS definition rows | New: `getResearchAssessmentAlignmentsApi_()`, `saveResearchAssessmentAlignmentsApi_()`, `deleteResearchAssessmentAlignmentApi_()` or a single batch save/reset API | `Auth.gs`, `LockService`, assessment sheets |
| Reference data | Supply valid MQF, TF, SC records and the existing TF relationship map | `gas/ResearchReferenceService.gs`: `getResearchReferences_()`, `getResearchReferencesApi()`, `validateReferenceIds_()`; `ResearchMappingService.gs`: `researchTFReferenceMap_()`, `deriveTFIds_()` | Assessment validator and response projection; existing PLO mapping |
| Research review | Combine assessment critical issues with existing PEO/PLO review without changing the existing PLO source model | `gas/ResearchReviewService.gs`: `researchReviewDataFromSheets_()`, `validateResearchProgramme_()`, `getResearchReviewApi_()`, `submitResearchProgrammeApi_()` | Assessment validator, programme profile, existing PEO/PLO mappings |
| API routing | Expose only narrow public wrappers; keep implementation helpers private by `_` convention | `gas/Code.gs`: existing `getResearch*Api` / `saveResearch*Api` wrappers; add assessment wrappers here | Vue client and private service helpers |
| Client workspace | Add the third tab, hold assessment state, show effective values/provenance, and save through server APIs | `gas/Index.html`: `research-tabs` and `researchCategory`; `gas/JavaScript.html`: Vue data/methods/loaders; `gas/Styles.html`: existing cards/chips/grid tokens | `google.script.run`, current programme identity |

Do not make `Index.html` or `JavaScript.html` responsible for authorization, study-level filtering, mark reconciliation, or TF derivation. The current client already derives a display matrix in `projectMappingMatrixRow_()`, but the server remains authoritative for PLO mapping; Assessment Mapping should follow that boundary more strictly because defaults and overrides have audit meaning.

## Recommended Sheet Schema

The exact approved wording and mark allocations must come from the JAPSU documents. The following is the minimum normalized shape, using the application's existing PascalCase header convention and JSON columns for repeated identifiers.

### `PR_AssessmentInstruments` — immutable PPS instrument definitions

```text
InstrumentId, Code, Title, StudyLevel, InstrumentType, TotalMarks,
SourceDocument, SourceVersion, Provenance, Active, CreatedAt, UpdatedAt, UpdatedBy
```

- `StudyLevel` must use the server's existing values: `Masters` and `Doctorate`, not a new `Master`/`PhD` vocabulary. A shared instrument must be represented deliberately (for example, one version per applicable level or an explicitly documented `All` value), not inferred in the browser.
- `InstrumentType` distinguishes thesis, Viva Voce, and Progress Report without creating separate schemas.
- `TotalMarks` is the source-document total used for reconciliation.
- `Provenance` is a definition property such as `PPS default`; it is not editable by faculty.

### `PR_AssessmentCategories` — optional category definitions

```text
CategoryId, InstrumentId, CategoryCode, Title, SortOrder, ExpectedMarks,
Optional, SourceDocument, SourceVersion, Provenance, Active, CreatedAt, UpdatedAt, UpdatedBy
```

For thesis instruments, seed the four approved categories as category rows with source wording and order preserved. For Viva Voce and Progress Report items, `CategoryId` may be blank. `Optional` describes applicability in the approved rubric; it must not be used to silently omit a required item from mark reconciliation.

### `PR_AssessmentItems` — immutable rubric item definitions and PPS defaults

```text
ItemId, InstrumentId, CategoryId, ItemCode, Prompt, Descriptor, MaxMarks,
SortOrder, MQFDomainsJson, Taxonomy, PrimarySCId, SourceDocument, SourceVersion,
Provenance, Active, CreatedAt, UpdatedAt, UpdatedBy
```

- `Prompt` and `Descriptor` must be copied from the approved/draft source exactly; no fabricated fallback text.
- `MaxMarks` is the item allocation. The service sums item marks and reconciles against `ExpectedMarks` and `TotalMarks`.
- The default MQF and taxonomy values are source/default values. `PrimarySCId` is scalar because Assessment Mapping has exactly one active Primary SC; do not reuse the PLO's plural `SCIdsJson` shape for this domain.
- There is intentionally **no stored TF column**. TF is a projection from the item's effective MQF domains through the existing reference relationship.

### `PR_AssessmentAlignments` — programme-specific faculty overrides

```text
AlignmentId, ProgrammeId, InstrumentId, ItemId, MQFDomainsJson, Taxonomy,
PrimarySCId, OverrideState, OverrideNote, UpdatedAt, UpdatedBy
```

Use one logical row per `(ProgrammeId, ItemId)`. Absence of a row means the PPS default is active. Presence of a row means the supplied values are the faculty-selected active override, even when they happen to equal the default. To explicitly clear a default value, store an explicit empty JSON array or empty scalar in the override row; do not use `null` ambiguously. A reset deletes the row under lock.

The read DTO should be richer than any one sheet row:

```text
{
  instrument: { instrumentId, code, title, studyLevel, instrumentType, totalMarks },
  categories: [...],
  items: [{
    itemId, categoryId, itemCode, prompt, descriptor, maxMarks,
    mqfDomains, taxonomy, primarySCId, derivedTFIds,
    provenance: 'PPS default' | 'Faculty override',
    overrideExists, overrideNote
  }],
  totals: { expectedMarks, itemMarks, categoryMarks, reconciled },
  references: { MQF, SC, TF },
  studyLevel
}
```

`derivedTFIds` intentionally uses the existing plural response naming even if the assessment UI presents one canonical TF label. The existing code's `deriveTFIds_()` returns every compatible TF, and current TF reference relationships overlap. If the assessment contract truly requires one singular `derivedTF`, add a deterministic `deriveCanonicalTFId_()` wrapper beside `deriveTFIds_()` and test its tie-breaking policy; do not add an assessment-specific TF table or allow the client to choose a conflicting TF.

## Data Flow

### Read flow

1. `Code.gs:doGet()` authenticates the session and injects `sessionUser` into `Index.html`. `JavaScript.html:initApp()` creates the Vue app only when the authenticated session is present.
2. `getProgrammesApi()` calls `getProgrammes_()` and filters `isResearchProgramme_()`. The client retains the returned composite `programmeId` (`faculty::progCode::mqaCode`) and must pass it for all assessment calls. MQA-only fallback is acceptable only when the identity is unambiguous.
3. `openProgramme()` sets `currentProgramme`, switches to the detail view, and starts the existing research workspace load. Add assessment loading as a separate state or as one additional request; do not merge assessment rows into `researchPLOs` or `researchMappings`.
4. `getResearchAssessmentWorkspaceApi_(programmeId)` first calls `requireProgrammeAccess_(programmeId, 'view-assessment')`, then resolves the research programme and `getResearchProgrammeKey_()`. It rejects coursework programmes and unknown identities before reading assessment rows.
5. The service selects active instrument definitions matching the authoritative `programme.level`. It joins categories and items by `InstrumentId` and optional `CategoryId`, then looks up the `(ProgrammeId, ItemId)` override rows.
6. The service computes each effective item, validates references, derives TF from the effective MQF values using `getResearchReferences_()` → `researchTFReferenceMap_()` → `deriveTFIds_()`, and reconciles category/instrument marks.
7. The response includes default and override provenance. The client renders default values as read-only baseline information and editable active values as a faculty alignment layer. SDG is not returned as an Assessment Mapping reference.

### Save flow

1. `JavaScript.html` sends a batch of item alignments using the selected composite programme identity. It must not send a trusted derived TF or a fabricated instrument/category association as authority.
2. `Code.gs` exposes a narrow `saveResearchAssessmentAlignmentsApi()` wrapper. The private helper calls `requireProgrammeAccess_(..., 'edit-assessment')` before sheet access.
3. Under `withResearchLock_()` (currently in `ResearchMappingService.gs`, or moved to a shared research data helper without changing semantics), the helper re-resolves the programme, filters the applicable instrument set, and verifies every `InstrumentId`, `CategoryId`, and `ItemId` belongs to that set.
4. The helper normalizes MQF codes and taxonomy, validates them against server reference data/`RESEARCH_TAXONOMY_IDS`, requires exactly one valid `PrimarySCId`, rejects SDG fields, and ignores/recomputes any client-supplied TF.
5. It validates the full candidate workspace, including category and instrument mark totals. If valid, it upserts only `PR_AssessmentAlignments` rows and updates `UpdatedAt`/`UpdatedBy`. It never updates `PR_AssessmentInstruments`, `PR_AssessmentCategories`, or `PR_AssessmentItems`.
6. The server returns a fresh effective projection, not the raw request. The client replaces its assessment state with that response, clears dirty state, and refreshes review/readiness just as `researchMutationComplete()` currently refreshes PLO-derived state.

### Review and submit flow

`ResearchReviewService.gs` currently reads `PR_ProgrammeProfile`, `PR_PEORecords`, `PR_PLORecords`, and `PR_PLOMappings` in `researchReviewDataFromSheets_()` and validates them through `validateResearchProgramme_()`. Add an assessment section to the review input/result rather than making the existing PLO validator understand instruments:

```text
researchReviewDataFromSheets_
  → assessmentReviewData_(key, sheets, references)
  → validateAssessmentWorkspace_
  → result.assessment = { critical, warnings, metrics }
  → getResearchReviewApi_ / submitResearchProgrammeApi_
```

The existing submission gate should block only when assessment is in scope for the programme and its critical issues remain unresolved. The review service must continue to use its existing PLO/SDG policy; Assessment Mapping must not add SDG requirements or mutate `PR_PLOMappings`.

## Authoritative Sources and Naming Adaptations

| Concern | Authoritative source | Adaptation required |
|---------|---------------------|--------------------|
| Programme ownership and study level | `Programme` sheet through `getProgrammes_()` / `resolveProgramme_()` | Do not accept a client-provided faculty or level. Use `programmeId` for duplicate MQA identities. |
| Research eligibility | `isResearchProgramme_()` in `ProgrammeService.gs` | Use the same server predicate as the current workspace; the client predicate is only a display guard. |
| PPS assessment defaults | New `PR_Assessment*` definition sheets | No public faculty save API for these rows. Seed append-only by source/version/key. |
| Active faculty alignment | `PR_AssessmentAlignments` keyed by `ProgrammeId + ItemId` | Keep it separate from defaults; return provenance explicitly. |
| MQF codes | `PR_MQFReference` via `getResearchReferences_()` | Use compact server codes (`MQF1`, `MQF3a`), not the client display labels (`MQF 1`, `MQF 3a`) in `JavaScript.html:MQF_CLUSTERS`. |
| TF derivation | `PR_TFReference` plus `deriveTFIds_()` | Never persist or independently seed assessment TF values. Recompute after every MQF change/reference refresh. |
| Taxonomy | `RESEARCH_TAXONOMY_IDS` in `ResearchMappingService.gs` | The client `TAXONOMY_LEVELS` is presentation metadata; server validation wins. |
| Primary SC | `PR_SCReference` via `getResearchReferences_()` | Existing PLO code uses `scIds[]`; Assessment Mapping should expose/store one `PrimarySCId` and validate cardinality server-side. |
| SDG exclusion | Existing `PR_SDGReference` remains for PLO mapping only | Do not include SDG in assessment DTOs, sheets, validators, or UI state. |
| Timestamps and actor | Existing `UpdatedAt`/`UpdatedBy` columns and `researchUser_()` | Use the authenticated `access.user`, not a browser-supplied email. |
| Locking and row writes | Existing `withResearchLock_()`, `replaceResearchRows_()`, and `researchRows_()` patterns | Batch read/write under a script lock; invalidate `RESEARCH_ROWS_CACHE_` after writes. |

The conceptual model must therefore adapt to the application's style in four places: `StudyLevel` uses `Masters`/`Doctorate`; programme identity is composite; existing mapping JSON columns are plural even where the assessment domain is scalar; and private service helpers end in `_` while public `Code.gs` wrappers end in `Api`.

## Migration and Seed Strategy

### Sheet initialization

Extend `RESEARCH_SHEET_HEADERS` in `ResearchDataService.gs` and let `ensureResearchSheets_()` create only the four new sheets when first needed. Do not alter the existing eight research sheets or legacy per-programme tabs. The current initializer only appends headers when a sheet is empty; that is appropriate for new assessment sheets, but a schema/header mismatch on an existing assessment sheet should fail closed and surface an admin migration error rather than silently shifting columns.

### Definition seeding

The repository currently contains no JAPSU rubric files or assessment sheet definitions. The project context identifies local draft documents, but their exact text is not present in this checkout. Consequently, do not invent item prompts, descriptors, marks, or mappings in code.

Use an idempotent admin/developer seed routine modeled on `ResearchReferenceService.gs:seedResearchReferences_()`:

1. Parse a reviewed seed payload prepared from the four source documents: Master thesis, PhD thesis, Viva Voce, and Progress Report.
2. Use a stable source key such as `SourceDocument + SourceVersion + InstrumentCode + CategoryCode + ItemCode`.
3. Append missing definition rows only. Never clear or overwrite an existing PPS row.
4. If an approved document changes, append a new `SourceVersion`/definition set and deactivate the old set only through an explicit, reviewed migration. Existing programme alignment rows should not be silently remapped; report incompatible item keys for manual resolution.
5. Validate per-instrument totals, per-category totals, item order, descriptor presence, study level, active state, reference IDs, and exactly one default Primary SC before activation.
6. Keep the seed routine out of normal faculty API routing. If an admin endpoint is needed, require `isGraduateSchoolAdmin_()` and make it an explicit one-time operation.

`migrateLegacyResearchRows_()` in `ResearchMappingService.gs` is only for the existing PEO/PLO/MQA-key-to-composite-key migration. Do not reuse it to manufacture assessment definitions or to infer assessment mappings from PLO rows. Assessment sheets are new and should start empty until the approved source payload is supplied.

## Security Boundaries

1. **Session boundary:** `getCurrentUser_()` accepts only registered `@unisza.edu.my` users resolved through `lookupUser_()` in `USER` or `ADMIN`. Assessment APIs must not accept an email or role from the client.
2. **Programme boundary:** every read and write takes `programmeId` and calls `requireProgrammeAccess_()`. Faculty access is tied to the canonical programme faculty; admins have university-wide access; temporary grants are checked by `getActiveAccessGrant_()` and remain identity-specific for duplicate MQA codes.
3. **Study-level boundary:** the server resolves `programme.level` and filters instruments before validating item references. A valid item from the wrong study-level profile is still rejected.
4. **Reference boundary:** every MQF, taxonomy, and SC identifier is validated against active server-side references. Reject unknown, inactive, unsafe, cross-instrument, and cross-profile IDs.
5. **Cardinality boundary:** exactly one valid Primary SC is required for every active assessment item. Do not rely on Vue checkbox behavior; a malicious or stale request must fail server-side.
6. **Derivation boundary:** TF is computed from effective MQF domains and current TF references. Ignore client `derivedTF` values. If a reference table changes, the next read/save recomputes the projection.
7. **Provenance boundary:** faculty writes can only create/update/delete alignment rows. They cannot write default definitions, provenance fields, source documents, or mark allocations.
8. **Concurrency boundary:** batch mutations use a script lock and return canonical post-save state. The client must show an error/dirty state when a write fails and reload the latest projection before retrying.

The current `Code.gs` wrappers are intentionally thin, while `ResearchMappingService.gs` performs validation only after authorization and programme resolution. Assessment endpoints should preserve that order: authenticate → authorize → resolve research programme → resolve applicable profile → validate references/cardinality → lock/write.

## Patterns to Follow

### Pattern 1: Effective value with provenance

**What:** Read an immutable item definition and overlay one programme-specific alignment row, returning both the value and its source.

**When:** Any faculty view or review projection.

**Example:**

```javascript
function assessmentEffectiveItem_(item, alignment, references) {
  var override = alignment && String(alignment.overrideState) === 'Faculty override';
  var mqfDomains = override ? parseResearchJson_(alignment.mqfDomainsJson) : parseResearchJson_(item.mqfDomainsJson);
  var taxonomy = override ? String(alignment.taxonomy || '') : String(item.taxonomy || '');
  var primarySCId = override ? String(alignment.primarySCId || '') : String(item.primarySCId || '');
  var tfMap = researchTFReferenceMap_(references);
  return {
    itemId: item.itemId,
    mqfDomains: uniqueTrimmed_(mqfDomains),
    taxonomy: canonicalResearchTaxonomy_(taxonomy),
    primarySCId: primarySCId,
    derivedTFIds: deriveTFIds_(mqfDomains, tfMap),
    provenance: override ? 'Faculty override' : 'PPS default',
    overrideExists: !!alignment
  };
}
```

The helper is illustrative and should use the project's existing row converters and server validators. The important boundary is that derivation occurs after overlay and never from a browser payload.

### Pattern 2: Aggregate read, batch mutation

The existing `loadResearchWorkspace()` makes seven parallel calls for profile, PEOs, PLOs, references, mappings, coverage, and review. Assessment can use one aggregate read because the effective projection needs definitions, categories, alignments, references, and totals together. Save a batch of alignment changes under one lock so the UI cannot display half of a rubric as saved and half as dirty.

### Pattern 3: Server row identity, not array position

Existing PLO save flow first persists PLOs, obtains server-generated IDs, and then saves the mapping against the returned `ploId`. Assessment should use `ItemId` and `InstrumentId` in the same way. Array index and display code are not foreign keys.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Copying defaults into programme rows at load time

**What:** Materialize every PPS item as a faculty row before the faculty changes anything.

**Why bad:** It destroys the distinction between untouched defaults and active overrides, increases sheet size, and makes reset/provenance ambiguous.

**Instead:** Absence of an alignment row means PPS default; only persist a row for an explicit faculty override.

### Anti-Pattern 2: Manual TF in the assessment schema

**What:** Add `TFId` to an assessment sheet and let faculty select it independently.

**Why bad:** It creates a second TF source of truth and can conflict with `deriveTFIds_()` used by PLO mapping.

**Instead:** Derive TF from effective MQF domains through `PR_TFReference`; add a shared canonical wrapper only if a singular result is required.

### Anti-Pattern 3: MQA-only alignment keys

**What:** Key overrides by `MQACode` because it is convenient in the UI.

**Why bad:** `test-research-mapping.js` demonstrates that duplicate MQA codes exist across faculties/programme codes; MQA-only writes can cross-contaminate programmes.

**Instead:** Use the composite `programmeId` from `programmeIdentity_()` and reject ambiguous MQA-only requests.

### Anti-Pattern 4: Reusing `PR_PLOMappings` for assessment alignment

**What:** Put assessment item IDs into `SCIdsJson`/`DerivedTFIdsJson` or add assessment fields to the PLO mapping sheet.

**Why bad:** It mixes SDG-enabled PLO scope with assessment scope, makes item-level provenance impossible, and violates the explicit SDG exclusion.

**Instead:** Add assessment-specific normalized sheets and keep PLO mapping behavior unchanged.

### Anti-Pattern 5: Client-only study filtering or SC cardinality

**What:** Hide wrong-level instruments and rely on Vue's one-selection behavior.

**Why bad:** `google.script.run` arguments are untrusted; stale clients and crafted calls bypass display constraints.

**Instead:** Filter and validate again after `requireProgrammeAccess_()` on every request.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Sheet reads | Read the four assessment sheets once per aggregate request; cache rows per invocation as current `researchRows_()` does | Batch `getValues()`, build in-memory indexes by `InstrumentId`/`ItemId`, avoid per-item `getRange()` calls | Google Sheets plus Apps Script row scans become the bottleneck; migrate the data service to a database/API only as a separate architectural project |
| Writes and contention | One script lock per batch mutation is adequate | Batch `setValues()` and keep the critical section small; return a canonical revision/timestamp | A global script lock will serialize too much traffic; use a transactional datastore and explicit versioning |
| Client payload | One study-level workspace response is small and simple | Keep responses scoped to the selected programme and omit SDG/unused definitions | Add pagination/section loading only if rubrics become materially larger; do not preload all programmes |
| Reference changes | Read active references and recompute TF | Cache reference maps but invalidate after seed/version changes | Manage reference versions explicitly and avoid recomputation across historical millions of rows |

The current application is an internal, spreadsheet-backed workspace. Optimize the 100-to-10K path with aggregate reads, row indexes, and batch writes; do not introduce a new datastore for this increment.

## Suggested Phase / Plan Order

1. **Assessment contract and seed inventory**
   - Confirm the approved JAPSU documents, exact source wording, four thesis categories, marks, descriptors, study-level applicability, default MQF/taxonomy/SC values, and whether TF is a list or a singular canonical projection.
   - Lock the four sheet headers and stable key/version strategy before UI work.
   - **Dependency:** none. **Research flag:** high until source documents are supplied.

2. **Schema, lazy initialization, and idempotent seed path**
   - Extend `RESEARCH_SHEET_HEADERS`/`ensureResearchSheets_()` and add a non-destructive seed/migration helper.
   - Verify existing research sheets, legacy per-programme tabs, and `Programme` data remain untouched.
   - **Depends on:** phase 1. **Boundary:** definitions are read-only to faculty.

3. **Pure assessment projection and validation**
   - Implement study-level selection, item/category joins, effective default/override projection, mark reconciliation, SC cardinality, valid references, and TF derivation through `deriveTFIds_()`.
   - Add unit/static tests before routing or UI work.
   - **Depends on:** phases 1–2 and existing `ResearchReferenceService.gs`/`ResearchMappingService.gs` helpers.

4. **Authorized API and override persistence**
   - Add thin `Code.gs` wrappers and private `ResearchAssessmentService.gs` helpers.
   - Enforce `requireProgrammeAccess_()`, composite identity, research eligibility, study-level item membership, immutable definitions, script-lock batch writes, and canonical post-save responses.
   - **Depends on:** phase 3. **Security gate:** test faculty, admin, temporary-grant, duplicate-MQA, wrong-study-level, invalid-reference, and cross-item requests.

5. **Review/readiness integration**
   - Extend `researchReviewDataFromSheets_()` and `getResearchReviewApi_()` with assessment issues/metrics while preserving existing PEO/PLO/SDG semantics.
   - Gate submission on assessment critical errors only when the assessment profile is applicable.
   - **Depends on:** phases 3–4.

6. **Vue workspace and responsive presentation**
   - Add the third `Pemetaan Pentaksiran` tab in `Index.html`, isolated `assessment*` state/methods in `JavaScript.html`, and cards/tables/provenance chips in `Styles.html`.
   - Reuse `researchLoading`, `researchError`, `researchDirty`, `researchSaveState`, `showToast()`, `google.script.run`, and the existing keyboard tab pattern; extend the tab list from two to three deliberately.
   - **Depends on:** stable aggregate read/write DTOs and review result.

7. **Regression and acceptance verification**
   - Run the existing research mapping tests unchanged, then add assessment tests for study-level loading, exact totals, descriptors, provenance, SC cardinality, TF derivation, SDG absence, authorization, and migration idempotency.
   - Run the README static/syntax checks. Authorized deployment verification is separate and remains out of scope for this increment.
   - **Depends on:** all implementation phases; can begin with pure validator tests in phase 3.

### Phase dependency graph

```text
Approved source + contract
        ↓
Schema/seed ──→ pure projection/validation ──→ authorized API/write path
                                      ├────────→ review/submit
                                      └────────→ Vue tab/client state
                                                        ↓
                                             regression + acceptance checks
```

The UI should be last because it depends on the effective DTO and because adding a third tab before server enforcement would create a misleading client-only feature. Review integration follows server validation so it consumes the same canonical result as the workspace.

## Sources

### Local authoritative sources — HIGH confidence

- `.planning/PROJECT.md` — feature constraints: normalized instrument/category/item model, immutable PPS defaults, programme-specific overrides, canonical TF, one Primary SC, and SDG exclusion.
- `gas/ResearchDataService.gs` — `RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_()`, lazy `PR_*` sheet creation, `getResearchProgrammeKey_()`.
- `gas/ResearchReferenceService.gs` — seeded MQF/TF/SDG/SC references, active-row filtering, `validateReferenceIds_()`, `getResearchReferencesApi()`.
- `gas/ResearchMappingService.gs` — `deriveTFIds_()`, `researchTFReferenceMap_()`, `researchContext_()`, composite-key legacy migration, row caches, locks, PLO persistence, and current TF behavior.
- `gas/ProgrammeService.gs` — `programmeIdentity_()`, `resolveProgramme_()`, `isResearchProgramme_()`, `Masters`/`Doctorate` level detection.
- `gas/Auth.gs` and `gas/AccessRequestService.gs` — `requireProgrammeAccess_()`, faculty/admin scope, duplicate-MQA identity protection, and expiring programme grants.
- `gas/Code.gs` — thin public API wrapper convention and existing research endpoints.
- `gas/ResearchReviewService.gs` — current review data flow, critical/warning structure, status transitions, and submission gate.
- `gas/Index.html`, `gas/JavaScript.html`, `gas/Styles.html` — two-tab Vue workspace, `google.script.run` loading/save patterns, client reference labels, dirty state, and responsive design tokens.
- `scripts/test-research-mapping.js`, `scripts/test-research-mapping-client.js`, and `scripts/test-coor-access.js` — regression expectations for TF derivation, reference seeding, composite programme identity, client/server research predicates, and access isolation.
- `README.md` — additive migration boundary, test commands, no deployment side effects, and source/configuration handling.

### Platform context — LOW confidence for project-specific decisions

- Google Apps Script HTML Service: <https://developers.google.com/apps-script/guides/html>
- Google Apps Script Spreadsheet Service: <https://developers.google.com/apps-script/reference/spreadsheet>
- Google Apps Script LockService: <https://developers.google.com/apps-script/reference/lock/lock-service>

These platform references support the existing GAS/HTML/Spreadsheet/LockService shape, but they do not define this application's academic model or authorization policy. The local source files above are authoritative for those decisions.
