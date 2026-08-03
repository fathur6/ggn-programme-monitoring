const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/AssessmentService.gs', 'utf8');
const index = fs.readFileSync('gas/Index.html', 'utf8');

function extractFunction(name, text) {
  const start = text.search(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
  if (start < 0) throw new Error('Missing function: ' + name);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unclosed function: ' + name);
}

function referenceList(references, key) {
  return references[key] || references[String(key).toUpperCase()] || [];
}

function deriveTF(mqfDomains, tfReference) {
  return Object.keys(tfReference || {}).filter(function(tfId) {
    return (tfReference[tfId] || []).some(function(domain) { return (mqfDomains || []).indexOf(domain) !== -1; });
  }).sort();
}

const api = new Function(
  'getResearchReferenceList_', 'deriveTFIds_', 'RESEARCH_TAXONOMY_IDS',
  source + '\nreturn {buildAssessmentDefinitions_: buildAssessmentDefinitions_, assessmentProjection_: assessmentProjection_, assessmentAlignmentPayload_: assessmentAlignmentPayload_, assessmentRejectClientAuthority_: assessmentRejectClientAuthority_};'
)(referenceList, deriveTF, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']);

const references = {
  MQF: [
    {code: 'MQF1'}, {code: 'MQF2'}, {code: 'MQF3a'}, {code: 'MQF3b'}, {code: 'MQF3c'}, {code: 'MQF3d'}, {code: 'MQF3e'}, {code: 'MQF3f'}, {code: 'MQF4a'}, {code: 'MQF4b'}, {code: 'MQF5'}
  ],
  TF: [
    {code: 'TF1', mqfDomains: ['MQF1', 'MQF4a']},
    {code: 'TF2', mqfDomains: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']},
    {code: 'TF3', mqfDomains: ['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f']},
    {code: 'TF4', mqfDomains: ['MQF3a', 'MQF3b', 'MQF4a', 'MQF4b', 'MQF5']}
  ],
  SC: [{code: 'SC2'}, {code: 'SC3'}, {code: 'SC4'}, {code: 'SC5'}, {code: 'SC6'}, {code: 'SC7'}, {code: 'SC8'}]
};

const definitions = api.buildAssessmentDefinitions_();
assert.strictEqual(definitions.length, 6, 'Study-level profiles must be separate for thesis, Viva, and Progress');
assert.deepStrictEqual(definitions.map(function(item) { return item.code; }), [
  'THESIS_MASTER', 'THESIS_PHD', 'VIVA_MASTER', 'VIVA_PHD', 'PROGRESS_MASTER', 'PROGRESS_PHD'
]);

const masterThesis = definitions[0];
const phdThesis = definitions[1];
assert.strictEqual(masterThesis.totalMarks, 100);
assert.strictEqual(phdThesis.totalMarks, 100);
assert.strictEqual(masterThesis.items.length, 20);
assert.strictEqual(phdThesis.items.length, 20);
assert.deepStrictEqual(masterThesis.categories.map(function(category) { return category.name; }), [
  'Kategori 1 — Framing Penyelidikan, Jurang Ilmu & Sumbangan Asli',
  'Kategori 2 — Metodologi, Pelaksanaan & Integriti Kesarjanaan',
  'Kategori 3 — Dapatan, Penaakulan & Perbincangan Berasaskan Eviden',
  'Kategori 4 — Kesimpulan, Impak, Nilai Ciptaan & Kualiti Tesis'
]);
assert.deepStrictEqual(masterThesis.categories.map(function(category) { return category.items.reduce(function(sum, item) { return sum + item.maxMarks; }, 0); }), [45, 20, 15, 20]);
assert.deepStrictEqual(phdThesis.categories.map(function(category) { return category.items.reduce(function(sum, item) { return sum + item.maxMarks; }, 0); }), [45, 20, 15, 20]);

function fakeSheet(name, rows) {
  return {getName: function() { return name; }, getDataRange: function() { return {getValues: function() { return rows; }}; }};
}
const duplicateDefinitionSource = [
  extractFunction('assessmentJson_', source),
  extractFunction('assessmentRows_', source),
  extractFunction('assessmentDefinitions_', source),
  extractFunction('assessmentDefinitionsNoLock_', source)
].join('\n');
const duplicateSheets = {
  PR_AssessmentInstruments: fakeSheet('PR_AssessmentInstruments', [
    ['header'],
    ['inst', 'THESIS_MASTER', 'Master', 'desc', '["Masters"]', 100, 0, 'src', 'doc', 'Draft', true],
    ['inst', 'THESIS_MASTER', 'Master', 'desc', '["Masters"]', 100, 0, 'src', 'doc', 'Draft', true]
  ]),
  PR_AssessmentCategories: fakeSheet('PR_AssessmentCategories', [
    ['header'], ['cat', 'inst', 'CAT1', 'Category', 0, 'src', true], ['cat', 'inst', 'CAT1', 'Category', 0, 'src', true]
  ]),
  PR_AssessmentItems: fakeSheet('PR_AssessmentItems', [
    ['header'], ['item', 'inst', 'CAT1', 'S1', 'Title', 'Descriptor', '', 5, 0, '["MQF2"]', 'C5', 'SC3', 'source', 'source', true],
    ['item', 'inst', 'CAT1', 'S1', 'Title', 'Descriptor', '', 5, 0, '["MQF2"]', 'C5', 'SC3', 'source', 'source', true]
  ])
};
const duplicateRuntime = new Function('ASSESSMENT_DEFINITION_CACHE_', 'ASSESSMENT_ROWS_CACHE_', 'ensureAssessmentSheets_', 'withResearchLockRetry_', 'ensureAssessmentSheetsNoLock_', 'getSpreadsheet', duplicateDefinitionSource + '\nreturn assessmentDefinitions_;')(null, {}, function() { return duplicateSheets; }, function(work) { return work(); }, function() { return duplicateSheets; }, function() { return {}; });
const dedupedDefinitions = duplicateRuntime();
assert.strictEqual(dedupedDefinitions.length, 1, 'Duplicate instrument rows must not multiply the projection');
assert.strictEqual(dedupedDefinitions[0].categories.length, 1);
assert.strictEqual(dedupedDefinitions[0].items.length, 1);

const vivaMaster = definitions[2];
const vivaPhd = definitions[3];
assert.strictEqual(vivaMaster.totalMarks, 25);
assert.strictEqual(vivaPhd.totalMarks, 25);
assert.strictEqual(vivaMaster.categories.length, 0, 'Viva must not receive invented thesis categories');
assert.strictEqual(vivaPhd.categories.length, 0, 'Viva must not receive invented thesis categories');
assert.strictEqual(vivaMaster.items[0].defaultTaxonomy, 'A4');
assert.strictEqual(vivaPhd.items[0].defaultTaxonomy, 'A5');

const progressMaster = definitions[4];
const progressPhd = definitions[5];
assert.strictEqual(progressMaster.totalMarks, 50);
assert.strictEqual(progressPhd.totalMarks, 50);
assert.strictEqual(progressMaster.items.length, 10);
assert.strictEqual(progressPhd.items.length, 10);
assert.strictEqual(progressMaster.categories.length, 0, 'Progress must not receive invented thesis categories');
assert.strictEqual(progressPhd.categories.length, 0, 'Progress must not receive invented thesis categories');
assert.strictEqual(progressMaster.items[8].descriptor, 'The candidate critically evaluates evidence, assumptions, limitations and alternative approaches, and uses sound reasoning to justify research decisions and planned strategy adjustments.');
assert.strictEqual(progressMaster.items[8].descriptorMs, 'Calon menilai secara kritikal bukti, andaian, limitasi dan pendekatan alternatif, serta menggunakan penaakulan yang kukuh untuk menjustifikasikan keputusan penyelidikan dan pelarasan strategi yang dirancang.');
progressMaster.items.concat(progressPhd.items).forEach(function(item) { assert.strictEqual(typeof item.defaultPrimarySC, 'string'); assert(item.defaultPrimarySC, 'Every Progress item needs one default Primary SC'); });

const masterProjection = api.assessmentProjection_({level: 'Masters'}, definitions, [], references, true);
const phdProjection = api.assessmentProjection_({level: 'Doctorate'}, definitions, [], references, true);
assert.deepStrictEqual(masterProjection.map(function(item) { return item.code; }), ['THESIS_MASTER', 'VIVA_MASTER', 'PROGRESS_MASTER']);
assert.deepStrictEqual(phdProjection.map(function(item) { return item.code; }), ['THESIS_PHD', 'VIVA_PHD', 'PROGRESS_PHD']);
masterProjection.forEach(function(instrument) { assert.strictEqual(instrument.totals.matches, true, instrument.code + ' total mismatch'); });
phdProjection.forEach(function(instrument) { assert.strictEqual(instrument.totals.matches, true, instrument.code + ' total mismatch'); });

const defaultItem = masterProjection[0].items[0];
assert.deepStrictEqual(defaultItem.effective.tfIds, ['TF2'], 'TF must derive from effective MQF');
assert.strictEqual(defaultItem.provenance.mqfDomains.kind, 'default');
assert.strictEqual(defaultItem.provenance.primarySC.kind, 'default');

const facultyProjection = api.assessmentProjection_({level: 'Masters'}, definitions, [{
  programmeId: 'P1', itemId: defaultItem.itemId, mqfDomains: ['MQF1'], taxonomy: defaultItem.baseline.taxonomy, primarySC: 'SC4', note: 'Faculty alignment'
}], references, true);
const facultyItem = facultyProjection[0].items[0];
assert.deepStrictEqual(facultyItem.effective.tfIds, ['TF1']);
assert.strictEqual(facultyItem.provenance.mqfDomains.kind, 'faculty');
assert.strictEqual(facultyItem.provenance.primarySC.kind, 'faculty');
assert.strictEqual(facultyItem.validation.ready, true);

const deselectedProjection = api.assessmentProjection_({level: 'Masters'}, definitions, [{
  programmeId: 'P1', itemId: defaultItem.itemId, mqfDomains: defaultItem.baseline.mqfDomains, taxonomy: defaultItem.baseline.taxonomy, primarySC: '', note: ''
}], references, false);
const deselectedItem = deselectedProjection[0].items[0];
assert.strictEqual(deselectedItem.effective.primarySC, '');
assert.strictEqual(deselectedItem.provenance.primarySC.kind, 'default');
assert.strictEqual(deselectedItem.provenance.primarySC.active, false);

assert.throws(function() { api.assessmentAlignmentPayload_({itemId: defaultItem.itemId, primarySC: ['SC3', 'SC4']}, defaultItem, references); }, /exactly one primary sc/i);
assert.throws(function() { api.assessmentAlignmentPayload_({itemId: defaultItem.itemId, primarySC: 'SC999'}, defaultItem, references); }, /invalid primary sc/i);
assert.throws(function() { api.assessmentRejectClientAuthority_({items: [{itemId: defaultItem.itemId, tfIds: ['TF1']}]}); }, /forbidden client authority/i);
assert.throws(function() { api.assessmentRejectClientAuthority_({items: [{itemId: defaultItem.itemId, sdgIds: ['SDG4']}]}); }, /forbidden client authority/i);

const assessmentPanelStart = index.indexOf('id="research-assessment-panel"');
const assessmentPanel = index.slice(assessmentPanelStart, index.indexOf('</section>', assessmentPanelStart));
assert(assessmentPanelStart >= 0, 'Assessment panel is missing');
assert(!/sdg/i.test(assessmentPanel), 'Assessment panel must not render SDG fields');
assert(/Pemetaan Program/.test(index), 'Existing mapping tab must have the explicit programme label');
assert(/Pemetaan Pentaksiran/.test(index), 'Assessment tab label is missing');
assert(/Laporan Kemajuan/.test(index) && /Peperiksaan Lisan/.test(index) && /Pemeriksaan Tesis/.test(index), 'Assessment instrument sub-pages are missing');
assert(/assessment-mqf-picker/.test(assessmentPanel) && /assessmentMQFLabel/.test(fs.readFileSync('gas/JavaScript.html', 'utf8')), 'MQF selection must use the popup picker');
assert(!/multiple\s+size="3"/.test(assessmentPanel), 'Assessment MQF selection must not remain an expanded listbox');
assert(/assessmentVisibleInstruments:\s*function/.test(fs.readFileSync('gas/JavaScript.html', 'utf8')), 'Assessment view must project one instrument sub-page at a time');
assert(/assessment-subnav/.test(fs.readFileSync('gas/Styles.html', 'utf8')), 'Assessment sub-page navigation styling is missing');
Object.keys(api).forEach(function() {});
assert(!/SDG/i.test(source), 'Assessment service must not define an SDG path');

console.log('Assessment mapping contract checks passed.');
