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

// 6. Multi-page routing: real URLs, server-resolved session, no SPA view switch.
assert(
  /if \(page === 'detail'\)/.test(source) && /renderProgrammeDetailPage_/.test(source),
  'doGet must route the detail page'
);
assert(
  /if \(!session\.ok\) \{[\s\S]*?return renderAccessPage_\(session\);/.test(source),
  'doGet must render the access page before any data work'
);

// A personal Google account must reach our sign-in prompt, not a Google error page.
const manifest = JSON.parse(fs.readFileSync('gas/appsscript.json', 'utf8'));
assert.strictEqual(manifest.webapp.access, 'ANYONE', 'Deployment must accept any Google account so we can prompt');
assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
assert(/accounts\.google\.com\/AccountChooser\?continue=/.test(source), 'Access page must offer an account chooser');
const accessPage = fs.readFileSync('gas/AccessDenied.html', 'utf8');
assert(accessPage.indexOf('Pilih akaun Google UniSZA') !== -1, 'Access page must show the UniSZA sign-in button');
assert(accessPage.indexOf('signInUrl') !== -1, 'Access page must use the injected sign-in URL');
assert(
  source.indexOf('function renderAccessPage_') !== -1,
  'AccessDenied page renderer must exist'
);

const templates = ['Index.html', 'Styles.html', 'AppJs.html', 'PageProgrammes.html', 'PageProgrammeDetail.html', 'AccessDenied.html'];
templates.forEach(function(file) {
  assert(fs.existsSync('gas/' + file), 'missing template gas/' + file);
});

const index = fs.readFileSync('gas/Index.html', 'utf8');
assert(index.indexOf("include(pageFile)") !== -1, 'Index.html must include the routed page');
assert(index.indexOf('<?!= bootstrap ?>') !== -1, 'Index.html must inject the bootstrap payload');
assert(index.indexOf("include('Styles')") !== -1, 'Index.html must include Styles.html');
assert(index.indexOf("include('AppJs')") !== -1, 'Index.html must include AppJs.html');

const appJs = fs.readFileSync('gas/AppJs.html', 'utf8');
assert(appJs.indexOf('currentView') === -1, 'Client must not switch views in memory');
assert(appJs.indexOf('loginApi') === -1, 'Client must not call the removed login');
assert(appJs.indexOf('?page=detail') !== -1, 'Client must link to the detail page URL');
assert(appJs.indexOf('?page=programmes') !== -1, 'Client must link back to the list URL');

const programmesPage = fs.readFileSync('gas/PageProgrammes.html', 'utf8');
assert(programmesPage.indexOf(':href="detailUrl(p)"') !== -1, 'Programme rows must be real links');
const detailPage = fs.readFileSync('gas/PageProgrammeDetail.html', 'utf8');
assert(detailPage.indexOf(':href="listUrl"') !== -1, 'Detail page must link back to the list');

// 7. Injected JSON must not be able to break out of the script tag.
const breakout = app.jsonForScript_({ name: '</script><script>alert(1)</script>' });
assert(breakout.indexOf('</script') === -1, 'jsonForScript_ must escape closing script tags');
assert(breakout.indexOf('\\u003c') !== -1, 'jsonForScript_ must emit unicode escapes');

// 8. Shared MQA codes: owner keeps the code tab, partners get their own tab.
const sharedRows = [
  { mqaCode: 'MQA/FA5589', faculty: 'FBIM', roleRaw: '', ownerFacultyRaw: '' },
  { mqaCode: 'MQA/FA5589', faculty: 'ESERI', roleRaw: '', ownerFacultyRaw: '' },
  { mqaCode: 'MQA/FA1000', faculty: 'FSSG', roleRaw: '', ownerFacultyRaw: '' }
];
app.annotateSharedProgrammes_(sharedRows);
assert.strictEqual(sharedRows[0].role, 'Pemilik', 'First row of a shared code owns the content');
assert.strictEqual(sharedRows[0].isSharedCode, true);
assert.strictEqual(sharedRows[1].role, 'Berkongsi');
assert.strictEqual(sharedRows[1].ownerFaculty, 'FBIM');
assert.strictEqual(sharedRows[2].isSharedCode, false);
assert.strictEqual(sharedRows[2].role, 'Pemilik');

assert.strictEqual(app.programmeTabName_(sharedRows[0]), 'MQA/FA5589');
assert.strictEqual(app.programmeTabName_(sharedRows[1]), 'MQA/FA5589__ESERI', 'Partner gets its own tab');
assert.strictEqual(app.programmeTabName_(sharedRows[2]), 'MQA/FA1000');

// An explicit "Pemilik" in the sheet overrides the first-row default.
const overridden = [
  { mqaCode: 'MQA/FA9', faculty: 'AAA', roleRaw: 'Berkongsi', ownerFacultyRaw: 'BBB' },
  { mqaCode: 'MQA/FA9', faculty: 'BBB', roleRaw: 'Pemilik', ownerFacultyRaw: '' }
];
app.annotateSharedProgrammes_(overridden);
assert.strictEqual(overridden[0].role, 'Berkongsi');
assert.strictEqual(overridden[1].role, 'Pemilik');
assert.strictEqual(overridden[0].ownerFaculty, 'BBB');

// Content comparison drives the "Berbeza dengan fakulti pemilik" badge.
const left = { peos: [{ code: 'PEO1', statement: 'Same text', mqfDomain: 'MQF 1' }], plos: [] };
const sameText = { peos: [{ code: 'PEO1', statement: '  same   TEXT ', mqfDomain: 'mqf 1' }], plos: [] };
const different = { peos: [{ code: 'PEO1', statement: 'Different', mqfDomain: 'MQF 1' }], plos: [] };
assert.strictEqual(app.sameProgrammeContent_(left, sameText), true, 'Whitespace/case must not count as a difference');
assert.strictEqual(app.sameProgrammeContent_(left, different), false);

// Partner content is copied automatically on first access.
assert(source.indexOf('function ensurePartnerCopy_') !== -1, 'Auto-copy helper must exist');
assert(/LockService\.getScriptLock\(\)/.test(source), 'Auto-copy must be serialised with a script lock');
assert(/ownerSheet\.copyTo\(ss\)\.setName\(programme\.tabName\)/.test(source), 'Auto-copy must clone the owner tab');
assert(/function getProgrammeDetailFor_\(programme\) \{\s*ensurePartnerCopy_\(programme\);/.test(source),
  'Reading a detail must ensure the partner copy first');
assert(/function requireOwnProgrammeTab_\(programme\) \{\s*ensurePartnerCopy_\(programme\);/.test(source),
  'Writing must ensure the partner copy first');
assert(source.indexOf('function setupSharedProgrammeRoleColumn') !== -1, 'Role column setup must exist');

const detailMarkup = fs.readFileSync('gas/PageProgrammeDetail.html', 'utf8');
assert(detailMarkup.indexOf('Salin daripada fakulti pemilik') === -1, 'Manual copy button must be gone');
assert(detailMarkup.indexOf('Berbeza dengan fakulti pemilik') !== -1, 'Difference badge must be present');
assert(detailMarkup.indexOf('Sama dengan fakulti pemilik') !== -1, 'Match badge must be present');

assert(appJs.indexOf('copyFromOwner') === -1, 'Client must not offer a manual copy action');
assert(appJs.indexOf('this.detail.faculty)') !== -1, 'Client must pass the faculty to write APIs');

// 9. PDF register: listed on the dashboard, view-only, no delete path.
assert(source.indexOf("var PDF_LOG_SHEET_NAME_ = 'PDF_Log'") !== -1, 'PDF log sheet must be defined');
assert(/recordPdfInLog_\(file, programme, session, 'generate'\)/.test(source), 'Generation must write a log row');
assert(source.indexOf('setSharing(') === -1, 'Sharing must be managed on the Drive folder, not per file');
assert(/function listPdfLog_\(session(, mqaCode)?\)/.test(source), 'Log reader must exist');
assert(/if \(!session\.isAdmin && String\(record\.Faculty \|\| ''\)\.trim\(\) !== session\.faculty\) return false;/.test(source),
  'Faculty must only see their own PDF rows');
assert(source.indexOf('function backfillPdfLog_') !== -1, 'Historical backfill must exist');
assert(/TDA \(tidak direkod\)/.test(source), 'Historical rows must fall back to the faculty TDA');

// No deletion path may exist for PDFs. The only trashed object is the temporary
// spreadsheet used while building the PDF blob.
assert(source.indexOf('deletePdf') === -1 && source.indexOf('removePdf') === -1, 'No PDF delete API may exist');
const trashCalls = source.match(/\.setTrashed\(true\)/g) || [];
assert(trashCalls.length === 1, 'Only one trash call is expected');
assert(/DriveApp\.getFileById\(tempSs\.getId\(\)\)\.setTrashed\(true\)/.test(source),
  'The only trash call must be the temporary PDF workbook');

const listPage = fs.readFileSync('gas/PageProgrammes.html', 'utf8');
assert(listPage.indexOf('PDF dijana') !== -1, 'Dashboard must list generated PDFs');
['Fail PDF', 'Tarikh', 'Penjana', 'Buka PDF'].forEach(function (label) {
  assert(listPage.indexOf(label) !== -1, 'PDF table must show ' + label);
});
assert(listPage.indexOf('row.url') !== -1, 'PDF rows must open through the Drive link');
assert(listPage.indexOf('Padam') === -1, 'No delete control may be offered');

// 10. The programme detail page lists only that programme's PDFs.
assert(/function listPdfLog_\(session, mqaCode\)/.test(source), 'Log reader must accept a programme filter');
assert(/if \(code && String\(record\.MQACode \|\| ''\)\.trim\(\) !== code\) return false;/.test(source),
  'Log reader must filter by MQA code');
assert(/pdfLog: listPdfLog_\(session\.user, programme\.mqaCode\)/.test(source),
  'Detail page must inject the programme PDF rows');

const detailPdf = fs.readFileSync('gas/PageProgrammeDetail.html', 'utf8');
assert(detailPdf.indexOf('PDF dijana') !== -1, 'Detail page must show a PDF section');
assert(detailPdf.indexOf('v-for="row in pdfLog"') !== -1, 'Detail page must render PDF rows');
assert(detailPdf.indexOf('row.generatedAtLabel') !== -1, 'Detail page must show the generated date');
assert(detailPdf.indexOf('row.generatedBy') !== -1, 'Detail page must show the generator');

console.log('single-workbook guard: OK');
