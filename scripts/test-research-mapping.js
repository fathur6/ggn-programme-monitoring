const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadResearchHelpers() {
  const context = {
    console,
    getSpreadsheet: function() {
      throw new Error('getSpreadsheet is not available in pure helper tests');
    },
    getCurrentUser: function() {
      return { email: 'test@unisza.edu.my' };
    }
  };
  const source = [
    fs.readFileSync('gas/ResearchDataService.gs', 'utf8'),
    fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8')
  ].join('\n');
  vm.runInNewContext(source, context);
  return context;
}

const helpers = loadResearchHelpers();
const researchSheetNames = Object.keys(helpers.RESEARCH_SHEET_HEADERS);
const { getResearchProgrammeKey_, validateReferenceIds_ } = helpers;

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
assert.strictEqual(getResearchProgrammeKey_({mqaCode: 'MQA/TEST'}), 'MQA/TEST');
assert.deepStrictEqual(Array.from(validateReferenceIds_(['MQF2'], ['MQF1', 'MQF2'])), ['MQF2']);
assert.throws(() => validateReferenceIds_(['INVALID'], ['MQF1', 'MQF2']), /invalid/i);

console.log('Research mapping boundary tests passed.');
