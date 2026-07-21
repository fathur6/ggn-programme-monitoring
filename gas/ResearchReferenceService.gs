/** ResearchReferenceService.gs — Immutable research mapping references. */

var RESEARCH_REFERENCE_SEEDS_ = {
  PR_MQFReference: [
    ['MQF1', 'Knowledge', 'MQF 2.0 knowledge domain', true],
    ['MQF2', 'Practical Skills', 'MQF 2.0 practical skills domain', true],
    ['MQF3a', 'Social Skills and Responsibility', 'MQF 2.0 social skills and responsibility domain', true],
    ['MQF3b', 'Communication Skills', 'MQF 2.0 communication skills domain', true],
    ['MQF3c', 'Digital Skills', 'MQF 2.0 digital skills domain', true],
    ['MQF3d', 'Numeracy Skills', 'MQF 2.0 numeracy skills domain', true],
    ['MQF3e', 'Leadership, Autonomy and Responsibility', 'MQF 2.0 leadership, autonomy and responsibility domain', true],
    ['MQF3f', 'Personal and Entrepreneurial Skills', 'MQF 2.0 personal and entrepreneurial skills domain', true],
    ['MQF4a', 'Knowledge and Understanding', 'MQF 2.0 knowledge and understanding domain', true],
    ['MQF4b', 'Cognitive Skills', 'MQF 2.0 cognitive skills domain', true],
    ['MQF5', 'Ethics and Professionalism', 'MQF 2.0 ethics and professionalism domain', true]
  ],
  PR_TFReference: [
    ['TF1', 'Knowledge and Understanding', 'Taxonomy framework grouping', JSON.stringify(['MQF1', 'MQF4a']), true],
    ['TF2', 'Practical and Cognitive Skills', 'Taxonomy framework grouping', JSON.stringify(['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']), true],
    ['TF3', 'Communication and Social Skills', 'Taxonomy framework grouping', JSON.stringify(['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f']), true],
    ['TF4', 'Professional and Ethical Practice', 'Taxonomy framework grouping', JSON.stringify(['MQF3a', 'MQF3b', 'MQF4a', 'MQF4b', 'MQF5']), true]
  ],
  PR_SDGReference: [
    ['SDG4', 'Quality Education', 'Ensure inclusive and equitable quality education.', true]
  ],
  PR_SCReference: [
    ['SC2', 'Research and Innovation', 'Approved strategic challenge reference.', true],
    ['SC3', 'Societal Impact', 'Approved strategic challenge reference.', true]
  ]
};

function isActiveReference_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'active';
}

function seedResearchReferences_(sheets) {
  Object.keys(RESEARCH_REFERENCE_SEEDS_).forEach(function(name) {
    var sheet = sheets[name];
    if (sheet.getLastRow() === 1) {
      var rows = RESEARCH_REFERENCE_SEEDS_[name];
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  });
}

function getResearchReferences_() {
  var sheets = ensureResearchSheets_();
  seedResearchReferences_(sheets);
  var result = {};
  Object.keys(RESEARCH_REFERENCE_SEEDS_).forEach(function(name) {
    var rows = sheets[name].getDataRange().getValues();
    result[name.replace('PR_', '').replace('Reference', '')] = rows.slice(1).filter(function(row) {
      return isActiveReference_(row[row.length - 1]);
    }).map(function(row) {
      if (name === 'PR_TFReference') {
        return { code: String(row[0]).trim(), title: row[1], description: row[2], mqfDomains: JSON.parse(row[3] || '[]') };
      }
      return { code: String(row[0]).trim(), title: row[1], description: row[2] };
    });
  });
  return result;
}

function validateReferenceIds_(ids, allowedIds) {
  var allowed = (allowedIds || []).map(function(id) { return String(id).trim(); });
  var seen = {};
  var invalid = [];
  var canonical = [];
  (ids || []).forEach(function(id) {
    var value = String(id).trim();
    if (!value || seen[value]) return;
    seen[value] = true;
    if (allowed.indexOf(value) === -1) invalid.push(value);
    else canonical.push(value);
  });
  if (invalid.length) throw new Error('Invalid reference IDs: ' + invalid.join(', '));
  return canonical;
}

function getResearchReferencesApi() {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getResearchReferences_();
}
