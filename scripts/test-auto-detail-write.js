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

const autoSource = fs.readFileSync('gas/AutoDetailWriteService.gs', 'utf8');
const mappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const sdgSource = fs.readFileSync('gas/ProgrammeSDGService.gs', 'utf8');

function FakeSheet(name, rows) {
  this.name = name;
  this.rows = rows || [];
  this.getDataRange = function() { return {getValues: function() { return this.rows.map(function(r) { return r.slice(); }, this); }.bind(this)}; };
  this.getRange = function(row, col, numRows, numCols) {
    var self = this;
    return {
      setValues: function(values) {
        for (var i = 0; i < numRows; i++) {
          var target = self.rows[row - 1 + i];
          if (!target) continue;
          var v = values[i];
          target[col - 1] = v ? v[0] : '';
        }
      }
    };
  };
}

const AUTO_DETAIL_COLS_ = { SDG: 5, SC: 5, TF: 6 };
const SDG_KEYWORD_MAP_ = {};
const PLO_MQF_TO_SC_ = { MQF1: 'SC1', MQF2: 'SC3', MQF3a: 'SC5' };
const PLO_SC_KEYWORD_MAP_ = {};
const PROGRAMME_SDG_DEFAULTS_ = { 'MQA/FA7492|FBIM': ['SDG13', 'SDG14', 'SDG15'] };

const src = [
  'autoDetailCanonicalCode_', 'autoDetailScanTab_', 'autoDetailBuildMap_', 'autoDetailCompute_', 'writeAutoValuesToDetailTab_',
  'autoDetailReadCells_', 'autoDetailParseCellCodes_', 'autoDetailApplyPhase2Overrides_', 'autoDetailWriteTabCell_', 'autoDetailTabValuesFromSpreadsheet_'
].map(function(n) { return extractFunction(n, autoSource); }).join('\n') + '\n' +
[
  'researchRows_', 'parseResearchJson_', 'researchTFReferenceMap_', 'deriveTFIds_', 'normalizeLegacyMQF_', 'uniqueTrimmed_'
].map(function(n) { return extractFunction(n, mappingSource); }).join('\n') + '\n' +
extractFunction('getResearchReferenceList_', referenceSource) + '\n' +
[
  'getProgrammeSDGKey_', 'getProgrammeSDGDefaults_', 'sdgKeywordScore_', 'matchSDGsToPEOs_', 'matchPLOToSC_'
].map(function(n) { return extractFunction(n, sdgSource); }).join('\n');

const api = new Function(
  'AUTO_DETAIL_COLS_', 'SDG_KEYWORD_MAP_', 'PLO_MQF_TO_SC_', 'PLO_SC_KEYWORD_MAP_', 'PROGRAMME_SDG_DEFAULTS_',
  'RESEARCH_ROWS_CACHE_', 'getResearchProgrammeKey_', 'researchEffectiveKey_',
  src + '\nreturn { autoDetailCanonicalCode_: autoDetailCanonicalCode_, autoDetailScanTab_: autoDetailScanTab_, autoDetailBuildMap_: autoDetailBuildMap_, autoDetailCompute_: autoDetailCompute_, writeAutoValuesToDetailTab_: writeAutoValuesToDetailTab_, autoDetailReadCells_: autoDetailReadCells_, autoDetailApplyPhase2Overrides_: autoDetailApplyPhase2Overrides_, autoDetailWriteTabCell_: autoDetailWriteTabCell_, autoDetailTabValuesFromSpreadsheet_: autoDetailTabValuesFromSpreadsheet_ };'
)(AUTO_DETAIL_COLS_, SDG_KEYWORD_MAP_, PLO_MQF_TO_SC_, PLO_SC_KEYWORD_MAP_, PROGRAMME_SDG_DEFAULTS_, {},
  function(programme) { return programme.programmeId; },
  function(key) { return key; });

var ownerKey = 'FBIM::PE5002::MQA/FA7492';
var tabValues = [
  ['PEO'],
  ['PEO1', 'Statement A'],
  ['PEO2', 'Statement B'],
  ['PEO3', 'Statement C'],
  ['PEO4', 'Statement D'],
  ['PLO'],
  ['PLO1', 'Generic outcome one', 'MQF 1', 'PEO1', 'C3'],
  ['PLO2', 'Generic outcome two', 'MQF 2', 'PEO1', 'C5'],
  ['PLO3', 'Generic outcome three', 'MQF 3a', 'PEO1', 'P5'],
  [''],
  ['### PHASE 2 — COMPLETED MAPPING (AUTO-GENERATED) ###'],
  ['--- PEO → SDG ---'],
  ['PEO1', 'Statement A', 'SDG13']
].map(function(r) { var c = r.slice(); while (c.length < 7) c.push(''); return c; });

var references = {
  mqf: [{code: 'MQF1'}, {code: 'MQF2'}, {code: 'MQF3a'}],
  tf: [
    {code: 'TF1', mqfDomains: ['MQF1', 'MQF4a']},
    {code: 'TF2', mqfDomains: ['MQF2', 'MQF3d', 'MQF3e']},
    {code: 'TF3', mqfDomains: ['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f']},
    {code: 'TF4', mqfDomains: ['MQF4b', 'MQF5']}
  ],
  sdg: [{code: 'SDG13'}, {code: 'SDG14'}, {code: 'SDG15'}],
  sc: [{code: 'SC1'}, {code: 'SC3'}, {code: 'SC5'}]
};

var researchSheets = {
  PR_PEORecords: new FakeSheet('PR_PEORecords', [
    ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
    ['p1', ownerKey, 'PEO1', 'Statement A', 0, '', ''],
    ['p2', ownerKey, 'PEO2', 'Statement B', 1, '', ''],
    ['p3', ownerKey, 'PEO3', 'Statement C', 2, '', ''],
    ['p4', ownerKey, 'PEO4', 'Statement D', 3, '', '']
  ]),
  PR_PLORecords: new FakeSheet('PR_PLORecords', [
    ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
    ['l1', ownerKey, 'PEO1', 'PLO1', 'Generic outcome one', '["MQF1"]', 'C3', '', 'Draft', '', ''],
    ['l2', ownerKey, 'PEO1', 'PLO2', 'Generic outcome two', '["MQF2"]', 'C5', '', 'Draft', '', ''],
    ['l3', ownerKey, 'PEO1', 'PLO3', 'Generic outcome three', '["MQF3a"]', 'P5', '', 'Draft', '', '']
  ]),
  PR_PEOMappings: new FakeSheet('PR_PEOMappings', [
    ['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
    ['p4', ownerKey, '["SDG13"]', 'PPS default', '', '']
  ]),
  PR_PLOMappings: new FakeSheet('PR_PLOMappings', [
    ['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
    ['l1', ownerKey, '["SC3"]', '["TF1"]', '', '', '']
  ])
};

// Test 1: scanning stops at the Phase 2 block and captures both sections
var scan = api.autoDetailScanTab_(tabValues);
assert.strictEqual(scan.peoRecords.length, 4, 'PEO records were not captured');
assert.strictEqual(scan.ploRecords.length, 3, 'PLO records were not captured');
assert.strictEqual(scan.dataEndRow, 9, 'Scan must stop before the blank line / Phase 2 block');

// Test 2: compute from PR_ mappings (app is the source of truth)
var map = api.autoDetailBuildMap_(ownerKey, researchSheets, references);
var computed = api.autoDetailCompute_({faculty: 'FBIM', mqaCode: 'MQA/FA7492'}, map, scan.peoRecords, scan.ploRecords);
assert.strictEqual(computed.sdgByCode['PEO4'].join(', '), 'SDG13', 'PEO4 SDG must come from PR_PEOMappings');
assert.strictEqual(computed.sdgByCode['PEO1'].join(', '), '', 'PEO1 has no SDG mapping');
assert.strictEqual(computed.scByCode['PLO1'].join(', '), 'SC3', 'PLO1 SC must come from PR_PLOMappings');
assert.strictEqual(computed.scByCode['PLO2'].join(', '), 'SC3', 'PLO2 SC must fall back to the MQF default');
assert.strictEqual(computed.scByCode['PLO3'].join(', '), 'SC5', 'PLO3 SC must fall back to the MQF default');
assert.strictEqual(computed.tfByCode['PLO1'].join(', '), 'TF1', 'PLO1 TF must come from PR_PLOMappings');
assert.strictEqual(computed.tfByCode['PLO2'].join(', '), 'TF2', 'PLO2 TF must derive from MQF2');
assert.strictEqual(computed.tfByCode['PLO3'].join(', '), 'TF3', 'PLO3 TF must derive from MQF3a');

// Test 3: legacy-only fallback (no PR_ rows) — SDG on last 3 PEOs, SC/TF computed
var emptySheets = {
  PR_PEORecords: new FakeSheet('PR_PEORecords', [['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy']]),
  PR_PLORecords: new FakeSheet('PR_PLORecords', [['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy']]),
  PR_PEOMappings: new FakeSheet('PR_PEOMappings', [['PeoId', 'ProgrammeId', 'SDGIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']]),
  PR_PLOMappings: new FakeSheet('PR_PLOMappings', [['PloId', 'ProgrammeId', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy']])
};
var emptyMap = api.autoDetailBuildMap_(ownerKey, emptySheets, references);
assert.strictEqual(emptyMap.peos.length, 0, 'Empty workspace must have no PEOs');
var legacy = api.autoDetailCompute_({faculty: 'FBIM', mqaCode: 'MQA/FA7492'}, emptyMap, scan.peoRecords, scan.ploRecords);
assert.strictEqual(legacy.sdgByCode['PEO1'].join(', '), '', 'PEO1 is not among the last three PEOs');
assert.strictEqual(legacy.sdgByCode['PEO2'].join(', '), 'SDG13', 'Legacy PEO2 SDG default mismatch');
assert.strictEqual(legacy.sdgByCode['PEO3'].join(', '), 'SDG14', 'Legacy PEO3 SDG default mismatch');
assert.strictEqual(legacy.sdgByCode['PEO4'].join(', '), 'SDG15', 'Legacy PEO4 SDG default mismatch');
assert.strictEqual(legacy.scByCode['PLO1'].join(', '), 'SC1', 'Legacy PLO1 SC default (MQF1)');
assert.strictEqual(legacy.scByCode['PLO2'].join(', '), 'SC3', 'Legacy PLO2 SC default (MQF2)');
assert.strictEqual(legacy.scByCode['PLO3'].join(', '), 'SC5', 'Legacy PLO3 SC default (MQF3a)');
assert.strictEqual(legacy.tfByCode['PLO1'].join(', '), 'TF1', 'Legacy PLO1 TF from tab MQF');
assert.strictEqual(legacy.tfByCode['PLO2'].join(', '), 'TF2', 'Legacy PLO2 TF from tab MQF');
assert.strictEqual(legacy.tfByCode['PLO3'].join(', '), 'TF3', 'Legacy PLO3 TF from tab MQF');

// Test 4: write into the tab — SDG on PEO rows, SC/TF on PLO rows; manual cols + Phase 2 block untouched
var tabSheet = new FakeSheet('MQA/FA7492', tabValues.map(function(r) { return r.slice(); }));
var writeResult = api.writeAutoValuesToDetailTab_(
  {faculty: 'FBIM', mqaCode: 'MQA/FA7492', programmeId: ownerKey},
  researchSheets, references,
  {getSheetByName: function(name) { return name === 'MQA/FA7492' ? tabSheet : null; }}
);
assert.ok(writeResult.cells >= 6, 'Expected at least 6 cell writes, got ' + writeResult.cells);
assert.strictEqual(tabSheet.rows[1][5], '', 'PEO1 SDG should remain empty');
assert.strictEqual(tabSheet.rows[4][5], 'SDG13', 'PEO4 SDG was not written to column F');
assert.strictEqual(tabSheet.rows[6][5], 'SC3', 'PLO1 SC was not written to column F');
assert.strictEqual(tabSheet.rows[6][6], 'TF1', 'PLO1 TF was not written to column G');
assert.strictEqual(tabSheet.rows[7][5], 'SC3', 'PLO2 SC was not written to column F');
assert.strictEqual(tabSheet.rows[7][6], 'TF2', 'PLO2 TF was not written to column G');
assert.strictEqual(tabSheet.rows[8][5], 'SC5', 'PLO3 SC was not written to column F');
assert.strictEqual(tabSheet.rows[8][6], 'TF3', 'PLO3 TF was not written to column G');
assert.strictEqual(tabSheet.rows[7][2], 'MQF 2', 'PLO MQF column must remain untouched');
assert.strictEqual(tabSheet.rows[7][3], 'PEO1', 'PLO parent PEO column must remain untouched');
assert.strictEqual(tabSheet.rows[7][4], 'C5', 'PLO taxonomy column must remain untouched');
assert.strictEqual(tabSheet.rows[11][0], '--- PEO → SDG ---', 'Phase 2 block must remain untouched');
assert.strictEqual(tabSheet.rows[12][2], 'SDG13', 'Phase 2 block content must remain untouched');

// Test 5: reading current cell values back (PPS default or faculty alignment)
var alignedTab = tabValues.map(function(r) { return r.slice(); });
alignedTab[4][5] = 'SDG13';               // PEO4 SDG
alignedTab[6][5] = 'SC3'; alignedTab[6][6] = 'TF1';      // PLO1 SC + TF
alignedTab[7][5] = 'SC3, SC5'; alignedTab[7][6] = 'TF2'; // PLO2 multi SC + TF
var cells = api.autoDetailReadCells_(alignedTab);
assert.deepStrictEqual(cells.sdgByCode['PEO4'], ['SDG13'], 'Cell SDG was not read back');
assert.deepStrictEqual(cells.scByCode['PLO1'], ['SC3'], 'Cell SC was not read back');
assert.deepStrictEqual(cells.tfByCode['PLO1'], ['TF1'], 'Cell TF was not read back');
assert.deepStrictEqual(cells.scByCode['PLO2'], ['SC3', 'SC5'], 'Multi SC cell was not split');
assert.deepStrictEqual(cells.tfByCode['PLO2'], ['TF2'], 'PLO2 TF cell mismatch');
assert.deepStrictEqual(cells.sdgByCode['PEO1'], [], 'Empty SDG cell must read as empty');

// Test 6: Phase 2 overrides source SDG/SC/TF from the tab cells and filter invalid codes
var overridePeos = scan.peoRecords.map(function(rec) { return {peoId: ownerKey + '::' + rec.code, programmeId: ownerKey, code: rec.code}; });
var overridePlos = scan.ploRecords.map(function(rec) { return {ploId: ownerKey + '::' + rec.code, programmeId: ownerKey, code: rec.code}; });
var invalidTab = alignedTab.map(function(r) { return r.slice(); });
invalidTab[4][5] = 'SDG13, SDG99'; // invalid code must be filtered
var overridden = api.autoDetailApplyPhase2Overrides_(overridePeos, overridePlos, [], [], api.autoDetailReadCells_(invalidTab), references);
assert.strictEqual(overridden.mappings[0].scIds[0], 'SC3', 'PLO1 SC override missing');
assert.strictEqual(overridden.mappings[0].tfIds[0], 'TF1', 'PLO1 TF override missing');
assert.strictEqual(overridden.mappings[1].scIds.join(','), 'SC3,SC5', 'PLO2 multi-SC override missing');
assert.strictEqual(overridden.mappings[1].tfIds[0], 'TF2', 'PLO2 TF override missing');
assert.deepStrictEqual(overridden.mappings[2].scIds, [], 'PLO3 has no cell SC');
assert.deepStrictEqual(overridden.peoSDGMappings[3].sdgIds, ['SDG13'], 'Invalid SDG code must be filtered out');
assert.strictEqual(overridden.mappings[0].derivedLabel, 'Faculty alignment', 'Cell-sourced mapping must be labelled faculty alignment');

// Test 7: writing a single value into the tab cell via the save path
var writeCellSheet = new FakeSheet('MQA/FA7492', tabValues.map(function(r) { return r.slice(); }));
var ssMock = {getSheetByName: function(name) { return name === 'MQA/FA7492' ? writeCellSheet : null; }};
assert.strictEqual(api.autoDetailWriteTabCell_(ssMock, 'MQA/FA7492', 'PLO2', 5, 'SC5'), true, 'SC write must locate the PLO row');
assert.strictEqual(writeCellSheet.rows[7][5], 'SC5', 'PLO2 SC cell was not updated');
assert.strictEqual(api.autoDetailWriteTabCell_(ssMock, 'MQA/FA7492', 'PEO4', 5, 'SDG14'), true, 'SDG write must locate the PEO row');
assert.strictEqual(writeCellSheet.rows[4][5], 'SDG14', 'PEO4 SDG cell was not updated');
assert.strictEqual(writeCellSheet.rows[7][2], 'MQF 2', 'Manual PLO MQF cell must survive a cell write');
assert.strictEqual(api.autoDetailWriteTabCell_(ssMock, 'MQA/FA9999', 'PLO1', 5, 'SC1'), false, 'Missing tab must not throw');
assert.deepStrictEqual(api.autoDetailTabValuesFromSpreadsheet_(ssMock, 'MQA/FA7492'), writeCellSheet.rows, 'Tab value reader mismatch');

console.log('Auto detail write tests passed.');
