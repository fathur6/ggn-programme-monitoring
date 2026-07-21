const assert = require('assert');
const fs = require('fs');

const dataSource = fs.readFileSync('gas/ResearchDataService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const api = new Function('getSpreadsheet', 'getCurrentUser', 'LockService', dataSource + '\n' + referenceSource + '\nreturn { RESEARCH_SHEET_HEADERS: RESEARCH_SHEET_HEADERS, getResearchProgrammeKey_: getResearchProgrammeKey_, validateReferenceIds_: validateReferenceIds_, getResearchReferences_: getResearchReferences_, getResearchReferencesApi: getResearchReferencesApi };')(undefined, undefined, undefined);

const researchSheetNames = Object.keys(api.RESEARCH_SHEET_HEADERS);
assert.deepStrictEqual(researchSheetNames, [
  'PR_ProgrammeProfile',
  'PR_PEORecords',
  'PR_PLORecords',
  'PR_PLOMappings',
  'PR_MQFReference',
  'PR_TFReference',
  'PR_SDGReference',
  'PR_SCReference'
]);
assert.strictEqual(api.getResearchProgrammeKey_({mqaCode: 'MQA/TEST'}), 'MQA/TEST');
assert.strictEqual(api.getResearchProgrammeKey_({programmeId: '  ', mqaCode: 'MQA/FALLBACK'}), 'MQA/FALLBACK');
assert.throws(() => api.getResearchProgrammeKey_({programmeId: '  ', mqaCode: '  '}), /programme id is required/i);
assert.deepStrictEqual(api.validateReferenceIds_(['MQF2'], ['MQF1', 'MQF2']), ['MQF2']);
assert.deepStrictEqual(api.validateReferenceIds_([' MQF2 ', 'MQF2', 'MQF1 '], ['MQF1', 'MQF2']), ['MQF2', 'MQF1']);
assert.throws(() => api.validateReferenceIds_(['INVALID'], ['MQF1', 'MQF2']), /invalid/i);
['toString', 'constructor', '__proto__'].forEach(function(id) {
  assert.throws(() => api.validateReferenceIds_([id], ['MQF1', id]), /invalid/i);
});

function FakeSheet(name, rows) {
  this.name = name;
  this.rows = rows || [];
  this.appendRow = row => this.rows.push(row.slice());
  this.getLastRow = () => this.rows.length;
  this.getDataRange = () => ({getValues: () => this.rows.map(row => row.slice())});
  this.getRange = (row, column, numRows, numColumns) => ({
    setValues: values => {
      for (let i = 0; i < numRows; i++) this.rows[row - 1 + i] = values[i].slice();
    },
    clearContent: () => {
      this.rows = this.rows.slice(0, row - 1);
    }
  });
  this.clearContents = () => { this.rows = []; };
}
function FakeSpreadsheet(existing) {
  this.sheets = existing || {};
  this.getSheetByName = name => this.sheets[name] || null;
  this.insertSheet = name => (this.sheets[name] = new FakeSheet(name));
}
const spreadsheet = new FakeSpreadsheet({
  LegacyProgramme: new FakeSheet('LegacyProgramme', [['legacy', 'data']]),
  PR_MQFReference: new FakeSheet('PR_MQFReference', [['Wrong', 'Headers'], ['MQF1', 'stale', 'row', false]]),
  PR_TFReference: new FakeSheet('PR_TFReference', [['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'], ['TF1', 'bad', 'bad', '{not-json', true]])
});
let lockCount = 0;
const runtimeApi = new Function('getSpreadsheet', 'getCurrentUser', 'LockService', dataSource + '\n' + referenceSource + '\nreturn { getResearchReferences_: getResearchReferences_, getResearchReferencesApi: getResearchReferencesApi };')(
  () => spreadsheet,
  () => ({email: 'user@unisza.edu.my'}),
  {getScriptLock: () => ({waitLock: () => { lockCount++; }, releaseLock: () => {}})}
);
const references = runtimeApi.getResearchReferences_();
assert.deepStrictEqual(references.TF[0].mqfDomains, ['MQF1', 'MQF4a']);
assert.strictEqual(references.MQF.length, 11);
assert.strictEqual(references.TF.length, 4);
assert.strictEqual(references.SDG.length, 1);
assert.strictEqual(references.SC.length, 2);
assert.deepStrictEqual(runtimeApi.getResearchReferencesApi(), references);
assert.deepStrictEqual(Object.keys(spreadsheet.sheets).filter(name => name.indexOf('PR_') === 0).sort(), researchSheetNames.slice().sort());
assert.deepStrictEqual(spreadsheet.sheets.LegacyProgramme.rows, [['legacy', 'data']]);
assert(lockCount > 0, 'First-use research sheet creation must use the script lock');
researchSheetNames.forEach(name => assert.deepStrictEqual(spreadsheet.sheets[name].rows[0], api.RESEARCH_SHEET_HEADERS[name]));
assert.deepStrictEqual(JSON.parse(spreadsheet.sheets.PR_TFReference.rows[1][3]), ['MQF1', 'MQF4a']);
const unauthenticatedApi = new Function('getSpreadsheet', 'getCurrentUser', 'LockService', dataSource + '\n' + referenceSource + '\nreturn getResearchReferencesApi;')(
  () => spreadsheet,
  () => null,
  {getScriptLock: () => ({waitLock: () => {}, releaseLock: () => {}})}
);
assert.throws(() => unauthenticatedApi(), /unauthorized/i);

console.log('Research mapping tests passed.');
