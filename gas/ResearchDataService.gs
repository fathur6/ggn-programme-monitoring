/** ResearchDataService.gs — Additive postgraduate research data boundaries. */

var RESEARCH_SHEET_HEADERS = {
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_MQFReference: ['Code', 'Title', 'Description', 'Active'],
  PR_TFReference: ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
  PR_SDGReference: ['Code', 'Title', 'Description', 'Active'],
  PR_SCReference: ['Code', 'Title', 'Description', 'Active']
};

var RESEARCH_SHEETS_CACHE_ = null;

var RESEARCH_WORKSPACE_DATA_SHEETS = [
  'PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings'
];

function ensureResearchSheets_() {
  // LockService.getScriptLock() is owned by withResearchLockRetry_ so setup
  // and its bounded retry policy remain centralized.
  if (RESEARCH_SHEETS_CACHE_) return RESEARCH_SHEETS_CACHE_;
  var ss = getSpreadsheet();
  var result = withResearchLockRetry_(function() {
    return ensureResearchSheetsNoLock_(ss);
  });
  RESEARCH_SHEETS_CACHE_ = result;
  return result;
}

function ensureResearchSheetsNoLock_(ss) {
  var result = {};
  Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(RESEARCH_SHEET_HEADERS[name]);
    result[name] = sheet;
  });
  return result;
}

/**
 * Captures the mutable workspace rows while the prepared context owns the
 * script lock. The returned arrays are detached from the fake/Apps Script
 * sheet values so later projection cannot accidentally write through them.
 */
function researchWorkspaceRowsSnapshotNoLock_(sheets) {
  return RESEARCH_WORKSPACE_DATA_SHEETS.reduce(function(result, name) {
    var values = sheets[name].getDataRange().getValues();
    result[name] = values.length > 1 ? values.slice(1).map(function(row) { return row.slice(); }) : [];
    return result;
  }, {});
}

function getResearchProgrammeKey_(programme) {
  var programmeId = String(programme && programme.programmeId || '').trim();
  var mqaCode = String(programme && programme.mqaCode || '').trim();
  var key = programmeId || mqaCode;
  if (!key) throw new Error('Programme ID is required');
  return key;
}
