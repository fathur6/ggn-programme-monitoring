const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeSheet(values) {
  return {
    getDataRange: function() {
      return { getValues: function() { return values; } };
    }
  };
}

function loadAuth(sheets, programmes) {
  const spreadsheet = {
    getSheetByName: function(name) { return sheets[name] || null; }
  };
  const context = {
    console,
    SpreadsheetApp: {
      openById: function() { return spreadsheet; },
      getActiveSpreadsheet: function() { return spreadsheet; }
    },
    findProgrammeByMqaCode_: function(code) { return programmes[code] || null; },
    findProgrammesByMqaCode_: function(code) {
      return Object.keys(programmes).filter(function(key) { return programmes[key].mqaCode === code; }).map(function(key) { return programmes[key]; });
    },
    resolveProgramme_: function(identity) {
      return programmes[identity] || programmes[String(identity || '').trim()] || null;
    }
  };
  vm.runInNewContext(fs.readFileSync('gas/Auth.gs', 'utf8'), context);
  return context;
}

const userEmail = 'user@unisza.edu.my';
const user = [
  ['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Position'],
  ['  FIK  ', '  Faculty User  ', '  USER@UNISZA.EDU.MY  ', 'PIC']
];
const programmes = {
  'MQA/COMPUTING': { faculty: 'FIK', programmeId: 'FIK::CS6001::MQA/COMPUTING', mqaCode: 'MQA/COMPUTING' },
  'MQA/BUSINESS': { faculty: 'FPP', programmeId: 'FPP::BS6001::MQA/BUSINESS', mqaCode: 'MQA/BUSINESS' },
  'FUHA::PL6008::MQA/FA10523': { faculty: 'FUHA', programmeId: 'FUHA::PL6008::MQA/FA10523', mqaCode: 'MQA/FA10523' },
  'FSSG::PS6001::MQA/FA10523': { faculty: 'FSSG', programmeId: 'FSSG::PS6001::MQA/FA10523', mqaCode: 'MQA/FA10523' }
};
const auth = loadAuth({ USER: makeSheet(user) }, programmes);

const facultyUser = auth.lookupUser_(userEmail);
assert.strictEqual(facultyUser.role, 'Faculty User');
assert.strictEqual(facultyUser.faculty, 'FIK');
assert.strictEqual(facultyUser.name, 'Faculty User');
assert.strictEqual(auth.canViewProgramme_(facultyUser, 'MQA/COMPUTING'), true);
assert.strictEqual(auth.canViewProgramme_(facultyUser, 'MQA/BUSINESS'), false);
assert.strictEqual(auth.canViewProgramme_(facultyUser, 'FUHA::PL6008::MQA/FA10523'), false);
assert.strictEqual(auth.canViewProgramme_(facultyUser, 'FUHA::PL6008::MQA/FA10523', {
  email: userEmail, programmeId: 'FSSG::PS6001::MQA/FA10523', mqaCode: 'MQA/FA10523', targetFaculty: 'FSSG'
}), false, 'A grant for a duplicate MQA programme must not authorize another identity');

const blankFaculty = loadAuth({ USER: makeSheet([
  ['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Position'],
  ['', 'Malformed User', userEmail, 'PIC']
]) }, programmes);
assert.strictEqual(blankFaculty.lookupUser_(userEmail), null);

const admin = loadAuth({
  ADMIN: makeSheet([['Name', 'Email', 'Position'], ['Admin User', userEmail, 'UGS Admin']]),
  USER: makeSheet(user)
}, programmes);
const adminUser = admin.decorateUser_(admin.lookupUser_(userEmail));
assert.strictEqual(adminUser.role, 'Admin');
assert.strictEqual(admin.canViewProgramme_(adminUser, 'MQA/BUSINESS'), true);

const legacySourcesIgnored = loadAuth({
  PPS: makeSheet([['Name', 'Email'], ['Legacy Admin', userEmail]]),
  PIC: makeSheet([['Faculty', 'Name', 'Email'], ['FPP', 'Legacy PIC', userEmail]]),
  COOR: makeSheet([['Faculty', 'Name', 'Email'], ['FPP', 'Legacy Coordinator', userEmail]])
}, programmes);
assert.strictEqual(legacySourcesIgnored.lookupUser_(userEmail), null);

console.log('USER/ADMIN access behavior tests passed.');
