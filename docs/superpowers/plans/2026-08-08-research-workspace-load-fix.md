# Research Workspace Load Fix & Performance Optimization

> **For OpenCode.** Read fully before coding. Project: `gas/ggn-academic-management`

## Context — Already Completed

| Version | What |
|---|---|
| v89 | Shared MQA ownership (7 codes), heal report, PLO column soft validation |
| v91 | PEO→SDG + PLO→SC/TF data model redesign |
| v92 | Workspace lazy-load: 4 fast endpoints (profile,peos,plos,references), 3 lazy (mappings,coverage,review) |
| v93–v94 | Keyword-match 3 SDGs to last 3 PEOs, fix apply for existing programmes |
| v95–v96 | bulk-seed API for 62 programmes, retryResearchEndpoint accepts lazy endpoints |
| v97 | seedAllPLOSCDefaultsApi — MQF-based PLO→SC matching (225 PLOs seeded) |
| v98 | Batch-write seed pattern (read without lock, write under brief lock) |
| v99 | Removed broken `migratePLOSDGToPEO_` call (was silently crashing prepared context) |
| v100 | Re-added `migratePLOSDGToPEO_` with correct `access: access` object |

Database: Google Sheet (MQF 2.0 workbook — ID held in `gas/Config.gs`, not committed)

## Current Error

```
Research workspace could not be loaded.
ResearchWorkspaceError: Unable to load the research workspace.
Retry research workspace
```

The error appears in the web UI when opening a programme workspace. The workspace API (`getResearchWorkspaceApi_`) is timing out or throwing.

## Root Cause Analysis

`withPreparedResearchContext_()` runs sequentially:
1. `migrateLegacyResearchRowsNoLock_()` — reads legacy sheet, writes PR_ rows
2. `seedResearchReferencesNoLock_()` — reference seeding
3. `ensureProgrammeSDGDefaults_()` — SDG defaults + PEO→SDG matching
4. `migratePLOSDGToPEO_()` — reads all PLO mappings, migrates SDG to PEO
5. `getResearchReferencesNoLock_()` — loads reference data

On first access for a programme, this is SLOW (many sheet reads/writes). Even on subsequent access, the snapshot path still has overhead.

GAS has a 6-minute execution limit. If all the above takes >6 minutes (on a cold sheet with many rows), the request times out.

## Fixes Needed

### Fix 1: Migration Guard — Early Exit for Already-Migrated Programmes

Add a lightweight check at the TOP of `withPreparedResearchContext_()`:

```javascript
// Check if this programme is fully set up — skip heavy work if done
var profileRows = researchRows_(sheets.PR_ProgrammeProfile).filter(...);
if (profileRows.length > 0) {
  var profile = profileFromRow_(profileRows[0]);
  if (profile.mappingStatus === 'Active') {
    // Already fully set up — skip migration and seeding
    return reader({ programme: context.programme, key: context.key, effectiveKey: context.effectiveKey, sheets: sheets, references: references });
  }
}
```

Actually, simpler: check if PR_PEORecords + PR_PLORecords already have rows for this key. If yes, skip migration. Seed only if needed.

### Fix 2: Lazy-Apply SDG/SC Defaults on Read-Only Path

The snapshot (lock-free) path in `tryResearchReadContext_()` should never trigger migrations or seeding. Verify it's clean.

### Fix 3: Reduce Sheet Reads

`migratePLOSDGToPEO_()` calls `researchRows_(sheets.PR_PLOMappings)` which re-reads the entire sheet. Cache reads within the prepared context scope.

### Fix 4: Workspace Timeout Recovery

Add a lighter fallback: if the full workspace API times out, return profile+peos only and trigger lazy loads for the rest.

### Fix 5: Verify v100 Deployment Fix Works

Run `seedAllPEOSDGDefaultsApi()` and `seedAllPLOSCDefaultsApi()` from console to pre-seed all 62 programmes. Then opening any programme should skip all seeding/migration and load fast.

## Files to Modify

- `gas/ResearchMappingService.gs` — `withPreparedResearchContext_()`, `migratePLOSDGToPEO_()`, `tryResearchReadContext_()`
- `gas/ResearchWorkspaceService.gs` — workspace timeout handling
- `gas/ResearchLockService.gs` — may need higher lock timeout
- `gas/JavaScript.html` — client-side retry UI improvements

## Rules

- Do NOT modify `gas/Config.gs` or `gas/.clasp.json`
- Do NOT run `clasp push` or `clasp deploy`
- Run all tests after changes: `node scripts/test-research-*.js`
- GAS syntax check: `node -e "const fs=require('fs'); for (const f of fs.readdirSync('gas').filter(f=>f.endsWith('.gs'))) new Function(fs.readFileSync('gas/'+f,'utf8')); console.log('GAS OK');"`
- JS syntax: `node -e "const fs=require('fs'); const s=fs.readFileSync('gas/JavaScript.html','utf8').replace(/^<script>\s*/,'').replace(/\s*<\/script>\s*$/,''); new Function(s); console.log('JS OK');"`

## Priority

1. **FIX 5 first (highest priority)**: Pre-seed everything — this eliminates the entire seeding/migration path for all 62 programmes
2. Fix 1: Migration guard for edge cases
3. Fix 2: Verify lock-free path is clean
4. Fix 3: Cache optimization
