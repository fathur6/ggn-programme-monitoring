# Phase 8: Make research workspace loading resilient - Research

**Researched:** 2026-07-31
**Domain:** Google Apps Script/Vue asynchronous RPC orchestration, LockService contention, Sheets-backed reads, and failure-state UX
**Confidence:** MEDIUM

## User Constraints

- No Phase 8 `*-CONTEXT.md` exists; there are no additional locked decisions to copy. [VERIFIED: phase init and directory read]
- This is a research-only phase; application code must not be modified while researching. [VERIFIED: task brief]
- Scope is limited to initial workspace RPC serialization/aggregation, lazy assessment mapping/review RPCs, bounded transient lock retry/backoff, endpoint-specific errors, Apps Script concurrency/cache/sheet behavior, and deployment-free tests. [VERIFIED: task brief]
- Preserve existing research mapping, review, authorization, assessment semantics, and brownfield behavior; no deployment or clasp side effect is in scope. [VERIFIED: PROJECT.md]

## Summary

The immediate contention source is client fan-out: `loadResearchWorkspace` starts seven independent `google.script.run` calls for profile, PEOs, PLOs, references, mappings, coverage, and review. [VERIFIED: codebase grep, `gas/JavaScript.html:589-638`] Each server call can touch the same script-wide lock during first-use sheet creation/reference seeding, while mapping and coverage also hold that lock during read paths. [VERIFIED: codebase grep, `gas/ResearchDataService.gs:16-36`, `gas/ResearchReferenceService.gs:60-87`, `gas/ResearchMappingService.gs:247-255,468-484,517-575`] Google documents that `google.script.run` is asynchronous, concurrent calls may execute out of order, and the browser-side API permits up to ten concurrent calls. [CITED: https://developers.google.com/apps-script/guides/html/communication]

The primary implementation recommendation is one authenticated aggregate research-workspace read RPC that builds one consistent snapshot and returns per-capability result envelopes, plus one aggregate assessment mapping/review RPC for the lazy assessment tab. [ASSUMED] The aggregate path should initialize/read shared Sheets once, keep pure projection work outside the lock, and expose retryable versus terminal endpoint errors to Vue. [ASSUMED] If the aggregate refactor is intentionally deferred, a serialized client queue is the safe fallback, but it trades contention reduction for higher latency. [ASSUMED]

`waitLock(30000)` is currently used as both a first-use initializer gate and a general read/write wrapper. [VERIFIED: codebase grep] Replace repeated long waits with a shared, bounded lock-acquisition helper based on `tryLock`, short exponential delays, and guaranteed release only after successful acquisition. [CITED: https://developers.google.com/apps-script/reference/lock/lock] Retry only lock acquisition or a clearly classified transient transport failure; do not blindly replay authorization, validation, schema, or non-idempotent mutation failures. [CITED: https://cloud.google.com/storage/docs/retry-strategy]

**Primary recommendation:** Aggregate the seven initial reads and the two assessment reads, centralize lock acquisition/retry on the server, and replace `researchError` with endpoint-keyed error state and retry actions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Initial research workspace orchestration | Frontend Server (SSR) | Browser / Client | Vue owns loading/error presentation, but the RPC boundary and snapshot shape must prevent seven independent server executions. [VERIFIED: codebase grep; ASSUMED: responsibility recommendation] |
| Research profile/PEO/PLO/mapping/coverage/review snapshot | API / Backend | Database / Storage | These functions authenticate, resolve programme identity, read Sheets, migrate legacy rows, and derive review data. [VERIFIED: `gas/ResearchMappingService.gs`, `gas/ResearchReviewService.gs`] |
| Assessment mapping and review projection | API / Backend | Database / Storage | `AssessmentService.gs` selects study-level definitions, overlays alignments, derives TF, validates items, and reads/writes assessment sheets. [VERIFIED: `gas/AssessmentService.gs:307-466`] |
| Lock acquisition and retry policy | API / Backend | — | Lock scope is shared by server executions; waiting/retry must be server-owned so every caller follows one policy. [CITED: https://developers.google.com/apps-script/reference/lock/lock-service] |
| Sheet initialization and row access | Database / Storage | API / Backend | Apps Script Sheets is the source of truth; initialization and mutations require serialization, while reads should batch and avoid unnecessary writes. [CITED: https://developers.google.com/apps-script/guides/support/best-practices] |
| Endpoint-specific loading/error UX | Browser / Client | Frontend Server (SSR) | The current Vue state has one `researchError`; only the client can show the failed panel and retry the specific capability without discarding successful results. [VERIFIED: `gas/JavaScript.html:209-225,589-726`] |

## Current Baseline and Findings

### Initial research fan-out

- `loadResearchWorkspace` sets `pending = 7`, launches all seven calls immediately, and marks the whole workspace failed when any one callback fails. [VERIFIED: `gas/JavaScript.html:589-638`]
- The seven calls are `getResearchProgrammeApi`, `getResearchPEOsApi`, `getResearchPLOsApi`, `getResearchReferencesApi`, `getResearchMappingsApi`, `getResearchCoverageApi`, and `getResearchReviewApi`. [VERIFIED: `gas/JavaScript.html:618-637`]
- Successful responses are assigned independently, so partial data can already exist, but the global banner and `researchSaveState = 'error'` do not identify which capability failed. [VERIFIED: `gas/JavaScript.html:604-609,619-637`]
- `researchFailure` is reused by mapping refresh, coverage, review, assessment mapping, assessment review, and assessment mutations; it sets global error/dirty state and shows a toast. [VERIFIED: `gas/JavaScript.html:639-645,651-726,746-759`]
- The template renders one global `researchError` alert with only a whole-workspace retry action. [VERIFIED: `gas/Index.html:187-197`]

### Lazy assessment path

- Switching to the assessment tab calls `loadAssessmentMapping` only when `assessmentMapping` is absent. [VERIFIED: `gas/JavaScript.html:824-832`]
- `loadAssessmentMapping` calls `getAssessmentMappingApi`; only its success callback then calls `loadAssessmentReview`, so the two lazy calls are currently serialized within one tab activation. [VERIFIED: `gas/JavaScript.html:719-726`]
- The assessment mapping and review endpoints independently invoke `assessmentProjectionForProgramme_`, which resolves access, ensures/possibly seeds assessment sheets, reads alignments, loads definitions, and loads research references. [VERIFIED: `gas/AssessmentService.gs:388-399,455-466`]
- Assessment sheet initialization takes the script lock and seeds definitions with repeated `appendRow` calls on first use. [VERIFIED: `gas/AssessmentService.gs:158-175,178-212`]
- Assessment save/reset already release the mutation lock before re-reading the returned mapping, which is the correct boundary to preserve; do not hold the lock across the post-save read. [VERIFIED: `gas/AssessmentService.gs:401-431,433-452`]

### Server lock and Sheets behavior in this repository

- `ensureResearchSheets_` creates eight research sheets and headers under a script lock, with a 30-second `waitLock` timeout. [VERIFIED: `gas/ResearchDataService.gs:3-36`]
- `getResearchReferences_` calls `ensureResearchSheets_`, seeds missing reference rows under another script lock, then reads all reference ranges into an in-memory cache. [VERIFIED: `gas/ResearchReferenceService.gs:54-118`]
- `researchContext_` resolves the programme, ensures research sheets, and calls legacy migration; the migration itself appends cloned rows but is not wrapped by `withResearchLock_`. [VERIFIED: `gas/ResearchMappingService.gs:101-129`]
- `getResearchMappingsApi_` and `getResearchCoverageApi_` hold the script lock over broad reads and may write corrected TF rows through `freshResearchMappings_`. [VERIFIED: `gas/ResearchMappingService.gs:319-335,468-484,517-575`]
- `withResearchLock_` uses `waitLock(30000)`, converts timeout to a generic busy error, and releases in `finally`. [VERIFIED: `gas/ResearchMappingService.gs:247-255`]
- Assessment `ensureAssessmentSheets_`, `saveAssessmentMappingApi_`, and `resetAssessmentMappingApi_` each use the script lock with the same 30-second wait pattern. [VERIFIED: `gas/AssessmentService.gs:158-175,418-429,440-451`]
- The script-wide lock serializes all users of this script, not only users of one programme. [CITED: https://developers.google.com/apps-script/reference/lock/lock-service]
- Apps Script best practices recommend minimizing service calls, batching reads/writes, calculating in memory, and writing back in batches. [CITED: https://developers.google.com/apps-script/guides/support/best-practices]
- No `CacheService` use was found in the requested research/assessment services; existing `CacheService` use is in OAuth state handling. [VERIFIED: codebase grep]

### Planning state discrepancy

- The roadmap contains Phase 8 after the seven original phases, with no formal requirement IDs and `Plans: 0 plans`. [VERIFIED: `.planning/ROADMAP.md:215-224`]
- `STATE.md` still reports `total_phases: 7` and current Phase 1, despite recording that Phase 8 was added. [VERIFIED: `.planning/STATE.md:4-12,71-74`]
- The planner should treat this as planning metadata to reconcile separately; it is not a reason to widen the technical scope of this research. [ASSUMED]

## Standard Stack

### Core

| Library/service | Version | Purpose | Why standard |
|---|---|---|---|
| Google Apps Script `LockService` | Platform service; version not separately pinned | Script-wide mutual exclusion for shared Sheet initialization and mutations | Already used by the repository and officially provides script/user/document lock scopes plus `tryLock`/`waitLock`. [VERIFIED: codebase grep] [CITED: https://developers.google.com/apps-script/reference/lock/lock-service] |
| Google Apps Script `SpreadsheetApp` | Platform service; version not separately pinned | Sheet-backed source of truth | Existing services use `getDataRange`, `appendRow`, `getRange`, `setValues`, and sheet creation. [VERIFIED: codebase read] |
| Google Apps Script `CacheService` | Platform service; version not separately pinned | Optional short-lived acceleration for immutable/reference data | Officially supports script/user/document scopes but is best-effort and may return `null`; it must not replace Sheets or lock ownership. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service] |
| `google.script.run` | HTML Service platform API | Browser-to-server asynchronous RPC | Existing Vue code uses success/failure handlers; official docs warn about out-of-order concurrent calls and document the ten-call client limit. [VERIFIED: codebase grep] [CITED: https://developers.google.com/apps-script/guides/html/communication] |

### Supporting

| Library/service | Version | Purpose | When to use |
|---|---|---|---|
| Vue | 2.7.14 | Existing workspace state and rendering | Extend existing Vue state/method conventions; do not introduce a second client state library. [VERIFIED: `gas/Index.html:252`] |
| Node.js built-ins (`assert`, `fs`, `vm`) | Runtime-provided; Node 22.23.1 detected locally | Deployment-free tests and source-function injection | Use the repository's existing test seam for deterministic server doubles and client orchestration tests. [VERIFIED: existing scripts; environment probe] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| One aggregate initial workspace RPC | Serialize the seven existing RPCs through a client queue | Serialization is lower-risk and preserves endpoint boundaries, but still performs seven server executions and increases cold-load latency. [ASSUMED] |
| One aggregate assessment mapping/review RPC | Keep mapping then review chain | The current chain already avoids same-tab parallelism, but it repeats projection/setup work and leaves review without its own loading/error state. [VERIFIED: codebase read] [ASSUMED: tradeoff] |
| `tryLock` with bounded retry | Keep `waitLock(30000)` everywhere | Long waits multiplied across fan-out amplify queueing and hide whether a request is transiently busy; `tryLock` exposes a boolean timeout that is easier to bound and test. [CITED: https://developers.google.com/apps-script/reference/lock/lock] [ASSUMED: design judgment] |
| Versioned best-effort cache for immutable references only | Cache mutable programme workspace data indiscriminately | CacheService can return `null` before expiry, and mutable data needs reliable invalidation; Sheets remains authoritative. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service] |

**Installation:** No new packages should be installed for Phase 8. [ASSUMED]

**Package Legitimacy Audit:** Not applicable; the recommended design uses existing Apps Script services, Vue 2.7.14 already present in the HTML, and Node built-ins. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```text
Vue opens programme
        |
        v
one getResearchWorkspaceApi(programmeId)
        |
        +--> authenticate + resolve canonical programme
        |
        +--> ensure shared research sheets once
        |       |
        |       +--> bounded script-lock retry only for initialization/migration writes
        |       +--> batch-read relevant ranges into one snapshot
        |
        +--> pure projections from snapshot
        |       +--> profile
        |       +--> PEOs / PLOs
        |       +--> references
        |       +--> mappings
        |       +--> coverage
        |       +--> review
        |
        +--> per-endpoint envelopes { ok, data, error, retryable }
        |
        v
Vue commits successful panels independently
        |
        +--> failed endpoint shows local message + retry endpoint
        +--> aggregate/auth failure shows top-level actionable message

Assessment tab
        |
        v
one getAssessmentWorkspaceApi(programmeId)
        |
        +--> one setup/read boundary
        +--> one effective projection source
        +--> mapping DTO + review DTO
        |
        v
assessment panel state: mapping, review, mappingError, reviewError
```

The diagram intentionally separates setup/read coordination from pure projection and from Vue presentation; file-level mapping belongs below. [ASSUMED: recommended architecture]

### Recommended Project Structure

```text
gas/
├── Code.gs                         # Public aggregate read wrappers
├── ResearchWorkspaceService.gs     # Aggregate research snapshot/envelopes
├── ResearchLockService.gs          # Shared bounded lock/retry helper (or existing service)
├── ResearchMappingService.gs       # Reused pure row/projection helpers
├── ResearchReviewService.gs        # Reused review projection helpers
├── AssessmentService.gs            # Aggregate assessment mapping/review projection
└── JavaScript.html                 # Vue orchestration and endpoint error state
scripts/
├── test-research-workspace-loading.js
├── test-research-lock-retry.js
└── existing test-research-mapping*.js / test-assessment-mapping.js
```

The new filenames are planning options, not existing files; keep the helper in an existing service if that better matches repository conventions. [ASSUMED]

### Pattern 1: Aggregate snapshot with endpoint envelopes

**What:** Authenticate and resolve programme once, establish the read context once, then return independent capability results rather than throwing on the first recoverable component failure. [ASSUMED]

**When to use:** Initial workspace load and assessment lazy load, where multiple DTOs share programme identity, Sheets ranges, references, and derived projections. [VERIFIED: codebase read] [ASSUMED: application]

**Example:**

```javascript
// Illustrative shape; exact names and DTO fields are implementation decisions.
function endpointResult_(loader) {
  try {
    return { ok: true, data: loader(), error: null, retryable: false };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { code: classifyResearchError_(error), message: safeClientMessage_(error) },
      retryable: isTransientResearchError_(error)
    };
  }
}
```

This shape is recommended so Vue can preserve successful panels and retry only the failed capability; it is not copied from an external source. [ASSUMED]

### Pattern 2: Narrow, bounded lock acquisition

**What:** Use `tryLock` for a short per-attempt timeout, sleep between attempts with capped exponential backoff, run only the critical Sheet operation under the lock, and release in `finally`. [CITED: https://developers.google.com/apps-script/reference/lock/lock] [CITED: https://cloud.google.com/storage/docs/retry-strategy]

**When to use:** Sheet creation, legacy migration, seed append, and writes. Pure reads should not acquire the script lock unless a documented read-repair is removed or isolated into a write path. [VERIFIED: codebase read] [ASSUMED: recommendation]

**Example:**

```javascript
function withScriptLockRetry_(work) {
  var delays = [250, 500, 1000]; // proposed values; confirm in plan
  for (var attempt = 0; attempt < delays.length; attempt++) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(5000)) {
      try { return work(); }
      finally { lock.releaseLock(); }
    }
    if (attempt < delays.length - 1) Utilities.sleep(delays[attempt]);
  }
  throw transientLockError_();
}
```

The exact delays, error code, and whether jitter is used are open implementation choices; tests must inject the sleeper or use a deterministic clock rather than wait in real time. [ASSUMED]

### Pattern 3: Generation/token guard for stale Vue responses

**What:** Increment a workspace-load generation when opening a programme; callbacks commit only if their generation and programme identity still match. [ASSUMED]

**Why:** Official `google.script.run` calls are asynchronous and may complete out of order, while the current callbacks close over mutable `self` state. [CITED: https://developers.google.com/apps-script/guides/html/communication] [VERIFIED: `gas/JavaScript.html:612-637`]

```javascript
var generation = ++this.researchLoadGeneration;
var programmeId = this.currentProgramme.programmeId || this.currentProgramme.mqaCode;
request(function(result) {
  if (generation !== self.researchLoadGeneration) return;
  self.researchProfile = result;
});
```

### Anti-Patterns to Avoid

- **Seven independent cold-start RPCs:** They multiply access/context/Sheet initialization and compete for one script-wide lock. [VERIFIED: codebase read] [CITED: https://developers.google.com/apps-script/reference/lock/lock-service]
- **Global error for endpoint failure:** It hides which DTO failed and makes a successful partial load look wholly unusable. [VERIFIED: codebase read]
- **Retry the entire mutation after an ambiguous response:** A lost response can mean the write committed; only retry operations proven idempotent or guarded by an operation key. [CITED: https://cloud.google.com/storage/docs/retry-strategy]
- **Hold a script lock while doing all derived reads:** This increases contention and blocks unrelated users; read and calculate from an already captured snapshot outside the lock. [CITED: https://developers.google.com/apps-script/guides/support/best-practices] [ASSUMED: application]
- **Use CacheService as authoritative state or a lock:** Cache values can disappear before expiry and are not a consistency mechanism. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service]
- **Retry every `Error` message containing “busy”:** Validation, authorization, schema, quota, and service failures must remain terminal unless explicitly classified. [CITED: https://cloud.google.com/storage/docs/retry-strategy] [CITED: https://developers.google.com/apps-script/guides/services/quotas]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Mutual exclusion | A PropertiesService flag, timestamp spinlock, or cache flag | `LockService.getScriptLock()` with `tryLock`/`waitLock` and `finally` release | Apps Script supplies the mutual-exclusion primitive and lock scope semantics. [CITED: https://developers.google.com/apps-script/reference/lock/lock-service] |
| Transient retry policy | Unbounded recursive retries or `setTimeout` polling in server code | One bounded lock helper with injected sleep/backoff | Apps Script lock acquisition is synchronous; bounded attempts prevent runtime amplification. [CITED: https://developers.google.com/apps-script/reference/lock/lock] [ASSUMED: policy] |
| Sheet snapshot DTO | Re-reading each sheet/range independently in every endpoint | One batch-read context and pure in-memory projections | Google recommends minimizing service calls and batching reads/writes. [CITED: https://developers.google.com/apps-script/guides/support/best-practices] |
| Client RPC scheduler | A second networking library or promise transport | Existing `google.script.run` plus one queue/aggregate call | The platform already supplies asynchronous RPC, success/failure handlers, and user objects. [CITED: https://developers.google.com/apps-script/guides/html/communication] |
| Cache consistency | Treating CacheService as durable storage | Sheets source of truth plus versioned optional cache | Official cache values are best-effort and may read as `null`. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service] |

**Key insight:** The failure is primarily an orchestration and critical-section problem, not a missing library problem. [VERIFIED: codebase read] [ASSUMED: diagnosis]

## Common Pitfalls

### Pitfall 1: Aggregate endpoint still calls the seven public helpers

**What goes wrong:** The apparent one-RPC fix still repeats access checks, context setup, cache reads, locks, and legacy migration internally. [ASSUMED]

**Why it happens:** Reusing public wrappers is easier than extracting a shared read context and pure DTO builders. [ASSUMED]

**How to avoid:** Build the aggregate endpoint from private snapshot/projection helpers; call authorization and setup once, then derive all capabilities from the captured data. [ASSUMED]

**Warning signs:** Test spies show multiple `ensureResearchSheets_`/`getDataRange` calls, or the aggregate endpoint acquires the same script lock more than once. [ASSUMED]

### Pitfall 2: Read endpoints mutate under a read name

**What goes wrong:** Coverage/mappings repair stored TF rows while holding a lock, so a “load” can contend with saves and create hidden write ordering. [VERIFIED: `gas/ResearchMappingService.gs:319-335,517-575`]

**Why it happens:** `freshResearchMappings_` normalizes stored TF selections as part of projection. [VERIFIED: codebase read]

**How to avoid:** Make projection pure for aggregate reads; move repair to an explicit, lock-protected migration/maintenance step or batch it into a controlled write path. [ASSUMED]

**Warning signs:** A read-only test changes fake sheet rows or calls `setValues`. [ASSUMED]

### Pitfall 3: Retrying after a mutation may duplicate or overwrite state

**What goes wrong:** A timeout at the client boundary is mistaken for proof that a save did not commit. [ASSUMED]

**Why it happens:** The client cannot distinguish server failure before lock acquisition from response loss after a successful write. [ASSUMED]

**How to avoid:** Keep server lock retry before mutation; for client retries, limit to reads or add an idempotency token/explicit post-save refresh for writes. [CITED: https://cloud.google.com/storage/docs/retry-strategy]

**Warning signs:** A test that forces a failure after `setValues` and then retries produces duplicate rows or unexpected last-writer-wins behavior. [ASSUMED]

### Pitfall 4: Partial response is committed to the wrong programme

**What goes wrong:** A slow callback from programme A overwrites programme B after the user switches programmes. [ASSUMED]

**Why it happens:** The current callbacks use one mutable Vue instance and no generation guard. [VERIFIED: `gas/JavaScript.html:612-637`]

**How to avoid:** Attach programme ID and load generation to every callback; ignore stale responses. [ASSUMED]

**Warning signs:** A test resolves callbacks in reverse order after `openProgramme` changes `currentProgramme` and sees mixed DTOs. [ASSUMED]

### Pitfall 5: Cache leaks mutable or user-specific data

**What goes wrong:** A script-wide cache key omits programme/user identity or returns stale alignment data after save. [ASSUMED]

**Why it happens:** Script cache is shared by all users and persistence is best-effort. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service]

**How to avoid:** Cache only immutable/versioned reference or definition payloads; key mutable data by canonical programme identity and invalidate on every mutation, while retaining a cache miss/source-of-truth path. [ASSUMED]

**Warning signs:** A fake cache test returns another programme’s DTO or a stale DTO after save/reset. [ASSUMED]

## Code Examples

### Client endpoint error state

```javascript
// Illustrative Vue state; use the project's existing naming conventions.
researchEndpointErrors: {
  profile: null, peos: null, plos: null, references: null,
  mappings: null, coverage: null, review: null
},
assessmentEndpointErrors: { mapping: null, review: null }
```

The state shape is recommended to replace the single global `researchError`, because the current UI has independent data consumers but only one error slot. [VERIFIED: `gas/JavaScript.html:209-225`, `gas/Index.html:197`] [ASSUMED: implementation]

### Client aggregate response application

```javascript
function applyEndpoint_(name, result) {
  if (result && result.ok) {
    self[name] = result.data;
    self.researchEndpointErrors[name] = null;
  } else {
    self.researchEndpointErrors[name] = result && result.error || {
      code: 'UNKNOWN', message: 'Unable to load this section.', retryable: false
    };
  }
}
```

Use local retry buttons that invoke only the failed endpoint or re-run the aggregate snapshot with a new generation; do not reset unrelated successful DTOs. [ASSUMED]

### Server retry classification

```javascript
function isTransientResearchError_(error) {
  var message = String(error && error.message || error || '').toLowerCase();
  return message.indexOf('lock') !== -1 || message.indexOf('busy') !== -1;
}
```

This is only a starting seam. A stable internal error code is preferred over matching localized messages, because the current repository emits both Malay and English busy messages. [VERIFIED: `gas/ResearchDataService.gs:23-25`, `gas/ResearchMappingService.gs:251-253`, `gas/AssessmentService.gs:163-164`] [ASSUMED: implementation recommendation]

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Fan out seven independent `google.script.run` calls | Aggregate/serialize shared reads and apply a coherent snapshot | Phase 8 | Fewer concurrent executions, less lock pressure, explicit partial-success handling. [VERIFIED: current code] [ASSUMED: impact] |
| `waitLock(30000)` at every lock site | Bounded `tryLock` attempts with capped backoff and typed transient failure | Phase 8 | Prevents one busy request from consuming a long repeated wait; exact budget needs confirmation. [VERIFIED: current code] [CITED: official Lock docs] [ASSUMED: impact] |
| One global `researchError` | Endpoint-keyed errors with local retry and optional top-level fatal error | Phase 8 | Users can continue using successful panels and repair one failed endpoint. [VERIFIED: current code] [ASSUMED: impact] |
| Read-time normalization writes | Pure read projection plus explicit repair/migration | Phase 8 | Reads stop competing with writes and become easier to test. [VERIFIED: current code] [ASSUMED: recommendation] |

**Deprecated/outdated for this phase:** Treating concurrent `google.script.run` completion order as deterministic is incompatible with the official client contract. [CITED: https://developers.google.com/apps-script/guides/html/communication]

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | One aggregate initial research RPC is acceptable without changing DTO semantics. | Summary / Architecture | A larger server refactor could exceed Phase 8 capacity; use the serialized queue fallback. |
| A2 | Proposed lock delays of 250/500/1000 ms and 5-second `tryLock` attempts are suitable starting values. | Architecture Pattern 2 | Too short causes avoidable failures; too long increases Apps Script runtime and user wait. |
| A3 | Assessment mapping and review can share one setup/projection context while preserving the review’s stricter Primary SC validation. | Lazy assessment path | A naïve shared projection could change review semantics; add contract tests before implementation. |
| A4 | Read-time TF repair can be removed or moved without violating existing data migration expectations. | Pitfall 2 | Existing data may depend on normalization side effects; inspect Phase 7 acceptance expectations before changing it. |
| A5 | No new external package is needed. | Standard Stack | If a test runner is later required, run package legitimacy checks before installation. |
| A6 | The planner may reconcile the roadmap/STATE phase-count discrepancy separately from technical implementation. | Planning state discrepancy | Incorrect state metadata could cause GSD orchestration to target the wrong phase. |

## Open Questions

1. **Should Phase 8 expose new public aggregate endpoints or only serialize existing endpoints?**
   - What we know: The current seven initial calls are independent and share setup/lock paths. [VERIFIED: codebase read]
   - What's unclear: Whether compatibility requires every existing public RPC to remain the only client-visible contract.
   - Recommendation: Prefer private snapshot builders plus a new public aggregate wrapper; retain existing wrappers for targeted refresh and regression compatibility. [ASSUMED]

2. **What is the accepted total retry budget?**
   - What we know: `waitLock(30000)` currently allows a long per-call wait, and seven calls can overlap. [VERIFIED: codebase read]
   - What's unclear: The user-facing maximum wait and expected contention frequency are not recorded.
   - Recommendation: Lock the budget in a plan task and test it deterministically; start with a short bounded budget rather than another 30-second wait. [ASSUMED]

3. **Are legacy migrations allowed during reads?**
   - What we know: `researchContext_` calls `migrateLegacyResearchRows_`, which appends cloned rows when the canonical identity is absent. [VERIFIED: codebase read]
   - What's unclear: Whether Phase 8 may separate this migration from workspace loading.
   - Recommendation: Treat migration as an explicit serialized setup step, not as an unguarded side effect in every read. [ASSUMED]

4. **Should assessment review load with the mapping DTO even if mapping data is partial?**
   - What we know: Current mapping success triggers review; mapping failure prevents review from being requested. [VERIFIED: `gas/JavaScript.html:719-726`]
   - What's unclear: Whether the UI should display a review error separately or mark review unavailable when mapping fails.
   - Recommendation: Return both capabilities from one aggregate response when the shared projection is available; otherwise attribute dependency failure explicitly to both affected panels. [ASSUMED]

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Existing deployment-free test scripts | ✓ | 22.23.1 | — |
| npm | Optional test tooling only; no install recommended | ✓ | 10.9.8 | Existing Node built-ins |
| clasp | Deployment verification only; explicitly out of scope for this phase | ✓ | 3.3.0 | Do not run push/deploy |
| Live Apps Script/Sheets deployment | Production contention validation | Not required locally | — | Fake LockService/Sheets and client RPC doubles |

**Missing dependencies with no fallback:** None for the planned local tests. [VERIFIED: environment probe]

**Missing dependencies with fallback:** Live deployment is intentionally not used; deterministic fakes cover the phase behaviors without deployment. [VERIFIED: task brief; existing tests]

## Verification Strategy

The project explicitly disables Nyquist validation, so the standard `Validation Architecture` section is omitted. [VERIFIED: `.planning/config.json:13-18`]

### Existing baseline

- `node scripts/test-research-mapping.js` passed. [VERIFIED: command run 2026-07-31]
- `node scripts/test-assessment-mapping.js` passed. [VERIFIED: command run 2026-07-31]
- `node scripts/test-research-mapping-client.js` passed. [VERIFIED: command run 2026-07-31]
- `node scripts/test-task7-boundaries.js` passed. [VERIFIED: command run 2026-07-31]

### Required new test seams

| Behavior | Test type | Suggested seam | Pass condition |
|---|---|---|---|
| Initial load does not fan out seven concurrent calls | Client unit | Fake `google.script.run` records invocations | Aggregate path makes one initial call, or serialized fallback has max in-flight count of one. [ASSUMED] |
| Aggregate response preserves partial success | Client/server unit | Fake endpoint envelopes with one failure | Successful DTOs remain rendered; only the failed endpoint gets an error and retry action. [ASSUMED] |
| Endpoint retry is targeted | Client unit | Fake runner resolves selected retry | Retrying coverage/review/assessment review does not clear profile, PEO, PLO, or mapping state. [ASSUMED] |
| Stale programme response is ignored | Client unit | Resolve callbacks after switching programme | Old generation cannot overwrite the new programme state. [ASSUMED] |
| Lock retries once and then succeeds | Server unit | Fake `tryLock` returns false, false, true; fake sleeper records delays | Work runs once, delay sequence is bounded, and release occurs exactly once after acquisition. [ASSUMED] |
| Lock budget exhausts cleanly | Server unit | Fake lock always returns false | Typed retryable busy result/error is returned after the configured maximum; no work or release occurs. [ASSUMED] |
| Terminal errors are not retried | Server unit | Work throws validation/authorization/schema error | One attempt only; original terminal classification is preserved. [CITED: https://cloud.google.com/storage/docs/retry-strategy] |
| Read path is side-effect free | Server unit | Fake Sheets snapshots before/after aggregate read | No `appendRow`, `setValues`, or row repair occurs after initialization has been prepared. [ASSUMED] |
| Assessment mapping/review share semantics | Server unit | Fake definitions/references/alignments | Mapping DTO preserves effective/provenance values and review retains strict Primary SC checks. [VERIFIED: existing assessment tests; ASSUMED: new aggregate contract] |
| Existing behavior remains green | Regression | Existing four scripts plus static/syntax checks | All baseline commands continue to pass. [VERIFIED: existing scripts] |

### Test implementation shape

Use `fs.readFileSync` plus `new Function`/`vm.runInNewContext`, as existing tests already inject fake Sheets, `LockService`, `Utilities`, and auth helpers. [VERIFIED: `scripts/test-research-mapping.js`, `scripts/test-task7-boundaries.js`] For client orchestration, extract the relevant method source or use a minimal Vue-like object and a fake fluent runner implementing `withSuccessHandler`, `withFailureHandler`, and endpoint methods. [ASSUMED] Avoid real `Utilities.sleep` in tests; inject a sleeper or record intended delays. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | Yes | Preserve existing `requireProgrammeAccess_`/`requireResearchProgrammeAccess_` checks before aggregate data access; do not make aggregate endpoints public. [VERIFIED: codebase read] |
| V3 Session Management | Yes | Do not include session tokens or user-specific cache data in a shared DTO; keep existing OAuth/session boundary unchanged. [VERIFIED: `gas/Auth.gs`; ASSUMED: control] |
| V4 Access Control | Yes | Resolve one canonical programme identity and authorize it once before composing every endpoint result; reject cross-programme aggregation. [VERIFIED: codebase read; ASSUMED: control] |
| V5 Input Validation | Yes | Validate programme ID, endpoint/retry selector, aggregate payload shape, and any item IDs server-side; never trust client retryability or client-derived TF. [VERIFIED: `gas/AssessmentService.gs:344-377`; ASSUMED: new selectors] |
| V6 Cryptography | No new control | No cryptographic operation is introduced; preserve existing OAuth implementation and do not invent retry tokens with weak randomness. [ASSUMED] |

### Known Threat Patterns for Apps Script/Vue/Sheets

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Aggregate endpoint over-returns another programme | Information disclosure / Elevation | Resolve canonical composite programme identity and reuse existing authorization before all DTO builders. [VERIFIED: `gas/ProgrammeService.gs`; ASSUMED: threat mapping] |
| Shared script cache contains mutable/user-specific data | Information disclosure | Avoid caching mutable workspace data; use programme/user-scoped keys and treat cache misses as normal. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service] |
| Retry duplicates a save | Tampering | Retry lock acquisition before mutation only; make any client replay explicit and idempotent. [CITED: https://cloud.google.com/storage/docs/retry-strategy] |
| Error message leaks internal Sheet/schema details | Information disclosure | Return stable safe client messages and log diagnostic details server-side; preserve endpoint code separately. [ASSUMED: security control] |
| Stale callback writes to a newly selected programme | Tampering | Add generation and programme identity guards before Vue state commit. [ASSUMED: security control] |
| Lock is not released on exception | Denial of service | `try/finally`, release only after confirmed acquisition, and test both success and thrown-work paths. [CITED: https://developers.google.com/apps-script/reference/lock/lock] |

## Sources

### Primary (MEDIUM confidence)

- Repository source and tests - current RPC fan-out, lock sites, cache variables, DTO construction, and no-deployment test seams. [VERIFIED: codebase read/grep]
- Google Apps Script LockService reference - lock scopes and acquisition semantics. [CITED: https://developers.google.com/apps-script/reference/lock/lock-service]
- Google Apps Script Lock reference - `tryLock`, `waitLock`, `hasLock`, and `releaseLock`. [CITED: https://developers.google.com/apps-script/reference/lock/lock]
- Google Apps Script HTML Service communication - asynchronous ordering, handlers, user objects, and ten concurrent calls. [CITED: https://developers.google.com/apps-script/guides/html/communication]
- Google Apps Script best practices - minimize service calls, batch Sheets reads/writes, and use cache for acceleration. [CITED: https://developers.google.com/apps-script/guides/support/best-practices]
- Google Apps Script CacheService reference - scopes and best-effort persistence. [CITED: https://developers.google.com/apps-script/reference/cache/cache-service]
- Google Apps Script quotas - execution/concurrency failures and changing quota limits. [CITED: https://developers.google.com/apps-script/guides/services/quotas]

### Secondary (MEDIUM confidence)

- Google Cloud retry strategy - transient versus permanent errors, idempotency, and bounded exponential backoff principles. [CITED: https://cloud.google.com/storage/docs/retry-strategy]

### Tertiary (LOW confidence)

- Exact backoff constants, aggregate DTO names, endpoint envelope shape, and migration/read-repair split are recommendations requiring plan-time confirmation. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - platform services and Vue version are verified in the repository and official service behavior is documented; no new package decision is required. [VERIFIED: codebase read] [CITED: official docs]
- Architecture: MEDIUM - current call graph and lock boundaries are verified; aggregate snapshot and endpoint-envelope shape are prescriptive design recommendations. [VERIFIED: codebase read] [ASSUMED: design]
- Pitfalls: MEDIUM - fan-out, broad locks, read-time mutation, and global error state are directly visible; exact production contention frequency is not measured locally. [VERIFIED: codebase read] [ASSUMED: production frequency unknown]

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 for repository findings; recheck official Apps Script quotas and service documentation before implementation because platform limits can change. [CITED: https://developers.google.com/apps-script/guides/services/quotas]
