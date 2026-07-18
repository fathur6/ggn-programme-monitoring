const fs = require('fs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assertContains(source, pattern, message) {
  assert(pattern.test(source), message);
}

const auth = read('gas/Auth.gs');
const code = read('gas/Code.gs');
const governance = read('gas/GovernanceService.gs');
const access = read('gas/AccessRequestService.gs');

assertContains(auth, /isGraduateSchoolAdmin_\s*\(/, 'Missing Graduate School admin capability helper');
assertContains(auth, /canViewProgramme_\s*\(/, 'Missing programme access helper');
assertContains(auth, /requireProgrammeAccess_\s*\(/, 'Missing programme access guard');
assertContains(auth, /capabilities\s*[:=]/, 'Current user does not expose normalized capabilities');

[
  'getPEOsApi',
  'savePEOsApi',
  'getPLOsApi',
  'savePLOsApi',
  'getGraphDataApi',
  'getUploadedFilesApi',
  'uploadFileApi',
  'suggestDeleteFileApi'
].forEach(function(name) {
  const endpoint = new RegExp('function\\s+' + name + '[\\s\\S]*?requireProgrammeAccess_\\s*\\(');
  assertContains(code, endpoint, name + ' is not guarded by requireProgrammeAccess_');
});

assertContains(code, /function\s+approveDeleteFileApi[\s\S]*?isGraduateSchoolAdmin_/, 'Admin delete endpoint is not Graduate School-admin guarded');
assertContains(governance, /function\s+ensureGovernanceSheets_\s*\(/, 'Missing additive governance sheet setup');
assertContains(governance, /function\s+getUniversityDashboardApi_\s*\(/, 'Missing university dashboard API implementation');
assertContains(governance, /MQFDomainState/, 'Dashboard does not monitor MQF Domain state');
assertContains(governance, /TaxonomyState/, 'Dashboard does not monitor Taxonomy state');
assertContains(code, /function\s+getUniversityDashboardApi\s*\(/, 'Missing university dashboard API endpoint');
assertContains(access, /7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, 'Cross-faculty access does not expire after one week');
assertContains(access, /function\s+createAccessRequestApi_\s*\(/, 'Missing access request creation');
assertContains(access, /function\s+decideAccessRequestApi_\s*\(/, 'Missing access request decision');
assertContains(access, /function\s+revokeAccessGrantApi_\s*\(/, 'Missing access grant revocation');
assertContains(access, /getActiveAccessGrant_\s*\(/, 'Missing active access grant lookup');

console.log('MQF rebuild static checks passed.');
