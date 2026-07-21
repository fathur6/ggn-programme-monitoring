/** ResearchDataService.gs — Postgraduate research Sheet boundaries */

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

function ensureResearchSheets_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Unable to initialize research sheets');
  try {
    var ss = getSpreadsheet();
    var result = {};
    Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
      var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      if (sheet.getLastRow() === 0) sheet.appendRow(RESEARCH_SHEET_HEADERS[name]);
      result[name] = sheet;
    });
    if (typeof seedResearchReferenceSheets_ === 'function') seedResearchReferenceSheets_(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function getResearchProgrammeKey_(programme) {
  var mqaCode = String(programme && programme.mqaCode || '').trim();
  if (!mqaCode) throw new Error('Programme MQA code is required');
  var directoryProgramme = findProgrammeByMqaCode_(mqaCode);
  if (!directoryProgramme) throw new Error('Programme is not in the programme directory');
  return String(directoryProgramme.mqaCode).trim();
}
