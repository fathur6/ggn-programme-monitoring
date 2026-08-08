/** ResearchDataService.gs — Additive postgraduate research data boundaries. */

var RESEARCH_SHEET_HEADERS = {
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'DefaultSDGIdsJson', 'SharedFromProgrammeId', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_PEOMappings: ['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_MQFReference: ['Code', 'Title', 'Description', 'Active'],
  PR_TFReference: ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
  PR_SDGReference: ['Code', 'Title', 'Description', 'Active'],
  PR_SCReference: ['Code', 'Title', 'Description', 'Active']
};

var RESEARCH_SHEETS_CACHE_ = null;

var RESEARCH_WORKSPACE_DATA_SHEETS = [
  'PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings', 'PR_PEOMappings'
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

/**
 * Lock-free read snapshot support. A read-only request can be served from a
 * single capture of all sheets when every owned sheet exists, is seeded, and
 * needs no legacy migration; only then is the script lock unnecessary. The
 * snapshot shims expose only getName()/getDataRange() so write endpoints can
 * never be routed through them.
 */
function researchSnapshotByTitle_(ss) {
  ss = ss || getSpreadsheet();
  if (!ss) return null;
  var byTitle = {};
  // Prefer the single-call getSheetsData() capture when the runtime exposes it.
  if (typeof ss.getSheetsData === 'function') {
    var all;
    try { all = ss.getSheetsData(); } catch (e) { all = null; }
    if (all && all.length) {
      for (var i = 0; i < all.length; i++) {
        if (all[i] && all[i].title) byTitle[all[i].title] = all[i].data || [];
      }
      return byTitle;
    }
  }
  // Fallback: build the same title->values map from getSheets() so the
  // snapshot (and therefore the tab-cell phase-2 reads) works in every
  // runtime. This is still a single lock-free pass.
  if (typeof ss.getSheets === 'function') {
    try {
      var sheets = ss.getSheets();
      for (var j = 0; j < sheets.length; j++) {
        var sheet = sheets[j];
        if (!sheet || typeof sheet.getSheetName !== 'function') continue;
        var title = sheet.getSheetName();
        if (!title || typeof sheet.getDataRange !== 'function') continue;
        var data;
        try { data = sheet.getDataRange().getValues(); } catch (e2) { continue; }
        byTitle[title] = data;
      }
      return byTitle;
    } catch (e) { return null; }
  }
  return null;
}

function researchSheetShim_(title, values) {
  var rows = values || [];
  return {
    // getName() returns empty so the shared researchRows_/assessmentRows_
    // row caches are never populated from a lock-free snapshot; a later
    // locked write in the same server instance must always re-read live rows.
    getName: function() { return ''; },
    getDataRange: function() { return {getValues: function() { return rows.map(function(row) { return row.slice(); }); }}; }
  };
}

function researchSheetsReadyFromSnapshot_(byTitle) {
  var names = Object.keys(RESEARCH_SHEET_HEADERS);
  for (var i = 0; i < names.length; i++) {
    var data = byTitle[names[i]];
    if (!data || !data.length) return false;
    if (String(data[0][0] || '').trim() !== RESEARCH_SHEET_HEADERS[names[i]][0]) return false;
  }
  return true;
}

function researchLegacyMigrationPending_(byTitle, key, legacyKey) {
  key = String(key || '').trim();
  legacyKey = String(legacyKey || '').trim();
  if (!legacyKey || legacyKey === key) return false;
  var profile = byTitle['PR_ProgrammeProfile'] || [];
  for (var i = 1; i < profile.length; i++) {
    if (String(profile[i][0] || '').trim() === key) return false;
  }
  var names = ['PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings'];
  for (var n = 0; n < names.length; n++) {
    var rows = byTitle[names[n]] || [];
    var column = names[n] === 'PR_ProgrammeProfile' ? 0 : 1;
    for (var r = 1; r < rows.length; r++) {
      if (String(rows[r][column] || '').trim() === legacyKey) return true;
    }
  }
  return false;
}

function researchSheetsFromSnapshot_(byTitle) {
  var result = {};
  Object.keys(RESEARCH_SHEET_HEADERS).forEach(function(name) {
    result[name] = researchSheetShim_(name, byTitle[name] || []);
  });
  return result;
}
