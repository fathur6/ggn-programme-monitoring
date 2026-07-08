/** PEOService.gs — PEO data retrieval and save operations */

function getPEOs(mqaCode) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  var data = sheet.getRange('A1:AF').getValues();
  var peos = [];
  var inSectionA = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[0].toString().toUpperCase().indexOf('PEO') === 0) {
      if (!inSectionA) { inSectionA = true; continue; }
    }
    if (inSectionA && row[0] && row[0].toString().toUpperCase().indexOf('PLO') === 0) {
      break;
    }
    if (!inSectionA || !row[0]) continue;

    peos.push({
      code: row[0],
      description: row[1],
      domain: row[2],
      tf: [row[3], row[4], row[5], row[6]],
      sdg: row.slice(7, 24),
      sc: row.slice(24, 32)
    });
  }
  return peos;
}

function savePEOs(mqaCode, peos) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(mqaCode);
    if (!sheet) throw new Error('Program tidak dijumpai: ' + mqaCode);

    var data = sheet.getDataRange().getValues();
    var startRow = -1, endRow = -1;
    for (var i = 0; i < data.length; i++) {
      var code = (data[i][0] || '').toString().toUpperCase();
      if (code.indexOf('PEO') === 0 && startRow === -1) startRow = i + 1;
      if (code.indexOf('PLO') === 0 && startRow > -1) { endRow = i; break; }
    }
    if (startRow === -1) throw new Error('Section A tidak dijumpai');
    if (endRow === -1) endRow = data.length + 1;

    if (endRow > startRow) {
      sheet.getRange(startRow, 1, endRow - startRow, 32).clearContent();
    }

    if (peos.length > 0) {
      var rows = peos.map(function(p) {
        return [p.code, p.description, p.domain]
          .concat(p.tf)
          .concat(p.sdg)
          .concat(p.sc.slice(0, 8));
      });
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    }
    return peos;
  } finally {
    lock.releaseLock();
  }
}
