/** ResearchReferenceService.gs — Postgraduate research reference tables */

var RESEARCH_REFERENCE_DATA = {
  mqf: [
    { code: 'MQF1', title: 'Knowledge and understanding' },
    { code: 'MQF2', title: 'Cognitive skills' },
    { code: 'MQF3a', title: 'Practical skills' },
    { code: 'MQF3b', title: 'Interpersonal skills' },
    { code: 'MQF3c', title: 'Communication skills' },
    { code: 'MQF3d', title: 'Digital skills' },
    { code: 'MQF3e', title: 'Numeracy skills' },
    { code: 'MQF3f', title: 'Leadership, autonomy and responsibility' },
    { code: 'MQF4a', title: 'Personal skills' },
    { code: 'MQF4b', title: 'Entrepreneurial skills' },
    { code: 'MQF5', title: 'Ethics and professionalism' }
  ],
  tf: [
    { code: 'TF1', title: 'Knowledge and understanding', mqfDomains: ['MQF1', 'MQF4a'] },
    { code: 'TF2', title: 'Cognitive skills', mqfDomains: ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e'] },
    { code: 'TF3', title: 'Practical and communication skills', mqfDomains: ['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f'] },
    { code: 'TF4', title: 'Personal and professional skills', mqfDomains: ['MQF3a', 'MQF3b', 'MQF4a', 'MQF4b', 'MQF5'] }
  ],
  sdg: Array.from({length: 17}, function(_, index) {
    return { code: 'SDG' + (index + 1), title: 'Sustainable Development Goal ' + (index + 1) };
  }),
  sc: Array.from({length: 8}, function(_, index) {
    return { code: 'SC' + (index + 1), title: 'Sustainability competency ' + (index + 1) };
  })
};

function activeResearchReferences_(rows) {
  return (rows || []).map(function(row) {
    var copy = {};
    Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
    copy.active = row.active === true || String(row.active).trim().toLowerCase() === 'true' || String(row.active).trim() === '1';
    return copy;
  }).filter(function(row) { return row.active; });
}

function seedResearchReferenceSheets_(sheets) {
  var sheetNames = { mqf: 'PR_MQFReference', tf: 'PR_TFReference', sdg: 'PR_SDGReference', sc: 'PR_SCReference' };
  Object.keys(sheetNames).forEach(function(type) {
    var sheet = sheets[sheetNames[type]];
    if (sheet.getLastRow() > 1) return;
    RESEARCH_REFERENCE_DATA[type].forEach(function(row) {
      var values = [row.code, row.title, row.description || ''];
      if (type === 'tf') values.push(JSON.stringify(row.mqfDomains || []));
      values.push(true);
      sheet.appendRow(values);
    });
  });
}

function readResearchReferenceRows_(sheet, type) {
  var values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(row) { return row[0] !== ''; }).map(function(row) {
    var reference = { code: String(row[0]).trim(), title: row[1], description: row[2], active: row[3] };
    if (type === 'tf') {
      try { reference.mqfDomains = JSON.parse(row[3] || '[]'); } catch (e) { reference.mqfDomains = []; }
      reference.active = row[4];
    }
    return reference;
  });
}

function getResearchReferences_() {
  var sheets = ensureResearchSheets_();
  return {
    mqf: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_MQFReference, 'mqf')),
    tf: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_TFReference, 'tf')),
    sdg: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_SDGReference, 'sdg')),
    sc: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_SCReference, 'sc'))
  };
}

function validateReferenceIds_(ids, allowedIds) {
  var allowed = (allowedIds || []).map(function(id) { return String(id).trim(); });
  var seen = {};
  var result = [];
  (Array.isArray(ids) ? ids : []).forEach(function(id) {
    var canonical = String(id == null ? '' : id).trim();
    if (!canonical) return;
    if (allowed.indexOf(canonical) === -1) throw new Error('Invalid reference ID: ' + canonical);
    if (!seen[canonical]) {
      seen[canonical] = true;
      result.push(canonical);
    }
  });
  return result;
}

function getResearchReferencesApi() {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getResearchReferences_();
}
