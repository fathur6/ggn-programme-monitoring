# MQF 2.0 Interface Rebuild Design

## Goal

Rebuild the complete MQF 2.0 web application interface for faculty programme editors while preserving the existing Apps Script backend, Google Sheet structure, Drive behavior, and stored data.

## Approved Direction

- Interaction model: Guided Completion.
- Visual language: Operational Clarity.
- Scope: Entire application, including programme dashboard, PEO/PLO mapping, graph, review and submission, documents, approvals, and admin tools.
- Primary users: Faculty programme editors.
- Interface language: English.
- Data strategy: Preserve the existing backend and Sheet structures; minimize deployment risk.

## Users And Access Control

Faculty users are scoped to their own faculty's programmes. They can view and edit only data they are authorized to access. This scope must be enforced server-side, not merely by filtering the frontend list. Direct requests for another faculty's programme must return a permission failure or no authorized data.

Administrative users retain broader access according to the existing authorization rules. The redesign must not weaken authorization around programme administration, approvals, spreadsheet preparation, or document deletion.

## Information Architecture

The application uses a persistent workspace shell with the following modules:

- **Overview:** assigned programmes, completion status, recent activity, and next actions.
- **Programmes:** searchable programme list grouped by level and faculty, scoped to the current user.
- **Programme Workspace:** persistent programme identity and status context.
- **PEOs:** guided entry and review of Programme Educational Objectives.
- **PLOs:** guided entry of Programme Learning Outcomes, including description, MQF Domain, Taxonomy, and PEO mapping.
- **Review & Submit:** validation summary, mapping health, MQF metadata coverage, document readiness, and final confirmation.
- **Graph:** relationship view for PEOs, PLOs, MQF Domains, Taxonomy values, and mappings.
- **Documents:** supporting-document upload, preview, and deletion-request workflow.
- **Admin:** approvals, programme administration, and spreadsheet preparation for authorized users.

The primary editor path is:

`Overview -> Select Programme -> PEOs -> PLOs -> Review & Submit`

Each step exposes completion status, missing-field warnings, save state, previous/next navigation, and the persistent programme identity header.

## Interaction Model

The workspace uses a compact progress sequence: `PEOs -> PLOs -> Review & Submit`.

PEO and PLO records are represented as concise summary rows. Only one record is actively edited at a time. Completed records collapse to show their code, description summary, and validation state. The active editor exposes explicit labels, required-field indicators, character guidance, and inline validation.

PLO editing keeps the following fields visible and prominent:

- PLO description.
- MQF Domain.
- Taxonomy.
- Embed in PEO mapping.

MQF Domain and Taxonomy are first-class monitored data. They contribute to step completion, dashboard warnings, review coverage summaries, filters, and graph relationships. Missing or incomplete values must not be hidden as secondary metadata.

The interface provides:

- Visible save state and an explicit save action for persistence.
- Previous/Next navigation that validates the current step before advancing.
- Confirmation and safe undo behavior for destructive removal.
- Stable PEO/PLO codes, with new codes generated from the highest existing code rather than current array length.
- Unsaved-change protection during navigation.
- A relationship summary that makes PEO-to-PLO mappings understandable without requiring users to scan long selector lists.
- Single-column mobile editing with sticky step controls and bottom action navigation.

## Visual System

The visual language is Operational Clarity:

- Slate-neutral workspace background with white content surfaces.
- Bright green reserved for completed states, primary actions, and positive progress.
- Amber for warnings, including incomplete MQF Domain or Taxonomy values.
- Red limited to destructive actions and blocking validation errors.
- Strong programme identity header containing level, faculty, MQA code, and status.
- Compact typography hierarchy suitable for long academic text.
- Consistent status badges: `Complete`, `Needs attention`, `Draft`, and `Submitted`.
- Dense summary rows with more generous spacing inside the active editor.
- Responsive layouts that prioritize editing, validation, and navigation on small screens.
- Keyboard focus, accessible labels, adequate contrast, and practical touch targets.

The design should feel like an operational academic control surface, not an unstructured form or generic spreadsheet.

## Data Flow And Backend Compatibility

The frontend remains a compatibility layer over the existing Apps Script services.

- Preserve current Google Sheet columns and stored values.
- Preserve Drive folder behavior and supporting-document conventions.
- Preserve service function contracts wherever possible.
- Normalize existing service responses into a frontend view model without migrating stored data.
- Keep PEO/PLO codes stable when editing existing records.
- Identify save operations by the specific programme and record being updated.
- Validate description, MQF Domain, Taxonomy, and PEO mapping before marking a PLO step complete.
- Preserve user edits when a save fails and provide retryable feedback.
- Design explicit loading, empty, permission, and server-error states.
- Block submission when required PEO/PLO data, MQF metadata, mappings, or required documents are incomplete.
- Retain existing document preview, upload, deletion-request, and administrator-trash behavior.

Any backend authorization gaps discovered during implementation must be addressed before relying on the redesigned frontend for faculty isolation. Client-side filtering alone is not an acceptable access-control mechanism.

## Module Behavior

### Overview And Programme Selection

The overview shows only authorized programmes and summarizes readiness using actionable status counts. Users can search and filter by programme level, status, missing MQF metadata, and document readiness.

### PEO Workspace

Editors can add, edit, reorder, save, and remove PEO records. Each record has a stable code and a compact summary state. Removal is confirmed and does not create future code collisions.

### PLO Workspace

Editors can add, edit, reorder, save, and remove PLO records. Each PLO exposes description, MQF Domain, Taxonomy, and PEO mapping in the active editor. Summary rows show the MQF Domain and Taxonomy state so incomplete metadata is visible without reopening every record.

### Review And Submit

Review presents:

- Missing required fields.
- PEO and PLO counts.
- MQF Domain coverage.
- Taxonomy coverage.
- PEO-to-PLO mapping coverage and unmapped outcomes.
- Document readiness.
- Submission status and any blocking conditions.

### Graph

Graph view represents PEO, PLO, MQF Domain, Taxonomy, and mapping relationships accurately. It remains an explanatory view and does not replace the guided editor.

### Documents

The document module retains the existing Google Drive-backed behavior: upload, list, preview, and role-sensitive deletion or deletion request. It reports document readiness in the review workflow.

### Admin

Authorized admin workflows remain available without exposing admin actions to faculty editors. Existing approval and programme-management behaviors should be preserved while receiving the new shell and status language.

## Error Handling And Safety

- Loading states prevent accidental duplicate actions.
- Empty states explain what the user can do next.
- Permission failures clearly indicate that the programme is outside the user's access scope.
- Server failures preserve unsaved local edits and expose retry actions.
- Blocking validation appears inline and in the review summary.
- Destructive actions are labeled by context, such as `Remove PLO PLO3`, rather than generic `Remove`.
- Navigation away from dirty data requires confirmation.
- Authorization remains enforced server-side for faculty scope, administration, and document deletion.

## Acceptance Criteria

The rebuild is accepted when the following workflows work:

1. A faculty editor signs in and sees only programmes authorized for that faculty.
2. The editor opens a programme and sees its identity, status, and completion progress.
3. The editor creates, edits, reorders, and removes PEOs without duplicate codes.
4. The editor creates PLOs with description, MQF Domain, Taxonomy, and PEO mappings.
5. Incomplete MQF Domain and Taxonomy data is clearly identified before review.
6. The editor can complete `PEOs -> PLOs -> Review & Submit`, with required validation blocking incomplete progress.
7. Save failures retain edits and provide retryable feedback.
8. Unsaved changes are protected during navigation.
9. Review summarizes missing fields, mapping coverage, MQF metadata coverage, and document readiness.
10. Graph view reflects PEO, PLO, MQF Domain, Taxonomy, and mapping relationships.
11. Documents can be uploaded and previewed, with deletion behavior determined by role.
12. Authorized administrators retain approval and programme-administration capabilities.
13. The interface remains usable at desktop and mobile widths with long academic descriptions and dense PLO metadata.
14. Existing Apps Script service calls and stored Sheet/Drive data remain compatible.

## Verification Strategy

Verification will use static source checks, focused frontend behavior checks where feasible, and browser-based inspection of the main editor workflow at desktop and mobile widths. Verification must include faculty-scope enforcement and MQF Domain/Taxonomy completeness, not only visual rendering.

## Out Of Scope

- Database or Google Sheet schema migration.
- Replacement of Google Drive as supporting-document storage.
- Replacing the Apps Script deployment platform.
- Introducing a new frontend framework or external backend.
- Rebuilding unrelated business rules that do not affect the redesigned workflows.
