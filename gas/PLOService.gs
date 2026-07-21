/** PLOService.gs — PLO data retrieval and save operations */

function getPLOs_(mqaCode) {
  requireResearchProgrammeAccess_(mqaCode, 'view-plos');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var plos = [];
  var inSectionB = false;
  var hasPLOHeader = false;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().toUpperCase().trim() === 'PLO') {
      hasPLOHeader = true;
      break;
    }
  }

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var code = (row[0] || '').toString().toUpperCase().trim();

    if (hasPLOHeader) {
      if (code === 'PLO') { inSectionB = true; continue; }
      if (!inSectionB || !code) continue;
    } else {
      if (code.indexOf('PLO') === 0) {
        if (!inSectionB) { inSectionB = true; }
      }
      if (!inSectionB || !code) continue;
    }

    plos.push({
      code: row[0],
      description: row[1],
      mqfDomain: row[2] || '',
      embeddedPEO: row[3] || '',
      taxonomy: row[4] || ''
    });
  }
  return plos;
}

function savePLOs_(mqaCode, plos) {
  requireResearchProgrammeAccess_(mqaCode, 'edit-plos');
  if (!mqaCode || !Array.isArray(plos)) throw new Error('Data PLO tidak sah.');
  plos = plos.map(function(p) {
    var code = String(p && p.code || '').trim();
    var description = String(p && p.description || '').trim();
    if (!code || !description) throw new Error('Kod dan penerangan PLO diperlukan.');
    return {
      code: code,
      description: description,
      mqfDomain: String(p.mqfDomain || '').trim(),
      embeddedPEO: String(p.embeddedPEO || '').trim(),
      taxonomy: String(p.taxonomy || '').trim()
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
    if (!sheet) throw new Error('Program tidak dijumpai');

    var data = sheet.getDataRange().getValues();
    var headerRow = -1;
    for (var i = 0; i < data.length; i++) {
      var code = (data[i][0] || '').toString().toUpperCase().trim();
      if (code === 'PLO' && headerRow === -1) headerRow = i;
    }
    if (headerRow === -1) throw new Error('Section B tidak dijumpai');

    var lastRow = sheet.getLastRow();
    var dataStart = headerRow + 1;

    // Insert rows if needed
    var existing = lastRow - dataStart;
    if (plos.length > existing) {
      sheet.insertRows(dataStart + 1, plos.length - existing);
    }

    // Clear existing PLO data
    if (lastRow >= dataStart) {
      sheet.getRange(dataStart + 1, 1, lastRow - dataStart + 1, 5).clearContent();
    }

    if (plos.length > 0) {
      var rows = plos.map(function(p) {
        return [p.code, p.description, p.mqfDomain || '', p.embeddedPEO || '', p.taxonomy || ''];
      });
      sheet.getRange(dataStart + 1, 1, rows.length, 5).setValues(rows);
    }
    return plos;
  } finally {
    lock.releaseLock();
  }
}

function getNextPLOCode_(plos) {
  var highest = 0;
  (plos || []).forEach(function(p) {
    var match = String(p && p.code || '').toUpperCase().match(/^PLO\s*(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return 'PLO' + (highest + 1);
}
