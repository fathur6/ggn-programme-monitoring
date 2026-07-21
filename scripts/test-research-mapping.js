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
  this.clearContentsCalls = 0;
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
  this.clearContents = () => { this.clearContentsCalls++; this.rows = []; };
}
function FakeSpreadsheet(existing) {
  this.sheets = existing || {};
  this.getSheetByName = name => this.sheets[name] || null;
  this.insertSheet = name => (this.sheets[name] = new FakeSheet(name));
}
const spreadsheet = new FakeSpreadsheet({
  LegacyProgramme: new FakeSheet('LegacyProgramme', [['legacy', 'data']]),
  PR_MQFReference: new FakeSheet('PR_MQFReference', [
    ['Code', 'Title', 'Description', 'Active'],
    ['MQF1', 'Curated knowledge', 'Curated row', false],
    ['MQFX', 'Inactive custom', 'Preserve this row', false]
  ]),
  PR_TFReference: new FakeSheet('PR_TFReference', [
    ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
    ['TF1', 'Curated taxonomy', 'Preserve this row', '{not-json', true],
    ['TFX', 'Inactive custom', 'Preserve this row', '["MQF1"]', false]
  ])
});
let lockCount = 0;
const runtimeApi = new Function('getSpreadsheet', 'getCurrentUser', 'LockService', dataSource + '\n' + referenceSource + '\nreturn { getResearchReferences_: getResearchReferences_, getResearchReferencesApi: getResearchReferencesApi };')(
  () => spreadsheet,
  () => ({email: 'user@unisza.edu.my'}),
  {getScriptLock: () => ({waitLock: () => { lockCount++; }, releaseLock: () => {}})}
);
const references = runtimeApi.getResearchReferences_();
assert.strictEqual(references.TF.some(row => row.code === 'TF1'), false, 'Malformed active TF JSON must be ignored');
assert.strictEqual(references.TF.some(row => row.code === 'TFX'), false, 'Inactive TF rows must be ignored');
assert.strictEqual(references.TF.some(row => row.code === 'TF2'), true, 'Missing approved TF rows must be seeded');
assert.strictEqual(references.MQF.some(row => row.code === 'MQF1'), false, 'Inactive curated MQF rows must be ignored');
assert.strictEqual(references.MQF.some(row => row.code === 'MQF2'), true, 'Missing approved MQF rows must be seeded');
assert.strictEqual(references.MQF.length, 10);
assert.strictEqual(references.TF.length, 3);
assert.strictEqual(references.SDG.length, 1);
assert.strictEqual(references.SC.length, 2);
assert.deepStrictEqual(runtimeApi.getResearchReferencesApi(), references);
assert.deepStrictEqual(Object.keys(spreadsheet.sheets).filter(name => name.indexOf('PR_') === 0).sort(), researchSheetNames.slice().sort());
assert.deepStrictEqual(spreadsheet.sheets.LegacyProgramme.rows, [['legacy', 'data']]);
assert.strictEqual(spreadsheet.sheets.PR_MQFReference.clearContentsCalls, 0, 'Reference seeding must not clear MQF rows');
assert.strictEqual(spreadsheet.sheets.PR_TFReference.clearContentsCalls, 0, 'Reference seeding must not clear TF rows');
assert.deepStrictEqual(spreadsheet.sheets.PR_MQFReference.rows[1], ['MQF1', 'Curated knowledge', 'Curated row', false]);
assert.deepStrictEqual(spreadsheet.sheets.PR_MQFReference.rows[2], ['MQFX', 'Inactive custom', 'Preserve this row', false]);
assert.deepStrictEqual(spreadsheet.sheets.PR_TFReference.rows[1], ['TF1', 'Curated taxonomy', 'Preserve this row', '{not-json', true]);
assert.deepStrictEqual(spreadsheet.sheets.PR_TFReference.rows[2], ['TFX', 'Inactive custom', 'Preserve this row', '["MQF1"]', false]);
assert(lockCount > 0, 'First-use research sheet creation must use the script lock');
researchSheetNames.forEach(name => assert.deepStrictEqual(spreadsheet.sheets[name].rows[0], api.RESEARCH_SHEET_HEADERS[name]));
assert.deepStrictEqual(JSON.parse(spreadsheet.sheets.PR_TFReference.rows[3][3]), ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']);
const unauthenticatedApi = new Function('getSpreadsheet', 'getCurrentUser', 'LockService', dataSource + '\n' + referenceSource + '\nreturn getResearchReferencesApi;')(
  () => spreadsheet,
  () => null,
  {getScriptLock: () => ({waitLock: () => {}, releaseLock: () => {}})}
);
assert.throws(() => unauthenticatedApi(), /unauthorized/i);

console.log('Research mapping tests passed.');
