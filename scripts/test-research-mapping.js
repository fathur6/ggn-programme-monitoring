const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadResearchHelpers() {
  const sheets = {};
  const lockState = { tryLockCalls: 0, releaseCalls: 0 };
  function makeSheet(name, values) {
    return {
      name,
      values: values || [],
      getLastRow: function() { return this.values.length; },
      appendRow: function(row) { this.values.push(row); },
      getDataRange: function() { return { getValues: () => this.values }; }
    };
  }
  const spreadsheet = {
    getSheetByName: function(name) { return sheets[name] || null; },
    insertSheet: function(name) { sheets[name] = makeSheet(name); return sheets[name]; }
  };
  const context = {
    console,
    getSpreadsheet: function() {
      return spreadsheet;
    },
    getCurrentUser: function() {
      return { email: 'test@unisza.edu.my' };
    },
    findProgrammeByMqaCode_: function(code) {
      return code === 'MQA/TEST' ? { mqaCode: code } : null;
    },
    LockService: {
      getScriptLock: function() {
        return {
          tryLock: function() { lockState.tryLockCalls++; return true; },
          releaseLock: function() { lockState.releaseCalls++; }
        };
      }
    },
    __lockState: lockState
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
assert.strictEqual(JSON.stringify(helpers.RESEARCH_SHEET_HEADERS), JSON.stringify({
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_MQFReference: ['Code', 'Title', 'Description', 'Active'],
  PR_TFReference: ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
  PR_SDGReference: ['Code', 'Title', 'Description', 'Active'],
  PR_SCReference: ['Code', 'Title', 'Description', 'Active']
}));
assert.strictEqual(getResearchProgrammeKey_({mqaCode: ' MQA/TEST '}), 'MQA/TEST');
assert.throws(() => getResearchProgrammeKey_({programmeId: 'arbitrary-id'}), /programme/i);
assert.deepStrictEqual(Array.from(validateReferenceIds_([' MQF2 ', 'MQF2', ''], ['MQF1', 'MQF2'])), ['MQF2']);
assert.throws(() => validateReferenceIds_(['INVALID'], ['MQF1', 'MQF2']), /invalid/i);

const sheets = helpers.ensureResearchSheets_();
assert.strictEqual(helpers.LockService.getScriptLock().tryLock !== undefined, true);
assert.strictEqual(helpers.__lockState.tryLockCalls > 0, true);
assert.strictEqual(helpers.__lockState.releaseCalls > 0, true);
assert.strictEqual(helpers.RESEARCH_SHEET_HEADERS.PR_MQFReference.join('|'), 'Code|Title|Description|Active');
assert.strictEqual(sheets.PR_MQFReference.getLastRow() > 1, true);
assert.strictEqual(sheets.PR_TFReference.getLastRow() > 1, true);
assert.strictEqual(helpers.getResearchReferences_().mqf.some(row => row.code === 'MQF1'), true);

sheets.PR_MQFReference.appendRow(['MQF-INACTIVE', 'Hidden', '', false]);
assert.strictEqual(helpers.getResearchReferences_().mqf.some(row => row.code === 'MQF-INACTIVE'), false);

helpers.LockService.getScriptLock = function() {
  return { tryLock: function() { return false; }, releaseLock: function() { throw new Error('must not release'); } };
};
assert.throws(() => helpers.ensureResearchSheets_(), /initialize research sheets/i);

helpers.getCurrentUser = function() { return null; };
assert.throws(() => helpers.getResearchReferencesApi(), /unauthorized/i);

console.log('Research mapping boundary tests passed.');
