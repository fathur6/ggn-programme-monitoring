# MQF 2.0 Interface Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MQF 2.0 application as a guided university programme-governance workspace while preserving existing Sheet/Drive data and enforcing faculty, Graduate School, aggregate, and temporary cross-faculty access rules.

**Architecture:** Keep Google Apps Script services and the existing per-programme Sheet layout as the persistence boundary. Add a server-side authorization/reporting layer and additive governance sheets, then replace the Vue 2 presentation with a persistent shell, guided PEO/PLO editor, university status dashboard, review surface, graph, documents, admin, and access-request views. Existing PEO/PLO and Drive service contracts remain available through compatibility wrappers while new APIs return explicit view models.

**Tech Stack:** Google Apps Script server-side JavaScript, HtmlService templates, Vue 2.7.14, existing `google.script.run` bridge, existing vis-network graph, Google Sheets, Google Drive, OAuth/session lookup.

## Global Constraints

- Preserve current Google Sheet columns and stored values.
- Preserve Drive folder behavior and supporting-document conventions.
- Preserve service function contracts wherever possible.
- Faculty users can view and edit only their own faculty's programme content.
- UniSZA Graduate School administrators have unrestricted access to all faculty programme content and governance workflows.
- University-wide users see aggregate/status information by default, not unauthorized programme detail.
- Approved cross-faculty access is limited to the requested scope and expires automatically after one week.
- MQF Domain and Taxonomy are monitored PLO data and participate in validation, reporting, and graph relationships.
- Interface language is English.
- Do not introduce a new frontend framework, external backend, or Sheet/database migration.
- Do not commit `gas/Config.gs` or `gas/.clasp.json`.

## File Map

- Modify `gas/Auth.gs`: normalize user capabilities and server-side authorization helpers.
- Modify `gas/Code.gs`: expose guarded compatibility APIs, dashboard APIs, governance APIs, and access-request APIs.
- Modify `gas/ProgrammeService.gs`: produce faculty-scoped detail lists and university status summaries.
- Modify `gas/PEOService.gs`: guard programme access and preserve stable PEO codes.
- Modify `gas/PLOService.gs`: guard programme access and preserve description, MQF Domain, Taxonomy, and PEO mapping fields.
- Modify `gas/GraphService.gs`: guard detail access and expose PLO Taxonomy relationships.
- Modify `gas/UploadService.gs`: enforce detail/document authorization and preserve Drive operations.
- Modify `gas/SuggestionsService.gs`: retain admin approval behavior while using explicit authorization checks.
- Create `gas/GovernanceService.gs`: additive programme status, revision, audit, and central-request storage and APIs.
- Create `gas/AccessRequestService.gs`: one-week cross-faculty access request, approval, expiry, and revocation behavior.
- Replace `gas/Index.html`: persistent shell, dashboard, guided workspace, review, graph, documents, admin, and access-request views.
- Replace `gas/JavaScript.html`: Vue state, view models, guarded API calls, editor workflow, validation, dirty-state protection, and responsive interactions.
- Replace `gas/Styles.html`: Operational Clarity tokens, shell layout, status states, compact record rows, responsive editor, and accessible controls.
- Create `scripts/verify-mqf-rebuild.js`: repository-level static checks for required files, API names, ignored secrets, and forbidden generated artifacts.
- Modify `README.md`: document new roles, dashboard behavior, governance sheets, local verification, and deployment cautions.

---

### Task 1: Establish Server-Side Capability Model

**Files:**
- Modify: `gas/Auth.gs`
- Modify: `gas/Code.gs`
- Test: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Produces `getCurrentUser()` with `role`, `faculty`, `email`, `name`, and a normalized `capabilities` object.
- Produces `isGraduateSchoolAdmin_(user)` returning a boolean.
- Produces `canViewProgramme_(user, mqaCode, optAccess)` returning a boolean.
- Produces `requireProgrammeAccess_(mqaCode, action)` throwing `Unauthorized` or `Forbidden` errors before detail reads/writes.
- Produces `getAuthorizedProgrammeScope_()` returning `{ mode: 'faculty'|'university'|'graduate-school', faculty, email }`.

- [ ] **Step 1: Write static failing checks**

Add assertions to `scripts/verify-mqf-rebuild.js` that fail until `Auth.gs` and `Code.gs` contain capability normalization, a Graduate School admin check, and guarded detail endpoints.

- [ ] **Step 2: Run the checks to verify they fail**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: FAIL identifying missing authorization helpers or guarded endpoints.

- [ ] **Step 3: Implement the capability model**

Keep existing PPS users as unrestricted Graduate School administrators. Keep PIC-derived faculty roles scoped to `user.faculty`. Add a normalized capability object without changing existing role strings:

```javascript
function isGraduateSchoolAdmin_(user) {
  return !!user && user.role === 'Admin';
}

function canViewProgramme_(user, mqaCode, optAccess) {
  if (!user || !mqaCode) return false;
  if (isGraduateSchoolAdmin_(user)) return true;
  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme) return false;
  if (programme.faculty === String(user.faculty || '').trim()) return true;
  return !!optAccess && optAccess.email === user.email &&
    optAccess.mqaCode === mqaCode && new Date(optAccess.expiresAt).getTime() > Date.now();
}

function requireProgrammeAccess_(mqaCode, action) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  var access = getActiveAccessGrant_(user.email, mqaCode);
  if (!canViewProgramme_(user, mqaCode, access)) {
    throw new Error('Forbidden: programme access is outside your authorized scope');
  }
  return { user: user, action: action || 'view', access: access };
}
```

Add `findProgrammeByMqaCode_` using the existing `Programme` columns. Do not trust a client-provided faculty value.

- [ ] **Step 4: Guard every programme detail API**

Call `requireProgrammeAccess_(mqaCode, action)` in `getPEOsApi`, `savePEOsApi`, `getPLOsApi`, `savePLOsApi`, `getGraphDataApi`, `getUploadedFilesApi`, `uploadFileApi`, and `suggestDeleteFileApi`. Keep `approveDeleteFileApi` Graduate School-admin-only.

- [ ] **Step 5: Run checks and commit**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for capability helpers and all detail endpoint guards.

```bash
git add gas/Auth.gs gas/Code.gs scripts/verify-mqf-rebuild.js
git commit -m "feat: enforce programme access scope"
```

### Task 2: Add University Status And Governance Services

**Files:**
- Create: `gas/GovernanceService.gs`
- Modify: `gas/ProgrammeService.gs`
- Modify: `gas/Code.gs`
- Test: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Produces `getUniversityDashboardApi()` returning aggregate faculty/programme status only.
- Produces `getProgrammeStatusApi(mqaCode)` returning detail status only when authorized.
- Produces `saveProgrammeStatusApi(mqaCode, status)` for Graduate School admins or explicitly authorized programme editors.
- Produces `getGovernanceItemsApi(filters)` and `saveGovernanceItemApi(item)` for revisions, audits, and central requests.
- Produces `getFacultyReportApi(faculty)` returning status-only faculty reporting data.

- [ ] **Step 1: Define additive sheet schemas**

Implement `ensureGovernanceSheets_()` with these headers, creating sheets only when needed:

```javascript
['ProgrammeStatus', 'MQACode', 'Faculty', 'CompletionState', 'PEOState', 'PLOState',
 'MQFDomainState', 'TaxonomyState', 'MappingState', 'DocumentState', 'ReviewState',
 'SubmissionState', 'LastUpdated', 'ReportingPeriod', 'UpdatedBy']
['GovernanceItems', 'ItemId', 'MQACode', 'Faculty', 'Type', 'Title', 'Description',
 'Status', 'OwnerEmail', 'DueDate', 'CreatedAt', 'UpdatedAt', 'UpdatedBy']
['AccessRequests', 'RequestId', 'RequesterEmail', 'RequesterFaculty', 'TargetFaculty',
 'MQACode', 'Reason', 'Scope', 'RequestedAt', 'Status', 'ApproverEmail',
 'ApprovedAt', 'ExpiresAt', 'RevokedAt', 'DecisionNote']
```

Do not alter existing `Programme` or per-programme sheets.

- [ ] **Step 2: Implement status computation**

Read PEO/PLO data through existing services and calculate booleans/counts for description, MQF Domain, Taxonomy, embedded PEO mapping, documents, review, and submission. Return aggregate objects that contain no descriptions, document IDs, email addresses, or other detailed programme content.

- [ ] **Step 3: Implement reporting APIs**

`getUniversityDashboardApi()` must return faculty-level and university-level counts across all 14 faculties. It may include programme name/MQA code only for Graduate School admins. For all other users, rows must be status-only. `getProgrammeStatusApi(mqaCode)` must call `requireProgrammeAccess_`.

- [ ] **Step 4: Implement revisions, audits, and central requests**

Use generated IDs and LockService for writes. Validate `Type` against `Revision`, `Audit`, and `Administration Request`; validate `Status` against `Open`, `In Progress`, `Blocked`, `Complete`, and `Closed`. Include owner and due date so overdue items can be reported.

- [ ] **Step 5: Run static checks and commit**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for additive sheets, aggregate API, status fields, governance types, and no edits to existing Sheet schemas.

```bash
git add gas/GovernanceService.gs gas/ProgrammeService.gs gas/Code.gs scripts/verify-mqf-rebuild.js
git commit -m "feat: add university status governance APIs"
```

### Task 3: Implement Temporary Cross-Faculty Access

**Files:**
- Create: `gas/AccessRequestService.gs`
- Modify: `gas/Code.gs`
- Modify: `gas/Auth.gs`
- Test: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Produces `createAccessRequestApi(request)`.
- Produces `getAccessRequestsApi(filters)`.
- Produces `decideAccessRequestApi(requestId, decision, note)`.
- Produces `revokeAccessGrantApi(requestId, note)`.
- Produces `getActiveAccessGrant_(email, mqaCode)` for server-side checks.

- [ ] **Step 1: Add failing static checks**

Assert that the new service contains one-week expiry logic, request/approval/rejection/revocation APIs, and that `canViewProgramme_` consults active grants.

- [ ] **Step 2: Implement request creation**

Allow a non-admin authenticated faculty user to request a target faculty or exact MQA code, a reason, and a requested scope. Store `RequestedAt`; reject blank reasons, missing targets, and requests made for the user's own faculty.

- [ ] **Step 3: Implement approval and expiry**

Only Graduate School admins may approve, reject, or revoke. On approval set `ApprovedAt` and `ExpiresAt` to exactly seven days after approval. Recheck expiry on every detail request; do not rely on a scheduled cleanup job for authorization.

- [ ] **Step 4: Add safe response shaping**

Faculty requesters may see their own request status and expiry, but not other users' private notes. Graduate School admins may see all request records. Return no access token to the browser.

- [ ] **Step 5: Run checks and commit**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for one-week expiry, role guards, and grant lookup.

```bash
git add gas/AccessRequestService.gs gas/Code.gs gas/Auth.gs scripts/verify-mqf-rebuild.js
git commit -m "feat: add temporary cross-faculty access"
```

### Task 4: Harden Existing PEO, PLO, Graph, And Document Services

**Files:**
- Modify: `gas/PEOService.gs`
- Modify: `gas/PLOService.gs`
- Modify: `gas/GraphService.gs`
- Modify: `gas/UploadService.gs`
- Modify: `gas/SuggestionsService.gs`
- Test: `scripts/verify-mqf-rebuild.js`

**Interfaces:**
- Existing `getPEOs`, `savePEOs`, `getPLOs`, `savePLOs`, `getGraphData`, upload, and suggestion functions retain their signatures.
- `getGraphData` additionally emits `Taxonomy` nodes/edges where PLO taxonomy exists.

- [ ] **Step 1: Add static checks for stable fields**

Assert that PLO persistence still maps `[code, description, mqfDomain, embeddedPEO, taxonomy]` and that GraphService emits PEO/PLO/MQF Domain/Taxonomy relationship types.

- [ ] **Step 2: Fix stable code generation at the client/service boundary**

Add a shared `nextRecordCode_(records, prefix)` helper or equivalent logic that finds the highest numeric suffix for the prefix. Existing codes remain unchanged; removing `PLO2` then adding a record creates the next unused code rather than reusing an array length.

- [ ] **Step 3: Preserve and validate PLO metadata**

Reject malformed payloads where code or description is absent. Keep blank MQF Domain, Taxonomy, and mapping values readable for drafts, but expose validation state to the frontend.

- [ ] **Step 4: Enforce document and suggestion roles**

Require programme access for listing/uploading/requesting deletion. Require Graduate School admin capability for actual deletion, programme approval, spreadsheet preparation, and pending approval operations.

- [ ] **Step 5: Run checks and commit**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for field order, stable code logic, graph relationships, and role guards.

```bash
git add gas/PEOService.gs gas/PLOService.gs gas/GraphService.gs gas/UploadService.gs gas/SuggestionsService.gs scripts/verify-mqf-rebuild.js
git commit -m "fix: harden MQF record and document access"
```

### Task 5: Build The Persistent Application Shell And University Dashboard

**Files:**
- Replace: `gas/Index.html`
- Replace: `gas/JavaScript.html`
- Replace: `gas/Styles.html`

**Interfaces:**
- Consumes `getUniversityDashboardApi`, `getProgrammesApi`, `getFacultyReportApi`, `getAccessRequestsApi`, and the existing detail APIs.
- Produces Vue state fields `currentView`, `dashboard`, `selectedFaculty`, `programmeFilters`, `workspaceStep`, `saveState`, `dirty`, and `permissionState`.

- [ ] **Step 1: Create the shell markup**

Replace the current single list/detail layout with a header, responsive navigation rail, main content region, programme context bar, step progress, toast/live status region, and modal host. Keep the OAuth/login template variables and `<?!= include(...) ?>` structure intact.

- [ ] **Step 2: Create dashboard markup**

Render university aggregate cards and a faculty status table for all users. Show only status fields to non-admin users. For Graduate School admins, add drill-down controls into faculty and programme details. Include filters for faculty, programme level, completion state, revision/audit state, and overdue items.

- [ ] **Step 3: Implement dashboard loading and view transitions**

Load the aggregate dashboard on mount, preserve loading/error/empty states, and prevent unauthorized users from constructing detail routes from status-only rows. Programme selection must call a guarded detail API and handle `Forbidden` explicitly.

- [ ] **Step 4: Implement Operational Clarity styles**

Replace the current warm-stone/coral tokens with slate-neutral surfaces, white cards, green completion states, amber warnings, and red destructive states. Add responsive breakpoints for a collapsible rail, single-column content, sticky progress/actions, keyboard focus, and minimum touch targets.

- [ ] **Step 5: Run static checks and inspect the UI**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for shell IDs, dashboard IDs, status labels, and no old duplicate Save/Remove-only interface markers.

Use the browser to inspect desktop and 390px mobile layouts. Expected: dashboard content fits the viewport, programme identity remains visible, and status-only rows do not expose detail text.

- [ ] **Step 6: Commit**

```bash
git add gas/Index.html gas/JavaScript.html gas/Styles.html scripts/verify-mqf-rebuild.js
git commit -m "feat: rebuild MQF application shell"
```

### Task 6: Build Guided PEO/PLO Workspace And Review

**Files:**
- Modify: `gas/Index.html`
- Modify: `gas/JavaScript.html`
- Modify: `gas/Styles.html`

**Interfaces:**
- Consumes existing PEO/PLO API response shapes: PEO `{ code, description, mqfDomain }`; PLO `{ code, description, mqfDomain, embeddedPEO, taxonomy }`.
- Produces `validatePEOs()`, `validatePLOs()`, `getReviewSummary()`, `saveCurrentStep()`, `goToStep(step)`, `addRecord(prefix)`, and `removeRecord(record, prefix)`.

- [ ] **Step 1: Add validation logic**

Implement deterministic client validation:

```javascript
function validatePLOs() {
  return this.plos.map(function(plo) {
    return {
      code: plo.code,
      missing: [].concat(
        plo.description ? [] : ['description'],
        plo.mqfDomain ? [] : ['MQF Domain'],
        plo.taxonomy ? [] : ['Taxonomy'],
        plo.embeddedPEO ? [] : ['PEO mapping']
      )
    };
  });
}
```

Expose missing metadata in the row summary and review totals. PEO descriptions remain required for completion.

- [ ] **Step 2: Implement one-active-editor interaction**

Render saved records as compact rows and one expanded active editor. Include explicit labels, character guidance, field-level messages, visible MQF Domain and Taxonomy badges, and mapping summaries.

- [ ] **Step 3: Implement stable add/remove behavior**

Generate codes from the highest existing numeric suffix. Confirm context-specific removal, retain a one-action undo snapshot in local Vue state, and mark the workspace dirty after any edit.

- [ ] **Step 4: Implement save state and navigation guards**

Track `clean`, `dirty`, `saving`, `saved`, and `error` states per step. Preserve local edits after failures. Before leaving a dirty programme or switching programmes, show a confirmation dialog. `Previous` and `Next` must save/validate as specified by the step.

- [ ] **Step 5: Implement review**

Show PEO/PLO counts, missing descriptions, MQF Domain coverage, Taxonomy coverage, mapping coverage, document state, revision/audit state, and blocking conditions. Only Graduate School admins or the defined authorized submission role may perform final central submission actions.

- [ ] **Step 6: Run checks and browser verification**

Run: `node scripts/verify-mqf-rebuild.js`
Expected: PASS for validation methods and MQF metadata labels.

Browser checks: add/remove records, remove a middle code and add another, trigger validation, fail a save if possible, resize to 390px, and verify dirty navigation protection.

- [ ] **Step 7: Commit**

```bash
git add gas/Index.html gas/JavaScript.html gas/Styles.html scripts/verify-mqf-rebuild.js
git commit -m "feat: add guided PEO and PLO workflow"
```

### Task 7: Integrate Graph, Documents, Admin, And Access Requests

**Files:**
- Modify: `gas/Index.html`
- Modify: `gas/JavaScript.html`
- Modify: `gas/Styles.html`

**Interfaces:**
- Consumes graph, Drive, pending approval, governance, and access-request APIs.
- Produces role-aware views for Graph, Documents, Admin, Governance, and Access Requests.

- [ ] **Step 1: Add graph view**

Keep vis-network and the existing graph container, but add filters/toggles for Programme, PEO, PLO, MQF Domain, and Taxonomy. Add a legend and relationship explanation. Handle empty and permission states.

- [ ] **Step 2: Add document workspace**

Retain upload, preview, and role-sensitive deletion. Add document readiness status and pending deletion state. Use English messages consistently and prevent duplicate uploads while a request is in progress.

- [ ] **Step 3: Add Graduate School admin workspace**

Render programme approvals, file deletion requests, revisions, audits, central requests, overdue items, spreadsheet preparation, and unrestricted programme drill-down only when `user.role === 'Admin'` or the normalized capability says Graduate School admin.

- [ ] **Step 4: Add access-request workspace**

Faculty users can create and view their own requests. Graduate School admins can filter pending/approved/expired/revoked requests and approve, reject, or revoke. Show exact expiry date and the one-week policy.

- [ ] **Step 5: Run browser checks and commit**

Verify admin-only controls are absent for faculty users, status-only dashboard users cannot open detail, approved access exposes only the approved scope, and expired access returns a permission state.

```bash
git add gas/Index.html gas/JavaScript.html gas/Styles.html
git commit -m "feat: add governance and access request workspaces"
```

### Task 8: Verification, Documentation, And Deployment Readiness

**Files:**
- Modify: `scripts/verify-mqf-rebuild.js`
- Modify: `README.md`
- Test: repository working tree and browser deployment

**Interfaces:**
- Verification script exits `0` only when source, security, and compatibility checks pass.

- [ ] **Step 1: Complete repository static verification**

The script must check:

```javascript
const required = [
  'gas/Index.html', 'gas/JavaScript.html', 'gas/Styles.html',
  'gas/GovernanceService.gs', 'gas/AccessRequestService.gs'
];
for (const file of required) assert(fs.existsSync(file), `Missing ${file}`);
assert(fs.readFileSync('gas/PLOService.gs', 'utf8').includes('taxonomy'));
assert(fs.readFileSync('gas/GraphService.gs', 'utf8').includes('Taxonomy'));
assert(!fs.readFileSync('gas/Code.gs', 'utf8').includes('getPEOsApi(mqaCode) {\n  if (!getCurrentUser())'));
```

Also check `git check-ignore -q gas/Config.gs gas/.clasp.json`, `git ls-files` excludes both secrets, and no `.superpowers`, screenshots, or temporary browser artifacts are added.

- [ ] **Step 2: Run all available checks**

Run:

```bash
node scripts/verify-mqf-rebuild.js
git diff --check
git status --short
```

Expected: static verification passes; only the pre-existing `.DS_Store` files remain untracked.

- [ ] **Step 3: Perform browser acceptance checks**

Test at desktop and 390px mobile widths:

1. Faculty user sees only own-faculty detail and university status aggregates.
2. Graduate School admin sees all faculty aggregates and can drill into any programme.
3. PEO/PLO editing validates descriptions, MQF Domain, Taxonomy, and PEO mapping.
4. Middle-record removal followed by add produces a unique code.
5. Dirty navigation prompts before leaving.
6. Review shows mapping, MQF metadata, document, revision, and audit readiness.
7. Access request approval grants exact one-week scope and expiry blocks detail afterward.
8. Graph and documents remain usable.

- [ ] **Step 4: Update README**

Document local source/deployment commands, role model, university dashboard behavior, additive governance sheets, access-request expiry policy, secret handling, and the static/browser verification commands. Do not document or print secret values.

- [ ] **Step 5: Commit final documentation and verification**

```bash
git add scripts/verify-mqf-rebuild.js README.md
git commit -m "docs: document MQF governance workflow"
```

## Plan Self-Review

- **Spec coverage:** Information architecture is covered by Tasks 5-7; faculty/admin/aggregate/temporary access is covered by Tasks 1-3 and 7; PEO/PLO/MQF Domain/Taxonomy behavior is covered by Tasks 4 and 6; graph/documents/admin are covered by Task 7; revisions/audits/requests are covered by Tasks 2, 3, and 7; acceptance and verification are covered by Task 8.
- **Compatibility:** Existing programme and per-programme Sheet columns are not migrated. Existing service signatures remain available. New governance sheets are additive.
- **Security:** Detail APIs are guarded before UI work. Aggregate responses are shaped separately from detail responses. Temporary access is checked server-side on every detail request and expires after seven days.
- **Placeholder scan:** No unfinished placeholder or unspecified implementation step is used.
- **Known verification limit:** Google Apps Script functions cannot be fully executed by local Node without the Apps Script runtime; static checks and authenticated browser acceptance checks are required for final confidence.
