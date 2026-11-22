/**
 * Review-status submission contract (gas/Code.js).
 *
 * The submission path is exercised with the sheet and directory helpers stubbed
 * so the test proves the wiring (period gate, author capture, append-only
 * revision) without touching the production workbook.
 */

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('gas/Code.js', 'utf8');

function makeApp() {
  const context = { console: console };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function stub(app, options) {
  const appended = [];
  const session = options.session || {
    name: 'DR. TEST COORDINATOR',
    email: 'coordinator@unisza.edu.my',
    faculty: 'FKI',
    isAdmin: false
  };

  app.requireLogin_ = function () { return session; };
  app.requireProgrammeFacultyAccess_ = function () {
    return { mqaCode: options.mqaCode || 'MQA/FA5581', faculty: 'FKI', tabName: 'MQA/FA5581' };
  };
  app.activeReviewPeriod_ = function () { return options.period || null; };
  app.reviewSubmissions_ = function () { return options.existing || []; };
  app.ensureReviewTabs_ = function () {
    return { submissions: { appendRow: function (row) { appended.push(row); } } };
  };
  app.reviewPayloadFor_ = function (programme) {
    return { active: options.period || null, canSubmit: true, currentText: '', history: [], mqa: programme.mqaCode };
  };
  app.SpreadsheetApp = { flush: function () {} };
  return { appended: appended, session: session };
}

// 1. An open period records the submission with the signed-in author.
{
  const app = makeApp();
  const period = { PeriodId: 'P2026-11-21', CutoffLabel: '21/11/2026', State: 'Open' };
  const harness = stub(app, { period: period });
  const result = app.submitReviewStatusApi('MQA/FA5581', '  pemurnian selesai  ', 'tok', 'FKI');

  assert.strictEqual(harness.appended.length, 1, 'One row must be appended');
  const row = harness.appended[0];
  assert.strictEqual(row[0], 'P2026-11-21::MQA/FA5581::r1', 'Submission id must be period::code::revision');
  assert.strictEqual(row[1], 'P2026-11-21', 'Period id');
  assert.strictEqual(row[2], 'MQA/FA5581', 'Programme code');
  assert.strictEqual(row[3], 'FKI', 'Faculty');
  assert.strictEqual(row[4], 'pemurnian selesai', 'Status text must be trimmed');
  assert.strictEqual(row[5], 'DR. TEST COORDINATOR', 'Author name from the session');
  assert.strictEqual(row[6], 'coordinator@unisza.edu.my', 'Author email from the session');
  assert.strictEqual(Object.prototype.toString.call(row[7]), '[object Date]', 'Timestamp must be a Date');
  assert.ok(Number.isFinite(row[7].getTime()), 'Timestamp must be valid');
  assert.strictEqual(row[8], 'app', 'Source must be app');
  assert.strictEqual(row[9], 1, 'First revision');
  assert.strictEqual(result.mqa, 'MQA/FA5581', 'Payload must be returned for the page');
}

// 2. Revision increments when the same period already has entries.
{
  const app = makeApp();
  const period = { PeriodId: 'P2026-11-21', State: 'Open' };
  const harness = stub(app, {
    period: period,
    existing: [
      { PeriodId: 'P2026-11-21', MQACode: 'MQA/FA5581' },
      { PeriodId: 'P2026-11-21', MQACode: 'MQA/FA5581' },
      { PeriodId: 'P2025-03-13', MQACode: 'MQA/FA5581' }
    ]
  });
  app.submitReviewStatusApi('MQA/FA5581', 'kedua', 'tok', 'FKI');
  assert.strictEqual(harness.appended[0][9], 3, 'Revision counts only this period');
}

// 3. No open period rejects the write.
{
  const app = makeApp();
  stub(app, { period: null });
  assert.throws(function () {
    app.submitReviewStatusApi('MQA/FA5581', 'teks', 'tok', 'FKI');
  }, /No review cycle/, 'Closed cycle must reject submissions');
}

// 4. Empty text is rejected.
{
  const app = makeApp();
  stub(app, { period: { PeriodId: 'P2026-11-21', State: 'Open' } });
  assert.throws(function () {
    app.submitReviewStatusApi('MQA/FA5581', '   ', 'tok', 'FKI');
  }, /Please enter the review status/, 'Blank status must be rejected');
}

// 5. A closed cycle with no submission reports "Tidak dikemaskini".
{
  const app = makeApp();
  app.reviewPeriods_ = function () {
    return [{ PeriodId: 'P2025-03-13', Title: 'x', CutoffLabel: '13/03/2025', State: 'Closed', ClosesAt: new Date('2025-03-13T23:59:00+08:00') }];
  };
  app.reviewSubmissions_ = function () { return []; };
  app.Utilities = { formatDate: function () { return '13/03/2025'; } };
  const history = app.reviewHistoryFor_('MQA/FA5581');
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].missing, true, 'Missing submissions must be flagged');
  assert.strictEqual(history[0].statusText, 'Tidak dikemaskini');
}

// 6. A period past its close date counts as closed even if the sheet says Open.
{
  const app = makeApp();
  app.reviewPeriodState_ = app.reviewPeriodState_;
  const state = app.reviewPeriodState_({ State: 'Open', ClosesAt: new Date('2020-01-01T00:00:00+08:00') });
  assert.strictEqual(state, 'Closed', 'Expired open periods must be treated as closed');
}

// 7. Email reminders: one per faculty contact, counts per faculty, dry-run safe.
{
  const app = makeApp();
  const sent = [];
  app.activeReviewPeriod_ = function () {
    return { PeriodId: 'P2026-11-21', CutoffLabel: '21/11/2026', ClosesAt: new Date('2026-12-21T23:59:00+08:00'), State: 'Open' };
  };
  app.getProgrammes_ = function () {
    return [
      { mqaCode: 'MQA/FA1', faculty: 'FKI' },
      { mqaCode: 'MQA/FA2', faculty: 'FKI' },
      { mqaCode: 'MQA/FA3', faculty: 'FPP' }
    ];
  };
  app.reviewSubmissions_ = function () {
    return [{ PeriodId: 'P2026-11-21', MQACode: 'MQA/FA1' }];
  };
  app.reviewRecipients_ = function () {
    return [
      { faculty: 'FKI', name: 'Koordinator FKI', email: 'fki@unisza.edu.my' },
      { faculty: 'FPP', name: 'Koordinator FPP', email: 'fpp@unisza.edu.my' },
      { faculty: 'FUPL', name: 'Tiada program', email: 'fupl@unisza.edu.my' }
    ];
  };
  app.reviewPeriods_ = function () { return []; };
  app.ensureReviewPeriodColumns_ = function () { return { getDataRange: function () { return { getValues: function () { return [['PeriodId', 'ReminderSentAt']]; } }; }, getRange: function () { return { setValue: function () {} }; } }; };
  app.reviewLinks_ = function () { return 'https://example.test/exec?page=programmes'; };
  app.reviewDateLabel_ = function () { return '21/12/2026'; };
  app.GmailApp = { sendEmail: function (to, subject, body) { sent.push({ to: to, subject: subject, body: body }); } };

  const result = app.sendReviewEmails_('open', false, { email: 'admin@unisza.edu.my', name: 'Admin' });
  assert.strictEqual(result.sent, 2, 'One email per faculty that has programmes');
  assert.strictEqual(result.skipped, 1, 'Faculties without programmes are skipped');
  assert.strictEqual(sent[0].to, 'fki@unisza.edu.my');
  assert.ok(/Review cycle opened/.test(sent[0].subject), 'Subject must describe an opening');
  assert.ok(/Programmes updated: 1 \/ 2/.test(sent[0].body), 'Body must carry that faculty\'s counts');
  assert.ok(/Programmes updated: 0 \/ 1/.test(sent[1].body), 'Second faculty counts independently');

  // Reminder skips a faculty whose programmes are all updated.
  sent.length = 0;
  app.reviewSubmissions_ = function () {
    return [
      { PeriodId: 'P2026-11-21', MQACode: 'MQA/FA1' },
      { PeriodId: 'P2026-11-21', MQACode: 'MQA/FA2' }
    ];
  };
  const reminder = app.sendReviewEmails_('reminder', false, { email: 'admin@unisza.edu.my', name: 'Admin' });
  assert.strictEqual(reminder.sent, 1, 'Only the incomplete faculty is reminded');
  assert.strictEqual(sent[0].to, 'fpp@unisza.edu.my');

  // Dry run never emails a faculty address.
  sent.length = 0;
  app.sendReviewEmails_('open', true, { email: 'admin@unisza.edu.my', name: 'Admin' });
  assert.ok(sent.every(function (mail) { return mail.to === 'admin@unisza.edu.my'; }),
    'Dry run must route every message to the requester');
}

console.log('review status contract: OK');
