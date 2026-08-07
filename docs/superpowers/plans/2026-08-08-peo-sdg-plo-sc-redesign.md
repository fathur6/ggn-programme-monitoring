# PEO → SDG + PLO → SC/TF — UI & Data Model Redesign

> **For OpenCode:** Read this entire document before writing any code. This is a comprehensive redesign — understand the full architecture first, then implement task by task.

## Context

### Project
`ggn-academic-management` — Google Apps Script web app for MQF 2.0 postgraduate research programme mapping at UniSZA Graduate School.

Path: `/Users/aman/Library/CloudStorage/OneDrive-UniversitiSultanZainalAbidin-UniSZA/(AGENTIC) Knowledge Base/Opencode/ggn-academic-management`

### Current state (already deployed, version 89)
- 64 postgraduate research programmes across 11 faculties
- **Tab Pemetaan** currently maps PLO → SDG, SC, TF (all at PLO level)
- `PR_PEORecords` stores PEO data; `PR_PLORecords` stores PLO data; `PR_PLOMappings` stores SDG/SC/TF per PLO
- SDG defaults (3 per programme) seeded via `ProgrammeSDGService.gs`
- Shared MQA ownership active (7 shared codes, owner faculty is single source of truth)
- Heal report active (per-programme parentPEO/taxonomy diagnosis)
- Soft save validation: PLOs with missing parentPEO/taxonomy save OK, flagged `Needs attention`

### Why this redesign
SDG is a **programme-level** concept (broad, institutional impact), while SC and TF are **learning-outcome-level** (competency, cognitive depth). Moving SDG to PEO level is academically correct and improves UX clarity.

---

## Design Spec — Apple-Inspired UX

### Principles
- **Clarity**: Two distinct levels — PEO (programme-wide, top) vs PLO (learning-outcome, bottom)
- **Progressive Disclosure**: PEO→SDG first (big-picture context), then PLO→SC+TF (detail)
- **Depth**: Layered cards — PEO cards with SDG chips, compact PLO rows, coverage matrix at base
- **Direct Manipulation**: SDG chip popover (multi-select), SC dropdown (single-select, grouped by category)

### Tab Pemetaan — New Layout

```
┌──────────────────────────────────────────────────────────┐
│  ◉ Maklumat Program    ● Pemetaan                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─ PEO → SDG ⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻┐  │
│  │  Programme-wide impact mapping                         │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ PEO1 — Knowledge & Understanding        3 SDGs  │   │  │
│  │  │                                                │   │  │
│  │  │  [SDG4 Quality Education ✕]                    │   │  │
│  │  │  [SDG8 Decent Work ✕]                          │   │  │
│  │  │  [SDG12 Responsible Consumption ✕]             │   │  │
│  │  │  [＋ Add SDG]                                   │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ PEO2 — Research & Innovation           2 SDGs   │   │  │
│  │  │  [SDG9 Industry ✕] [SDG17 Partnerships ✕]       │   │  │
│  │  │  [＋ Add SDG]                                   │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ PLO → SC + TF ⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻⸻┐  │
│  │  Learning-outcome competency mapping                   │  │
│  │                                                        │  │
│  │  PLO1  Evaluate theories...         SC3 Critical  TF2  │  │
│  │  PLO2  Resolve critical issues...   SC6 Integrated TF2 │  │
│  │  PLO3  Demonstrate ability to...    SC4 Strategic  TF3 │  │
│  │  PLO4  Demonstrate social skills... SC5 Collab     TF3 │  │
│  │  ...                                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ Coverage Matrix ──────────────────────────────────┐  │
│  │  ▸ Audit view (read-only, expandable)                │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Interactions

**SDG Popover (on `＋ Add SDG` click):**
- Multi-select checklist with 17 SDGs
- Toggle on/off, `Done` button, background dismiss
- Auto-save on dismiss if changed
- Popover positioned relative to the card, not floating center

**SC Picker (on PLO row):**
- Single-select dropdown grouped by 3 categories (Ways of Thinking / Practicing / Being)
- Selected SC shown as colored chip on the PLO row
- TF badge is read-only (derived from MQF domains)
- Group headers are non-selectable labels

---

## Data Model Changes

### New sheet: `PR_PEOMappings`
```javascript
PR_PEOMappings: ['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']
```

### Modified sheet: `PR_PLOMappings`
Remove `SDGIdsJson` — PLO mappings now only store SC and TF:
```javascript
// BEFORE
PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']
// AFTER
PR_PLOMappings: ['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']
```

This is a **column removal** — the header changes from 8 cols to 7 cols.

### Migration: PLO SDGs → PEO
During first access after deployment, existing SDG data on PLO mappings must be migrated to PEO level:
1. Read all PLO mappings for the programme
2. Group PLOs by parentPEO
3. For each PEO: union all SDGs from child PLOs
4. Write to `PR_PEOMappings`
5. Remove SDG column from `PR_PLOMappings` rows (shift col 3+ left by one)

### Coverage matrix update
- **PEO coverage**: Now shows SDG per PEO (instead of rolling up from PLO SDGs)
- **PLO coverage**: Now shows SC + TF only (SDG removed)
- **Global coverage**: SDG from PEO level, SC/TF from PLO level

---

## Implementation Tasks

### Task 1: Data Model Migration

**Files:** `gas/ResearchDataService.gs`, `gas/ResearchMappingService.gs`

- [ ] Add `PR_PEOMappings` header to `RESEARCH_SHEET_HEADERS` in `ResearchDataService.gs`
- [ ] Add `PR_PEOMappings` to `RESEARCH_WORKSPACE_DATA_SHEETS`
- [ ] Add `peoMappingFromRow_()` in `ResearchMappingService.gs`
- [ ] Modify `PR_PLOMappings` header: remove `SDGIdsJson` (column 2), shift remaining left
- [ ] Update `mappingFromRow_()`: remove SDG parsing, adjust column indices
- [ ] Implement `migratePLOSDGToPEO_(key, sheets)` — one-time migration:
  - Read all PLO rows → group by parentPEO
  - For each PEO: union SDG IDs from all child PLO mappings
  - Write to `PR_PEOMappings` (upsert)
  - Remove SDG from `PR_PLOMappings` rows
  - Set a migration marker in `PR_ProgrammeProfile` (e.g., `SDGMigratedToPEO: true`)
- [ ] Call migration in `withPreparedResearchContext_()` after existing migrations
- [ ] Update `replaceResearchRows_` for 7-col PLO mappings width

### Task 2: PEO → SDG APIs

**Files:** `gas/ResearchMappingService.gs`

- [ ] `getPEOMappingsApi_(programmeIdOrMqaCode)` — returns `[{peoId, code, sdgIds, mappingNote}]`
- [ ] `savePEOMappingApi_(programmeIdOrMqaCode, peoId, mapping)` — saves `{sdgIds, mappingNote}`
- [ ] Update `getResearchCoverageApi_()`:
  - PEO coverage: read SDG from `PR_PEOMappings` directly
  - PLO coverage: read SC + TF only
  - Global coverage: SDG from PEO level union, SC/TF from PLO level union
- [ ] Update `researchMappingsFromRows_()`: remove SDG from PLO mapping projection
- [ ] Update `saveResearchPLOMappingApi_()`: remove SDG validation, keep SC + TF only
- [ ] Update `researchMappingForPLO_()`: remove SDG field
- [ ] Update `calculatePEOCoverage_()`: read SDG from PEO mappings instead of child PLO roll-up

### Task 3: Review & Heal Service Updates

**Files:** `gas/ResearchReviewService.gs`, `gas/ResearchHealService.gs`

- [ ] Update `validateResearchProgramme_()`:
  - PEO SDG check (warning if PEO has no SDG)
  - PLO SC check (warning if PLO has no SC)
  - Remove old PLO SDG check
  - Update metrics: `peoWithSDG`, `ploWithSC`, SDG coverage from PEO level
- [ ] Update `researchHealPLOIssues_()`: remove SDG check (SDG now at PEO level)
- [ ] Update `getResearchHealDetailApi_()`: include PEO-level SDG status

### Task 4: Code.gs API Wrappers

**Files:** `gas/Code.gs`

- [ ] `getPEOMappingsApi(programmeId)` → `getPEOMappingsApi_`
- [ ] `savePEOMappingApi(programmeId, peoId, mapping)` → `savePEOMappingApi_`

### Task 5: Apple-Inspired UI

**Files:** `gas/Index.html`, `gas/JavaScript.html`, `gas/Styles.html`

**Index.html — Tab Pemetaan layout:**
- [ ] Two sections with clear visual separation:
  - `peo-sdg-section`: PEO cards with SDG chips
  - `plo-sc-section`: Compact PLO rows with SC picker + TF badge
- [ ] Each PEO card shows: code, statement preview, SDG count badge
- [ ] SDG chips are tappable to remove, with `＋ Add SDG` button
- [ ] PLO rows: code, truncated statement, SC picker (dropdown/chip), TF badge (read-only)
- [ ] Coverage matrix remains collapsed at bottom

**JavaScript.html — State & methods:**
- [ ] `peoSDGMappings: {}` — keyed by peoId → `{sdgIds: [], note: ''}`
- [ ] `loadPEOMappings()` — fetch from getPEOMappingsApi
- [ ] `toggleSDGOnPEO(peoId, sdgId)` — add/remove, auto-save
- [ ] `savePEOSDGMapping(peoId)` — persist to savePEOMappingApi
- [ ] `selectSCForPLO(ploId, scId)` — single select, auto-save
- [ ] SDG popover state: `sdgPopoverOpen: null` (peoId or null), `sdgPopoverSDGs: []`
- [ ] Keep existing PLO save/mapping logic but remove SDG from it
- [ ] `peoSDGDirty: false` — track unsaved changes per PEO
- [ ] Remove `loadHealReport()` SDG check (SDG now PEO-level)

**Styles.html — Apple-style CSS:**
- [ ] `.peo-sdg-card`: rounded-xl, soft shadow, bg-white, padding
- [ ] `.sdg-chip`: pill with SDG number + name, × to remove, color-coded by SDG category
- [ ] `.sdg-popover`: backdrop-blur overlay, centered popover with checklist
- [ ] `.plo-row`: compact flex row, horizontal padding, subtle separator
- [ ] `.sc-picker`: chip-style trigger, grouped dropdown
- [ ] `.tf-badge`: read-only pill, muted bg, derived label tooltip
- [ ] Section headers: uppercase, tracking-wider, muted color, 14px

### Task 6: Tests

**Files:** `scripts/test-research-mapping.js`, `scripts/test-research-heal.js`, `scripts/test-assessment-mapping.js`

- [ ] Add PEO mapping tests:
  - Save/read PEO SDG mappings
  - SDG migration: PLO SDGs unioned to PEO correctly
  - PLO column shift after SDG removal
- [ ] Update existing tests:
  - `mappingFromRow_`: expect 7 cols (was 8)
  - PLO mapping save: no SDG field
  - PEO coverage: SDG from PEO level, not PLO roll-up
  - Review: PEO SDG warning, PLO SC warning, no PLO SDG check
- [ ] Update heal tests: no SDG in PLO issues

### Task 7: Verification

```bash
node scripts/test-research-mapping.js
node scripts/test-research-heal.js
node scripts/test-assessment-mapping.js
node scripts/test-task7-boundaries.js
node -e "const fs=require('fs'); for (const f of fs.readdirSync('gas').filter(f=>f.endsWith('.gs'))) new Function(fs.readFileSync('gas/'+f,'utf8')); console.log('GAS syntax passed.');"
git diff --check
```

---

## Rules
- Do NOT modify `gas/Config.gs` or `gas/.clasp.json`
- Do NOT run `clasp push` or `clasp deploy`
- Follow existing code patterns: `LockService` for writes, `requireProgrammeAccess_` for guards
- PEO SDG is multi-select (0–17 SDGs per PEO)
- PLO SC is single-select (exactly 1 SC per PLO, or empty = Needs attention)
- TF is server-derived only (label: `Derived from MQF`)
- Migration must be **non-destructive**: preserve existing data, transform in place
- Shared MQA: PEO SDGs are owned by the owner programme (same as PEO/PLO)
- The `DefaultSDGIdsJson` on `PR_ProgrammeProfile` SHOULD NOW SEED PEO SDGs on first access (instead of being unused). This replaces the old pattern where programme-level SDG defaults had no destination.
