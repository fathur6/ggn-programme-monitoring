# Unsanitized MQF 2.0 Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the matching unsanitized MQF 2.0 Apps Script project and project documents into the local repository without committing credentials or generated artifacts.

**Architecture:** Use the existing OneDrive project whose `gas/.clasp.json` matches the supplied Apps Script ID as the source of truth. Copy the approved application/documentation boundary into the already initialized target repository, retain local deployment credentials as ignored files, and validate content using file lists, checksums, JSON parsing, and Git staging inspection.

**Tech Stack:** Google Apps Script, clasp 3.3.0, Git, shell file operations, JSON.

## Global Constraints

- Source must be `/Users/aman/Library/CloudStorage/OneDrive-UniversitiSultanZainalAbidin-UniSZA/UniSZA Graduate School (OneDrive)/MQF2.0 (2024)/Draf & Pembangunan`.
- The matching script ID is `1SM9BUFAg6bykFKD8lbBs_R_wpnwbnM4-cMpX86okw8Gwzrmk8HzhuMsK`.
- Copy `gas/` including unsanitized `Config.gs` and `.clasp.json`, plus `README.md`, `.gitignore`, `specs/`, and `plans/`.
- Exclude screenshots, Playwright logs, `graphify-out/`, `.superpowers/`, `page-snapshot.txt`, and `send_announcement.py`.
- Never print or commit the contents of `gas/Config.gs` or `gas/.clasp.json`.
- Do not overwrite the OneDrive source.

---

### Task 1: Transfer Approved Project Boundary

**Files:**
- Create: all files under `gas/`
- Create: `README.md`, `.gitignore`, `specs/`, and `plans/`
- Preserve: `docs/superpowers/specs/2026-07-18-unsanitized-mqf2-recovery-design.md`

**Interfaces:**
- Consumes: the approved OneDrive source tree and the existing target Git repository.
- Produces: a local project containing the unsanitized GAS source, deployment metadata, and project documents.

- [ ] **Step 1: Confirm the target is still limited to the committed design before copying**

Run:

```bash
git status --short --branch
```

Expected: only the clean `main` branch is shown, with no uncommitted files.

- [ ] **Step 2: Copy only the approved source and documentation paths**

Run:

```bash
SOURCE="/Users/aman/Library/CloudStorage/OneDrive-UniversitiSultanZainalAbidin-UniSZA/UniSZA Graduate School (OneDrive)/MQF2.0 (2024)/Draf & Pembangunan"
rsync -a "$SOURCE/gas/" gas/
rsync -a "$SOURCE/specs/" specs/
rsync -a "$SOURCE/plans/" plans/
cp "$SOURCE/README.md" README.md
cp "$SOURCE/.gitignore" .gitignore
```

Expected: the target contains the complete unsanitized `gas/` directory and the approved project documents; files outside the boundary are not copied.

- [ ] **Step 3: Confirm the deployment metadata matches the supplied script**

Run:

```bash
node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("gas/.clasp.json","utf8")); if (p.scriptId !== "1SM9BUFAg6bykFKD8lbBs_R_wpnwbnM4-cMpX86okw8Gwzrmk8HzhuMsK") process.exit(1); console.log("script ID matches")'
```

Expected: `script ID matches`.

- [ ] **Step 4: Commit the transferred project files**

Run:

```bash
git add README.md .gitignore gas specs plans
git commit -m "feat: restore unsanitized MQF2 project"
```

Expected: Git commits the non-secret source and documents while `.gitignore` excludes `gas/Config.gs` and `gas/.clasp.json` from the commit.

### Task 2: Verify Integrity And Exclusions

**Files:**
- Verify: `gas/`, `README.md`, `.gitignore`, `specs/`, `plans/`
- Verify: Git index and working tree

**Interfaces:**
- Consumes: the committed local project and the unchanged OneDrive source.
- Produces: evidence that approved files match byte-for-byte and excluded artifacts/secrets are not tracked.

- [ ] **Step 1: Verify the required file sets match without reading secret contents**

Run:

```bash
SOURCE="/Users/aman/Library/CloudStorage/OneDrive-UniversitiSultanZainalAbidin-UniSZA/UniSZA Graduate School (OneDrive)/MQF2.0 (2024)/Draf & Pembangunan"
diff -rq "$SOURCE/gas" gas
diff -rq "$SOURCE/specs" specs
diff -rq "$SOURCE/plans" plans
cmp "$SOURCE/README.md" README.md
cmp "$SOURCE/.gitignore" .gitignore
```

Expected: all commands exit successfully with no differences.

- [ ] **Step 2: Parse the Apps Script manifest**

Run:

```bash
node -e 'JSON.parse(require("fs").readFileSync("gas/appsscript.json","utf8")); console.log("appsscript.json valid")'
```

Expected: `appsscript.json valid`.

- [ ] **Step 3: Verify secret files are ignored and untracked**

Run:

```bash
git check-ignore -v gas/Config.gs gas/.clasp.json
git ls-files --error-unmatch gas/Config.gs gas/.clasp.json >/dev/null 2>&1 && exit 1 || true
```

Expected: `git check-ignore` reports the ignore rule for both files, and `git ls-files` does not find either file.

- [ ] **Step 4: Verify excluded artifacts were not transferred**

Run:

```bash
test ! -e graphify-out
test ! -e .superpowers
test ! -e page-snapshot.txt
test ! -e send_announcement.py
```

Expected: all tests exit successfully.

- [ ] **Step 5: Verify the final repository state**

Run:

```bash
git status --short --branch
```

Expected: the working tree is clean; the log contains the recovery design commit and transfer commit; tracked files include the approved non-secret project boundary only.
