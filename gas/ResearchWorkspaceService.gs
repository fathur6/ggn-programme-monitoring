/** ResearchWorkspaceService.gs — aggregate, read-only research workspace RPC. */

var RESEARCH_WORKSPACE_ENDPOINTS = ['profile', 'peos', 'plos', 'references'];

function researchWorkspaceStableErrorCode_(error, endpoint, namespace) {
  var explicit = String(error && error.code || '').trim();
  if (explicit === 'RESEARCH_LOCK_BUSY') return explicit;
  var message = String(error && error.message || error || '').toLowerCase();
  if (explicit === 'UNAUTHORIZED' || message.indexOf('unauthorized') !== -1) return 'RESEARCH_UNAUTHORIZED';
  if (explicit === 'FORBIDDEN' || message.indexOf('forbidden') !== -1) return 'RESEARCH_FORBIDDEN';
  var prefix = namespace || 'RESEARCH';
  var suffix = endpoint ? String(endpoint).toUpperCase().replace(/[^A-Z0-9]+/g, '_') : 'WORKSPACE';
  return prefix + '_' + suffix + '_FAILED';
}

function researchWorkspaceSafeMessage_(code, endpoint) {
  if (code === 'RESEARCH_LOCK_BUSY') return 'System is busy. Please try again.';
  if (code === 'RESEARCH_UNAUTHORIZED') return 'Unauthorized.';
  if (code === 'RESEARCH_FORBIDDEN') return 'Unable to access this research programme.';
  if (endpoint) return 'Unable to load the ' + endpoint + ' section.';
  return 'Unable to load the research workspace.';
}

function researchWorkspaceEndpointEnvelope_(endpoint, producer, options) {
  options = options || {};
  var diagnosticEndpoint = options.diagnosticEndpoint || endpoint;
  try {
    return {ok: true, data: producer(), error: null, retryable: false};
  } catch (error) {
    var code = options.code || researchWorkspaceStableErrorCode_(error, endpoint, options.namespace);
    var message = researchWorkspaceSafeMessage_(code, diagnosticEndpoint);
    var diagnostic = String(error && error.message || error || 'Unknown error');
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ResearchWorkspace] endpoint=' + diagnosticEndpoint + ' code=' + code + ' message=' + diagnostic + (error && error.stack ? '\n' + error.stack : ''));
    }
    return {
      ok: false,
      data: null,
      error: {endpoint: diagnosticEndpoint, code: code, message: message},
      retryable: code === 'RESEARCH_LOCK_BUSY' || !!(error && error.retryable)
    };
  }
}

function researchWorkspaceThrowSafe_(error, endpoint) {
  var code = researchWorkspaceStableErrorCode_(error, endpoint);
  var safe = new Error(researchWorkspaceSafeMessage_(code, endpoint));
  safe.name = 'ResearchWorkspaceError';
  safe.code = code;
  safe.retryable = code === 'RESEARCH_LOCK_BUSY' || !!(error && error.retryable);
  safe.userMessage = safe.message;
  if (typeof console !== 'undefined' && console.error) {
    console.error('[ResearchWorkspace] endpoint=' + (endpoint || 'setup') + ' code=' + code + ' message=' + String(error && error.message || error || 'Unknown error'));
  }
  throw safe;
}

function researchWorkspaceSnapshot_(programmeIdOrMqaCode) {
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var rows = researchWorkspaceRowsSnapshotNoLock_(context.sheets);
    var hasLegacyRows = !rows.PR_PEORecords.length || !rows.PR_PLORecords.length;
    return {
      programme: context.programme,
      key: context.key,
      references: context.references,
      rows: rows,
      legacy: hasLegacyRows ? readLegacyResearchDetail_(getSpreadsheet(), context.programme.mqaCode) : null
    };
  });
}

function researchWorkspaceProfileFromSnapshot_(snapshot, access) {
  var row = snapshot.rows.PR_ProgrammeProfile.filter(function(item) { return String(item[0]) === snapshot.key; })[0];
  if (row) return profileFromRow_(row);
  var programme = snapshot.programme;
  return {
    programmeId: snapshot.key,
    mqaCode: programme.mqaCode,
    facultyOrCentre: programme.faculty || programme.facultyFull || '',
    programmeName: programme.name || '',
    studyLevel: programme.level || '',
    studyMode: 'Postgraduate by Research',
    studyField: '', session: '', documentVersion: '', dataOwner: '', mappingStatus: 'Draft', defaultSDGIds: [],
    createdAt: '', updatedAt: '', updatedBy: researchUser_(access).email || ''
  };
}

function researchWorkspacePEOsFromSnapshot_(snapshot) {
  var peos = snapshot.rows.PR_PEORecords.filter(function(row) { return String(row[1]) === snapshot.key; }).map(peoFromRow_);
  return peos.length || !snapshot.legacy ? peos : snapshot.legacy.peos;
}

function researchWorkspacePLOsFromSnapshot_(snapshot) {
  var plos = snapshot.rows.PR_PLORecords.filter(function(row) { return String(row[1]) === snapshot.key; }).map(ploFromRow_);
  return plos.length || !snapshot.legacy ? plos : snapshot.legacy.plos;
}

function researchWorkspaceMappingsFromSnapshot_(snapshot, plos) {
  var rows = snapshot.rows.PR_PLOMappings.filter(function(row) { return String(row[1]) === snapshot.key; });
  if (!plos.length && snapshot.legacy) return legacyResearchMappings_(snapshot.legacy, snapshot.references);
  return researchMappingsFromRows_(rows, plos, snapshot.references);
}

function researchWorkspaceCoverageFromSnapshot_(snapshot, peos, plos, mappings) {
  var effectivePeos = peos;
  var effectivePlos = plos;
  var effectiveMappings = mappings;
  if ((!effectivePeos.length || !effectivePlos.length) && snapshot.legacy) {
    effectivePeos = effectivePeos.length ? effectivePeos : snapshot.legacy.peos;
    effectivePlos = effectivePlos.length ? effectivePlos : snapshot.legacy.plos;
    effectiveMappings = legacyResearchMappings_(snapshot.legacy, snapshot.references);
  }
  var mapped = effectivePlos.map(function(plo) {
    return researchMappingForPLO_(plo, effectiveMappings.filter(function(mapping) {
      return mapping.ploId === plo.ploId;
    })[0] || {scIds: [], derivedTFIds: []}, snapshot.references);
  });
  // Read SDG from PEO mappings (programme-level) instead of PLO mappings
  var peoMappingRows = snapshot.rows.PR_PEOMappings || [];
  var peoSdgIds = peoMappingRows.filter(function(row) { return String(row[1]) === snapshot.key; }).reduce(function(all, row) {
    var sdgs; try { sdgs = JSON.parse(row[2] || '[]'); } catch (e) { sdgs = []; }
    if (Array.isArray(sdgs)) return all.concat(sdgs);
    return all;
  }, []);
  return {
    peoCoverage: effectivePeos.map(function(peo) {
      try { return {peoId: peo.peoId, code: peo.code, coverage: calculatePEOCoverage_(mapped, peo.code)}; }
      catch (error) { return {peoId: peo.peoId, code: peo.code, issue: error.message}; }
    }),
    globalCoverage: {
      mqfIds: uniqueTrimmed_(effectivePlos.reduce(function(all, plo) { return all.concat(plo.mqfDomains); }, [])).sort(),
      tfIds: uniqueTrimmed_(mapped.reduce(function(all, mapping) { return all.concat(mapping.derivedTFIds || []); }, [])).sort(),
      sdgIds: uniqueTrimmed_(peoSdgIds).sort(),
      scIds: uniqueTrimmed_(mapped.reduce(function(all, mapping) { return all.concat(mapping.scIds || []); }, [])).sort()
    },
    ploReadiness: effectivePlos.map(function(plo) {
      var mapping = effectiveMappings.filter(function(item) { return item.ploId === plo.ploId; })[0];
      return {ploId: plo.ploId, code: plo.code, ready: !!mapping, issue: mapping ? '' : 'PLO mapping is required'};
    })
  };
}

function researchWorkspaceReviewFromSnapshot_(snapshot, profile, peos, plos, mappings, peoSDGMappings) {
  return researchReviewResultFromData_({
    profile: profile,
    peos: peos,
    plos: plos,
    mappings: mappings,
    peoSDGMappings: peoSDGMappings,
    references: snapshot.references
  });
}

function getResearchWorkspaceApi_(programmeIdOrMqaCode) {
  var access;
  try {
    access = requireResearchProgrammeAccess_(programmeIdOrMqaCode, 'view-research-workspace');
    var snapshot = researchWorkspaceSnapshot_(programmeIdOrMqaCode);
    var endpointData = {
      profile: function() { return researchWorkspaceProfileFromSnapshot_(snapshot, access); },
      peos: function() { return researchWorkspacePEOsFromSnapshot_(snapshot); },
      plos: function() { return researchWorkspacePLOsFromSnapshot_(snapshot); },
      references: function() { return snapshot.references; },
      mappings: function() {
        var plos = researchWorkspacePLOsFromSnapshot_(snapshot);
        return researchWorkspaceMappingsFromSnapshot_(snapshot, plos);
      },
      coverage: function() {
        var peos = researchWorkspacePEOsFromSnapshot_(snapshot);
        var plos = researchWorkspacePLOsFromSnapshot_(snapshot);
        var mappings = researchWorkspaceMappingsFromSnapshot_(snapshot, plos);
        return researchWorkspaceCoverageFromSnapshot_(snapshot, peos, plos, mappings);
      },
      review: function() {
        var profile = researchWorkspaceProfileFromSnapshot_(snapshot, access);
        var peos = researchWorkspacePEOsFromSnapshot_(snapshot);
        var plos = researchWorkspacePLOsFromSnapshot_(snapshot);
        var mappings = researchWorkspaceMappingsFromSnapshot_(snapshot, plos);
        var peoSDGMappings = (snapshot.rows.PR_PEOMappings || []).filter(function(row) { return String(row[1]) === snapshot.key; }).map(peoMappingFromRow_);
        return researchWorkspaceReviewFromSnapshot_(snapshot, profile, peos, plos, mappings, peoSDGMappings);
      }
    };
    var endpoints = RESEARCH_WORKSPACE_ENDPOINTS.reduce(function(result, endpoint) {
      result[endpoint] = researchWorkspaceEndpointEnvelope_(endpoint, endpointData[endpoint]);
      return result;
    }, {});
    return {ok: true, programmeId: snapshot.key, endpoints: endpoints};
  } catch (error) {
    return researchWorkspaceThrowSafe_(error);
  }
}
