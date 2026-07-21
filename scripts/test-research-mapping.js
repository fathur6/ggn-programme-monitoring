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
    fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8'),
    fs.readFileSync('gas/ResearchMappingService.gs', 'utf8')
  ].join('\n');
  vm.runInNewContext(source, context);
  return context;
}

const helpers = loadResearchHelpers();
const researchSheetNames = Object.keys(helpers.RESEARCH_SHEET_HEADERS);
const { getResearchProgrammeKey_, validateReferenceIds_ } = helpers;
const researchMappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');

assert.deepStrictEqual(JSON.parse(JSON.stringify(helpers.normalizeResearchPLO_({
  code: ' PLO1 ',
  statement: ' Outcome ',
  parentPEO: 'PEO1',
  mqfDomains: ['MQF2', 'MQF2'],
  taxonomy: 'C4'
}))), {
  code: 'PLO1', statement: 'Outcome', parentPEO: 'PEO1',
  mqfDomains: ['MQF2'], taxonomy: 'C4', rationale: ''
});
assert.strictEqual(helpers.normalizeResearchPLO_({taxonomy: ' c4 '}).taxonomy, 'C4');
assert.throws(() => helpers.validatePLOParents_([
  {code: 'PLO1', parentPEO: 'PEO9'}
], [{code: 'PEO1'}]), /parent PEO/i);
assert.throws(() => helpers.validatePLOParents_([
  {code: 'PLO1', parentPEO: ''}
], [{code: 'PEO1'}]), /parent PEO/i);
assert.throws(() => helpers.validateDuplicateCodes_([
  {code: 'PLO1'}, {code: 'PLO1'}
], 'PLO'), /duplicate/i);
const auditDate = new Date('2026-07-21T12:34:56.000Z');
assert.strictEqual(helpers.serializeResearchDate_(auditDate), '2026-07-21T12:34:56.000Z');
assert.strictEqual(typeof helpers.profileFromRow_([
  'programme', 'MQA/TEST', '', '', '', '', '', '', '', '', 'Draft', auditDate, auditDate, 'user@example.com'
]).createdAt, 'string');
assert.strictEqual(typeof helpers.peoFromRow_([
  'peo', 'programme', 'PEO1', 'Statement', 0, auditDate, 'user@example.com'
]).updatedAt, 'string');
assert.strictEqual(typeof helpers.ploFromRow_([
  'plo', 'programme', 'PEO1', 'PLO1', 'Statement', '[]', 'C4', '', 'Draft', auditDate, 'user@example.com'
]).updatedAt, 'string');
assert.strictEqual(helpers.mappingFromRow_([
  'plo', 'programme', '[]', '[]', '[]', '', auditDate, 'user@example.com'
]).updatedAt, '2026-07-21T12:34:56.000Z');
assert(!/profile\.mappingStatus/.test(researchMappingSource), 'Profile save must not accept client mappingStatus');
assert(/profile\.dataOwner[\s\S]*?'Draft'/.test(researchMappingSource), 'Profile save must retain server-controlled Draft status');
assert(/JSON\.stringify\(plo\.mqfDomains\)[\s\S]*?'Draft'/.test(researchMappingSource), 'PLO save must retain server-controlled Draft status');

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
assert.throws(() => getResearchProgrammeKey_({mqaCode: 'MQA/UNKNOWN'}), /programme directory/i);
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
