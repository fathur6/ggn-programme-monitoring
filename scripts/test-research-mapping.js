const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadResearchHelpers() {
  const sheets = {};
  const lockState = { tryLockCalls: 0, waitLockCalls: 0, releaseCalls: 0, depth: 0, unlockedDataReads: 0 };
  function makeSheet(name, values) {
    return {
      name,
      values: values || [],
      getLastRow: function() { return this.values.length; },
      appendRow: function(row) { this.values.push(row); },
      getDataRange: function() {
        if (lockState.depth === 0) lockState.unlockedDataReads++;
        return { getValues: () => this.values };
      },
      insertRowsAfter: function(after, count) {
        for (let index = 0; index < count; index++) this.values.push([]);
      },
      getRange: function(row, column, numRows, numColumns) {
        return {
          clearContent: function() {
            for (let rowIndex = row - 1; rowIndex < row - 1 + numRows; rowIndex++) {
              if (this.values) this.values[rowIndex] = [];
            }
          }.bind(this),
          setValues: function(rows) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
              this.values[row - 1 + rowIndex] = rows[rowIndex].slice(0, numColumns);
            }
          }.bind(this)
        };
      }
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
      return code === 'MQA/TEST' ? {
        mqaCode: code, faculty: 'Research Faculty', name: 'Test Research Programme', level: 'Doctoral'
      } : null;
    },
    requireProgrammeAccess_: function() {
      return { user: { email: 'test@unisza.edu.my' } };
    },
    LockService: {
      getScriptLock: function() {
        return {
          tryLock: function() { lockState.tryLockCalls++; return true; },
          waitLock: function() { lockState.waitLockCalls++; lockState.depth++; return true; },
          releaseLock: function() { lockState.releaseCalls++; lockState.depth--; }
        };
      }
    },
    __lockState: lockState
  };
  const source = [
    fs.readFileSync('gas/ResearchDataService.gs', 'utf8'),
    fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8'),
    fs.readFileSync('gas/ResearchMappingService.gs', 'utf8'),
    fs.readFileSync('gas/ResearchReviewService.gs', 'utf8'),
    fs.readFileSync('gas/GovernanceService.gs', 'utf8'),
  ].join('\n');
  vm.runInNewContext(source, context);
  return context;
}

const helpers = loadResearchHelpers();
const researchSheetNames = Object.keys(helpers.RESEARCH_SHEET_HEADERS);
const { getResearchProgrammeKey_, validateReferenceIds_ } = helpers;
const researchMappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');

const incomplete = helpers.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: '', parentPEO: 'PEO1', mqfDomains: [], taxonomy: ''}],
  mappings: []
});
assert(incomplete.critical.some(function(issue) { return issue.code === 'PLO_STATEMENT_REQUIRED'; }));
assert.strictEqual(incomplete.status, 'Needs attention');

const ready = helpers.validateResearchProgramme_({
  peos: [{code: 'PEO1', statement: 'Objective'}],
  plos: [{code: 'PLO1', statement: 'Outcome', parentPEO: 'PEO1', mqfDomains: ['MQF2'], taxonomy: 'C4'}],
  mappings: [{ploId: 'P1', sdgIds: ['SDG4'], scIds: ['SC2'], derivedTFIds: ['TF2']}]
});
assert.strictEqual(ready.status, 'Ready for review');
assert.strictEqual(helpers.isLegalResearchStatusTransition_('Draft', 'Needs attention'), true);
assert.strictEqual(helpers.isLegalResearchStatusTransition_('Draft', 'Ready for review'), true);
assert.strictEqual(helpers.isLegalResearchStatusTransition_('Draft', 'Submitted'), true);
assert.strictEqual(helpers.isLegalResearchStatusTransition_('Submitted', 'Approved'), true);
assert.strictEqual(helpers.isLegalResearchStatusTransition_('Draft', 'Approved'), false);

assert.deepStrictEqual(JSON.parse(JSON.stringify(helpers.deriveTFIds_(['MQF2', 'MQF3d'], {
  TF1: ['MQF1', 'MQF4a'],
  TF2: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']
}))), ['TF2']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(helpers.calculatePEOCoverage_([
  {parentPEO: 'PEO1', derivedTFIds: ['TF1'], sdgIds: ['SDG4'], scIds: ['SC2']},
  {parentPEO: 'PEO1', derivedTFIds: ['TF2'], sdgIds: ['SDG4'], scIds: ['SC3']}
], 'PEO1'))), {
  tfIds: ['TF1', 'TF2'], sdgIds: ['SDG4'], scIds: ['SC2', 'SC3'], childCount: 2,
  derivedLabel: 'Derived from PLO mappings'
});
assert.throws(() => helpers.calculatePEOCoverage_([], 'PEO1'), /no child PLO/i);

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

const savedProfile = helpers.saveResearchProfileApi_('MQA/TEST', {
  studyMode: 'Part-time', studyField: 'Computing', session: '2026',
  documentVersion: 'v1', dataOwner: 'owner@example.com', mappingStatus: 'Submitted'
});
assert.strictEqual(savedProfile.mappingStatus, 'Draft');
assert.strictEqual(typeof savedProfile.createdAt, 'string');
assert.strictEqual(typeof savedProfile.updatedAt, 'string');
assert.strictEqual(helpers.getResearchProgrammeApi_('MQA/TEST').mappingStatus, 'Draft');
assert.strictEqual(sheets.PR_ProgrammeProfile.values[1][10], 'Draft');

const savedPEOs = helpers.saveResearchPEOsApi_('MQA/TEST', [
  { code: ' PEO1 ', statement: ' Lead research ' }
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(savedPEOs.map(function(peo) {
  return { code: peo.code, statement: peo.statement };
}))), [{ code: 'PEO1', statement: 'Lead research' }]);
assert.strictEqual(typeof savedPEOs[0].updatedAt, 'string');
assert.deepStrictEqual(JSON.parse(JSON.stringify(helpers.getResearchPEOsApi_('MQA/TEST').map(function(peo) {
  return { code: peo.code, statement: peo.statement };
}))), [{ code: 'PEO1', statement: 'Lead research' }]);

assert.throws(function() {
  helpers.saveResearchPLOsApi_('MQA/TEST', [{
    code: 'PLO1', statement: 'Outcome', parentPEO: '   ', mqfDomains: ['MQF2'], taxonomy: 'c4'
  }]);
}, /parent PEO/i);
assert.strictEqual(sheets.PR_PLORecords.getLastRow(), 1);

const savedPLOs = helpers.saveResearchPLOsApi_('MQA/TEST', [{
  code: ' PLO1 ', statement: ' Outcome ', parentPEO: 'PEO1',
  mqfDomains: [' MQF2 ', 'MQF2'], taxonomy: ' c4 ', rationale: ' rationale '
}]);
assert.strictEqual(savedPLOs[0].taxonomy, 'C4');
assert.deepStrictEqual(JSON.parse(JSON.stringify(savedPLOs[0].mqfDomains)), ['MQF2']);
assert.strictEqual(savedPLOs[0].status, 'Draft');
assert.strictEqual(typeof savedPLOs[0].updatedAt, 'string');
assert.strictEqual(sheets.PR_PLORecords.values[1][6], 'C4');
assert.strictEqual(sheets.PR_PLORecords.values[1][8], 'Draft');
const readPLOs = helpers.getResearchPLOsApi_('MQA/TEST');
assert.strictEqual(readPLOs[0].taxonomy, 'C4');
assert.deepStrictEqual(JSON.parse(JSON.stringify(readPLOs[0].mqfDomains)), ['MQF2']);
assert.strictEqual(typeof readPLOs[0].updatedAt, 'string');
const savedMapping = helpers.saveResearchPLOMappingApi_('MQA/TEST', savedPLOs[0].ploId, {
  sdgIds: ['SDG4', 'SDG4'], scIds: ['SC2'], derivedTFIds: ['TF1'], mappingNote: 'Research rationale'
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(savedMapping.sdgIds)), ['SDG4']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(savedMapping.scIds)), ['SC2']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(savedMapping.derivedTFIds)), ['TF2']);
assert.strictEqual(savedMapping.derivedLabel, 'Derived from PLO mappings');
assert.strictEqual(savedMapping.mappingNote, 'Research rationale');
helpers.__lockState.unlockedDataReads = 0;
// Persisted derived values must not be authoritative when the PLO changes.
sheets.PR_PLOMappings.values[1][4] = JSON.stringify(['TF2']);
sheets.PR_PLORecords.values[1][5] = JSON.stringify(['MQF1']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(helpers.getResearchMappingsApi_('MQA/TEST').map(function(mapping) {
  return {ploId: mapping.ploId, derivedTFIds: mapping.derivedTFIds, derivedLabel: mapping.derivedLabel};
}))), [{ploId: savedPLOs[0].ploId, derivedTFIds: ['TF1'], derivedLabel: 'Derived from PLO mappings'}]);
assert.deepStrictEqual(JSON.parse(sheets.PR_PLOMappings.values[1][4]), ['TF1']);
assert.strictEqual(helpers.__lockState.unlockedDataReads, 0);
const coverage = helpers.getResearchCoverageApi_('MQA/TEST');
assert.deepStrictEqual(JSON.parse(JSON.stringify(coverage.globalCoverage)), {
  mqfIds: ['MQF1'], tfIds: ['TF1'], sdgIds: ['SDG4'], scIds: ['SC2']
});
assert.strictEqual(coverage.ploReadiness[0].ready, true);
assert.strictEqual(coverage.peoCoverage[0].coverage.derivedLabel, 'Derived from PLO mappings');
assert.strictEqual(helpers.__lockState.unlockedDataReads, 0);
assert.throws(() => helpers.saveResearchPLOMappingApi_('MQA/TEST', savedPLOs[0].ploId, {sdgIds: ['SDG99']}), /invalid/i);
assert.strictEqual(helpers.__lockState.waitLockCalls >= 3, true);

const review = helpers.getResearchReviewApi_('MQA/TEST');
assert.strictEqual(review.status, 'Ready for review');
assert.strictEqual(review.metrics.ploTotal, 1);
assert.strictEqual(review.metrics.ploWithMQF, 1);
assert.strictEqual(typeof review.updatedAt, 'string');
assert.strictEqual(helpers.saveResearchStatusApi_('MQA/TEST', {status: 'Draft'}).status, 'Draft');
assert.throws(function() { helpers.saveResearchStatusApi_('MQA/TEST', 'Submitted'); }, /guarded submission/i);
const submitWaitLocks = helpers.__lockState.waitLockCalls;
const submitUnlockedReads = helpers.__lockState.unlockedDataReads;
assert.strictEqual(helpers.submitResearchProgrammeApi_('MQA/TEST').status, 'Submitted');
assert.strictEqual(sheets.PR_ProgrammeProfile.values[1][10], 'Submitted');
assert.strictEqual(helpers.__lockState.waitLockCalls, submitWaitLocks + 1);
assert.strictEqual(helpers.__lockState.unlockedDataReads, submitUnlockedReads);

sheets.PR_PLORecords.values[1][4] = '';
assert.throws(function() { helpers.submitResearchProgrammeApi_('MQA/TEST'); }, /critical review issues/i);
assert.strictEqual(helpers.getResearchReviewApi_('MQA/TEST').status, 'Needs attention');
sheets.PR_PLORecords.values[1][4] = 'Outcome';

assert.strictEqual(helpers.getResearchReviewApi_('MQA/TEST').status, 'Submitted');
assert.strictEqual(helpers.getResearchReviewApi_('MQA/TEST').metrics.ploWithValidTF, 1);
assert.strictEqual(helpers.__lockState.unlockedDataReads, 0);

assert.throws(function() { helpers.saveResearchStatusApi_('MQA/TEST', 'Approved'); }, /admin only/i);
helpers.requireProgrammeAccess_ = function() {
  return { user: { email: 'admin@unisza.edu.my', role: 'Admin', capabilities: { graduateSchoolAdmin: true } } };
};
helpers.isGraduateSchoolAdmin_ = function(user) { return !!user && user.role === 'Admin'; };
assert.strictEqual(helpers.saveResearchStatusApi_('MQA/TEST', 'Approved').status, 'Approved');

assert.strictEqual(helpers.isResearchMappingComplete_({ploTotal: 2, ploWithMQF: 2, ploWithValidTF: 1}), false);
assert.strictEqual(helpers.isResearchMappingComplete_({ploTotal: 2, ploWithMQF: 2, ploWithValidTF: 2}), true);

helpers.getCurrentUser = function() { return { email: 'faculty@unisza.edu.my', faculty: 'Faculty A' }; };
helpers.isGraduateSchoolAdmin_ = function() { return false; };
helpers.getProgrammes = function(faculty) {
  assert.strictEqual(faculty, 'Faculty A');
  return [{faculty: 'Faculty A', facultyFull: 'Faculty A', mqaCode: 'MQA/A'}];
};
helpers.computeProgrammeStatus_ = function(programme) {
  assert.strictEqual(programme.faculty, 'Faculty A');
  return {completionState: 'Draft', mqfDomainState: 'Needs attention', taxonomyState: 'Needs attention', mappingState: 'Needs attention', documentState: 'Not required', reviewState: 'Blocked', submissionState: 'Draft', overdue: false};
};
helpers.Utilities = {formatDate: function() { return '2026-07'; }};
helpers.Session = {getScriptTimeZone: function() { return 'UTC'; }};
assert.strictEqual(helpers.getUniversityDashboardApi_().programmeCount, 1);

helpers.requireProgrammeAccess_ = function() { throw new Error('programme access denied'); };
assert.throws(() => helpers.getResearchMappingsApi_('MQA/TEST'), /access denied/i);

helpers.LockService.getScriptLock = function() {
  return { tryLock: function() { return false; }, waitLock: function() { throw new Error('must not wait'); }, releaseLock: function() { throw new Error('must not release'); } };
};
assert.throws(() => helpers.ensureResearchSheets_(), /initialize research sheets/i);

helpers.getCurrentUser = function() { return null; };
assert.throws(() => helpers.getResearchReferencesApi(), /unauthorized/i);

console.log('Research mapping boundary tests passed.');
