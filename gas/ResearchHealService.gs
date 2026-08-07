/** ResearchHealService.gs — programme heal report, detail, and bulk assignment */

var RESEARCH_HEAL_SEVERITY = ['Complete', 'Needs attention'];

function researchHealRowsFromLegacy_(programme, references) {
  var detail = readLegacyResearchDetail_(getSpreadsheet(), programme.mqaCode);
  if (!detail) return {peos: [], plos: [], mappings: []};
  var mappings = legacyResearchMappings_(detail, references);
  return {peos: detail.peos, plos: detail.plos, mappings: mappings};
}

function researchHealRowsFromSheets_(key, sheets, references) {
  var peos = researchRows_(sheets.PR_PEORecords).filter(function(row) { return String(row[1]) === key; }).map(peoFromRow_);
  var plos = researchRows_(sheets.PR_PLORecords).filter(function(row) { return String(row[1]) === key; }).map(ploFromRow_);
  var mappings = researchRows_(sheets.PR_PLOMappings).filter(function(row) { return String(row[1]) === key; }).map(mappingFromRow_);
  if (!plos.length) {
    return researchHealRowsFromLegacy_({mqaCode: String(key).split('::').pop()}, references);
  }
  return {peos: peos, plos: plos, mappings: mappings};
}

function researchHealPLOIssues_(plo) {
  var issues = [];
  if (!String(plo.parentPEO || '').trim()) issues.push('parentPEO');
  if (!canonicalResearchTaxonomy_(plo.taxonomy)) issues.push('taxonomy');
  if (!(plo.mqfDomains || []).length) issues.push('mqf');
  return issues;
}

function getResearchHealReportApi_() {
  var access = requireProgrammeAccess_('university', 'view-heal');
  var programmes = getProgrammes_().filter(isResearchProgramme_);
  return withResearchLockRetry_(function() {
    var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
    var references = getResearchReferencesNoLock_(sheets);
    var summary = programmes.map(function(programme) {
      var key = getResearchProgrammeKey_(programme);
      var rows = researchHealRowsFromSheets_(key, sheets, references);
      var ploIssues = rows.plos.map(function(plo) {
        return {code: plo.code, issues: researchHealPLOIssues_(plo)};
      });
      var missingParentPEO = ploIssues.filter(function(p) { return p.issues.indexOf('parentPEO') !== -1; }).length;
      var missingTaxonomy = ploIssues.filter(function(p) { return p.issues.indexOf('taxonomy') !== -1; }).length;
      var missingMQF = ploIssues.filter(function(p) { return p.issues.indexOf('mqf') !== -1; }).length;
      var clean = !missingParentPEO && !missingTaxonomy && !missingMQF && rows.peos.length > 0 && rows.plos.length > 0;
      return {
        mqaCode: programme.mqaCode,
        programmeName: programme.name,
        faculty: programme.faculty || programme.facultyFull || '',
        level: programme.level,
        peoCount: rows.peos.length,
        ploCount: rows.plos.length,
        missingParentPEO: missingParentPEO,
        missingTaxonomy: missingTaxonomy,
        missingMQF: missingMQF,
        status: clean ? 'Complete' : 'Needs attention'
      };
    });
    return {
      generatedAt: serializeResearchDate_(new Date()),
      totalProgrammes: summary.length,
      complete: summary.filter(function(p) { return p.status === 'Complete'; }).length,
      needsAttention: summary.filter(function(p) { return p.status === 'Needs attention'; }).length,
      programmes: summary
    };
  });
}

function getResearchHealDetailApi_(programmeIdOrMqaCode) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'view-heal');
  return withPreparedResearchReadContext_(programmeIdOrMqaCode, function(context) {
    var rows = researchHealRowsFromSheets_(context.key, context.sheets, context.references);
    var plos = rows.plos.map(function(plo) {
      var issues = researchHealPLOIssues_(plo);
      return {
        ploId: plo.ploId,
        code: plo.code,
        statement: plo.statement,
        parentPEO: plo.parentPEO,
        taxonomy: plo.taxonomy,
        mqfDomains: plo.mqfDomains,
        issues: issues,
        healable: issues.length > 0
      };
    });
    return {
      mqaCode: context.programme.mqaCode,
      programmeName: context.programme.name,
      faculty: context.programme.faculty || context.programme.facultyFull || '',
      peos: rows.peos.map(function(peo) { return {code: peo.code, statement: peo.statement}; }),
      plos: plos,
      plosWithIssues: plos.filter(function(p) { return p.healable; }).length,
      ploTotal: plos.length
    };
  });
}

function healResearchAssignmentsApi_(programmeIdOrMqaCode, assignments) {
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-heal');
  var user = researchUser_(access);
  var list = Array.isArray(assignments) ? assignments : [];
  if (!list.length) throw new Error('At least one PLO assignment is required');
  return withPreparedResearchContext_(programmeIdOrMqaCode, function(context) {
    var peoByCode = researchRows_(context.sheets.PR_PEORecords).filter(function(row) {
      return String(row[1]) === context.key;
    }).reduce(function(result, row) {
      result[String(row[2]).trim()] = row;
      return result;
    }, {});
    var ploRows = researchRows_(context.sheets.PR_PLORecords).filter(function(row) {
      return String(row[1]) === context.key;
    });
    var ploByCode = {};
    ploRows.forEach(function(row, index) {
      ploByCode[String(row[3]).trim()] = {row: row, rowIndex: index};
    });
    var now = new Date();
    var changed = 0;
    var sheet = context.sheets.PR_PLORecords;
    list.forEach(function(assignment) {
      var ploCode = String(assignment && assignment.ploCode || '').trim();
      var parentPEO = String(assignment && assignment.parentPEO || '').trim();
      var taxonomy = canonicalResearchTaxonomy_(assignment && assignment.taxonomy);
      if (!ploCode) return;
      var entry = ploByCode[ploCode];
      if (!entry) throw new Error('PLO not found in programme: ' + ploCode);
      var row = entry.row;
      var needsUpdate = false;
      if (parentPEO && peoByCode[parentPEO]) {
        if (String(row[2]).trim() !== parentPEO) { row[2] = parentPEO; needsUpdate = true; }
      } else if (parentPEO) {
        throw new Error('Invalid parent PEO: ' + parentPEO);
      }
      if (taxonomy) {
        if (typeof RESEARCH_TAXONOMY_IDS !== 'undefined' && RESEARCH_TAXONOMY_IDS.indexOf(taxonomy) === -1) {
          throw new Error('Invalid taxonomy: ' + taxonomy);
        }
        if (canonicalResearchTaxonomy_(row[6]) !== taxonomy) { row[6] = taxonomy; needsUpdate = true; }
      }
      if (needsUpdate) {
        row[9] = now;
        row[10] = user.email || '';
        sheet.getRange(entry.rowIndex + 2, 1, 1, 11).setValues([row]);
        RESEARCH_ROWS_CACHE_ = {};
        changed++;
      }
    });
    return {changed: changed, total: list.length, updatedAt: serializeResearchDate_(now), updatedBy: user.email || ''};
  });
}
