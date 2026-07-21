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
    findProgrammeByMqaCode_: function(code) { return programmes[code] || null; }
  };
  vm.runInNewContext(fs.readFileSync('gas/Auth.gs', 'utf8'), context);
  return context;
}

const coorEmail = 'coor@example.com';
const coor = [
  ['Faculty', 'Name', 'Email'],
  ['  Faculty of Computing  ', '  Dr Coordinator  ', '  COOR@EXAMPLE.COM  ']
];
const programmes = {
  'MQA/COMPUTING': { faculty: 'Faculty of Computing' },
  'MQA/BUSINESS': { faculty: 'Faculty of Business' }
};
const auth = loadAuth({ COOR: makeSheet(coor) }, programmes);

const coordinator = auth.lookupUser(coorEmail);
assert.strictEqual(coordinator.role, 'Faculty Coordinator');
assert.strictEqual(coordinator.faculty, 'Faculty of Computing');
assert.strictEqual(coordinator.name, 'Dr Coordinator');
assert.strictEqual(auth.canViewProgramme_(coordinator, 'MQA/COMPUTING'), true);
assert.strictEqual(auth.canViewProgramme_(coordinator, 'MQA/BUSINESS'), false);

const blankFaculty = loadAuth({ COOR: makeSheet([
  ['Faculty', 'Name', 'Email'],
  ['', 'Malformed Coordinator', coorEmail]
]) }, programmes);
assert.strictEqual(blankFaculty.lookupUser(coorEmail), null);

const ppsPrecedence = loadAuth({
  PPS: makeSheet([['Name', 'Email'], ['Admin', coorEmail]]),
  PIC: makeSheet([['Faculty', 'Coordinator Name', 'Coordinator Email', 'PIC Name', 'PIC Email', 'TDA Name', 'TDA Email']]),
  COOR: makeSheet(coor)
}, programmes);
assert.strictEqual(ppsPrecedence.lookupUser(coorEmail).role, 'Admin');

const picPrecedence = loadAuth({
  PIC: makeSheet([['Faculty', 'Coordinator Name', 'Coordinator Email', 'PIC Name', 'PIC Email', 'TDA Name', 'TDA Email'], ['Faculty of Business', 'Graduate Coordinator', 'PIC@EXAMPLE.COM', 'Faculty PIC', coorEmail, '', '']]),
  COOR: makeSheet(coor)
}, programmes);
assert.strictEqual(picPrecedence.lookupUser(coorEmail).role, 'Faculty PIC');

console.log('COOR access behavior tests passed.');
