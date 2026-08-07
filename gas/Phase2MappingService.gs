/** Phase2MappingService.gs — Write PEO→SDG, PLO→SC, PLO→TF mapping into each programme detail tab. */

function readPhase2PEOs_(key, sheets) {
  return researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; });
}

function readPhase2PLOs_(key, sheets) {
  return researchRows_(sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === key; });
}

function readPhase2PEOSDGs_(key, sheets) {
  var rows = researchRows_(sheets.PR_PEOMappings).filter(function(row) { return String(row[1]) === key; });
  var result = {};
  rows.forEach(function(row) {
    var sdgs;
    try { sdgs = JSON.parse(row[2] || '[]'); } catch (e) { sdgs = []; }
    if (Array.isArray(sdgs)) result[String(row[0])] = sdgs;
  });
  return result;
}

function readPhase2PLOSCs_(key, sheets) {
  var rows = researchRows_(sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === key; });
  var result = {};
  rows.forEach(function(row) {
    var scs;
    try { scs = JSON.parse(row[2] || '[]'); } catch (e) { scs = []; }
    if (Array.isArray(scs)) result[String(row[0])] = scs;
  });
  return result;
}

function readPhase2PLOTFs_(ploRows, references) {
  var tfMap = researchTFReferenceMap_(references);
  var result = {};
  ploRows.forEach(function(plo) {
    var mqf = parseResearchJson_(plo[5]);
    if (mqf.length) {
      var tfs = deriveTFIds_(mqf, tfMap);
      result[String(plo[0])] = {mqf: mqf, tfIds: tfs};
    }
  });
  return result;
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
    var key = getResearchProgrammeKey_(programme);

    var peos = readPhase2PEOs_(key, researchSheets);
    var plos = readPhase2PLOs_(key, researchSheets);
    var peoSdgs = readPhase2PEOSDGs_(key, researchSheets);
    var ploScs = readPhase2PLOSCs_(key, researchSheets);
    var ploTfs = readPhase2PLOTFs_(plos, references);

    // Find existing PHASE 2 block (if any) to overwrite in place
    var blockStart = 0, blockEnd = 0;
    var allValues = sheet.getDataRange().getValues();
    for (var r = 0; r < allValues.length; r++) {
      var cell = String(allValues[r][0] || '').trim();
      if (!blockStart && cell.indexOf('### PHASE 2') !== -1) blockStart = r + 1;
      if (blockStart && cell.indexOf('### END PHASE 2 MAPPING') !== -1) { blockEnd = r + 1; break; }
    }

    // Compute where to write
    var startRow;
    if (blockStart > 0) {
      startRow = blockStart; // overwrite at the previous block's start
    } else {
      var lastRow = sheet.getLastRow();
      startRow = Math.max(lastRow + 2, 1); // append after existing content
    }

    var output = [];
    output.push(['']);
    output.push(['### PHASE 2 — COMPLETED MAPPING (AUTO-GENERATED) ###']);
    output.push(['']);

    // Section 1: PEO → SDG
    output.push(['--- PEO → SDG ---']);
    output.push(['PEO Code', 'PEO Statement', 'SDGs']);
    peos.forEach(function(peo) {
      var sdgs = peoSdgs[String(peo[0])] || [];
      output.push([String(peo[2] || ''), String(peo[3] || '').substring(0, 80), sdgs.join(', ')]);
    });
    output.push(['']);

    // Section 2: PLO → SC
    output.push(['--- PLO → SC ---']);
    output.push(['PLO Code', 'PLO Statement', 'SC ID', 'SC Name']);
    plos.forEach(function(plo) {
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

    // Section 3: PLO → TF
    output.push(['--- PLO → TF ---']);
    output.push(['PLO Code', 'MQF Domains', 'TF ID', 'TF Name']);
    plos.forEach(function(plo) {
      var tfInfo = ploTfs[String(plo[0])] || {mqf: [], tfIds: []};
      tfInfo.tfIds.forEach(function(tfId) {
        output.push([String(plo[3] || ''), tfInfo.mqf.join(', '), tfId, getPhase2TFName_(tfId, references)]);
      });
      if (!tfInfo.tfIds.length) {
        output.push([String(plo[3] || ''), tfInfo.mqf.join(', ') || '', '', '(none — no MQF domains)']);
      }
    });
    output.push(['']);

    // Section 4: Assessment TF derived from MQF
    var definitions = assessmentDefinitionsNoLock_(assessmentSheets);
    var projection = assessmentProjection_(programme, definitions, [], references, false);
    output.push(['--- ASSESSMENT (JAPSU) → TF DERIVED FROM MQF ---']);
    output.push(['Instrument', 'Item Code', 'Item Title', 'MQF', 'TF']);
    var tfMap = researchTFReferenceMap_(references);
    projection.forEach(function(instrument) {
      instrument.items.forEach(function(item) {
        var mqf = (item.effective && item.effective.mqfDomains) || (item.baseline && item.baseline.mqfDomains) || [];
        var tfs = deriveTFIds_(mqf, tfMap);
        output.push([instrument.name, item.code, item.title, mqf.join(', '), tfs.join(', ')]);
      });
    });
    output.push(['']);
    output.push(['### END PHASE 2 MAPPING — ' + new Date().toISOString() + ' ###']);

    // Remove any existing PHASE 2 block so the new one replaces it in place
    if (blockStart > 0 && blockEnd >= blockStart) {
      try { sheet.deleteRows(blockStart, blockEnd - blockStart + 1); } catch (e) {}
      var lastRowAfterDelete = sheet.getLastRow();
      startRow = Math.max(lastRowAfterDelete + 2, 1);
    }

    // Write output starting at startRow
    var outputRange = sheet.getRange(startRow, 1, output.length, 5);
    outputRange.setValues(output);

    // Auto-resize columns for readability
    try { sheet.autoResizeColumns(1, 5); } catch (e) {}

    return {ok: true, programmeId: key, mqaCode: mqaCode, rowsWritten: output.length, startRow: startRow};
  });
}

function writeAllPhase2MappingsApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');

  var programmes = getProgrammes_(null).filter(isResearchProgramme_);
  var results = [];
  var errors = [];

  programmes.forEach(function(programme) {
    try {
      var result = writePhase2MappingApi_(programme.mqaCode);
      results.push({mqaCode: programme.mqaCode, name: programme.name, rowsWritten: result.rowsWritten});
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
