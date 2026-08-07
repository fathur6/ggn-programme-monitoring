const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/JavaScript.html', 'utf8');
const index = fs.readFileSync('gas/Index.html', 'utf8');
const styles = fs.readFileSync('gas/Styles.html', 'utf8');

function methodSource(name) {
  const start = source.indexOf(name + ': function');
  assert(start >= 0, 'Missing client method: ' + name);
  const next = source.indexOf('\n    },', start);
  return source.slice(start, next < 0 ? source.length : next);
}

function computedSource(name) {
  const start = source.indexOf(name + ': function');
  assert(start >= 0, 'Missing computed property: ' + name);
  const functionStart = source.indexOf('function', start);
  const bodyStart = source.indexOf('{', functionStart);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(functionStart, i + 1);
    }
  }
  throw new Error('Computed property is not closed: ' + name);
}

function propertyFunctionSource(name) {
  const start = source.indexOf(name + ': function');
  assert(start >= 0, 'Missing client property function: ' + name);
  const functionStart = source.indexOf('function', start);
  const bodyStart = source.indexOf('{', functionStart);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(functionStart, i + 1);
    }
  }
  throw new Error('Client property function is not closed: ' + name);
}

const researchPredicateSource = propertyFunctionSource('isResearchProgramme');
const clientResearchPredicate = new Function('return ' + researchPredicateSource)();

assert(/researchLoading:\s*false/.test(source), 'Research loading state is missing');
assert(/researchError:\s*null/.test(source), 'Research error state is missing');
assert(/researchLoading\s*=\s*true/.test(methodSource('loadResearchWorkspace')), 'Workspace loading does not start before API calls');
assert(/researchLoading\s*=\s*false/.test(methodSource('loadResearchWorkspace')), 'Workspace loading does not finish after API calls');
assert(/researchError\s*=/.test(methodSource('loadResearchWorkspace')), 'Workspace failures are not retained in state');
assert(/researchError/.test(index), 'Workspace error state is not actionable in the UI');
assert(/researchSaveState\s*=\s*['"]loading['"]/.test(methodSource('loadResearchWorkspace')), 'Workspace is marked ready before loading starts');
assert(/PLO Workspace[\s\S]*?\+ Add PLO/.test(index), 'PLO Workspace does not expose its add action');
assert(/type="button"/.test(index), 'Research workspace actions are missing explicit button types');
assert(/addResearchPLO:\s*function/.test(source), 'Research PLO add flow is missing');
assert(/isResearchProgramme/.test(source), 'Client research programme guard is missing');
assert(/getResearchProgrammeApi\(programmeId\)/.test(source) && /getResearchMappingsApi\(programmeId\)/.test(source),
  'Research workspace reads must use the selected programme identity');
assert(/saveResearchProfileApi\(this\.currentProgramme\.programmeId/.test(source) && /saveResearchPLOMappingApi\(self\.currentProgramme\.programmeId/.test(source),
  'Research workspace writes must use the selected programme identity');
[
  {programme: {mode: 'Research', level: 'Other'}, expected: true},
  {programme: {mode: 'Postgraduate by Research', level: 'Masters'}, expected: true},
  {programme: {mode: '', level: 'Masters'}, expected: false},
  {programme: {level: 'Doctorate'}, expected: false},
  {programme: {mode: 'Coursework', level: 'Doctorate'}, expected: false},
  {programme: {mode: 'Unknown', level: 'Masters'}, expected: false},
  {programme: {research: true, mode: 'Unknown', level: 'Masters'}, expected: false}
].forEach(function(example) {
  assert.strictEqual(clientResearchPredicate(example.programme), example.expected, 'Client research predicate mismatch for ' + JSON.stringify(example.programme));
});
assert(/researchError\s*=/.test(methodSource('researchFailure')), 'Research failures are not retained');
assert(/researchDirty\s*=\s*true/.test(methodSource('researchFailure')), 'Research failures do not preserve dirty state');
assert(/researchSaveState\s*=\s*['"]error['"]/.test(methodSource('researchFailure')), 'Research failures do not set error save state');
assert(/submitResearchProgramme[\s\S]*?researchFailure/.test(source), 'Submission failure does not use persistent research failure state');
assert(/@keydown="handleResearchCategoryKeydown"/.test(index), 'Research category tabs do not handle keyboard navigation');
assert(/:tabindex="researchCategory === 'information' \? 0 : -1"/.test(index), 'Information tab does not participate in roving tabindex');
assert(/:tabindex="researchCategory === 'mapping' \? 0 : -1"/.test(index), 'Mapping tab does not participate in roving tabindex');
assert(/function\s+projectMappingMatrixRow_\s*\(/.test(source), 'Pure matrix row projection is missing');
assert(/mappingMatrixRows:\s*function/.test(source), 'Matrix rows are not projected from current research records');
const matrixProjection = new Function(
  source.slice(source.indexOf('function projectMappingMatrixRow_'), source.indexOf('\nfunction initVueApp')) +
  '\nreturn projectMappingMatrixRow_;'
)();
assert.deepStrictEqual(matrixProjection({
  code: 'PLO-unmapped', mqfDomains: ['MQF2', 'MQF3d']
}, [
  {code: 'TF1', mqfDomains: ['MQF1']},
  {code: 'TF2', mqfDomains: ['MQF2', 'MQF3a', 'MQF3d']}
]), {
  code: 'PLO-unmapped', mqf: {MQF2: true, MQF3d: true}, tf: ['TF2'], sdg: [], sc: []
}, 'An unmapped PLO must derive TF coverage from loaded reference data');
const mappingMatrixRows = new Function(
  source.slice(source.indexOf('function projectMappingMatrixRow_'), source.indexOf('\nfunction initVueApp')) +
  '\nreturn ' + computedSource('mappingMatrixRows') + ';'
)();
assert.deepStrictEqual(mappingMatrixRows.call({
  researchPLOs: [{ploId: 'plo-unmapped', code: 'PLO-unmapped', mqfDomains: ['MQF2', 'MQF3d']}],
  researchMappings: {},
  researchReferences: {TF: [
    {code: 'TF1', mqfDomains: ['MQF1']},
    {code: 'TF2', mqfDomains: ['MQF2', 'MQF3a', 'MQF3d']}
  ]}
}), [{
  code: 'PLO-unmapped', mqf: {MQF2: true, MQF3d: true}, tf: ['TF2'], sdg: [], sc: []
}], 'The matrix runtime must derive TF coverage for a PLO without a mapping row');
['MQF', 'SDG'].forEach(function(referenceType) {
  assert(new RegExp('researchReferences\\.' + referenceType).test(index), 'Research editor does not consume the ' + referenceType + ' API reference key');
});
assert(/researchReferences\.SC/.test(source), 'Research editor does not consume the SC API reference key');
assert(/researchReferences\.TF/.test(source), 'Matrix projection does not consume the TF API reference key');
assert(/PLO Mapping Matrix/.test(index), 'Read-only PLO mapping matrix is missing');
assert(/aria-label="PLO mapping matrix"/.test(index), 'PLO mapping matrix needs an accessible name');
assert(/scope="col">\{\{ domain \}\}<\/th>/.test(index), 'Matrix MQF columns need table headers');
assert(/scope="row">\{\{ row\.code \}\}<\/th>/.test(index), 'Matrix PLO rows need row headers');
assert(/Explicit PLO mapping to/.test(index) && /not checked/.test(index), 'Matrix checks need accessible checked and not-checked labels');
assert(/Explicit PLO mapping/.test(index) && /TF derived from MQF mapping/.test(index), 'Matrix legend does not distinguish explicit and derived mappings');
assert(/SDG coverage/.test(index) && /SC coverage/.test(index), 'Matrix needs distinct SDG and SC coverage columns');
assert(/\.mapping-matrix-wrap \{ max-width: 100%; overflow-x: auto; \}/.test(styles), 'Matrix scrolling is not contained');
assert(/mapping-matrix-wrap"\s+role="region"\s+tabindex="0"/.test(index), 'Scrollable mapping matrix must be keyboard focusable');
assert(/mapping-matrix-wrap"\s+role="region"\s+tabindex="0"\s+aria-label="PLO mapping matrix scrolling region"/.test(index), 'Scrollable mapping matrix needs an accessible name');
assert(/aria-describedby="mapping-matrix-instructions"/.test(index) && /id="mapping-matrix-instructions"/.test(index), 'Scrollable mapping matrix must provide keyboard scrolling instructions');

const categoryKeydown = methodSource('handleResearchCategoryKeydown');
assert(/ArrowRight/.test(categoryKeydown) && /ArrowLeft/.test(categoryKeydown), 'Research category tabs do not support arrow navigation');
assert(/Home/.test(categoryKeydown) && /End/.test(categoryKeydown), 'Research category tabs do not support Home and End navigation');
assert(/preventDefault\s*\(\)/.test(categoryKeydown), 'Research category key handling does not prevent native scrolling');
assert(/researchCategory\s*=/.test(categoryKeydown), 'Research category key handling does not update the selected category');
assert(/\$nextTick/.test(categoryKeydown) && /\.focus\s*\(\)/.test(categoryKeydown), 'Research category key handling does not move focus to the selected tab');

const mappingSave = methodSource('saveResearchPLOMapping');
assert(/saveResearchPLOsApi/.test(mappingSave), 'Mapping save does not persist PLO fields first');
assert(/ploId/.test(mappingSave), 'Mapping save does not use a persisted PLO id');
assert(/saveResearchPLOMappingApi/.test(mappingSave), 'Mapping save API is missing');
assert(/scIds/.test(mappingSave) && /tfIds/.test(mappingSave), 'SC and TF selections are not persisted');
assert(/parentPEO/.test(mappingSave) && /statement/.test(mappingSave), 'PLO parent or statement is not included in save flow');
assert(/mqfDomains/.test(mappingSave) && /taxonomy/.test(mappingSave) && !/rationale/.test(mappingSave), 'PLO save flow includes an obsolete rationale field');
assert(/savedPLO/.test(mappingSave), 'Mapping save does not resolve the server-returned PLO');
assert(/researchMutationComplete/.test(mappingSave) && /refreshResearchDerived/.test(methodSource('researchMutationComplete')), 'Mapping save does not refresh server-derived state');

const ploSave = methodSource('saveResearchPLOs');
assert(/parentPEO/.test(ploSave) && /statement/.test(ploSave) && /mqfDomains/.test(ploSave), 'PLO API payload omits core editable fields');
assert(/taxonomy/.test(ploSave) && !/rationale/.test(ploSave), 'PLO API payload includes an obsolete rationale field');
assert(/researchMutationComplete/.test(ploSave) && /refreshResearchDerived/.test(methodSource('researchMutationComplete')), 'PLO save does not refresh server-derived state');

console.log('Research mapping client regression checks passed.');
