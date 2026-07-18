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

console.log('MQF rebuild static checks passed.');
