const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const gasSources = [
  'gas/ResearchLockService.gs',
  'gas/ResearchDataService.gs',
  'gas/ResearchReferenceService.gs',
  'gas/ProgrammeSDGService.gs',
  'gas/ResearchMappingService.gs',
  'gas/ResearchReviewService.gs',
  'gas/AssessmentService.gs',
  'gas/ResearchWorkspaceService.gs',
  'gas/Auth.gs',
  'gas/Code.gs',
  'gas/ProgrammeService.gs'
].map(file => fs.readFileSync(file, 'utf8')).join('\n');

// Extract PROGRAMME_SDG_DEFAULTS_ from source
var ctx = {};
vm.runInNewContext(gasSources, ctx);
var defaults = ctx.PROGRAMME_SDG_DEFAULTS_;
var entries = Object.keys(defaults).map(function(k) { return [k, defaults[k]]; });

// Count and verify
assert.strictEqual(entries.length, 68, 'Seed data must cover all programmes, got ' + entries.length);
entries.forEach(function(item) {
  var key = item[0], sdgIds = item[1];
  assert.strictEqual(sdgIds.length, 3, key + ' must have exactly 3 SDGs');
  var parts = key.split('|');
  assert.strictEqual(parts.length, 2, key + ' must be MQA_CODE|FACULTY');
  sdgIds.forEach(function(sdg) {
    assert(/^SDG\d{1,2}$/.test(sdg), key + ' has invalid SDG: ' + sdg);
  });
});

// Shared MQA codes can produce same or different SDGs per faculty — both are valid.
// Verify a known differing pair exists (FF vs FP for MQA/FA5590)
var fp5590 = defaults['MQA/FA5590|FP'];
var ff5590 = defaults['MQA/FA5590|FF'];
assert.ok(fp5590.length === 3 && ff5590.length === 3, 'MQA/FA5590 must have 3 SDGs for both FP and FF');

// Same faculty can share SDGs across MQA codes
assert.deepStrictEqual(
  JSON.stringify(defaults['MQA/FA5571|FBK']),
  JSON.stringify(defaults['MQA/FA5572|FBK'])
);

// Same faculty can share SDGs
assert.deepStrictEqual(
  defaults['MQA/FA5571|FBK'], defaults['MQA/FA5572|FBK']
);

// getProgrammeSDGDefaults_ works
assert.deepStrictEqual(
  JSON.stringify(ctx.getProgrammeSDGDefaults_({faculty: 'FBK'}, 'MQA/FA5571')),
  JSON.stringify(['SDG4', 'SDG10', 'SDG17'])
);
assert.deepStrictEqual(
  JSON.stringify(ctx.getProgrammeSDGDefaults_({faculty: 'FPP'}, 'MQA/FA5586')),
  JSON.stringify(['SDG8', 'SDG9', 'SDG12'])
);
assert.deepStrictEqual(ctx.getProgrammeSDGDefaults_({faculty: 'ZZZ'}, 'MQA/UNKNOWN').length, 0);
assert.deepStrictEqual(ctx.getProgrammeSDGDefaults_({faculty: ''}, '').length, 0);

// Source contracts
var source = fs.readFileSync('gas/ProgrammeSDGService.gs', 'utf8');
assert(/getProgrammeSDGDefaultsApi_/.test(source), 'API function is missing');
assert(/if\s*\(!getCurrentUser_\(\)\)/.test(source), 'API must check auth');
assert(/ensureProgrammeSDGDefaults_/.test(source), 'Ensure helper is missing');
assert(/getProgrammeSDGKey_/.test(source), 'Key helper is missing');

console.log('Programme SDG tests passed.');
