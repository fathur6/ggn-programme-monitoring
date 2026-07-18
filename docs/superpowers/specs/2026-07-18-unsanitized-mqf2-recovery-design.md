# Unsanitized MQF 2.0 Project Recovery

## Goal

Restore the complete unsanitized local source for the MQF 2.0 monitoring Google Apps Script project into `/Users/aman/Documents/ggn-academic-management` so the project can be maintained locally and later synchronized with the public GitHub repository.

## Source Of Truth

The source is the existing OneDrive project at:

`/Users/aman/Library/CloudStorage/OneDrive-UniversitiSultanZainalAbidin-UniSZA/UniSZA Graduate School (OneDrive)/MQF2.0 (2024)/Draf & Pembangunan`

Its `gas/.clasp.json` contains the supplied script ID `1SM9BUFAg6bykFKD8lbBs_R_wpnwbnM4-cMpX86okw8Gwzrmk8HzhuMsK`, confirming that this is the matching project. The public GitHub repository is a sanitized reference and is not used to overwrite the newer local source.

## Transfer Boundary

Copy these application and project files:

- `gas/`, including unsanitized `Config.gs` and `.clasp.json`
- `README.md`
- `.gitignore`
- `specs/`
- `plans/`

Do not copy generated or session-specific artifacts, including screenshots, Playwright logs, `graphify-out/`, `.superpowers/`, `page-snapshot.txt`, and `send_announcement.py`.

## Secret Handling

The unsanitized `gas/Config.gs` and `gas/.clasp.json` are required for local deployment work but must remain ignored by Git. The transferred `.gitignore` must be checked before the initial commit, and secret contents must not be printed in verification output.

## Verification

After transfer:

1. Confirm the target file set and source file count match the approved boundary.
2. Confirm the target script ID matches the supplied deployment script ID without exposing other config values.
3. Confirm `Config.gs` and `.clasp.json` are ignored and absent from the staged initial commit.
4. Confirm the target has a clean initial Git commit containing the non-secret application source and project documents.
5. Run available static checks appropriate to the GAS project, including JSON parsing for `appsscript.json` and a source diff/checksum comparison against the OneDrive source.
