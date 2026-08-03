const assert = require('assert');
const fs = require('fs');

function extractFunction(name, source) {
  var re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  var start = source.search(re);
  if (start === -1) throw new Error('Function ' + name + ' not found in source');
  var depth = 0, i = start;
  while (i < source.length) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(start, i + 1);
}

const dataSource = fs.readFileSync('gas/ResearchDataService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const lockSource = fs.readFileSync('gas/ResearchLockService.gs', 'utf8');
const mappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');
const programmeSource = fs.readFileSync('gas/ProgrammeService.gs', 'utf8');
const api = new Function('getSpreadsheet', 'getCurrentUser_', 'LockService', dataSource + '\n' + referenceSource + '\nreturn { RESEARCH_SHEET_HEADERS: RESEARCH_SHEET_HEADERS, getResearchProgrammeKey_: getResearchProgrammeKey_, validateReferenceIds_: validateReferenceIds_, getResearchReferences_: getResearchReferences_, getResearchReferencesApi: getResearchReferencesApi };')(undefined, undefined, undefined);
const researchReferenceList = new Function(
  extractFunction('getResearchReferenceList_', referenceSource) + '\nreturn getResearchReferenceList_;'
)();
assert.strictEqual(researchReferenceList({MQF: [{code: 'MQF1'}]}, 'mqf')[0].code, 'MQF1', 'Uppercase MQF references were not available to save logic');
assert.strictEqual(researchReferenceList({SDG: [{code: 'SDG4'}]}, 'sdg')[0].code, 'SDG4', 'Uppercase SDG references were not available to save logic');

var task2HelpersSource = [
  'uniqueTrimmed_', 'canonicalResearchTaxonomy_',
  'normalizeResearchPEO_', 'normalizeResearchPLO_',
  'validateDuplicateCodes_', 'validatePLOParents_'
].map(function(name) { return extractFunction(name, mappingSource); }).join('\n');
var task2Helpers = new Function(task2HelpersSource + '\nreturn { uniqueTrimmed_: uniqueTrimmed_, canonicalResearchTaxonomy_: canonicalResearchTaxonomy_, normalizeResearchPEO_: normalizeResearchPEO_, normalizeResearchPLO_: normalizeResearchPLO_, validateDuplicateCodes_: validateDuplicateCodes_, validatePLOParents_: validatePLOParents_ };')();
const serverResearchPredicate = new Function(
  extractFunction('isResearchProgramme_', programmeSource) + '\nreturn isResearchProgramme_;'
)();
const researchDetailPredicate = new Function(
  extractFunction('hasResearchDetailSheet_', programmeSource) + '\nreturn hasResearchDetailSheet_;'
)();
const programmeIdentity = new Function(
  extractFunction('programmeIdentity_', programmeSource) + '\nreturn programmeIdentity_;'
)();
const duplicateProgrammes = [
  {faculty: 'FUHA', progCode: 'PL6008', mqaCode: 'MQA/FA10523'},
  {faculty: 'FSSG', progCode: 'PS6001', mqaCode: 'MQA/FA10523'}
].map(function(programme) {
  programme.programmeId = programmeIdentity(programme);
  return programme;
});
const findByIdentity = new Function(
  'getProgrammes_', 'programmeIdentity_', extractFunction('findProgrammeByIdentity_', programmeSource) + '\nreturn findProgrammeByIdentity_;'
)(function() { return duplicateProgrammes; }, programmeIdentity);
assert.strictEqual(duplicateProgrammes[0].programmeId, 'FUHA::PL6008::MQA/FA10523');
assert.strictEqual(duplicateProgrammes[1].programmeId, 'FSSG::PS6001::MQA/FA10523');
assert.strictEqual(findByIdentity('FSSG::PS6001::MQA/FA10523'), duplicateProgrammes[1], 'Duplicate MQA identity did not resolve exactly');
assert.strictEqual(findByIdentity('MQA/FA10523'), null, 'Identity resolver must not collapse an MQA-only duplicate lookup');
const legacyDetailParser = new Function(
  extractFunction('canonicalResearchTaxonomy_', mappingSource) + '\n' +
  extractFunction('normalizeLegacyMQF_', mappingSource) + '\n' +
  extractFunction('readLegacyResearchDetail_', mappingSource) + '\nreturn readLegacyResearchDetail_;'
)();

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
const runtimeApi = new Function('getSpreadsheet', 'getCurrentUser_', 'LockService', 'Utilities', lockSource + '\n' + dataSource + '\n' + referenceSource + '\nreturn { getResearchReferences_: getResearchReferences_, getResearchReferencesApi: getResearchReferencesApi };')(
  () => spreadsheet,
  () => ({email: 'user@unisza.edu.my'}),
  {getScriptLock: () => ({tryLock: () => { lockCount++; return true; }, releaseLock: () => {}})},
  {sleep: () => { throw new Error('Real Utilities.sleep must not run in this fixture'); }}
);
const references = runtimeApi.getResearchReferences_();
assert.strictEqual(references.TF.some(row => row.code === 'TF1'), false, 'Malformed active TF JSON must be ignored');
assert.strictEqual(references.TF.some(row => row.code === 'TFX'), false, 'Inactive TF rows must be ignored');
assert.strictEqual(references.TF.some(row => row.code === 'TF2'), true, 'Missing approved TF rows must be seeded');
assert.strictEqual(references.MQF.some(row => row.code === 'MQF1'), false, 'Inactive curated MQF rows must be ignored');
assert.strictEqual(references.MQF.some(row => row.code === 'MQF2'), true, 'Missing approved MQF rows must be seeded');
assert.strictEqual(references.MQF.length, 10);
assert.strictEqual(references.TF.length, 3);
assert.strictEqual(references.SDG.length, 17);
assert.strictEqual(references.SC.length, 8);
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
assert.deepStrictEqual(JSON.parse(spreadsheet.sheets.PR_TFReference.rows[3][3]), ['MQF2', 'MQF3d', 'MQF3e']);
const unauthenticatedApi = new Function('getSpreadsheet', 'getCurrentUser_', 'LockService', 'Utilities', lockSource + '\n' + dataSource + '\n' + referenceSource + '\nreturn getResearchReferencesApi;')(
  () => spreadsheet,
  () => null,
  {getScriptLock: () => ({tryLock: () => true, releaseLock: () => {}})},
  {sleep: () => { throw new Error('Real Utilities.sleep must not run in this fixture'); }}
);
assert.throws(() => unauthenticatedApi(), /unauthorized/i);

var task3HelpersSource = [
  'uniqueTrimmed_', 'canonicalResearchRecordCode_', 'deriveTFIds_', 'calculatePEOCoverage_'
].map(function(name) { return extractFunction(name, mappingSource); }).join('\n');
var task3Helpers = new Function(task3HelpersSource + '\nreturn { deriveTFIds_: deriveTFIds_, calculatePEOCoverage_: calculatePEOCoverage_ };')();

var clientSource = fs.readFileSync('gas/JavaScript.html', 'utf8');
var matrixHelpers = new Function(
  extractFunction('projectMappingMatrixRow_', clientSource) +
  '\nreturn { projectMappingMatrixRow_: projectMappingMatrixRow_ };'
)();

assert.deepStrictEqual(matrixHelpers.projectMappingMatrixRow_({
  code: 'PLO1', mqfDomains: ['MQF2', 'MQF3d'], derivedTFIds: ['TF2'], sdgIds: ['SDG4'], scIds: ['SC2']
}, [
  {code: 'TF1', mqfDomains: ['MQF1', 'MQF4a']},
  {code: 'TF2', mqfDomains: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']}
]), {
  code: 'PLO1', mqf: {MQF2: true, MQF3d: true}, tf: ['TF2'], sdg: ['SDG4'], sc: ['SC2']
});

assert.deepStrictEqual(task3Helpers.deriveTFIds_(['MQF2', 'MQF3d'], {
  TF1: ['MQF1', 'MQF4a'],
  TF2: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']
}), ['TF2']);
assert.deepStrictEqual(task3Helpers.deriveTFIds_([], {TF1: ['MQF1']}), []);
assert.deepStrictEqual(task3Helpers.deriveTFIds_(['MQF1', 'MQF999'], {TF1: ['MQF1']}), ['TF1']);
assert.deepStrictEqual(task3Helpers.calculatePEOCoverage_([
  {parentPEO: 'PEO1', derivedTFIds: ['TF1'], sdgIds: ['SDG4'], scIds: ['SC2']},
  {parentPEO: 'PEO1', derivedTFIds: ['TF2'], sdgIds: ['SDG4'], scIds: ['SC3']}
], 'PEO1'), {
  tfIds: ['TF1', 'TF2'], sdgIds: ['SDG4'], scIds: ['SC2', 'SC3'], childCount: 2,
  derivedLabel: 'Derived from PLO mappings'
});
assert.throws(function() { task3Helpers.calculatePEOCoverage_([], 'PEO-EMPTY'); }, /no child plo mappings/i);
assert.strictEqual(task3Helpers.calculatePEOCoverage_([{parentPEO: 'PEO 1', derivedTFIds: ['TF1'], sdgIds: [], scIds: []}], 'PEO1').childCount, 1,
  'PEO coverage must normalize spaced parent identifiers');

assert.deepStrictEqual(task2Helpers.uniqueTrimmed_([' MQF2 ', 'MQF1', ' MQF2 ', '']), ['MQF2', 'MQF1']);
assert.strictEqual(task2Helpers.canonicalResearchTaxonomy_(' c4 '), 'C4');
assert.strictEqual(task2Helpers.canonicalResearchTaxonomy_(' p6 '), 'P6');
assert.strictEqual(task2Helpers.canonicalResearchTaxonomy_(null), '');
assert.deepStrictEqual(task2Helpers.normalizeResearchPEO_({code: ' PEO1 ', statement: ' Test '}), {code: 'PEO1', statement: 'Test'});
assert.deepStrictEqual(task2Helpers.normalizeResearchPLO_({
  code: ' PLO1 ',
  statement: ' Outcome ',
  parentPEO: 'PEO1',
  mqfDomains: ['MQF2', 'MQF2'],
  taxonomy: 'c4'
}), {
  code: 'PLO1', statement: 'Outcome', parentPEO: 'PEO1',
  mqfDomains: ['MQF2'], taxonomy: 'C4', rationale: ''
});
assert.throws(function() { task2Helpers.validatePLOParents_([{code: 'PLO1', parentPEO: 'PEO9'}], [{code: 'PEO1'}]); }, /parent PEO/i);
assert.throws(function() { task2Helpers.validateDuplicateCodes_([{code: 'PLO1'}, {code: 'PLO1'}], 'PLO'); }, /duplicate/i);
assert.throws(function() { task2Helpers.validateDuplicateCodes_([{code: 'PLO1'}, {code: ' PLO1'}], 'PLO'); }, /duplicate/i);

[
  {programme: {mode: 'Research', level: 'Other'}, expected: true},
  {programme: {mode: 'Postgraduate by Research', level: 'Masters'}, expected: true},
  {programme: {mode: '', level: 'Masters'}, expected: false},
  {programme: {level: 'Doctorate'}, expected: false},
  {programme: {mode: 'Coursework', level: 'Doctorate'}, expected: false},
  {programme: {mode: 'Unknown', level: 'Masters'}, expected: false},
  {programme: {research: true, mode: 'Unknown', level: 'Masters'}, expected: false},
  {programme: {mode: '', researchDetail: true, level: 'Masters'}, expected: true},
  {programme: {mode: '', researchDetail: false, level: 'Masters'}, expected: false}
].forEach(function(example) {
  assert.strictEqual(serverResearchPredicate(example.programme), example.expected, 'Server research predicate mismatch for ' + JSON.stringify(example.programme));
});

assert.strictEqual(researchDetailPredicate({getSheetByName: function(name) {
  return name === 'MQA/FA5581' ? {} : null;
}}, 'MQA/FA5581'), true, 'MQA detail tab should identify a research programme');
assert.strictEqual(researchDetailPredicate({getSheetByName: function() { return {}; }}, 'MQA/COURSE'), false,
  'Non-MQA research identifiers must fail closed');
assert.strictEqual(researchDetailPredicate({getSheetByName: function() {
  return {};
}}, 'MQA/PA12020'), true, 'Existing MQA detail tabs should identify research programmes');
var legacyDetail = legacyDetailParser({getSheetByName: function() {
  return {getDataRange: function() { return {getValues: function() {
    return [['PEO'], ['PEO1', 'Objective'], ['PEO2', 'Objective 2'], ['PLO'],
      ['PLO 1', 'Outcome', 'MQF 1', 'PEO1', 'C4']];
  }}; }};
}}, 'MQA/FA5582');
assert.strictEqual(legacyDetail.peos.length, 2, 'Legacy PEO rows were not parsed');
assert.strictEqual(legacyDetail.plos[0].mqfDomains[0], 'MQF1', 'Legacy MQF code was not normalized');
assert.strictEqual(legacyDetail.plos[0].parentPEO, 'PEO1', 'Legacy PLO parent PEO was not parsed');
assert.strictEqual(legacyDetail.plos[0].taxonomy, 'C4', 'Legacy PLO taxonomy was not parsed');
var legacyMQF = new Function(extractFunction('normalizeLegacyMQF_', mappingSource) + '\nreturn normalizeLegacyMQF_;')();
assert.strictEqual(legacyMQF('MQF 3A'), 'MQF3a', 'Alphabetic legacy MQF code casing was not canonicalized');

var migrationSource = extractFunction('researchRows_', mappingSource) + '\n' +
  extractFunction('migrateLegacyResearchRowsNoLock_', mappingSource) + '\n' +
  extractFunction('migrateLegacyResearchRows_', mappingSource);
var migrationApi = new Function('RESEARCH_ROWS_CACHE_', migrationSource + '\nreturn {migrateLegacyResearchRows_: migrateLegacyResearchRows_};')({});
function MigrationSheet(name, rows) {
  this.name = name;
  this.rows = rows;
  this.getName = function() { return this.name; };
  this.getDataRange = function() { return {getValues: function() { return this.rows.map(function(row) { return row.slice(); }, this);}.bind(this)}; };
  this.appendRow = function(row) { this.rows.push(row.slice()); };
}
var migrationSheets = {
  PR_ProgrammeProfile: new MigrationSheet('profile', [['header'], ['MQA/FA10523', 'MQA/FA10523', 'FUHA', 'Legacy', 'Masters', 'Research']]),
  PR_PEORecords: new MigrationSheet('peos', [['header'], ['legacy-peo', 'MQA/FA10523', 'PEO1', 'Objective']]),
  PR_PLORecords: new MigrationSheet('plos', [['header'], ['legacy-plo', 'MQA/FA10523', 'PEO1', 'PLO1', 'Outcome']]),
  PR_PLOMappings: new MigrationSheet('mappings', [['header'], ['legacy-plo', 'MQA/FA10523', '[]', '[]', '[]', '']])
};
migrationApi.migrateLegacyResearchRows_(duplicateProgrammes[0], duplicateProgrammes[0].programmeId, migrationSheets);
assert.strictEqual(migrationSheets.PR_ProgrammeProfile.rows[2][0], duplicateProgrammes[0].programmeId, 'Legacy profile was not cloned to the composite identity');
assert.strictEqual(migrationSheets.PR_PEORecords.rows[2][1], duplicateProgrammes[0].programmeId, 'Legacy PEO was not isolated');
assert.strictEqual(migrationSheets.PR_PLORecords.rows[2][1], duplicateProgrammes[0].programmeId, 'Legacy PLO was not isolated');
assert.strictEqual(migrationSheets.PR_PLOMappings.rows[2][0], duplicateProgrammes[0].programmeId + '::legacy-plo', 'PLO mapping relationship was not preserved');

var reviewSource = fs.readFileSync('gas/ResearchReviewService.gs', 'utf8');
var reviewDepsSource = [
  'uniqueTrimmed_', 'canonicalResearchTaxonomy_', 'deriveTFIds_'
].map(function(name) { return extractFunction(name, mappingSource); }).join('\n');
var referenceHelperSource = extractFunction('getResearchReferenceList_', referenceSource);
var reviewHelpersSource = [
  'reviewIssue_', 'reviewWarning_', 'researchReviewReferences_',
  'reviewReferenceCodes_', 'reviewTFMap_', 'reviewSelectedTFIds_', 'reviewMappingForPLO_',
  'reviewPolicyRequires_', 'validateResearchProgramme_'
].map(function(name) { return extractFunction(name, reviewSource); }).join('\n');
var RESEARCH_TAXONOMY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
var reviewHelperApi = new Function(
  'RESEARCH_TAXONOMY_IDS',
  reviewDepsSource + '\n' + referenceHelperSource + '\n' + reviewHelpersSource + '\n' +
  'return { validateResearchProgramme_: validateResearchProgramme_ };'
)(RESEARCH_TAXONOMY_IDS);

var incomplete = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: '', parentPEO: 'PEO1', mqfDomains: [], taxonomy: ''}],
  mappings: []
});
assert(incomplete.critical.some(function(issue) { return issue.code === 'PLO_STATEMENT_REQUIRED'; }), 'Missing statement not detected');
assert(incomplete.critical.some(function(issue) { return issue.code === 'PLO_MQF_REQUIRED'; }), 'Missing MQF not detected');
assert(incomplete.critical.some(function(issue) { return issue.code === 'PLO_TAXONOMY_REQUIRED'; }), 'Missing taxonomy not detected');
assert.strictEqual(incomplete.status, 'Needs attention');

var peoWithoutChild = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective 1'}, {code: 'PEO2', statement: 'No child'}],
  plos: [{code: 'PLO1', statement: 'Analyse critically', parentPEO: 'PEO1', mqfDomains: ['MQF1'], taxonomy: 'C4'}],
  mappings: [],
  references: {mqf: [{code: 'MQF1'}], tf: [{code: 'TF1', mqfDomains: ['MQF1']}]}
});
assert(peoWithoutChild.critical.some(function(i) { return i.code === 'PEO_CHILD_REQUIRED'; }), 'PEO without child not detected');

var ready = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Demonstrate critical evaluation skills',
    parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF2']}],
  references: {
    mqf: [{code: 'MQF2', title: 'Knowledge'}],
    tf: [{code: 'TF2', title: 'Critical thinking', mqfDomains: ['MQF2']}]
  }
});
assert.strictEqual(ready.critical.length, 0, 'Ready programme has critical issues: ' + JSON.stringify(ready.critical));
assert.strictEqual(ready.warnings.some(function(w) { return w.code === 'PLO_STATEMENT_BROAD'; }), false, 'Long statement should not fire broad');
assert.strictEqual(ready.status, 'Ready for review');

var duplicatePlo = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [
    {code: 'PLO1', statement: 'Analyse', parentPEO: 'PEO1', mqfDomains: ['MQF1'], taxonomy: 'C4'},
    {code: 'PLO1', statement: 'Evaluate', parentPEO: 'PEO1', mqfDomains: ['MQF1'], taxonomy: 'C4'}
  ],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF1']}],
  references: {mqf: [{code: 'MQF1'}], tf: [{code: 'TF1', mqfDomains: ['MQF1']}]}
});
assert(duplicatePlo.critical.some(function(i) { return i.code === 'PLO_CODE_DUPLICATE'; }), 'Duplicate PLO code not detected');

var invalidParent = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Analyse', parentPEO: 'PEO99', mqfDomains: ['MQF1'], taxonomy: 'C4'}],
  mappings: [],
  references: {mqf: [{code: 'MQF1'}], tf: [{code: 'TF1', mqfDomains: ['MQF1']}]}
});
assert(invalidParent.critical.some(function(i) { return i.code === 'PLO_PARENT_INVALID'; }), 'Invalid parent PEO not detected');

var invalidDomain = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Analyse', parentPEO: 'PEO1', mqfDomains: ['MQF99'], taxonomy: 'C4'}],
  mappings: [],
  references: {mqf: [{code: 'MQF1'}], tf: [{code: 'TF1', mqfDomains: ['MQF1']}]}
});
assert(invalidDomain.critical.some(function(i) { return i.code === 'PLO_MQF_INVALID'; }), 'Invalid MQF domain not detected');

var invalidTaxonomy = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Analyse', parentPEO: 'PEO1', mqfDomains: ['MQF1'], taxonomy: 'C99'}],
  mappings: [],
  references: {mqf: [{code: 'MQF1'}], tf: [{code: 'TF1', mqfDomains: ['MQF1']}]}
});
assert(invalidTaxonomy.critical.some(function(i) { return i.code === 'PLO_TAXONOMY_INVALID'; }), 'Invalid taxonomy not detected');

var broadWarning = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Short', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF2']}],
  references: {mqf: [{code: 'MQF2'}], tf: [{code: 'TF2', mqfDomains: ['MQF2']}]}
});
assert(broadWarning.warnings.some(function(w) { return w.code === 'PLO_STATEMENT_BROAD'; }), 'Short statement broad warning not detected');

var missingSdgWarning = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Analyse critically', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: [], scIds: ['SC2'], derivedTFIds: ['TF2']}],
  references: {mqf: [{code: 'MQF2'}], tf: [{code: 'TF2', mqfDomains: ['MQF2']}]}
});
assert(missingSdgWarning.warnings.some(function(w) { return w.code === 'PLO_SDG_MISSING'; }), 'Missing SDG warning not detected');

var policySdgCritical = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Analyse critically', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: [], scIds: ['SC2'], derivedTFIds: ['TF2']}],
  references: {mqf: [{code: 'MQF2'}], tf: [{code: 'TF2', mqfDomains: ['MQF2']}]},
  policy: {sdg: true}
});
assert(policySdgCritical.critical.some(function(i) { return i.code === 'SDG_REQUIRED'; }), 'SDG policy critical not triggered');

var concentrationWarning = reviewHelperApi.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [
    {code: 'PLO1', statement: 'Analyse critically', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'},
    {code: 'PLO2', statement: 'Evaluate critically', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C5'}
  ],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF2']}],
  references: {mqf: [{code: 'MQF2'}], tf: [{code: 'TF2', mqfDomains: ['MQF2']}]}
});
assert(concentrationWarning.warnings.some(function(w) { return w.code === 'MQF_DOMAIN_CONCENTRATION'; }), 'MQF concentration warning not detected');

var metrics = reviewHelperApi.validateResearchProgramme_({
  peos: [
    {code: 'PEO1', statement: 'Objective 1'},
    {code: 'PEO2', statement: 'Objective 2'}
  ],
  plos: [
    {code: 'PLO1', statement: 'Analyse critically', parentPEO: 'PEO1', mqfDomains: ['MQF1', 'MQF2'], taxonomy: 'C4'},
    {code: 'PLO2', statement: 'Evaluate systematically', parentPEO: 'PEO2', mqfDomains: ['MQF3'], taxonomy: 'C5'}
  ],
  mappings: [
    {ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF1', 'TF2']},
    {ploId: 'P2', sdgIds: ['SDG4', 'SDG13'], scIds: ['SC2', 'SC3'], derivedTFIds: ['TF3']}
  ],
  references: {
    mqf: [{code: 'MQF1'}, {code: 'MQF2'}, {code: 'MQF3'}],
    tf: [
      {code: 'TF1', mqfDomains: ['MQF1']},
      {code: 'TF2', mqfDomains: ['MQF2']},
      {code: 'TF3', mqfDomains: ['MQF3']}
    ]
  }
});
assert.strictEqual(metrics.metrics.ploTotal, 2, 'ploTotal mismatch');
assert.strictEqual(metrics.metrics.ploStatementsComplete, 2, 'ploStatementsComplete mismatch');
assert.strictEqual(metrics.metrics.ploWithMQF, 2, 'ploWithMQF mismatch');
assert.strictEqual(metrics.metrics.ploWithValidTaxonomy, 2, 'ploWithValidTaxonomy mismatch');
assert.strictEqual(metrics.metrics.ploWithValidTF, 2, 'ploWithValidTF mismatch');
assert.strictEqual(metrics.metrics.ploWithSDG, 2, 'ploWithSDG mismatch');
assert.strictEqual(metrics.metrics.ploWithSC, 2, 'ploWithSC mismatch');
assert.strictEqual(metrics.metrics.mqfDomainCoverage, 3, 'mqfDomainCoverage mismatch');
assert.strictEqual(metrics.metrics.tfCoverage, 2, 'tfCoverage mismatch');
assert.strictEqual(metrics.metrics.peosWithIssues, 0, 'peosWithIssues mismatch');
assert.strictEqual(metrics.peoCoverage.length, 2, 'peoCoverage length mismatch');
assert.strictEqual(metrics.peoCoverage[0].ploCount, 1, 'PEO1 child count mismatch');
assert.strictEqual(metrics.peoCoverage[1].ploCount, 1, 'PEO2 child count mismatch');

var emptyProgramme = reviewHelperApi.validateResearchProgramme_({
  peos: [],
  plos: [],
  mappings: []
});
assert.strictEqual(emptyProgramme.critical.length, 0, 'Empty programme has unexpected critical issues');
assert.strictEqual(emptyProgramme.status, 'Ready for review', 'Empty programme should be Ready for review');

console.log('Research mapping tests passed.');
