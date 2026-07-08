/** UploadService.gs — File upload, delete requests, and admin approval with LockService */

function getUploadedFiles(mqaCode) {
  var folder = getProgramFolder(mqaCode);
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

function uploadFile(mqaCode, fileType, fileBlob) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    if (!fileBlob) throw new Error('Sila pilih fail.');
    if (fileBlob.getContentType() !== 'application/pdf') throw new Error('Hanya format PDF dibenarkan.');

    var now = new Date();
    var dd = ('0' + now.getDate()).slice(-2);
    var MM = ('0' + (now.getMonth() + 1)).slice(-2);
    var yy = now.getFullYear();
    var dateStr = dd + MM + yy;
    var fileName = mqaCode + '-' + fileType + '-' + dateStr + '.pdf';

    var folder = getProgramFolder(mqaCode);
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) throw new Error('Fail dengan nama yang sama sudah wujud.');

    var file = folder.createFile(fileBlob);
    file.setName(fileName);
    return { id: file.getId(), name: fileName, url: file.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function suggestDeleteFile(fileId, mqaCode) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName('PendingDeletions');
    if (!sheet) {
      sheet = ss.insertSheet('PendingDeletions');
      sheet.appendRow(['FileID', 'FileName', 'Programme', 'RequestedBy', 'RequestedDate', 'Status']);
    }
    var file = DriveApp.getFileById(fileId);
    var user = getCurrentUser();
    sheet.appendRow([fileId, file.getName(), mqaCode, user.email, new Date(), 'Pending']);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function approveDeleteFile(fileId) {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Hanya Admin boleh meluluskan.');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName('PendingDeletions');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === fileId) {
          sheet.getRange(i + 1, 6).setValue('Approved');
          break;
        }
      }
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
