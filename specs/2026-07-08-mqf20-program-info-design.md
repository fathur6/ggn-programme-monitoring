# MQF 2.0 Program Information System — Design Spec

**Date:** 2026-07-08
**Version:** 1.0

## 1. Overview

A Google Apps Script web app for managing MQF 2.0 program data: Programme identity, PEO (Programme Educational Objectives), PLO (Programme Learning Outcomes), and their cross-mappings to TF (Threshold Frequency), SDG (Sustainable Development Goals), SC (Sustainability Criteria), and MQF 2.0 Domains.

The system supports role-based access (faculty PICs, Graduate Coordinators, PPS Admin), data entry with per-program accordion panels, graph visualization of entity relationships, and an in-app suggestion/approval workflow for add/remove actions.

## 2. Google Sheets Structure

### Sheet 1: Programme (gid=0)
- 67 rows, one per programme
- Identity columns: Program Name (Malay), MQA Reference Code, NEC 2020, Program Code, Accreditation Approval
- Column K: Mode of Study (Coursework/Research/Mixed)
- 13+ faculties

### Per-Program Tabs (67 sheets)
Named by MQA code (e.g., FA5581). Two vertical sections in each tab:

**Section A — PEO (Programme Educational Objectives)**
| Column | Field | Description |
|--------|-------|-------------|
| A | PEO Code | e.g., PEO1, PEO2 |
| B | PEO Description | Text |
| C | Domain | e.g., Cognitive, Affective, Psychomotor |
| D-G | TF Mapping | Binary flags to 4 TF items |
| H-X | SDG Mapping | Binary flags to 17 SDG items |
| Y-? | SC Mapping | Binary flags to 8 SC items |

**Section B — PLO (Programme Learning Outcomes)**
| Column | Field | Description |
|--------|-------|-------------|
| A | PLO Code | e.g., PLO1, PLO2 |
| B | PLO Description | Text |
| C | Embedded PEO | Which PEO(s) this PLO maps to |
| D-N | MQF 2.0 Domain | 11 sub-domains across 5 clusters |
| O+ | PLO Mapping | Additional mapping data |

### Sheet 2: PIC (gid=1416849652)
Maps faculty → Graduate Coordinator (name + email) → Faculty PIC (name + email). Used for auth.

### Sheet 3: PPS (inferred)
Admin staff: Name, Email, Position. Used for admin auth.

## 3. Data Model (Graph)

```
Programme ──has──▶ PEO
Programme ──has──▶ PLO
PEO ──embeds──▶ PLO         (which PEO is embedded in a PLO)
PEO ──maps_to──▶ TF          (1-4)
PEO ──maps_to──▶ SDG         (1-17)
PEO ──maps_to──▶ SC          (1-8)
PLO ──classified_as──▶ MQF_Domain  (11 sub-domains, 5 clusters)
```

## 4. Architecture

**Backend:** Google Apps Script (single GAS project)
**Frontend:** HtmlService serving HTML/CSS/JS web app
**Database:** Google Sheets (existing workbook)
**Auth:** Google OAuth via `Session.getActiveUser().getEmail()` restricted to `@unisza.edu.my`

### Auth flow:
1. User opens web app → GAS checks `Session.getActiveUser().getEmail()`
2. Email must end with `@unisza.edu.my`
3. Lookup email in Sheet 2 (PIC) → determine Faculty + role (Graduate Coordinator / Faculty PIC)
4. Lookup email in Sheet 3 (PPS) → role = Admin (PPS)
5. If not found in either → deny access

### Permissions:
| Action | Faculty PIC | Grad Coordinator | Admin |
|--------|-------------|-----------------|-------|
| View own faculty programmes | ✓ | ✓ | ✓ |
| View all programmes | - | - | ✓ |
| Edit programme data (own faculty) | ✓ | ✓ | ✓ |
| Edit any programme | - | - | ✓ |
| Upload attachments | ✓ | ✓ | ✓ |
| Suggest Add programme | ✓ | ✓ | ✓ |
| Suggest Remove programme | ✓ | ✓ | ✓ |
| Approve/Reject suggestions | - | - | ✓ |

## 5. UI Structure

### 5.1 Main View — Programme List
- Faculty filter (Admin sees all; PIC/Coord sees their own)
- Programme cards/table showing: Program Name, MQA Code, Mode, Faculty
- Click to open programme detail

### 5.2 Programme Detail (Toggle View)

**Mode toggle button:** Switch between **Graph View** and **Entry View** (default)

**Entry View** — Vertical accordion sections:
- **Programme Identity** (read from Programme sheet)
- **PEO Section** — table of PEO rows with TF/SDG/SC checkbox matrix
- **PLO Section** — table of PLO rows with MQF Domain dropdown/sliders, PEO embed selector
- Each row inline-editable; Add/Delete row buttons per section

**Graph View** — D3.js/vis.js force-directed graph:
- Nodes: Programme, PEOs, PLOs, TF items, SDG items, SC items, MQF Domains
- Edges: coloured by type (has, maps_to, embeds, classified_as)
- Click a node: highlight connected subgraph
- Hover: show label + type

### 5.3 Admin Panel — Pending Suggestions
- List of Add/Remove suggestions with: suggester, programme info, timestamp, status
- Approve / Reject buttons per row
- Rejection requires reason

### 5.4 File Upload & Preview
- Upload PDF files to a per-program Google Drive folder
- Rename convention: `{MQA_CODE}-DCI-{DDMMYYYY}.pdf` (DCI) or `{MQA_CODE}-OTH-{DDMMYYYY}.pdf` (Other)
- Same file can be re-uploaded on different dates (different filename by date)
- Uploaded file list displayed below the section with: filename, upload date, uploader
- Each file has a **Delete** button (marks for deletion) — requires **Admin approval** to execute
- Click a file name → opens PDF in an inline iframe via `https://drive.google.com/file/d/{FILE_ID}/preview`

## 6. Concurrency (20 simultaneous users)

- GAS runs each user's execution in their own isolated scope
- Lock Service (`LockService.getScriptLock()`) for write operations to prevent simultaneous Sheet edits
- 30-second lock timeout, retry dialog on failure
- Sheet data source means all users see the same live data (no stale cache)
- For 100+ tabs: lazy-load only the active programme's tab data; Programme sheet cached on load

## 7. Key Implementation Details

### Google Apps Script Structure
```
Code.gs              — doGet(), routing
Auth.gs             — Session check, role resolution
Programme.gs         — CRUD for Programme sheet
PEOService.gs        — CRUD for per-tab Section A
PLOService.gs        — CRUD for per-tab Section B
GraphService.gs      — build graph JSON from entity data
Suggestions.gs       — add/remove suggestion + approval workflow
UploadService.gs     — Drive file upload
Index.html           — HtmlService template + embedded JS
Styles.html          — CSS
JavaScript.html      — JS modules (Vue 3 + Tailwind CSS, CDN-loaded)
```

### Data Manipulation
- All edits target the spreadsheet directly (real-time, no intermediate database)
- Row-level: each PEO/PLO is one row per tab sheet
- TF/SDG/SC mappings: columns in PEO section rows
- MQF Domain: columns in PLO section rows

### Edit Conflict Detection
- LockService guards prevent simultaneous write collisions
- On save, compare modification timestamp with the value at load time
- If another user edited the same row since load: show diff and ask which version to keep
- Abandoned edits (tab closed without save) are discarded automatically

## 8. Open Questions
- MQF 2.0 domain taxonomy exact column layout
- Whether sessions need logging/audit trail

## 9. Implementation Plan (Next Steps)

1. Create GAS project, link existing spreadsheet
2. Implement Auth module (Session check + role resolution)
3. Build Programme sheet reader + per-tab lazy loader
4. Implement Entry View (accordion, PEO/PLO CRUD)
5. Implement Graph View (D3.js/vis.js rendering)
6. Implement suggestion/approval workflow
7. Add file upload capability
8. Test concurrency (LockService)
9. Deploy as GAS Web App
