const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeSheet(rows) {
  return {
    rows: rows,
    appendRow: function(row) { this.rows.push(row.slice()); },
    getDataRange: function() { return { getValues: () => this.rows.map(row => row.slice()) }; },
    getRange: function(row, column, numRows, numColumns) {
      return { setValues: values => {
        for (let i = 0; i < numRows; i++) {
          for (let j = 0; j < numColumns; j++) this.rows[row - 1 + i][column - 1 + j] = values[i][j];
        }
      }, setValue: value => { this.rows[row - 1][column - 1] = value; } };
    }
  };
}

const accessHeaders = [
  'RequestId', 'RequesterEmail', 'RequesterFaculty', 'TargetFaculty', 'MQACode',
  'Reason', 'Scope', 'RequestedAt', 'Status', 'ApproverEmail', 'ApprovedAt',
  'ExpiresAt', 'RevokedAt', 'DecisionNote'
];
const sheet = makeSheet([accessHeaders]);
let currentUser = { email: 'admin@example.com', faculty: 'Faculty A', role: 'Admin', capabilities: { graduateSchoolAdmin: true } };
const programmes = {
  'MQA/RESEARCH': { faculty: 'Faculty B', mode: 'Research' },
  'MQA/LEGACY': { faculty: 'Faculty B', mode: 'Coursework' }
};
const context = {
  getCurrentUser: () => currentUser,
  isGraduateSchoolAdmin_: user => !!user && user.role === 'Admin',
  isResearchProgramme_: programme => !!programme && ['research', 'postgraduate by research'].includes(String(programme.mode || '').toLowerCase()),
  findProgrammeByMqaCode_: code => programmes[String(code || '').trim()] || null,
  getSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }),
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Utilities: { getUuid: () => 'TEST-ID' }
};
vm.runInNewContext(fs.readFileSync('gas/AccessRequestService.gs', 'utf8'), context);

currentUser = { email: 'faculty@example.com', faculty: 'Faculty A', role: 'Faculty PIC', capabilities: { graduateSchoolAdmin: false } };
assert.throws(() => context.createAccessRequestApi_({
  targetFaculty: 'Faculty A', mqaCode: 'MQA/RESEARCH', reason: 'Mismatch'
}), /target faculty does not match/i);

const created = context.createAccessRequestApi_({
  targetFaculty: 'Faculty B', mqaCode: 'MQA/RESEARCH', reason: 'Valid request'
});
assert.strictEqual(created.status, 'Pending');
assert.strictEqual(sheet.rows[1][3], 'Faculty B', 'Stored target faculty must be authoritative');

currentUser = { email: 'admin@example.com', faculty: 'Faculty A', role: 'Admin', capabilities: { graduateSchoolAdmin: true } };
sheet.rows.push(['STALE', 'faculty@example.com', 'Faculty A', 'Faculty B', 'MQA/LEGACY', 'Old', 'programme', new Date(), 'Pending', '', '', '', '', '']);
assert.throws(() => context.decideAccessRequestApi_('STALE', 'Approved', ''), /invalid research programme/i);
assert.strictEqual(sheet.rows[2][8], 'Pending', 'Stale decision must not change state');
assert.throws(() => context.revokeAccessGrantApi_('STALE', ''), /invalid research programme/i);
assert.strictEqual(sheet.rows[2][8], 'Pending', 'Stale revocation must not change state');

console.log('Task 7 boundary regression tests passed.');
