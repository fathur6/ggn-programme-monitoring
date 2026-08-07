const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const gasSources = [
  'gas/ResearchLockService.gs',
  'gas/ResearchDataService.gs',
  'gas/ResearchReferenceService.gs',
  'gas/ProgrammeSDGService.gs',
  'gas/ResearchMappingService.gs',
  'gas/ResearchReviewService.gs',
  'gas/AssessmentService.gs',
  'gas/ResearchWorkspaceService.gs',
  'gas/Auth.gs',
  'gas/Code.gs'
].map(file => fs.readFileSync(file, 'utf8')).join('\n');

function FakeSheet(name, rows) {
  this.name = name;
  this.rows = rows || [];
  this.getName = () => this.name;
  this.getLastRow = () => this.rows.length;
  this.getDataRange = () => ({getValues: () => this.rows.map(row => row.slice())});
  this.appendRow = row => this.rows.push(row.slice());
  this.insertRowsAfter = (row, count) => {
    for (let i = 0; i < count; i++) this.rows.push([]);
  };
  this.getRange = (row, column, numRows, numColumns) => ({
    setValues: values => {
      for (let i = 0; i < numRows; i++) {
        while (this.rows[row - 1 + i].length < column - 1 + numColumns) this.rows[row - 1 + i].push('');
        for (let j = 0; j < numColumns; j++) this.rows[row - 1 + i][column - 1 + j] = values[i][j];
      }
    },
    clearContent: () => {
      for (let i = 0; i < numRows; i++) {
        if (this.rows[row - 1 + i]) this.rows[row - 1 + i] = [];
      }
    }
  });
}

function FakeSpreadsheet(existing) {
  this.sheets = existing || {};
  this.getSheetByName = name => this.sheets[name] || null;
  this.insertSheet = name => {
    const sheet = new FakeSheet(name, []);
    this.sheets[name] = sheet;
    return sheet;
  };
  this.getSheetsData = () => Object.keys(this.sheets).map(title => ({title, sheetId: title, data: this.sheets[title].getDataRange().getValues()}));
}

const researchHeaders = {
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']
};

const spreadsheet = new FakeSpreadsheet({
  'MQA/FA100': new FakeSheet('MQA/FA100', [
    ['PEO'],
    ['PEO1', 'Produce trustworthy research outcomes'],
    ['PLO'],
    ['PLO1', 'Demonstrate systematic research capability', 'MQF2', 'PEO1', 'C4']
  ])
});

let currentProgramme = {
  programmeId: 'FUHA::PL6008::MQA/FA100',
  mqaCode: 'MQA/FA100',
  faculty: 'FUHA',
  facultyFull: 'Faculty of Applied Research',
  progCode: 'PL6008',
  name: 'Master of Research',
  level: 'Masters',
  mode: 'Research'
};
let currentUser = {email: 'admin@unisza.edu.my', role: 'Admin', faculty: '', capabilities: {graduateSchoolAdmin: true}};
let lockDepth = 0;
let maxLockDepth = 0;
let lockAttempts = 0;
let lockBusy = false;
let sleepDelays = [];
const diagnostics = [];

const context = {
  console: {error: message => diagnostics.push(String(message)), log: () => {}},
  getSpreadsheet: () => spreadsheet,
  getCurrentUser_: () => currentUser,
  resolveProgramme_: value => {
    const requested = String(value || '').trim();
    return requested === currentProgramme.programmeId || requested === currentProgramme.mqaCode ? currentProgramme : null;
  },
  findProgrammesByMqaCode_: () => [currentProgramme],
  isResearchProgramme_: programme => !!programme && String(programme.mode || '').toLowerCase() === 'research',
  getActiveAccessGrant_: () => null,
  LockService: {
    getScriptLock: () => ({
      tryLock: () => {
        lockAttempts++;
        if (lockBusy) return false;
        lockDepth++;
        maxLockDepth = Math.max(maxLockDepth, lockDepth);
        return true;
      },
      releaseLock: () => { lockDepth--; }
    })
  },
  Utilities: {sleep: delay => sleepDelays.push(delay), getUuid: () => 'TEST-UUID'},
  Session: {getActiveUser: () => ({getEmail: () => ''})},
  CONFIG: {SHEET_ID: ''},
  SpreadsheetApp: {openById: () => spreadsheet, getActiveSpreadsheet: () => spreadsheet}
};
vm.runInNewContext(gasSources, context);
// Auth.gs defines the production lookup; the deterministic fixture injects the
// authenticated actor and spreadsheet after all source files are evaluated.
context.getCurrentUser_ = () => currentUser;
context.getSpreadsheet = () => spreadsheet;

function resetLockMetrics() {
  lockAttempts = 0;
  sleepDelays = [];
  maxLockDepth = 0;
}

function callResearch() {
  return context.getResearchWorkspaceApi(currentProgramme.programmeId);
}

assert.strictEqual(typeof context.getResearchWorkspaceApi, 'function', 'Public research aggregate wrapper is missing');
if (process.argv.includes('--assessment-server')) {
  assert.strictEqual(typeof context.getAssessmentWorkspaceApi, 'function', 'Public assessment aggregate wrapper is missing');
}

resetLockMetrics();
const researchBefore = JSON.stringify(spreadsheet.sheets);
const research = callResearch();
const researchAfterPreparation = JSON.stringify(spreadsheet.sheets);
assert.strictEqual(research.ok, true);
assert.strictEqual(research.programmeId, currentProgramme.programmeId);
assert.deepStrictEqual(Object.keys(research.endpoints), ['profile', 'peos', 'plos', 'references', 'mappings', 'coverage', 'review']);
assert(!Object.prototype.hasOwnProperty.call(research, 'assessmentMapping'), 'Initial aggregate must not contain assessment mapping');
assert(!Object.prototype.hasOwnProperty.call(research, 'assessmentReview'), 'Initial aggregate must not contain assessment review');
Object.keys(research.endpoints).forEach(endpoint => assert.strictEqual(research.endpoints[endpoint].ok, true, endpoint + ' envelope failed'));
assert.strictEqual(lockAttempts, 1, 'Research aggregate must own one preparation lock');
assert.strictEqual(maxLockDepth, 1, 'Research aggregate must not acquire nested locks');

const secondResearch = callResearch();
assert.strictEqual(secondResearch.ok, true);
assert.strictEqual(JSON.stringify(spreadsheet.sheets), researchAfterPreparation, 'Aggregate projection must not mutate after preparation');
assert.notStrictEqual(researchBefore, researchAfterPreparation, 'Cold-start preparation should create/seed its owned sheets');

const originalReviewProjection = context.researchWorkspaceReviewFromSnapshot_;
context.researchWorkspaceReviewFromSnapshot_ = () => { throw new Error('internal sheet schema detail'); };
const partialResearch = callResearch();
assert.strictEqual(partialResearch.endpoints.profile.ok, true, 'Successful profile data must survive a sibling failure');
assert.strictEqual(partialResearch.endpoints.review.ok, false);
assert.strictEqual(partialResearch.endpoints.review.error.endpoint, 'review');
assert.strictEqual(partialResearch.endpoints.review.error.code, 'RESEARCH_REVIEW_FAILED');
assert(!partialResearch.endpoints.review.error.message.includes('schema'), 'Server diagnostics must not reach the client');
assert(diagnostics.some(entry => entry.includes('endpoint=review') && entry.includes('RESEARCH_REVIEW_FAILED')));
context.researchWorkspaceReviewFromSnapshot_ = originalReviewProjection;

let researchMappingFailure;
[
  ['researchWorkspaceProfileFromSnapshot_', 'profile'],
  ['researchWorkspacePEOsFromSnapshot_', 'peos'],
  ['researchWorkspacePLOsFromSnapshot_', 'plos'],
  ['researchWorkspaceMappingsFromSnapshot_', 'mappings']
].forEach(([projection, endpoint]) => {
  const originalProjection = context[projection];
  context[projection] = () => { throw new Error(endpoint + ' projection failed'); };
  const partial = callResearch();
  assert.strictEqual(partial.ok, true, endpoint + ' projection failure must remain inside the aggregate');
  assert.strictEqual(partial.endpoints[endpoint].ok, false, endpoint + ' projection must fail its own envelope');
  assert.strictEqual(partial.endpoints[endpoint].error.endpoint, endpoint);
  assert.strictEqual(partial.endpoints[endpoint].error.code, 'RESEARCH_' + endpoint.toUpperCase() + '_FAILED');
  assert.strictEqual(partial.endpoints.references.ok, true, endpoint + ' failure must preserve reference data');
  assert.strictEqual(partial.endpoints.profile.ok, endpoint === 'profile' ? false : true, endpoint + ' failure must preserve profile data when independent');
  if (endpoint === 'mappings') researchMappingFailure = partial;
  context[projection] = originalProjection;
});

const pureRowsBefore = JSON.stringify(spreadsheet.sheets);
callResearch();
assert.strictEqual(JSON.stringify(spreadsheet.sheets), pureRowsBefore, 'Aggregate read projection must not repair or append rows');

const references = context.getResearchReferencesApi();
assert(references.MQF.length > 0, 'Authenticated reference endpoint should return references');
assert.strictEqual(context.getResearchReferencesApi.length, 0, 'Reference endpoint must keep its no-programme-argument signature');
currentUser = null;
assert.throws(() => context.getResearchReferencesApi(), /unauthorized/i);
assert.throws(() => callResearch(), error => error.code === 'RESEARCH_UNAUTHORIZED' && error.retryable === false);
currentUser = {email: 'admin@unisza.edu.my', role: 'Admin', faculty: '', capabilities: {graduateSchoolAdmin: true}};
const savedMode = currentProgramme.mode;
currentProgramme.mode = 'Coursework';
assert.throws(() => callResearch(), error => error.code === 'RESEARCH_FORBIDDEN');
currentProgramme.mode = savedMode;

const warmBefore = JSON.stringify(spreadsheet.sheets);
const warmResearch = callResearch();
assert.strictEqual(warmResearch.ok, true, 'Warm reads must succeed without acquiring the lock');
assert.strictEqual(lockAttempts, 1, 'Warm aggregate reads must be lock-free after cold-start setup');
assert.strictEqual(JSON.stringify(spreadsheet.sheets), warmBefore, 'Warm reads must stay pure and lock-free');

lockBusy = true;
resetLockMetrics();
const coldSpreadsheet = new FakeSpreadsheet({});
const originalGetSpreadsheet = context.getSpreadsheet;
context.getSpreadsheet = () => coldSpreadsheet;
assert.throws(() => callResearch(), error => error.code === 'RESEARCH_LOCK_BUSY' && error.retryable === true);
assert.strictEqual(lockAttempts, 4, 'Busy cold-start setup should use the bounded four-attempt policy');
assert.deepStrictEqual(sleepDelays, [250, 500, 1000]);
context.getSpreadsheet = originalGetSpreadsheet;
lockBusy = false;

if (process.argv.includes('--assessment-server')) {
const alignmentHeaders = ['ProgrammeId', 'ItemId', 'MQFDomainsJson', 'Taxonomy', 'PrimarySC', 'Note', 'UpdatedAt', 'UpdatedBy'];
spreadsheet.sheets.PR_AssessmentAlignments = new FakeSheet('PR_AssessmentAlignments', [
  alignmentHeaders,
  [currentProgramme.programmeId, 'japsu-2026-master-s1', '["MQF2"]', 'C5', '', '', '', '']
]);
resetLockMetrics();
const assessment = context.getAssessmentWorkspaceApi(currentProgramme.programmeId);
assert.strictEqual(assessment.ok, true);
assert.deepStrictEqual(Object.keys(assessment.endpoints), ['mapping', 'review']);
assert.strictEqual(assessment.endpoints.mapping.ok, true);
assert.strictEqual(assessment.endpoints.review.ok, true);
assert(assessment.endpoints.review.data.critical.some(issue => /exactly one primary sc/i.test(issue.message)), 'Assessment review must preserve strict Primary SC validation');
assert.strictEqual(lockAttempts, 1, 'Assessment aggregate must use one shared setup/capture lock');
assert.strictEqual(maxLockDepth, 1, 'Assessment aggregate must not acquire nested locks');

const originalAssessmentReview = context.assessmentReviewFromProjection_;
context.assessmentReviewFromProjection_ = () => { throw new Error('review projection failed'); };
const assessmentPartial = context.getAssessmentWorkspaceApi(currentProgramme.programmeId);
assert.strictEqual(assessmentPartial.endpoints.mapping.ok, true);
assert.strictEqual(assessmentPartial.endpoints.review.ok, false);
assert.strictEqual(assessmentPartial.endpoints.review.error.endpoint, 'assessment/review');
assert.strictEqual(assessmentPartial.endpoints.review.error.code, 'ASSESSMENT_REVIEW_FAILED');
assert.notStrictEqual(assessmentPartial.endpoints.review.error.endpoint, partialResearch.endpoints.review.error.endpoint);
assert.notStrictEqual(assessmentPartial.endpoints.review.error.code, partialResearch.endpoints.review.error.code);
assert(diagnostics.some(entry => entry.includes('endpoint=assessment/review') && entry.includes('ASSESSMENT_REVIEW_FAILED')));
context.assessmentReviewFromProjection_ = originalAssessmentReview;

const originalAssessmentProjection = context.assessmentProjection_;
context.assessmentProjection_ = (programme, definitions, alignments, refs, requirePrimarySC) => {
  if (!requirePrimarySC) throw new Error('mapping projection failed');
  return originalAssessmentProjection(programme, definitions, alignments, refs, requirePrimarySC);
};
const inverseAssessmentPartial = context.getAssessmentWorkspaceApi(currentProgramme.programmeId);
assert.strictEqual(inverseAssessmentPartial.endpoints.mapping.ok, false);
assert.strictEqual(inverseAssessmentPartial.endpoints.mapping.error.endpoint, 'assessment/mapping');
assert.strictEqual(inverseAssessmentPartial.endpoints.mapping.error.code, 'ASSESSMENT_MAPPING_FAILED');
assert.notStrictEqual(inverseAssessmentPartial.endpoints.mapping.error.endpoint, researchMappingFailure.endpoints.mappings.error.endpoint);
assert.notStrictEqual(inverseAssessmentPartial.endpoints.mapping.error.code, researchMappingFailure.endpoints.mappings.error.code);
assert.strictEqual(inverseAssessmentPartial.endpoints.review.ok, true);
assert(diagnostics.some(entry => entry.includes('endpoint=assessment/mapping') && entry.includes('ASSESSMENT_MAPPING_FAILED')));
context.assessmentProjection_ = originalAssessmentProjection;
}

if (process.argv.includes('--research-server')) console.log('Research workspace aggregate server tests passed.');
if (process.argv.includes('--assessment-server')) console.log('Assessment workspace aggregate server tests passed.');
if (!process.argv.includes('--research-server') && !process.argv.includes('--assessment-server')) console.log('Research workspace aggregate tests passed.');
