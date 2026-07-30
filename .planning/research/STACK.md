# Technology Stack

**Project:** GGN Academic Management — Assessment Mapping increment  
**Researched:** 2026-07-30  
**Scope:** Brownfield stack and integration constraints for the new `Pemetaan Pentaksiran` tab

## Confidence and evidence convention

- **HIGH:** directly observed in the live repository and/or exercised by the repository's local checks.
- **LOW:** official documentation fetched through the available web-fetch seam; use it as supporting guidance, while the repository is the authority for compatibility decisions.
- Recommendations are explicitly labelled. No new API or spreadsheet payload shape below is presented as an existing fact.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Google Apps Script web app + HtmlService | Existing project; V8 | Server entry point, authenticated web UI, and Google service access | **Observed (HIGH):** `gas/appsscript.json` sets `runtimeVersion` to `V8`, `executeAs` to `USER_DEPLOYING`, and domain access. `gas/Code.gs:doGet` creates an `Index` template, injects session/OAuth values, and returns an HtmlService output. Preserve this deployment model; do not introduce a separate web server. |
| Vue.js via CDN | 2.7.14 | Single-page state/rendering layer inside the existing HTML template | **Observed (HIGH):** `gas/Index.html:238` loads `https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.min.js`; `gas/JavaScript.html:initVueApp` creates one `new Vue({ el: '#app' })`. Add Assessment Mapping to this instance rather than introducing Vue CLI, SFCs, Vuex, or a second app. |
| Plain JavaScript in HTML partials | Existing style | Client behavior and Vue methods | **Observed (HIGH):** all client code is in `gas/JavaScript.html`, included by `gas/Index.html:239`; there is no package manifest, bundler, TypeScript, or module boundary. Keep ES5-compatible browser code and the existing function/method style even though the server manifest uses V8. |

### Database / Persistence

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Google Sheets through `SpreadsheetApp` | Existing project | Programme records, additive research records, references, audit timestamps | **Observed (HIGH):** `gas/Auth.gs:getSpreadsheet` opens `CONFIG.SHEET_ID` with an active-spreadsheet fallback. `gas/ResearchDataService.gs:RESEARCH_SHEET_HEADERS` defines eight additive `PR_*` sheets; `ensureResearchSheets_` lazily creates missing sheets and header rows under a script lock. Assessment data should be additive and programme-scoped, not written into the legacy `Programme` or per-programme detail tabs. |
| Script-wide `LockService` | Existing project | Serialize first-use sheet creation and read-modify-write mutations | **Observed (HIGH):** `ensureResearchSheets_` (`ResearchDataService.gs:16`) and `withResearchLock_` (`ResearchMappingService.gs:247`) use `waitLock(30000)` and release in `finally`. The same pattern is exercised by `scripts/test-research-mapping.js`. **Recommendation:** Assessment reads that normalize or reconcile rows and every Assessment write should use the existing lock helper or an equivalent `try/finally` lock; do not append unguarded concurrent rows. |
| JSON-in-cell columns where a record is multi-valued | Existing research convention | Store arrays such as MQF/reference IDs in Sheets rows | **Observed (HIGH):** `PR_PLORecords.MQFDomainsJson` and `PR_PLOMappings.SDGIdsJson`, `SCIdsJson`, and `DerivedTFIdsJson` are parsed by `parseResearchJson_` and written with `JSON.stringify`. **Recommendation:** use the same convention for any multi-valued Assessment mapping fields, but define exact headers from the approved rubric documents rather than copying PLO fields or inventing a schema. |

### Infrastructure / Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Apps Script V8 | Manifest `V8` | Server-side JavaScript runtime | **Observed (HIGH):** manifest configuration is live. **Official guidance (LOW):** V8 is not Node.js or a browser; server-side standard Web APIs, timers, and ES modules are not portable assumptions. Keep Apps Script service calls (`SpreadsheetApp`, `LockService`, `Utilities`, `Session`) on the server and browser APIs in `JavaScript.html`. |
| `google.script.run` | Apps Script HTML Service bridge | Client-to-server RPC | **Observed (HIGH):** `JavaScript.html` uses `withSuccessHandler`/`withFailureHandler` for every research call. **Official guidance (LOW):** calls are asynchronous, may complete out of order, allow up to ten concurrent calls, and only accept serializable parameters/returns. **Recommendation:** expose one aggregate Assessment workspace read and one bounded save operation where possible, rather than adding a fan-out of independent calls to the existing seven-call workspace load. Always retain explicit success/failure handlers and return plain objects/arrays, not `Date` instances. |
| Apps Script manifest | Existing `appsscript.json` | Runtime and web-app deployment contract | **Observed (HIGH):** time zone is `Asia/Singapore`, exception logging is `STACKDRIVER`, and the web app is domain-restricted. Do not alter the manifest for this tab. |
| `@google/clasp` | Local CLI 3.3.0 observed; repository documents global install | Optional authenticated sync/deployment tool | **Observed (HIGH):** `README.md:34-51` documents `clasp`, but explicitly excludes `clasp push` and `clasp deploy` from local verification. `gas/.clasp.json` is the deployment mapping used when operating from `gas/`; the root `.clasp.json` is a separate local mapping and must not be “fixed” as part of this increment. Do not print or modify either mapping. |

### Supporting Libraries / Conventions

| Library or convention | Version | Purpose | When to use |
|-----------------------|---------|---------|-------------|
| Existing `ResearchDataService.gs` helpers | Existing | Sheet headers, lazy creation, programme key | Reuse `RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_`, and `getResearchProgrammeKey_` conceptually. **Recommendation:** add Assessment sheet headers in an additive Assessment service; do not expand existing PLO sheets with Assessment columns. |
| Existing `ResearchReferenceService.gs` | Existing | Canonical MQF/TF/SDG/SC reference access and validation | Reuse `getResearchReferences_`, `getResearchReferenceList_`, `validateReferenceIds_`, and the seeded reference tables. Assessment should consume canonical server reference codes and existing MQF → TF authority; do not create a second TF mapping table in the client. |
| Existing `ResearchMappingService.gs` | Existing | Programme resolution, normalization, identity, locking, and current PLO persistence | Reuse private cross-file helpers such as `researchContext_`, `researchProgramme_`, `withResearchLock_`, `uniqueTrimmed_`, `deriveTFIds_`, `serializeResearchDate_`, and `researchUser_`. Keep Assessment persistence in a separate bounded service so the current PLO/PEO API and row replacement behavior remain regression-compatible. |
| Existing authorization helpers | Existing | Faculty/admin and temporary programme access | Every Assessment server entry point must call `requireProgrammeAccess_` or the research-specific guard before reading or writing. `Auth.gs:canViewProgramme_` resolves composite `programmeId` identities, while `requireProgrammeAccess_` applies faculty/admin and temporary-grant rules. |
| Existing CSS tokens and cards | Existing | Visual and responsive consistency | Extend `gas/Styles.html` using existing tokens (`--ink`, `--canvas`, `--canvas-muted`, `--hairline`, `--action-blue`, `--action-green`, `--action-amber`, `--action-red`) and primitives such as `.card-bordered`, `.panel-heading`, `.mapping-grid`, `.reference-option`, `.status-chip`, and `.matrix-wrap`. Reuse the `@media (max-width: 760px)` single-column behavior. |

## Smallest Compatible Approach

### Backend boundary (recommendation)

Add one additive `gas/ResearchAssessmentService.gs` rather than turning `ResearchMappingService.gs` into a general-purpose assessment repository. The service should:

1. Reuse `resolveProgramme_`/`researchProgramme_`, `getResearchProgrammeKey_`, `researchContext_`, `ensureResearchSheets_`, `withResearchLock_`, `researchUser_`, reference loading, and the existing `serializeResearchDate_`/normalization style.
2. Store PPS seed definitions separately from programme-specific faculty alignment so the baseline is never overwritten. A minimal conceptual split is an immutable seed/definition layer and a programme override/alignment layer; exact sheet names, headers, and DTO fields must be taken from the approved JAPSU documents and the feature specification, not fabricated here.
3. Expose only public wrappers in `gas/Code.gs`, with private implementations ending in `_`. Existing wrappers at `Code.gs:139-150` are the pattern; private service functions are not callable by `google.script.run`.
4. Prefer a bounded `get...Assessment...Api(programmeId)` workspace read and `save...Assessment...Api(programmeId, payload)` mutation (names are recommendations, not observed APIs). The read can return definitions, active programme alignment, provenance, and review information together; the save can validate the whole submitted Assessment payload under one lock. This avoids race-prone multi-call reconciliation while staying inside the existing RPC architecture.
5. Validate programme identity and study level on the server. `ProgrammeService.gs:78-98` supplies the composite `faculty::progCode::mqaCode` identity and `resolveProgramme_`; `ProgrammeService.gs:isResearchProgramme_` and `ResearchMappingService.gs:90-99` are the existing research guards. Do not trust a client-supplied Master/PhD profile or MQA code alone when duplicate MQA codes are possible.
6. Reuse `validateReferenceIds_` and `deriveTFIds_` for MQF/TF fields. The existing TF reference seed (`ResearchReferenceService.gs:17-21`) and `ResearchMappingService.gs:33-40` are the current authority. Assessment must not add SDG fields or alter the current PLO mapping rule set; SDG remains in the existing Pemetaan flow.

### Client boundary (recommendation)

Extend the existing `researchCategory` state and tablist in `gas/Index.html:189-230` with a third tab/panel. Update `handleResearchCategoryKeydown` in `JavaScript.html:697-713` from its current two-category array to the three actual categories and preserve roving `tabindex`, `aria-selected`, `role="tab"`, and `role="tabpanel"` semantics.

Declare all new root-level Assessment state in the existing Vue `data` object near `researchProfile`, `researchMappings`, `researchCoverage`, and `researchReview` (`JavaScript.html:207-220`). Vue 2 requires root properties to exist at initialization; use `this.$set` for new keys in nested objects, as the current `researchMapping` and `facultyDetails` methods already do. Use `push`/`splice` or `$set` for array changes; do not assign array indices directly.

Keep Assessment interactions in the established method pattern: set `researchLoading`/`researchSaveState`, call `google.script.run`, update state in the success handler, route errors through `researchFailure`, call `researchMutationComplete` after a successful save, and refresh server-derived state. Do not create a second Vue instance, client store, fetch layer, or local persistence cache.

## Exact Existing Integration Points to Preserve

| Concern | Existing source and symbols | Preservation rule |
|---------|-----------------------------|-------------------|
| Authentication/session | `Code.gs:doGet`; `Auth.gs:getCurrentUser_`, `decorateUser_`, `getAuthorizedProgrammeScope_` | Keep OAuth/session bootstrapping and the normalized `user.capabilities` object. Assessment UI visibility is not an authorization boundary; server guards remain authoritative. |
| Programme scope | `Auth.gs:requireProgrammeAccess_`, `requireResearchProgrammeAccess_`, `canViewProgramme_`; `ProgrammeService.gs:programmeIdentity_`, `resolveProgramme_` | Pass `currentProgramme.programmeId || currentProgramme.mqaCode` as the client already does. Resolve and authorize again on every server call. |
| Research sheet lifecycle | `ResearchDataService.gs:RESEARCH_SHEET_HEADERS`, `ensureResearchSheets_`, `getResearchProgrammeKey_`; `ResearchMappingService.gs:researchContext_`, `migrateLegacyResearchRows_` | Additive sheets only. Preserve composite identity isolation and legacy migration behavior; do not edit legacy per-programme tabs or existing PLO headers. |
| Reference data | `ResearchReferenceService.gs:RESEARCH_REFERENCE_SEEDS_`, `getResearchReferences_`, `getResearchReferencesApi`, `validateReferenceIds_` | Seed missing approved rows without clearing custom/inactive rows. Preserve active-row validation and canonical code casing. |
| Server validation/review | `ResearchMappingService.gs:normalizeResearchPLO_`, `validateDuplicateCodes_`, `validatePLOParents_`; `ResearchReviewService.gs:validateResearchProgramme_`, `getResearchReviewApi_`, `submitResearchProgrammeApi_` | Assessment-specific rules belong in the new Assessment boundary. Do not weaken or silently reinterpret current PLO review/submission rules; if Assessment affects submission readiness, add an explicit, separately tested review input rather than changing existing metrics implicitly. |
| Client loading and saving | `JavaScript.html:loadResearchWorkspace`, `researchFailure`, `researchMutationComplete`, `saveResearchPLOMapping`; `Index.html` research panels | Preserve dirty-state navigation warnings, loading/error/save feedback, server-returned IDs, and post-save refresh. The current load has `pending = 7`; do not add uncontrolled parallel calls beyond the documented bridge limit. |
| UI language | `Styles.html:.research-tabs`, `.research-subsection`, `.mapping-grid`, `.reference-option`, `.coverage-section`, `.matrix-wrap`, responsive media query | Use existing cards, chips, validation colors, focus treatment, and horizontal overflow containment. Do not create a disconnected CRUD page or new design system. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend service | Additive `ResearchAssessmentService.gs` with narrow public wrappers | Extend `ResearchMappingService.gs` and existing `PR_PLOMappings` | The existing service is explicitly PEO/PLO/mapping scoped; changing its row widths or semantics risks the current mapping tests, legacy migration, TF derivation, and PLO regression behavior. |
| Assessment RPC shape | One aggregate workspace read plus one validated save | One RPC per instrument/category/item/reference/derived field | The current UI already makes seven asynchronous research calls. More fan-out increases ordering and concurrency risk and makes provenance reconciliation harder. |
| Persistence | New additive Google Sheets tables/layers | Reuse the legacy per-programme MQA tabs or mutate `PR_PLORecords`/`PR_PLOMappings` | Legacy tabs are adapted read-only by `readLegacyResearchDetail_`; existing research tables have fixed headers and PLO semantics. Assessment needs immutable defaults and separate programme overrides. |
| Client framework | Existing Vue 2.7 CDN + one Vue instance | Vue 3 migration, Vuex, Vite, or component build | No package/build pipeline exists, the page is assembled by HtmlService includes, and a framework migration is unrelated to this increment. Vue 2 is legacy/EOL in official docs, but compatibility—not greenfield modernization—is the brownfield requirement. |
| Local verification | Node static tests and syntax checks; authorized test deployment later | `clasp push`, `clasp deploy`, or a new local browser emulator | The README explicitly forbids push/deploy during local verification and records that no local harness can reproduce authenticated Apps Script services. |

## Local Verification and Tooling Constraints

**Observed (HIGH):** there is no `package.json` or project test runner. The repository uses Node/CommonJS scripts with `assert`, `fs`, and, where needed, `vm`; server tests extract functions with `new Function` and fake Sheets/LockService objects. `scripts/test-research-mapping.js` covers reference seeding, identity, normalization, TF derivation, legacy parsing/migration, and review behavior. `scripts/test-research-mapping-client.js` checks Vue state/methods and template/CSS markers. `scripts/verify-mqf-rebuild.js` is the broad static boundary regression suite.

Run from the repository root, without deployment:

```bash
node scripts/verify-mqf-rebuild.js
node scripts/test-research-mapping.js
node scripts/test-research-mapping-client.js
node scripts/test-mqf-overdue.js
node scripts/test-coor-access.js
node scripts/test-task7-boundaries.js
node -e "const fs=require('fs'); const s=fs.readFileSync('gas/JavaScript.html','utf8').replace(/^<script>\s*/,'').replace(/\s*<\/script>\s*$/,''); new Function(s); console.log('JavaScript syntax passed');"
node -e "for (const f of require('fs').readdirSync('gas').filter(f=>f.endsWith('.gs'))) new Function(require('fs').readFileSync('gas/'+f,'utf8')); console.log('GAS source syntax passed.');"
node -e "JSON.parse(require('fs').readFileSync('gas/appsscript.json','utf8')); console.log('Manifest JSON passed');"
git diff --check
git check-ignore -v gas/Config.gs gas/.clasp.json
git ls-files gas/Config.gs gas/.clasp.json
```

For Assessment Mapping, add focused Node scripts following the existing extraction/fake-service style. At minimum, test study-level profile selection, deterministic rubric totals/reconciled marks, descriptor lookup, one-and-only-one Primary SC, PPS-default versus faculty-override provenance, TF derivation through the canonical reference map, explicit SDG exclusion, programme identity/access rejection, and regression of both existing research mapping scripts. Do not require credentials, `SpreadsheetApp`, `LockService`, or an authenticated `google.script.run` session in local unit tests; stub them as the current tests do.

**Observed verification result for this research pass (HIGH):** the existing verifier, research mapping server/client tests, overdue/access/boundary tests, JavaScript syntax check, all GAS syntax checks, manifest JSON check, `git diff --check`, and ignore checks passed. No application, deployment, secret, or Linear files were modified.

## Sources

### Live repository (primary, HIGH confidence)

- `.planning/PROJECT.md` — brownfield constraints and Assessment Mapping requirements.
- `README.md` — deployable source boundary, local verification commands, no-deployment rule, and secret handling.
- `gas/appsscript.json` — V8, time zone, execution identity, and domain web-app settings.
- `gas/Index.html`, `gas/JavaScript.html`, `gas/Styles.html` — Vue 2.7 client, Vue state/method conventions, RPC flow, tab semantics, CSS tokens, and responsive patterns.
- `gas/Code.gs`, `gas/Auth.gs`, `gas/ProgrammeService.gs` — public wrapper, authentication, authorization, programme identity, and research filtering boundaries.
- `gas/ResearchDataService.gs`, `gas/ResearchReferenceService.gs`, `gas/ResearchMappingService.gs`, `gas/ResearchReviewService.gs`, `gas/GovernanceService.gs` — Sheets schema, references, locks, normalization, derivation, validation, and governance integration.
- `scripts/test-research-mapping.js`, `scripts/test-research-mapping-client.js`, `scripts/verify-mqf-rebuild.js`, and the other `scripts/test-*.js` files — local test harness and regression conventions.
- `gas/.clasp.json` and root `.clasp.json` — deployment mapping boundary only; values intentionally not reproduced here.

### Official documentation (LOW confidence through web-fetch seam; cross-checked against local behavior)

- Google, **HTML Service: Communicate with Server Functions** — asynchronous `google.script.run`, handler, serialization, concurrency, and private-function rules: https://developers.google.com/apps-script/guides/html/communication
- Google, **V8 runtime overview** — Apps Script V8 limitations and manifest selection: https://developers.google.com/apps-script/guides/v8-runtime
- Google, **Use the command-line interface with clasp** — local/deployment workflow: https://developers.google.com/apps-script/guides/clasp
- Google, **Class LockService / Lock** and **Spreadsheet Service** — locking and Sheets service references: https://developers.google.com/apps-script/reference/lock/lock-service and https://developers.google.com/apps-script/reference/spreadsheet
- Vue.js 2, **Reactivity in Depth** — root-property, nested-property, array, and `$set` caveats: https://v2.vuejs.org/v2/guide/reactivity.html
