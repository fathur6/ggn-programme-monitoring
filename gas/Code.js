/**
 * GGN MQF 2.0 — Programme tab generator (container-bound to the Postgraduate
 * Programme workbook).
 *
 * Creates one tab per programme from the "Programme" sheet so faculty can
 * collect:
 *   - PEO records (code, statement, MQF Domain)
 *   - PLO records (code, statement, MQF Domain, Embedded PEO, Taxonomy,
 *     SDG, sustainability competency and transversal future skill)
 *
 * This is an admin setup utility and intentionally uses no LockService.
 * It is idempotent: tabs that already exist are skipped, not overwritten.
 * Run from the Apps Script editor: select createProgrammeTabs() and click Run.
 */

var PROGRAMME_TAB_SECTIONS = {
  PEO: {
    headerRow: 1,
    columns: ['PEO', 'Statement', 'MQF Domain'],
    emptyRows: 6
  },
  PLO: {
    headerRow: 9,
    columns: ['PLO', 'Statement', 'MQF Domain', 'Embedded PEO', 'Taxonomy', 'SDG', 'SC', 'TF'],
    emptyRows: 10
  }
};

var MQF_DOMAIN_CODES_ = ['MQF 1', 'MQF 2', 'MQF 3a', 'MQF 3b', 'MQF 3c', 'MQF 3d', 'MQF 3e', 'MQF 3f', 'MQF 4a', 'MQF 4b', 'MQF 5'];
var TAXONOMY_CODES_ = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'A1', 'A2', 'A3', 'A4', 'A5', 'P1', 'P2', 'P3', 'P4', 'P5'];
var SDG_CODES_ = ['SDG1', 'SDG2', 'SDG3', 'SDG4', 'SDG5', 'SDG6', 'SDG7', 'SDG8', 'SDG9', 'SDG10', 'SDG11', 'SDG12', 'SDG13', 'SDG14', 'SDG15', 'SDG16', 'SDG17'];
var SDG_ELIGIBLE_PLO_CODES_ = ['PLO1', 'PLO9', 'PLO11'];
var SDG_ELIGIBLE_PLO_CODES_BY_PROGRAMME_ = {
  'MQA/FA5573': ['PLO1', 'PLO9', 'PLO10'],
  'MQA/FA5574': ['PLO1', 'PLO9', 'PLO10']
};
var SC_CODES_ = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8'];
var SC_ELIGIBLE_PLO_CODES_ = ['PLO2', 'PLO4', 'PLO9', 'PLO11'];
var SC_ELIGIBLE_PLO_CODES_BY_PROGRAMME_ = {
  'MQA/FA5573': ['PLO2', 'PLO4', 'PLO9', 'PLO10'],
  'MQA/FA5574': ['PLO2', 'PLO4', 'PLO9', 'PLO10']
};
var SC_CODES_BY_MQF_DOMAIN_ = { MQF2: 'SC3', MQF3B: 'SC5', MQF4A: 'SC7', MQF5: 'SC8' };
var TF_CODES_BY_MQF_DOMAIN_ = {
  MQF1: ['TF1'], MQF2: ['TF2'], MQF3A: ['TF3'], MQF3B: ['TF3'],
  MQF3C: ['TF3'], MQF3D: ['TF2'], MQF3E: ['TF2'], MQF3F: ['TF3'],
  MQF4A: ['TF1'], MQF4B: ['TF4'], MQF5: ['TF4']
};
var MAX_PLO_COUNT_ = 11;
var PROGRAMME_SPREADSHEET_ID_ = '1w5xrwoLJ7HpSZ_emgwqoGr-YcRVb7Zuq3KuDSmhUf6o';
var PDF_FOLDER_ID_ = '1W6FeqkIyIj_rTi8IzrbM7DLb1qprAX57';
var USER_DIRECTORY_SPREADSHEET_ID_ = '1CZyEFe7VqEWp8V4UYnQ-6fQMATDF0X0JUN09XbWmfrQ';
var USER_DIRECTORY_SHEET_NAME_ = 'USER';
var ADMIN_DIRECTORY_SHEET_NAME_ = 'ADMIN';
var USER_SESSION_PREFIX_ = 'mqf-programme-session:';
var USER_SESSION_TTL_SECONDS_ = 21600;

function createProgrammeTabs() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) {
    throw new Error('Sheet "Programme" not found. Check the first tab name.');
  }

  var data = sheet.getDataRange().getValues();
  var columns = resolveProgrammeColumns_(sheet, data);
  if (columns.mqaCode < 0) {
    throw new Error('Could not find the MQA Code column in the "Programme" sheet.');
  }

  var created = [];
  var skipped = [];
  var errors = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mqaCode = String(row[columns.mqaCode] || '').trim();
    var name = String(row[columns.name] || '').trim();
    if (!mqaCode && !name) continue;

    var tabName = sanitizeSheetName_(mqaCode || name);
    if (!tabName) continue;

    if (ss.getSheetByName(tabName)) {
      skipped.push(tabName);
      continue;
    }

    try {
      var tab = ss.insertSheet(tabName);
      seedProgrammeTab_(tab);
      created.push(tabName);
    } catch (e) {
      errors.push(tabName + ': ' + e.message);
    }
  }

  var summary = {
    rowsProcessed: data.length - 1,
    created: created,
    createdCount: created.length,
    skipped: skipped,
    skippedCount: skipped.length,
    errors: errors,
    errorsCount: errors.length
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * Writes the PEO and PLO section markers + column headers. The marker rows
 * also serve as the header row, so the layout stays parse-compatible with the
 * PEO/PLO read helpers used elsewhere in this project.
 */
function seedProgrammeTab_(tab) {
  var peo = PROGRAMME_TAB_SECTIONS.PEO;
  var plo = PROGRAMME_TAB_SECTIONS.PLO;

  var peoHeader = tab.getRange(peo.headerRow, 1, 1, peo.columns.length);
  peoHeader.setValues([peo.columns]).setFontWeight('bold');

  var ploHeader = tab.getRange(plo.headerRow, 1, 1, plo.columns.length);
  ploHeader.setValues([plo.columns]).setFontWeight('bold');

  tab.setFrozenRows(1);
  tab.getRange(peo.headerRow, 1).setBackground('#e8f0fe');
  tab.getRange(plo.headerRow, 1).setBackground('#e8f0fe');
}

/**
 * Google Sheets tab names cannot contain : \ ? * [ ] and cannot start/end
 * with an apostrophe; they are also limited to 100 characters.
 */
function sanitizeSheetName_(raw) {
  var name = String(raw || '').trim().replace(/[:\\?*\[\]]/g, '-');
  while (name.charAt(0) === "'") name = name.slice(1);
  while (name.charAt(name.length - 1) === "'") name = name.slice(0, -1);
  name = name.slice(0, 100);
  return name.trim();
}

/**
 * Header-aware column lookup with a fixed fallback matching the existing
 * programme sheet convention: B = name, C = MQA Code.
 */
function resolveProgrammeColumns_(sheet, data) {
  var header = (data && data[0]) || [];
  var find = function (aliases) {
    for (var c = 0; c < header.length; c++) {
      var cell = String(header[c] || '').trim().toLowerCase();
      if (!cell) continue;
      for (var a = 0; a < aliases.length; a++) {
        if (cell === aliases[a].toLowerCase()) return c;
      }
    }
    return -1;
  };

  var columns = {
    mqaCode: find(['MQA Code', 'MQA Reference Code', 'MQACode', 'Reference Code', 'MQA Ref']),
    name: find(['Programme Name', 'Name', 'Program Name', 'Nama Program', 'Programme Name (English)', 'Program Name (English)'])
  };

  if (columns.mqaCode < 0) columns.mqaCode = 2;
  if (columns.name < 0) columns.name = 1;
  return columns;
}

/**
 * GGN MQF 2.0 — Web app server (container-bound to the Postgraduate Programme
 * workbook).
 *
 * Serves the programme directory (Index.html) and the programme detail API.
 * Read-only: list from the "Programme" sheet, PEO/PLO from each per-programme
 * tab. Intentionally no LockService on read paths.
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('MQF 2.0 — Programme Information')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function programmeSpreadsheet_() {
  return SpreadsheetApp.openById(PROGRAMME_SPREADSHEET_ID_);
}

function getLoginDirectoryApi() {
  var entries = userDirectoryEntries_();
  var usersByFaculty = {};
  entries.forEach(function(entry) {
    if (!usersByFaculty[entry.faculty]) usersByFaculty[entry.faculty] = [];
    var exists = usersByFaculty[entry.faculty].some(function(user) { return user.name === entry.name; });
    if (!exists) usersByFaculty[entry.faculty].push({ name: entry.name, position: entry.position });
  });
  var directory = Object.keys(usersByFaculty).sort().map(function(faculty) {
    return {
      faculty: faculty,
      users: usersByFaculty[faculty].sort(function(a, b) { return a.name.localeCompare(b.name); })
    };
  });
  var adminUsers = adminDirectoryEntries_().map(function(entry) {
    return { name: entry.name, position: entry.position };
  });
  if (adminUsers.length) directory.push({ faculty: 'ADMIN', users: adminUsers });
  return directory;
}

function loginApi(faculty, userName, emailUsername) {
  var selectedFaculty = String(faculty || '').trim();
  var selectedUser = String(userName || '').trim();
  var username = String(emailUsername || '').trim().toLowerCase();
  if (!selectedFaculty || !selectedUser || !username) throw new Error('Sila lengkapkan fakulti, pengguna dan username emel.');
  if (username.indexOf('@') !== -1) throw new Error('Masukkan username emel tanpa @unisza.edu.my.');

  var isAdmin = selectedFaculty === 'ADMIN';
  var entry = null;
  (isAdmin ? adminDirectoryEntries_() : userDirectoryEntries_()).some(function(candidate) {
    if (candidate.faculty === selectedFaculty && candidate.name === selectedUser && candidate.username === username) {
      entry = candidate;
      return true;
    }
    return false;
  });
  if (!entry) throw new Error('Maklumat log masuk tidak sepadan dengan direktori USER.');

  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var session = { faculty: entry.faculty, name: entry.name, position: entry.position, isAdmin: isAdmin };
  CacheService.getScriptCache().put(USER_SESSION_PREFIX_ + token, JSON.stringify(session), USER_SESSION_TTL_SECONDS_);
  return { token: token, user: session };
}

function requireLogin_(token) {
  var key = String(token || '').trim();
  var raw = key && CacheService.getScriptCache().get(USER_SESSION_PREFIX_ + key);
  if (!raw) throw new Error('Sesi log masuk tamat. Sila log masuk semula.');
  return JSON.parse(raw);
}

function userDirectoryEntries_() {
  var sheet = SpreadsheetApp.openById(USER_DIRECTORY_SPREADSHEET_ID_).getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) throw new Error('Sheet USER tidak ditemui dalam direktori pengguna.');
  var data = sheet.getDataRange().getValues();
  var header = data[0] || [];
  var facultyColumn = header.indexOf('Faculty');
  var nameColumn = header.indexOf('Graduate Coordinator');
  var emailColumn = header.indexOf('Graduate Coordinator Email');
  var positionColumn = header.indexOf('Position');
  if (facultyColumn < 0 || nameColumn < 0 || emailColumn < 0) {
    throw new Error('Kolum Faculty, Graduate Coordinator atau Graduate Coordinator Email tidak ditemui dalam sheet USER.');
  }

  return data.slice(1).reduce(function(entries, row) {
    var faculty = String(row[facultyColumn] || '').trim();
    var name = String(row[nameColumn] || '').trim();
    var email = String(row[emailColumn] || '').trim().toLowerCase();
    if (!faculty || !name || !email) return entries;
    entries.push({
      faculty: faculty,
      name: name,
      username: email.split('@')[0],
      position: positionColumn < 0 ? '' : String(row[positionColumn] || '').trim()
    });
    return entries;
  }, []);
}

function adminDirectoryEntries_() {
  var sheet = SpreadsheetApp.openById(USER_DIRECTORY_SPREADSHEET_ID_).getSheetByName(ADMIN_DIRECTORY_SHEET_NAME_);
  if (!sheet) throw new Error('Sheet ADMIN tidak ditemui dalam direktori pengguna.');
  var data = sheet.getDataRange().getValues();
  var header = data[0] || [];
  var nameColumn = header.indexOf('Name');
  var emailColumn = header.indexOf('Email');
  var positionColumn = header.indexOf('Position');
  if (nameColumn < 0 || emailColumn < 0) throw new Error('Kolum Name atau Email tidak ditemui dalam sheet ADMIN.');

  return data.slice(1).reduce(function(entries, row) {
    var name = String(row[nameColumn] || '').trim();
    var email = String(row[emailColumn] || '').trim().toLowerCase();
    if (!name || !email) return entries;
    entries.push({
      faculty: 'ADMIN',
      name: name,
      username: email.split('@')[0],
      position: positionColumn < 0 ? '' : String(row[positionColumn] || '').trim()
    });
    return entries;
  }, []);
}

/**
 * Programme directory from the "Programme" sheet.
 * Columns: A=Malay name, B=English name, C=MQA ref code, D=NEC 2020,
 *          E=programme code, F=accreditation, G=faculty full, H=faculty abbrev,
 *          I=sharing flag.
 */
function getProgrammesApi(sessionToken) {
  var session = requireLogin_(sessionToken);
  return session.isAdmin ? getProgrammes_() : getProgrammes_().filter(function(programme) { return programme.faculty === session.faculty; });
}

function requireProgrammeFacultyAccess_(mqaCode, session) {
  var code = String(mqaCode || '').trim();
  var programmes = getProgrammes_();
  for (var i = 0; i < programmes.length; i++) {
    if (programmes[i].mqaCode === code && (session.isAdmin || programmes[i].faculty === session.faculty)) return programmes[i];
  }
  throw new Error('Anda hanya boleh mengakses program di bawah fakulti sendiri.');
}

function getProgrammes_() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Sheet "Programme" not found');

  var data = sheet.getDataRange().getValues();
  var programmes = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mqaCode = String(row[2] || '').trim();
    if (!mqaCode) continue;
    var nameMy = String(row[0] || '').trim();
    var name = String(row[1] || row[0] || '').trim();
    programmes.push({
      nameMy: nameMy,
      name: name,
      mqaCode: mqaCode,
      nee: String(row[3] || '').trim(),
      progCode: String(row[4] || '').trim(),
      accreditation: String(row[5] || '').trim(),
      facultyFull: String(row[6] || '').trim(),
      faculty: String(row[7] || '').trim(),
      sharing: String(row[8] || '').trim(),
      level: detectLevel_(nameMy || name)
    });
  }
  return programmes;
}

/**
 * PEO/PLO records for a single programme tab (e.g. "MQA/FA5581").
 * Layout: marker row "PEO" then code|statement|mqf rows, marker row "PLO"
 * then code|statement|mqf|parentPEO|taxonomy|sdg|sc|tf rows.
 */
function getProgrammeDetailApi(mqaCode, sessionToken) {
  requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken));
  return getProgrammeDetail_(mqaCode);
}

function getProgrammeDetail_(mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!code) throw new Error('MQA code is required');

  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(code);
  if (!sheet) return { mqaCode: code, peos: [], plos: [] };

  var data = sheet.getDataRange().getValues();
  var peos = [];
  var plos = [];
  var section = '';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var marker = String(row[0] || '').trim().toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }

    var itemCode = String(row[0] || '').trim();
    if (!itemCode) continue;

    if (section === 'peo') {
      peos.push({
        code: itemCode,
        statement: String(row[1] || '').trim(),
        mqfDomain: String(row[2] || '').trim()
      });
    } else if (section === 'plo') {
      plos.push({
        code: itemCode,
        statement: String(row[1] || '').trim(),
        mqfDomain: String(row[2] || '').trim(),
        parentPEO: String(row[3] || '').trim(),
        taxonomy: String(row[4] || '').trim(),
        sdg: String(row[5] || '').trim(),
        sc: String(row[6] || '').trim(),
        tf: String(row[7] || '').trim()
      });
    }
  }
  relocateSpecialPhdSc_(plos, code);
  applyPEOMQFRollup_(peos, plos);
  return { mqaCode: code, peos: peos, plos: plos };
}

/**
 * Updates one existing PEO or PLO row. PEO MQF domains are derived from child
 * PLOs and therefore cannot be edited directly. This write path has no lock.
 */
function saveProgrammeRecordApi(mqaCode, recordType, payload, sessionToken) {
  requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken));
  var code = String(mqaCode || '').trim();
  var type = String(recordType || '').trim().toLowerCase();
  var item = payload || {};
  var itemCode = String(item.code || '').trim();
  var statement = String(item.statement || '').trim();
  if (!code || !itemCode) throw new Error('Programme and record codes are required');
  if (type !== 'peo' && type !== 'plo') throw new Error('Invalid record type');
  if (!statement) throw new Error('Statement is required');

  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(code);
  if (!sheet) throw new Error('Programme sheet not found: ' + code);

  var data = sheet.getDataRange().getValues();
  var match = findProgrammeRecordRow_(data, type, itemCode);
  if (!match) throw new Error('Record not found: ' + itemCode);

  if (type === 'peo') {
    sheet.getRange(match.row, 2).setValue(statement);
    SpreadsheetApp.flush();
    return getProgrammeDetail_(code);
  }

  var parentPEO = String(item.parentPEO || '').trim();
  var mqfDomain = normalizeMQFDomain_(item.mqfDomain);
  var taxonomy = String(item.taxonomy || '').trim().toUpperCase();
  var sdg = normalizeReferenceCode_(item.sdg);
  var sc = normalizeReferenceCode_(item.sc);
  var tf = normalizeReferenceCode_(item.tf);
  var peoCodes = programmePEOCodes_(data);
  if (peoCodes.indexOf(parentPEO) === -1) throw new Error('Select a valid parent PEO');
  if (MQF_DOMAIN_CODES_.indexOf(mqfDomain) === -1) throw new Error('Select a valid MQF domain');
  if (TAXONOMY_CODES_.indexOf(taxonomy) === -1) throw new Error('Select a valid taxonomy level');
  if (isSDGEligiblePLO_(itemCode, code) && SDG_CODES_.indexOf(sdg) === -1) {
    throw new Error('Select a valid SDG');
  }
  if (!isSDGEligiblePLO_(itemCode, code) && sdg) {
    throw new Error('SDG mapping is only available for ' + sdgEligiblePLOCodes_(code).join(', '));
  }
  if (isSCEligiblePLO_(itemCode, code) && SC_CODES_.indexOf(sc) === -1) {
    throw new Error('Select a valid sustainability competency');
  }
  if (!isSCEligiblePLO_(itemCode, code) && sc) {
    throw new Error('SC mapping is only available for ' + scEligiblePLOCodes_(code).join(', '));
  }
  if (transversalFutureSkillsForMQFDomain_(mqfDomain).indexOf(tf) === -1) {
    throw new Error('Select a transversal future skill valid for the MQF domain');
  }

  // Keep the stable code in column A and update only the editable PLO fields.
  ensurePLOHeaderColumns_(sheet, data);
  sheet.getRange(match.row, 2, 1, 7).setValues([[statement, mqfDomain, parentPEO, taxonomy, sdg, sc, tf]]);
  if (normalizePLOCode_(itemCode) === 'PLO10' && scEligiblePLOCodes_(code).indexOf('PLO10') > -1) {
    var legacySc = findProgrammeRecordRow_(data, 'plo', 'PLO11');
    if (legacySc) sheet.getRange(legacySc.row, 7).clearContent();
  }
  SpreadsheetApp.flush();
  return getProgrammeDetail_(code);
}

function findProgrammeRecordRow_(data, recordType, itemCode) {
  var section = '';
  var expectedCode = String(itemCode || '').trim().toUpperCase();
  for (var i = 0; i < data.length; i++) {
    var current = String(data[i][0] || '').trim();
    var marker = current.toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    if (section === recordType && marker === expectedCode) return { row: i + 1 };
  }
  return null;
}

function programmePEOCodes_(data) {
  var result = [];
  var section = '';
  for (var i = 0; i < data.length; i++) {
    var code = String(data[i][0] || '').trim();
    var marker = code.toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    if (section === 'peo' && code) result.push(code);
  }
  return result;
}

function normalizeMQFDomain_(value) {
  var compact = String(value || '').trim().replace(/\s+/g, '').toUpperCase();
  for (var i = 0; i < MQF_DOMAIN_CODES_.length; i++) {
    if (MQF_DOMAIN_CODES_[i].replace(/\s+/g, '').toUpperCase() === compact) return MQF_DOMAIN_CODES_[i];
  }
  return String(value || '').trim();
}

function normalizeReferenceCode_(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function isSDGEligiblePLO_(ploCode, programmeCode) {
  return sdgEligiblePLOCodes_(programmeCode).indexOf(normalizePLOCode_(ploCode)) > -1;
}

function sdgEligiblePLOCodes_(programmeCode) {
  var code = normalizeReferenceCode_(programmeCode);
  return SDG_ELIGIBLE_PLO_CODES_BY_PROGRAMME_[code] || SDG_ELIGIBLE_PLO_CODES_;
}

function normalizePLOCode_(ploCode) {
  return normalizeReferenceCode_(ploCode).replace(/^PLO0+(\d+)$/, 'PLO$1');
}

function isSCEligiblePLO_(ploCode, programmeCode) {
  return scEligiblePLOCodes_(programmeCode).indexOf(normalizePLOCode_(ploCode)) > -1;
}

function scEligiblePLOCodes_(programmeCode) {
  var code = normalizeReferenceCode_(programmeCode);
  return SC_ELIGIBLE_PLO_CODES_BY_PROGRAMME_[code] || SC_ELIGIBLE_PLO_CODES_;
}

function defaultSCForPLO_(ploCode, mqfDomain, programmeCode) {
  if (normalizePLOCode_(ploCode) === 'PLO10' && scEligiblePLOCodes_(programmeCode).indexOf('PLO10') > -1) return 'SC8';
  return isSCEligiblePLO_(ploCode, programmeCode) ? (SC_CODES_BY_MQF_DOMAIN_[normalizeReferenceCode_(mqfDomain)] || '') : '';
}

function relocateSpecialPhdSc_(plos, programmeCode) {
  if (scEligiblePLOCodes_(programmeCode).indexOf('PLO10') === -1) return;
  var plo10 = null;
  var plo11 = null;
  (plos || []).forEach(function(plo) {
    if (normalizePLOCode_(plo.code) === 'PLO10') plo10 = plo;
    if (normalizePLOCode_(plo.code) === 'PLO11') plo11 = plo;
  });
  if (!plo10 || !plo11) return;
  if (!plo10.sc && plo11.sc) plo10.sc = plo11.sc;
  plo11.sc = '';
}

function transversalFutureSkillsForMQFDomain_(mqfDomain) {
  var compact = normalizeReferenceCode_(normalizeMQFDomain_(mqfDomain));
  return TF_CODES_BY_MQF_DOMAIN_[compact] || [];
}

function ensurePLOHeaderColumns_(sheet, data) {
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() === 'PLO') {
      sheet.getRange(i + 1, 1, 1, PROGRAMME_TAB_SECTIONS.PLO.columns.length)
        .setValues([PROGRAMME_TAB_SECTIONS.PLO.columns]);
      return;
    }
  }
}

/**
 * Applies the approved SC and TF mappings to every PLO in every programme
 * tab listed on the Programme sheet. SDG values are not changed.
 */
function autoMapPLOSCAndTF() {
  var ss = programmeSpreadsheet_();
  var programmes = getProgrammes_();
  var summary = { programmesProcessed: 0, programmesSkipped: 0, plosProcessed: 0, cellsUpdated: 0 };

  programmes.forEach(function(programme) {
    var sheet = ss.getSheetByName(programme.mqaCode);
    if (!sheet) {
      summary.programmesSkipped++;
      return;
    }

    var data = sheet.getDataRange().getValues();
    var section = '';
    var groupStartRow = -1;
    var groupValues = [];
    var flush = function() {
      if (!groupValues.length) return;
      sheet.getRange(groupStartRow, 7, groupValues.length, 2).setValues(groupValues);
      groupStartRow = -1;
      groupValues = [];
    };

    ensurePLOHeaderColumns_(sheet, data);
    for (var i = 0; i < data.length; i++) {
      var marker = String(data[i][0] || '').trim().toUpperCase();
      if (marker === 'PEO') { section = 'peo'; continue; }
      if (marker === 'PLO') { section = 'plo'; continue; }
      if (section !== 'plo' || !marker) {
        flush();
        continue;
      }

      var mqfDomain = normalizeMQFDomain_(data[i][2]);
      var sc = defaultSCForPLO_(marker, mqfDomain, programme.mqaCode);
      var tfOptions = transversalFutureSkillsForMQFDomain_(mqfDomain);
      var tf = tfOptions.length === 1 ? tfOptions[0] : '';
      var row = i + 1;

      if (groupStartRow === -1) groupStartRow = row;
      if (row !== groupStartRow + groupValues.length) flush();
      if (groupStartRow === -1) groupStartRow = row;
      groupValues.push([sc, tf]);
      summary.plosProcessed++;
      if (normalizeReferenceCode_(data[i][6]) !== sc) summary.cellsUpdated++;
      if (normalizeReferenceCode_(data[i][7]) !== tf) summary.cellsUpdated++;
    }
    flush();
    summary.programmesProcessed++;
  });

  Logger.log(JSON.stringify(summary));
  return summary;
}

/**
 * Moves SDG8 from PLO8 to PLO9 for the four approved programmes and applies
 * their approved third SDG. Doctorate programmes use PLO10/SDG12/SC8; Masters
 * programmes retain PLO11/SDG17. It changes only SDG and SC cells. Existing,
 * different values are reported as conflicts rather than overwritten.
 */
function migrateApprovedSdgPlo8ToPlo9() {
  var programmes = [
    { code: 'MQA/FA5571', thirdPlo: 'PLO11', thirdSdg: 'SDG17' },
    { code: 'MQA/FA5572', thirdPlo: 'PLO11', thirdSdg: 'SDG17' },
    { code: 'MQA/FA5573', thirdPlo: 'PLO10', thirdSdg: 'SDG12', thirdSc: 'SC8' },
    { code: 'MQA/FA5574', thirdPlo: 'PLO10', thirdSdg: 'SDG12', thirdSc: 'SC8' }
  ];
  var ss = programmeSpreadsheet_();
  var summary = { migrated: [], skipped: [], conflicts: [], errors: [] };

  programmes.forEach(function(programme) {
    var programmeCode = programme.code;
    try {
      var sheet = ss.getSheetByName(programmeCode);
      if (!sheet) {
        summary.errors.push(programmeCode + ': programme sheet not found');
        return;
      }

      var rows = sheet.getDataRange().getValues();
      var plo8Row = 0;
      var plo9Row = 0;
      var thirdPloRow = 0;
      var plo11Row = 0;
      var inPloSection = false;
      for (var i = 0; i < rows.length; i++) {
        var code = normalizePLOCode_(rows[i][0]);
        if (code === 'PLO') {
          inPloSection = true;
          continue;
        }
        if (!inPloSection) continue;
        if (code === 'PLO8') plo8Row = i + 1;
        if (code === 'PLO9') plo9Row = i + 1;
        if (code === programme.thirdPlo) thirdPloRow = i + 1;
        if (code === 'PLO11') plo11Row = i + 1;
      }
      if (!plo8Row || !plo9Row || !thirdPloRow) {
        summary.errors.push(programmeCode + ': required SDG PLO not found');
        return;
      }

      var sourceSdg = normalizeReferenceCode_(rows[plo8Row - 1][5]);
      var targetSdg = normalizeReferenceCode_(rows[plo9Row - 1][5]);
      var thirdSdg = normalizeReferenceCode_(rows[thirdPloRow - 1][5]);
      var thirdSc = normalizeReferenceCode_(rows[thirdPloRow - 1][6]);
      if (!sourceSdg) {
        summary.skipped.push(programmeCode + ': PLO8 has no SDG');
        return;
      }
      if (targetSdg && targetSdg !== sourceSdg) {
        summary.conflicts.push(programmeCode + ': PLO9 already has ' + targetSdg);
        return;
      }
      if (thirdSdg && thirdSdg !== programme.thirdSdg) {
        summary.conflicts.push(programmeCode + ': ' + programme.thirdPlo + ' already has ' + thirdSdg);
        return;
      }
      if (programme.thirdSc && thirdSc && thirdSc !== programme.thirdSc) {
        summary.conflicts.push(programmeCode + ': ' + programme.thirdPlo + ' already has ' + thirdSc);
        return;
      }

      sheet.getRange(plo9Row, 6).setValue(sourceSdg);
      sheet.getRange(plo8Row, 6).clearContent();
      sheet.getRange(thirdPloRow, 6).setValue(programme.thirdSdg);
      if (programme.thirdPlo !== 'PLO11' && plo11Row) sheet.getRange(plo11Row, 6).clearContent();
      if (programme.thirdSc) {
        sheet.getRange(thirdPloRow, 7).setValue(programme.thirdSc);
        if (plo11Row) sheet.getRange(plo11Row, 7).clearContent();
      }
      summary.migrated.push(programmeCode + ': ' + sourceSdg + ', ' + programme.thirdPlo + '=' + programme.thirdSdg + (programme.thirdSc ? '/' + programme.thirdSc : ''));
    } catch (error) {
      summary.errors.push(programmeCode + ': ' + error.message);
    }
  });

  SpreadsheetApp.flush();
  Logger.log(JSON.stringify(summary));
  return summary;
}

function applyPEOMQFRollup_(peos, plos) {
  var domainsByPEO = {};
  (plos || []).forEach(function(plo) {
    var parentPEO = String(plo.parentPEO || '').trim();
    var mqfDomain = normalizeMQFDomain_(plo.mqfDomain);
    if (!parentPEO || MQF_DOMAIN_CODES_.indexOf(mqfDomain) === -1) return;
    if (!domainsByPEO[parentPEO]) domainsByPEO[parentPEO] = [];
    if (domainsByPEO[parentPEO].indexOf(mqfDomain) === -1) domainsByPEO[parentPEO].push(mqfDomain);
  });
  (peos || []).forEach(function(peo) {
    var domains = domainsByPEO[peo.code] || [];
    domains.sort(function(a, b) { return MQF_DOMAIN_CODES_.indexOf(a) - MQF_DOMAIN_CODES_.indexOf(b); });
    peo.mqfDomains = domains;
    peo.mqfDomain = domains.join(', ');
  });
}

function detectLevel_(name) {
  var n = String(name || '').toLowerCase();
  if (n.indexOf('doktor') > -1 || n.indexOf('doctor') > -1 || n.indexOf('ph.d') > -1 ||
      n.indexOf('phd') > -1 || n.indexOf('doctoral') > -1 || n.indexOf('doctorate') > -1) return 'Doctorate';
  if (n.indexOf('master') > -1 || n.indexOf('sarjana') > -1) return 'Masters';
  return 'Other';
}

/**
 * Adds a new PEO or PLO row to a programme tab. PLO rows are capped at 11.
 * Returns the refreshed programme detail.
 */
function addProgrammeRecordApi(mqaCode, recordType, sessionToken) {
  requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken));
  var code = String(mqaCode || '').trim();
  var type = String(recordType || '').trim().toLowerCase();
  if (!code) throw new Error('MQA code is required');
  if (type !== 'peo' && type !== 'plo') throw new Error('Invalid record type');

  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(code);
  if (!sheet) throw new Error('Programme sheet not found: ' + code);

  var data = sheet.getDataRange().getValues();
  var peoHeader = -1;
  var ploHeader = -1;
  var peoRows = 0;
  var ploRows = 0;
  var lastPeoRow = -1;
  var lastPloRow = -1;
  for (var i = 0; i < data.length; i++) {
    var marker = String(data[i][0] || '').trim().toUpperCase();
    if (marker === 'PEO') { peoHeader = i; continue; }
    if (marker === 'PLO') { ploHeader = i; continue; }
    if (peoHeader > -1 && ploHeader === -1 && String(data[i][0] || '').trim()) { peoRows++; lastPeoRow = i; }
    if (ploHeader > -1 && String(data[i][0] || '').trim()) { ploRows++; lastPloRow = i; }
  }
  if (peoHeader === -1) throw new Error('PEO section not found in ' + code);
  if (ploHeader === -1) throw new Error('PLO section not found in ' + code);

  if (type === 'peo') {
    var peoCode = 'PEO' + (peoRows + 1);
    var peoRow = lastPeoRow === -1 ? peoHeader + 1 : lastPeoRow + 1;
    if (peoRow >= ploHeader) {
      sheet.insertRows(peoRow + 1, 1);
    }
    sheet.getRange(peoRow + 1, 1, 1, 3).setValues([[peoCode, '', '']]);
    SpreadsheetApp.flush();
    return getProgrammeDetail_(code);
  }

  if (ploRows >= MAX_PLO_COUNT_) throw new Error('Maksimum ' + MAX_PLO_COUNT_ + ' PLO sahaja.');
  var ploCode = 'PLO' + (ploRows + 1);
  var ploRow = lastPloRow === -1 ? ploHeader + 1 : lastPloRow + 1;
  ensurePLOHeaderColumns_(sheet, data);
  sheet.getRange(ploRow + 1, 1, 1, 8).setValues([[ploCode, '', '', '', '', '', '', '']]);
  SpreadsheetApp.flush();
  return getProgrammeDetail_(code);
}

/**
 * Generates a PDF of the programme's PEO/PLO records and saves it to the
 * shared Graduate School Drive folder with the naming convention
 * MQA-FAxxxx-ddmmyy-zz (zz = daily serial). Returns the stored file details.
 */
function generatePdfApi(mqaCode, sessionToken) {
  requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken));
  var code = String(mqaCode || '').trim();
  if (!code) throw new Error('MQA code is required');

  var programmes = getProgrammes_();
  var programme = null;
  for (var i = 0; i < programmes.length; i++) {
    if (String(programmes[i].mqaCode).trim() === code) { programme = programmes[i]; break; }
  }
  var detail = getProgrammeDetail_(code);
  var folder = getPdfFolder_();
  var filename = buildPdfFilename_(code, folder);

  var blob = buildPdfBlob_(programme, detail, code);
  var file = folder.createFile(blob);
  file.setName(filename);

  return {
    filename: filename,
    fileId: file.getId(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    mqaCode: code,
    programmeName: programme ? programme.name : code
  };
}

function getPdfFolder_() {
  var folder = DriveApp.getFolderById(PDF_FOLDER_ID_);
  if (!folder) throw new Error('PDF destination folder not found. Please check access for ' + PDF_FOLDER_ID_);
  return folder;
}

function buildPdfFilename_(mqaCode, folder) {
  var safeCode = String(mqaCode || '').trim().replace('/', '-');
  var now = new Date();
  var day = ('0' + now.getDate()).slice(-2);
  var month = ('0' + (now.getMonth() + 1)).slice(-2);
  var year = String(now.getFullYear()).slice(-2);
  var dateCode = day + month + year;

  var base = safeCode + '-' + dateCode + '-';
  var maxSerial = 0;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var name = files.next().getName();
    if (name.indexOf(base) === 0) {
      var match = name.slice(base.length).match(/^(\d+)/);
      if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10));
    }
  }
  var serial = ('0' + (maxSerial + 1)).slice(-2);
  return base + serial;
}

function buildPdfBlob_(programme, detail, code) {
  var name = programme && programme.name ? programme.name : code;
  var level = programme ? programme.level || '' : '';
  var faculty = programme ? (programme.facultyFull || programme.faculty || '') : '';
  var progCode = programme ? programme.progCode || '' : '';

  var tempName = 'PDFTMP_' + Utilities.getUuid().replace(/-/g, '');
  var tempSs = SpreadsheetApp.create(tempName);
  var sheet = tempSs.getSheets()[0];
  try {

    var generatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var peos = detail.peos || [];
    var plos = detail.plos || [];
    var peoCount = peos.length;
    var ploCount = plos.length;

    var values = [];
    var titleRow = 1;
    var metaRow1 = 2;
    var metaRow2 = 3;
    var metaRow3 = 4;
    var peoHeadingRow = 6;
    var peoHeaderRow = 7;
    var peoDataStart = 8;
    var ploHeadingRow = peoDataStart + peoCount + 1;
    var ploHeaderRow = ploHeadingRow + 1;
    var ploDataStart = ploHeaderRow + 1;
    var footerRow = ploDataStart + ploCount + 1;

    var totalRows = footerRow + 1;
    var lastCol = 8;

    values[titleRow] = ['MQF 2.0 (2024) — Programme Information'];
    values[metaRow1] = [name + '  ·  ' + code + (progCode ? '  ·  ' + progCode : '')];
    values[metaRow2] = [level + (faculty ? '  ·  ' + faculty : '')];
    values[metaRow3] = ['Generated: ' + generatedAt];
    values[peoHeadingRow] = ['PEO — Programme Educational Objectives'];
    values[peoHeaderRow] = ['Code', 'PEO statement', 'MQF domain'];
    for (var p = 0; p < peoCount; p++) {
      values[peoDataStart + p] = [peos[p].code, peos[p].statement || '', peos[p].mqfDomain || ''];
    }
    values[ploHeadingRow] = ['PLO — Programme Learning Outcomes'];
    values[ploHeaderRow] = ['Code', 'PLO statement', 'Parent PEO', 'MQF domain', 'Taxonomy', 'SDG', 'SC', 'TF'];
    for (var q = 0; q < ploCount; q++) {
      var sdg = isSDGEligiblePLO_(plos[q].code, code) ? plos[q].sdg || '' : '';
      var sc = isSCEligiblePLO_(plos[q].code, code) ? plos[q].sc || '' : '';
      values[ploDataStart + q] = [plos[q].code, plos[q].statement || '', plos[q].parentPEO || '', plos[q].mqfDomain || '', plos[q].taxonomy || '', sdg, sc, plos[q].tf || ''];
    }
    values[footerRow] = ['Dokumen ini dijana secara automatik oleh Sistem Maklumat Program MQF 2.0 · Pusat Pengajian Siswazah, Universiti Sultan Zainal Abidin'];

    for (var r = 1; r <= totalRows; r++) {
      if (values[r]) sheet.getRange(r, 1, 1, lastCol).setValues([padRow_(values[r], lastCol)]);
    }

    // Column widths
    sheet.setColumnWidth(1, 70).setColumnWidth(2, 280).setColumnWidth(3, 100).setColumnWidth(4, 85).setColumnWidth(5, 85).setColumnWidth(6, 70).setColumnWidth(7, 70).setColumnWidth(8, 70);

    // Title
    sheet.getRange(titleRow, 1).setFontWeight('bold').setFontSize(16).setFontColor('#004d40');
    sheet.setRowHeight(titleRow, 28);

    // Meta
    sheet.getRange(metaRow1, 1).setFontSize(11);
    sheet.getRange(metaRow2, 1).setFontSize(11);
    sheet.getRange(metaRow3, 1).setFontSize(10).setFontColor('#616161');

    // Section headings
    sheet.getRange(peoHeadingRow, 1).setFontWeight('bold').setFontSize(13).setFontColor('#004d40');
    sheet.getRange(ploHeadingRow, 1).setFontWeight('bold').setFontSize(13).setFontColor('#004d40');
    sheet.setRowHeight(peoHeadingRow, 24);
    sheet.setRowHeight(ploHeadingRow, 24);

    // Table headers
    var peoHeaderRange = sheet.getRange(peoHeaderRow, 1, 1, 3);
    peoHeaderRange.setBackground('#004d40').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    var ploHeaderRange = sheet.getRange(ploHeaderRow, 1, 1, 8);
    ploHeaderRange.setBackground('#004d40').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.setRowHeight(peoHeaderRow, 20);
    sheet.setRowHeight(ploHeaderRow, 20);

    // Zebra rows
    if (peoCount) {
      var peoDataRange = sheet.getRange(peoDataStart, 1, peoCount, 3);
      peoDataRange.setWrap(true).setVerticalAlignment('top');
      for (var z = 0; z < peoCount; z++) {
        if (z % 2 === 1) sheet.getRange(peoDataStart + z, 1, 1, 3).setBackground('#f7f7f5');
      }
      sheet.getRange(peoDataStart, 1, peoCount, 1).setFontWeight('bold');
    } else {
      sheet.getRange(peoDataStart, 1).setValue('Tiada rekod PEO.').setFontColor('#93939f');
    }

    if (ploCount) {
      var ploDataRange = sheet.getRange(ploDataStart, 1, ploCount, 8);
      ploDataRange.setWrap(true).setVerticalAlignment('top');
      for (var z2 = 0; z2 < ploCount; z2++) {
        if (z2 % 2 === 1) sheet.getRange(ploDataStart + z2, 1, 1, 8).setBackground('#f7f7f5');
      }
      sheet.getRange(ploDataStart, 1, ploCount, 1).setFontWeight('bold');
    } else {
      sheet.getRange(ploDataStart, 1).setValue('Tiada rekod PLO.').setFontColor('#93939f');
    }

    // Footer
    sheet.getRange(footerRow, 1).setFontSize(8).setFontColor('#93939f');

    // The temporary spreadsheet has one sheet, so Drive exports only this PDF content.
    sheet.setHiddenGridlines(true);
    SpreadsheetApp.flush();
    var blob = DriveApp.getFileById(tempSs.getId()).getAs(MimeType.PDF);
    blob.setName(filenameBase_(code) + '.pdf');
    return blob;
  } finally {
    try { DriveApp.getFileById(tempSs.getId()).setTrashed(true); } catch (e) { /* temp cleanup */ }
  }
}

function padRow_(row, width) {
  var out = [];
  for (var i = 0; i < width; i++) out.push(row[i] == null ? '' : row[i]);
  return out;
}


function filenameBase_(mqaCode) {
  return String(mqaCode || '').trim().replace('/', '-');
}

function escapeHtml_(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Sends the generated PDF by email to the requester from the Deputy Dean
 * (Academic) PPS address. The address is valid when it is either the executing
 * account's own email or one of its send-as aliases; otherwise the send fails.
 */
function sendPdfEmailApi(mqaCode, email, fileId, sessionToken) {
  requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken));
  var to = String(email || '').trim();
  var code = String(mqaCode || '').trim();
  var id = String(fileId || '').trim();
  if (!to || !code || !id) throw new Error('Email, programme code and file ID are required');

  var from = 'pps_tdakademik@unisza.edu.my';
  var activeEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var aliases = GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); });
  var isOwn = activeEmail === from.toLowerCase();
  var isAlias = aliases.indexOf(from.toLowerCase()) !== -1;
  if (!isOwn && !isAlias) {
    throw new Error('From address ' + from + ' is not the executing account or one of its aliases.');
  }

  var file = DriveApp.getFileById(id);
  var programmes = getProgrammes_();
  var programme = null;
  for (var i = 0; i < programmes.length; i++) {
    if (String(programmes[i].mqaCode).trim() === code) { programme = programmes[i]; break; }
  }
  var name = programme && programme.name ? programme.name : code;
  var filename = file.getName();
  var pdfBlob = file.getBlob();
  pdfBlob.setName(filename);

  var subject = 'MQF 2.0 (2024) | Maklumat Program: ' + name + ' (' + code + ')';
  var body = 'Assalamualaikum dan Salam sejahtera,\n\n' +
    'Bersama-sama ini dilampirkan dokumen PDF maklumat program berikut:\n\n' +
    'Programme: ' + name + '\n' +
    'MQA Code: ' + code + '\n' +
    'Nama Fail: ' + filename + '\n\n' +
    'Dokumen ini dijana daripada modul Nexus: Maklumat Program MQF 2.0 (2024).\n' +
    'Sekiranya terdapat sebarang pertanyaan, sila hubungi Bahagian Akademik, Pusat Pengajian Siswazah.\n\n' +
    'Sekian, terima kasih.\n\n' +
    'Timbalan Dekan (Akademik)\n' +
    'Pusat Pengajian Siswazah\n' +
    'Universiti Sultan Zainal Abidin';

  var htmlBody = 'Assalamualaikum dan Salam sejahtera,<br><br>' +
    'Bersama-sama ini dilampirkan dokumen PDF maklumat program berikut:<br><br>' +
    '<strong>Programme:</strong> ' + escapeHtml_(name) + '<br>' +
    '<strong>MQA Code:</strong> ' + escapeHtml_(code) + '<br>' +
    '<strong>Nama Fail:</strong> ' + escapeHtml_(filename) + '<br><br>' +
    'Dokumen ini dijana daripada modul <strong>Nexus: Maklumat Program MQF 2.0 (2024)</strong>.<br>' +
    'Sekiranya terdapat sebarang pertanyaan, sila hubungi Bahagian Akademik, Pusat Pengajian Siswazah.<br><br>' +
    'Sekian, terima kasih.<br><br>' +
    'Timbalan Dekan (Akademik)<br>' +
    'Pusat Pengajian Siswazah<br>' +
    'Universiti Sultan Zainal Abidin';

  var options = {
    name: 'Timbalan Dekan (Akademik) PPS',
    htmlBody: htmlBody,
    attachments: [pdfBlob]
  };
  if (isAlias) options.from = from;
  GmailApp.sendEmail(to, subject, body, options);

  return { sent: true, to: to, filename: filename, from: from };
}
