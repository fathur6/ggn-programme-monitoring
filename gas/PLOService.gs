/** PLOService.gs — PLO data retrieval and save operations */

function getPLOs(mqaCode) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var plos = [];
  var inSectionB = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[0].toString().toUpperCase().indexOf('PLO') === 0) {
      if (!inSectionB) { inSectionB = true; continue; }
    }
    if (!inSectionB || !row[0]) continue;

    plos.push({
      code: row[0],
      description: row[1],
      embeddedPEO: row[2],
      mqfDomains: row.slice(3, 14),
      mapping: row.slice(14)
    });
  }
  return plos;
}

function savePLOs(mqaCode, plos) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(mqaCode);
    if (!sheet) throw new Error('Program tidak dijumpai');

    var data = sheet.getDataRange().getValues();
    var startRow = -1;
    for (var i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().toUpperCase().indexOf('PLO') === 0) {
        if (startRow === -1) startRow = i + 1;
      }
    }
    if (startRow === -1) throw new Error('Section B tidak dijumpai');

    var lastRow = sheet.getLastRow();
    if (lastRow >= startRow) {
      sheet.getRange(startRow, 1, lastRow - startRow + 1, 25).clearContent();
    }

    if (plos.length > 0) {
      var rows = plos.map(function(p) {
        return [p.code, p.description, p.embeddedPEO]
          .concat(p.mqfDomains.slice(0, 11))
          .concat(p.mapping || []);
      });
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    }
    return plos;
  } finally {
    lock.releaseLock();
  }
}
