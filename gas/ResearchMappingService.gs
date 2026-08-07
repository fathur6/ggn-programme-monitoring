/** ResearchMappingService.gs - programme profile, PEO, and PLO persistence */

var SHARED_MQA_OWNERS_ = {
  'MQA/FA5588':  'PR5001',
  'MQA/FA5589':  'PR6001',
  'MQA/FA5590':  'PP5001',
  'MQA/FA5591':  'PP6001',
  'MQA/FA10523': 'PS6001',
  'MQA/FA7492':  'PE5002',
  'MQA/FA7493':  'PE6002'
};

function sharedMQAOwnerKey_(mqaCode) {
  return SHARED_MQA_OWNERS_[String(mqaCode || '').trim()] || '';
}

function researchEffectiveKey_(key, sheets) {
  var profileRows = researchRows_(sheets.PR_ProgrammeProfile);
  var row = profileRows.filter(function(r) { return String(r[0]).trim() === key; })[0];
  if (!row) return key;
  var sharedFrom = String(row[12] || '').trim();
  return sharedFrom || key;
}

var RESEARCH_TAXONOMY_IDS = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6'
];
var RESEARCH_ROWS_CACHE_ = {};

function serializeResearchDate_(value) {
  if (!value) return '';
  if (typeof value.toISOString === 'function') return value.toISOString();
  return String(value);
}

function canonicalResearchTaxonomy_(value) {
  return String(value == null ? '' : value).trim().toUpperCase();
}

function uniqueTrimmed_(values) {
  var seen = {};
  var result = [];
  (Array.isArray(values) ? values : []).forEach(function(value) {
    var canonical = String(value == null ? '' : value).trim();
    if (canonical && !seen[canonical]) {
      seen[canonical] = true;
      result.push(canonical);
    }
  });
  return result;
}

function deriveTFIds_(mqfDomains, tfReference) {
  var selected = uniqueTrimmed_(mqfDomains || []);
  return Object.keys(tfReference || {}).filter(function(tfId) {
    return (tfReference[tfId] || []).some(function(domain) {
      return selected.indexOf(domain) !== -1;
    });
  }).sort();
}

function normalizeResearchPEO_(input) {
  return {
    code: String(input && input.code || '').trim(),
    statement: String(input && input.statement || '').trim()
  };
}

function normalizeResearchPLO_(input) {
  return {
    code: String(input && input.code || '').trim(),
    statement: String(input && input.statement || '').trim(),
    parentPEO: String(input && input.parentPEO || '').trim(),
    mqfDomains: uniqueTrimmed_(input && input.mqfDomains || []),
    taxonomy: canonicalResearchTaxonomy_(input && input.taxonomy),
    rationale: String(input && input.rationale || '').trim()
  };
}

function validateDuplicateCodes_(records, label) {
  var seen = {};
  (records || []).forEach(function(record) {
    var code = String(record && record.code || '').trim();
    if (code && seen[code]) throw new Error('Duplicate ' + label + ' code: ' + code);
    if (code) seen[code] = true;
  });
}

function validatePLOParents_(plos, peos) {
  var parents = {};
  (peos || []).forEach(function(peo) {
    var code = String(peo && peo.code || '').trim();
    if (code) parents[code] = true;
  });
  (plos || []).forEach(function(plo) {
    var parent = String(plo && plo.parentPEO || '').trim();
    if (!parent || !parents[parent]) throw new Error('Invalid parent PEO: ' + parent);
  });
}

function researchId_() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) return Utilities.getUuid();
  return 'research-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000000);
}

function researchUser_(access) {
  return access && access.user || getCurrentUser_();
}

function researchProgramme_(programmeIdOrMqaCode) {
  var programme = resolveProgramme_(String(programmeIdOrMqaCode || '').trim());
  if (!programme) throw new Error('Programme is not in the programme directory');
  if (!isResearchProgramme_(programme)) throw new Error('Programme is not postgraduate by research');
  return programme;
}

function requireResearchProgramme_(programmeIdOrMqaCode) {
  return researchProgramme_(programmeIdOrMqaCode);
}

function researchContext_(programmeIdOrMqaCode) {
  var programme = researchProgramme_(programmeIdOrMqaCode);
  var key = getResearchProgrammeKey_(programme);
  return {programme: programme, key: key};
}

function withPreparedResearchContext_(programmeIdOrMqaCode, reader) {
  var context = researchContext_(programmeIdOrMqaCode);
  return withResearchLockRetry_(function() {
    RESEARCH_ROWS_CACHE_ = {};
    var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
    RESEARCH_SHEETS_CACHE_ = sheets;
    migrateLegacyResearchRowsNoLock_(context.programme, context.key, sheets);
    seedResearchReferencesNoLock_(sheets);
    ensureProgrammeSDGDefaults_(context.key, context.programme, sheets);
    var effectiveKey = researchEffectiveKey_(context.key, sheets);
    migratePLOSDGToPEO_({programme: context.programme, key: context.key, effectiveKey: effectiveKey, sheets: sheets, access: {}});
    var references = getResearchReferencesNoLock_(sheets);
    RESEARCH_REFERENCES_CACHE_ = references;
    return reader({
      programme: context.programme,
      key: context.key,
      effectiveKey: context.effectiveKey,
      sheets: sheets,
      references: references
    });
  });
}

function tryResearchReadContext_(context) {
  var byTitle = researchSnapshotByTitle_(getSpreadsheet());
  if (!byTitle) return null;
  if (!researchSheetsReadyFromSnapshot_(byTitle)) return null;
  if (!researchReferencesMatchSeeds_(byTitle)) return null;
  if (researchLegacyMigrationPending_(byTitle, context.key, String(context.programme.mqaCode || '').trim())) return null;
  var sheets = researchSheetsFromSnapshot_(byTitle);
  var effectiveKey = researchEffectiveKey_(context.key, sheets);
  var references = getResearchReferencesNoLock_(sheets);
  RESEARCH_REFERENCES_CACHE_ = references;
  return {programme: context.programme, key: context.key, effectiveKey: effectiveKey, sheets: sheets, references: references};
}

function withPreparedResearchReadContext_(programmeIdOrMqaCode, reader) {
  var context = researchContext_(programmeIdOrMqaCode);
  var prepared = tryResearchReadContext_(context);
  if (prepared) return reader(prepared);
  return withPreparedResearchContext_(programmeIdOrMqaCode, reader);
}

function migrateLegacyResearchRowsNoLock_(programme, key, sheets) {
  var legacyKey = String(programme.mqaCode || '').trim();
  if (!legacyKey || legacyKey === key) return;
  var profileRows = researchRows_(sheets.PR_ProgrammeProfile);
  var hasTarget = profileRows.some(function(row) { return String(row[0]).trim() === key; });
  if (hasTarget) return;
  var claimedByOther = profileRows.some(function(row) { var pid = String(row[0]).trim(); return pid !== key && pid !== legacyKey && String(row[1]).trim() === legacyKey; });
  if (claimedByOther) return;
  var ownerKey = sharedMQAOwnerKey_(legacyKey);
  if (ownerKey && ownerKey !== key) {
    var ownerExists = profileRows.some(function(row) { return String(row[0]).trim() === ownerKey; });
    if (ownerExists) {
      var sharedProfile = [key, legacyKey, programme.faculty || '', programme.name || '', programme.level || '',
        'Postgraduate by Research', '', '', '', '', 'Draft', JSON.stringify([]), ownerKey, new Date(), new Date(), ''];
      sheets.PR_ProgrammeProfile.appendRow(sharedProfile);
      RESEARCH_ROWS_CACHE_ = {};
      return;
    }
  }
  var legacyProfile = profileRows.filter(function(row) { return String(row[0]).trim() === legacyKey; })[0];
  var peoRows = researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]).trim() === legacyKey; });
  var ploRows = researchRows_(sheets.PR_PLORecords).filter(function(row) { return String(row[1]).trim() === legacyKey; });
  var mappingRows = researchRows_(sheets.PR_PLOMappings).filter(function(row) { return String(row[1]).trim() === legacyKey; });
  if (!legacyProfile && !peoRows.length && !ploRows.length && !mappingRows.length) return;
  var peoIds = {};
  var ploIds = {};
  var cloneId = function(id) { return key + '::' + String(id || ''); };
  peoRows = peoRows.map(function(row) { var copy = row.slice(); peoIds[String(row[0])] = cloneId(row[0]); copy[0] = peoIds[String(row[0])]; copy[1] = key; return copy; });
  ploRows = ploRows.map(function(row) { var copy = row.slice(); ploIds[String(row[0])] = cloneId(row[0]); copy[0] = ploIds[String(row[0])]; copy[1] = key; return copy; });
  mappingRows = mappingRows.map(function(row) { var copy = row.slice(); copy[0] = ploIds[String(row[0])] || cloneId(row[0]); copy[1] = key; return copy; });
  if (legacyProfile) { var profile = legacyProfile.slice(); profile[0] = key; profile[1] = legacyKey; profile.splice(11, 0, JSON.stringify([])); profile.splice(12, 0, ''); sheets.PR_ProgrammeProfile.appendRow(profile); }
  peoRows.forEach(function(row) { sheets.PR_PEORecords.appendRow(row); });
  ploRows.forEach(function(row) { sheets.PR_PLORecords.appendRow(row); });
  mappingRows.forEach(function(row) { sheets.PR_PLOMappings.appendRow(row); });
  RESEARCH_ROWS_CACHE_ = {};
}

// Compatibility alias for existing migration fixtures; callers in a lock-owned
// boundary must use migrateLegacyResearchRowsNoLock_ directly.
function migrateLegacyResearchRows_(programme, key, sheets) {
  return migrateLegacyResearchRowsNoLock_(programme, key, sheets);
}

function researchRows_(sheet) {
  var cacheKey = typeof sheet.getName === 'function' ? sheet.getName() : '';
  if (cacheKey && RESEARCH_ROWS_CACHE_[cacheKey]) return RESEARCH_ROWS_CACHE_[cacheKey];
  var values = sheet.getDataRange().getValues();
  var rows = values.length > 1 ? values.slice(1) : [];
  if (cacheKey) RESEARCH_ROWS_CACHE_[cacheKey] = rows;
  return rows;
}

function parseResearchJson_(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch (e) { return []; }
}

function canonicalResearchRecordCode_(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeLegacyMQF_(value) {
  var code = String(value || '').trim().replace(/\s+/g, '');
  var match = code.match(/^MQF(\d+)([A-Za-z]?)$/i);
  if (!match) return code;
  return 'MQF' + match[1] + String(match[2] || '').toLowerCase();
}

function readLegacyResearchDetail_(ss, mqaCode) {
  var code = String(mqaCode && mqaCode.mqaCode || mqaCode || '').trim();
  var sheet = ss.getSheetByName(code);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  var section = '';
  var peos = [];
  var plos = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i] || [];
    var marker = String(row[0] || '').trim().toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    var recordCode = String(row[0] || '').trim();
    var compactCode = recordCode.toUpperCase().replace(/\s+/g, '');
    if (!recordCode || !section) continue;
    if (section === 'peo' && /^PEO\d+$/.test(compactCode)) {
      peos.push({
        peoId: code + '::' + recordCode,
        programmeId: code,
        code: compactCode,
        statement: String(row[1] || '').trim(),
        sortOrder: peos.length,
        updatedAt: '',
        updatedBy: ''
      });
    }
    if (section === 'plo' && /^PLO\d+$/.test(compactCode)) {
      var mqf = normalizeLegacyMQF_(row[2]);
      var parentPEO = String(row[3] || '').trim();
      var taxonomy = canonicalResearchTaxonomy_(row[4]);
      var complete = !!(parentPEO && taxonomy);
      plos.push({
        ploId: code + '::' + recordCode,
        programmeId: code,
        parentPEO: parentPEO,
        code: compactCode,
        statement: String(row[1] || '').trim(),
        mqfDomains: mqf ? [mqf] : [],
        taxonomy: taxonomy,
        rationale: '',
        status: complete ? 'Draft' : 'Needs attention',
        updatedAt: '',
        updatedBy: ''
      });
    }
  }
  if (!peos.length && !plos.length) return null;
  return {peos: peos, plos: plos};
}

function legacyResearchMappings_(detail, references) {
  var tfReference = researchTFReferenceMap_(references || {tf: []});
  return (detail && detail.plos || []).map(function(plo) {
    return {
      ploId: plo.ploId,
      programmeId: plo.programmeId,
      sdgIds: [],
      scIds: [],
      derivedTFIds: deriveTFIds_(plo.mqfDomains, tfReference),
      derivedLabel: 'Derived from legacy programme detail tab',
      mappingNote: 'Read from ' + plo.programmeId,
      updatedAt: '',
      updatedBy: ''
    };
  });
}

function replaceResearchRows_(sheet, programmeId, width, rows) {
  var existing = researchRows_(sheet).filter(function(row) {
    return String(row[1] || '').trim() !== programmeId && row[0] !== '';
  });
  var output = existing.concat(rows);
  var oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (output.length > oldRows && sheet.insertRowsAfter) sheet.insertRowsAfter(sheet.getLastRow(), output.length - oldRows);
  if (oldRows > 0) sheet.getRange(2, 1, oldRows, width).clearContent();
  if (output.length > 0) sheet.getRange(2, 1, output.length, width).setValues(output);
  RESEARCH_ROWS_CACHE_ = {};
}

function removeOrphanResearchMappings_(sheet, programmeId, retainedPloIds) {
  var existing = researchRows_(sheet);
  var output = existing.filter(function(row) {
    return String(row[1] || '').trim() !== programmeId || retainedPloIds[String(row[0] || '').trim()];
  });
  var oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (output.length > oldRows && sheet.insertRowsAfter) sheet.insertRowsAfter(sheet.getLastRow(), output.length - oldRows);
  if (oldRows > 0) sheet.getRange(2, 1, oldRows, 7).clearContent();
  if (output.length > 0) sheet.getRange(2, 1, output.length, 7).setValues(output);
  RESEARCH_ROWS_CACHE_ = {};
}

function withResearchLock_(work) {
  return withResearchLockRetry_(work);
}

function profileFromRow_(row) {
  return {
    programmeId: row[0], mqaCode: row[1], facultyOrCentre: row[2], programmeName: row[3],
    studyLevel: row[4], studyMode: row[5], studyField: row[6], session: row[7],
    documentVersion: row[8], dataOwner: row[9], mappingStatus: row[10], defaultSDGIds: parseResearchJson_(row[11]),
    sharedFromProgrammeId: String(row[12] || '').trim(),
    createdAt: serializeResearchDate_(row[13]), updatedAt: serializeResearchDate_(row[14]), updatedBy: row[15]
  };
}

function peoFromRow_(row) {
  return { peoId: row[0], programmeId: row[1], code: row[2], statement: row[3], sortOrder: row[4], updatedAt: serializeResearchDate_(row[5]), updatedBy: row[6] };
}

function ploFromRow_(row) {
  return {
    ploId: row[0], programmeId: row[1], parentPEO: row[2], code: row[3], statement: row[4],
    mqfDomains: parseResearchJson_(row[5]), taxonomy: canonicalResearchTaxonomy_(row[6]), rationale: row[7],
    status: row[8], updatedAt: serializeResearchDate_(row[9]), updatedBy: row[10]
  };
}

function mappingFromRow_(row) {
  var tfIds = parseResearchJson_(row[3]);
  return {
    ploId: row[0], programmeId: row[1],
    scIds: parseResearchJson_(row[2]), tfIds: tfIds, derivedTFIds: tfIds,
    derivedLabel: 'Derived from PLO mappings', mappingNote: row[4],
    updatedAt: serializeResearchDate_(row[5]), updatedBy: row[6]
  };
}

function peoMappingFromRow_(row) {
  return {
    peoId: row[0], programmeId: row[1], sdgIds: parseResearchJson_(row[2]),
    mappingNote: row[3], updatedAt: serializeResearchDate_(row[4]), updatedBy: row[5]
  };
}

function calculatePEOCoverage_(mappings, parentPEO) {
  var children = (mappings || []).filter(function(mapping) {
    return canonicalResearchRecordCode_(mapping && mapping.parentPEO) === canonicalResearchRecordCode_(parentPEO);
  });
  if (!children.length) throw new Error('No child PLO mappings for PEO: ' + parentPEO);
  return {
    tfIds: uniqueTrimmed_(children.reduce(function(all, mapping) { return all.concat(mapping.derivedTFIds || []); }, [])).sort(),
    sdgIds: uniqueTrimmed_(children.reduce(function(all, mapping) { return all.concat(mapping.sdgIds || []); }, [])).sort(),
    scIds: uniqueTrimmed_(children.reduce(function(all, mapping) { return all.concat(mapping.scIds || []); }, [])).sort(),
    childCount: children.length,
    derivedLabel: 'Derived from PLO mappings'
  };
}

function researchTFReferenceMap_(references) {
  return getResearchReferenceList_(references, 'tf').reduce(function(result, reference) {
    result[reference.code] = reference.mqfDomains || [];
    return result;
  }, {});
}

function researchMappingForPLO_(plo, mapping, references) {
  var tfIds = Array.isArray(mapping.tfIds) ? mapping.tfIds : (mapping.derivedTFIds || []);
  return {
    ploId: plo.ploId, programmeId: plo.programmeId, parentPEO: plo.parentPEO,
    code: plo.code, mqfDomains: plo.mqfDomains,
    scIds: mapping.scIds, tfIds: tfIds, derivedTFIds: tfIds, derivedLabel: 'Selected TF mapping',
    mappingNote: mapping.mappingNote, updatedAt: mapping.updatedAt, updatedBy: mapping.updatedBy
  };
}

function freshResearchMappings_(sheet, rows, ploById, references, rowIndexes) {
  var tfReference = researchTFReferenceMap_(references);
  return rows.map(function(row, index) {
    var mapping = mappingFromRow_(row);
    var plo = ploById[mapping.ploId];
    var derivedTFIds = deriveTFIds_(plo ? plo.mqfDomains : [], tfReference);
    var storedTFIds = parseResearchJson_(row[3]).filter(function(tfId) { return derivedTFIds.indexOf(tfId) !== -1; });
    var selectedTFIds = storedTFIds.length ? [storedTFIds[0]] : [];
    if (JSON.stringify(storedTFIds) !== JSON.stringify(selectedTFIds)) {
      row[3] = JSON.stringify(selectedTFIds);
      sheet.getRange((rowIndexes ? rowIndexes[index] : index) + 2, 1, 1, 7).setValues([row]);
      RESEARCH_ROWS_CACHE_ = {};
    }
    mapping.tfIds = selectedTFIds;
    mapping.derivedTFIds = selectedTFIds;
    return mapping;
  });
}

/** Pure aggregate-read equivalent of freshResearchMappings_. */
function researchMappingsFromRows_(rows, plos, references) {
  var ploById = (plos || []).reduce(function(result, plo) {
    result[plo.ploId] = plo;
    return result;
  }, {});
  var tfReference = researchTFReferenceMap_(references);
  return (rows || []).map(function(row) {
    var mapping = mappingFromRow_(row);
    var plo = ploById[mapping.ploId];
    var derivedTFIds = deriveTFIds_(plo ? plo.mqfDomains : [], tfReference);
    var storedTFIds = (mapping.tfIds || []).filter(function(tfId) {
      return derivedTFIds.indexOf(tfId) !== -1;
    });
    var selectedTFIds = storedTFIds.length ? [storedTFIds[0]] : [];
    mapping.tfIds = selectedTFIds;
    mapping.derivedTFIds = selectedTFIds;
    return mapping;
  });
}

function getResearchProgrammeApi_(programmeIdOrMqaCode) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'view-programme');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var row = researchRows_(context.sheets.PR_ProgrammeProfile).filter(function(item) { return String(item[0]) === context.key; })[0];
    if (row) return profileFromRow_(row);
    var programme = context.programme;
    return {
      programmeId: context.key, mqaCode: programme.mqaCode, facultyOrCentre: programme.faculty || programme.facultyFull || '',
      programmeName: programme.name || '', studyLevel: programme.level || '', studyMode: 'Postgraduate by Research', studyField: '',
      session: '', documentVersion: '', dataOwner: '', mappingStatus: 'Draft', defaultSDGIds: [],
      createdAt: '', updatedAt: '',
      updatedBy: researchUser_(access).email || ''
    };
  });
}

function saveResearchProfileApi_(programmeIdOrMqaCode, profile) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-programme');
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    var key = context.key;
    var programme = context.programme;
    var user = researchUser_(access);
    var sheet = context.sheets.PR_ProgrammeProfile;
    var now = new Date();
    var existing = researchRows_(sheet).filter(function(row) { return String(row[0]) === key; })[0];
     var row = [key, programme.mqaCode, programme.faculty || programme.facultyFull || '', programme.name || '', programme.level || '',
      'Postgraduate by Research', existing ? existing[6] : String(profile.studyField || '').trim(), existing ? existing[7] : String(profile.session || '').trim(),
      existing ? existing[8] : String(profile.documentVersion || '').trim(), existing ? existing[9] : String(profile.dataOwner || '').trim(),
      'Draft', existing ? existing[11] || '' : JSON.stringify([]),
      existing && existing[12] || now,
      now, user.email || ''];
    replaceResearchRows_(sheet, key, 15, [row]);
    return profileFromRow_(row);
  });
}

function touchResearchProfile_(key, user, now, preparedSheets) {
  var sheet = (preparedSheets || ensureResearchSheets_()).PR_ProgrammeProfile;
  var rows = researchRows_(sheet);
  var index = rows.findIndex(function(row) { return String(row[0]) === key; });
  if (index === -1) {
    var programme = researchProgramme_(key);
     var row = [key, programme.mqaCode, programme.faculty || programme.facultyFull || '', programme.name || '', programme.level || '',
      'Postgraduate by Research', '', '', '', '', 'Draft', JSON.stringify([]), now, now, user.email || ''];
    sheet.appendRow(row);
    RESEARCH_ROWS_CACHE_ = {};
    return profileFromRow_(row);
  }
  var row = rows[index].slice();
  row[13] = now;
  row[14] = user.email || '';
  sheet.getRange(index + 2, 14, 1, 2).setValues([[now, user.email || '']]);
  RESEARCH_ROWS_CACHE_ = {};
  return profileFromRow_(row);
}

function getResearchPEOsApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-peos');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var peos = researchRows_(context.sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(peoFromRow_);
    if (peos.length) return peos;
    var legacy = readLegacyResearchDetail_(getSpreadsheet(), context.programme.mqaCode);
    return legacy ? legacy.peos : [];
  });
}

function saveResearchPEOsApi_(programmeIdOrMqaCode, peos) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-peos');
  var normalized = (Array.isArray(peos) ? peos : []).map(normalizeResearchPEO_);
  normalized.forEach(function(peo) { if (!peo.code || !peo.statement) throw new Error('PEO code and statement are required'); });
  validateDuplicateCodes_(normalized, 'PEO');
  var user = researchUser_(access);
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    if (context.effectiveKey !== context.key) throw new Error('PEOs are owned by ' + context.effectiveKey + ' — edit from that programme');
    var now = new Date();
    var rows = normalized.map(function(peo, index) { return [researchId_(), context.key, peo.code, peo.statement, index, now, user.email || '']; });
    replaceResearchRows_(context.sheets.PR_PEORecords, context.key, 7, rows);
    touchResearchProfile_(context.key, user, now, context.sheets);
    return rows.map(peoFromRow_);
  });
}

function saveResearchPLOsApi_(programmeIdOrMqaCode, plos) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-plos');
  var normalized = (Array.isArray(plos) ? plos : []).map(normalizeResearchPLO_);
  normalized.forEach(function(plo) {
    if (!plo.code || !plo.statement) throw new Error('PLO code and statement are required');
    if (plo.taxonomy && RESEARCH_TAXONOMY_IDS.indexOf(plo.taxonomy.toUpperCase()) === -1) throw new Error('Invalid Taxonomy reference: ' + plo.taxonomy);
  });
  validateDuplicateCodes_(normalized, 'PLO');
  var user = researchUser_(access);
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    if (context.effectiveKey !== context.key) throw new Error('PLOs are owned by ' + context.effectiveKey + ' — edit from that programme');
    var peos = researchRows_(context.sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(function(row) { return {code: row[2]}; });
    var peoByCode = peos.reduce(function(result, peo) {
      result[String(peo && peo.code || '').trim()] = true;
      return result;
    }, {});
    normalized.forEach(function(plo) {
      if (plo.parentPEO && !peoByCode[plo.parentPEO]) throw new Error('Invalid parent PEO: ' + plo.parentPEO);
    });
    var mqfIds = getResearchReferenceList_(context.references, 'mqf').map(function(reference) { return reference.code; });
    normalized.forEach(function(plo) { plo.mqfDomains = validateReferenceIds_(plo.mqfDomains, mqfIds); });
    var now = new Date();
    var existingByCode = researchRows_(context.sheets.PR_PLORecords).filter(function(row) {
      return String(row[1]) === context.key;
    }).reduce(function(result, row) {
      result[String(row[3]).trim()] = row;
      return result;
    }, {});
    var rows = normalized.map(function(plo) {
      var existing = existingByCode[plo.code];
      return [existing ? existing[0] : researchId_(), context.key, plo.parentPEO, plo.code, plo.statement,
        JSON.stringify(plo.mqfDomains), plo.taxonomy, plo.rationale, 'Draft', now, user.email || ''];
    });
    replaceResearchRows_(context.sheets.PR_PLORecords, context.key, 11, rows);
    var retainedPloIds = rows.reduce(function(result, row) { result[String(row[0])] = true; return result; }, {});
    removeOrphanResearchMappings_(context.sheets.PR_PLOMappings, context.key, retainedPloIds);
    touchResearchProfile_(context.key, user, now, context.sheets);
    return rows.map(ploFromRow_);
  });
}

function getResearchPLOsApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-plos');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var plos = researchRows_(context.sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(ploFromRow_);
    if (plos.length) return plos;
    var legacy = readLegacyResearchDetail_(getSpreadsheet(), context.programme.mqaCode);
    return legacy ? legacy.plos : [];
  });
}

function getResearchMappingsApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-mappings');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var plos = researchRows_(context.sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(ploFromRow_);
    var references = context.references;
    if (!plos.length) {
      var legacy = readLegacyResearchDetail_(getSpreadsheet(), context.programme.mqaCode);
      return legacy ? legacyResearchMappings_(legacy, references) : [];
    }
    var rows = researchRows_(context.sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === context.effectiveKey; });
    return researchMappingsFromRows_(rows, plos, references);
  });
}

function saveResearchPLOMappingApi_(programmeIdOrMqaCode, ploId, mapping) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-mappings');
  var user = researchUser_(access);
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    if (context.effectiveKey !== context.key) throw new Error('Mappings are owned by ' + context.effectiveKey + ' — edit from that programme');
    var ploRow = researchRows_(context.sheets.PR_PLORecords).filter(function(row) {
      return String(row[0]) === String(ploId) && String(row[1]) === context.effectiveKey;
    })[0];
    if (!ploRow) throw new Error('PLO is not part of the programme');
    var references = context.references;
    var scIds = validateReferenceIds_(mapping && mapping.scIds, getResearchReferenceList_(references, 'sc').map(function(reference) { return reference.code; }));
    var derivedTFIds = deriveTFIds_(parseResearchJson_(ploRow[5]), researchTFReferenceMap_(references));
    var tfIds = validateReferenceIds_(mapping && (mapping.tfIds || mapping.derivedTFIds), derivedTFIds);
    if (scIds.length > 1 || tfIds.length > 1) throw new Error('Select only one TF and one SC per PLO');
    var now = new Date();
    var row = [String(ploRow[0]), context.key, JSON.stringify(scIds),
      JSON.stringify(tfIds),
      String(mapping && mapping.mappingNote || '').trim(), now, user.email || ''];
    var sheet = context.sheets.PR_PLOMappings;
    var rows = researchRows_(sheet);
    var index = rows.findIndex(function(existing) { return String(existing[0]) === String(ploId) && String(existing[1]) === context.key; });
    if (index === -1) sheet.appendRow(row); else sheet.getRange(index + 2, 1, 1, 7).setValues([row]);
    RESEARCH_ROWS_CACHE_ = {};
    return mappingFromRow_(row);
  });
}

function getPEOMappingsApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-mappings');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var rows = researchRows_(context.sheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === context.effectiveKey || String(row[1]) === context.key; });
    return rows.map(peoMappingFromRow_);
  });
}

function savePEOMappingApi_(programmeIdOrMqaCode, peoId, mapping) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-mappings');
  var user = researchUser_(access);
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    if (context.effectiveKey !== context.key) throw new Error('Mappings are owned by ' + context.effectiveKey + ' — edit from that programme');
    var peoRow = researchRows_(context.sheets.PR_PEORecords).filter(function(row) {
      return String(row[0]) === String(peoId) && String(row[1]) === context.effectiveKey;
    })[0];
    if (!peoRow) throw new Error('PEO is not part of the programme');
    var references = context.references;
    var sdgIds = validateReferenceIds_(mapping && mapping.sdgIds, getResearchReferenceList_(references, 'sdg').map(function(reference) { return reference.code; }));
    var now = new Date();
    var row = [String(peoRow[0]), context.key, JSON.stringify(sdgIds),
      String(mapping && mapping.mappingNote || '').trim(), now, user.email || ''];
    var sheet = context.sheets.PR_PEOMappings;
    var rows = researchRows_(sheet);
    var index = rows.findIndex(function(existing) { return String(existing[0]) === String(peoId) && String(existing[1]) === context.key; });
    if (index === -1) sheet.appendRow(row); else sheet.getRange(index + 2, 1, 1, 6).setValues([row]);
    RESEARCH_ROWS_CACHE_ = {};
    return peoMappingFromRow_(row);
  });
}

function migratePLOSDGToPEO_(context) {
  var ploRows = researchRows_(context.sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; });
  var hasPlos = ploRows.length > 0;
  var ploMappings = researchRows_(context.sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === context.effectiveKey; });
  var peoMappings = researchRows_(context.sheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === context.effectiveKey; });
  var hasPEOsWithExisting = peoMappings.length > 0;
  var ploMappingsStillHaveSDG = ploMappings.length > 0 && ploMappings.some(function(row) { return String(row[2] || '').trim(); });
  if (hasPEOsWithExisting && !ploMappingsStillHaveSDG) return false;

  var peoSDGs = {};
  ploRows.forEach(function(plo) {
    var peoCode = String(plo[2] || '').trim();
    if (!peoCode) return;
    if (!peoSDGs[peoCode]) peoSDGs[peoCode] = {peoId: String(plo[0]), sdgs: {}};
  });

  ploMappings.forEach(function(mapping) {
    var ploId = String(mapping[0]);
    var plo = ploRows.filter(function(r) { return String(r[0]) === ploId; })[0];
    if (!plo) return;
    var peoCode = String(plo[2] || '').trim();
    if (!peoCode || !peoSDGs[peoCode]) return;
    var sdgs;
    try { sdgs = JSON.parse(mapping[2] || '[]'); } catch (e) { sdgs = []; }
    if (!Array.isArray(sdgs)) return;
    sdgs.forEach(function(sdg) {
      if (sdg) peoSDGs[peoCode].sdgs[String(sdg)] = true;
    });
  });

  var now = new Date();
  var user = (context.access && context.access.user || (typeof getCurrentUser_ === 'function' ? getCurrentUser_() : null) || {email: ''});
  Object.keys(peoSDGs).forEach(function(peoCode) {
    var entry = peoSDGs[peoCode];
    var sdgList = Object.keys(entry.sdgs).sort();
    if (!sdgList.length) return;
    var existing = peoMappings.filter(function(r) { return String(r[0]) === entry.peoId; })[0];
    if (existing) {
      context.sheets.PR_PEOMappings.getRange(peoMappings.indexOf(existing) + 2, 3, 1, 1).setValues([[JSON.stringify(sdgList)]]);
    } else {
      context.sheets.PR_PEOMappings.appendRow([entry.peoId, context.key, JSON.stringify(sdgList), 'Migrated from PLO SDGs', now, user.email || '']);
    }
  });

  if (ploMappingsStillHaveSDG) {
    var ploRows = researchRows_(context.sheets.PR_PLOMappings);
    ploMappings.forEach(function(mapping) {
      var index = ploRows.indexOf(mapping);
      if (index !== -1 && String(mapping[2] || '').trim()) {
        mapping[2] = '';
        context.sheets.PR_PLOMappings.getRange(index + 2, 3, 1, 1).setValues([['']]);
      }
    });
  }

  RESEARCH_ROWS_CACHE_ = {};
  return true;
}

function getResearchCoverageApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-mappings');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var plos = researchRows_(context.sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(ploFromRow_);
    var peos = researchRows_(context.sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === context.effectiveKey; }).map(peoFromRow_);
    var references = context.references;
    if (!plos.length || !peos.length) {
      var legacy = readLegacyResearchDetail_(getSpreadsheet(), context.programme.mqaCode);
      if (legacy) {
        if (!plos.length) plos = legacy.plos;
        if (!peos.length) peos = legacy.peos;
        var legacyMappings = legacyResearchMappings_(legacy, references);
        var legacyMapped = plos.map(function(plo) {
          return researchMappingForPLO_(plo, legacyMappings.filter(function(mapping) { return mapping.ploId === plo.ploId; })[0] || {scIds: [], derivedTFIds: []}, references);
        });
        return {
          peoCoverage: peos.map(function(peo) {
            try { return {peoId: peo.peoId, code: peo.code, coverage: calculatePEOCoverage_(legacyMapped, peo.code)}; }
            catch (e) { return {peoId: peo.peoId, code: peo.code, issue: e.message}; }
          }),
          globalCoverage: {
            mqfIds: uniqueTrimmed_(plos.reduce(function(all, plo) { return all.concat(plo.mqfDomains); }, [])).sort(),
            tfIds: uniqueTrimmed_(legacyMapped.reduce(function(all, mapping) { return all.concat(mapping.derivedTFIds); }, [])).sort(),
            sdgIds: [], scIds: []
          },
          ploReadiness: plos.map(function(plo) { return {ploId: plo.ploId, code: plo.code, ready: true, issue: ''}; })
        };
      }
    }
    var mappingRows = researchRows_(context.sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === context.key; });
    var mappings = researchMappingsFromRows_(mappingRows, plos, references);
    var mappingByPlo = mappings.reduce(function(result, mapping) { result[mapping.ploId] = mapping; return result; }, {});
    var mapped = plos.map(function(plo) {
      return researchMappingForPLO_(plo, mappingByPlo[plo.ploId] || {scIds: [], derivedTFIds: []}, references);
    });
    var peoMappingRows = researchRows_(context.sheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === context.effectiveKey || String(row[1]) === context.key; });
    var peoSdgIds = peoMappingRows.reduce(function(all, row) {
      var sdgs; try { sdgs = JSON.parse(row[2] || '[]'); } catch (e) { sdgs = []; }
      if (Array.isArray(sdgs)) return all.concat(sdgs);
      return all;
    }, []);
    var global = {
      mqfIds: uniqueTrimmed_(plos.reduce(function(all, plo) { return all.concat(plo.mqfDomains); }, [])).sort(),
      tfIds: uniqueTrimmed_(mapped.reduce(function(all, mapping) { return all.concat(mapping.derivedTFIds); }, [])).sort(),
      sdgIds: uniqueTrimmed_(peoSdgIds).sort(),
      scIds: uniqueTrimmed_(mapped.reduce(function(all, mapping) { return all.concat(mapping.scIds); }, [])).sort()
    };
    return {
      peoCoverage: peos.map(function(peo) {
        try { return {peoId: peo.peoId, code: peo.code, coverage: calculatePEOCoverage_(mapped, peo.code)}; }
        catch (e) { return {peoId: peo.peoId, code: peo.code, issue: e.message}; }
      }),
      globalCoverage: global,
      ploReadiness: plos.map(function(plo) {
        var mapping = mappingByPlo[plo.ploId];
        return {ploId: plo.ploId, code: plo.code, ready: !!mapping, issue: mapping ? '' : 'PLO mapping is required'};
      })
    };
  });
}
