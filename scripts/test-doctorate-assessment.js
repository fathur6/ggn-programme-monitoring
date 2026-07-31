const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const gasSources = [
  'gas/ResearchLockService.gs',
  'gas/ResearchDataService.gs',
  'gas/ResearchReferenceService.gs',
  'gas/ResearchMappingService.gs',
  'gas/ResearchReviewService.gs',
  'gas/AssessmentService.gs',
  'gas/ResearchWorkspaceService.gs',
  'gas/Auth.gs',
  'gas/Code.gs',
  'gas/ProgrammeService.gs'
].map(file => fs.readFileSync(file, 'utf8')).join('\n');

function FakeSheet(name, rows) {
  this.name = name;
  this.rows = rows || [];
  this.getName = () => this.name;
  this.getLastRow = () => this.rows.length;
  this.getDataRange = () => ({getValues: () => this.rows.map(row => row.slice())});
  this.appendRow = row => this.rows.push(row.slice());
  this.insertRowsAfter = (row, count) => { for (let i = 0; i < count; i++) this.rows.push([]); };
  this.getRange = (row, column, numRows, numColumns) => ({
    setValues: values => {
      for (let i = 0; i < numRows; i++) {
        while (this.rows[row - 1 + i].length < column - 1 + numColumns) this.rows[row - 1 + i].push('');
        for (let j = 0; j < numColumns; j++) this.rows[row - 1 + i][column - 1 + j] = values[i][j];
      }
    },
    clearContent: () => {
      for (let i = 0; i < numRows; i++) if (this.rows[row - 1 + i]) this.rows[row - 1 + i] = [];
    }
  });
}

function FakeSpreadsheet(existing) {
  this.sheets = existing || {};
  this.getSheetByName = name => this.sheets[name] || null;
  this.insertSheet = name => { const sheet = new FakeSheet(name, []); this.sheets[name] = sheet; return sheet; };
  this.getSheetsData = () => Object.keys(this.sheets).map(title => ({title, sheetId: title, data: this.sheets[title].getDataRange().getValues()}));
}

const programmeRows = [
  ['Nama Program (Bahasa Melayu)', 'Programme Name (English)', 'MQA Reference Code', 'NEC 2020', 'Program Code', '', 'Faculty Full Name', 'Faculty Abbrev', '', '', 'Mode of Study'],
  ['Doktor Falsafah', 'Doctor of Philosophy', 'MQA/FA00123', '0.000', 'PS7001', '', 'Pusat Pengajian Siswazah', 'PPS', '', '', 'Research'],
  ['Doktor Falsafah (Pengurusan)', 'PhD (Management)', 'MQA/FA00124', '0.000', 'PS7002', '', 'Fakulti Pengurusan', 'FP', '', '', 'Research'],
  ['Doktor Falsafah (Pendidikan)', 'Ph.D. (Education)', 'MQA/FA00125', '0.000', 'PS7003', '', 'Fakulti Pendidikan', 'FED', '', '', 'Research'],
  ['Doktor Falsafah (Sains)', '', 'MQA/FA00126', '0.000', 'PS7004', '', 'Fakulti Sains', 'FS', '', '', 'Research'],
  ['Sarjana Sains', '', 'MQA/FA00127', '0.000', 'PS6001', '', 'Pusat Pengajian Siswazah', 'PPS', '', '', 'Research'],
  ['Sarjana Sains', 'Master of Science', 'MQA/FA00128', '0.000', 'PS6002', '', 'Pusat Pengajian Siswazah', 'PPS', '', '', 'Research'],
  ['Sarjana Muda Sains', 'Bachelor of Science', 'MQA/FA00129', '0.000', 'BS6001', '', 'Fakulti Sains', 'FS', '', '', 'Coursework']
];

const spreadsheet = new FakeSpreadsheet({
  'Programme': new FakeSheet('Programme', programmeRows)
});

let currentUser = {email: 'admin@unisza.edu.my', role: 'Admin', faculty: '', capabilities: {graduateSchoolAdmin: true}};
let lockBusy = false;
let lockAttempts = 0;
let lockDepth = 0;
const sleepDelays = [];
const diagnostics = [];

const context = {
  console: {error: message => diagnostics.push(String(message)), log: () => {}},
  getSpreadsheet: () => spreadsheet,
  getCurrentUser_: () => currentUser,
  getActiveAccessGrant_: () => null,
  LockService: {
    getScriptLock: () => ({
      tryLock: () => { lockAttempts++; if (lockBusy) return false; lockDepth++; return true; },
      releaseLock: () => { lockDepth--; }
    })
  },
  Utilities: {sleep: delay => sleepDelays.push(delay), getUuid: () => 'TEST-UUID'},
  Session: {getActiveUser: () => ({getEmail: () => ''})},
  CONFIG: {SHEET_ID: ''},
  SpreadsheetApp: {openById: () => spreadsheet, getActiveSpreadsheet: () => spreadsheet}
};
vm.runInNewContext(gasSources, context);
context.getCurrentUser_ = () => currentUser;
context.getSpreadsheet = () => spreadsheet;

function byMqa(code) {
  return context.getProgrammes_(null).filter(function(programme) { return programme.mqaCode === code; })[0];
}

const doctorateEnglish = byMqa('MQA/FA00123');
const phdParenthesized = byMqa('MQA/FA00124');
const phdDotted = byMqa('MQA/FA00125');
const doctorateMalayOnly = byMqa('MQA/FA00126');
const mastersMalayOnly = byMqa('MQA/FA00127');
const mastersEnglish = byMqa('MQA/FA00128');
const bachelor = byMqa('MQA/FA00129');

assert.strictEqual(doctorateEnglish.level, 'Doctorate', 'Doctor of Philosophy must detect as Doctorate');
assert.strictEqual(phdParenthesized.level, 'Doctorate', 'PhD (...) must detect as Doctorate');
assert.strictEqual(phdDotted.level, 'Doctorate', 'Ph.D. (...) must detect as Doctorate');
assert.strictEqual(doctorateMalayOnly.level, 'Doctorate', 'Malay-only Doktor Falsafah must detect as Doctorate');
assert.strictEqual(mastersMalayOnly.level, 'Masters', 'Malay-only Sarjana must detect as Masters');
assert.strictEqual(mastersEnglish.level, 'Masters', 'Master of Science must detect as Masters');
assert.strictEqual(bachelor.level, 'Other', 'Bachelor programmes must not be classified as postgraduate');

const PHD_SET = ['THESIS_PHD', 'VIVA_PHD', 'PROGRESS_PHD'];
const MASTER_SET = ['THESIS_MASTER', 'VIVA_MASTER', 'PROGRESS_MASTER'];

function assertMapping(code, expectedCodes) {
  const api = context.getAssessmentWorkspaceApi(code);
  assert.strictEqual(api.ok, true, code + ' workspace must resolve');
  assert.strictEqual(api.endpoints.mapping.ok, true, code + ' mapping envelope must succeed');
  assert.strictEqual(api.endpoints.review.ok, true, code + ' review envelope must succeed');
  const instruments = Array.from(api.endpoints.mapping.data.map(function(instrument) { return String(instrument.code); }));
  assert.deepStrictEqual(instruments, expectedCodes, code + ' must project exactly the expected instruments');
  api.endpoints.mapping.data.forEach(function(instrument) {
    assert.strictEqual(instrument.totals.matches, true, code + ' ' + instrument.code + ' total mismatch');
  });
}

[doctorateEnglish, phdParenthesized, phdDotted, doctorateMalayOnly].forEach(function(programme) {
  assertMapping(programme.programmeId, PHD_SET);
});
[mastersMalayOnly, mastersEnglish].forEach(function(programme) {
  assertMapping(programme.programmeId, MASTER_SET);
});
assert.throws(function() { context.getAssessmentWorkspaceApi(bachelor.programmeId); }, function(error) {
  return error.code === 'RESEARCH_FORBIDDEN' && error.retryable === false;
}, 'Bachelor coursework programmes must be refused by the research workspace');

const lockedOut = context.getAssessmentWorkspaceApi(doctorateEnglish.programmeId);
assert.strictEqual(lockedOut.endpoints.mapping.data[0].items.length > 0, true, 'Doctorate thesis items must project');
assert(lockedOut.endpoints.mapping.data[0].categories.length === 4, 'Doctorate thesis must keep its four categories');
assert(lockedOut.endpoints.mapping.data.some(function(instrument) { return instrument.code === 'VIVA_PHD'; }), 'Viva PhD must be present');
assert(lockedOut.endpoints.mapping.data.some(function(instrument) { return instrument.code === 'PROGRESS_PHD'; }), 'Progress PhD must be present');

const warmBefore = JSON.stringify(spreadsheet.sheets);
assert.strictEqual(context.getAssessmentWorkspaceApi(doctorateEnglish.programmeId).ok, true, 'Warm assessment reads must succeed without acquiring the lock');
assert.strictEqual(lockAttempts, 1, 'Only the cold-start assessment setup should take the script lock');
assert.strictEqual(JSON.stringify(spreadsheet.sheets), warmBefore, 'Warm assessment reads must stay pure and lock-free');

const coldSpreadsheet = new FakeSpreadsheet({'Programme': new FakeSheet('Programme', programmeRows)});
const originalGetSpreadsheet = context.getSpreadsheet;
context.getSpreadsheet = () => coldSpreadsheet;
lockBusy = true;
lockAttempts = 0;
assert.throws(function() { context.getAssessmentWorkspaceApi(doctorateEnglish.programmeId); }, function(error) { return error.code === 'RESEARCH_LOCK_BUSY' && error.retryable === true; });
assert.strictEqual(lockAttempts, 4, 'Doctorate cold-start setup must respect the bounded lock policy');
lockBusy = false;
context.getSpreadsheet = originalGetSpreadsheet;

assert(diagnostics.every(function(entry) { return !/internal|schema/i.test(entry); }), 'Server diagnostics must stay safe');

console.log('Doctorate assessment instrument loading tests passed.');
