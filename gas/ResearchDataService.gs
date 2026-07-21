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
  var ss = getSpreadsheet();
  var result = {};
  Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(RESEARCH_SHEET_HEADERS[name]);
    result[name] = sheet;
  });
  return result;
}

function getResearchProgrammeKey_(programme) {
  var key = String(programme && (programme.programmeId || programme.mqaCode) || '').trim();
  if (!key) throw new Error('Programme ID is required');
  return key;
}
