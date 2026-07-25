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

function ensureResearchSheets_() {
  var ss = getSpreadsheet();
  if (RESEARCH_SHEETS_CACHE_) return RESEARCH_SHEETS_CACHE_;
  var result = {};
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }
  try {
    Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
      var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      if (sheet.getLastRow() === 0) sheet.appendRow(RESEARCH_SHEET_HEADERS[name]);
      result[name] = sheet;
    });
  } finally {
    lock.releaseLock();
  }
  RESEARCH_SHEETS_CACHE_ = result;
  return result;
}

function getResearchProgrammeKey_(programme) {
  var programmeId = String(programme && programme.programmeId || '').trim();
  var mqaCode = String(programme && programme.mqaCode || '').trim();
  var key = programmeId || mqaCode;
  if (!key) throw new Error('Programme ID is required');
  return key;
}
