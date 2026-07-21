/** UploadService.gs — File upload, delete requests, and admin approval with LockService */

function getUploadedFiles_(mqaCode) {
  requireResearchProgrammeAccess_(mqaCode, 'view-documents');
  if (!mqaCode) throw new Error('Program tidak dijumpai.');
  var folder = getProgramFolder_(mqaCode);
  var files = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var f = files.next();
    result.push({
      id: f.getId(),
      name: f.getName(),
      url: f.getUrl(),
      size: f.getSize(),
      date: f.getDateCreated().toISOString().split('T')[0]
    });
  }
  return result.sort(function(a, b) { return b.date.localeCompare(a.date); });
}

var DELETION_HEADERS = [
  'RequestId', 'FileID', 'FileName', 'Programme', 'RequestedBy',
  'RequestedDate', 'Status', 'ApproverEmail', 'ApprovedDate', 'DecisionNote'
];

function getDeletionSheet_() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingDeletions');
  if (!sheet) {
    sheet = ss.insertSheet('PendingDeletions');
    sheet.appendRow(DELETION_HEADERS);
    return getDeletionSheetReadOnly_();
  }

  var deletion = getDeletionSheetReadOnly_();
  if (!deletion) throw new Error('Skema permohonan pemadaman tidak sah.');
  return deletion;
}

function getDeletionSheetReadOnly_() {
  var sheet = getSpreadsheet().getSheetByName('PendingDeletions');
  if (!sheet) return null;
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (DELETION_HEADERS.some(function(header) { return headers.indexOf(header) === -1; })) return null;
  var columns = {};
  headers.forEach(function(header, index) { columns[header] = index; });
  return { sheet: sheet, columns: columns };
}

function findProgramFolder_(mqaCode) {
  var root = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var folders = root.getFoldersByName(String(mqaCode || '').trim());
  return folders.hasNext() ? folders.next() : null;
}

function fileBelongsToFolder_(file, folder) {
  if (!file || !folder) return false;
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return true;
  }
  return false;
}

function uploadFile_(mqaCode, fileType, fileBlob) {
  requireResearchProgrammeAccess_(mqaCode, 'upload-document');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    if (!mqaCode || !fileType) throw new Error('Maklumat fail tidak lengkap.');
    if (!fileBlob) throw new Error('Sila pilih fail.');
    if (fileBlob.getContentType() !== 'application/pdf') throw new Error('Hanya format PDF dibenarkan.');

    var now = new Date();
    var dd = ('0' + now.getDate()).slice(-2);
    var MM = ('0' + (now.getMonth() + 1)).slice(-2);
    var yy = now.getFullYear();
    var dateStr = dd + MM + yy;
    var fileName = mqaCode + '-' + fileType + '-' + dateStr + '.pdf';

    var folder = getProgramFolder_(mqaCode);
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) throw new Error('Fail dengan nama yang sama sudah wujud.');

    var file = folder.createFile(fileBlob);
    file.setName(fileName);
    return { id: file.getId(), name: fileName, url: file.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function suggestDeleteFile_(fileId, mqaCode) {
  var access = requireResearchProgrammeAccess_(mqaCode, 'request-document-deletion');
  if (!fileId || !mqaCode) throw new Error('Maklumat fail tidak lengkap.');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var file = DriveApp.getFileById(fileId);
    var folder = findProgramFolder_(mqaCode);
    if (!fileBelongsToFolder_(file, folder)) throw new Error('Fail tidak sepadan dengan program.');

    var deletion = getDeletionSheet_();
    var data = deletion.sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][deletion.columns.FileID]) === String(fileId) &&
          String(data[i][deletion.columns.Programme]) === String(mqaCode) &&
          String(data[i][deletion.columns.Status]) === 'Pending') {
        throw new Error('Permohonan Pending untuk fail ini sudah wujud.');
      }
    }

    var requestId = 'DEL-' + Utilities.getUuid();
    var row = [];
    row[deletion.columns.RequestId] = requestId;
    row[deletion.columns.FileID] = fileId;
    row[deletion.columns.FileName] = file.getName();
    row[deletion.columns.Programme] = mqaCode;
    row[deletion.columns.RequestedBy] = access.user.email;
    row[deletion.columns.RequestedDate] = new Date();
    row[deletion.columns.Status] = 'Pending';
    row[deletion.columns.ApproverEmail] = '';
    row[deletion.columns.ApprovedDate] = '';
    row[deletion.columns.DecisionNote] = '';
    deletion.sheet.appendRow(row);
    return { success: true, requestId: requestId };
  } finally {
    lock.releaseLock();
  }
}

function approveDeleteFile_(requestId) {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  if (!requestId) throw new Error('Request ID diperlukan.');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var deletion = getDeletionSheetReadOnly_();
    if (!deletion) throw new Error('Skema permohonan pemadaman tidak sah.');
    var data = deletion.sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][deletion.columns.RequestId]) === String(requestId)) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Permohonan pemadaman tidak dijumpai.');
    var row = data[rowIndex];
    if (String(row[deletion.columns.Status]) !== 'Pending') throw new Error('Permohonan telah diproses.');

    var fileId = row[deletion.columns.FileID];
    var mqaCode = String(row[deletion.columns.Programme] || '').trim();
    var programme = findProgrammeByMqaCode_(mqaCode);
    if (!programme || !isResearchProgramme_(programme)) {
      throw new Error('Permohonan pemadaman bukan untuk program penyelidikan yang sah.');
    }
    var file = DriveApp.getFileById(fileId);
    var folder = findProgramFolder_(mqaCode);
    if (!fileBelongsToFolder_(file, folder)) throw new Error('Fail tidak sepadan dengan program.');
    file.setTrashed(true);
    deletion.sheet.getRange(rowIndex + 1, deletion.columns.Status + 1).setValue('Approved');
    deletion.sheet.getRange(rowIndex + 1, deletion.columns.ApproverEmail + 1).setValue(user.email);
    deletion.sheet.getRange(rowIndex + 1, deletion.columns.ApprovedDate + 1).setValue(new Date());
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
