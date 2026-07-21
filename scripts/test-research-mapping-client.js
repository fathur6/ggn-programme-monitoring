const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/JavaScript.html', 'utf8');
const index = fs.readFileSync('gas/Index.html', 'utf8');

function methodSource(name) {
  const start = source.indexOf(name + ': function');
  assert(start >= 0, 'Missing client method: ' + name);
  const next = source.indexOf('\n    },', start);
  return source.slice(start, next < 0 ? source.length : next);
}

assert(/researchLoading:\s*false/.test(source), 'Research loading state is missing');
assert(/researchError:\s*null/.test(source), 'Research error state is missing');
assert(/researchLoading\s*=\s*true/.test(methodSource('loadResearchWorkspace')), 'Workspace loading does not start before API calls');
assert(/researchLoading\s*=\s*false/.test(methodSource('loadResearchWorkspace')), 'Workspace loading does not finish after API calls');
assert(/researchError\s*=/.test(methodSource('loadResearchWorkspace')), 'Workspace failures are not retained in state');
assert(/researchError/.test(index), 'Workspace error state is not actionable in the UI');
assert(/researchSaveState\s*=\s*['"]loading['"]/.test(methodSource('loadResearchWorkspace')), 'Workspace is marked ready before loading starts');

const mappingSave = methodSource('saveResearchPLOMapping');
assert(/saveResearchPLOsApi/.test(mappingSave), 'Mapping save does not persist PLO fields first');
assert(/ploId/.test(mappingSave), 'Mapping save does not use a persisted PLO id');
assert(/saveResearchPLOMappingApi/.test(mappingSave), 'Mapping save API is missing');
assert(/sdgIds/.test(mappingSave) && /scIds/.test(mappingSave), 'Explicit SDG and SC selections are not persisted');
assert(/parentPEO/.test(mappingSave) && /statement/.test(mappingSave), 'PLO parent or statement is not included in save flow');
assert(/mqfDomains/.test(mappingSave) && /taxonomy/.test(mappingSave) && /rationale/.test(mappingSave), 'Complete PLO field set is not included in save flow');
assert(/savedPLO/.test(mappingSave), 'Mapping save does not resolve the server-returned PLO');
assert(/researchMutationComplete/.test(mappingSave) && /refreshResearchDerived/.test(methodSource('researchMutationComplete')), 'Mapping save does not refresh server-derived state');

const ploSave = methodSource('saveResearchPLOs');
assert(/parentPEO/.test(ploSave) && /statement/.test(ploSave) && /mqfDomains/.test(ploSave), 'PLO API payload omits core editable fields');
assert(/taxonomy/.test(ploSave) && /rationale/.test(ploSave), 'PLO API payload omits taxonomy or rationale');
assert(/researchMutationComplete/.test(ploSave) && /refreshResearchDerived/.test(methodSource('researchMutationComplete')), 'PLO save does not refresh server-derived state');

console.log('Research mapping client regression checks passed.');
