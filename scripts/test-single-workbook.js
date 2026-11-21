/**
 * Single-workbook guard for the programme monitoring web app (gas/Code.js).
 *
 * The app was consolidated onto one spreadsheet: programme records, the USER /
 * ADMIN login directory and the PDF destination all belong to the same
 * workbook. This test fails if a second spreadsheet ID is reintroduced, if the
 * directory readers bypass programmeSpreadsheet_(), or if the PDF folder
 * constant drifts.
 */

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const WORKBOOK_ID = '1w5xrwoLJ7HpSZ_emgwqoGr-YcRVb7Zuq3KuDSmhUf6o';
const GRADUATE_SCHOOL_DIRECTORY_ID = '1CZyEFe7VqEWp8V4UYnQ-6fQMATDF0X0JUN09XbWmfrQ';
const PDF_FOLDER_ID = '1W6FeqkIyIj_rTi8IzrbM7DLb1qprAX57';

const source = fs.readFileSync('gas/Code.js', 'utf8');

function makeSheet(values) {
  return {
    getDataRange: function() {
      return { getValues: function() { return values; } };
    }
  };
}

let activeEmail = '';

function loadApp(sheets, openedIds) {
  const spreadsheet = {
    getSheetByName: function(name) { return sheets[name] || null; }
  };
  const cache = {};
  const context = {
    console: console,
    SpreadsheetApp: {
      openById: function(id) {
        openedIds.push(id);
        if (id !== WORKBOOK_ID) throw new Error('Unexpected workbook: ' + id);
        return spreadsheet;
      }
    },
    CacheService: {
      getScriptCache: function() {
        return {
          get: function(key) { return cache[key] || null; },
          put: function(key, value) { cache[key] = value; }
        };
      }
    },
    Utilities: {
      getUuid: function() {
        return '00000000-0000-4000-8000-' + String(Math.random()).slice(2, 14);
      }
    },
    Session: {
      getActiveUser: function() {
        return { getEmail: function() { return activeEmail; } };
      }
    }
  };
  vm.runInNewContext(source, context);
  return context;
}

const userRows = [
  ['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Position'],
  ['  FBK  ', '  DR. COORDINATOR  ', '  coordinator@unisza.edu.my  ', 'Graduate Coordinator'],
  ['FBK', 'FACULTY PIC', 'pic@unisza.edu.my', 'Faculty PIC']
];
const adminRows = [
  ['Name', 'Email', 'Position'],
  ['DR. DEAN', 'dean@unisza.edu.my', 'Dean'],
  ['DR. NO EMAIL', '', 'Deputy Dean (Academic)']
];

// 1. Exactly one spreadsheet ID literal, and it is the agreed workbook.
const idLiterals = [...source.matchAll(/'(\d{1,3}[\w-]{20,})'/g)]
  .map(function(match) { return match[1]; })
  .filter(function(value) { return /^[A-Za-z0-9_-]{30,}$/.test(value); });
const uniqueIds = Array.from(new Set(idLiterals));
assert.deepStrictEqual(
  uniqueIds.sort(),
  [WORKBOOK_ID, PDF_FOLDER_ID].sort(),
  'gas/Code.js must reference exactly one workbook ID plus the PDF folder ID'
);
assert(
  source.indexOf(GRADUATE_SCHOOL_DIRECTORY_ID) === -1,
  'The retired Graduate School directory spreadsheet must not be referenced'
);
assert(
  source.indexOf("var PROGRAMME_SPREADSHEET_ID_ = '" + WORKBOOK_ID + "'") !== -1,
  'PROGRAMME_SPREADSHEET_ID_ must point at the app workbook'
);
assert(
  source.indexOf("var PDF_FOLDER_ID_ = '" + PDF_FOLDER_ID + "'") !== -1,
  'PDF_FOLDER_ID_ must stay unchanged'
);

// 2. Directory readers must go through the shared workbook accessor.
const directoryOpeners = source.match(/SpreadsheetApp\.openById\(([^)]*)\)/g) || [];
assert.deepStrictEqual(
  directoryOpeners,
  ['SpreadsheetApp.openById(PROGRAMME_SPREADSHEET_ID_)'],
  'All spreadsheet access must go through programmeSpreadsheet_()'
);
assert(
  /function userDirectoryEntries_\(\) \{\s*var sheet = programmeSpreadsheet_\(\)/.test(source),
  'userDirectoryEntries_ must read the shared workbook'
);
assert(
  /function adminDirectoryEntries_\(\) \{\s*var sheet = programmeSpreadsheet_\(\)/.test(source),
  'adminDirectoryEntries_ must read the shared workbook'
);

// 3. PDF generation must still resolve the configured destination folder.
assert(
  /function getPdfFolder_\(\) \{\s*var folder = DriveApp\.getFolderById\(PDF_FOLDER_ID_\)/.test(source),
  'getPdfFolder_ must use PDF_FOLDER_ID_'
);

// 4. Runtime behaviour against a stubbed workbook.
const openedIds = [];
const app = loadApp({ USER: makeSheet(userRows), ADMIN: makeSheet(adminRows) }, openedIds);

const users = app.userDirectoryEntries_();
assert.strictEqual(users.length, 2, 'Both USER rows should be readable');
assert.strictEqual(users[0].faculty, 'FBK');
assert.strictEqual(users[0].username, 'coordinator');
assert.strictEqual(users[0].position, 'Graduate Coordinator');

const admins = app.adminDirectoryEntries_();
assert.strictEqual(admins.length, 1, 'ADMIN rows without an email are not login accounts');
assert.strictEqual(admins[0].username, 'dean');

activeEmail = 'dean@unisza.edu.my';
const adminWithEmail = app.getGoogleSessionApi();
assert.strictEqual(adminWithEmail.ok, true, 'An ADMIN email must sign in');
assert.strictEqual(adminWithEmail.user.isAdmin, true);
assert.strictEqual(app.requireLogin_(adminWithEmail.token).email, 'dean@unisza.edu.my');

activeEmail = 'COORDINATOR@UNISZA.EDU.MY';
const userSession = app.getGoogleSessionApi();
assert.strictEqual(userSession.ok, true, 'Directory lookup must be case-insensitive');
assert.strictEqual(userSession.user.isAdmin, false);
assert.strictEqual(userSession.user.faculty, 'FBK');

activeEmail = 'outsider@gmail.com';
const wrongDomain = app.getGoogleSessionApi();
assert.strictEqual(wrongDomain.ok, false);
assert.strictEqual(wrongDomain.reason, 'wrong_domain');

activeEmail = 'unlisted@unisza.edu.my';
const notRegistered = app.getGoogleSessionApi();
assert.strictEqual(notRegistered.ok, false);
assert.strictEqual(notRegistered.reason, 'not_registered');

activeEmail = '';
const noSession = app.getGoogleSessionApi();
assert.strictEqual(noSession.ok, false);
assert.strictEqual(noSession.reason, 'no_google_session');

// Passwords and dropdown logins must be gone for good.
assert(source.indexOf('function loginApi') === -1, 'Username/password login must not exist');
assert(source.indexOf('getLoginDirectoryApi') === -1, 'Directory dropdown endpoint must not exist');

// 5. Directory and programme data share ONE workbook open.
assert.deepStrictEqual(
  Array.from(new Set(openedIds)),
  [WORKBOOK_ID],
  'USER and ADMIN must be read from the same workbook as the programme data'
);

console.log('single-workbook guard: OK');
