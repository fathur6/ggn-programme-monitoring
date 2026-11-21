const assert = require('assert');
const fs = require('fs');

const healSource = fs.readFileSync('gas/ResearchHealService.gs', 'utf8');
const mappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');
const codeSource = fs.readFileSync('gas/Code.gs', 'utf8');
const jsSource = fs.readFileSync('gas/JavaScript.html', 'utf8');
const indexSource = fs.readFileSync('gas/Index.html', 'utf8');
const stylesSource = fs.readFileSync('gas/Styles.html', 'utf8');

// ---- Service assertions ----
assert(healSource.indexOf('getResearchHealReportApi_') !== -1, 'Heal report API must exist');
assert(healSource.indexOf('getResearchHealDetailApi_') !== -1, 'Heal detail API must exist');
assert(healSource.indexOf('healResearchAssignmentsApi_') !== -1, 'Heal assignments API must exist');
assert(healSource.indexOf('researchHealPLOIssues_') !== -1, 'PLO issue detection must exist');
assert(healSource.indexOf('parentPEO') !== -1, 'parentPEO must be checked');
assert(healSource.indexOf('taxonomy') !== -1, 'taxonomy must be checked');

assert(/status\s*:\s*clean\s*\?\s*['"]Complete['"]\s*:\s*['"]Needs attention['"]/.test(healSource),
  'Heal report must derive Complete/Needs attention status');

assert(!/sdg/i.test(healSource), 'Heal service must not reference SDG');

// ---- Code.gs API wrappers ----
assert(codeSource.indexOf('getResearchHealReportApi()') !== -1, 'Heal report wrapper must be in Code.gs');
assert(codeSource.indexOf('getResearchHealDetailApi(programmeId)') !== -1, 'Heal detail wrapper must be in Code.gs');
assert(codeSource.indexOf('healResearchAssignmentsApi(programmeId, assignments)') !== -1, 'Heal assignments wrapper must be in Code.gs');

// ---- UI assertions ----
assert(/healStatus/.test(jsSource), 'JavaScript must declare healStatus state');
assert(/loadHealReport/.test(jsSource), 'JavaScript must define loadHealReport method');
assert(/getResearchHealReportApi/.test(jsSource), 'JavaScript must call heal report API');
assert(/heal-badge/.test(indexSource), 'Index must render heal badges');
assert(/heal-badge/.test(stylesSource), 'Styles must define heal badge styles');
assert(/heal-ok/.test(stylesSource), 'Styles must define heal-ok state');

// ---- PLO save soft validation (previous fix) ----
assert(!/validatePLOParents_\(normalized,\s*peos\)/.test(mappingSource),
  'saveResearchPLOsApi_ must not call validatePLOParents_');
assert(/plo\.parentPEO\s*&&\s*!peoByCode\[plo\.parentPEO\]/.test(mappingSource),
  'saveResearchPLOsApi_ must have soft parentPEO validation');

// ---- Legacy PLO status (previous fix) ----
assert(/complete\s*=\s*!!\s*\(\s*parentPEO\s*&&\s*taxonomy\s*\)/.test(mappingSource),
  'Legacy PLO completeness must use AND logic');
assert(/Draft.*Needs attention/.test(mappingSource) || /'Draft'\s*:/.test(mappingSource),
  'Legacy PLO must use conditional status');

console.log('Research heal service and UI contract checks passed.');
