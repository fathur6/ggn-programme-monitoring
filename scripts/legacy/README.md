# Legacy tests — modular application (not the v34 app)

These scripts test the **modular** application (`Auth.gs`, `AssessmentService.gs`,
`Research*Service.gs`, `JavaScript.html`, `Styles.html`, …). That source lives on
the remote branch `origin/fathur6/daf-5-elaborate-faculty-readiness-table` and in
the Apps Script project `1mWCbenC…`, not in the `lightweight/v34` working tree.

They fail here with `ENOENT: gas/Auth.gs` because the files they read do not exist
on this branch. That is expected and is why they were moved out of `scripts/`.

## Running them

Check out the branch that contains the modular sources, then copy the scripts back
(or run them with the repo root as the working directory):

```bash
git checkout fathur6/daf-5-elaborate-faculty-readiness-table
node scripts/legacy/test-coor-access.js
```

Do not "fix" these tests by loosening their assertions — they are the safety net
for the modular app and only make sense against its source.

## Active tests

Everything directly in `scripts/` covers the deployed v34 application:

```bash
node scripts/test-single-workbook.js        # one workbook, PDF folder, Google sign-in
node scripts/test-pps-v34-sdg-migration.js  # SDG/SC migration mapping
node scripts/test-pdf-export-without-fetch.js # Drive-native PDF export
```
