/** ResearchLockService.gs — Shared bounded script-lock acquisition policy. */

var RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS = 5000;
var RESEARCH_LOCK_MAX_ATTEMPTS = 4;
var RESEARCH_LOCK_BACKOFF_MS = [250, 500, 1000];

function researchLockBusyError_(attempts) {
  var error = new Error('System is busy. Please try again.');
  error.name = 'ResearchLockBusyError';
  error.code = 'RESEARCH_LOCK_BUSY';
  error.retryable = true;
  error.userMessage = 'System is busy. Please try again.';
  error.diagnosticContext = {
    attempts: attempts,
    attemptTimeoutMs: RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS,
    backoffMs: RESEARCH_LOCK_BACKOFF_MS.slice()
  };
  return error;
}

/**
 * Runs work once under the shared script lock policy.
 *
 * The options seam is intentionally limited to test doubles and diagnostics;
 * production callers use the centralized timeout, attempt, and backoff values.
 */
function withResearchLockRetry_(work, options) {
  options = options || {};
  var lockService = options.lockService || LockService;
  var sleeper = options.sleeper || function(delayMs) { Utilities.sleep(delayMs); };
  var acquired = false;
  var lock;

  for (var attempt = 0; attempt < RESEARCH_LOCK_MAX_ATTEMPTS; attempt++) {
    lock = lockService.getScriptLock();
    if (lock.tryLock(RESEARCH_LOCK_ATTEMPT_TIMEOUT_MS)) {
      acquired = true;
      break;
    }
    if (attempt < RESEARCH_LOCK_MAX_ATTEMPTS - 1) {
      sleeper(RESEARCH_LOCK_BACKOFF_MS[attempt]);
    }
  }

  if (!acquired) throw researchLockBusyError_(RESEARCH_LOCK_MAX_ATTEMPTS);

  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}
