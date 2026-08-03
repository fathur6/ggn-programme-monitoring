const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/JavaScript.html', 'utf8');
const index = fs.readFileSync('gas/Index.html', 'utf8');
const styles = fs.readFileSync('gas/Styles.html', 'utf8');

function functionSource(name) {
  const start = source.indexOf(name + ': function');
  assert(start >= 0, 'Missing client method: ' + name);
  const functionStart = source.indexOf('function', start);
  const bodyStart = source.indexOf('{', functionStart);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(functionStart, i + 1);
    }
  }
  throw new Error('Client method is not closed: ' + name);
}

function clientMethod(name) {
  return new Function('return ' + functionSource(name))();
}

const methods = [
  'researchProgrammeIdentity',
  'isCurrentResearchRead',
  'applyResearchEndpointResult',
  'loadResearchWorkspace',
  'retryResearchEndpoint',
  'isResearchProgramme',
  'openProgramme',
  'loadAssessmentWorkspace',
  'loadAssessmentMapping',
  'retryAssessmentEndpoint',
  'loadAssessmentReview'
].reduce((result, name) => {
  result[name] = clientMethod(name);
  return result;
}, {});

function makeFakeRunner() {
  const calls = [];
  const fake = {
    calls,
    get run() {
      const runner = {
        success: null,
        failure: null,
        withSuccessHandler(handler) {
          this.success = handler;
          return this;
        },
        withFailureHandler(handler) {
          this.failure = handler;
          return this;
        }
      };
      [
        'getResearchWorkspaceApi', 'getAssessmentWorkspaceApi',
        'getResearchProgrammeApi', 'getResearchPEOsApi', 'getResearchPLOsApi',
        'getResearchReferencesApi', 'getResearchMappingsApi', 'getResearchCoverageApi',
        'getResearchReviewApi', 'getAssessmentMappingApi', 'getAssessmentReviewApi',
        'saveResearchProfileApi', 'saveResearchPEOsApi', 'saveResearchPLOsApi',
        'saveResearchPLOMappingApi', 'saveAssessmentMappingApi', 'resetAssessmentMappingApi'
      ].forEach((method) => {
        runner[method] = (...args) => {
          const call = {method, args, success: runner.success, failure: runner.failure};
          calls.push(call);
          return runner;
        };
      });
      return runner;
    }
  };
  return fake;
}

function makeState(fake, programme) {
  const state = {
    currentProgramme: programme || {programmeId: 'A', mqaCode: 'MQA-A'},
    researchLoadGeneration: 0,
    researchLoadProgrammeId: '',
    researchLoading: false,
    researchError: null,
    researchWorkspaceFatalError: null,
    researchSaveState: 'clean',
    researchStatus: 'Draft',
    researchProfile: null,
    researchPEOs: [],
    researchPLOs: [],
    researchMappings: {},
    researchReferences: {MQF: [], TF: [], SDG: [], SC: []},
    researchCoverage: null,
    researchReview: null,
    researchEndpointNames: ['profile', 'peos', 'plos', 'references', 'mappings', 'coverage', 'review'],
    researchEndpointErrors: {profile: null, peos: null, plos: null, references: null, mappings: null, coverage: null, review: null},
    researchEndpointLoading: {profile: false, peos: false, plos: false, references: false, mappings: false, coverage: false, review: false},
    assessmentMapping: null,
    assessmentReview: null,
    assessmentSaveState: 'clean',
    assessmentWorkspaceFatalError: null,
    assessmentEndpointNames: ['mapping', 'review'],
    assessmentEndpointErrors: {mapping: null, review: null},
    assessmentEndpointLoading: {mapping: false, review: false},
    toasts: [],
    $set(object, key, value) { object[key] = value; },
    showToast(message) { this.toasts.push(message); }
  };
  Object.keys(methods).forEach((name) => { state[name] = methods[name]; });
  return state;
}

function envelope(data) {
  return {ok: true, data, error: null, retryable: false};
}

function researchResult(overrides) {
  const endpoints = {
    profile: envelope({programmeId: 'A', programmeName: 'A profile'}),
    peos: envelope([{code: 'PEO1'}]),
    plos: envelope([{ploId: 'plo-a', code: 'PLO1'}]),
    references: envelope({MQF: [], TF: [], SDG: [], SC: []}),
    mappings: envelope([]),
    coverage: envelope({globalCoverage: {}}),
    review: envelope({status: 'Ready for review', critical: [], warnings: []})
  };
  Object.assign(endpoints, overrides || {});
  return {ok: true, programmeId: 'A', endpoints};
}

function complete(call, value) {
  assert(call && call.success, 'Expected an RPC success handler');
  call.success(value);
}

function fail(call, error) {
  assert(call && call.failure, 'Expected an RPC failure handler');
  call.failure(error);
}

function testOrchestration() {
  const fake = makeFakeRunner();
  global.google = {script: fake};
  const state = makeState(fake);
  state.loadResearchWorkspace();
  assert.strictEqual(fake.calls.length, 1, 'Initial research load must use one RPC');
  assert.deepStrictEqual(fake.calls[0].args, ['A'], 'Initial aggregate call must use the selected programme identity');
  assert.strictEqual(fake.calls[0].method, 'getResearchWorkspaceApi');
  const initial = researchResult({
    mappings: envelope([
      {ploId: 'plo-a', sdgIds: ['SDG1', 'SDG2'], scIds: ['SC1', 'SC2'], tfIds: ['TF1', 'TF2'], derivedTFIds: ['TF3']},
      {ploId: 'plo-b', sdgIds: ['SDG3'], scIds: ['SC3'], derivedTFIds: ['TF4', 'TF5']}
    ])
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(initial, 'assessmentMapping'), false, 'Initial aggregate must not contain assessment mapping');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(initial, 'assessmentReview'), false, 'Initial aggregate must not contain assessment review');
  complete(fake.calls[0], initial);
  assert.strictEqual(state.researchLoading, false);
  assert.strictEqual(state.researchProfile.programmeName, 'A profile');
  assert.deepStrictEqual(state.researchMappings['plo-a'].sdgIds, ['SDG1']);
  assert.deepStrictEqual(state.researchMappings['plo-a'].scIds, ['SC1']);
  assert.deepStrictEqual(state.researchMappings['plo-a'].tfIds, ['TF1']);
  assert.deepStrictEqual(state.researchMappings['plo-a'].derivedTFIds, ['TF1']);
  assert.deepStrictEqual(state.researchMappings['plo-b'].tfIds, ['TF4']);
  assert.deepStrictEqual(state.researchMappings['plo-b'].derivedTFIds, ['TF4']);
  assert.deepStrictEqual(Object.keys(state.researchMappings).sort(), ['plo-a', 'plo-b']);

  state.currentProgramme = {programmeId: 'A', mqaCode: 'MQA-A'};
  state.researchEndpointErrors.coverage = null;
  state.retryResearchEndpoint('coverage');
  assert.strictEqual(fake.calls[1].method, 'getResearchCoverageApi');
  assert.deepStrictEqual(fake.calls[1].args, ['A']);
  complete(fake.calls[1], {globalCoverage: {MQF: ['MQF2']}});
  assert.deepStrictEqual(state.researchCoverage.globalCoverage.MQF, ['MQF2']);
  assert.strictEqual(state.researchProfile.programmeName, 'A profile');

  state.retryResearchEndpoint('references');
  assert.strictEqual(fake.calls[2].method, 'getResearchReferencesApi');
  assert.deepStrictEqual(fake.calls[2].args, [], 'Reference retries must use the authenticated current-user signature');
  complete(fake.calls[2], {MQF: [{code: 'MQF2'}], TF: [], SDG: [], SC: []});
  assert.strictEqual(state.researchReferences.MQF[0].code, 'MQF2');
  state.retryResearchEndpoint('not-a-real-endpoint');
  assert.strictEqual(fake.calls.length, 3, 'Unknown endpoint must not issue an RPC');
  assert.strictEqual(state.researchEndpointErrors['not-a-real-endpoint'].retryable, false);

  state.loadResearchWorkspace();
  const partialCall = fake.calls[3];
  complete(partialCall, researchResult({
    profile: envelope({programmeId: 'A', programmeName: 'retained profile'}),
    coverage: {ok: false, data: null, error: {code: 'RESEARCH_COVERAGE_FAILED', message: 'Coverage unavailable'}, retryable: true}
  }));
  assert.strictEqual(state.researchProfile.programmeName, 'retained profile');
  assert.strictEqual(state.researchEndpointErrors.coverage.endpoint, 'coverage');
  assert.strictEqual(state.researchEndpointErrors.coverage.retryable, true);
  assert.strictEqual(state.researchDirty, undefined, 'Read failures must not create mutation dirty state');

  state.assessmentMapping = null;
  state.assessmentReview = null;
  const clientDiagnostics = [];
  const originalConsoleError = console.error;
  console.error = message => clientDiagnostics.push(String(message));
  try {
    const researchToken = {generation: state.researchLoadGeneration, programmeId: 'A'};
    state.applyResearchEndpointResult('mappings', {ok: false, error: {endpoint: 'mappings', code: 'RESEARCH_MAPPINGS_FAILED', message: 'Research mapping unavailable'}}, researchToken, 'research');
    state.applyResearchEndpointResult('review', {ok: false, error: {endpoint: 'review', code: 'RESEARCH_REVIEW_FAILED', message: 'Research review unavailable'}}, researchToken, 'research');
    assert.strictEqual(state.researchEndpointErrors.mappings.endpoint, 'mappings');
    assert.strictEqual(state.researchEndpointErrors.mappings.code, 'RESEARCH_MAPPINGS_FAILED');
    assert.strictEqual(state.researchEndpointErrors.review.endpoint, 'review');
    assert.strictEqual(state.researchEndpointErrors.review.code, 'RESEARCH_REVIEW_FAILED');
    assert(clientDiagnostics.some(entry => entry.includes('endpoint=mappings') && entry.includes('RESEARCH_MAPPINGS_FAILED')));
    assert(clientDiagnostics.some(entry => entry.includes('endpoint=review') && entry.includes('RESEARCH_REVIEW_FAILED')));
    state.loadAssessmentMapping();
    assert.strictEqual(fake.calls.length, 5, 'Assessment activation must make one aggregate RPC');
    assert.strictEqual(fake.calls[4].method, 'getAssessmentWorkspaceApi');
    assert.deepStrictEqual(fake.calls[4].args, ['A']);
    complete(fake.calls[4], {
      ok: true,
      endpoints: {
        mapping: envelope([{code: 'PROGRESS_MASTER'}]),
        review: {ok: false, data: null, error: {endpoint: 'assessment/review', code: 'ASSESSMENT_REVIEW_FAILED', message: 'Review unavailable'}, retryable: true}
      }
    });
    assert.strictEqual(state.assessmentMapping[0].code, 'PROGRESS_MASTER');
    assert.strictEqual(state.assessmentEndpointErrors.review.endpoint, 'assessment/review');
    assert.strictEqual(state.assessmentEndpointErrors.review.code, 'ASSESSMENT_REVIEW_FAILED');
    assert.notStrictEqual(state.assessmentEndpointErrors.review.endpoint, state.researchEndpointErrors.review.endpoint);
    assert.notStrictEqual(state.assessmentEndpointErrors.review.code, state.researchEndpointErrors.review.code);
    assert(clientDiagnostics.some(entry => entry.includes('endpoint=assessment/review') && entry.includes('ASSESSMENT_REVIEW_FAILED')));
    assert.strictEqual(state.assessmentEndpointErrors.mapping, null);
    state.retryAssessmentEndpoint('mapping');
    assert.strictEqual(fake.calls[5].method, 'getAssessmentMappingApi');
    fail(fake.calls[5], {endpoint: 'assessment/mapping', code: 'ASSESSMENT_MAPPING_FAILED', message: 'Mapping unavailable', retryable: true});
    assert.strictEqual(state.assessmentEndpointErrors.mapping.endpoint, 'assessment/mapping');
    assert.strictEqual(state.assessmentEndpointErrors.mapping.code, 'ASSESSMENT_MAPPING_FAILED');
    assert.notStrictEqual(state.assessmentEndpointErrors.mapping.endpoint, state.researchEndpointErrors.mappings.endpoint);
    assert.notStrictEqual(state.assessmentEndpointErrors.mapping.code, state.researchEndpointErrors.mappings.code);
    assert(clientDiagnostics.some(entry => entry.includes('endpoint=assessment/mapping') && entry.includes('ASSESSMENT_MAPPING_FAILED')));
    state.loadAssessmentReview();
    assert.strictEqual(fake.calls[6].method, 'getAssessmentReviewApi');
    assert.deepStrictEqual(fake.calls[6].args, ['A']);
    complete(fake.calls[6], {critical: [], warnings: [], status: 'Ready for review'});
    assert.strictEqual(state.assessmentReview.status, 'Ready for review');
  } finally {
    console.error = originalConsoleError;
  }
  assert.ok(fake.calls.every((call) => !/save|reset/i.test(call.method)), 'Read orchestration must not replay mutations');
}

function testStaleResponses() {
  const fake = makeFakeRunner();
  global.google = {script: fake};
  const state = makeState(fake, {programmeId: 'A', mqaCode: 'MQA-A'});
  const errors = [];
  const originalError = console.error;
  console.error = (message) => errors.push(message);
  try {
    state.loadResearchWorkspace();
    const callA = fake.calls[0];
    complete(callA, researchResult({
      profile: envelope({programmeId: 'A', programmeName: 'programme A'}),
      peos: envelope([{code: 'A-PEO'}]),
      plos: envelope([{ploId: 'a-plo', code: 'A-PLO'}]),
      references: envelope({MQF: [{code: 'A-MQF'}], TF: [], SDG: [], SC: []}),
      mappings: envelope([{ploId: 'a-plo', sdgIds: ['A-SDG'], scIds: ['A-SC'], tfIds: ['A-TF']}]),
      coverage: envelope({globalCoverage: {programme: 'A'}}),
      review: envelope({status: 'A status', critical: [], warnings: []})
    }));
    state.loadResearchWorkspace();
    const refreshA = fake.calls[1];
    state.openProgramme({programmeId: 'B', mqaCode: 'MQA-B', mode: 'Research'});
    const callB = fake.calls[2];
    assert.strictEqual(state.researchProfile, null, 'Programme switch must clear the prior profile');
    assert.deepStrictEqual(state.researchPEOs, [], 'Programme switch must clear prior PEOs');
    assert.deepStrictEqual(state.researchPLOs, [], 'Programme switch must clear prior PLOs');
    assert.deepStrictEqual(state.researchMappings, {}, 'Programme switch must clear prior mappings');
    assert.deepStrictEqual(state.researchReferences, {MQF: [], TF: [], SDG: [], SC: []}, 'Programme switch must clear prior references');
    assert.strictEqual(state.researchCoverage, null, 'Programme switch must clear prior coverage');
    assert.strictEqual(state.researchReview, null, 'Programme switch must clear prior review');
    assert.strictEqual(state.researchStatus, 'Draft', 'Programme switch must reset prior status');
    complete(refreshA, researchResult({profile: envelope({programmeId: 'A', programmeName: 'stale A'})}));
    assert.strictEqual(state.researchProfile, null, 'An old populated programme response must not write state');
    assert.deepStrictEqual(state.researchPEOs, [], 'An old response must not restore PEOs');
    complete(callB, researchResult({
      profile: envelope({programmeId: 'B', programmeName: 'current B'}),
      peos: envelope([{code: 'B-PEO'}]),
      plos: envelope([{ploId: 'b-plo', code: 'B-PLO'}]),
      references: envelope({MQF: [{code: 'B-MQF'}], TF: [], SDG: [], SC: []}),
      mappings: envelope([{ploId: 'b-plo', sdgIds: ['B-SDG'], scIds: ['B-SC'], tfIds: ['B-TF']}]),
      coverage: envelope({globalCoverage: {programme: 'B'}}),
      review: envelope({status: 'B status', critical: [], warnings: []})
    }));
    assert.strictEqual(state.researchProfile.programmeId, 'B');
    assert.strictEqual(state.researchPEOs[0].code, 'B-PEO');
    assert.strictEqual(state.researchPLOs[0].code, 'B-PLO');
    assert.strictEqual(state.researchMappings['b-plo'].sdgIds[0], 'B-SDG');
    assert.strictEqual(state.researchReferences.MQF[0].code, 'B-MQF');
    assert.strictEqual(state.researchCoverage.globalCoverage.programme, 'B');
    assert.strictEqual(state.researchReview.status, 'B status');
    assert.ok(errors.length === 0, 'Ignored stale responses must not log endpoint failures');
  } finally {
    console.error = originalError;
  }
}

function testStaticContracts() {
  assert(/researchLoadGeneration/.test(source), 'Generation guard state is missing');
  assert(/getResearchWorkspaceApi\(programmeId\)/.test(source), 'Aggregate research RPC is missing');
  assert(/getAssessmentWorkspaceApi\(programmeId\)/.test(source), 'Aggregate assessment RPC is missing');
  assert(/researchEndpointErrors/.test(source), 'Endpoint error state is missing');
  assert(/retryResearchEndpoint/.test(source) && /retryAssessmentEndpoint/.test(source), 'Targeted retry methods are missing');
  assert(/getResearchReferencesApi\(\)/.test(functionSource('retryResearchEndpoint')), 'Reference retry must have no programme argument');
  assert(/console\.error/.test(functionSource('applyResearchEndpointResult')), 'Endpoint failure attribution is not logged');
}

function testUiContracts() {
  assert(/researchEndpointErrors/.test(index), 'Research endpoint errors are not rendered');
  assert(/assessmentEndpointErrors/.test(index), 'Assessment endpoint errors are not rendered');
  assert(/Assessment \{\{ endpoint \}\} failed/.test(index), 'Assessment endpoint context is not distinguishable');
  assert(/researchEndpointLabel\(endpoint\)/.test(index), 'Endpoint labels are not visible in the UI');
  assert(/retryResearchEndpoint\(endpoint\)/.test(index), 'Research retry action is missing');
  assert(/retryAssessmentEndpoint\(endpoint\)/.test(index), 'Assessment retry action is missing');
  assert(/aria-live="polite"/.test(index) && /role="alert"/.test(index), 'Endpoint status is not announced accessibly');
  assert(/assessmentEndpointLoading\.mapping/.test(index) && /Loading assessment instruments/.test(index), 'Assessment loading state is not rendered');
  assert(/assessment-loading-spinner/.test(styles), 'Assessment loading spinner styling is missing');
  assert(/researchWorkspaceFatalError/.test(index) && /assessmentWorkspaceFatalError/.test(index), 'Fatal aggregate errors are not distinct');
  assert(/Pemetaan Program/.test(index) && /Pemetaan Pentaksiran/.test(index), 'Research tabs changed unexpectedly');
  assert(/researchError/.test(index), 'Mutation error presentation was removed');
  assert(/connection-error/.test(index) && /connectionError/.test(source), 'Spreadsheet connection-error safety net is missing');
}

const mode = process.argv[2] || '--all';
if (mode === '--orchestration' || mode === '--all') testOrchestration();
if (mode === '--stale' || mode === '--all') testStaleResponses();
if (mode === '--ui' || mode === '--all') testUiContracts();
testStaticContracts();
console.log('Research workspace client resilience checks passed.');
