/** SuggestionsService.gs — Add/Remove programme suggestion + approval + pending deletions panel */

function ensureSuggestionsSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingSuggestions');
  if (!sheet) {
    sheet = ss.insertSheet('PendingSuggestions');
    sheet.appendRow(['Type','Data','ProgrammeCode','Faculty','RequestedBy','RequestedDate','Status','Reason']);
  }
  return sheet;
}

function suggestAddProgramme(programmeData) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = ensureSuggestionsSheet();
    sheet.appendRow(['Add', JSON.stringify(programmeData), programmeData.mqaCode, user.faculty, user.email, new Date(), 'Pending', '']);
    return { success: true };
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  } finally {
    lock.releaseLock();
  }
}

function suggestRemoveProgramme(mqaCode) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = ensureSuggestionsSheet();
    sheet.appendRow(['Remove', mqaCode, mqaCode, user.faculty, user.email, new Date(), 'Pending', '']);
    return { success: true };
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  } finally {
    lock.releaseLock();
  }
}

function getPendingSuggestions() {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingSuggestions');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][6] !== 'Pending') continue;
    result.push({
      type: data[i][0],
      data: data[i][1],
      programmeCode: data[i][2],
      faculty: data[i][3],
      requestedBy: data[i][4],
      requestedDate: data[i][5],
      status: data[i][6],
      reason: data[i][7]
    });
  }
  return result;
}

function findPendingRow(data, rowIndex) {
  var count = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][6] === 'Pending') {
      count++;
      if (count === rowIndex) return i;
    }
  }
  return -1;
}

function approveSuggestion(rowIndex) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('PendingSuggestions');
    if (!sheet) throw new Error('Sheet tidak dijumpai');
    var data = sheet.getDataRange().getValues();
    var foundRow = findPendingRow(data, rowIndex);
    if (foundRow === -1) throw new Error('Cadangan tidak dijumpai');
    var row = data[foundRow];
    var rowData = [row[0], row[1], row[2], row[3], row[4], row[5], 'Approved', row[7]];
    sheet.getRange(foundRow + 1, 1, 1, 8).setValues([rowData]);
    if (row[0] === 'Add') {
      var progData = JSON.parse(row[1]);
      var programmeSheet = ss.getSheetByName('Programme');
      programmeSheet.appendRow([progData.name, progData.mqaCode, progData.nec, progData.progCode, progData.accr, '', '', '', '', '', progData.mode, '', progData.faculty]);
    } else if (row[0] === 'Remove') {
      var mqaCode = row[1];
      var programmeSheet = ss.getSheetByName('Programme');
      var pData = programmeSheet.getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        if (pData[i][1] === mqaCode) {
          programmeSheet.deleteRow(i + 1);
          break;
        }
      }
      var tab = ss.getSheetByName(mqaCode);
      if (tab) ss.deleteSheet(tab);
    }
    return { success: true };
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  } finally {
    lock.releaseLock();
  }
}

function rejectSuggestion(rowIndex, note) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('PendingSuggestions');
    if (!sheet) throw new Error('Sheet tidak dijumpai');
    var data = sheet.getDataRange().getValues();
    var foundRow = findPendingRow(data, rowIndex);
    if (foundRow === -1) throw new Error('Cadangan tidak dijumpai');
    var row = data[foundRow];
    var rowData = [row[0], row[1], row[2], row[3], row[4], row[5], 'Rejected', note || ''];
    sheet.getRange(foundRow + 1, 1, 1, 8).setValues([rowData]);
    return { success: true };
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  } finally {
    lock.releaseLock();
  }
}

function getPendingDeletions() {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingDeletions');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    result.push({
      fileId: data[i][0],
      fileName: data[i][1],
      programme: data[i][2],
      requestedBy: data[i][3],
      requestedDate: data[i][4],
      status: data[i][5]
    });
  }
  return result;
}
