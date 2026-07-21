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
    copy.active = true;
    return copy;
  });
}

function getResearchReferences_() {
  return {
    mqf: activeResearchReferences_(RESEARCH_REFERENCE_DATA.mqf),
    tf: activeResearchReferences_(RESEARCH_REFERENCE_DATA.tf),
    sdg: activeResearchReferences_(RESEARCH_REFERENCE_DATA.sdg),
    sc: activeResearchReferences_(RESEARCH_REFERENCE_DATA.sc)
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
