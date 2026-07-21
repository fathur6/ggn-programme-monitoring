/** AccessRequestService.gs - temporary cross-faculty detail access */

var ACCESS_REQUEST_HEADERS = [
  'RequestId', 'RequesterEmail', 'RequesterFaculty', 'TargetFaculty', 'MQACode',
  'Reason', 'Scope', 'RequestedAt', 'Status', 'ApproverEmail', 'ApprovedAt',
  'ExpiresAt', 'RevokedAt', 'DecisionNote'
];

function ensureAccessRequestsSheet_() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('AccessRequests');
  if (!sheet) {
    sheet = ss.insertSheet('AccessRequests');
    sheet.appendRow(ACCESS_REQUEST_HEADERS);
  }
  return sheet;
}

function createAccessRequestApi_(request) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (isGraduateSchoolAdmin_(user)) throw new Error('Graduate School administrators already have access');

  var targetFaculty = String(request.targetFaculty || '').trim();
  var mqaCode = String(request.mqaCode || '').trim();
  var reason = String(request.reason || '').trim();
  if (!mqaCode) throw new Error('A research programme is required');
  if (!reason) throw new Error('A reason is required');
  if (targetFaculty && targetFaculty === String(user.faculty || '').trim()) {
    throw new Error('You already have access to this faculty');
  }
  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme) throw new Error('Programme not found');
  if (!isResearchProgramme_(programme)) throw new Error('Only postgraduate research programmes are eligible');
  if (programme.faculty === String(user.faculty || '').trim()) {
    throw new Error('You already have access to this programme');
  }
  if (!targetFaculty) targetFaculty = programme.faculty;

  var sheet = ensureAccessRequestsSheet_();
  var id = 'ACCESS-' + Utilities.getUuid();
  sheet.appendRow([
    id, user.email, user.faculty || '', targetFaculty, mqaCode, reason,
    request.scope || (mqaCode ? 'programme' : 'faculty'), new Date(), 'Pending',
    '', '', '', '', ''
  ]);
  return { requestId: id, status: 'Pending' };
}

function getAccessRequestsApi_(filters) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  var sheet = ensureAccessRequestsSheet_();
  var data = sheet.getDataRange().getValues();
  var requestedStatus = filters && filters.status;
  return data.slice(1).filter(function(row) {
    if (!row[0]) return false;
    if (!isGraduateSchoolAdmin_(user) && String(row[1]) !== String(user.email)) return false;
    var programme = findProgrammeByMqaCode_(row[4]);
    if (!programme || !isResearchProgramme_(programme)) return false;
    if (requestedStatus && String(row[8]) !== String(requestedStatus)) return false;
    return true;
  }).map(function(row) {
    var item = {
      requestId: row[0], requesterEmail: row[1], requesterFaculty: row[2],
      targetFaculty: row[3], mqaCode: row[4], reason: row[5], scope: row[6],
      requestedAt: row[7], status: row[8], approvedAt: row[10], expiresAt: row[11],
      revokedAt: row[12]
    };
    if (isGraduateSchoolAdmin_(user)) {
      item.approverEmail = row[9];
      item.decisionNote = row[13];
    }
    return item;
  });
}

function decideAccessRequestApi_(requestId, decision, note) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  if (['Approved', 'Rejected'].indexOf(String(decision)) === -1) {
    throw new Error('Invalid access request decision');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = ensureAccessRequestsSheet_();
    var data = sheet.getDataRange().getValues();
    var rowNumber = findAccessRequestRow_(data, requestId);
    if (rowNumber === -1) throw new Error('Access request not found');
    if (String(data[rowNumber][8]) !== 'Pending') throw new Error('Access request is no longer pending');

    var now = new Date();
    var expiry = '';
    if (decision === 'Approved') expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    sheet.getRange(rowNumber + 1, 9, 1, 6).setValues([[
      decision, user.email, decision === 'Approved' ? now : '',
      expiry, '', note || ''
    ]]);
    return { requestId: requestId, status: decision, expiresAt: expiry || null };
  } finally {
    lock.releaseLock();
  }
}

function revokeAccessGrantApi_(requestId, note) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var sheet = ensureAccessRequestsSheet_();
  var data = sheet.getDataRange().getValues();
  var rowNumber = findAccessRequestRow_(data, requestId);
  if (rowNumber === -1) throw new Error('Access request not found');
  if (String(data[rowNumber][8]) !== 'Approved') throw new Error('Only approved access can be revoked');
  sheet.getRange(rowNumber + 1, 9).setValue('Revoked');
  sheet.getRange(rowNumber + 1, 13).setValue(new Date());
  sheet.getRange(rowNumber + 1, 14).setValue(note || 'Revoked by administrator');
  return { requestId: requestId, status: 'Revoked' };
}

function getActiveAccessGrant_(email, mqaCode) {
  var sheet = ensureAccessRequestsSheet_();
  var data = sheet.getDataRange().getValues();
  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme || !isResearchProgramme_(programme)) return null;
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (String(row[1]) !== String(email) || String(row[8]) !== 'Approved') continue;
    if (row[12]) continue;
    if (!row[11] || new Date(row[11]).getTime() <= Date.now()) continue;
    if (row[4] && String(row[4]) !== String(mqaCode)) continue;
    if (row[3] && String(row[3]) !== String(programme.faculty)) continue;
    return { email: row[1], mqaCode: row[4] || '', targetFaculty: row[3] || '', expiresAt: row[11] };
  }
  return null;
}

function findAccessRequestRow_(data, requestId) {
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(requestId)) return i;
  }
  return -1;
}
