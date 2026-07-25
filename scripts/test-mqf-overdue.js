const fs = require('fs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync('gas/GovernanceService.gs', 'utf8');
const api = new Function(source + '\nreturn { getAcademicDeadline_: getAcademicDeadline_, isProgrammeOverdue_: isProgrammeOverdue_, createEmptyStatusTotals_: createEmptyStatusTotals_, addStatusToTotals_: addStatusToTotals_ };')();
const deadline = api.getAcademicDeadline_();
assert(deadline.toISOString() === '2026-07-23T15:59:59.000Z', 'Deadline is not 23 July 2026 11:59:59 PM MYT');

assert(api.isProgrammeOverdue_({ completionState: 'Draft' }, new Date('2026-07-23T15:59:58+08:00')) === false, 'Draft is overdue before the deadline');
assert(api.isProgrammeOverdue_({ completionState: 'Draft' }, new Date('2026-07-23T23:59:59+08:00')) === false, 'Draft is overdue at the deadline');
assert(api.isProgrammeOverdue_({ completionState: 'Draft' }, new Date('2026-07-24T00:00:00+08:00')) === true, 'Draft is not overdue after the deadline');
assert(api.isProgrammeOverdue_({ completionState: 'Complete' }, new Date('2026-07-24T00:00:00+08:00')) === false, 'Complete programme is overdue');
assert(api.isProgrammeOverdue_({ completionState: 'Submitted' }, new Date('2026-07-24T00:00:00+08:00')) === false, 'Submitted programme is overdue');

const totals = api.createEmptyStatusTotals_();
api.addStatusToTotals_(totals, { completionState: 'Draft', overdue: true, mqfDomainState: 'Needs Attention', taxonomyState: 'Needs Attention', mappingState: 'Needs Attention', documentState: 'Needs Attention', reviewState: 'Blocked', submissionState: 'Draft' });
assert(totals.overdueCount === 1, 'Faculty/university overdue aggregation is inconsistent');
api.addStatusToTotals_(totals, { completionState: 'Complete', phase1Complete: true, phase2Complete: false, phase2CompletedItems: 4, phase2TotalItems: 6, mqfDomainState: 'Complete', taxonomyState: 'Complete', mappingState: 'Not required', documentState: 'Not required', reviewState: 'Ready', submissionState: 'Ready' });
assert(totals.phase1CompleteCount === 1, 'Phase 1 aggregation is inconsistent');
assert(totals.phase2CompletedItems === 4 && totals.phase2TotalItems === 12, 'Phase 2 six-item aggregation is inconsistent');
console.log('MQF overdue tests passed.');
