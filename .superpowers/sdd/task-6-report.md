# Task 6 Report: PLO Mapping Matrix And Coverage Views

Commit: `6e6c727 feat: add PLO mapping matrix and coverage views`

## Scope

Modified tracked files:

- `gas/Index.html`
- `gas/JavaScript.html`
- `gas/Styles.html`
- `scripts/test-research-mapping.js`
- `scripts/test-research-mapping-client.js`
- `scripts/verify-mqf-rebuild.js`

The research PLO editor remains the default mapping workspace. The new matrix is read-only and has no mutation action or new API. It projects current PLO MQF selections together with loaded mapping values for derived TF, SDG, and SC coverage. The required MQF columns are rendered in this order: `MQF1`, `MQF2`, `MQF3a`, `MQF3b`, `MQF3c`, `MQF3d`, `MQF3e`, `MQF3f`, `MQF4a`, `MQF4b`, `MQF5`.

The matrix uses column headers, PLO row headers, and checked/not-checked accessible labels. Its legend distinguishes `Explicit PLO mapping` from `TF derived from MQF mapping`. SDG and SC are independent coverage columns. Matrix horizontal scrolling is restricted to `.mapping-matrix-wrap`; `body` already prohibits page-level horizontal overflow.

## TDD RED Evidence

Added the planned pure projection assertion to `scripts/test-research-mapping.js` before adding `projectMappingMatrixRow_`.

Command:

```text
node scripts/test-research-mapping.js
```

Output:

```text
/private/var/folders/yt/ty2hf7yx3rq2x68y1h9w5lgr0000gn/T/opencode/ggn-task6-matrix/scripts/test-research-mapping.js:7
  if (start === -1) throw new Error('Function ' + name + ' not found in source');
                    ^

Error: Function projectMappingMatrixRow_ not found in source
    at extractFunction (/private/var/folders/yt/ty2hf7yx3rq2x68y1h9w5lgr0000gn/T/opencode/ggn-task6-matrix/scripts/test-research-mapping.js:7:27)
    at Object.<anonymous> (/private/var/folders/yt/ty2hf7yx3rq2x68y1h9w5lgr0000gn/T/opencode/ggn-task6-matrix/scripts/test-research-mapping.js:127:3)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1463:32)
    at Function._load (node:internal/modules/cjs/loader:1282:12)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
    at node:internal/main/run_main_module:36:49

Node.js v22.23.1
```

The failure was expected and specifically proved the projection helper was absent.

## GREEN Verification

```text
$ node scripts/test-research-mapping.js
Research mapping tests passed.

$ node scripts/verify-mqf-rebuild.js
MQF rebuild static checks passed.

$ node scripts/test-research-mapping-client.js
Research mapping client regression checks passed.

$ node -e "const fs=require('fs'); const source=fs.readFileSync('gas/JavaScript.html','utf8'); const match=source.match(/<script>\s*([\s\S]*?)<\/script>/); if (!match) throw new Error('Script block not found'); new Function(match[1]); console.log('Extracted JavaScript syntax passed.');"
Extracted JavaScript syntax passed.

$ node -e "const fs=require('fs'); for (const file of fs.readdirSync('gas').filter(name => name.endsWith('.gs'))) new Function(fs.readFileSync('gas/' + file, 'utf8')); console.log('GAS source syntax passed.');"
GAS source syntax passed.

$ git diff --check
```

`git diff --check` exited 0 and produced no output.

An earlier syntax command attempted to compile the HTML wrapper itself and correctly failed on the opening `<script>` tag. The recorded passing command above extracts and compiles the JavaScript block, which is the required source syntax check.

## Static Contract Coverage

`scripts/verify-mqf-rebuild.js` and `scripts/test-research-mapping-client.js` verify:

- The pure `projectMappingMatrixRow_` helper and the `mappingMatrixRows` client projection exist.
- The matrix has an accessible table name, MQF column headers, and PLO row headers.
- Accessible labels expose both checked and not-checked explicit MQF states.
- The legend names explicit PLO mappings and derived TF mappings.
- SDG and SC coverage have distinct columns.
- Matrix scrolling is contained by `.mapping-matrix-wrap`.

## Commit

```text
[task6-mapping-matrix 6e6c727] feat: add PLO mapping matrix and coverage views
 6 files changed, 78 insertions(+), 7 deletions(-)
```

## Review Repair

### Finding 1: Matrix TF derivation

Root cause: `mappingMatrixRows` passed persisted `mapping.derivedTFIds` to the matrix projection. A PLO without a `researchMappings` row therefore displayed no TF cells even when its selected MQF domains matched loaded TF reference relationships.

`projectMappingMatrixRow_` now accepts the loaded TF reference collection and derives TF IDs by selecting each TF whose `mqfDomains` intersects the PLO's selected MQF domains, matching `deriveTFIds_` and `getResearchCoverageApi_`. The computed matrix passes `researchReferences.tf`; persisted mapping values continue to supply SDG and SC coverage only.

TDD evidence: before the client repair, `node scripts/test-research-mapping-client.js` failed with `An unmapped PLO must derive TF coverage from loaded reference data`, reporting actual `tf: []` and expected `tf: ['TF2']`. The executable regression creates `PLO-unmapped` with `MQF2` and `MQF3d`, no mapping row, and loaded references that derive `TF2`.

### Finding 2: Keyboard matrix scrolling

The internal `.mapping-matrix-wrap` is now the single keyboard focus target (`role="region"`, `tabindex="0"`) while table cells remain unfocusable. Its screen-reader instruction explains left/right arrow scrolling and is associated with `aria-describedby`. Page-level overflow remains unchanged; horizontal scrolling remains restricted to `.mapping-matrix-wrap`.

Static coverage in `scripts/verify-mqf-rebuild.js` and client regression coverage in `scripts/test-research-mapping-client.js` require the focusable matrix wrapper and its scrolling instruction.

### Repair Verification

```text
$ node scripts/test-research-mapping.js
Research mapping tests passed.

$ node scripts/verify-mqf-rebuild.js
MQF rebuild static checks passed.

$ node scripts/test-research-mapping-client.js
Research mapping client regression checks passed.

$ node -e "const fs=require('fs'); const source=fs.readFileSync('gas/JavaScript.html','utf8'); const match=source.match(/<script>\s*([\s\S]*?)<\/script>/); if (!match) throw new Error('Script block not found'); new Function(match[1]); console.log('Extracted JavaScript syntax passed.');"
Extracted JavaScript syntax passed.

$ node -e "const fs=require('fs'); for (const file of fs.readdirSync('gas').filter(name => name.endsWith('.gs'))) new Function(fs.readFileSync('gas/' + file, 'utf8')); console.log('GAS source syntax passed.');"
GAS source syntax passed.

$ git diff --check
```

`git diff --check` exited 0 with no output.
