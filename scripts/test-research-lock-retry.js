const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('gas/ResearchLockService.gs', 'utf8');
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
console.log('Research lock retry tests passed.');
