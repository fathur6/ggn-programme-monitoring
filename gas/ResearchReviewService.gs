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
    mqf: getResearchReferenceList_(source, 'mqf'),
    tf: getResearchReferenceList_(source, 'tf'),
    sdg: getResearchReferenceList_(source, 'sdg'),
    sc: getResearchReferenceList_(source, 'sc')
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

function reviewSelectedTFIds_(plo, mapping, tfMap) {
  var domains = uniqueTrimmed_(plo && plo.mqfDomains || []);
  var compatible = deriveTFIds_(domains, tfMap);
  var stored = uniqueTrimmed_(mapping && (mapping.tfIds || mapping.derivedTFIds) || []);
  var selected = stored.filter(function(tfId) { return compatible.indexOf(tfId) !== -1; });
  return selected.length ? [selected[0]] : compatible.slice(0, 1);
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
  var peoSDGMappings = Array.isArray(input.peoSDGMappings) ? input.peoSDGMappings : [];
  var references = researchReviewReferences_(input.references);
  var policy = input.policy || {};
  var critical = [];
  var warnings = [];
  var peoCodes = {};
  var ploCodes = {};
  var mqfCodes = reviewReferenceCodes_(references, 'mqf');
  var taxonomyCodes = typeof RESEARCH_TAXONOMY_IDS !== 'undefined' && Array.isArray(RESEARCH_TAXONOMY_IDS)
    ? RESEARCH_TAXONOMY_IDS.map(function(code) { return canonicalResearchTaxonomy_(code); })
    : [];
  var tfMap = reviewTFMap_(references);
  var allMQF = [], allTF = [], allSDG = [], allSC = [];
  var scCategories = {};
  var requiredSCCategories = ['Ways of Thinking', 'Ways of Practicing', 'Ways of Being'];
  var statementsComplete = 0;
  var withMQF = 0;
  var withValidTaxonomy = 0;
  var withValidTF = 0;
  var withSDG = 0;
  var withSC = 0;
  var peoChildren = {};
  var peoStatementsComplete = 0;

  // Build PEO SDG lookup by peoId for PEO-level SDG validation
  var peoSdgById = {};
  peoSDGMappings.forEach(function(mapping) {
    if (mapping && mapping.peoId) peoSdgById[String(mapping.peoId)] = uniqueTrimmed_(mapping.sdgIds || []);
  });

  peos.forEach(function(peo) {
    var code = String(peo && peo.code || '').trim();
    var statement = String(peo && peo.statement || '').trim();
    if (code) peoCodes[code] = true;
    if (code && statement) peoStatementsComplete++;
    if (!statement) critical.push(reviewIssue_('PEO_STATEMENT_REQUIRED', 'PEO statement is required', '', code));
    // PEO-level SDG check
    var peoSDGs = peoSdgById[peo.peoId] || (peo.peoId ? [] : []);
    if (peoSDGs.length) withSDG++;
    else if (code) warnings.push(reviewWarning_('PEO_SDG_MISSING', 'PEO has no SDG mapped — please add at least one SDG', '', code));
    allSDG = allSDG.concat(peoSDGs);
  });

  plos.forEach(function(plo, index) {
    var code = String(plo && plo.code || '').trim();
    var statement = String(plo && plo.statement || '').trim();
    var parent = String(plo && plo.parentPEO || '').trim();
    var domains = uniqueTrimmed_(plo && plo.mqfDomains || []);
    var taxonomy = canonicalResearchTaxonomy_(plo && plo.taxonomy);
    var mapping = reviewMappingForPLO_(plo, index, mappings);
    var scIds = uniqueTrimmed_(mapping && mapping.scIds || []);
    scIds.forEach(function(scId) {
      var reference = references.sc.filter(function(item) { return String(item.code || '').trim() === scId; })[0];
      var category = reference && String(reference.description || '').trim();
      if (requiredSCCategories.indexOf(category) !== -1) scCategories[category] = true;
    });
    var validDomains = domains.filter(function(domain) { return mqfCodes.indexOf(domain) !== -1; });
    var hasValidMQF = domains.length > 0 && mqfCodes.length > 0 && validDomains.length === domains.length;
    var expectedTF = deriveTFIds_(validDomains, tfMap);
    var actualTF = reviewSelectedTFIds_(plo, mapping, tfMap);

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
    if (!taxonomy) critical.push(reviewIssue_('PLO_TAXONOMY_REQUIRED', 'Taxonomy is required', code));
    else if (taxonomyCodes.indexOf(taxonomy) === -1) critical.push(reviewIssue_('PLO_TAXONOMY_INVALID', 'Invalid Taxonomy: ' + taxonomy, code));
    else withValidTaxonomy++;
    if (statement && statement.length < 20) warnings.push(reviewWarning_('PLO_STATEMENT_BROAD', 'PLO statement may be too broad', code));
    if (scIds.length) withSC++;
    else warnings.push(reviewWarning_('PLO_SC_MISSING', 'PLO should map to at least one sustainability competency', code));
    if (hasValidMQF && (actualTF.length !== 1 || actualTF.some(function(tfId) { return expectedTF.indexOf(tfId) === -1; }))) {
      critical.push(reviewIssue_('PLO_TF_DERIVATION_FAILED', 'Select one TF supported by the selected MQF domains', code));
    } else if (hasValidMQF && !expectedTF.length && domains.length) {
      critical.push(reviewIssue_('PLO_TF_DERIVATION_FAILED', 'No TF can be derived from the MQF domains', code));
    } else if (hasValidMQF && expectedTF.length) {
      withValidTF++;
    }
    allTF = allTF.concat(actualTF);
    allSC = allSC.concat(scIds);
  });

  peos.forEach(function(peo) {
    var code = String(peo && peo.code || '').trim();
    if (!code) return;
    if (!peoChildren[code]) critical.push(reviewIssue_('PEO_CHILD_REQUIRED', 'PEO must have at least one child PLO', '', code));
  });
  if (plos.length && uniqueTrimmed_(allMQF).length === 1) warnings.push(reviewWarning_('MQF_DOMAIN_CONCENTRATION', 'PLOs are concentrated in one MQF domain'));
  if (reviewPolicyRequires_(policy, 'sdg') && withSDG < peos.filter(function(peo) { return peo.code; }).length) critical.push(reviewIssue_('SDG_REQUIRED', 'SDG mapping is required by policy'));
  if (reviewPolicyRequires_(policy, 'sc') && withSC < plos.length) critical.push(reviewIssue_('SC_REQUIRED', 'Sustainability competency mapping is required by policy'));
  if (reviewPolicyRequires_(policy, 'broadStatements') && warnings.some(function(issue) { return issue.code === 'PLO_STATEMENT_BROAD'; })) {
    critical.push(reviewIssue_('BROAD_STATEMENT_REQUIRED', 'Broad PLO statements are not allowed by policy'));
  }

  var status = critical.length ? 'Needs attention' : 'Ready for review';
  return {
    critical: critical,
    warnings: warnings,
    metrics: {
      peosTotal: peos.length,
      peoStatementsComplete: peoStatementsComplete,
      peoWithSDG: withSDG,
      ploTotal: plos.length,
      ploStatementsComplete: statementsComplete,
      ploWithMQF: withMQF,
      ploWithValidTaxonomy: withValidTaxonomy,
      ploWithValidTF: withValidTF,
      ploWithSC: withSC,
      mqfDomainCoverage: uniqueTrimmed_(allMQF).sort().length,
      tfCoverage: uniqueTrimmed_(allTF).sort().length,
      sdgCoverage: uniqueTrimmed_(allSDG).sort().length,
      scCoverage: uniqueTrimmed_(allSC).sort().length,
      phase2SDGCount: uniqueTrimmed_(allSDG).sort().length,
      phase2SCCategoryCount: requiredSCCategories.filter(function(category) { return scCategories[category]; }).length,
      peosWithIssues: peos.filter(function(peo) { return !peoChildren[String(peo && peo.code || '').trim()]; }).length
    },
    peoCoverage: peos.map(function(peo) {
      var code = String(peo && peo.code || '').trim();
      return {code: code, ploCount: peoChildren[code] || 0, hasIssues: !peoChildren[code]};
    }),
    status: status
  };
}

function researchReviewDataFromSheets_(key, sheets, references, mqaCodeForLegacy, tabValues) {
  var profile = researchRows_(sheets.PR_ProgrammeProfile).filter(function(row) { return String(row[0]) === key; })[0];
  var peos = researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; }).map(peoFromRow_);
  var plos = researchRows_(sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === key; }).map(ploFromRow_);
  var mappings = researchRows_(sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === key; }).map(mappingFromRow_);
  var peoSDGMappings = sheets.PR_PEOMappings ? researchRows_(sheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === key; }).map(peoMappingFromRow_) : [];
  if ((!peos.length || !plos.length) && mqaCodeForLegacy) {
    var legacy = readLegacyResearchDetail_(getSpreadsheet(), String(mqaCodeForLegacy));
    if (legacy) {
      if (!peos.length) peos = legacy.peos;
      if (!plos.length) plos = legacy.plos;
      if (!mappings.length) mappings = legacyResearchMappings_(legacy, references);
    }
  }
  if (tabValues && tabValues.length) {
    var overridden = autoDetailApplyPhase2Overrides_(peos, plos, mappings, peoSDGMappings, autoDetailReadCells_(tabValues), references);
    mappings = overridden.mappings;
    peoSDGMappings = overridden.peoSDGMappings;
  }
  return {
    profile: profile ? profileFromRow_(profile) : null,
    peos: peos,
    plos: plos,
    mappings: mappings,
    peoSDGMappings: peoSDGMappings,
    references: references || {mqf: [], tf: [], sdg: [], sc: []}
  };
}

/** Snapshot-based review data — rows are pre-fetched once; no per-programme sheet reads. */
function researchReviewDataFromRows_(key, rowSets, references, mqaCodeForLegacy, tabValues) {
  var profile = (rowSets.PR_ProgrammeProfile || []).filter(function(row) { return String(row[0]) === key; })[0];
  var peos = (rowSets.PR_PEORecords || []).filter(function(row) { return String(row[1]) === key; }).map(peoFromRow_);
  var plos = (rowSets.PR_PLORecords || []).filter(function(row) { return String(row[1]) === key; }).map(ploFromRow_);
  var mappings = (rowSets.PR_PLOMappings || []).filter(function(row) { return String(row[1]) === key; }).map(mappingFromRow_);
  var peoSDGMappings = (rowSets.PR_PEOMappings || []).filter(function(row) { return String(row[1]) === key; }).map(peoMappingFromRow_);
  if ((!peos.length || !plos.length) && mqaCodeForLegacy) {
    var legacy = readLegacyResearchDetail_(getSpreadsheet(), String(mqaCodeForLegacy));
    if (legacy) {
      if (!peos.length) peos = legacy.peos;
      if (!plos.length) plos = legacy.plos;
      if (!mappings.length) mappings = legacyResearchMappings_(legacy, references);
    }
  }
  if (tabValues && tabValues.length) {
    var overridden = autoDetailApplyPhase2Overrides_(peos, plos, mappings, peoSDGMappings, autoDetailReadCells_(tabValues), references);
    mappings = overridden.mappings;
    peoSDGMappings = overridden.peoSDGMappings;
  }
  return {
    profile: profile ? profileFromRow_(profile) : null,
    peos: peos,
    plos: plos,
    mappings: mappings,
    peoSDGMappings: peoSDGMappings,
    references: references || {mqf: [], tf: [], sdg: [], sc: []}
  };
}

function researchReviewData_(programmeIdOrMqaCode) {
  // The prepared read boundary supplies seeded references from the lock-free
  // snapshot without reacquiring the script lock.
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var tabValues = autoDetailTabValuesFromSpreadsheet_(getSpreadsheet(), context.mqaCode);
    return researchReviewDataFromSheets_(context.effectiveKey || context.key, context.sheets, context.references, context.mqaCode, tabValues);
  });
}

function researchReviewResultFromData_(data) {
  var result = validateResearchProgramme_(data);
  var profile = data && data.profile;
  if (profile && !result.critical.length && ['Submitted', 'Approved', 'Returned for revision'].indexOf(profile.mappingStatus) !== -1) {
    result.status = profile.mappingStatus;
  }
  result.updatedAt = serializeResearchDate_(profile && profile.updatedAt);
  result.updatedBy = profile && profile.updatedBy || '';
  return result;
}

function getResearchReviewApi_(programmeIdOrMqaCode) {
  requireProgrammeAccess_(programmeIdOrMqaCode, 'view-review');
  var data = researchReviewData_(programmeIdOrMqaCode);
  return researchReviewResultFromData_(data);
}

function saveResearchStatusApi_(programmeIdOrMqaCode, status) {
  // withResearchLock_() remains the compatibility entry point; prepared
  // research contexts route this mutation through the same retry policy.
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'save-review');
  status = String(status && (status.status || status.mappingStatus) || status || '').trim();
  if (RESEARCH_REVIEW_STATUSES.indexOf(status) === -1) throw new Error('Invalid research review status');
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    var sheet = context.sheets.PR_ProgrammeProfile;
    var rows = researchRows_(sheet);
    var index = rows.findIndex(function(row) { return String(row[0]) === context.key; });
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
    row[13] = now;
    row[14] = (access.user && access.user.email) || '';
    sheet.getRange(index + 2, 1, 1, 15).setValues([row]);
    return {status: status, updatedAt: serializeResearchDate_(now), updatedBy: row[14]};
  });
}

function submitResearchProgrammeApi_(programmeIdOrMqaCode) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'submit-review');
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    var data = researchReviewDataFromSheets_(context.effectiveKey || context.key, context.sheets, context.references, context.mqaCode, autoDetailTabValuesFromSpreadsheet_(getSpreadsheet(), context.mqaCode));
    var review = validateResearchProgramme_(data);
    if (review.critical.length) throw new Error('Research programme cannot be submitted: critical review issues remain');
    var rows = researchRows_(context.sheets.PR_ProgrammeProfile);
    var index = rows.findIndex(function(row) { return String(row[0]) === context.key; });
    if (index === -1) throw new Error('Research programme profile not found');
    var row = rows[index].slice();
    if (!isLegalResearchStatusTransition_(row[10], 'Submitted')) {
      throw new Error('Research programme is not in a submittable state');
    }
    var now = new Date();
    row[10] = 'Submitted';
    row[13] = now;
    row[14] = (access.user && access.user.email) || '';
    context.sheets.PR_ProgrammeProfile.getRange(index + 2, 1, 1, 15).setValues([row]);
    return {status: 'Submitted', updatedAt: serializeResearchDate_(now), updatedBy: row[14]};
  });
}
