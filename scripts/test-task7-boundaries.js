const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeSheet(rows) {
  return {
    rows: rows,
    appendRow: function(row) { this.rows.push(row.slice()); },
    getDataRange: function() { return { getValues: () => this.rows.map(row => row.slice()) }; },
    getRange: function(row, column, numRows, numColumns) {
      return { getValues: () => this.rows.slice(row - 1, row - 1 + numRows).map(values => values.slice(column - 1, column - 1 + numColumns)), setValues: values => {
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

const futureExpiry = new Date(Date.now() + 60 * 60 * 1000);
sheet.rows.push(['LEGACY-FACULTY', 'faculty@example.com', 'Faculty A', 'Faculty B', '', 'Legacy faculty grant', 'faculty', new Date(), 'Approved', 'admin@example.com', new Date(), futureExpiry, '', '']);
assert.strictEqual(
  context.getActiveAccessGrant_('faculty@example.com', 'MQA/RESEARCH'),
  null,
  'Legacy approved grants without an explicit MQA code must be rejected'
);
sheet.rows.push(['EXPLICIT-PROGRAMME', 'faculty@example.com', 'Faculty A', 'Faculty B', 'MQA/RESEARCH', 'Explicit programme grant', 'programme', new Date(), 'Approved', 'admin@example.com', new Date(), futureExpiry, '', '']);
const explicitGrant = context.getActiveAccessGrant_('faculty@example.com', 'MQA/RESEARCH');
assert.strictEqual(explicitGrant.mqaCode, 'MQA/RESEARCH', 'Explicit programme grants must remain active');
assert.strictEqual(explicitGrant.targetFaculty, 'Faculty B', 'Explicit grants must retain canonical faculty');

currentUser = { email: 'admin@example.com', faculty: 'Faculty A', role: 'Admin', capabilities: { graduateSchoolAdmin: true } };
sheet.rows.push(['STALE', 'faculty@example.com', 'Faculty A', 'Faculty B', 'MQA/LEGACY', 'Old', 'programme', new Date(), 'Pending', '', '', '', '', '']);
assert.throws(() => context.decideAccessRequestApi_('STALE', 'Approved', ''), /invalid research programme/i);
assert.strictEqual(sheet.rows[4][8], 'Pending', 'Stale decision must not change state');
assert.throws(() => context.revokeAccessGrantApi_('STALE', ''), /invalid research programme/i);
assert.strictEqual(sheet.rows[4][8], 'Pending', 'Stale revocation must not change state');

console.log('Task 7 boundary regression tests passed.');

const deletionHeaders = [
  'RequestId', 'FileID', 'FileName', 'Programme', 'RequestedBy',
  'RequestedDate', 'Status', 'ApproverEmail', 'ApprovedDate', 'DecisionNote'
];
let deletionDriveLookups = 0;
const deletionRows = [
  deletionHeaders,
  ['', 'legacy-file', 'legacy.pdf', 'MQA/RESEARCH', 'requester@example.com', new Date(), 'Pending', '', '', ''],
  ['DEL-RESEARCH', 'research-file', 'research.pdf', 'MQA/RESEARCH', 'requester@example.com', new Date(), 'Pending', '', '', ''],
  ['DEL-COURSE', 'course-file', 'course.pdf', 'MQA/LEGACY', 'requester@example.com', new Date(), 'Pending', '', '', ''],
  ['DEL-APPROVED', 'approved-file', 'approved.pdf', 'MQA/RESEARCH', 'requester@example.com', new Date(), 'Approved', '', new Date(), '']
];
const deletionSheet = makeSheet(deletionRows);
deletionSheet.getLastColumn = () => deletionHeaders.length;
deletionSheet.getLastRow = () => deletionSheet.rows.length;
const deletionContext = {
  getCurrentUser: () => ({ email: 'admin@example.com', role: 'Admin' }),
  isGraduateSchoolAdmin_: user => !!user && user.role === 'Admin',
  isResearchProgramme_: programme => !!programme && String(programme.mode).toLowerCase() === 'research',
  findProgrammeByMqaCode_: code => programmes[String(code || '').trim()] || null,
  getSpreadsheet: () => ({ getSheetByName: () => deletionSheet, insertSheet: () => { throw new Error('unexpected sheet creation'); } }),
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  DriveApp: { getFileById: () => { deletionDriveLookups++; throw new Error('Drive lookup should not occur'); } }
};
vm.runInNewContext(fs.readFileSync('gas/UploadService.gs', 'utf8'), deletionContext);
vm.runInNewContext(fs.readFileSync('gas/SuggestionsService.gs', 'utf8'), deletionContext);

const snapshotDeletionRows = () => deletionSheet.rows.map(row => row.map(value => value instanceof Date ? value.getTime() : value));
const beforeDeletionRead = snapshotDeletionRows();
const readOnlyDeletion = deletionContext.getDeletionSheetReadOnly_();
assert.deepStrictEqual(snapshotDeletionRows(), beforeDeletionRead, 'Deletion read must not mutate legacy rows');
assert.strictEqual(readOnlyDeletion.columns.RequestId, 0, 'Read-only deletion access must resolve existing headers');
const pendingDeletions = deletionContext.getPendingDeletions_();
assert.deepStrictEqual(Array.from(pendingDeletions, item => item.requestId), ['DEL-RESEARCH'], 'Deletion queue must include only identified research requests');
assert.deepStrictEqual(snapshotDeletionRows(), beforeDeletionRead, 'Queue listing must be side-effect free');

assert.throws(() => deletionContext.approveDeleteFile_('DEL-COURSE'), /penyelidikan|research programme/i);
assert.strictEqual(deletionDriveLookups, 0, 'Invalid deletion approval must reject before Drive access');
assert.strictEqual(deletionSheet.rows[3][6], 'Pending', 'Invalid deletion approval must not update the row');

const updatePicSource = fs.readFileSync('gas/update_pic.gs', 'utf8');
const dumpPicSource = fs.readFileSync('gas/dump_pic.gs', 'utf8');
assert(!/function\s+updatePICApi\s*\(/.test(updatePicSource), 'PIC update must not be directly exposed');
assert(/function\s+updatePICApi_\s*\(/.test(updatePicSource), 'PIC update private helper is missing');
assert(!/function\s+dumpPIC\s*\(/.test(dumpPicSource), 'PIC dump must not be directly exposed');
assert(/function\s+dumpPIC_\s*\(/.test(dumpPicSource), 'PIC dump private helper is missing');
