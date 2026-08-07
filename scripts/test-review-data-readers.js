const assert = require('assert');
const fs = require('fs');

function extractFunction(name, source) {
  var re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  var start = source.search(re);
  if (start === -1) throw new Error('Function ' + name + ' not found in source');
  var depth = 0, i = start;
  while (i < source.length) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(start, i + 1);
}

const dataSource = fs.readFileSync('gas/ResearchDataService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const mappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');
const reviewSource = fs.readFileSync('gas/ResearchReviewService.gs', 'utf8');

function FakeSheet(name, rows) {
  this.name = name;
  this.rows = rows || [];
  this.getLastRow = function() { return this.rows.length; };
  this.appendRow = function(row) { this.rows.push(row.slice()); };
  this.getDataRange = function() { return {getValues: function() { return this.rows.map(function(r) { return r.slice(); }, this); }.bind(this)}; };
}

var ownerKey = 'FUHA::PS6001::MQA/FA10523';
var inheritorKey = 'FSSG::PS6001::MQA/FA10523';
var mqaCode = 'MQA/FA10523';

var ownerProfile = [ownerKey, mqaCode, 'FUHA', 'Doctorate', 'Doctorate', 'Research', '', '', '', '', 'Draft', '[]', '', '', '', ''];
var inheritorProfile = [inheritorKey, mqaCode, 'FSSG', 'Doctorate', 'Doctorate', 'Research', '', '', '', '', 'Draft', '[]', ownerKey, '', '', ''];
var ownerPEO = [ownerKey + '::P1', ownerKey, 'PEO1', 'Objective', 0, '', ''];
var ownerPLO = [ownerKey + '::L1', ownerKey, 'PEO1', 'PLO1', 'Outcome', '["MQF2"]', 'C5', '', 'Draft', '', ''];
var ownerMapping = [ownerKey + '::L1', ownerKey, '["SC2"]', '["TF2"]', '', '', ''];
var ownerPEOMapping = [ownerKey + '::P1', ownerKey, '["SDG4"]', '', '', ''];

var rowSets = {
  PR_ProgrammeProfile: [ownerProfile, inheritorProfile],
  PR_PEORecords: [ownerPEO],
  PR_PLORecords: [ownerPLO],
  PR_PLOMappings: [ownerMapping],
  PR_PEOMappings: [ownerPEOMapping]
};

var references = {tf: [{code: 'TF1', mqfDomains: ['MQF1']}, {code: 'TF2', mqfDomains: ['MQF2']}]};

var legacyTab = new FakeSheet('MQA/FA9999', [
  ['PEO'], ['PEO1', 'Objective'], ['PLO'], ['PLO1', 'Outcome', 'MQF 1', 'PEO1', 'C4']
]);
function legacySpreadsheet() {
  return {getSheetByName: function(name) { return name === 'MQA/FA9999' ? legacyTab : null; }};
}

// -- researchReviewDataFromRows_ / researchReviewDataFromSheets_ harness -------
var readerDeps = [
  'serializeResearchDate_', 'canonicalResearchTaxonomy_', 'uniqueTrimmed_',
  'deriveTFIds_', 'parseResearchJson_', 'normalizeLegacyMQF_',
  'readLegacyResearchDetail_', 'researchTFReferenceMap_', 'legacyResearchMappings_',
  'profileFromRow_', 'peoFromRow_', 'ploFromRow_', 'mappingFromRow_', 'peoMappingFromRow_',
  'researchRows_'
].map(function(name) { return extractFunction(name, mappingSource); }).join('\n');

var readersApi = new Function(
  'getSpreadsheet', 'RESEARCH_ROWS_CACHE_',
  readerDeps + '\n' + extractFunction('getResearchReferenceList_', referenceSource) + '\n' +
  extractFunction('researchReviewDataFromRows_', reviewSource) + '\n' +
  extractFunction('researchReviewDataFromSheets_', reviewSource) + '\n' +
  'return { researchReviewDataFromRows_: researchReviewDataFromRows_, researchReviewDataFromSheets_: researchReviewDataFromSheets_ };'
)(legacySpreadsheet, {});

// Test 1: dashboard path — owner rows found under effectiveKey, absent under inheritor key
var ownerData = readersApi.researchReviewDataFromRows_(ownerKey, rowSets, references, mqaCode);
assert.strictEqual(ownerData.profile.programmeId, ownerKey, 'Dashboard path must resolve owner profile via effectiveKey');
assert.strictEqual(ownerData.peos.length, 1, 'Dashboard path must read owner PEO rows via effectiveKey');
assert.strictEqual(ownerData.plos.length, 1, 'Dashboard path must read owner PLO rows via effectiveKey');
assert.strictEqual(ownerData.mappings.length, 1, 'Dashboard path must read owner PLO mappings via effectiveKey');
assert.strictEqual(ownerData.peoSDGMappings.length, 1, 'Dashboard path must read owner PEO SDG mappings via effectiveKey');
assert.strictEqual(ownerData.plos[0].code, 'PLO1', 'Dashboard owner PLO code mismatch');
assert.strictEqual(ownerData.mappings[0].tfIds[0], 'TF2', 'Dashboard owner mapping TF mismatch');

var inheritorOwnKey = readersApi.researchReviewDataFromRows_(inheritorKey, rowSets, references, mqaCode);
assert.strictEqual(inheritorOwnKey.peos.length, 0, 'Inheritor own-key must NOT read owner rows — effectiveKey resolution is required');
assert.strictEqual(inheritorOwnKey.plos.length, 0, 'Inheritor own-key must NOT read owner rows — effectiveKey resolution is required');

// Test 2: dashboard path — legacy fallback when no PR_ rows exist for the programme
var legacyRows = readersApi.researchReviewDataFromRows_('FKGS::PC123::MQA/FA9999', {}, references, 'MQA/FA9999');
assert.strictEqual(legacyRows.peos.length, 1, 'Dashboard path legacy fallback must load PEOs from the MQA/FA tab');
assert.strictEqual(legacyRows.plos.length, 1, 'Dashboard path legacy fallback must load PLOs from the MQA/FA tab');
assert.strictEqual(legacyRows.plos[0].mqfDomains[0], 'MQF1', 'Legacy MQF domain was not normalized');
assert.strictEqual(legacyRows.plos[0].parentPEO, 'PEO1', 'Legacy PLO parent PEO was not parsed');
assert.strictEqual(legacyRows.mappings.length, 1, 'Legacy mappings must be derived from the detail tab');
assert.strictEqual(legacyRows.mappings[0].derivedTFIds[0], 'TF1', 'Legacy TF derivation mismatch');

// Test 3: legacy fallback must NOT fire without a legacy MQA tab
var noTab = new Function(
  'getSpreadsheet', 'RESEARCH_ROWS_CACHE_',
  readerDeps + '\n' + extractFunction('getResearchReferenceList_', referenceSource) + '\n' +
  extractFunction('researchReviewDataFromRows_', reviewSource) + '\nreturn researchReviewDataFromRows_;'
)(function() { return {getSheetByName: function() { return null; }}; }, {});
var noTabRows = noTab('FKGS::PC123::MQA/FA9999', {}, references, 'MQA/FA9999');
assert.strictEqual(noTabRows.peos.length, 0, 'Legacy fallback must not fabricate rows when the MQA/FA tab is absent');
assert.strictEqual(noTabRows.plos.length, 0, 'Legacy fallback must not fabricate rows when the MQA/FA tab is absent');

// Test 4: targeted path — sheets with effectiveKey resolve owner rows
var sheets = {
  PR_ProgrammeProfile: new FakeSheet('PR_ProgrammeProfile', [
    ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'DefaultSDGIdsJson', 'SharedFromProgrammeId', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
    ownerProfile, inheritorProfile
  ]),
  PR_PEORecords: new FakeSheet('PR_PEORecords', [
    ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'], ownerPEO
  ]),
  PR_PLORecords: new FakeSheet('PR_PLORecords', [
    ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'], ownerPLO
  ]),
  PR_PLOMappings: new FakeSheet('PR_PLOMappings', [
    ['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'], ownerMapping
  ]),
  PR_PEOMappings: new FakeSheet('PR_PEOMappings', [
    ['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'], ownerPEOMapping
  ])
};
var sheetsOwner = readersApi.researchReviewDataFromSheets_(ownerKey, sheets, references);
assert.strictEqual(sheetsOwner.peos.length, 1, 'Targeted path must read owner PEO rows via effectiveKey');
assert.strictEqual(sheetsOwner.plos.length, 1, 'Targeted path must read owner PLO rows via effectiveKey');
assert.strictEqual(sheetsOwner.profile.programmeId, ownerKey, 'Targeted path must resolve owner profile via effectiveKey');

// Test 5: targeted path — no mqaCode disables legacy fallback; mqaCode enables it
var sheetsInheritor = readersApi.researchReviewDataFromSheets_(inheritorKey, sheets, references);
assert.strictEqual(sheetsInheritor.peos.length, 0, 'Inheritor own-key must not find owner rows in the sheets path');
assert.strictEqual(sheetsInheritor.plos.length, 0, 'Inheritor own-key must not find owner rows in the sheets path');

var emptySheets = {
  PR_ProgrammeProfile: new FakeSheet('PR_ProgrammeProfile', [['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'DefaultSDGIdsJson', 'SharedFromProgrammeId', 'CreatedAt', 'UpdatedAt', 'UpdatedBy']]),
  PR_PEORecords: new FakeSheet('PR_PEORecords', [['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy']]),
  PR_PLORecords: new FakeSheet('PR_PLORecords', [['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy']]),
  PR_PLOMappings: new FakeSheet('PR_PLOMappings', [['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']]),
  PR_PEOMappings: new FakeSheet('PR_PEOMappings', [['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']])
};
var sheetsLegacy = readersApi.researchReviewDataFromSheets_('FKGS::PC123::MQA/FA9999', emptySheets, references, 'MQA/FA9999');
assert.strictEqual(sheetsLegacy.peos.length, 1, 'Targeted path legacy fallback must load PEOs when mqaCode is supplied');
assert.strictEqual(sheetsLegacy.plos.length, 1, 'Targeted path legacy fallback must load PLOs when mqaCode is supplied');

// Test 6: withPreparedResearchContext_ — locked write context resolves effectiveKey
var sheetHeaders = new Function(dataSource + '\nreturn RESEARCH_SHEET_HEADERS;')();
function buildPreparedHarness(getSpreadsheet, researchProgramme_) {
  var src = [
    extractFunction('getResearchProgrammeKey_', dataSource),
    extractFunction('ensureResearchSheetsNoLock_', dataSource),
    extractFunction('researchContext_', mappingSource),
    extractFunction('researchEffectiveKey_', mappingSource),
    extractFunction('researchRows_', mappingSource),
    extractFunction('withPreparedResearchContext_', mappingSource)
  ].join('\n');
  return new Function(
    'RESEARCH_ROWS_CACHE_', 'RESEARCH_SHEETS_CACHE_', 'RESEARCH_REFERENCES_CACHE_', 'RESEARCH_SHEET_HEADERS',
    'getSpreadsheet', 'researchProgramme_', 'withResearchLockRetry_',
    'seedResearchReferencesNoLock_', 'migrateLegacyResearchRowsNoLock_',
    'ensureProgrammeSDGDefaults_', 'migratePLOSDGToPEO_', 'getResearchReferencesNoLock_',
    src + '\nreturn { withPreparedResearchContext_: withPreparedResearchContext_ };'
  )({}, {}, {}, sheetHeaders, getSpreadsheet, researchProgramme_, function(fn) { return fn(); },
    function() {}, function() {}, function() {}, function() { return true; },
    function() { return {mqf: [], tf: [], sdg: [], sc: []}; });
}

function programmeResolver(id) {
  if (id === inheritorKey || id === mqaCode) return {programmeId: inheritorKey, mqaCode: mqaCode, faculty: 'FSSG', name: 'D'};
  if (id === ownerKey) return {programmeId: ownerKey, mqaCode: mqaCode, faculty: 'FUHA', name: 'D'};
  throw new Error('unknown programme: ' + id);
}

var inheritorSs = {
  sheets: {
    PR_ProgrammeProfile: new FakeSheet('PR_ProgrammeProfile', [
      ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'DefaultSDGIdsJson', 'SharedFromProgrammeId', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
      inheritorProfile
    ])
  },
  getSheetByName: function(name) { return this.sheets[name] || null; },
  insertSheet: function(name) { this.sheets[name] = new FakeSheet(name); return this.sheets[name]; }
};
var inheritorHarness = buildPreparedHarness(function() { return inheritorSs; }, programmeResolver);
var inheritorContext = null;
inheritorHarness.withPreparedResearchContext_(inheritorKey, function(context) { inheritorContext = context; return 'ok'; });
assert.strictEqual(inheritorContext.key, inheritorKey, 'Locked context key mismatch');
assert.strictEqual(inheritorContext.effectiveKey, ownerKey, 'Locked write context must resolve the shared-MQA owner effectiveKey');
assert.strictEqual(inheritorContext.mqaCode, mqaCode, 'Locked context must expose the programme MQA code');
assert.notStrictEqual(inheritorContext.effectiveKey, inheritorContext.key, 'Inheritor write guard must reject its own writes');

var ownerSs = {
  sheets: {
    PR_ProgrammeProfile: new FakeSheet('PR_ProgrammeProfile', [
      ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'DefaultSDGIdsJson', 'SharedFromProgrammeId', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
      ownerProfile
    ])
  },
  getSheetByName: function(name) { return this.sheets[name] || null; },
  insertSheet: function(name) { this.sheets[name] = new FakeSheet(name); return this.sheets[name]; }
};
var ownerHarness = buildPreparedHarness(function() { return ownerSs; }, programmeResolver);
var ownerContext = null;
ownerHarness.withPreparedResearchContext_(ownerKey, function(context) { ownerContext = context; return 'ok'; });
assert.strictEqual(ownerContext.effectiveKey, ownerKey, 'Owner effectiveKey must equal its own key');
assert.strictEqual(ownerContext.effectiveKey, ownerContext.key, 'Owner write guard must allow its own writes');

console.log('Review data reader tests passed.');
