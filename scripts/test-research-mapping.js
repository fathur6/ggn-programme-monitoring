const assert = require('assert');
const fs = require('fs');

const dataSource = fs.readFileSync('gas/ResearchDataService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const api = new Function(dataSource + '\n' + referenceSource + '\nreturn { RESEARCH_SHEET_HEADERS: RESEARCH_SHEET_HEADERS, getResearchProgrammeKey_: getResearchProgrammeKey_, validateReferenceIds_: validateReferenceIds_ };')();

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
assert.deepStrictEqual(api.validateReferenceIds_(['MQF2'], ['MQF1', 'MQF2']), ['MQF2']);
assert.throws(() => api.validateReferenceIds_(['INVALID'], ['MQF1', 'MQF2']), /invalid/i);

console.log('Research mapping tests passed.');
