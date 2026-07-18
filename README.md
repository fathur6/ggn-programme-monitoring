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

## Reference

The public sanitized project documentation is maintained at:

https://github.com/fathur6/ggn-mqf2-monitoring
