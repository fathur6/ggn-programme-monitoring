const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'gas', 'Code.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'gas', 'Index.html'), 'utf8');

assert.match(server, /SDG_ELIGIBLE_PLO_CODES_ = \['PLO1', 'PLO9', 'PLO11'\]/);
assert.match(server, /'MQA\/FA5573': \['PLO1', 'PLO9', 'PLO10'\]/);
assert.match(server, /'MQA\/FA5574': \['PLO1', 'PLO9', 'PLO10'\]/);
assert.match(server, /'MQA\/FA5573': \['PLO2', 'PLO4', 'PLO9', 'PLO10'\]/);
assert.match(server, /'MQA\/FA5574': \['PLO2', 'PLO4', 'PLO9', 'PLO10'\]/);
assert.match(client, /programmeCode === 'MQA\/FA5573' \|\| programmeCode === 'MQA\/FA5574'/);
assert.match(client, /\['PLO1', 'PLO9', 'PLO10'\]/);
assert.match(client, /\['PLO1', 'PLO9', 'PLO11'\]/);
assert.match(client, /\['PLO2', 'PLO4', 'PLO9', 'PLO10'\]/);
assert.match(server, /function migrateApprovedSdgPlo8ToPlo9\(\)/);

const migration = server.slice(server.indexOf('function migrateApprovedSdgPlo8ToPlo9()'));
for (const code of ['MQA/FA5571', 'MQA/FA5572', 'MQA/FA5573', 'MQA/FA5574']) {
  assert.match(migration, new RegExp(code));
}
assert.match(migration, /getRange\(plo9Row, 6\)\.setValue\(sourceSdg\)/);
assert.match(migration, /getRange\(plo8Row, 6\)\.clearContent\(\)/);
assert.match(migration, /thirdPlo: 'PLO10', thirdSdg: 'SDG12'/);
assert.match(migration, /getRange\(thirdPloRow, 6\)\.setValue\(programme.thirdSdg\)/);
assert.match(migration, /thirdSc: 'SC8'/);
assert.match(migration, /getRange\(thirdPloRow, 7\)\.setValue\(programme.thirdSc\)/);
assert.match(migration, /getRange\(plo11Row, 7\)\.clearContent\(\)/);
assert.match(server, /function relocateSpecialPhdSc_\(plos, programmeCode\)/);

console.log('PPS v34 SDG PLO8-to-PLO9 migration contract passed.');
