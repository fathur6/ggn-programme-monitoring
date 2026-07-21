/** ResearchMappingService.gs - programme profile, PEO, and PLO persistence */

var RESEARCH_TAXONOMY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

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
  return access && access.user || getCurrentUser();
}

function researchProgramme_(mqaCode) {
  var programme = findProgrammeByMqaCode_(String(mqaCode || '').trim());
  if (!programme) throw new Error('Programme is not in the programme directory');
  return programme;
}

function researchRows_(sheet) {
  var values = sheet.getDataRange().getValues();
  return values.length > 1 ? values.slice(1) : [];
}

function parseResearchJson_(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch (e) { return []; }
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
}

function withResearchLock_(work) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('System is busy. Please try again.');
  }
  try { return work(); } finally { lock.releaseLock(); }
}

function profileFromRow_(row) {
  return {
    programmeId: row[0], mqaCode: row[1], facultyOrCentre: row[2], programmeName: row[3],
    studyLevel: row[4], studyMode: row[5], studyField: row[6], session: row[7],
    documentVersion: row[8], dataOwner: row[9], mappingStatus: row[10],
    createdAt: serializeResearchDate_(row[11]), updatedAt: serializeResearchDate_(row[12]), updatedBy: row[13]
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
  return {
    ploId: row[0], programmeId: row[1], sdgIds: parseResearchJson_(row[2]),
    scIds: parseResearchJson_(row[3]), derivedTFIds: parseResearchJson_(row[4]),
    mappingNote: row[5], updatedAt: serializeResearchDate_(row[6]), updatedBy: row[7]
  };
}

function getResearchProgrammeApi_(mqaCode) {
  var access = requireProgrammeAccess_(mqaCode, 'view-programme');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var row = researchRows_(ensureResearchSheets_().PR_ProgrammeProfile).filter(function(item) { return String(item[0]) === key; })[0];
  if (row) return profileFromRow_(row);
  var programme = researchProgramme_(key);
  return {
    programmeId: key, mqaCode: key, facultyOrCentre: programme.faculty || programme.facultyFull || '',
    programmeName: programme.name || '', studyLevel: programme.level || '', studyMode: '', studyField: '',
    session: '', documentVersion: '', dataOwner: '', mappingStatus: 'Draft', createdAt: '', updatedAt: '',
    updatedBy: researchUser_(access).email || ''
  };
}

function saveResearchProfileApi_(mqaCode, profile) {
  var access = requireProgrammeAccess_(mqaCode, 'edit-programme');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var programme = researchProgramme_(key);
  var user = researchUser_(access);
  return withResearchLock_(function() {
    var sheet = ensureResearchSheets_().PR_ProgrammeProfile;
    var now = new Date();
    var existing = researchRows_(sheet).filter(function(row) { return String(row[0]) === key; })[0];
    var row = [key, key, programme.faculty || programme.facultyFull || '', programme.name || '', programme.level || '',
      String(profile.studyMode || '').trim(), String(profile.studyField || '').trim(), String(profile.session || '').trim(),
      String(profile.documentVersion || '').trim(), String(profile.dataOwner || '').trim(),
      'Draft', existing && existing[11] || now,
      now, user.email || ''];
    replaceResearchRows_(sheet, key, 14, [row]);
    return profileFromRow_(row);
  });
}

function getResearchPEOsApi_(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-peos');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  return researchRows_(ensureResearchSheets_().PR_PEORecords).filter(function(row) { return String(row[1]) === key; }).map(peoFromRow_);
}

function saveResearchPEOsApi_(mqaCode, peos) {
  var access = requireProgrammeAccess_(mqaCode, 'edit-peos');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var normalized = (Array.isArray(peos) ? peos : []).map(normalizeResearchPEO_);
  normalized.forEach(function(peo) { if (!peo.code || !peo.statement) throw new Error('PEO code and statement are required'); });
  validateDuplicateCodes_(normalized, 'PEO');
  var user = researchUser_(access);
  return withResearchLock_(function() {
    var now = new Date();
    var rows = normalized.map(function(peo, index) { return [researchId_(), key, peo.code, peo.statement, index, now, user.email || '']; });
    replaceResearchRows_(ensureResearchSheets_().PR_PEORecords, key, 7, rows);
    return rows.map(peoFromRow_);
  });
}

function saveResearchPLOsApi_(mqaCode, plos) {
  var access = requireProgrammeAccess_(mqaCode, 'edit-plos');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var normalized = (Array.isArray(plos) ? plos : []).map(normalizeResearchPLO_);
  normalized.forEach(function(plo) {
    if (!plo.code || !plo.statement) throw new Error('PLO code and statement are required');
    if (plo.taxonomy && RESEARCH_TAXONOMY_IDS.indexOf(plo.taxonomy.toUpperCase()) === -1) throw new Error('Invalid Taxonomy reference: ' + plo.taxonomy);
  });
  validateDuplicateCodes_(normalized, 'PLO');
  var sheets = ensureResearchSheets_();
  var peos = researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; }).map(function(row) { return {code: row[2]}; });
  validatePLOParents_(normalized, peos);
  var references = getResearchReferences_();
  var mqfIds = references.mqf.map(function(reference) { return reference.code; });
  normalized.forEach(function(plo) { plo.mqfDomains = validateReferenceIds_(plo.mqfDomains, mqfIds); });
  var user = researchUser_(access);
  return withResearchLock_(function() {
    var now = new Date();
    var rows = normalized.map(function(plo) {
      return [researchId_(), key, plo.parentPEO, plo.code, plo.statement, JSON.stringify(plo.mqfDomains), plo.taxonomy, plo.rationale, 'Draft', now, user.email || ''];
    });
    replaceResearchRows_(sheets.PR_PLORecords, key, 11, rows);
    return rows.map(ploFromRow_);
  });
}

function getResearchPLOsApi_(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-plos');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  return researchRows_(ensureResearchSheets_().PR_PLORecords).filter(function(row) { return String(row[1]) === key; }).map(ploFromRow_);
}

function getResearchMappingsApi_(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-mappings');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  return researchRows_(ensureResearchSheets_().PR_PLOMappings).filter(function(row) { return String(row[1]) === key; }).map(mappingFromRow_);
}
