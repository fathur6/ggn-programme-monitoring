/** PEOService.gs — PEO data retrieval and save operations */

function getPEOs(mqaCode) {
  requireResearchProgrammeAccess_(mqaCode, 'view-peos');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var peos = [];
  var inSectionA = false;
  var hasPEOHeader = false;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().toUpperCase().trim() === 'PEO') {
      hasPEOHeader = true;
      break;
    }
  }

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var code = (row[0] || '').toString().toUpperCase().trim();

    if (hasPEOHeader) {
      if (code === 'PEO') { inSectionA = true; continue; }
      if (inSectionA && code === 'PLO') break;
      if (!inSectionA || !code) continue;
    } else {
      if (code.indexOf('PEO') === 0) {
        if (!inSectionA) { inSectionA = true; }
      }
      if (!inSectionA || !code) continue;
    }

    peos.push({
      code: row[0],
      description: row[1],
      mqfDomain: row[2] || ''
    });
  }
  return peos;
}

function savePEOs(mqaCode, peos) {
  requireResearchProgrammeAccess_(mqaCode, 'edit-peos');
  if (!mqaCode || !Array.isArray(peos)) throw new Error('Data PEO tidak sah.');
  peos = peos.map(function(p) {
    var code = String(p && p.code || '').trim();
    var description = String(p && p.description || '').trim();
    if (!code || !description) throw new Error('Kod dan penerangan PEO diperlukan.');
    return {
      code: code,
      description: description,
      mqfDomain: String(p.mqfDomain || '').trim()
    };
  });
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(mqaCode);
    if (!sheet) throw new Error('Program tidak dijumpai: ' + mqaCode);

    var data = sheet.getDataRange().getValues();
    var headerRow = -1, endRow = -1;
    for (var i = 0; i < data.length; i++) {
      var code = (data[i][0] || '').toString().toUpperCase().trim();
      if (code === 'PEO') headerRow = i;
      if (code === 'PLO' && headerRow > -1) { endRow = i; break; }
    }
    if (headerRow === -1) throw new Error('Section A tidak dijumpai');
    if (endRow === -1) endRow = data.length;

    var dataStart = headerRow + 1; // first row after PEO header (0-indexed)
    var dataEnd = endRow;          // PLO row (0-indexed)
    var available = dataEnd - dataStart;

    // Insert rows if more PEO entries than available space
    if (peos.length > available) {
      sheet.insertRows(dataStart + 1, peos.length - available);
    }

    // Clear existing data between PEO and PLO
    if (dataEnd > dataStart) {
      sheet.getRange(dataStart + 1, 1, dataEnd - dataStart, 3).clearContent();
    }

    if (peos.length > 0) {
      var rows = peos.map(function(p) {
        return [p.code, p.description, p.mqfDomain || ''];
      });
      sheet.getRange(dataStart + 1, 1, rows.length, 3).setValues(rows);
    }
    return peos;
  } finally {
    lock.releaseLock();
  }
}
