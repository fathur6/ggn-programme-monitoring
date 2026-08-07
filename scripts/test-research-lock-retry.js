const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/ResearchLockService.gs', 'utf8');
const dataSource = fs.readFileSync('gas/ResearchDataService.gs', 'utf8');
const referenceSource = fs.readFileSync('gas/ResearchReferenceService.gs', 'utf8');
const programmeSDGSource = fs.readFileSync('gas/ProgrammeSDGService.gs', 'utf8');
const mappingSource = fs.readFileSync('gas/ResearchMappingService.gs', 'utf8');
const api = new Function(
  'LockService',
  'Utilities',
  source + '\nreturn {\n' +
    '  withResearchLockRetry_: withResearchLockRetry_,\n' +
    '  researchLockBusyError_: researchLockBusyError_,\n' +
    '  RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS: RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS,\n' +
    '  RESEARCH_LOCK_MAX_ATTEMPTS: RESEARCH_LOCK_MAX_ATTEMPTS,\n' +
    '  RESEARCH_LOCK_BACKOFF_MS: RESEARCH_LOCK_BACKOFF_MS\n' +
    '};'
)(undefined, undefined);

assert.strictEqual(api.RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS, 5000);
assert.strictEqual(api.RESEARCH_LOCK_MAX_ATTEMPTS, 4);
assert.deepStrictEqual(api.RESEARCH_LOCK_BACKOFF_MS, [250, 500, 1000]);
assert.strictEqual(
  api.RESEARCH_LOCK_MAX_ATTEMPTS * api.RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS +
    api.RESEARCH_LOCK_BACKOFF_MS.reduce((total, delay) => total + delay, 0),
  21750,
  'Lock budget must remain bounded at 21,750 ms nominally'
);

function fakeLock(sequence, calls) {
  return {
    tryLock: timeout => {
      calls.push({type: 'tryLock', timeout});
      return sequence.shift();
    },
    releaseLock: () => calls.push({type: 'releaseLock'})
  };
}

const acquisitionCalls = [];
const acquisitionSequence = [false, false, true];
const acquisitionLockService = {
  getScriptLock: () => fakeLock(acquisitionSequence, acquisitionCalls)
};
const delays = [];
let workCalls = 0;
const result = api.withResearchLockRetry_(
  () => {
    workCalls++;
    return 'done';
  },
  {lockService: acquisitionLockService, sleeper: delay => delays.push(delay)}
);
assert.strictEqual(result, 'done');
assert.strictEqual(workCalls, 1, 'Protected work must execute once');
assert.deepStrictEqual(delays, [250, 500], 'Only failed attempts should back off');
assert.deepStrictEqual(acquisitionCalls, [
  {type: 'tryLock', timeout: 5000},
  {type: 'tryLock', timeout: 5000},
  {type: 'tryLock', timeout: 5000},
  {type: 'releaseLock'}
]);

const thrownCalls = [];
let thrownWorkCalls = 0;
assert.throws(() => api.withResearchLockRetry_(
  () => {
    thrownWorkCalls++;
    throw new Error('validation failed');
  },
  {lockService: {getScriptLock: () => fakeLock([true], thrownCalls)}, sleeper: () => {
    throw new Error('Sleeper must not run after acquisition');
  }}
), error => error.message === 'validation failed');
assert.strictEqual(thrownWorkCalls, 1, 'Thrown work must not be replayed');
assert.deepStrictEqual(thrownCalls, [
  {type: 'tryLock', timeout: 5000},
  {type: 'releaseLock'}
]);

const exhaustedCalls = [];
const exhaustionDelays = [];
let exhaustedWorkCalls = 0;
let busyError;
try {
  api.withResearchLockRetry_(
    () => { exhaustedWorkCalls++; },
    {lockService: {getScriptLock: () => fakeLock([false, false, false, false], exhaustedCalls)}, sleeper: delay => exhaustionDelays.push(delay)}
  );
} catch (error) {
  busyError = error;
}
assert(busyError, 'Exhaustion must throw a typed busy error');
assert.strictEqual(busyError.code, 'RESEARCH_LOCK_BUSY');
assert.strictEqual(busyError.retryable, true);
assert.strictEqual(exhaustedWorkCalls, 0, 'Exhaustion must not invoke protected work');
assert.deepStrictEqual(exhaustionDelays, [250, 500, 1000]);
assert.deepStrictEqual(exhaustedCalls, [
  {type: 'tryLock', timeout: 5000},
  {type: 'tryLock', timeout: 5000},
  {type: 'tryLock', timeout: 5000},
  {type: 'tryLock', timeout: 5000}
]);

let terminalTryLockCalls = 0;
let terminalWorkCalls = 0;
const terminalError = new Error('authorization failed');
assert.throws(() => api.withResearchLockRetry_(
  () => {
    terminalWorkCalls++;
    throw terminalError;
  },
  {lockService: {getScriptLock: () => ({
    tryLock: timeout => {
      terminalTryLockCalls++;
      assert.strictEqual(timeout, 5000);
      return true;
    },
    releaseLock: () => {}
  })}, sleeper: () => { throw new Error('Terminal work must not retry'); }}
), error => error === terminalError);
assert.strictEqual(terminalTryLockCalls, 1, 'Terminal work errors must use one acquisition attempt');
assert.strictEqual(terminalWorkCalls, 1, 'Terminal work errors must not replay work');

assert.strictEqual(source.includes('waitLock'), false, 'Shared helper must use tryLock, not waitLock');
assert.strictEqual(source.includes('Utilities.sleep'), true, 'Production default sleeper must use Apps Script Utilities');

let lockDepth = 0;
function preparedSheet(name, rows) {
  return {
    getName: () => name,
    getLastRow: () => rows.length,
    appendRow: row => {
      assert.strictEqual(lockDepth, 1, 'Sheet setup and reference seeding must stay inside one owned lock');
      rows.push(row.slice());
    },
    getDataRange: () => ({getValues: () => rows.map(row => row.slice())})
  };
}
const preparedSheets = {};
const preparedLockService = {
  getScriptLock: () => ({
    tryLock: () => { lockDepth++; return true; },
    releaseLock: () => { lockDepth--; }
  })
};
const preparedSpreadsheet = {
  getSheetByName: name => preparedSheets[name] || null,
  insertSheet: name => {
    preparedSheets[name] = preparedSheet(name, []);
    return preparedSheets[name];
  }
};
const preparedApi = new Function(
  'LockService', 'Utilities', 'getSpreadsheet', 'resolveProgramme_', 'isResearchProgramme_',
  source + '\n' + dataSource + '\n' + referenceSource + '\n' + programmeSDGSource + '\n' + mappingSource +
    '\nreturn withPreparedResearchContext_;'
)(preparedLockService, {sleep: () => { throw new Error('Prepared context must not sleep'); }},
  () => preparedSpreadsheet,
  value => ({programmeId: 'FACULTY::PROGRAMME::MQA/PREPARED', mqaCode: 'MQA/PREPARED', level: 'Masters'}),
  () => true
);
const preparedResult = preparedApi('FACULTY::PROGRAMME::MQA/PREPARED', context => {
  assert.strictEqual(lockDepth, 1, 'Prepared reader must run inside the owned lock');
  assert(context.references.MQF.length > 0, 'Prepared context must expose seeded references');
  return {programmeId: context.key, referenceCount: context.references.MQF.length};
});
assert.deepStrictEqual(preparedResult, {
  programmeId: 'FACULTY::PROGRAMME::MQA/PREPARED',
  referenceCount: 11
});
assert.strictEqual(lockDepth, 0, 'Prepared context must release the lock after capture');
console.log('Research lock retry tests passed.');
