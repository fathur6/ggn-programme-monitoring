# Pengurusan Akademik Pascasiswazah UniSZA

GGN MQF 2.0 programme information and mapping module.

Google Apps Script web application for managing MQF 2.0 programme information at the UniSZA Graduate School.

## Lightweight Iteration (v34 baseline)

The lightweight branch (`lightweight/v34-sdg-plo-mapping`) replaces the modular application with the compact v34 deployment baseline: `gas/Code.js`, `gas/Index.html`, and `gas/appsscript.json`. SDG/SC mappings for the PhD programmes `MQA/FA5573` and `MQA/FA5574` sit on `PLO10` (`PLO10 → SDG12 → SC8`); Masters programmes keep `PLO11`. PDF download uses Drive's native conversion (no `UrlFetchApp`) with hidden gridlines.

![MQF 2.0 (2024) Mapping](https://i.postimg.cc/3JfpSBdh/MQF_2.0_%282024%29_Mapping.png)

## Pages and routing

The web app is multi-page: `doGet` routes on `?page=` and resolves the Google
session plus the page data on the server, so each page arrives already populated.

| Route | Template | Purpose |
|---|---|---|
| `?page=programmes` (default) | `PageProgrammes.html` | Programme directory, grouped by level and faculty |
| `?page=detail&mqaCode=MQA/FA5589` | `PageProgrammeDetail.html` | PEO/PLO records, editor and PDF for one programme |
| any page without a valid session | `AccessDenied.html` | Domain / registration / access message with a retry link |

Shared files: `Index.html` (shell), `Styles.html` (CSS), `AppJs.html` (one Vue
instance for both pages, reading the server-injected `BOOT` payload).
Programme rows and the "Back to programmes" control are real links, so a detail
page can be bookmarked or shared.

## Programme source copy

The PJK workbook (`Status Semakan Maklumat Program Akademik Siswazah.xlsx`) is
mirrored into the `ProgrammeSource` tab of our workbook: 67 programmes with the
Excel columns (student names in both languages, MQA code, accreditation start and
end, NEC 2010 and 2020 fields, mode of study, category) plus the faculty section
each programme sat under. The extracted source is kept at
`docs/import/programme-source-2026-11.json`.

The tab is a read-only copy for reference and recovery; the app still reads the
`Programme` sheet.

## Review status (semakan program)

A periodic review cycle (every 4–6 months) where each faculty reports the status
of its programmes. Data lives in the same workbook:

| Tab | Purpose |
|---|---|
| `ReviewPeriods` | One row per cycle: `PeriodId`, title, cut-off label, open/close window, state |
| `ReviewSubmissions` | Append-only history: period, programme, faculty, free-text status, author, timestamp |
| `ReviewRoles` | Explicit authority: `PJK` (quality coordinator) and `TDA_PPS` (deputy dean, backup) |

History from the legacy `Status Semakan Maklumat Program Akademik Siswazah.xlsx`
(five cut-off dates, 13/03/2025 to 15/08/2026, 282 entries) was imported with the
faculty's Deputy Dean (Academic) recorded as the author, because those rows carry
no user. Entries are captured in `docs/import/review-history-2026-08.json`.

PJK and TDA PPS open and close each cycle from the admin page; a programme with no
submission when the cycle closes is reported as "Tidak dikemaskini".

The admin console lives at `?page=review` (PJK, TDA PPS or an admin only). It opens
and closes cycles — opening one closes any other — sets the cut-off and closing
dates, and shows completion per faculty plus any submission whose MQA code has no
row in the `Programme` sheet.

On the programme page the register appears as a collapsed **Status Semakan**
accordion below the generated-PDF table: the current cycle with a free-text box
(any coordinator, PIC or deputy dean of that faculty, while the cycle is open),
then the history newest first with author and date. Submissions are append-only,
so a correction adds a revision instead of erasing the previous text.

## Generated PDFs

Every generated PDF is recorded in the `PDF_Log` sheet inside the workbook and
listed at the bottom of the programmes page: file name, programme, faculty,
timestamp and the account that generated it.

- `generatePdfApi` writes a row (`Source = generate`) with the signed-in user's
  name and email.
- `?setup=pdflog` (admin) backfills files that already exist in the Drive folder.
  Historical files carry no author, so the faculty's Deputy Dean (Academic) is
  recorded as the stand-in author and `Source = backfill`.
- Faculty see only their own faculty's rows; admins see everything.
- The programmes page lists every PDF for the viewer's faculty; the programme
  detail page lists only that programme's files.
- Files are opened through the Drive `/view` link in a new tab (the same pattern
  as `ggn-meeting-management`). There is no delete action anywhere in the app.
- Access is controlled on the **Drive folder**, not per file: `DriveApp.setSharing`
  is rejected by the account's sharing policy, so the folder must be shared as
  "Universiti Sultan Zainal Abidin — Viewer". Files created inside inherit it.

## Shared MQA codes (owner vs partner faculty)

Some MQA codes are offered by more than one faculty. The first row for a code
owns the shared content; every other row is a partner with its own content.

- **Sheet columns** on `Programme`: `J = Peranan` (`Pemilik` / `Berkongsi`) and
  `K = Fakulti Pemilik`. Blank values fall back to "first row owns it", so the app
  keeps working before the columns are filled.
- **Tabs**: the owner keeps the MQA tab (`MQA/FA5589`); a partner stores its own
  content in `<MQA code>__<FACULTY>` (for example `MQA/FA5589__ESERI`). Sheet
  names legitimately contain `/`; `.xlsx` exports strip it, so check names in the
  spreadsheet UI rather than in an export.
- **Partner flow**: on its first access the partner's tab is created automatically
  by cloning the owner tab (serialised with `LockService`, idempotent, never
  overwrites an existing tab). The partner then edits its own tab freely — the
  owner is untouched. A programme whose owner has no tab yet gets an empty seed
  tab instead.
- **Status**: the page compares the partner tab with the owner on every load and
  shows "Sama dengan fakulti pemilik" or "Berbeza dengan fakulti pemilik".
- **Setup**: visit `?setup=sharedrole` as an admin once to write the two columns
  and mark the first row of each duplicated code as the owner. The routine never
  overwrites values that are already filled.

## Local Project

The deployable source is under `gas/`. It includes the recovered unsanitized local configuration and clasp metadata, which are intentionally ignored by Git. The matching Apps Script project ID is stored in `gas/.clasp.json`.

The application provides postgraduate research programme, PEO, PLO, MQF Domain and Taxonomy mapping, review readiness, governance queues, temporary access requests, authentication, and secure administration services. Graph and supporting-document services remain outside the research workspace. The design specification and implementation plan are under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Research Migration Boundary

New model: ProgrammeProfile → PEO/PLO/MQF/Taxonomy → PLO mappings → TF/SDG/SC

- TF: derived from MQF reference relationships
- PEO: derived from child PLO mappings
- Course-based production data: not transformed or deleted automatically
- Deployment: no clasp push/deploy in local implementation verification

The public application path is restricted to postgraduate research programmes. Existing course-based spreadsheet rows remain untouched, and no automatic conversion, hidden compatibility module, graph panel, or document panel is added to the research workspace.

## Operating Model

- Faculty editors can view and edit programme content within their own faculty.
- Graduate School administrators can review all faculties, manage approvals, and maintain revisions, audits, and central administration requests.
- The university overview exposes aggregate readiness signals by default; programme detail remains authorization-scoped.
- Faculty users can request access to a specific faculty or MQA programme. Approved access is scoped to that request and expires automatically after seven days.
- Governance status tracks PEO/PLO descriptions, MQF Domain, Taxonomy, PEO mapping, documents, review, and submission readiness.

Governance data is additive. The application lazily creates `ProgrammeStatus`, `GovernanceItems`, and `AccessRequests` sheets without changing the existing `Programme` or per-programme sheet layouts.

## Development

Install clasp if needed:

```bash
npm install -g @google/clasp
```

From `gas/`:

```bash
clasp pull
clasp push
clasp version "description of changes"
clasp deploy -V <version> -i <deployment-id> -d "description"
```

Local implementation verification does not run `clasp push` or `clasp deploy`.

Do not commit `gas/Config.gs` or `gas/.clasp.json`. They contain deployment-specific configuration and credentials.

## Required Deployment Configuration

The application now has **one workbook and no client secrets**:

- `gas/Code.js` holds `PROGRAMME_SPREADSHEET_ID_` (the PPS programme workbook) and `PDF_FOLDER_ID_`. Programme records, the `PDF` destination and the `USER`/`ADMIN` login directory all live in that single workbook; do not introduce a second spreadsheet ID.
- Sign-in uses the Google Workspace session of the signed-in account. The deployment is
  `executeAs: USER_DEPLOYING` with `access: ANYONE` so that a personal Google account still
  reaches our own prompt instead of Google's "Page Not Found". UniSZA accounts are identified
  by `Session.getActiveUser()`; anyone else gets `AccessDenied.html` with an
  `accounts.google.com/AccountChooser` link back to the same page. No OAuth client ID or
  secret is required or stored.
- `gas/.clasp.json` must identify the Apps Script project and use `rootDir` pointing to `gas/` when clasp is run from the repository root, or an empty `rootDir` when run from `gas/`.
- The deploying Google account must have Apps Script project access, spreadsheet access, Drive access, and permission to manage the intended deployment.

The example files contain placeholders only. Never paste real values into README files, static tests, screenshots, or shell output.

## Secret-handling Rules

- Treat `Config.gs`, `.clasp.json`, OAuth tokens, client secrets, spreadsheet identifiers, and Drive identifiers as restricted operational data.
- Do not print, commit, upload, or include restricted values in diagnostics, screenshots, issue reports, or deployment descriptions.
- Rotate credentials through the system owner if a restricted value is exposed.

## Verification

From the project root, run:

```bash
node scripts/test-single-workbook.js
node scripts/test-pps-v34-sdg-migration.js
node scripts/test-pdf-export-without-fetch.js
git diff --check
```

Tests for the modular application (`Auth.gs`, `AssessmentService.gs`, `Research*Service.gs`)
live in `scripts/legacy/` and only run against the modular branch/source. See
`scripts/legacy/README.md`.

The checks are static and syntax-based because the deployed Google Apps Script services require the UniSZA account, configured spreadsheet, Drive folder, and domain OAuth session.

### Task 8 Readiness Gate

Run each check independently from the project root:

```bash
node scripts/verify-mqf-rebuild.js
node scripts/test-research-mapping.js
node scripts/test-research-mapping-client.js
node scripts/test-mqf-overdue.js
node scripts/test-coor-access.js
node scripts/test-task7-boundaries.js
node -e "const fs=require('fs'); const s=fs.readFileSync('gas/JavaScript.html','utf8').replace(/^<script>\\s*/,'').replace(/\\s*<\\/script>\\s*$/,''); new Function(s); console.log('JavaScript syntax passed');"
node -e "for (const f of require('fs').readdirSync('gas').filter(f=>f.endsWith('.gs'))) new Function(require('fs').readFileSync('gas/'+f,'utf8')); console.log('GAS source syntax passed.');"
node -e "JSON.parse(require('fs').readFileSync('gas/appsscript.json','utf8')); console.log('Manifest JSON passed');"
git diff --check
git check-ignore -v gas/Config.gs gas/.clasp.json
git ls-files gas/Config.gs gas/.clasp.json
```

Before deployment, use an authorized test deployment and verify the following without changing production data:

- Login, dashboard, programme directory, `Maklumat Program`, `Pemetaan`, and `Review & Submit`.
- PEO parent and child PLO relationships.
- MQF multi-select and derived TF refresh.
- SDG/SC multi-select and PEO roll-up refresh.
- Coverage Matrix containment and accessible table headers at desktop and 390px widths.
- Invalid PLO warning or critical submit blocker.
- Unsaved-change navigation warning.
- Faculty isolation, access expiry, document permissions, and admin approval actions.

Do not submit, upload, delete, approve, send email, or run `clasp push`/`clasp deploy` during local verification. This repository has no local browser harness for the authenticated Apps Script session; browser checks require the authorized test deployment and representative accounts.

## Deployment Caution

Deploy only after reviewing the authorization changes in `Auth.gs`, `Code.gs`, `GovernanceService.gs`, and `AccessRequestService.gs`. Use a test deployment first, then verify faculty isolation, Graduate School drilldown, seven-day access expiry, document permissions, and admin approval actions with representative accounts. Do not expose the local `Config.gs` or `.clasp.json` contents in logs, commits, or screenshots.

## Secure Backup And Recovery

- Keep the real `Config.gs` and `.clasp.json` in the system owner’s approved password manager or encrypted institutional storage, not in Git or ordinary shared folders.
- Record the Apps Script project identity and deployment history in the owner’s secure operations record without recording OAuth tokens or client secrets in this repository.
- If the deployment computer is lost, install clasp on a replacement machine, authenticate with the authorized institutional account, restore the two ignored files from secure storage, run the static checks, and verify the target project with `clasp status` before any push.
- If either ignored file is unavailable, stop and recover it from the system owner. Do not reconstruct credentials from shell history or browser storage.

## Production Deployment Checklist

1. Run the static verifier, GAS syntax check, manifest JSON check, and `git diff --check`.
2. Confirm `gas/Config.gs` and `gas/.clasp.json` are ignored and untracked.
3. Test authorization with a Graduate School Admin and at least one faculty account.
4. Verify legacy debug, PIC, email, and update URLs return `Endpoint disabled`.
5. Verify deletion approval uses a specific Pending request and rejects mismatched or already processed requests.
6. Verify dashboard deadline display is `23 July 2026, 11:59:59 PM MYT` and overdue status uses `Asia/Kuala_Lumpur` semantics.
7. Use a test deployment first. Run `clasp push`, create a version, and update the intended deployment only after explicit production approval.

## Test Deployment Verification

After an authorized test deployment, verify login, faculty isolation, PEO/PLO saves, MQF Domain and Taxonomy readiness, document permissions, access-request expiry, admin deletion approval, and the fixed deadline with representative test data. No production deployment or external side effect is implied by local verification.

## Reference

The public sanitized project documentation is maintained at:

https://github.com/fathur6/ggn-mqf2-monitoring
