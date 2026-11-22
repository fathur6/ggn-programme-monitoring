const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'gas', 'Code.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'gas', 'appsscript.json'), 'utf8');

assert.match(server, /var tempSs = SpreadsheetApp\.create\(tempName\)/);
assert.match(server, /DriveApp\.getFileById\(tempSs\.getId\(\)\)\.getAs\(MimeType\.PDF\)/);
assert.match(server, /setTrashed\(true\)/);
assert.match(server, /sheet\.setHiddenGridlines\(true\)/);
assert.match(server, /isSDGEligiblePLO_\(plos\[q\]\.code, code\) \? plos\[q\]\.sdg \|\| '' : ''/);
assert.match(server, /isSCEligiblePLO_\(plos\[q\]\.code, code\) \? plos\[q\]\.sc \|\| '' : ''/);
// The PDF path must stay free of network calls; the review Excel export is
// allowed to use UrlFetchApp against Drive's own export endpoint.
const pdfSection = server.slice(server.indexOf('function buildPdfBlob_'), server.indexOf('function padRow_'));
assert.doesNotMatch(pdfSection, /UrlFetchApp/);

console.log('PDF export no longer requires UrlFetchApp.');
