# GGN MQF 2.0 Programme Information Monitoring

Google Apps Script web application for managing MQF 2.0 programme information at the UniSZA Graduate School.

## Local Project

The deployable source is under `gas/`. It includes the recovered unsanitized local configuration and clasp metadata, which are intentionally ignored by Git. The matching Apps Script project ID is stored in `gas/.clasp.json`.

The application provides programme, PEO, PLO, MQF Domain and Taxonomy mapping, relationship graph, supporting-document upload, review readiness, suggestions, governance queues, temporary access requests, authentication, and email announcement services. The design specification and implementation plan are under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

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

Do not commit `gas/Config.gs` or `gas/.clasp.json`. They contain deployment-specific configuration and credentials.

## Required Deployment Configuration

Create the ignored files locally from the examples:

- `gas/Config.gs` must define `SHEET_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `DRIVE_FOLDER_ID` with values supplied by the system owner.
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
node scripts/verify-mqf-rebuild.js
node -e "const fs=require('fs'); const files=fs.readdirSync('gas').filter(f=>f.endsWith('.gs')||f.endsWith('.html')); for (const f of files) { const s=fs.readFileSync('gas/'+f,'utf8'); if (f.endsWith('.gs')) new Function(s); } console.log('GAS source syntax passed.');"
git diff --check
```

The checks are static and syntax-based because the deployed Google Apps Script services require the UniSZA account, configured spreadsheet, Drive folder, and domain OAuth session.

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
