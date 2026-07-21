# Postgraduate Research Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exposed course-based workflow with a postgraduate research programme workspace where PLOs own MQF, Taxonomy, SDG, and SC data, TF is derived from MQF, and PEO coverage is calculated from child PLOs.

**Architecture:** Keep the existing Apps Script deployment, authentication, programme directory, and server-side scope controls, but add a separate postgraduate research data boundary keyed by the existing MQA programme code. New lazy-created Sheets store programme profile, PEOs, PLOs, mappings, and reference data; the old per-programme/course-oriented workflow is not read by the new APIs. A Vue client presents exactly two categories, while all validation, TF derivation, PEO roll-up, status, and authorization remain server-side.

**Tech Stack:** Google Apps Script V8, Google Sheets, LockService, Drive-backed existing authentication, Vue 2.7.14, plain HTML/CSS/JavaScript, Node.js static/source tests.

## Global Constraints

- The new interface contains no course-based navigation, labels, or workflows.
- The portal has exactly two categories: `Maklumat Program` and `Pemetaan`.
- PLO is the only manual mapping unit; PEO coverage is derived from child PLO mappings.
- TF is server-generated from MQF relationships and must display `TF derived from MQF mapping`.
- SDG and SC are explicit PLO-level selections and are not inferred from MQF.
- The system does not force every PLO to have every TF, SDG, or SC.
- Existing production course-based data is not physically deleted or transformed automatically.
- New detail and mutation APIs must enforce programme scope server-side.
- Do not read, print, modify, commit, or deploy `gas/Config.gs` or `gas/.clasp.json`.
- Do not run `clasp push`, `clasp deploy`, email operations, or destructive production Sheet/Drive operations during implementation.
- Preserve pre-existing untracked `.DS_Store` files and generated companion artifacts.
- Use `LockService` for concurrent Sheet writes and record `updatedBy` and `updatedAt`.

---

## File Map

### New files

- Create: `gas/ResearchDataService.gs` — lazy creation, headers, row conversion, and shared access to the postgraduate research Sheets.
- Create: `gas/ResearchReferenceService.gs` — immutable MQF/TF/SDG/SC references and server-side reference validation.
- Create: `gas/ResearchMappingService.gs` — PEO/PLO persistence, PLO mappings, TF derivation, and PEO roll-up.
- Create: `gas/ResearchReviewService.gs` — validation, coverage metrics, programme status, review and submission operations.
- Create: `scripts/test-research-mapping.js` — pure-function regression tests for TF derivation, PEO roll-up, validation, and status.

### Modify

- Modify: `gas/Code.gs` — expose guarded research APIs and remove the old workflow from public application routing.
- Modify: `gas/Index.html` — replace the current detail workspace, course-oriented document controls, graph panel, and legacy PEO/PLO editor with the two-category research workspace.
- Modify: `gas/JavaScript.html` — add research state, API loaders/savers, mapping interactions, dirty-state protection, coverage, and review actions; remove legacy state and methods.
- Modify: `gas/Styles.html` — style the two-category shell, profile forms, PLO rows, mapping selectors, derived chips, matrix, coverage, review alerts, and mobile layouts.
- Modify: `gas/GovernanceService.gs` — compute readiness from research review results rather than legacy PEO/PLO row fields.
- Modify: `scripts/verify-mqf-rebuild.js` — enforce the new files, APIs, schema markers, no-course UI, derived TF/PEO markers, and security boundaries.
- Modify: `README.md` — document the new research model, Sheet boundaries, reference maintenance, and non-destructive migration boundary.

### Explicitly do not modify

- Do not modify `gas/Config.gs`.
- Do not modify `gas/.clasp.json`.
- Do not modify or remove `.DS_Store` files.
- Do not migrate or delete existing course-based production rows as part of this plan.

---

## Task 1: Establish Research Sheet Boundaries And References

**Files:**
- Create: `gas/ResearchDataService.gs`
- Create: `gas/ResearchReferenceService.gs`
- Create: `scripts/test-research-mapping.js`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: `getSpreadsheet()`, `getCurrentUser()`, `findProgrammeByMqaCode_()`, and the existing programme directory.
- Produces: `RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_()`, `getResearchProgrammeKey_()`, `getResearchReferences_()`, `validateReferenceIds_()`, and pure helpers exported to the Node test through source extraction.

- [ ] **Step 1: Add RED tests for the new reference and Sheet boundary contract.**

Add assertions to `scripts/test-research-mapping.js` for:

```js
assert.deepStrictEqual(researchSheetNames, [
  'PR_ProgrammeProfile',
  'PR_PEORecords',
  'PR_PLORecords',
  'PR_PLOMappings',
  'PR_MQFReference',
  'PR_TFReference',
  'PR_SDGReference',
  'PR_SCReference'
]);
assert.strictEqual(getResearchProgrammeKey_({mqaCode: 'MQA/TEST'}), 'MQA/TEST');
assert.deepStrictEqual(validateReferenceIds_(['MQF2'], ['MQF1', 'MQF2']), ['MQF2']);
assert.throws(() => validateReferenceIds_(['INVALID'], ['MQF1', 'MQF2']), /invalid/i);
```

- [ ] **Step 2: Run the new test to confirm it fails for the missing implementation.**

Run: `node scripts/test-research-mapping.js`

Expected: FAIL because the research Sheet names and reference helpers do not yet exist.

- [ ] **Step 3: Implement lazy research Sheet creation.**

Use exact headers and do not touch existing programme or legacy per-programme sheets:

```js
var RESEARCH_SHEET_HEADERS = {
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_MQFReference: ['Code', 'Title', 'Description', 'Active'],
  PR_TFReference: ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
  PR_SDGReference: ['Code', 'Title', 'Description', 'Active'],
  PR_SCReference: ['Code', 'Title', 'Description', 'Active']
};

function ensureResearchSheets_() {
  var ss = getSpreadsheet();
  var result = {};
  Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(RESEARCH_SHEET_HEADERS[name]);
    result[name] = sheet;
  });
  return result;
}

function getResearchProgrammeKey_(programme) {
  var key = String(programme && (programme.programmeId || programme.mqaCode) || '').trim();
  if (!key) throw new Error('Programme ID is required');
  return key;
}
```

Store `programmeId` as the existing MQA programme code for stable directory/access joins. Use generated UUIDs for `PeoId` and `PloId`.

- [ ] **Step 4: Implement server-side reference tables and validation.**

Seed the MQF and TF relationships from the approved reference data, including:

```js
TF1: ['MQF1', 'MQF4a']
TF2: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']
TF3: ['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f']
TF4: ['MQF3a', 'MQF3b', 'MQF4a', 'MQF4b', 'MQF5']
```

Expose only active references to clients. `validateReferenceIds_(ids, allowedIds)` must trim, deduplicate, reject unknown values, and return canonical IDs. `getResearchReferencesApi()` must require an authenticated user but may return only non-sensitive reference rows.

- [ ] **Step 5: Run the test to confirm the boundary and reference contract passes.**

Run: `node scripts/test-research-mapping.js`

Expected: PASS for Sheet names, programme key, canonical reference IDs, and invalid-reference rejection.

- [ ] **Step 6: Extend static verification and commit.**

Assert that all eight `PR_` sheets, the exact TF relationships, no course fields in new headers, and `getResearchReferencesApi` exist.

Run: `node scripts/verify-mqf-rebuild.js && node scripts/test-research-mapping.js && git diff --check`

Commit:

```bash
git add gas/ResearchDataService.gs gas/ResearchReferenceService.gs scripts/test-research-mapping.js scripts/verify-mqf-rebuild.js
git commit -m "feat: add postgraduate research data boundaries"
```

## Task 2: Implement Programme Information And PLO Persistence

**Files:**
- Create: `gas/ResearchMappingService.gs`
- Modify: `gas/Code.gs`
- Modify: `scripts/test-research-mapping.js`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: `ensureResearchSheets_()`, `getResearchProgrammeKey_()`, `validateReferenceIds_()`, `requireProgrammeAccess_()`, and the existing programme directory.
- Produces: `getResearchProgrammeApi_(mqaCode)`, `saveResearchProfileApi_(mqaCode, profile)`, `getResearchPEOsApi_(mqaCode)`, `saveResearchPEOsApi_(mqaCode, peos)`, `getResearchPLOsApi_(mqaCode)`, `saveResearchPLOsApi_(mqaCode, plos)`, and `getResearchMappingsApi_(mqaCode)`.

- [ ] **Step 1: Add RED tests for PEO/PLO normalization and parent validation.**

Add pure helper tests with these expected behaviors:

```js
assert.deepStrictEqual(normalizeResearchPLO_({
  code: ' PLO1 ',
  statement: ' Outcome ',
  parentPEO: 'PEO1',
  mqfDomains: ['MQF2', 'MQF2'],
  taxonomy: 'C4'
}), {
  code: 'PLO1', statement: 'Outcome', parentPEO: 'PEO1',
  mqfDomains: ['MQF2'], taxonomy: 'C4', rationale: ''
});
assert.throws(() => validatePLOParents_([{code: 'PLO1', parentPEO: 'PEO9'}], [{code: 'PEO1'}]), /parent PEO/i);
assert.throws(() => validateDuplicateCodes_([{code: 'PLO1'}, {code: 'PLO1'}], 'PLO'), /duplicate/i);
```

- [ ] **Step 2: Run the tests and verify the expected RED failure.**

Run: `node scripts/test-research-mapping.js`

Expected: FAIL because research normalization and parent validation are not implemented.

- [ ] **Step 3: Implement profile and PEO/PLO row conversion.**

Implement pure normalization before any Sheet write:

```js
function normalizeResearchPLO_(input) {
  return {
    code: String(input && input.code || '').trim(),
    statement: String(input && input.statement || '').trim(),
    parentPEO: String(input && input.parentPEO || '').trim(),
    mqfDomains: uniqueTrimmed_(input && input.mqfDomains || []),
    taxonomy: String(input && input.taxonomy || '').trim(),
    rationale: String(input && input.rationale || '').trim()
  };
}
```

Reject empty profile/programme keys, reject duplicate PEO/PLO codes within a programme, require PLO code and statement for save, require valid parent PEO codes, validate MQF and Taxonomy references, and preserve `Draft` records only when the user is editing before submit. Store arrays as JSON in Sheets and return arrays in API objects.

- [ ] **Step 4: Implement guarded profile, PEO, and PLO APIs.**

Every read/write endpoint must call `requireProgrammeAccess_(mqaCode, action)` before loading or writing detail. Use `LockService.getScriptLock()` around each write. Return canonical records with `programmeId`, IDs, audit fields, and no legacy course fields.

Add Code.gs wrappers:

```js
function getResearchProgrammeApi(mqaCode) { return getResearchProgrammeApi_(mqaCode); }
function saveResearchProfileApi(mqaCode, profile) { return saveResearchProfileApi_(mqaCode, profile || {}); }
function getResearchPEOsApi(mqaCode) { return getResearchPEOsApi_(mqaCode); }
function saveResearchPEOsApi(mqaCode, peos) { return saveResearchPEOsApi_(mqaCode, peos || []); }
function getResearchPLOsApi(mqaCode) { return getResearchPLOsApi_(mqaCode); }
function saveResearchPLOsApi(mqaCode, plos) { return saveResearchPLOsApi_(mqaCode, plos || []); }
```

Do not call the legacy `getPEOs`, `getPLOs`, `savePEOs`, or `savePLOs` from these APIs.

- [ ] **Step 5: Run normalization and API static checks.**

Run: `node scripts/test-research-mapping.js && node scripts/verify-mqf-rebuild.js`

Expected: PASS for canonical fields, duplicate detection, parent validation, `requireProgrammeAccess_` on every research wrapper, and absence of legacy service calls in the new service.

- [ ] **Step 6: Commit the Programme Information backend.**

```bash
git add gas/ResearchMappingService.gs gas/Code.gs scripts/test-research-mapping.js scripts/verify-mqf-rebuild.js
git commit -m "feat: add postgraduate programme information APIs"
```

## Task 3: Implement PLO Mapping, TF Derivation, And PEO Roll-up

**Files:**
- Modify: `gas/ResearchReferenceService.gs`
- Modify: `gas/ResearchMappingService.gs`
- Modify: `gas/Code.gs`
- Modify: `scripts/test-research-mapping.js`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: normalized PLO records, MQF/TF reference rows, and authorized programme access.
- Produces: `deriveTFIds_`, `calculatePEOCoverage_`, `saveResearchPLOMappingApi_(mqaCode, ploId, mapping)`, `getResearchCoverageApi_(mqaCode)`, and `getResearchMappingsApi_` output with `derivedTFIds` and `derivedLabel`.

- [ ] **Step 1: Add RED tests for TF derivation and PEO aggregation.**

```js
assert.deepStrictEqual(
  deriveTFIds_(['MQF2', 'MQF3d'], {
    TF1: ['MQF1', 'MQF4a'],
    TF2: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']
  }),
  ['TF2']
);

assert.deepStrictEqual(calculatePEOCoverage_([
  {parentPEO: 'PEO1', derivedTFIds: ['TF1'], sdgIds: ['SDG4'], scIds: ['SC2']},
  {parentPEO: 'PEO1', derivedTFIds: ['TF2'], sdgIds: ['SDG4'], scIds: ['SC3']}
], 'PEO1'), {
  tfIds: ['TF1', 'TF2'], sdgIds: ['SDG4'], scIds: ['SC2', 'SC3'], childCount: 2
});
```

- [ ] **Step 2: Run the tests and verify the expected RED failure.**

Run: `node scripts/test-research-mapping.js`

Expected: FAIL because the derivation and roll-up helpers are not implemented.

- [ ] **Step 3: Implement deterministic TF derivation.**

Use set semantics and return sorted canonical IDs:

```js
function deriveTFIds_(mqfDomains, tfReference) {
  var selected = uniqueTrimmed_(mqfDomains || []);
  return Object.keys(tfReference || {}).filter(function(tfId) {
    return (tfReference[tfId] || []).some(function(domain) {
      return selected.indexOf(domain) !== -1;
    });
  }).sort();
}
```

Persist only the server result in `DerivedTFIdsJson`. The client may display, but may not submit, an authoritative derived TF array.

- [ ] **Step 4: Implement PLO mapping save and coverage APIs.**

`saveResearchPLOMappingApi_` must require programme access, locate the PLO by `ploId` and programme key, validate SDG/SC IDs, recalculate TF from the current MQF domains, store `MappingNote`, and return the canonical PLO mapping. `getResearchCoverageApi_` must return PEO coverage, global MQF/TF/SDG/SC coverage, and per-PLO readiness.

- [ ] **Step 5: Implement PEO roll-up with the exact derived label.**

`calculatePEOCoverage_` must union child PLO TF, SDG, and SC IDs without duplicate values and return `derivedLabel: 'Derived from PLO mappings'`. A PEO with no children must return an explicit issue rather than an empty successful mapping.

- [ ] **Step 6: Run derivation and persistence checks.**

Run: `node scripts/test-research-mapping.js && node scripts/verify-mqf-rebuild.js && git diff --check`

Expected: PASS for one-to-many MQF-to-TF relationships, deduplication, server-derived values, PEO roll-up, exact labels, and guarded APIs.

- [ ] **Step 7: Commit mapping behavior.**

```bash
git add gas/ResearchReferenceService.gs gas/ResearchMappingService.gs gas/Code.gs scripts/test-research-mapping.js scripts/verify-mqf-rebuild.js
git commit -m "feat: derive TF and PEO coverage from PLO mappings"
```

## Task 4: Implement Review, Submission, And Governance Integration

**Files:**
- Create: `gas/ResearchReviewService.gs`
- Modify: `gas/Code.gs`
- Modify: `gas/GovernanceService.gs`
- Modify: `scripts/test-research-mapping.js`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: programme profile, PEO/PLO records, PLO mappings, reference data, `requireProgrammeAccess_`, and existing governance access rules.
- Produces: `validateResearchProgramme_`, `getResearchReviewApi_(mqaCode)`, `saveResearchStatusApi_(mqaCode, status)`, `submitResearchProgrammeApi_(mqaCode)`, and dashboard status shaped from research review results.

- [ ] **Step 1: Add RED tests for validation and status transitions.**

```js
var incomplete = validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: '', parentPEO: 'PEO1', mqfDomains: [], taxonomy: ''}],
  mappings: []
});
assert(incomplete.critical.some(function(issue) { return issue.code === 'PLO_STATEMENT_REQUIRED'; }));
assert.strictEqual(incomplete.status, 'Needs attention');

var ready = validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Outcome', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF2']}]
});
assert.strictEqual(ready.status, 'Ready for review');
```

- [ ] **Step 2: Run the tests and verify the expected RED failure.**

Run: `node scripts/test-research-mapping.js`

Expected: FAIL because the research review helper is not implemented.

- [ ] **Step 3: Implement review metrics and issue severity.**

Return `critical`, `warnings`, `metrics`, `peoCoverage`, and `status`. Critical checks are empty/duplicate PLO code, empty statement, invalid parent, invalid/missing MQF, failed TF derivation, and missing PEO children. Missing SDG/SC, broad statements, domain concentration, and review suggestions are non-blocking warnings unless an explicitly configured policy marks them required.

Metrics must include:

```text
ploTotal
ploStatementsComplete
ploWithMQF
ploWithSDG
ploWithSC
mqfDomainCoverage
tfCoverage
sdgCoverage
scCoverage
peosWithIssues
```

- [ ] **Step 4: Implement status and submission APIs with server-side checks.**

Allow status values `Draft`, `Needs attention`, `Ready for review`, `Submitted`, `Approved`, and `Returned for revision`. `submitResearchProgrammeApi_` must recompute review server-side, reject critical issues, write `Submitted` with the current user and timestamp, and never trust a client-supplied review result.

- [ ] **Step 5: Replace legacy readiness calculations.**

Update `computeProgrammeStatus_` to use `getResearchReviewApi_` for research programmes. Do not use legacy `embeddedPEO`, single `mqfDomain`, or document readiness as a prerequisite for the new research status. Keep existing governance/access protections and university aggregate status behavior. Ensure non-admin dashboard output remains status-only.

- [ ] **Step 6: Run review and governance checks.**

Run: `node scripts/test-research-mapping.js && node scripts/test-mqf-overdue.js && node scripts/verify-mqf-rebuild.js`

Expected: PASS for critical versus warning behavior, status transitions, server-side submission rejection, research dashboard readiness, and existing deadline tests.

- [ ] **Step 7: Commit review integration.**

```bash
git add gas/ResearchReviewService.gs gas/Code.gs gas/GovernanceService.gs scripts/test-research-mapping.js scripts/verify-mqf-rebuild.js
git commit -m "feat: add postgraduate research review status"
```

## Task 5: Replace The Client With The Two-Category Workspace

**Files:**
- Modify: `gas/Index.html`
- Modify: `gas/JavaScript.html`
- Modify: `gas/Styles.html`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: `getResearchReferencesApi`, profile/PEO/PLO APIs, mapping/coverage APIs, review/status APIs, and the existing dashboard/programme directory.
- Produces: two-category navigation, Programme Information forms, PLO Workspace, derived TF chips, PEO coverage summaries, and Review & Submit view.

- [ ] **Step 1: Add RED static UI assertions.**

Before changing templates, add assertions that require these exact markers and reject course markers in the new detail workspace:

```js
assertContains(index, /Maklumat Program/, 'Programme Information category is missing');
assertContains(index, /Pemetaan/, 'Mapping category is missing');
assertContains(index, /PLO Workspace/, 'PLO workspace is missing');
assertContains(index, /Coverage Matrix/, 'Coverage matrix is missing');
assertContains(index, /TF derived from MQF mapping/, 'Derived TF label is missing');
assertContains(index, /Derived from PLO mappings/, 'PEO derived label is missing');
assert(!/Coursework|DCI|CLO|credit hour|Subject|Course Mapping/.test(researchDetailSource), 'Course-based UI remains in the research detail workspace');
```

- [ ] **Step 2: Run static verification and confirm RED.**

Run: `node scripts/verify-mqf-rebuild.js`

Expected: FAIL because the current detail view still contains legacy fields and lacks the new category markers.

- [ ] **Step 3: Replace the detail template in `gas/Index.html`.**

Keep login, persistent app shell, programme directory, access request, and admin governance controls outside the two research categories. Remove graph and document panels from the research workspace. Replace the current detail block with:

```html
<div v-if="currentView === 'research' && currentProgramme" class="research-workspace">
  <section class="programme-context">...</section>
  <nav class="research-tabs" aria-label="Programme workspace">
    <button @click="researchCategory = 'information'">Maklumat Program</button>
    <button @click="researchCategory = 'mapping'">Pemetaan</button>
  </nav>
  <section v-if="researchCategory === 'information'" class="research-panel">
    <!-- Programme Profile, PEO records, and PLO records -->
  </section>
  <section v-if="researchCategory === 'mapping'" class="research-panel">
    <!-- PLO Workspace, Coverage Matrix, and Review & Submit -->
  </section>
</div>
```

The actual template must include labeled fields for every approved profile field, PEO parent records, PLO `parentPEO`, statement, multiple MQF domains, Taxonomy, rationale, SDG selections, SC selections, derived TF label, PEO roll-up, validation alerts, coverage metrics, and submission actions. Do not carry over the legacy `embeddedPEO` or single `mqfDomain` controls.

- [ ] **Step 4: Replace client state and methods with research state.**

Remove legacy detail state/methods that call `getPEOsApi`, `getPLOsApi`, `savePEOsApi`, and `savePLOsApi`. Add state shaped like:

```js
researchCategory: 'information',
researchPanel: 'profile',
researchProfile: null,
researchPEOs: [],
researchPLOs: [],
researchMappings: {},
researchReferences: null,
researchCoverage: null,
researchReview: null,
researchStatus: 'Draft',
researchDirty: false,
researchSaveState: 'clean'
```

Add methods `loadResearchWorkspace`, `saveResearchProfile`, `saveResearchPEOs`, `saveResearchPLOs`, `saveResearchPLOMapping`, `loadResearchCoverage`, `loadResearchReview`, `submitResearchProgramme`, `selectAllMQFDomains`, `toggleSDG`, `toggleSC`, and `leaveResearchWorkspace`. Every mutation refreshes derived TF, coverage, and review from the server.

- [ ] **Step 5: Replace CSS for compact, responsive research editing.**

Add styles for the two-category tab bar, programme context, profile field grid, PEO parent cards, compact PLO rows, multi-select reference controls, `derived` badges, coverage matrix, issue severity, review status, save state, and mobile stacking. Keep the existing Operational Clarity tokens and ensure the 390px viewport does not require horizontal scrolling.

- [ ] **Step 6: Run syntax and static UI checks.**

Extract the JavaScript body from `gas/JavaScript.html` and run it through `new Function(...)`. Then run:

```bash
node scripts/verify-mqf-rebuild.js
git diff --check
```

Expected: JavaScript syntax passes, required two-category markers pass, and course-based detail markers are absent.

- [ ] **Step 7: Commit the workspace UI.**

```bash
git add gas/Index.html gas/JavaScript.html gas/Styles.html scripts/verify-mqf-rebuild.js
git commit -m "feat: replace UI with research mapping workspace"
```

## Task 6: Add Mapping Matrix And Coverage

**Files:**
- Modify: `gas/Index.html`
- Modify: `gas/JavaScript.html`
- Modify: `gas/Styles.html`
- Modify: `scripts/test-research-mapping.js`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: `getResearchCoverageApi_`, research PLO/mapping data, and the research reference tables.
- Produces: matrix cells for MQF domains, derived TF display, SDG/SC coverage, and PEO roll-up. The research workspace does not include a graph or document panel.

- [ ] **Step 1: Add RED tests for matrix projection.**

```js
assert.deepStrictEqual(projectMappingMatrixRow_({
  code: 'PLO1', mqfDomains: ['MQF2', 'MQF3d'], derivedTFIds: ['TF2'], sdgIds: ['SDG4'], scIds: ['SC2']
}), {
  code: 'PLO1', mqf: {MQF2: true, MQF3d: true}, tf: ['TF2'], sdg: ['SDG4'], sc: ['SC2']
});
```

- [ ] **Step 2: Run the test and confirm the expected RED failure.**

Run: `node scripts/test-research-mapping.js`

Expected: FAIL because matrix projection is not implemented.

- [ ] **Step 3: Implement matrix projection.**

Render columns `MQF1`, `MQF2`, `MQF3a`, `MQF3b`, `MQF3c`, `MQF3d`, `MQF3e`, `MQF3f`, `MQF4a`, `MQF4b`, and `MQF5`. A checked cell means the PLO explicitly selected that MQF domain. TF cells are read-only derived indicators. SDG and SC coverage are shown in separate columns or panels.

Do not add graph or document panels to the research workspace. The two-category boundary is intentional: audit users use the Coverage Matrix and Review panels instead of a graph. Existing guarded graph/document services remain outside the new research navigation and are not called by research APIs.

- [ ] **Step 4: Add accessible matrix and coverage UI.**

Use table headers, row labels, accessible checked indicators, a legend distinguishing `Explicit PLO mapping` from `TF derived from MQF mapping`, and responsive horizontal scrolling only inside the matrix container. Keep the daily PLO editor as the default and make the matrix read-oriented.

- [ ] **Step 5: Run tests and static checks.**

Run: `node scripts/test-research-mapping.js && node scripts/verify-mqf-rebuild.js && git diff --check`

Expected: PASS for matrix projection, accessible labels, and no legacy field usage.

- [ ] **Step 6: Commit mapping views.**

```bash
git add gas/Index.html gas/JavaScript.html gas/Styles.html scripts/test-research-mapping.js scripts/verify-mqf-rebuild.js
git commit -m "feat: add PLO mapping matrix and coverage views"
```

## Task 7: Remove Course-Based Exposure And Update Documentation

**Files:**
- Modify: `gas/Code.gs`
- Modify: `gas/Index.html`
- Modify: `gas/JavaScript.html`
- Modify: `README.md`
- Modify: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Consumes: completed research APIs and client workspace.
- Produces: a portal whose public application path cannot expose course-based workflows, graph panels, or document panels in the research workspace, while retaining only explicitly approved secure administration operations.

- [ ] **Step 1: Add RED assertions for forbidden course exposure.**

Require the verifier to fail if the new application path contains `Coursework`, `CLO`, `creditHour`, `credit hour`, `Subject`, `Course`, `DCI`, `embeddedPEO`, or legacy single `mqfDomain` controls in the research detail source. Exempt the migration documentation and the explicitly ignored legacy source files only where the verifier can scope the assertion to the new research service/detail block.

- [ ] **Step 2: Run the verifier and confirm the current exposure is detected.**

Run: `node scripts/verify-mqf-rebuild.js`

Expected: FAIL against the current legacy detail template or forbidden legacy calls.

- [ ] **Step 3: Remove public course-based exposure without destructive data operations.**

Remove legacy course-oriented UI and route usage from the application path. Keep old production Sheet rows untouched. Do not add a hidden course module, compatibility UI, or automatic conversion. Keep only secure admin and access functions that serve the approved postgraduate workflow; do not expose document or graph panels in the research workspace.

- [ ] **Step 4: Update README with the migration boundary.**

Document:

```text
New model: ProgrammeProfile → PEO/PLO/MQF/Taxonomy → PLO mappings → TF/SDG/SC
TF: derived from MQF reference relationships
PEO: derived from child PLO mappings
Course-based production data: not transformed or deleted automatically
Deployment: no clasp push/deploy in local implementation verification
```

Do not include secrets, real IDs, email recipients, or deployment-sensitive values.

- [ ] **Step 5: Run full static verification and commit.**

Run: `node scripts/verify-mqf-rebuild.js && node scripts/test-research-mapping.js && git diff --check`

Commit:

```bash
git add gas/Code.gs gas/Index.html gas/JavaScript.html README.md scripts/verify-mqf-rebuild.js
git commit -m "docs: remove course-based research portal exposure"
```

## Task 8: Full Verification And Deployment Readiness

**Files:**
- Modify: `scripts/verify-mqf-rebuild.js` only if a discovered verification gap requires it.
- Modify: `README.md` only if verification or manual test instructions are incomplete.
- Do not modify: `gas/Config.gs`, `gas/.clasp.json`, or production data.

**Interfaces:**
- Consumes: all completed research services, UI templates, static tests, and existing security/deadline checks.
- Produces: verified local source and a deployment-readiness report; no production deployment.

- [ ] **Step 1: Run all available automated checks.**

Run each command independently and record the result:

```bash
node scripts/verify-mqf-rebuild.js
node scripts/test-research-mapping.js
node scripts/test-mqf-overdue.js
node -e "const fs=require('fs'); const s=fs.readFileSync('gas/JavaScript.html','utf8').replace(/^<script>\\s*/,'').replace(/\\s*<\\/script>\\s*$/,''); new Function(s); console.log('JavaScript syntax passed');"
node -e "JSON.parse(require('fs').readFileSync('gas/appsscript.json','utf8')); console.log('Manifest JSON passed');"
git diff --check
git check-ignore -v gas/Config.gs gas/.clasp.json
git ls-files gas/Config.gs gas/.clasp.json
```

Expected: all tests/checks pass; `git ls-files` prints no secret paths; `git check-ignore` confirms both paths are ignored.

- [ ] **Step 2: Run source syntax checks for every GAS file and HTML template.**

For each `.gs` file, run `new Function(source)`. For `JavaScript.html`, extract the script body before compiling. For `Index.html` and `Styles.html`, verify included template markers and run `git diff --check`; do not execute production services.

- [ ] **Step 3: Perform local browser verification without deployment.**

Use a local/static harness or the existing deployment only for read-only inspection if explicitly available. Verify at desktop and 390px widths:

```text
Login → Dashboard → Programme → Maklumat Program → Pemetaan → Review
PEO parent → child PLO relationship
MQF multi-select → derived TF refresh
SDG/SC multi-select → PEO roll-up refresh
Coverage Matrix → horizontal containment and accessible headers
Invalid PLO → non-blocking warning or critical submit blocker as specified
Unsaved changes → navigation warning
```

Do not submit, upload, delete, approve, send email, or modify production data during this check.

- [ ] **Step 4: Inspect final repository state.**

Run:

```bash
git status --short
git diff HEAD~1 --stat
git log --oneline -10
```

Confirm only intended implementation/docs files are changed and pre-existing `.DS_Store` files remain untouched.

- [ ] **Step 5: Commit only verification-script or documentation corrections, if any.**

If no correction is needed, do not create an empty commit. If a correction is needed:

```bash
git add scripts/verify-mqf-rebuild.js README.md
git commit -m "test: verify postgraduate research mapping readiness"
```

- [ ] **Step 6: Report deployment readiness without deploying.**

Report automated results, browser results, files changed, known risks, manual production actions required, and explicitly state that `clasp push`/`clasp deploy` was not run.

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 cover the two-category data boundary and profile/PEO/PLO model; Task 3 covers MQF-to-TF derivation and PEO roll-up; Task 4 covers validation, coverage, status, governance, and server-side submission; Tasks 5–6 cover the PLO workspace, matrix, responsive UI, and graph boundary; Task 7 covers complete course-based removal and documentation; Task 8 covers security, syntax, regression, browser, and deployment-readiness verification.
- **Placeholder scan:** No task uses an unspecified implementation placeholder. Every task includes concrete files, interfaces, commands, expected outcomes, and commit scope.
- **Type consistency:** `programmeId` is the existing MQA code; `PeoId` and `PloId` are generated IDs; `mqfDomains`, `sdgIds`, `scIds`, and `derivedTFIds` are arrays at API level and JSON strings only in Sheets; `getResearchReviewApi_` owns status/metrics; `getResearchCoverageApi_` owns mapping coverage.
- **Security check:** All research detail/mutation wrappers require `requireProgrammeAccess_`; server-derived TF and PEO roll-up are recomputed from stored data; no secret files or production operations are included.
