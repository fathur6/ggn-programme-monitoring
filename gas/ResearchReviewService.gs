/** ResearchReviewService.gs - server-side review validation and status */

var RESEARCH_REVIEW_STATUSES = ['Draft', 'Needs attention', 'Ready for review', 'Submitted', 'Approved', 'Returned for revision'];

function isLegalResearchStatusTransition_(fromStatus, toStatus) {
  fromStatus = String(fromStatus || 'Draft').trim();
  toStatus = String(toStatus || '').trim();
  var transitions = {
    'Draft': ['Draft', 'Needs attention', 'Ready for review', 'Submitted'],
    'Needs attention': ['Draft', 'Needs attention', 'Ready for review', 'Submitted'],
    'Ready for review': ['Draft', 'Needs attention', 'Ready for review', 'Submitted'],
    'Submitted': ['Submitted', 'Approved', 'Returned for revision'],
    'Approved': ['Approved', 'Returned for revision'],
    'Returned for revision': ['Returned for revision', 'Draft', 'Needs attention', 'Ready for review']
  };
  return !!transitions[fromStatus] && transitions[fromStatus].indexOf(toStatus) !== -1;
}

function researchReviewAdmin_(access) {
  var user = access && access.user;
  return typeof isGraduateSchoolAdmin_ === 'function'
    ? isGraduateSchoolAdmin_(user)
    : !!user && user.role === 'Admin';
}

function reviewIssue_(code, message, ploCode, peoCode) {
  var issue = {code: code, message: message, severity: 'critical'};
  if (ploCode) issue.ploCode = ploCode;
  if (peoCode) issue.peoCode = peoCode;
  return issue;
}

function reviewWarning_(code, message, ploCode, peoCode) {
  var issue = reviewIssue_(code, message, ploCode, peoCode);
  issue.severity = 'warning';
  return issue;
}

function researchReviewReferences_(references) {
  var source = references || (typeof getResearchReferences_ === 'function' ? getResearchReferences_() : null);
  if (!source && typeof RESEARCH_REFERENCE_DATA !== 'undefined') {
    source = RESEARCH_REFERENCE_DATA;
  }
  source = source || {};
  return {
    mqf: Array.isArray(source.mqf) ? source.mqf : [],
    tf: Array.isArray(source.tf) ? source.tf : [],
    sdg: Array.isArray(source.sdg) ? source.sdg : [],
    sc: Array.isArray(source.sc) ? source.sc : []
  };
}

function reviewReferenceCodes_(references, key) {
  return references[key].map(function(reference) {
    return String(reference.code || '').trim();
  }).filter(function(code) { return !!code; });
}

function reviewTFMap_(references) {
  return references.tf.reduce(function(result, reference) {
    result[String(reference.code || '').trim()] = Array.isArray(reference.mqfDomains) ? reference.mqfDomains : [];
    return result;
  }, {});
}

function reviewMappingForPLO_(plo, index, mappings) {
  var ploId = String(plo && (plo.ploId || plo.id) || '').trim();
  var ploCode = String(plo && plo.code || '').trim();
  var exact = (mappings || []).filter(function(mapping) {
    var mappingId = String(mapping && mapping.ploId || '').trim();
    var mappingCode = String(mapping && mapping.ploCode || '').trim();
    return (ploId && mappingId === ploId) || (ploCode && mappingCode === ploCode);
  })[0];
  if (exact) return exact;
  if (mappings && mappings.length === 1) return mappings[0];
  return mappings && mappings[index] || null;
}

function reviewPolicyRequires_(policy, key) {
  if (!policy) return false;
  if (policy[key] === true) return true;
  return Array.isArray(policy.required) && policy.required.indexOf(key) !== -1;
}

function validateResearchProgramme_(input) {
  input = input || {};
  var peos = Array.isArray(input.peos) ? input.peos : [];
  var plos = Array.isArray(input.plos) ? input.plos : [];
  var mappings = Array.isArray(input.mappings) ? input.mappings : [];
  var references = researchReviewReferences_(input.references);
  var policy = input.policy || {};
  var critical = [];
  var warnings = [];
  var peoCodes = {};
  var ploCodes = {};
  var mqfCodes = reviewReferenceCodes_(references, 'mqf');
  var tfMap = reviewTFMap_(references);
  var allMQF = [], allTF = [], allSDG = [], allSC = [];
  var statementsComplete = 0;
  var withMQF = 0;
  var withValidTF = 0;
  var withSDG = 0;
  var withSC = 0;
  var peoChildren = {};

  peos.forEach(function(peo) {
    var code = String(peo && peo.code || '').trim();
    if (code) peoCodes[code] = true;
  });

  plos.forEach(function(plo, index) {
    var code = String(plo && plo.code || '').trim();
    var statement = String(plo && plo.statement || '').trim();
    var parent = String(plo && plo.parentPEO || '').trim();
    var domains = uniqueTrimmed_(plo && plo.mqfDomains || []);
    var mapping = reviewMappingForPLO_(plo, index, mappings);
    var sdgIds = uniqueTrimmed_(mapping && mapping.sdgIds || []);
    var scIds = uniqueTrimmed_(mapping && mapping.scIds || []);
    var validDomains = domains.filter(function(domain) { return mqfCodes.indexOf(domain) !== -1; });
    var hasValidMQF = domains.length > 0 && mqfCodes.length > 0 && validDomains.length === domains.length;
    var expectedTF = deriveTFIds_(validDomains, tfMap);
    var actualTF = uniqueTrimmed_(mapping && mapping.derivedTFIds || []);

    if (!code) critical.push(reviewIssue_('PLO_CODE_REQUIRED', 'PLO code is required'));
    else if (ploCodes[code]) critical.push(reviewIssue_('PLO_CODE_DUPLICATE', 'PLO code must be unique: ' + code, code));
    else ploCodes[code] = true;
    if (!statement) critical.push(reviewIssue_('PLO_STATEMENT_REQUIRED', 'PLO statement is required', code));
    else statementsComplete++;
    if (!parent || !peoCodes[parent]) critical.push(reviewIssue_('PLO_PARENT_INVALID', 'PLO parent PEO is invalid: ' + parent, code));
    else peoChildren[parent] = (peoChildren[parent] || 0) + 1;
    if (!domains.length) critical.push(reviewIssue_('PLO_MQF_REQUIRED', 'At least one MQF domain is required', code));
    else {
      if (hasValidMQF) withMQF++;
      domains.forEach(function(domain) {
        if (mqfCodes.indexOf(domain) !== -1) allMQF.push(domain);
        if (!hasValidMQF && mqfCodes.indexOf(domain) === -1) {
          critical.push(reviewIssue_('PLO_MQF_INVALID', 'Invalid MQF domain: ' + domain, code));
        }
      });
    }
    if (statement && statement.length < 20) warnings.push(reviewWarning_('PLO_STATEMENT_BROAD', 'PLO statement may be too broad', code));
    if (sdgIds.length) withSDG++;
    else warnings.push(reviewWarning_('PLO_SDG_MISSING', 'PLO should map to at least one SDG', code));
    if (scIds.length) withSC++;
    else warnings.push(reviewWarning_('PLO_SC_MISSING', 'PLO should map to at least one sustainability competency', code));
    if (hasValidMQF && expectedTF.length && JSON.stringify(expectedTF) !== JSON.stringify(actualTF.sort())) {
      critical.push(reviewIssue_('PLO_TF_DERIVATION_FAILED', 'Derived TF mapping does not match MQF domains', code));
    } else if (hasValidMQF && !expectedTF.length && domains.length) {
      critical.push(reviewIssue_('PLO_TF_DERIVATION_FAILED', 'No TF can be derived from the MQF domains', code));
    } else if (hasValidMQF && expectedTF.length) {
      withValidTF++;
    }
    allTF = allTF.concat(actualTF);
    allSDG = allSDG.concat(sdgIds);
    allSC = allSC.concat(scIds);
  });

  peos.forEach(function(peo) {
    var code = String(peo && peo.code || '').trim();
    if (!code) return;
    if (!peoChildren[code]) critical.push(reviewIssue_('PEO_CHILD_REQUIRED', 'PEO must have at least one child PLO', '', code));
  });
  if (plos.length && uniqueTrimmed_(allMQF).length === 1) warnings.push(reviewWarning_('MQF_DOMAIN_CONCENTRATION', 'PLOs are concentrated in one MQF domain'));
  if (reviewPolicyRequires_(policy, 'sdg') && withSDG < plos.length) critical.push(reviewIssue_('SDG_REQUIRED', 'SDG mapping is required by policy'));
  if (reviewPolicyRequires_(policy, 'sc') && withSC < plos.length) critical.push(reviewIssue_('SC_REQUIRED', 'Sustainability competency mapping is required by policy'));
  if (reviewPolicyRequires_(policy, 'broadStatements') && warnings.some(function(issue) { return issue.code === 'PLO_STATEMENT_BROAD'; })) {
    critical.push(reviewIssue_('BROAD_STATEMENT_REQUIRED', 'Broad PLO statements are not allowed by policy'));
  }

  var status = critical.length ? 'Needs attention' : 'Ready for review';
  return {
    critical: critical,
    warnings: warnings,
    metrics: {
      ploTotal: plos.length,
      ploStatementsComplete: statementsComplete,
      ploWithMQF: withMQF,
      ploWithValidTF: withValidTF,
      ploWithSDG: withSDG,
      ploWithSC: withSC,
      mqfDomainCoverage: uniqueTrimmed_(allMQF).sort().length,
      tfCoverage: uniqueTrimmed_(allTF).sort().length,
      sdgCoverage: uniqueTrimmed_(allSDG).sort().length,
      scCoverage: uniqueTrimmed_(allSC).sort().length,
      peosWithIssues: peos.filter(function(peo) { return !peoChildren[String(peo && peo.code || '').trim()]; }).length
    },
    peoCoverage: peos.map(function(peo) {
      var code = String(peo && peo.code || '').trim();
      return {code: code, ploCount: peoChildren[code] || 0, hasIssues: !peoChildren[code]};
    }),
    status: status
  };
}

function researchReviewDataFromSheets_(key, sheets) {
  var profile = researchRows_(sheets.PR_ProgrammeProfile).filter(function(row) { return String(row[0]) === key; })[0];
  var peos = researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; }).map(peoFromRow_);
  var plos = researchRows_(sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === key; }).map(ploFromRow_);
  var mappings = researchRows_(sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === key; }).map(mappingFromRow_);
  var references = {
    mqf: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_MQFReference, 'mqf')),
    tf: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_TFReference, 'tf')),
    sdg: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_SDGReference, 'sdg')),
    sc: activeResearchReferences_(readResearchReferenceRows_(sheets.PR_SCReference, 'sc'))
  };
  return {profile: profile ? profileFromRow_(profile) : null, peos: peos, plos: plos, mappings: mappings, references: references};
}

function researchReviewData_(mqaCode) {
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var sheets = ensureResearchSheets_();
  return withResearchLock_(function() { return researchReviewDataFromSheets_(key, sheets); });
}

function getResearchReviewApi_(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-review');
  var data = researchReviewData_(mqaCode);
  var result = validateResearchProgramme_(data);
  var profile = data.profile;
  if (profile && !result.critical.length && ['Submitted', 'Approved', 'Returned for revision'].indexOf(profile.mappingStatus) !== -1) {
    result.status = profile.mappingStatus;
  }
  result.updatedAt = serializeResearchDate_(profile && profile.updatedAt);
  result.updatedBy = profile && profile.updatedBy || '';
  return result;
}

function saveResearchStatusApi_(mqaCode, status) {
  var access = requireProgrammeAccess_(mqaCode, 'save-review');
  status = String(status && (status.status || status.mappingStatus) || status || '').trim();
  if (RESEARCH_REVIEW_STATUSES.indexOf(status) === -1) throw new Error('Invalid research review status');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var sheets = ensureResearchSheets_();
  return withResearchLock_(function() {
    var sheet = sheets.PR_ProgrammeProfile;
    var rows = researchRows_(sheet);
    var index = rows.findIndex(function(row) { return String(row[0]) === key; });
    if (index === -1) throw new Error('Research programme profile not found');
    var row = rows[index].slice();
    var currentStatus = String(row[10] || 'Draft').trim();
    if (status === 'Submitted') throw new Error('Submitted requires the guarded submission API');
    if (!isLegalResearchStatusTransition_(currentStatus, status)) {
      throw new Error('Illegal research review status transition');
    }
    if (['Approved', 'Returned for revision'].indexOf(status) !== -1 && !researchReviewAdmin_(access)) {
      throw new Error('Graduate School admin only for terminal review decisions');
    }
    var now = new Date();
    row[10] = status;
    row[12] = now;
    row[13] = (access.user && access.user.email) || '';
    sheet.getRange(index + 2, 1, 1, 14).setValues([row]);
    return {status: status, updatedAt: serializeResearchDate_(now), updatedBy: row[13]};
  });
}

function submitResearchProgrammeApi_(mqaCode) {
  var access = requireProgrammeAccess_(mqaCode, 'submit-review');
  var key = getResearchProgrammeKey_({mqaCode: mqaCode});
  var sheets = ensureResearchSheets_();
  return withResearchLock_(function() {
    var data = researchReviewDataFromSheets_(key, sheets);
    var review = validateResearchProgramme_(data);
    if (review.critical.length) throw new Error('Research programme cannot be submitted: critical review issues remain');
    var rows = researchRows_(sheets.PR_ProgrammeProfile);
    var index = rows.findIndex(function(row) { return String(row[0]) === key; });
    if (index === -1) throw new Error('Research programme profile not found');
    var row = rows[index].slice();
    if (!isLegalResearchStatusTransition_(row[10], 'Submitted')) {
      throw new Error('Research programme is not in a submittable state');
    }
    var now = new Date();
    row[10] = 'Submitted';
    row[12] = now;
    row[13] = (access.user && access.user.email) || '';
    sheets.PR_ProgrammeProfile.getRange(index + 2, 1, 1, 14).setValues([row]);
    return {status: 'Submitted', updatedAt: serializeResearchDate_(now), updatedBy: row[13]};
  });
}
