# Postgraduate Research Mapping Portal Design

**Date:** 2026-07-21  
**Status:** Approved design; implementation not started

## Goal

Replace the course-based interface with a postgraduate research programme workspace focused on programme information and PLO-level mapping. The portal will have no subjects, courses, CLOs, credit hours, course mappings, or DCI flows in the new model.

## Approved Scope

The existing portal will use a clean replacement model for the target postgraduate research workflow. The interface and new application logic will expose exactly two categories:

```text
Programme Workspace
├── Maklumat Program / Programme Information
│   ├── Programme Profile
│   ├── PEO & PLO
│   ├── MQF 2.0
│   └── Taxonomy
└── Pemetaan / Mapping
    ├── PLO → TF
    ├── PLO → SDG
    ├── PLO → SC
    └── PEO Coverage Summary
```

Course-based records are not brought into the new schema or used in new calculations. Existing production data is not physically deleted automatically; any archival activity is a separate, explicitly authorized operation.

## User Workflow

The primary editor path is:

```text
Programme Dashboard
  → Select Programme
  → Maklumat Program
  → Pemetaan
  → Review & Submit
```

The Programme Information category contains the profile, PEO records, PLO records, MQF 2.0 domains, and Taxonomy. The Mapping category contains the PLO mapping workspaces for TF, SDG, and SC, plus coverage and review.

PLO is the primary mapping unit. PEO is the parent hierarchy and summary layer. Each PLO has a valid parent PEO. PEO has no manual TF, SDG, or SC mapping form.

The Mapping category has two presentation modes:

- **PLO Workspace:** compact, editable PLO rows for daily entry.
- **Coverage Matrix:** read-oriented matrix for PPS audit and panel review.

Each workflow section displays `Complete`, `Needs attention`, or `Draft`. Save state and unsaved-change warnings are visible. There are no course-based labels, menus, components, or workflows.

## Data Model

### Programme Profile

```text
Programme
├── programmeId
├── facultyOrCentre
├── programmeName
├── studyLevel
├── studyMode = Postgraduate by Research
├── studyField
├── session
├── documentVersion
├── dataOwner
├── mappingStatus
├── createdAt
├── updatedAt
└── updatedBy
```

### PEO

```text
PEO
├── peoId
├── programmeId
├── code
├── statement
└── sortOrder
```

### PLO

```text
PLO
├── ploId
├── programmeId
├── parentPEO
├── code
├── statement
├── mqfDomains[]
├── taxonomy
├── rationale
├── sdgIds[]
├── scIds[]
├── status
├── updatedAt
└── updatedBy
```

The logical storage boundaries are:

```text
ProgrammeProfile
PEORecords
PLORecords
PLOMappings
MQFReference
TFReference
SDGReference
SCReference
```

`PLOMappings` stores the PLO mapping note, explicit SDG and SC selections, and the server-generated derived TF values. No course, subject, credit-hour, CLO, or DCI field is part of this model.

## Mapping Rules

### MQF and TF

Users select one or more valid MQF domains on each PLO. TF is not typed manually. The server derives TF from the MQF reference relationships:

```text
PLO → MQF Domains → TF derived from MQF mapping
```

The derived result is shown with the exact label `TF derived from MQF mapping`. A PLO may produce more than one TF. The user may add an interpretive note, but cannot edit derived TF into a conflicting manual mapping.

### SDG and SC

Users explicitly select zero or more valid SDG and SC references on each PLO. These are academic mapping decisions and are not inferred from MQF. The UI supports multiple selections for both reference sets.

### PEO Roll-up

For each PEO, the server computes the union of the mappings of all child PLOs:

```text
PEO TF coverage  = union(TF for child PLOs)
PEO SDG coverage = union(SDG for child PLOs)
PEO SC coverage  = union(SC for child PLOs)
```

PEO coverage is displayed with the label `Derived from PLO mappings`. The PEO summary also identifies child PLOs that are incomplete or still unmapped.

## Validation And Status

The system warns for:

- Empty PLO code.
- Duplicate PLO code within a programme.
- Empty PLO statement.
- Invalid or missing parent PEO.
- Invalid or missing MQF domain.
- Missing Taxonomy.
- PLO without SDG or SC mapping; this is a non-blocking review warning unless an explicitly configured programme review policy makes that mapping required.
- Overly general PLO statements requiring panel review.
- PLO concentration in one MQF domain.
- PEO without child PLOs.

TF is recalculated when `mqfDomains[]` changes. The system does not force every PLO to have every TF, SDG, or SC. Academic warnings do not prevent saving; critical structural errors prevent submission.

Programme status values are:

```text
Draft
Needs attention
Ready for review
Submitted
Approved
Returned for revision
```

`Ready for review` requires complete PLO codes and statements, valid parent PEOs, at least one MQF domain per PLO, no duplicate PLO codes, successful TF derivation, and no unresolved critical errors.

Review metrics include:

```text
PLO total
PLO statements complete
PLOs with MQF coverage
PLOs with SDG coverage
PLOs with SC coverage
MQF domain coverage
TF coverage
SDG coverage
SC coverage
PEOs with issues
```

## Security And Operations

- Programme access remains enforced server-side.
- Faculty users only access programmes within their authorized scope.
- Graduate School administrators retain university-wide access.
- PEO roll-up and TF derivation are calculated server-side, not trusted from browser payloads.
- SDG and SC selections are validated against server-side reference tables.
- Save, submit, approve, and review actions record `updatedBy` and `updatedAt`.
- Debug, email, PIC, and course-based public routes are not part of the new interface.
- Save conflicts use `LockService` and require reloading the latest data.
- Access-denied responses do not disclose programme detail.
- Reference changes trigger derived TF recalculation when a PLO is opened or saved.

## Migration Boundary

The new postgraduate research model is separate from the former course-based model. Course-based records are not transformed into PLO mappings automatically and are not included in the new readiness calculations. Existing data is not physically deleted by the implementation. If archival or cleanup is later required, it must be planned and authorized separately from this interface rebuild.

## Acceptance Criteria

1. The new interface contains no course-based navigation, labels, or workflows.
2. Editors can manage Programme Profile, PEO, and PLO records.
3. Every PLO can be assigned to a valid parent PEO.
4. Editors can select valid MQF domains and Taxonomy values.
5. TF is derived automatically from MQF relationships and labelled accordingly.
6. Editors can map SDG and SC values at PLO level.
7. PEO coverage is automatically calculated from child PLO mappings.
8. Review shows validation issues, coverage, and programme status.
9. Authorization is enforced server-side for all detail and mutation operations.
10. Course-based data is not mixed into the new schema or calculations.
11. The implementation does not perform destructive production data, Drive, Sheet, or deployment operations without explicit authorization.
