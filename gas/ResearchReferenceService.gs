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
    ['SDG1', 'No Poverty', 'End poverty in all its forms everywhere.', true],
    ['SDG2', 'Zero Hunger', 'End hunger, achieve food security and improved nutrition and promote sustainable agriculture.', true],
    ['SDG3', 'Good Health and Well-being', 'Ensure healthy lives and promote well-being for all at all ages.', true],
    ['SDG4', 'Quality Education', 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.', true],
    ['SDG5', 'Gender Equality', 'Achieve gender equality and empower all women and girls.', true],
    ['SDG6', 'Clean Water and Sanitation', 'Ensure availability and sustainable management of water and sanitation for all.', true],
    ['SDG7', 'Affordable and Clean Energy', 'Ensure access to affordable, reliable, sustainable and modern energy for all.', true],
    ['SDG8', 'Decent Work and Economic Growth', 'Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.', true],
    ['SDG9', 'Industry, Innovation and Infrastructure', 'Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.', true],
    ['SDG10', 'Reduced Inequalities', 'Reduce inequality within and among countries.', true],
    ['SDG11', 'Sustainable Cities and Communities', 'Make cities and human settlements inclusive, safe, resilient and sustainable.', true],
    ['SDG12', 'Responsible Consumption and Production', 'Ensure sustainable consumption and production patterns.', true],
    ['SDG13', 'Climate Action', 'Take urgent action to combat climate change and its impacts.', true],
    ['SDG14', 'Life Below Water', 'Conserve and sustainably use the oceans, seas and marine resources for sustainable development.', true],
    ['SDG15', 'Life on Land', 'Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt biodiversity loss.', true],
    ['SDG16', 'Peace, Justice and Strong Institutions', 'Promote peaceful and inclusive societies, provide access to justice, and build effective, accountable and inclusive institutions.', true],
    ['SDG17', 'Partnerships for the Goals', 'Strengthen the means of implementation and revitalize the Global Partnership for Sustainable Development.', true]
  ],
  PR_SCReference: [
    ['SC1', 'Systems-thinking competency', 'Ways of Thinking', true],
    ['SC2', 'Anticipatory competency', 'Ways of Thinking', true],
    ['SC3', 'Critical thinking competency', 'Ways of Thinking', true],
    ['SC4', 'Strategic competency', 'Ways of Practicing', true],
    ['SC5', 'Collaboration competency', 'Ways of Practicing', true],
    ['SC6', 'Integrated problem-solving competency', 'Ways of Practicing', true],
    ['SC7', 'Self-awareness competency', 'Ways of Being', true],
    ['SC8', 'Normative competency', 'Ways of Being', true]
  ]
};

var RESEARCH_REFERENCES_CACHE_ = null;

function isActiveReference_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'active';
}

function seedResearchReferences_(sheets) {
  withResearchLockRetry_(function() {
    seedResearchReferencesNoLock_(sheets);
  });
}

function seedResearchReferencesNoLock_(sheets) {
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
}

function researchReferencesReadyFromSnapshot_(byTitle) {
  var names = Object.keys(RESEARCH_REFERENCE_SEEDS_);
  for (var i = 0; i < names.length; i++) {
    var data = byTitle[names[i]];
    if (!data || !data.length) return false;
    var codes = {};
    for (var r = 1; r < data.length; r++) codes[String(data[r][0] || '').trim()] = true;
    var seeds = RESEARCH_REFERENCE_SEEDS_[names[i]];
    for (var s = 0; s < seeds.length; s++) {
      if (!codes[String(seeds[s][0])]) return false;
    }
  }
  return true;
}

function tryResearchReferencesSnapshot_() {
  var byTitle = researchSnapshotByTitle_(getSpreadsheet());
  if (!byTitle) return null;
  if (!researchReferencesReadyFromSnapshot_(byTitle)) return null;
  return getResearchReferencesNoLock_(researchSheetsFromSnapshot_(byTitle));
}

function getResearchReferences_() {
  if (RESEARCH_REFERENCES_CACHE_) return RESEARCH_REFERENCES_CACHE_;
  var snapshot = tryResearchReferencesSnapshot_();
  if (snapshot) {
    RESEARCH_REFERENCES_CACHE_ = snapshot;
    return snapshot;
  }
  var result = withResearchLockRetry_(function() {
    var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
    seedResearchReferencesNoLock_(sheets);
    return getResearchReferencesNoLock_(sheets);
  });
  RESEARCH_REFERENCES_CACHE_ = result;
  return result;
}

function getResearchReferencesNoLock_(sheets) {
  var result = {};
  Object.keys(RESEARCH_REFERENCE_SEEDS_).forEach(function(name) {
    var rows = sheets[name].getDataRange().getValues();
    var activeColumn = RESEARCH_SHEET_HEADERS[name].indexOf('Active');
    result[name.replace('PR_', '').replace('Reference', '')] = rows.slice(1).filter(function(row) {
      return isValidReferenceRow_(row, name, activeColumn);
    }).map(function(row) {
      var code = String(row[0]).trim();
      var seed = (RESEARCH_REFERENCE_SEEDS_[name] || []).filter(function(item) { return String(item[0]) === code; })[0];
      var title = name === 'PR_SCReference' && seed ? seed[1] : row[1];
      var description = name === 'PR_SCReference' && seed ? seed[2] : row[2];
      if (name === 'PR_TFReference') {
        var mqfDomains;
        try {
          mqfDomains = JSON.parse(row[3] || '[]');
        } catch (e) {
          return null;
        }
        return { code: code, title: title, description: description, mqfDomains: mqfDomains };
      }
      return { code: code, title: title, description: description };
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

function getResearchReferenceList_(references, key) {
  references = references || {};
  var lower = String(key || '').toLowerCase();
  var upper = lower.toUpperCase();
  if (Array.isArray(references[lower])) return references[lower];
  if (Array.isArray(references[upper])) return references[upper];
  return [];
}

function getResearchReferencesApi() {
  if (!getCurrentUser_()) throw new Error('Unauthorized');
  return getResearchReferences_();
}
