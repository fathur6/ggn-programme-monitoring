/** AutoDetailWriteService.gs — Insert auto-computed SDG, SC, TF into each MQA/FA detail tab. */

// Column positions inside the legacy MQA/FA detail tabs (0-based).
var AUTO_DETAIL_COLS_ = { SDG: 5, SC: 5, TF: 6 };

function autoDetailCanonicalCode_(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Parses a detail tab into ordered PEO/PLO records plus the number of rows
 * that belong to the source data (scanning stops at blank lines or the
 * appended Phase 2 block so auto values never overwrite that block).
 */
function autoDetailScanTab_(values) {
  var peoRecords = [];
  var ploRecords = [];
  var section = '';
  var dataEndRow = values.length;
  var stop = false;
  for (var r = 0; r < values.length && !stop; r++) {
    var row = values[r] || [];
    var marker = String(row[0] || '').trim().toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    if (!marker && section) { dataEndRow = r; stop = true; continue; }
    if (marker.indexOf('###') === 0 || marker.indexOf('---') === 0) { dataEndRow = r; stop = true; continue; }
    if (section === 'peo' && /^PEO\d+$/.test(marker)) {
      peoRecords.push({code: row[0], statement: row[1], row: r});
    } else if (section === 'plo' && /^PLO\d+$/.test(marker)) {
      ploRecords.push({code: row[0], statement: row[1], mqf: row[2], row: r});
    }
  }
  return {peoRecords: peoRecords, ploRecords: ploRecords, dataEndRow: dataEndRow};
}

/** Indexes the PR_ workspace rows for one effective key into lookups. */
function autoDetailBuildMap_(effectiveKey, researchSheets, references) {
  var peos = researchRows_(researchSheets.PR_PEORecords).filter(function(row) { return String(row[1]) === effectiveKey; });
  var plos = researchRows_(researchSheets.PR_PLORecords).filter(function(row) { return String(row[1]) === effectiveKey; });
  var peoMappings = researchRows_(researchSheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === effectiveKey; });
  var ploMappings = researchRows_(researchSheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === effectiveKey; });

  var peoByCode = {};
  peos.forEach(function(row) { peoByCode[autoDetailCanonicalCode_(row[2])] = row; });
  var ploByCode = {};
  plos.forEach(function(row) { ploByCode[autoDetailCanonicalCode_(row[3])] = row; });

  var peoSdgByPeoId = {};
  peoMappings.forEach(function(row) {
    var sdgs; try { sdgs = JSON.parse(row[2] || '[]'); } catch (e) { sdgs = []; }
    if (Array.isArray(sdgs)) peoSdgByPeoId[String(row[0])] = sdgs;
  });
  var ploScByPloId = {};
  var ploTfByPloId = {};
  ploMappings.forEach(function(row) {
    var scs; try { scs = JSON.parse(row[2] || '[]'); } catch (e) { scs = []; }
    var tfs; try { tfs = JSON.parse(row[3] || '[]'); } catch (e) { tfs = []; }
    if (Array.isArray(scs)) ploScByPloId[String(row[0])] = scs;
    if (Array.isArray(tfs)) ploTfByPloId[String(row[0])] = tfs;
  });

  return {
    peos: peos,
    plos: plos,
    peoByCode: peoByCode,
    ploByCode: ploByCode,
    peoSdgByPeoId: peoSdgByPeoId,
    ploScByPloId: ploScByPloId,
    ploTfByPloId: ploTfByPloId,
    tfMap: researchTFReferenceMap_(references)
  };
}

/**
 * Computes the auto values per PEO/PLO code. Uses the app's PR_ mappings when
 * available; otherwise falls back to the same deterministic logic the app uses:
 *  - SDG: PPS programme defaults matched onto the last three PEOs
 *  - SC:  matchPLOToSC_ (MQF default + keyword refinement)
 *  - TF:  deriveTFIds_ from the MQF domains
 */
function autoDetailCompute_(programme, map, peoRecords, ploRecords) {
  var sdgByCode = {};
  var scByCode = {};
  var tfByCode = {};

  peoRecords.forEach(function(rec) {
    var code = autoDetailCanonicalCode_(rec.code);
    sdgByCode[code] = [];
  });
  if (map.peos.length) {
    peoRecords.forEach(function(rec) {
      var code = autoDetailCanonicalCode_(rec.code);
      var peoRow = map.peoByCode[code];
      if (peoRow) sdgByCode[code] = map.peoSdgByPeoId[String(peoRow[0])] || [];
    });
  } else if (peoRecords.length) {
    var defaults = getProgrammeSDGDefaults_(programme);
    var last3 = peoRecords.slice(-3).map(function(rec) { return [String(rec.code), '', '', String(rec.statement || '')]; });
    var assignments = matchSDGsToPEOs_(last3, defaults);
    for (var i = 0; i < assignments.length; i++) {
      var assignment = assignments[i] || {};
      if (assignment.sdgId) sdgByCode[autoDetailCanonicalCode_(last3[i][0])] = [assignment.sdgId];
    }
  }

  ploRecords.forEach(function(rec) {
    var code = autoDetailCanonicalCode_(rec.code);
    var ploRow = map.ploByCode[code];
    var mqfDomains = [];
    var scs = [];
    var tfs = [];
    if (ploRow) {
      mqfDomains = parseResearchJson_(ploRow[5]);
      scs = map.ploScByPloId[String(ploRow[0])] || [];
      tfs = map.ploTfByPloId[String(ploRow[0])] || [];
    }
    if (!mqfDomains.length && rec.mqf) mqfDomains = [normalizeLegacyMQF_(rec.mqf)];
    if (!scs.length) {
      scs = [matchPLOToSC_({mqfDomains: mqfDomains, statement: ploRow ? String(ploRow[4] || '') : String(rec.statement || '')})];
    }
    if (!tfs.length) {
      tfs = deriveTFIds_(mqfDomains, map.tfMap).slice(0, 1);
    }
    scByCode[code] = scs;
    tfByCode[code] = tfs;
  });

  return {sdgByCode: sdgByCode, scByCode: scByCode, tfByCode: tfByCode};
}

/** Writes the computed values into a single detail tab (SDG → col F, SC → col F, TF → col G). */
function writeAutoValuesToDetailTab_(programme, researchSheets, references, ss) {
  var mqaCode = String(programme.mqaCode || '').trim();
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return {mqaCode: mqaCode, status: 'no-tab', cells: 0};

  var key = getResearchProgrammeKey_(programme);
  var effectiveKey = researchEffectiveKey_(key, researchSheets);
  var map = autoDetailBuildMap_(effectiveKey, researchSheets, references);

  var allValues = sheet.getDataRange().getValues();
  var scan = autoDetailScanTab_(allValues);
  var computed = autoDetailCompute_(programme, map, scan.peoRecords, scan.ploRecords);

  var written = 0;
  for (var r = 0; r < scan.dataEndRow; r++) {
    var row = allValues[r] || [];
    var marker = String(row[0] || '').trim().toUpperCase();
    if (marker === 'PEO' || marker === 'PLO') continue;
    var compact = autoDetailCanonicalCode_(marker);
    var value = '';
    var col = -1;
    if (/^PEO\d+$/.test(compact)) {
      value = (computed.sdgByCode[compact] || []).join(', ');
      col = AUTO_DETAIL_COLS_.SDG;
    } else if (/^PLO\d+$/.test(compact)) {
      var currentSC = String(row[AUTO_DETAIL_COLS_.SC] || '').trim();
      var sc = (computed.scByCode[compact] || []).join(', ');
      if (currentSC !== sc) {
        sheet.getRange(r + 1, AUTO_DETAIL_COLS_.SC + 1, 1, 1).setValues([[sc]]);
        written++;
      }
      value = (computed.tfByCode[compact] || []).join(', ');
      col = AUTO_DETAIL_COLS_.TF;
    }
    if (col >= 0 && String(row[col] || '').trim() !== value) {
      sheet.getRange(r + 1, col + 1, 1, 1).setValues([[value]]);
      written++;
    }
  }
  return {mqaCode: mqaCode, status: 'ok', effectiveKey: effectiveKey, peos: scan.peoRecords.length, plos: scan.ploRecords.length, cells: written};
}

function writeAutoValuesToDetailApi_(programmeIdOrMqaCode) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'view-programme');
  var programme = resolveProgramme_(programmeIdOrMqaCode);
  if (!programme || !isResearchProgramme_(programme)) throw new Error('Not a postgraduate by research programme');
  var ss = getSpreadsheet();
  return withResearchLockRetry_(function() {
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    return writeAutoValuesToDetailTab_(programme, researchSheets, references, ss);
  });
}

function writeAllAutoValuesToDetailApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var ss = getSpreadsheet();
  return withResearchLockRetry_(function() {
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    var programmes = getProgrammes_(null).filter(isResearchProgramme_);
    var results = [];
    var errors = [];
    var seenTabs = {};
    programmes.forEach(function(programme) {
      var mqaCode = String(programme.mqaCode || '').trim();
      if (seenTabs[mqaCode]) return;
      seenTabs[mqaCode] = true;
      try {
        results.push(writeAutoValuesToDetailTab_(programme, researchSheets, references, ss));
      } catch (e) {
        errors.push({mqaCode: mqaCode, name: programme.name, error: String(e.message || e)});
      }
    });
    return {ok: true, total: programmes.length, tabs: results.length, cells: results.reduce(function(sum, r) { return sum + (r.cells || 0); }, 0), errors: errors.length, results: results, errorDetails: errors};
  });
}

/** Splits a cell value (codes separated by comma/semicolon/newline) into trimmed codes. */
function autoDetailParseCellCodes_(raw) {
  return String(raw || '').split(/[,;\n]/).map(function(part) { return part.trim(); }).filter(Boolean);
}

/**
 * Reads the CURRENT cell values (PPS default or faculty alignment) out of a
 * detail tab. Column F on PEO rows is SDG; column F on PLO rows is SC; column
 * G on PLO rows is TF.
 */
function autoDetailReadCells_(values) {
  var scan = autoDetailScanTab_(values);
  var sdgByCode = {};
  var scByCode = {};
  var tfByCode = {};
  scan.peoRecords.forEach(function(rec) {
    var row = values[rec.row] || [];
    sdgByCode[autoDetailCanonicalCode_(rec.code)] = autoDetailParseCellCodes_(row[AUTO_DETAIL_COLS_.SDG]);
  });
  scan.ploRecords.forEach(function(rec) {
    var row = values[rec.row] || [];
    scByCode[autoDetailCanonicalCode_(rec.code)] = autoDetailParseCellCodes_(row[AUTO_DETAIL_COLS_.SC]);
    tfByCode[autoDetailCanonicalCode_(rec.code)] = autoDetailParseCellCodes_(row[AUTO_DETAIL_COLS_.TF]);
  });
  return {sdgByCode: sdgByCode, scByCode: scByCode, tfByCode: tfByCode};
}

/**
 * Rebuilds the PLO/SC/TF and PEO/SDG mapping arrays so SDG, SC and TF are
 * sourced from the tab cells (faculty alignment) when present, falling back to
 * the PR_ mappings. Codes are filtered against the reference lists.
 */
function autoDetailApplyPhase2Overrides_(peos, plos, mappings, peoSDGMappings, tabCells, references) {
  var scCodes = getResearchReferenceList_(references, 'sc').map(function(ref) { return String(ref.code || '').trim(); });
  var sdgCodes = getResearchReferenceList_(references, 'sdg').map(function(ref) { return String(ref.code || '').trim(); });
  var tfCodes = getResearchReferenceList_(references, 'tf').map(function(ref) { return String(ref.code || '').trim(); });

  var mappingByPloId = {};
  (mappings || []).forEach(function(m) { mappingByPloId[String(m.ploId)] = m; });
  var outMappings = (plos || []).map(function(plo) {
    var code = autoDetailCanonicalCode_(plo.code);
    var mapping = mappingByPloId[String(plo.ploId)];
    var cellSc = (tabCells.scByCode[code] || []).filter(function(c) { return scCodes.indexOf(c) !== -1; });
    var cellTf = (tabCells.tfByCode[code] || []).filter(function(c) { return tfCodes.indexOf(c) !== -1; });
    var scs = cellSc.length ? cellSc : (mapping ? mapping.scIds || [] : []);
    var tfs = cellTf.length ? cellTf : (mapping ? (mapping.tfIds || mapping.derivedTFIds || []) : []);
    return {
      ploId: plo.ploId,
      programmeId: plo.programmeId,
      scIds: scs,
      tfIds: tfs,
      derivedTFIds: tfs,
      derivedLabel: cellSc.length || cellTf.length ? 'Faculty alignment' : (mapping ? mapping.derivedLabel : ''),
      mappingNote: mapping ? mapping.mappingNote : '',
      updatedAt: mapping ? mapping.updatedAt : '',
      updatedBy: mapping ? mapping.updatedBy : ''
    };
  });

  var peoSdgByPeoId = {};
  (peoSDGMappings || []).forEach(function(m) { peoSdgByPeoId[String(m.peoId)] = m; });
  var outPeoSDG = (peos || []).map(function(peo) {
    var code = autoDetailCanonicalCode_(peo.code);
    var mapping = peoSdgByPeoId[String(peo.peoId)];
    var cellSdgs = (tabCells.sdgByCode[code] || []).filter(function(c) { return sdgCodes.indexOf(c) !== -1; });
    var sdgs = cellSdgs.length ? cellSdgs : (mapping ? mapping.sdgIds || [] : []);
    return {
      peoId: peo.peoId,
      programmeId: peo.programmeId,
      sdgIds: sdgs,
      mappingNote: cellSdgs.length ? (mapping && mapping.mappingNote ? mapping.mappingNote : 'Faculty alignment') : (mapping ? mapping.mappingNote : ''),
      updatedAt: mapping ? mapping.updatedAt : '',
      updatedBy: mapping ? mapping.updatedBy : ''
    };
  });

  return {mappings: outMappings, peoSDGMappings: outPeoSDG};
}

/** Writes one value into a detail tab cell located by the record code in column A. */
function autoDetailWriteTabCell_(ss, mqaCode, recordCode, col, value) {
  var sheet = ss.getSheetByName(String(mqaCode || '').trim());
  if (!sheet) return false;
  var values = sheet.getDataRange().getValues();
  var target = autoDetailCanonicalCode_(recordCode);
  for (var r = 0; r < values.length; r++) {
    if (autoDetailCanonicalCode_(values[r][0]) === target) {
      if (String(values[r][col] || '').trim() === value) return true;
      sheet.getRange(r + 1, col + 1, 1, 1).setValues([[value]]);
      return true;
    }
  }
  return false;
}

/** Reads a detail tab's current cell values (PPS default or faculty alignment). */
function autoDetailTabValuesFromSpreadsheet_(ss, mqaCode) {
  var sheet = ss && ss.getSheetByName ? ss.getSheetByName(String(mqaCode || '').trim()) : null;
  return sheet ? sheet.getDataRange().getValues() : [];
}
