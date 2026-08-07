/** Phase2MappingService.gs — Write PEO→SDG, PLO→SC, PLO→TF mapping into each programme detail tab. */

function buildPhase2Output_(programme, key, peoRows, ploRows, peoMappingRows, ploMappingRows, references, definitions) {
  var peoSdgs = {};
  peoMappingRows.forEach(function(row) {
    var sdgs;
    try { sdgs = JSON.parse(row[2] || '[]'); } catch (e) { sdgs = []; }
    if (Array.isArray(sdgs)) peoSdgs[String(row[0])] = sdgs;
  });
  var ploScs = {};
  ploMappingRows.forEach(function(row) {
    var scs;
    try { scs = JSON.parse(row[2] || '[]'); } catch (e) { scs = []; }
    if (Array.isArray(scs)) ploScs[String(row[0])] = scs;
  });
  var tfMap = researchTFReferenceMap_(references);
  var ploTfs = {};
  ploRows.forEach(function(plo) {
    var mqf = parseResearchJson_(plo[5]);
    if (mqf.length) ploTfs[String(plo[0])] = {mqf: mqf, tfIds: deriveTFIds_(mqf, tfMap)};
  });

  var output = [];
  output.push(['']);
  output.push(['### PHASE 2 — COMPLETED MAPPING (AUTO-GENERATED) ###']);
  output.push(['']);

  output.push(['--- PEO → SDG ---']);
  output.push(['PEO Code', 'PEO Statement', 'SDGs']);
  peoRows.forEach(function(peo) {
    var sdgs = peoSdgs[String(peo[0])] || [];
    output.push([String(peo[2] || ''), String(peo[3] || '').substring(0, 80), sdgs.join(', ')]);
  });
  output.push(['']);

  output.push(['--- PLO → SC ---']);
  output.push(['PLO Code', 'PLO Statement', 'SC ID', 'SC Name']);
  ploRows.forEach(function(plo) {
    var scs = ploScs[String(plo[0])] || [];
    if (scs.length) {
      scs.forEach(function(sc) {
        output.push([String(plo[3] || ''), String(plo[4] || '').substring(0, 80), sc, getPhase2SCName_(sc, references)]);
      });
    } else {
      output.push([String(plo[3] || ''), String(plo[4] || '').substring(0, 80), '', '(none)']);
    }
  });
  output.push(['']);

  output.push(['--- PLO → TF ---']);
  output.push(['PLO Code', 'MQF Domains', 'TF ID', 'TF Name']);
  ploRows.forEach(function(plo) {
    var tfInfo = ploTfs[String(plo[0])] || {mqf: [], tfIds: []};
    tfInfo.tfIds.forEach(function(tfId) {
      output.push([String(plo[3] || ''), tfInfo.mqf.join(', '), tfId, getPhase2TFName_(tfId, references)]);
    });
    if (!tfInfo.tfIds.length) {
      output.push([String(plo[3] || ''), tfInfo.mqf.join(', ') || '', '', '(none — no MQF domains)']);
    }
  });
  output.push(['']);

  var projection = assessmentProjection_(programme, definitions, [], references, false);
  output.push(['--- ASSESSMENT (JAPSU) → TF DERIVED FROM MQF ---']);
  output.push(['Instrument', 'Item Code', 'Item Title', 'MQF', 'TF']);
  projection.forEach(function(instrument) {
    instrument.items.forEach(function(item) {
      var mqf = (item.effective && item.effective.mqfDomains) || (item.baseline && item.baseline.mqfDomains) || [];
      var tfs = deriveTFIds_(mqf, tfMap);
      output.push([instrument.name, item.code, item.title, mqf.join(', '), tfs.join(', ')]);
    });
  });
  output.push(['']);
  output.push(['### END PHASE 2 MAPPING — ' + new Date().toISOString() + ' ###']);
  return output;
}

function writePhase2BlockToSheet_(sheet, output) {
  var blockStart = 0, blockEnd = 0;
  var allValues = sheet.getDataRange().getValues();
  for (var r = 0; r < allValues.length; r++) {
    var cell = String(allValues[r][0] || '').trim();
    if (!blockStart && cell.indexOf('### PHASE 2') !== -1) blockStart = r + 1;
    if (blockStart && cell.indexOf('### END PHASE 2 MAPPING') !== -1) { blockEnd = r + 1; break; }
  }

  var startRow;
  if (blockStart > 0) {
    startRow = blockStart;
    if (blockEnd >= blockStart) {
      try { sheet.deleteRows(blockStart, blockEnd - blockStart + 1); } catch (e) {}
      startRow = Math.max(sheet.getLastRow() + 2, 1);
    }
  } else {
    startRow = Math.max(sheet.getLastRow() + 2, 1);
  }

  var outputRange = sheet.getRange(startRow, 1, output.length, 5);
  var padded = output.map(function(row) {
    var r = row.slice();
    while (r.length < 5) r.push('');
    return r.slice(0, 5);
  });
  outputRange.setValues(padded);
  try { sheet.autoResizeColumns(1, 5); } catch (e) {}
  return {startRow: startRow, rowsWritten: output.length};
}

function getPhase2TFName_(tfId, references) {
  var tfs = getResearchReferenceList_(references, 'tf');
  var match = tfs.filter(function(tf) { return tf.code === tfId; })[0];
  return match ? match.title : tfId;
}

function getPhase2SCName_(scId, references) {
  var scs = getResearchReferenceList_(references, 'sc');
  var match = scs.filter(function(sc) { return sc.code === scId; })[0];
  return match ? match.title : scId;
}

function writePhase2MappingApi_(programmeIdOrMqaCode) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'view-programme');
  var programme = resolveProgramme_(programmeIdOrMqaCode);
  if (!programme || !isResearchProgramme_(programme)) throw new Error('Not a postgraduate by research programme');

  var ss = getSpreadsheet();
  var mqaCode = String(programme.mqaCode || '').trim();
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) throw new Error('Detail tab ' + mqaCode + ' not found');

  return withResearchLockRetry_(function() {
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    var assessmentSheets = ensureAssessmentSheetsNoLock_(ss);
    var definitions = assessmentDefinitionsNoLock_(assessmentSheets);
    var key = getResearchProgrammeKey_(programme);

    var peos = researchRows_(researchSheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; });
    var plos = researchRows_(researchSheets.PR_PLORecords).filter(function(row) { return String(row[1]) === key; });
    var peoMappings = researchRows_(researchSheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === key; });
    var ploMappings = researchRows_(researchSheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === key; });

    var output = buildPhase2Output_(programme, key, peos, plos, peoMappings, ploMappings, references, definitions);
    var written = writePhase2BlockToSheet_(sheet, output);
    return {ok: true, programmeId: key, mqaCode: mqaCode, rowsWritten: written.rowsWritten, startRow: written.startRow};
  });
}

function writeAllPhase2MappingsApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');

  var ss = getSpreadsheet();
  var prepared = withResearchLockRetry_(function() {
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    var assessmentSheets = ensureAssessmentSheetsNoLock_(ss);
    var definitions = assessmentDefinitionsNoLock_(assessmentSheets);
    return {
      researchSheets: researchSheets,
      references: references,
      definitions: definitions
    };
  });

  var allPeos = researchRows_(prepared.researchSheets.PR_PEORecords);
  var allPlos = researchRows_(prepared.researchSheets.PR_PLORecords);
  var allPeoMappings = researchRows_(prepared.researchSheets.PR_PEOMappings);
  var allPloMappings = researchRows_(prepared.researchSheets.PR_PLOMappings);

  var programmes = getProgrammes_(null).filter(isResearchProgramme_);
  var results = [];
  var errors = [];

  programmes.forEach(function(programme) {
    try {
      var mqaCode = String(programme.mqaCode || '').trim();
      var sheet = ss.getSheetByName(mqaCode);
      if (!sheet) throw new Error('Detail tab ' + mqaCode + ' not found');
      var key = getResearchProgrammeKey_(programme);

      var peos = allPeos.filter(function(row) { return String(row[1]) === key; });
      var plos = allPlos.filter(function(row) { return String(row[1]) === key; });
      var peoMappings = allPeoMappings.filter(function(row) { return String(row[1]) === key; });
      var ploMappings = allPloMappings.filter(function(row) { return String(row[1]) === key; });

      var output = buildPhase2Output_(programme, key, peos, plos, peoMappings, ploMappings, prepared.references, prepared.definitions);
      var written = writePhase2BlockToSheet_(sheet, output);
      results.push({mqaCode: mqaCode, name: programme.name, rowsWritten: written.rowsWritten});
    } catch (e) {
      errors.push({mqaCode: programme.mqaCode, name: programme.name, error: String(e.message || e)});
    }
  });

  return {
    ok: true,
    total: programmes.length,
    written: results.length,
    errors: errors.length,
    results: results,
    errorDetails: errors
  };
}
