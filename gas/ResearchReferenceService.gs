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
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }
  try {
    Object.keys(RESEARCH_REFERENCE_SEEDS_).forEach(function(name) {
      var sheet = sheets[name];
      var rows = RESEARCH_REFERENCE_SEEDS_[name];
      var actual = sheet.getDataRange().getValues();
      var existingCodes = Object.create(null);
      actual.slice(1).forEach(function(row) {
        var code = String(row[0] || '').trim();
        if (code) existingCodes[code] = true;
      });
      rows.forEach(function(row) {
        var code = String(row[0] || '').trim();
        if (!existingCodes[code]) {
          sheet.appendRow(row);
          existingCodes[code] = true;
        }
      });
    });
  } finally {
    lock.releaseLock();
  }
}

function getResearchReferences_() {
  var sheets = ensureResearchSheets_();
  seedResearchReferences_(sheets);
  var result = {};
  Object.keys(RESEARCH_REFERENCE_SEEDS_).forEach(function(name) {
    var rows = sheets[name].getDataRange().getValues();
    var activeColumn = RESEARCH_SHEET_HEADERS[name].indexOf('Active');
    result[name.replace('PR_', '').replace('Reference', '')] = rows.slice(1).filter(function(row) {
      return isValidReferenceRow_(row, name, activeColumn);
    }).map(function(row) {
      if (name === 'PR_TFReference') {
        var mqfDomains;
        try {
          mqfDomains = JSON.parse(row[3] || '[]');
        } catch (e) {
          return null;
        }
        return { code: String(row[0]).trim(), title: row[1], description: row[2], mqfDomains: mqfDomains };
      }
      return { code: String(row[0]).trim(), title: row[1], description: row[2] };
    }).filter(function(row) { return row !== null; });
  });
  return result;
}

function isValidReferenceRow_(row, name, activeColumn) {
  var code = String(row[0] || '').trim();
  if (!code || !String(row[1] || '').trim() || !isActiveReference_(row[activeColumn])) return false;
  if (name !== 'PR_TFReference') return true;
  try {
    var mqfDomains = JSON.parse(row[3] || '');
    return Array.isArray(mqfDomains) && mqfDomains.length > 0 && mqfDomains.every(function(domain) {
      return typeof domain === 'string' && domain.trim();
    });
  } catch (e) {
    return false;
  }
}

function validateReferenceIds_(ids, allowedIds) {
  var allowed = Object.create(null);
  (allowedIds || []).forEach(function(id) {
    var value = String(id).trim();
    if (!isUnsafeReferenceId_(value)) allowed[value] = true;
  });
  var seen = Object.create(null);
  var invalid = [];
  var canonical = [];
  (ids || []).forEach(function(id) {
    var value = String(id).trim();
    if (!value || Object.prototype.hasOwnProperty.call(seen, value)) return;
    seen[value] = true;
    if (isUnsafeReferenceId_(value) || !Object.prototype.hasOwnProperty.call(allowed, value)) invalid.push(value);
    else canonical.push(value);
  });
  if (invalid.length) throw new Error('Invalid reference IDs: ' + invalid.join(', '));
  return canonical;
}

function isUnsafeReferenceId_(value) {
  return value === '__proto__' || Object.prototype.hasOwnProperty.call(Object.prototype, value);
}

function getResearchReferencesApi() {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getResearchReferences_();
}
