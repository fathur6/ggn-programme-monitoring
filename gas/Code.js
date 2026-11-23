/**
 * GGN MQF 2.0 — Programme tab generator (container-bound to the Postgraduate
 * Programme workbook).
 *
 * Creates one tab per programme from the "Programme" sheet so faculty can
 * collect:
 *   - PEO records (code, statement, MQF Domain)
 *   - PLO records (code, statement, MQF Domain, Embedded PEO, Taxonomy,
 *     SDG, sustainability competency and transversal future skill)
 *
 * This is an admin setup utility and intentionally uses no LockService.
 * It is idempotent: tabs that already exist are skipped, not overwritten.
 * Run from the Apps Script editor: select createProgrammeTabs() and click Run.
 */

var PROGRAMME_TAB_SECTIONS = {
  PEO: {
    headerRow: 1,
    columns: ['PEO', 'Statement', 'MQF Domain'],
    emptyRows: 6
  },
  PLO: {
    headerRow: 9,
    columns: ['PLO', 'Statement', 'MQF Domain', 'Embedded PEO', 'Taxonomy', 'SDG', 'SC', 'TF'],
    emptyRows: 10
  }
};

var MQF_DOMAIN_CODES_ = ['MQF 1', 'MQF 2', 'MQF 3a', 'MQF 3b', 'MQF 3c', 'MQF 3d', 'MQF 3e', 'MQF 3f', 'MQF 4a', 'MQF 4b', 'MQF 5'];
var TAXONOMY_CODES_ = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'A1', 'A2', 'A3', 'A4', 'A5', 'P1', 'P2', 'P3', 'P4', 'P5'];
var SDG_CODES_ = ['SDG1', 'SDG2', 'SDG3', 'SDG4', 'SDG5', 'SDG6', 'SDG7', 'SDG8', 'SDG9', 'SDG10', 'SDG11', 'SDG12', 'SDG13', 'SDG14', 'SDG15', 'SDG16', 'SDG17'];
var SDG_ELIGIBLE_PLO_CODES_ = ['PLO1', 'PLO9', 'PLO11'];
var SDG_ELIGIBLE_PLO_CODES_BY_PROGRAMME_ = {
  'MQA/FA5573': ['PLO1', 'PLO9', 'PLO10'],
  'MQA/FA5574': ['PLO1', 'PLO9', 'PLO10']
};
var SC_CODES_ = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8'];
var SC_ELIGIBLE_PLO_CODES_ = ['PLO2', 'PLO4', 'PLO9', 'PLO11'];
var SC_ELIGIBLE_PLO_CODES_BY_PROGRAMME_ = {
  'MQA/FA5573': ['PLO2', 'PLO4', 'PLO9', 'PLO10'],
  'MQA/FA5574': ['PLO2', 'PLO4', 'PLO9', 'PLO10']
};
var SC_CODES_BY_MQF_DOMAIN_ = { MQF2: 'SC3', MQF3B: 'SC5', MQF4A: 'SC7', MQF5: 'SC8' };
var TF_CODES_BY_MQF_DOMAIN_ = {
  MQF1: ['TF1'], MQF2: ['TF2'], MQF3A: ['TF3'], MQF3B: ['TF3'],
  MQF3C: ['TF3'], MQF3D: ['TF2'], MQF3E: ['TF2'], MQF3F: ['TF3'],
  MQF4A: ['TF1'], MQF4B: ['TF4'], MQF5: ['TF4']
};
var MAX_PLO_COUNT_ = 11;
var PROGRAMME_SPREADSHEET_ID_ = '1w5xrwoLJ7HpSZ_emgwqoGr-YcRVb7Zuq3KuDSmhUf6o';
var PDF_FOLDER_ID_ = '1W6FeqkIyIj_rTi8IzrbM7DLb1qprAX57';
/**
 * Single-workbook rule: programme records, PDF storage and the USER/ADMIN login
 * directory all live in PROGRAMME_SPREADSHEET_ID_. Do not introduce a second
 * spreadsheet ID — one workbook is the only source of truth.
 */
var USER_DIRECTORY_SHEET_NAME_ = 'USER';
var ADMIN_DIRECTORY_SHEET_NAME_ = 'ADMIN';
var PROGRAMME_ROLE_OWNER_ = 'Pemilik';
var PROGRAMME_ROLE_PARTNER_ = 'Berkongsi';
var PROGRAMME_PARTNER_TAB_SEPARATOR_ = '__';
var PDF_LOG_SHEET_NAME_ = 'PDF_Log';
var PDF_LOG_HEADERS_ = ['FileId', 'FileName', 'MQACode', 'Faculty', 'GeneratedBy', 'GeneratedByEmail', 'GeneratedAt', 'Source'];
var TIME_ZONE_ = 'Asia/Kuala_Lumpur';
var APP_NAME_ = 'Pengurusan Akademik Pascasiswazah UniSZA';
var APP_SHORT_NAME_ = 'Pengurusan Akademik Pascasiswazah UniSZA';
var REVIEW_PERIODS_SHEET_ = 'ReviewPeriods';
var REVIEW_SUBMISSIONS_SHEET_ = 'ReviewSubmissions';
var REVIEW_ROLES_SHEET_ = 'ReviewRoles';
var REVIEW_PERIOD_HEADERS_ = ['PeriodId', 'Title', 'CutoffLabel', 'OpensAt', 'ClosesAt', 'State', 'Note', 'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'ReminderSentAt'];
var REVIEW_SUBMISSION_HEADERS_ = ['SubmissionId', 'PeriodId', 'MQACode', 'Faculty', 'StatusText', 'SubmittedBy', 'SubmittedByEmail', 'SubmittedAt', 'Source', 'Revision'];
var REVIEW_ROLE_HEADERS_ = ['Email', 'Name', 'Role', 'Faculty', 'Active'];
var REVIEW_STATE_OPEN_ = 'Open';
var REVIEW_STATE_CLOSED_ = 'Closed';
var REVIEW_MISSING_TEXT_ = 'Tidak dikemaskini';
var REVIEW_BACKUP_FOLDER_ = 'GGN Review Backup';
var REVIEW_BACKUP_PREFIX_ = 'Status Semakan Program (backup)';
var USER_SESSION_PREFIX_ = 'mqf-programme-session:';
var USER_SESSION_TTL_SECONDS_ = 21600;

function createProgrammeTabs() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) {
    throw new Error('Sheet "Programme" not found. Check the first tab name.');
  }

  var data = sheet.getDataRange().getValues();
  var columns = resolveProgrammeColumns_(sheet, data);
  if (columns.mqaCode < 0) {
    throw new Error('Could not find the MQA Code column in the "Programme" sheet.');
  }

  var created = [];
  var skipped = [];
  var errors = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mqaCode = String(row[columns.mqaCode] || '').trim();
    var name = String(row[columns.name] || '').trim();
    if (!mqaCode && !name) continue;

    var tabName = sanitizeSheetName_(mqaCode || name);
    if (!tabName) continue;

    if (ss.getSheetByName(tabName)) {
      skipped.push(tabName);
      continue;
    }

    try {
      var tab = ss.insertSheet(tabName);
      seedProgrammeTab_(tab);
      created.push(tabName);
    } catch (e) {
      errors.push(tabName + ': ' + e.message);
    }
  }

  var summary = {
    rowsProcessed: data.length - 1,
    created: created,
    createdCount: created.length,
    skipped: skipped,
    skippedCount: skipped.length,
    errors: errors,
    errorsCount: errors.length
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * Writes the PEO and PLO section markers + column headers. The marker rows
 * also serve as the header row, so the layout stays parse-compatible with the
 * PEO/PLO read helpers used elsewhere in this project.
 */
function seedProgrammeTab_(tab) {
  var peo = PROGRAMME_TAB_SECTIONS.PEO;
  var plo = PROGRAMME_TAB_SECTIONS.PLO;

  var peoHeader = tab.getRange(peo.headerRow, 1, 1, peo.columns.length);
  peoHeader.setValues([peo.columns]).setFontWeight('bold');

  var ploHeader = tab.getRange(plo.headerRow, 1, 1, plo.columns.length);
  ploHeader.setValues([plo.columns]).setFontWeight('bold');

  tab.setFrozenRows(1);
  tab.getRange(peo.headerRow, 1).setBackground('#e8f0fe');
  tab.getRange(plo.headerRow, 1).setBackground('#e8f0fe');
}

/**
 * Google Sheets tab names cannot contain : \ ? * [ ] and cannot start/end
 * with an apostrophe; they are also limited to 100 characters.
 */
function sanitizeSheetName_(raw) {
  var name = String(raw || '').trim().replace(/[:\\?*\[\]]/g, '-');
  while (name.charAt(0) === "'") name = name.slice(1);
  while (name.charAt(name.length - 1) === "'") name = name.slice(0, -1);
  name = name.slice(0, 100);
  return name.trim();
}

/**
 * Header-aware column lookup with a fixed fallback matching the existing
 * programme sheet convention: B = name, C = MQA Code.
 */
function resolveProgrammeColumns_(sheet, data) {
  var header = (data && data[0]) || [];
  var find = function (aliases) {
    for (var c = 0; c < header.length; c++) {
      var cell = String(header[c] || '').trim().toLowerCase();
      if (!cell) continue;
      for (var a = 0; a < aliases.length; a++) {
        if (cell === aliases[a].toLowerCase()) return c;
      }
    }
    return -1;
  };

  var columns = {
    mqaCode: find(['MQA Code', 'MQA Reference Code', 'MQACode', 'Reference Code', 'MQA Ref']),
    name: find(['Programme Name', 'Name', 'Program Name', 'Nama Program', 'Programme Name (English)', 'Program Name (English)'])
  };

  if (columns.mqaCode < 0) columns.mqaCode = 2;
  if (columns.name < 0) columns.name = 1;
  return columns;
}

/**
 * GGN MQF 2.0 — Web app server (container-bound to the Postgraduate Programme
 * workbook).
 *
 * Serves the programme directory (Index.html) and the programme detail API.
 * Read-only: list from the "Programme" sheet, PEO/PLO from each per-programme
 * tab. Intentionally no LockService on read paths.
 */

/**
 * Page router. Every page has a real URL (?page=programmes|detail) so faculty can
 * bookmark or share a programme and the browser back button works. The Google
 * session and the page data are resolved on the server, so each page paints
 * complete without a second round trip.
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var page = String(params.page || 'programmes').toLowerCase();
  var returnUrl = deploymentUrl_() + (e && e.queryString ? '?' + e.queryString : '');

  var session = resolveGoogleSession_();
  if (!session.ok) {
    if (session.reason === 'no_google_session' || session.reason === 'wrong_domain') {
      session.signInUrl = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(returnUrl);
    }
    return renderAccessPage_(session);
  }

  maybeSendReviewReminder_(session.user);

  try {
    if (String(params.setup || '') === 'sharedrole') {
      if (!session.user.isAdmin) return jsonResponse_({ ok: false, error: 'Admin access required' });
      return jsonResponse_(setupSharedProgrammeRoleColumn());
    }
    if (String(params.setup || '') === 'pdflog') {
      if (!session.user.isAdmin) return jsonResponse_({ ok: false, error: 'Admin access required' });
      return jsonResponse_(backfillPdfLog_());
    }
    if (page === 'review') return renderReviewAdminPage_(session);
    if (page === 'detail') {
      var mqaCode = String(params.mqaCode || '').trim();
      if (mqaCode) {
        return renderProgrammeDetailPage_(session, mqaCode, String(params.faculty || '').trim());
      }
    }
    return renderProgrammeListPage_(session);
  } catch (err) {
    console.error('doGet failed: ' + (err && err.message ? err.message : err));
    return renderAccessPage_({
      reason: 'error',
      title: 'Sistem tidak dapat dimuatkan',
      message: 'Ralat semasa memuatkan halaman: ' + (err && err.message ? err.message : err),
      email: session.user && session.user.email
    });
  }
}

function renderProgrammeListPage_(session) {
  return renderPage_('PageProgrammes', APP_SHORT_NAME_ + ' — Program', {
    page: 'programmes',
    user: session.user,
    token: session.token,
    baseUrl: deploymentUrl_(),
    programmes: getProgrammesApi(session.token),
    pdfLog: listPdfLog_(session.user),
    canManageReview: canManageReview_(session.user),
    reviewSummary: canManageReview_(session.user) ? reviewSummaryPayload_() : null,
    maps: referenceMapsPayload_()
  });
}

function renderProgrammeDetailPage_(session, mqaCode, facultyHint) {
  var programme = resolveProgrammeForRead_(mqaCode, facultyHint);
  if (!programme) {
    return renderAccessPage_({
      reason: 'not_found',
      title: 'Program tidak ditemui',
      message: 'Program ' + mqaCode + ' tiada dalam skop akses akaun anda.',
      email: session.user.email
    });
  }

  var detail = getProgrammeDetailFor_(programme);
  return renderPage_('PageProgrammeDetail', APP_SHORT_NAME_ + ' — ' + programme.name, {
    page: 'detail',
    user: session.user,
    token: session.token,
    baseUrl: deploymentUrl_(),
    pdfLog: listPdfLog_(session.user, programme.mqaCode),
    changes: pendingChangesForProgramme_(programme.mqaCode),
    review: reviewPayloadFor_(programme, session.user),
    detail: {
      name: programme.name,
      nameMy: programme.nameMy,
      mqaCode: programme.mqaCode,
      progCode: programme.progCode,
      nec: programme.nee || '',
      mode: programme.mode || 'Research',
      canEdit: canEditProgramme_(programme, session.user),
      accreditation: programme.accreditation || '',
      level: programme.level,
      faculty: programme.faculty,
      facultyFull: programme.facultyFull,
      isSharedCode: detail.isSharedCode,
      role: detail.role,
      ownerFaculty: detail.ownerFaculty,
      hasOwnCopy: detail.hasOwnCopy,
      differsFromOwner: detail.differsFromOwner,
      peos: detail.peos,
      plos: detail.plos
    }
  });
}

/**
 * Run once from the Apps Script editor. It forces the Drive authorisation prompt
 * and proves the deployment account can reach the PDF folder.
 */
function checkPdfFolderAccess() {
  var folder = DriveApp.getFolderById(PDF_FOLDER_ID_);
  console.log('PDF folder: ' + folder.getName() + ' (' + folder.getId() + ')');
  return folder.getName();
}

/**
 * Review-status register. Periods are opened and closed by the PPS quality
 * coordinator (PJK) or the PPS deputy dean (TDA); faculties submit free-text
 * updates per programme. Submissions are append-only so the history is kept.
 */
function reviewSheet_(name, headers) {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureReviewTabs_() {
  return {
    periods: reviewSheet_(REVIEW_PERIODS_SHEET_, REVIEW_PERIOD_HEADERS_),
    submissions: reviewSheet_(REVIEW_SUBMISSIONS_SHEET_, REVIEW_SUBMISSION_HEADERS_),
    roles: reviewSheet_(REVIEW_ROLES_SHEET_, REVIEW_ROLE_HEADERS_)
  };
}

function reviewRows_(name) {
  var sheet = programmeSpreadsheet_().getSheetByName(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (value) { return String(value).trim(); });
  return data.slice(1).filter(function (row) {
    return row.some(function (cell) { return String(cell || '').trim() !== ''; });
  }).map(function (row) {
    var record = {};
    headers.forEach(function (header, index) { if (header) record[header] = row[index]; });
    return record;
  });
}

/** Effective state: a period whose window has passed counts as closed. */
function reviewPeriodState_(period) {
  if (!period) return '';
  var state = String(period.State || '').trim();
  if (state === REVIEW_STATE_CLOSED_) return REVIEW_STATE_CLOSED_;
  var closes = period.ClosesAt ? new Date(period.ClosesAt) : null;
  if (closes && !isNaN(closes.getTime()) && new Date() > closes) return REVIEW_STATE_CLOSED_;
  return state || REVIEW_STATE_CLOSED_;
}

function reviewPeriods_() {
  return reviewRows_(REVIEW_PERIODS_SHEET_).slice().sort(function (left, right) {
    return String(right.PeriodId || '').localeCompare(String(left.PeriodId || ''));
  });
}

function reviewSubmissions_() {
  return reviewRows_(REVIEW_SUBMISSIONS_SHEET_);
}

/** The cycle currently accepting submissions, if any. */
function activeReviewPeriod_() {
  var now = new Date();
  var open = reviewPeriods_().filter(function (period) {
    return reviewPeriodState_(period) === REVIEW_STATE_OPEN_;
  });
  for (var i = 0; i < open.length; i++) {
    var opens = open[i].OpensAt ? new Date(open[i].OpensAt) : null;
    if (opens && !isNaN(opens.getTime()) && now < opens) continue;
    return open[i];
  }
  return null;
}

function reviewPeriodModel_(period) {
  if (!period) return null;
  return {
    periodId: String(period.PeriodId || ''),
    title: String(period.Title || ''),
    cutoffLabel: String(period.CutoffLabel || ''),
    closesAtLabel: period.ClosesAt ? reviewDateLabel_(period.ClosesAt) : '',
    state: reviewPeriodState_(period)
  };
}

function reviewDateLabel_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, TIME_ZONE_, 'dd/MM/yyyy');
}

/** Malay long date used for cycle titles, e.g. "15 Disember 2026". */
function reviewLongDateLabel_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  var months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  return Utilities.formatDate(date, TIME_ZONE_, 'd') + ' ' +
    months[Number(Utilities.formatDate(date, TIME_ZONE_, 'M')) - 1] + ' ' +
    Utilities.formatDate(date, TIME_ZONE_, 'yyyy');
}

/**
 * One row per cycle for a programme, newest first. A closed cycle with no
 * submission is reported as "Tidak dikemaskini" so gaps stay visible.
 */
function reviewHistoryFor_(mqaCode) {
  var code = String(mqaCode || '').trim();
  var latest = {};
  reviewSubmissions_().forEach(function (row) {
    if (String(row.MQACode || '').trim() !== code) return;
    var periodId = String(row.PeriodId || '');
    var stamp = row.SubmittedAt instanceof Date ? row.SubmittedAt.getTime() : new Date(row.SubmittedAt).getTime();
    if (!latest[periodId] || (stamp || 0) >= latest[periodId].stamp) {
      latest[periodId] = { row: row, stamp: stamp || 0 };
    }
  });
  return reviewPeriods_().map(function (period) {
    var periodId = String(period.PeriodId || '');
    var hit = latest[periodId];
    var state = reviewPeriodState_(period);
    var closed = state === REVIEW_STATE_CLOSED_;
    return {
      periodId: periodId,
      title: String(period.Title || ''),
      cutoffLabel: String(period.CutoffLabel || ''),
      state: state,
      statusText: hit ? String(hit.row.StatusText || '') : (closed ? REVIEW_MISSING_TEXT_ : ''),
      missing: !hit && closed,
      submittedBy: hit ? String(hit.row.SubmittedBy || '') : '',
      submittedByEmail: hit ? String(hit.row.SubmittedByEmail || '') : '',
      submittedAtLabel: hit && hit.row.SubmittedAt ? reviewDateLabel_(hit.row.SubmittedAt) : '',
      source: hit ? String(hit.row.Source || '') : ''
    };
  });
}

function reviewPayloadFor_(programme, session) {
  var active = activeReviewPeriod_();
  var history = reviewHistoryFor_(programme.mqaCode);
  var current = null;
  if (active) {
    for (var i = 0; i < history.length; i++) {
      if (history[i].periodId === String(active.PeriodId)) { current = history[i]; break; }
    }
  }
  var isPartner = programme.role === PROGRAMME_ROLE_PARTNER_;
  var isOwnerFaculty = !!session && !isPartner && session.faculty === programme.faculty;
  return {
    active: reviewPeriodModel_(active),
    // Review status belongs to the faculty that owns the programme; a sharing
    // faculty copies it and never writes its own.
    canSubmit: !!active && !!session && !isPartner && (session.isAdmin || isOwnerFaculty),
    inheritedFrom: isPartner ? programme.ownerFaculty : '',
    currentText: current ? current.statusText : '',
    history: history,
    missingLabel: REVIEW_MISSING_TEXT_
  };
}

function getReviewStatusApi(mqaCode, sessionToken, faculty) {
  var session = requireLogin_(sessionToken);
  var programme = requireProgrammeFacultyAccess_(mqaCode, session, faculty);
  return reviewPayloadFor_(programme, session);
}

/** Append-only submission: the history keeps every revision. */
function submitReviewStatusApi(mqaCode, text, sessionToken, faculty) {
  var session = requireLogin_(sessionToken);
  var programme = requireProgrammeFacultyAccess_(mqaCode, session, faculty);
  if (programme.role === PROGRAMME_ROLE_PARTNER_) {
    throw new Error('Review status is maintained by the owning faculty (' + programme.ownerFaculty +
      '). A sharing faculty only copies that status.');
  }
  var period = activeReviewPeriod_();
  if (!period) throw new Error('No review cycle is open. Please contact the Graduate School quality coordinator.');
  var body = String(text || '').trim();
  if (!body) throw new Error('Please enter the review status before submitting.');

  var previous = reviewSubmissions_().filter(function (row) {
    return String(row.PeriodId || '') === String(period.PeriodId) &&
      String(row.MQACode || '') === programme.mqaCode;
  });
  var revision = previous.length + 1;
  ensureReviewTabs_().submissions.appendRow([
    String(period.PeriodId) + '::' + programme.mqaCode + '::r' + revision,
    period.PeriodId,
    programme.mqaCode,
    programme.faculty,
    body,
    session.name || '',
    session.email || '',
    new Date(),
    'app',
    revision
  ]);
  SpreadsheetApp.flush();
  return reviewPayloadFor_(programme, session);
}

/** Who may open/close a review cycle: PJK, the PPS deputy dean, and admins. */
function reviewRolesFor_(email) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return [];
  var known = ['PJK', 'TDA_PPS', 'PPA', 'PP'];
  var out = [];
  reviewRows_(REVIEW_ROLES_SHEET_).forEach(function (row) {
    if (String(row.Email || '').trim().toLowerCase() !== target) return;
    if (String(row.Active || 'Yes').trim().toLowerCase() === 'no') return;
    // Role should sit in the Role column; tolerate a shifted sheet by scanning
    // the remaining columns for a known role value.
    var candidates = [row.Role, row.Faculty, row.Name].map(function (v) {
      return String(v || '').trim().toUpperCase().replace(/\s+/g, '_');
    });
    for (var i = 0; i < candidates.length; i++) {
      if (known.indexOf(candidates[i]) !== -1) { out.push(candidates[i]); break; }
    }
  });
  return out;
}

var REVIEW_ADMIN_ROLES_ = ['PJK', 'TDA_PPS', 'PPA', 'PP'];

function canManageReview_(session) {
  if (!session) return false;
  if (session.isAdmin) return true;
  var roles = reviewRolesFor_(session.email);
  return roles.some(function (role) { return REVIEW_ADMIN_ROLES_.indexOf(role) !== -1; });
}

function requireReviewManager_(session) {
  if (!canManageReview_(session)) {
    throw new Error('Only the quality coordinator, the deputy dean or the academic programme coordinator may manage review cycles.');
  }
  return session;
}

function reviewAdminPayload_(session) {
  var programmes = getProgrammes_();
  var codeFaculty = {};
  programmes.forEach(function (programme) { if (!codeFaculty[programme.mqaCode]) codeFaculty[programme.mqaCode] = programme.faculty; });

  var submissions = reviewSubmissions_();
  var periods = reviewPeriods_();
  var active = activeReviewPeriod_();
  var focus = active || periods[0] || null;
  var focusId = focus ? String(focus.PeriodId) : '';

  var perPeriod = {};
  submissions.forEach(function (row) {
    var periodId = String(row.PeriodId || '');
    perPeriod[periodId] = perPeriod[periodId] || {};
    perPeriod[periodId][String(row.MQACode || '')] = true;
  });

  var facultyTotals = {};
  programmes.forEach(function (programme) {
    facultyTotals[programme.faculty] = (facultyTotals[programme.faculty] || 0) + 1;
  });
  var updatedByFaculty = {};
  Object.keys(perPeriod[focusId] || {}).forEach(function (code) {
    var faculty = codeFaculty[code];
    if (faculty) updatedByFaculty[faculty] = (updatedByFaculty[faculty] || 0) + 1;
  });

  var faculties = Object.keys(facultyTotals).sort().map(function (faculty) {
    var total = facultyTotals[faculty];
    var updated = updatedByFaculty[faculty] || 0;
    return {
      faculty: faculty,
      total: total,
      updated: updated,
      missing: Math.max(0, total - updated),
      percent: total ? Math.round((updated / total) * 100) : 0
    };
  });

  var unregistered = submissions.filter(function (row) {
    return !codeFaculty[String(row.MQACode || '')];
  }).map(function (row) {
    return {
      mqaCode: String(row.MQACode || ''),
      faculty: String(row.Faculty || ''),
      periodId: String(row.PeriodId || ''),
      statusText: String(row.StatusText || ''),
      submittedBy: String(row.SubmittedBy || '')
    };
  });

  return {
    canManage: canManageReview_(session),
    roles: reviewRolesFor_(session.email),
    active: reviewPeriodModel_(active),
    focusPeriodId: focusId,
    periods: periods.map(function (period) {
      var model = reviewPeriodModel_(period);
      var updated = Object.keys(perPeriod[model.periodId] || {}).filter(function (code) { return codeFaculty[code]; }).length;
      model.updated = updated;
      model.total = programmes.length;
      return model;
    }),
    faculties: faculties,
    programmesTotal: programmes.length,
    unregistered: unregistered
  };
}

function getReviewAdminApi(sessionToken) {
  var session = requireReviewManager_(requireLogin_(sessionToken));
  return reviewAdminPayload_(session);
}

/**
 * Create or update a cycle. Opening a cycle closes any other open cycle so
 * faculties always see exactly one deadline.
 */
function saveReviewPeriodApi(payload, sessionToken) {
  var session = requireReviewManager_(requireLogin_(sessionToken));
  var input = payload || {};
  var cutoff = String(input.cutoffDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('The cut-off date is not valid.');
  var closes = String(input.closesDate || '').trim();
  if (closes && !/^\d{4}-\d{2}-\d{2}$/.test(closes)) throw new Error('The closing date is not valid.');

  var periodId = String(input.periodId || '').trim() || 'P' + cutoff;
  var sheet = ensureReviewTabs_().periods;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (value) { return String(value).trim(); });
  var col = function (name) { return headers.indexOf(name) + 1; };

  var cutoffDate = new Date(cutoff + 'T12:00:00+08:00');
  var cutoffLabel = reviewDateLabel_(cutoffDate);
  var title = String(input.title || '').trim() || ('Status semakan setakat ' + reviewLongDateLabel_(cutoffDate));
  var closesAt = closes ? new Date(closes + 'T23:59:00+08:00') : '';
  var state = String(input.state || REVIEW_STATE_OPEN_).trim();

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col('PeriodId') - 1]).trim() === periodId) { rowIndex = i + 1; break; }
  }

  if (rowIndex === -1) {
    sheet.appendRow([periodId, title, cutoffLabel, '', closesAt, state, '', session.name || '', new Date(), session.name || '', new Date()]);
  } else {
    sheet.getRange(rowIndex, col('Title')).setValue(title);
    sheet.getRange(rowIndex, col('CutoffLabel')).setValue(cutoffLabel);
    sheet.getRange(rowIndex, col('ClosesAt')).setValue(closesAt);
    sheet.getRange(rowIndex, col('State')).setValue(state);
    sheet.getRange(rowIndex, col('UpdatedBy')).setValue(session.name || '');
    sheet.getRange(rowIndex, col('UpdatedAt')).setValue(new Date());
  }

  if (state === REVIEW_STATE_OPEN_) {
    var fresh = sheet.getDataRange().getValues();
    var head = fresh[0].map(function (value) { return String(value).trim(); });
    var idCol = head.indexOf('PeriodId') + 1;
    var stateCol = head.indexOf('State') + 1;
    for (var j = 1; j < fresh.length; j++) {
      var other = String(fresh[j][idCol - 1]).trim();
      if (other && other !== periodId && String(fresh[j][stateCol - 1]).trim() === REVIEW_STATE_OPEN_) {
        sheet.getRange(j + 1, stateCol).setValue(REVIEW_STATE_CLOSED_);
      }
    }
  }

  SpreadsheetApp.flush();
  return reviewAdminPayload_(session);
}

function setReviewPeriodStateApi(periodId, state, sessionToken) {
  var session = requireReviewManager_(requireLogin_(sessionToken));
  var target = String(periodId || '').trim();
  var next = String(state || '').trim() === REVIEW_STATE_OPEN_ ? REVIEW_STATE_OPEN_ : REVIEW_STATE_CLOSED_;
  if (!target) throw new Error('The cycle is not valid.');
  var sheet = ensureReviewTabs_().periods;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (value) { return String(value).trim(); });
  var idCol = headers.indexOf('PeriodId') + 1;
  var stateCol = headers.indexOf('State') + 1;
  var updatedCol = headers.indexOf('UpdatedBy') + 1;
  var updatedAtCol = headers.indexOf('UpdatedAt') + 1;
  var found = false;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idCol - 1]).trim();
    if (next === REVIEW_STATE_OPEN_ && id !== target && String(data[i][stateCol - 1]).trim() === REVIEW_STATE_OPEN_) {
      sheet.getRange(i + 1, stateCol).setValue(REVIEW_STATE_CLOSED_);
    }
    if (id !== target) continue;
    sheet.getRange(i + 1, stateCol).setValue(next);
    if (updatedCol > 0) sheet.getRange(i + 1, updatedCol).setValue(session.name || '');
    if (updatedAtCol > 0) sheet.getRange(i + 1, updatedAtCol).setValue(new Date());
    found = true;
  }
  if (!found) throw new Error('The cycle was not found.');
  SpreadsheetApp.flush();
  if (next === REVIEW_STATE_CLOSED_) {
    try { syncReviewBackup_(); } catch (err) {
      console.error('Review backup failed: ' + (err && err.message ? err.message : err));
    }
  }
  return reviewAdminPayload_(session);
}

/** Folder that keeps the Excel mirror of the review register. */
function reviewBackupFolder_() {
  var ssFile = DriveApp.getFileById(PROGRAMME_SPREADSHEET_ID_);
  var parents = ssFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var existing = parent.getFoldersByName(REVIEW_BACKUP_FOLDER_);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(REVIEW_BACKUP_FOLDER_);
}

/** Column letter for a zero-based index (0 -> A, 26 -> AA). */
function xlsxColumnName_(index) {
  var n = index + 1;
  var name = '';
  while (n > 0) {
    var remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function xmlEscape_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * Builds a real .xlsx from a matrix with no network call, so the export needs no
 * extra OAuth scope. Cells are written as inline strings.
 */
function buildXlsxBlob_(rows, sheetName) {
  var sheetRows = rows.map(function (row, rowIndex) {
    var cells = row.map(function (value, columnIndex) {
      var ref = xlsxColumnName_(columnIndex) + (rowIndex + 1);
      var text = xmlEscape_(value);
      if (text === '') return '<c r="' + ref + '"/>';
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + text + '</t></is></c>';
    }).join('');
    return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>';
  }).join('');

  var header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  var sheetXml = header +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + sheetRows + '</sheetData></worksheet>';
  var workbookXml = header +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="' + xmlEscape_(sheetName || 'Sheet1') + '" sheetId="1" r:id="rId1"/></sheets></workbook>';
  var workbookRels = header +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>';
  var rootRels = header +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  var contentTypes = header +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>';

  return Utilities.zip([
    Utilities.newBlob(contentTypes, 'application/xml', '[Content_Types].xml'),
    Utilities.newBlob(rootRels, 'application/xml', '_rels/.rels'),
    Utilities.newBlob(workbookXml, 'application/xml', 'xl/workbook.xml'),
    Utilities.newBlob(workbookRels, 'application/xml', 'xl/_rels/workbook.xml.rels'),
    Utilities.newBlob(sheetXml, 'application/xml', 'xl/worksheets/sheet1.xml')
  ], (sheetName || 'sheet') + '.xlsx').setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Excel mirror. Our Google Sheet stays authoritative; this writes a fresh .xlsx
 * (programmes × cycles) into the backup folder, replacing the previous copy.
 */
function syncReviewBackup_() {
  // Remove temporary workbooks left by earlier export attempts.
  try {
    var stale = DriveApp.searchFiles('title contains "review-backup-" and trashed = false');
    while (stale.hasNext()) stale.next().setTrashed(true);
  } catch (err) {
    console.error('Review backup cleanup failed: ' + (err && err.message ? err.message : err));
  }

  var programmes = getProgrammes_();
  var periods = reviewPeriods_().slice().reverse();
  var submissions = {};
  reviewSubmissions_().forEach(function (row) {
    var key = String(row.PeriodId || '') + '::' + String(row.MQACode || '');
    var stamp = row.SubmittedAt instanceof Date ? row.SubmittedAt.getTime() : new Date(row.SubmittedAt).getTime();
    if (!submissions[key] || (stamp || 0) >= submissions[key].stamp) {
      submissions[key] = { row: row, stamp: stamp || 0 };
    }
  });

  var header = ['MQA Code', 'Programme', 'Faculty', 'Level'];
  periods.forEach(function (period) {
    header.push(String(period.CutoffLabel || period.PeriodId) + ' — Status');
    header.push('Dikemaskini oleh');
    header.push('Tarikh');
  });

  var rows = [header];
  programmes.forEach(function (programme) {
    var line = [programme.mqaCode, programme.name, programme.faculty, programme.level];
    periods.forEach(function (period) {
      var hit = submissions[String(period.PeriodId) + '::' + programme.mqaCode];
      var closed = reviewPeriodState_(period) === REVIEW_STATE_CLOSED_;
      line.push(hit ? String(hit.row.StatusText || '') : (closed ? REVIEW_MISSING_TEXT_ : ''));
      line.push(hit ? String(hit.row.SubmittedBy || '') : '');
      line.push(hit && hit.row.SubmittedAt ? reviewDateLabel_(hit.row.SubmittedAt) : '');
    });
    rows.push(line);
  });

  var fileName = REVIEW_BACKUP_PREFIX_ + '.xlsx';
  var blob = buildXlsxBlob_(rows, 'Semakan').setName(fileName);

  var folder = reviewBackupFolder_();
  var existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true); // keep one fresh binary copy
  var file = folder.createFile(blob);
  file.setName(fileName);

  return {
    ok: true,
    fileId: file.getId(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    rows: rows.length - 1,
    periods: periods.length
  };
}

function syncReviewBackupApi(sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  return syncReviewBackup_();
}

/** Make sure late-added columns exist on an older sheet. */
function ensureReviewPeriodColumns_() {
  var sheet = ensureReviewTabs_().periods;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), REVIEW_PERIOD_HEADERS_.length)).getValues()[0]
    .map(function (value) { return String(value).trim(); });
  var missing = [];
  REVIEW_PERIOD_HEADERS_.forEach(function (name, index) {
    if (headers.indexOf(name) === -1) missing.push({ name: name, column: index + 1 });
  });
  missing.forEach(function (item) {
    sheet.getRange(1, item.column).setValue(item.name).setFontWeight('bold');
    if (lastRow < 2) sheet.getRange(2, item.column).setValue('');
  });
  return sheet;
}

function reviewLinks_() {
  return deploymentUrl_() + '?page=programmes';
}

/**
 * Email each faculty contact about the open cycle. dryRun routes everything to
 * the requester so the wording can be checked without emailing the faculties.
 */
/**
 * Recipients for review emails, read directly from the USER sheet so the result
 * does not depend on the login directory helper.
 */
function reviewRecipients_() {
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var header = data[0].map(function (value) { return String(value).trim().toLowerCase(); });
  var facultyCol = header.indexOf('faculty');
  var nameCol = header.indexOf('graduate coordinator');
  var emailCol = header.indexOf('graduate coordinator email');
  if (facultyCol < 0 || emailCol < 0) return [];
  return data.slice(1).reduce(function (out, row) {
    var email = String(row[emailCol] || '').trim().toLowerCase();
    if (!email || email.indexOf('@') === -1) return out;
    out.push({
      faculty: String(row[facultyCol] || '').replace(/\s+/g, ' ').trim(),
      name: nameCol < 0 ? '' : String(row[nameCol] || '').trim(),
      email: email
    });
    return out;
  }, []);
}

var REVIEW_EMAIL_COPY_ = {
  ms: {
    subjectOpen: '[Pengurusan Akademik] Sesi semakan dibuka',
    subjectReminder: '[Pengurusan Akademik] Peringatan semakan program',
    greeting: 'Assalamualaikum dan salam sejahtera {name},',
    openLine: 'Sesi kemaskini status semakan program telah dibuka (cut-off {cutoff}).',
    reminderLine: 'Peringatan: sesi kemaskini status semakan program akan ditutup pada {date}.',
    faculty: 'Fakulti', updated: 'Program dikemaskini', outstanding: 'Baki',
    link: 'Kemas kini melalui', closing: 'Sekian, terima kasih.', signature: 'Pusat Pengajian Siswazah'
  },
  en: {
    subjectOpen: '[Academic Management] Review cycle opened',
    subjectReminder: '[Academic Management] Review reminder',
    greeting: 'Dear {name},',
    openLine: 'The programme review status cycle is now open (cut-off {cutoff}).',
    reminderLine: 'Reminder: the programme review status cycle closes on {date}.',
    faculty: 'Faculty', updated: 'Programmes updated', outstanding: 'Outstanding',
    link: 'Update at', closing: 'Thank you.', signature: 'Graduate School'
  },
  ar: {
    subjectOpen: '[الإدارة الأكاديمية] فتح دورة المراجعة',
    subjectReminder: '[الإدارة الأكاديمية] تذكير بالمراجعة',
    greeting: 'السلام عليكم {name}،',
    openLine: 'تم فتح دورة تحديث حالة مراجعة البرامج (تاريخ الإغلاق {cutoff}).',
    reminderLine: 'تذكير: تُغلق دورة تحديث حالة المراجعة في {date}.',
    faculty: 'الكلية', updated: 'البرامج المحدّثة', outstanding: 'المتبقي',
    link: 'التحديث عبر', closing: 'شكرًا لكم.', signature: 'كلية الدراسات العليا'
  }
};

function sendReviewEmails_(kind, dryRun, session, limit) {
  var period = activeReviewPeriod_();
  if (!period) throw new Error('Tiada sesi semakan yang dibuka.');
  // Faculty labels come from two sheets; normalise so invisible whitespace or
  // casing differences cannot silently drop every recipient.
  var facultyKey_ = function (value) {
    return String(value || '').replace(/[\s\u00A0]+/g, '').toUpperCase();
  };
  var programmes = getProgrammes_();
  var codeFaculty = {};
  programmes.forEach(function (programme) { codeFaculty[programme.mqaCode] = facultyKey_(programme.faculty); });
  var totals = {};
  programmes.forEach(function (programme) {
    var key = facultyKey_(programme.faculty);
    totals[key] = (totals[key] || 0) + 1;
  });

  var submitted = {};
  reviewSubmissions_().forEach(function (row) {
    if (String(row.PeriodId || '') !== String(period.PeriodId)) return;
    var faculty = codeFaculty[String(row.MQACode || '')];
    if (faculty) { submitted[faculty] = submitted[faculty] || {}; submitted[faculty][String(row.MQACode)] = true; }
  });

  var contacts = reviewRecipients_();
  var link = reviewLinks_();
  var cutoff = String(period.CutoffLabel || '');
  var closes = period.ClosesAt ? reviewDateLabel_(period.ClosesAt) : '';
  var sent = 0;
  var skipped = 0;
  var seen = {};

  contacts.forEach(function (contact) {
    if (limit && sent >= limit) return;
    var faculty = contact.faculty;
    var total = totals[facultyKey_(faculty)] || 0;
    if (!total) { skipped++; return; }
    var done = Object.keys(submitted[facultyKey_(faculty)] || {}).length;
    if (kind === 'reminder' && done >= total) { skipped++; return; }
    if (seen[contact.email]) return;
    seen[contact.email] = true;

    var to = dryRun ? session.email : contact.email;
    var lang = normaliseLang_(userLanguageFor_(contact.email));
    var copy = REVIEW_EMAIL_COPY_[lang] || REVIEW_EMAIL_COPY_.en;
    var subject = (kind === 'reminder' ? copy.subjectReminder : copy.subjectOpen) + ' — ' + cutoff;
    var lines = [
      copy.greeting.replace('{name}', contact.name || ''),
      '',
      kind === 'reminder' ? copy.reminderLine.replace('{date}', closes || cutoff)
                          : copy.openLine.replace('{cutoff}', cutoff),
      '',
      copy.faculty + ': ' + faculty,
      copy.updated + ': ' + done + ' / ' + total,
      copy.outstanding + ': ' + Math.max(0, total - done),
      '',
      copy.link + ': ' + link,
      '',
      copy.closing,
      copy.signature
    ];
    GmailApp.sendEmail(to, subject, lines.join('\n'), { name: 'Pusat Pengajian Siswazah UniSZA' });
    sent++;
  });

  if (kind === 'reminder') {
    var sheet = ensureReviewPeriodColumns_();
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (value) { return String(value).trim(); });
    var idCol = headers.indexOf('PeriodId');
    var stampCol = headers.indexOf('ReminderSentAt');
    if (stampCol > -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idCol]).trim() === String(period.PeriodId)) {
          sheet.getRange(i + 1, stampCol + 1).setValue(new Date());
        }
      }
    }
  }

  return { ok: true, kind: kind, dryRun: !!dryRun, sent: sent, skipped: skipped, recipients: contacts.length };
}

function sendReviewEmailsApi(kind, dryRun, sessionToken) {
  var session = requireReviewManager_(requireLogin_(sessionToken));
  return sendReviewEmails_(String(kind || 'open'), !!dryRun, session);
}

/**
 * Lazy reminder: runs when someone opens the app, so it needs no trigger
 * permission. Sends at most once per day and only inside the last five days of
 * the open cycle.
 */
function maybeSendReviewReminder_(session) {
  try {
    var period = activeReviewPeriod_();
    if (!period || !period.ClosesAt) return;
    var closes = new Date(period.ClosesAt);
    if (isNaN(closes.getTime())) return;
    var days = Math.ceil((closes.getTime() - new Date().getTime()) / 86400000);
    if (days < 0 || days > 5) return;

    var last = period.ReminderSentAt ? new Date(period.ReminderSentAt) : null;
    if (last && !isNaN(last.getTime())) {
      var today = Utilities.formatDate(new Date(), TIME_ZONE_, 'yyyy-MM-dd');
      if (Utilities.formatDate(last, TIME_ZONE_, 'yyyy-MM-dd') === today) return;
    }
    sendReviewEmails_('reminder', false, session || { email: '', name: '' });
  } catch (err) {
    console.error('Review reminder failed: ' + (err && err.message ? err.message : err));
  }
}

/** USER sheet rows for the admin console (no auth check inside). */
function directoryPayload_() {
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) return { rows: [] };
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = String(row[1] || '').trim();
    var email = String(row[2] || '').trim();
    if (!name && !email) continue;
    rows.push({
      rowIndex: i + 1,
      faculty: String(row[0] || '').trim(),
      name: name,
      email: email,
      position: String(row[3] || '').trim()
    });
  }
  return { count: rows.length, rows: rows };
}

function getDirectoryAdminApi(sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  return directoryPayload_();
}

function saveDirectoryAdminApi(payload, sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  var input = payload || {};
  var faculty = String(input.faculty || '').trim();
  var name = String(input.name || '').trim();
  var email = String(input.email || '').trim().toLowerCase();
  var position = String(input.position || '').trim();
  if (!faculty || !name || !email) throw new Error('Faculty, name and email are required.');
  if (!/@unisza\.edu\.my$/.test(email)) throw new Error('The email must end with @unisza.edu.my.');

  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  var rowIndex = Number(input.rowIndex || 0);
  if (rowIndex >= 2) {
    sheet.getRange(rowIndex, 1, 1, 4).setValues([[faculty, name, email, position]]);
  } else {
    sheet.appendRow([faculty, name, email, position]);
  }
  SpreadsheetApp.flush();
  return directoryPayload_();
}

function removeDirectoryAdminApi(rowIndex, sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  var index = Number(rowIndex || 0);
  if (index < 2) throw new Error('Baris tidak sah.');
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (index > sheet.getLastRow()) throw new Error('Baris tidak ditemui.');
  sheet.deleteRow(index);
  SpreadsheetApp.flush();
  return directoryPayload_();
}

/** Administrators: who may open cycles, edit the directory and manage admins. */
function reviewRolesPayload_() {
  var sheet = programmeSpreadsheet_().getSheetByName(REVIEW_ROLES_SHEET_);
  if (!sheet) return { count: 0, rows: [] };
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][0] || '').trim();
    if (!email) continue;
    rows.push({
      rowIndex: i + 1,
      email: email,
      name: String(data[i][1] || '').trim(),
      role: String(data[i][2] || '').trim(),
      faculty: String(data[i][3] || '').trim(),
      active: String(data[i][4] || 'Yes').trim()
    });
  }
  return { count: rows.length, rows: rows, roles: REVIEW_ADMIN_ROLES_ };
}

function saveReviewRoleApi(payload, sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  var input = payload || {};
  var email = String(input.email || '').trim().toLowerCase();
  var name = String(input.name || '').trim();
  var role = String(input.role || '').trim();
  var faculty = String(input.faculty || '').trim();
  if (!email || !name) throw new Error('Name and email are required.');
  if (!/@unisza\.edu\.my$/.test(email)) throw new Error('E-mel mesti @unisza.edu.my.');
  if (REVIEW_ADMIN_ROLES_.indexOf(role) === -1) throw new Error('The role is not valid.');

  var sheet = programmeSpreadsheet_().getSheetByName(REVIEW_ROLES_SHEET_);
  var rowIndex = Number(input.rowIndex || 0);
  if (rowIndex >= 2) sheet.getRange(rowIndex, 1, 1, 5).setValues([[email, name, role, faculty, 'Yes']]);
  else sheet.appendRow([email, name, role, faculty, 'Yes']);
  SpreadsheetApp.flush();
  return reviewRolesPayload_();
}

function removeReviewRoleApi(rowIndex, sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  var index = Number(rowIndex || 0);
  var sheet = programmeSpreadsheet_().getSheetByName(REVIEW_ROLES_SHEET_);
  if (!sheet || index < 2 || index > sheet.getLastRow()) throw new Error('The administrator record was not found.');
  var email = String(sheet.getRange(index, 1).getValue() || '').trim().toLowerCase();
  var current = requireLogin_(sessionToken);
  if (email && current && email === String(current.email || '').toLowerCase()) {
    throw new Error('You cannot remove your own administrator access.');
  }
  sheet.deleteRow(index);
  SpreadsheetApp.flush();
  return reviewRolesPayload_();
}

/** Compact review summary for the landing dashboard (managers only). */
function reviewSummaryPayload_() {
  var programmes = getProgrammes_();
  var codeFaculty = {};
  programmes.forEach(function (p) { if (!codeFaculty[p.mqaCode]) codeFaculty[p.mqaCode] = p.faculty; });
  var periods = reviewPeriods_();
  var active = activeReviewPeriod_();
  var focus = active || periods[0] || null;
  var focusId = focus ? String(focus.PeriodId) : '';

  var updated = {};
  reviewSubmissions_().forEach(function (row) {
    if (String(row.PeriodId || '') !== focusId) return;
    var faculty = codeFaculty[String(row.MQACode || '')];
    if (faculty) updated[faculty] = (updated[faculty] || 0) + 1;
  });

  var totals = {};
  programmes.forEach(function (p) { totals[p.faculty] = (totals[p.faculty] || 0) + 1; });
  var faculties = Object.keys(totals).sort().map(function (faculty) {
    var total = totals[faculty];
    var done = updated[faculty] || 0;
    return { faculty: faculty, total: total, updated: done, missing: Math.max(0, total - done),
      percent: total ? Math.round((done / total) * 100) : 0 };
  });

  var doneAll = faculties.reduce(function (n, f) { return n + f.updated; }, 0);
  var perPeriod = {};
  reviewSubmissions_().forEach(function (row) {
    var pid = String(row.PeriodId || '');
    perPeriod[pid] = perPeriod[pid] || {};
    perPeriod[pid][String(row.MQACode || '')] = true;
  });

  return {
    active: reviewPeriodModel_(active),
    focusLabel: focus ? String(focus.Title || focus.CutoffLabel) : '',
    sessions: periods.map(function (period) {
      var model = reviewPeriodModel_(period);
      var done = Object.keys(perPeriod[model.periodId] || {}).filter(function (code) { return codeFaculty[code]; }).length;
      model.updated = done;
      model.total = programmes.length;
      return model;
    }),
    faculties: faculties,
    totalProgrammes: programmes.length,
    updatedTotal: doneAll
  };
}

function getReviewSummaryApi(sessionToken) {
  requireReviewManager_(requireLogin_(sessionToken));
  return reviewSummaryPayload_();
}

/** Per-user interface language, stored in the USER sheet. Defaults to English. */
var USER_LANGUAGE_HEADER_ = 'Language';

function userLanguageColumn_() {
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) return 0;
  var header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function (v) { return String(v).trim(); });
  var index = header.indexOf(USER_LANGUAGE_HEADER_);
  if (index === -1) {
    var col = header.length + 1;
    sheet.getRange(1, col).setValue(USER_LANGUAGE_HEADER_).setFontWeight('bold');
    return col;
  }
  return index + 1;
}

function normaliseLang_(code) {
  return ['ms', 'en', 'ar'].indexOf(String(code || '').toLowerCase()) === -1 ? 'en' : String(code).toLowerCase();
}

function userLanguageFor_(email) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return 'en';
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) return 'en';
  var data = sheet.getDataRange().getValues();
  if (data.length < 2 || data[0].length < 3) return 'en';
  var col = userLanguageColumn_();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2] || '').trim().toLowerCase() === target) {
      return normaliseLang_(col ? data[i][col - 1] : '');
    }
  }
  return 'en';
}

function saveUserLanguageApi(code, sessionToken) {
  var session = requireLogin_(sessionToken);
  var lang = normaliseLang_(code);
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  var col = userLanguageColumn_();
  var data = sheet.getDataRange().getValues();
  var email = String(session.email || '').trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2] || '').trim().toLowerCase() === email) {
      sheet.getRange(i + 1, col).setValue(lang);
      SpreadsheetApp.flush();
      return { ok: true, language: lang };
    }
  }
  return { ok: false, language: lang, reason: 'not_listed' };
}

/**
 * University-wide SDG map: which programmes map which PLOs to each SDG.
 * Reading every programme tab is expensive, so the result is cached for 15 minutes.
 */
function sdgMapPayload_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('sdg-map-v1');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var programmes = getProgrammes_();
  var seen = {};
  var bySdg = {};
  var mapped = 0;

  programmes.forEach(function (programme) {
    if (seen[programme.mqaCode]) return;
    seen[programme.mqaCode] = true;
    var content = readProgrammeSheet_(programme.tabName, programme.mqaCode);
    (content.plos || []).forEach(function (plo) {
      var sdg = String(plo.sdg || '').trim().toUpperCase();
      if (!/^SDG[0-9]{1,2}$/.test(sdg)) return;
      var group = bySdg[sdg] || (bySdg[sdg] = { sdg: sdg, programmes: {}, ploCount: 0, entries: [] });
      group.programmes[programme.mqaCode] = true;
      group.ploCount += 1;
      group.entries.push({
        mqaCode: programme.mqaCode,
        name: programme.name,
        faculty: programme.faculty,
        plo: plo.code,
        statement: plo.statement
      });
      mapped += 1;
    });
  });

  var list = Object.keys(bySdg).map(function (key) {
    var group = bySdg[key];
    return {
      sdg: key,
      programmeCount: Object.keys(group.programmes).length,
      ploCount: group.ploCount,
      entries: group.entries
    };
  }).sort(function (a, b) {
    return b.programmeCount - a.programmeCount || a.sdg.localeCompare(b.sdg, undefined, { numeric: true });
  });

  var payload = {
    totalProgrammes: Object.keys(seen).length,
    mappedPlos: mapped,
    sdgs: list
  };
  try { cache.put('sdg-map-v1', JSON.stringify(payload), 900); } catch (e) {}
  return payload;
}

function getSdgMapApi(sessionToken) {
  requireLogin_(sessionToken);
  return sdgMapPayload_();
}

function sdgMapApi(sessionToken) {
  requireLogin_(sessionToken);
  try { CacheService.getScriptCache().remove('sdg-map-v1'); } catch (e) {}
  return sdgMapPayload_();
}

/**
 * Reference maps (SDG, SC, TF) for every programme in one scan. Each entry lists
 * the programmes and PLOs mapped to that code. Cached for 15 minutes.
 */
function referenceMapsPayload_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('ref-maps-v1');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var programmes = getProgrammes_();
  var seen = {};
  var groups = { sdg: {}, sc: {}, tf: {} };
  var patterns = { sdg: /^SDG[0-9]{1,2}$/, sc: /^SC[0-9]{1,2}$/, tf: /^TF[0-9]{1,2}$/ };

  programmes.forEach(function (programme) {
    if (seen[programme.mqaCode]) return;
    seen[programme.mqaCode] = true;
    var content = readProgrammeSheet_(programme.tabName, programme.mqaCode);
    (content.plos || []).forEach(function (plo) {
      ['sdg', 'sc', 'tf'].forEach(function (kind) {
        var code = String(plo[kind] || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!patterns[kind].test(code)) return;
        var bucket = groups[kind][code] || (groups[kind][code] = { code: code, programmes: {}, ploCount: 0, entries: [] });
        bucket.programmes[programme.mqaCode] = true;
        bucket.ploCount += 1;
        bucket.entries.push({
          mqaCode: programme.mqaCode,
          name: programme.name,
          faculty: programme.faculty,
          plo: plo.code,
          statement: plo.statement
        });
      });
    });
  });

  var total = Object.keys(seen).length;
  var shape = function (kind) {
    return Object.keys(groups[kind]).map(function (code) {
      var g = groups[kind][code];
      var count = Object.keys(g.programmes).length;
      return {
        code: code,
        programmeCount: count,
        ploCount: g.ploCount,
        percent: total ? Math.round((count / total) * 100) : 0,
        entries: g.entries
      };
    }).sort(function (a, b) {
      return b.programmeCount - a.programmeCount || a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  };

  var payload = { totalProgrammes: total, sdg: shape('sdg'), sc: shape('sc'), tf: shape('tf') };
  // 1 hour: the scan reads every programme tab, so keep it warm longer.
  try { cache.put('ref-maps-v1', JSON.stringify(payload), 3600); } catch (e) {}
  return payload;
}

/**
 * Programme metadata changes: the owning faculty proposes, a PPS approver decides.
 * Approved values are written to the Programme sheet by column.
 */
var CHANGE_SHEET_ = 'ProgrammeChangeRequests';
var CHANGE_HEADERS_ = ['RequestId', 'MQACode', 'Faculty', 'Changes', 'RequestedBy', 'RequestedByEmail',
  'RequestedAt', 'Status', 'DecidedBy', 'DecidedAt'];
var PROGRAMME_META_FIELDS_ = ['nameMy', 'name', 'progCode', 'nec', 'accreditation', 'mode'];
var PROGRAMME_META_COLUMNS_ = { nameMy: 1, name: 2, progCode: 5, nec: 4, accreditation: 6, mode: 12 };

function changeSheet_() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(CHANGE_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(CHANGE_SHEET_);
    sheet.getRange(1, 1, 1, CHANGE_HEADERS_.length).setValues([CHANGE_HEADERS_]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function changeRows_() {
  var sheet = programmeSpreadsheet_().getSheetByName(CHANGE_SHEET_);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var header = data[0].map(function (v) { return String(v).trim(); });
  return data.slice(1).filter(function (row) { return String(row[0] || '').trim(); }).map(function (row) {
    var out = {};
    header.forEach(function (name, i) { if (name) out[name] = row[i]; });
    return out;
  });
}

/** Who may approve: the named PPS approvers, plus the super-user roles. */
function canApproveChanges_(session) {
  if (!session) return false;
  var email = String(session.email || '').trim().toLowerCase();
  var named = ['fathurrahman@unisza.edu.my', 'fatinhannani@unisza.edu.my',
    'fairuznasir@unisza.edu.my', 'yusnitayusof@unisza.edu.my'];
  if (named.indexOf(email) !== -1) return true;
  return ppsEditorRoles_(session).length > 0;
}

function pendingChangesForProgramme_(mqaCode) {
  var code = String(mqaCode || '').trim();
  return changeRows_().filter(function (row) {
    return String(row.MQACode || '').trim() === code && String(row.Status || '') === 'Pending';
  }).map(function (row) {
    var changes = {};
    try { changes = JSON.parse(String(row.Changes || '{}')); } catch (e) { changes = {}; }
    return {
      requestId: String(row.RequestId || ''),
      requestedBy: String(row.RequestedBy || ''),
      requestedAt: row.RequestedAt ? reviewDateLabel_(row.RequestedAt) : '',
      changes: changes
    };
  });
}

function submitProgrammeChangeApi(mqaCode, changes, sessionToken, faculty) {
  var session = requireLogin_(sessionToken);
  var programme = resolveProgrammeForRead_(mqaCode, faculty);
  if (!programme) throw new Error('The programme was not found.');
  if (!canEditProgramme_(programme, session)) {
    throw new Error('You may only propose changes for programmes under your own faculty.');
  }
  var clean = {};
  if (changes && String(changes.__action || '') === 'delete') {
    clean = { __action: 'delete' };
  } else {
    PROGRAMME_META_FIELDS_.forEach(function (field) {
      if (changes && Object.prototype.hasOwnProperty.call(changes, field)) {
        var value = String(changes[field] == null ? '' : changes[field]).trim();
        var current = String(programme[field] || '').trim();
        if (value !== current) clean[field] = value;
      }
    });
  }
  if (!Object.keys(clean).length) throw new Error('No changes to submit.');

  changeSheet_().appendRow([
    Utilities.getUuid(), programme.mqaCode, programme.faculty, JSON.stringify(clean),
    session.name || '', session.email || '', new Date(), 'Pending', '', ''
  ]);
  SpreadsheetApp.flush();
  return { ok: true, pending: pendingChangesForProgramme_(programme.mqaCode).length };
}

function getProgrammeChangesApi(mqaCode, sessionToken, faculty) {
  var session = requireLogin_(sessionToken);
  var programme = resolveProgrammeForRead_(mqaCode, faculty);
  if (!programme) throw new Error('The programme was not found.');
  return {
    pending: pendingChangesForProgramme_(programme.mqaCode),
    canApprove: canApproveChanges_(session),
    canEdit: canEditProgramme_(programme, session)
  };
}

function listChangeRequestsApi(sessionToken) {
  var session = requireLogin_(sessionToken);
  if (!canApproveChanges_(session)) throw new Error('Only PPS approvers may review change requests.');
  var programmes = getProgrammes_();
  var byCode = {};
  programmes.forEach(function (p) { if (!byCode[p.mqaCode]) byCode[p.mqaCode] = p; });
  return changeRows_().filter(function (row) {
    return String(row.Status || '') === 'Pending';
  }).map(function (row) {
    var code = String(row.MQACode || '');
    var programme = byCode[code] || {};
    var changes = {};
    try { changes = JSON.parse(String(row.Changes || '{}')); } catch (e) { changes = {}; }
    return {
      requestId: String(row.RequestId || ''),
      mqaCode: code,
      name: programme.name || code,
      faculty: String(row.Faculty || ''),
      requestedBy: String(row.RequestedBy || ''),
      requestedAt: row.RequestedAt ? reviewDateLabel_(row.RequestedAt) : '',
      changes: changes
    };
  });
}

function decideChangeRequestApi(requestId, decision, sessionToken) {
  var session = requireLogin_(sessionToken);
  if (!canApproveChanges_(session)) throw new Error('Only PPS approvers may decide change requests.');
  var id = String(requestId || '').trim();
  var approve = String(decision || '').toLowerCase() === 'approve';
  var sheet = changeSheet_();
  var data = sheet.getDataRange().getValues();
  var header = data[0].map(function (v) { return String(v).trim(); });
  var idCol = header.indexOf('RequestId') + 1;
  var statusCol = header.indexOf('Status') + 1;
  var decidedCol = header.indexOf('DecidedBy') + 1;
  var decidedAtCol = header.indexOf('DecidedAt') + 1;
  var changesCol = header.indexOf('Changes') + 1;
  var codeCol = header.indexOf('MQACode') + 1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() !== id) continue;
    if (String(data[i][statusCol - 1]).trim() !== 'Pending') throw new Error('This request was already decided.');

    if (approve) {
      var changes = {};
      try { changes = JSON.parse(String(data[i][changesCol - 1] || '{}')); } catch (e) { changes = {}; }
      var code = String(data[i][codeCol - 1] || '').trim();
      var progSheet = programmeSpreadsheet_().getSheetByName('Programme');
      var progData = progSheet.getDataRange().getValues();

      if (String(changes.__action || '') === 'delete') {
        // Remove the register rows; the programme tab is kept for archive.
        for (var d = progData.length - 1; d >= 1; d--) {
          if (String(progData[d][2] || '').trim() === code) progSheet.deleteRow(d + 1);
        }
      } else {
        for (var r = 1; r < progData.length; r++) {
          if (String(progData[r][2] || '').trim() !== code) continue;
          Object.keys(changes).forEach(function (field) {
            var col = PROGRAMME_META_COLUMNS_[field];
            if (col) progSheet.getRange(r + 1, col).setValue(changes[field]);
          });
        }
      }
      try { CacheService.getScriptCache().remove('ref-maps-v1'); } catch (e) {}
    }

    sheet.getRange(i + 1, statusCol).setValue(approve ? 'Approved' : 'Rejected');
    sheet.getRange(i + 1, decidedCol).setValue(session.name || '');
    sheet.getRange(i + 1, decidedAtCol).setValue(new Date());
    SpreadsheetApp.flush();
    return { ok: true, status: approve ? 'Approved' : 'Rejected' };
  }
  throw new Error('The request was not found.');
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * PDF register. Every generated file is listed on the dashboard with its
 * programme, timestamp and the account that generated it. Faculty can open and
 * the file itself is shared domain-wide as view-only, so nobody can delete it
 * from the web app.
 */
function pdfLogSheet_() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName(PDF_LOG_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(PDF_LOG_SHEET_NAME_);
    sheet.getRange(1, 1, 1, PDF_LOG_HEADERS_.length).setValues([PDF_LOG_HEADERS_]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function pdfLogRows_() {
  var sheet = programmeSpreadsheet_().getSheetByName(PDF_LOG_SHEET_NAME_);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (value) { return String(value).trim(); });
  var index = {};
  PDF_LOG_HEADERS_.forEach(function (header) { index[header] = headers.indexOf(header); });
  return data.slice(1).map(function (row) {
    var record = {};
    PDF_LOG_HEADERS_.forEach(function (header) {
      record[header] = index[header] < 0 ? '' : row[index[header]];
    });
    record.FileId = String(record.FileId || '').trim();
    return record;
  }).filter(function (record) { return record.FileId; });
}

function recordPdfInLog_(file, programme, session, source) {
  var sheet = pdfLogSheet_();
  sheet.appendRow([
    file.getId(),
    file.getName(),
    programme ? programme.mqaCode : '',
    programme ? programme.faculty : '',
    session && session.name ? session.name : '',
    session && session.email ? session.email : '',
    new Date(),
    source || 'generate'
  ]);
  return true;
}

function getPdfLogApi(sessionToken) {
  var session = requireLogin_(sessionToken);
  return listPdfLog_(session);
}

function listPdfLog_(session, mqaCode) {
  var code = String(mqaCode || '').trim();
  var rows = pdfLogRows_().filter(function (record) {
    if (!session.isAdmin && String(record.Faculty || '').trim() !== session.faculty) return false;
    if (code && String(record.MQACode || '').trim() !== code) return false;
    return true;
  });
  return rows.map(function (record) {
    var created = record.GeneratedAt instanceof Date ? record.GeneratedAt : new Date(record.GeneratedAt);
    var valid = !isNaN(created.getTime());
    return {
      fileId: record.FileId,
      fileName: String(record.FileName || ''),
      mqaCode: String(record.MQACode || ''),
      faculty: String(record.Faculty || ''),
      generatedBy: String(record.GeneratedBy || ''),
      generatedByEmail: String(record.GeneratedByEmail || ''),
      generatedAtLabel: valid ? Utilities.formatDate(created, TIME_ZONE_, 'dd/MM/yyyy HH:mm') : '',
      sortKey: valid ? created.getTime() : 0,
      url: 'https://drive.google.com/file/d/' + record.FileId + '/view'
    };
  }).sort(function (left, right) { return right.sortKey - left.sortKey; }).slice(0, 300);
}

/**
 * Backfill the register from the Drive folder. Historical files carry no user,
 * so the faculty's Deputy Dean (Academic) is recorded as the stand-in author.
 * Idempotent: files already in the register are skipped.
 */
function backfillPdfLog_() {
  var LIMIT = 60;
  var folder = getPdfFolder_();
  var known = {};
  pdfLogRows_().forEach(function (record) { known[record.FileId] = true; });

  var programmes = getProgrammes_();
  var tdaByFaculty = {};
  userDirectoryEntries_().forEach(function (entry) {
    if (String(entry.position || '').toLowerCase().indexOf('deputy dean') !== -1) {
      if (!tdaByFaculty[entry.faculty]) tdaByFaculty[entry.faculty] = entry;
    }
  });

  var pending = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (known[file.getId()]) continue;
    known[file.getId()] = true;
    pending.push(file);
  }

  var sheet = pdfLogSheet_();
  var rows = [];
  pending.slice(0, LIMIT).forEach(function (file) {
    var name = file.getName();
    var match = name.match(/^(MQA-[A-Za-z0-9]+)-(\d{2})(\d{2})(\d{2})-(\d+)$/);
    var mqaCode = match ? match[1].replace('-', '/') : '';
    var programme = null;
    for (var i = 0; i < programmes.length; i++) {
      if (programmes[i].mqaCode === mqaCode) { programme = programmes[i]; break; }
    }
    var faculty = programme ? programme.faculty : '';
    var tda = faculty ? tdaByFaculty[faculty] : null;
    var created = match
      ? new Date('20' + match[4] + '-' + match[3] + '-' + match[2] + 'T12:00:00+08:00')
      : file.getDateCreated();
    rows.push([
      file.getId(), name, mqaCode, faculty,
      tda ? tda.name : 'TDA (tidak direkod)',
      tda ? tda.email : '',
      created, 'backfill'
    ]);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, PDF_LOG_HEADERS_.length).setValues(rows);
    SpreadsheetApp.flush();
  }
  return { ok: true, added: rows.length, remaining: Math.max(0, pending.length - rows.length), totalPending: pending.length };
}

/**
 * One-off, idempotent setup: writes the Peranan / Fakulti Pemilik columns and
 * marks the first row of every duplicated MQA code as the owner. Existing values
 * are never overwritten.
 */
function setupSharedProgrammeRoleColumn() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Sheet "Programme" not found');

  var lastColumn = Math.max(sheet.getLastColumn(), 11);
  sheet.getRange(1, 10, 1, 2).setValues([['Peranan', 'Fakulti Pemilik']]);
  sheet.getRange(1, 10, 1, 2).setFontWeight('bold');

  var data = sheet.getRange(1, 1, sheet.getLastRow(), Math.max(lastColumn, 11)).getValues();
  var firstRowByCode = {};
  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][2] || '').trim();
    if (!code) continue;
    if (!firstRowByCode[code]) firstRowByCode[code] = { row: i + 1, faculty: String(data[i][7] || '').trim() };
  }

  var counts = {};
  for (var j = 1; j < data.length; j++) {
    var mqa = String(data[j][2] || '').trim();
    if (!mqa) continue;
    var faculty = String(data[j][7] || '').trim();
    var owner = firstRowByCode[mqa];
    var role = faculty === owner.faculty ? PROGRAMME_ROLE_OWNER_ : PROGRAMME_ROLE_PARTNER_;
    var existingRole = String(data[j][9] || '').trim();
    var existingOwner = String(data[j][10] || '').trim();
    if (!existingRole) sheet.getRange(j + 1, 10).setValue(role);
    if (!existingOwner) sheet.getRange(j + 1, 11).setValue(owner.faculty);
    counts[role] = (counts[role] || 0) + 1;
  }
  SpreadsheetApp.flush();
  return { ok: true, rows: counts, codes: Object.keys(firstRowByCode).length };
}

function renderReviewAdminPage_(session) {
  if (!canManageReview_(session.user)) {
    return renderAccessPage_({
      reason: 'forbidden',
      title: 'Akses terhad',
      message: 'Halaman ini hanya untuk Penyelaras Jaminan Kualiti dan TDA PPS.',
      email: session.user.email
    });
  }
  return renderPage_('PageReviewAdmin', APP_SHORT_NAME_ + ' — Sesi Semakan', {
    page: 'review',
    user: session.user,
    token: session.token,
    baseUrl: deploymentUrl_(),
    review: reviewAdminPayload_(session.user),
    directory: directoryPayload_(),
    admins: reviewRolesPayload_(),
    appJs: 'AdminJs'
  });
}

function renderPage_(pageFile, title, bootstrap) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.pageFile = pageFile;
  template.appJsFile = bootstrap && bootstrap.appJs ? bootstrap.appJs : 'AppJs';
  template.bootstrap = jsonForScript_(bootstrap);
  return template.evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function renderAccessPage_(state) {
  var template = HtmlService.createTemplateFromFile('AccessDenied');
  template.title = state.title ||
    (state.reason === 'not_registered' ? 'Akaun belum berdaftar' : 'Akses diperlukan');
  template.message = state.message || 'Sesi Google tidak dapat disahkan.';
  template.email = state.email || '';
  template.retryUrl = deploymentUrl_() + '?page=programmes';
  template.signInUrl = state.signInUrl || '';
  return template.evaluate()
    .setTitle(APP_SHORT_NAME_ + ' — Akses')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function deploymentUrl_() {
  return ScriptApp.getService().getUrl();
}

function jsonForScript_(value) {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function programmeSpreadsheet_() {
  return SpreadsheetApp.openById(PROGRAMME_SPREADSHEET_ID_);
}

/**
 * Google sign-in.
 *
 * The web app is deployed for the UniSZA domain only, so the signed-in Google
 * account is the identity. No password, no directory dropdown, no OAuth client
 * secret is stored anywhere.
 */
function signedInEmail_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) { email = ''; }
  return String(email || '').trim().toLowerCase();
}

function findDirectoryEntryByEmail_(email) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  var admins = adminDirectoryEntries_().filter(function (entry) { return entry.email === target; });
  if (admins.length) {
    return { email: target, name: admins[0].name, position: admins[0].position, faculty: 'ADMIN', isAdmin: true };
  }
  var users = userDirectoryEntries_().filter(function (entry) { return entry.email === target; });
  if (users.length) {
    return { email: target, name: users[0].name, position: users[0].position, faculty: users[0].faculty, isAdmin: false };
  }
  return null;
}

function issueSession_(session) {
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(USER_SESSION_PREFIX_ + token, JSON.stringify(session), USER_SESSION_TTL_SECONDS_);
  return token;
}

function resolveGoogleSession_() {
  var email = signedInEmail_();
  if (!email) {
    return {
      ok: false,
      reason: 'no_google_session',
      message: 'Pelayar ini tidak memberikan identiti Google. Buka pautan sistem dalam pelayar yang sudah log masuk dengan akaun @unisza.edu.my.'
    };
  }
  if (!/@unisza\.edu\.my$/.test(email)) {
    return { ok: false, reason: 'wrong_domain', email: email, message: 'Akaun ' + email + ' bukan akaun @unisza.edu.my.' };
  }
  var user = findDirectoryEntryByEmail_(email);
  if (!user) {
    return {
      ok: false,
      reason: 'not_registered',
      email: email,
      message: 'Akaun ' + email + ' belum didaftarkan dalam direktori. Hubungi PPS untuk didaftarkan dalam sheet USER atau ADMIN.'
    };
  }
  var session = { faculty: user.faculty, name: user.name, position: user.position, isAdmin: user.isAdmin, email: user.email };
  return { ok: true, token: issueSession_(session), user: session };
}

function getGoogleSessionApi() {
  return resolveGoogleSession_();
}

function requireLogin_(token) {
  var key = String(token || '').trim();
  var raw = key && CacheService.getScriptCache().get(USER_SESSION_PREFIX_ + key);
  if (!raw) throw new Error('Your session has expired. Please sign in again.');
  return JSON.parse(raw);
}

function userDirectoryEntries_() {
  var sheet = programmeSpreadsheet_().getSheetByName(USER_DIRECTORY_SHEET_NAME_);
  if (!sheet) throw new Error('Sheet USER tidak ditemui dalam direktori pengguna.');
  var data = sheet.getDataRange().getValues();
  var header = data[0] || [];
  var facultyColumn = header.indexOf('Faculty');
  var nameColumn = header.indexOf('Graduate Coordinator');
  var emailColumn = header.indexOf('Graduate Coordinator Email');
  var positionColumn = header.indexOf('Position');
  if (facultyColumn < 0 || nameColumn < 0 || emailColumn < 0) {
    throw new Error('Kolum Faculty, Graduate Coordinator atau Graduate Coordinator Email tidak ditemui dalam sheet USER.');
  }

  return data.slice(1).reduce(function(entries, row) {
    var faculty = String(row[facultyColumn] || '').trim();
    var name = String(row[nameColumn] || '').trim();
    var email = String(row[emailColumn] || '').trim().toLowerCase();
    if (!faculty || !name || !email) return entries;
    entries.push({
      faculty: faculty,
      name: name,
      email: email,
      username: email.split('@')[0],
      position: positionColumn < 0 ? '' : String(row[positionColumn] || '').trim()
    });
    return entries;
  }, []);
}

function adminDirectoryEntries_() {
  var sheet = programmeSpreadsheet_().getSheetByName(ADMIN_DIRECTORY_SHEET_NAME_);
  if (!sheet) throw new Error('Sheet ADMIN tidak ditemui dalam direktori pengguna.');
  var data = sheet.getDataRange().getValues();
  var header = data[0] || [];
  var nameColumn = header.indexOf('Name');
  var emailColumn = header.indexOf('Email');
  var positionColumn = header.indexOf('Position');
  if (nameColumn < 0 || emailColumn < 0) throw new Error('Kolum Name atau Email tidak ditemui dalam sheet ADMIN.');

  return data.slice(1).reduce(function(entries, row) {
    var name = String(row[nameColumn] || '').trim();
    var email = String(row[emailColumn] || '').trim().toLowerCase();
    if (!name || !email) return entries;
    entries.push({
      faculty: 'ADMIN',
      name: name,
      email: email,
      username: email.split('@')[0],
      position: positionColumn < 0 ? '' : String(row[positionColumn] || '').trim()
    });
    return entries;
  }, []);
}

/**
 * Programme directory from the "Programme" sheet.
 * Columns: A=Malay name, B=English name, C=MQA ref code, D=NEC 2020,
 *          E=programme code, F=accreditation, G=faculty full, H=faculty abbrev,
 *          I=sharing flag.
 */
function getProgrammesApi(sessionToken) {
  requireLogin_(sessionToken);
  // University-wide visibility; editing is scoped separately by canEditProgramme_.
  return getProgrammes_().map(function (programme) {
    return programme;
  });
}

function requireProgrammeFacultyAccess_(mqaCode, session, facultyHint) {
  var programme = resolveProgrammeForRead_(mqaCode, facultyHint);
  if (!programme) throw new Error('The programme was not found.');
  if (!canEditProgramme_(programme, session)) {
    throw new Error('You may only edit programmes under your own faculty or institute.');
  }
  return programme;
}

function getProgrammes_() {
  var ss = programmeSpreadsheet_();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Sheet "Programme" not found');

  var data = sheet.getDataRange().getValues();
  var programmes = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mqaCode = String(row[2] || '').trim();
    if (!mqaCode) continue;
    var nameMy = String(row[0] || '').trim();
    var name = String(row[1] || row[0] || '').trim();
    programmes.push({
      nameMy: nameMy,
      name: name,
      mqaCode: mqaCode,
      nee: String(row[3] || '').trim(),
      progCode: String(row[4] || '').trim(),
      accreditation: formatAccreditation_(row[5]),
      facultyFull: String(row[6] || '').trim(),
      faculty: String(row[7] || '').trim(),
      sharing: String(row[8] || '').trim(),
      mode: String(row[11] || '').trim() || 'Research',
      roleRaw: String(row[9] || '').trim(),
      ownerFacultyRaw: String(row[10] || '').trim(),
      level: detectLevel_(nameMy || name)
    });
  }
  annotateSharedProgrammes_(programmes);
  return programmes;
}

/**
 * A single MQA code can be offered by several faculties. The first row for a
 * code owns the shared tab; every other row is a partner with its own tab.
 * Columns J ("Peranan") and K ("Fakulti Pemilik") let PPS override that
 * inference without touching code.
 */
function annotateSharedProgrammes_(programmes) {
  var byCode = {};
  programmes.forEach(function (programme) {
    if (!byCode[programme.mqaCode]) byCode[programme.mqaCode] = [];
    byCode[programme.mqaCode].push(programme);
  });

  Object.keys(byCode).forEach(function (code) {
    var rows = byCode[code];
    var explicitOwner = rows.filter(function (row) {
      return String(row.roleRaw || '').toLowerCase() === PROGRAMME_ROLE_OWNER_.toLowerCase();
    })[0];
    var owner = explicitOwner || rows[0];
    rows.forEach(function (row) {
      var role = String(row.roleRaw || '').toLowerCase();
      row.isSharedCode = rows.length > 1;
      if (role === PROGRAMME_ROLE_PARTNER_.toLowerCase()) {
        row.role = PROGRAMME_ROLE_PARTNER_;
      } else if (role === PROGRAMME_ROLE_OWNER_.toLowerCase()) {
        row.role = PROGRAMME_ROLE_OWNER_;
      } else {
        row.role = row === owner ? PROGRAMME_ROLE_OWNER_ : PROGRAMME_ROLE_PARTNER_;
      }
      row.ownerFaculty = row.role === PROGRAMME_ROLE_OWNER_
        ? row.faculty
        : (String(row.ownerFacultyRaw || '').trim() || owner.faculty);
      row.tabName = programmeTabName_(row);
    });
  });
  return programmes;
}

function programmeTabName_(programme) {
  var base = sanitizeSheetName_(programme.mqaCode);
  if (programme.role === PROGRAMME_ROLE_PARTNER_) {
    return sanitizeSheetName_(base + PROGRAMME_PARTNER_TAB_SEPARATOR_ + programme.faculty);
  }
  return base;
}

/**
 * Resolve one programme row for a session. A faculty hint is only meaningful for
 * admins, who can see the same MQA code under several faculties.
 */
/**
 * Editing rights: the owning faculty may edit its own programmes; PPS staff may
 * only edit when they hold a PPS role (TDA, PJK or PPA). Everyone else reads.
 */
function ppsEditorRoles_(session) {
  if (!session || !session.email) return [];
  return reviewRolesFor_(session.email).filter(function (role) {
    return ['PJK', 'TDA_PPS', 'PPA', 'PP'].indexOf(role) !== -1;
  });
}

function canEditProgramme_(programme, session) {
  if (!programme || !session) return false;
  if (ppsEditorRoles_(session).length) return true;
  return String(programme.faculty || '') === String(session.faculty || '');
}

/** Resolve any programme for reading; the session only scopes editing. */
function resolveProgrammeForRead_(mqaCode, facultyHint) {
  var code = String(mqaCode || '').trim();
  if (!code) return null;
  var rows = getProgrammes_().filter(function (p) { return p.mqaCode === code; });
  if (!rows.length) return null;
  var hint = String(facultyHint || '').trim();
  if (hint) {
    for (var i = 0; i < rows.length; i++) if (rows[i].faculty === hint) return rows[i];
  }
  for (var j = 0; j < rows.length; j++) if (rows[j].role === PROGRAMME_ROLE_OWNER_) return rows[j];
  return rows[0];
}

function programmeForSession_(mqaCode, session, facultyHint) {
  var code = String(mqaCode || '').trim();
  if (!code) return null;
  var rows = getProgrammes_().filter(function (programme) { return programme.mqaCode === code; });
  if (!rows.length) return null;

  if (session && session.isAdmin) {
    var hint = String(facultyHint || '').trim();
    if (hint) {
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].faculty === hint) return rows[i];
      }
    }
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].role === PROGRAMME_ROLE_OWNER_) return rows[j];
    }
    return rows[0];
  }

  for (var k = 0; k < rows.length; k++) {
    if (rows[k].faculty === (session && session.faculty)) return rows[k];
  }
  return null;
}

/**
 * PEO/PLO records for a single programme tab (e.g. "MQA/FA5581").
 * Layout: marker row "PEO" then code|statement|mqf rows, marker row "PLO"
 * then code|statement|mqf|parentPEO|taxonomy|sdg|sc|tf rows.
 */
function getProgrammeDetailApi(mqaCode, sessionToken, faculty) {
  var programme = requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken), faculty);
  return getProgrammeDetailFor_(programme);
}

/**
 * Read one programme tab. Partners keep their own tab, so the caller passes the
 * resolved tab name instead of assuming the MQA code.
 */
function readProgrammeSheet_(tabName, baseCode) {
  var name = String(tabName || '').trim();
  var code = String(baseCode || name || '').trim();
  var sheet = name ? programmeSpreadsheet_().getSheetByName(name) : null;
  if (!sheet) return { exists: false, peos: [], plos: [] };

  var data = sheet.getDataRange().getValues();
  var peos = [];
  var plos = [];
  var section = '';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var marker = String(row[0] || '').trim().toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }

    var itemCode = String(row[0] || '').trim();
    if (!itemCode) continue;

    if (section === 'peo') {
      peos.push({
        code: itemCode,
        statement: String(row[1] || '').trim(),
        mqfDomain: String(row[2] || '').trim()
      });
    } else if (section === 'plo') {
      plos.push({
        code: itemCode,
        statement: String(row[1] || '').trim(),
        mqfDomain: String(row[2] || '').trim(),
        parentPEO: String(row[3] || '').trim(),
        taxonomy: String(row[4] || '').trim(),
        sdg: String(row[5] || '').trim(),
        sc: String(row[6] || '').trim(),
        tf: String(row[7] || '').trim()
      });
    }
  }
  applyPEOMQFRollup_(peos, plos);
  return { exists: true, peos: peos, plos: plos };
}

/**
 * A partner faculty starts from the owner's content on its first access. The copy
 * is serialised with LockService so two simultaneous page loads cannot create
 * duplicate tabs, and it is idempotent: an existing tab is never touched.
 */
function ensurePartnerCopy_(programme) {
  if (!programme || programme.role !== PROGRAMME_ROLE_PARTNER_) return;
  var ss = programmeSpreadsheet_();
  if (ss.getSheetByName(programme.tabName)) return;

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(15000);
  } catch (e) {
    locked = false;
  }
  if (!locked) return;

  try {
    if (ss.getSheetByName(programme.tabName)) return;
    var ownerSheet = ss.getSheetByName(sanitizeSheetName_(programme.mqaCode));
    if (ownerSheet) {
      ownerSheet.copyTo(ss).setName(programme.tabName);
    } else {
      seedProgrammeTab_(ss.insertSheet(programme.tabName));
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/** Last-resort guard: the partner tab always exists after ensurePartnerCopy_. */

function requireOwnProgrammeTab_(programme) {
  ensurePartnerCopy_(programme);
  var sheet = programmeSpreadsheet_().getSheetByName(programme.tabName);
  if (!sheet) throw new Error('The programme content could not be prepared. Please reload the page.');
  return sheet;
}

/** Owner-tab reader kept for callers that only have an MQA code. */
function getProgrammeDetail_(mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!code) throw new Error('MQA code is required');
  var content = readProgrammeSheet_(sanitizeSheetName_(code), code);
  return { mqaCode: code, peos: content.peos, plos: content.plos };
}

/**
 * Detail payload for the page. Partners start without their own tab; once they
 * copy the owner's content they can diverge, and the page reports whether the
 * content still matches the owner.
 */
function getProgrammeDetailFor_(programme) {
  ensurePartnerCopy_(programme);
  var own = readProgrammeSheet_(programme.tabName, programme.mqaCode);
  var result = {
    mqaCode: programme.mqaCode,
    peos: own.peos,
    plos: own.plos,
    isSharedCode: !!programme.isSharedCode,
    role: programme.role,
    ownerFaculty: programme.ownerFaculty || programme.faculty,
    hasOwnCopy: own.exists,
    differsFromOwner: false
  };

  if (programme.role === PROGRAMME_ROLE_PARTNER_ && own.exists) {
    var ownerContent = readProgrammeSheet_(sanitizeSheetName_(programme.mqaCode), programme.mqaCode);
    result.differsFromOwner = !sameProgrammeContent_(own, ownerContent);
  }
  return result;
}

function sameProgrammeContent_(left, right) {
  return programmeContentSignature_(left) === programmeContentSignature_(right);
}

function programmeContentSignature_(content) {
  var normalise = function (list, fields) {
    return (list || []).map(function (item) {
      return fields.map(function (field) {
        return String(item[field] == null ? '' : item[field]).replace(/\s+/g, ' ').trim().toUpperCase();
      }).join('|');
    });
  };
  return JSON.stringify({
    peos: normalise(content.peos, ['code', 'statement', 'mqfDomain']),
    plos: normalise(content.plos, ['code', 'statement', 'parentPEO', 'mqfDomain', 'taxonomy', 'sdg', 'sc', 'tf'])
  });
}

function saveProgrammeRecordApi(mqaCode, recordType, payload, sessionToken, faculty) {
  var programme = requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken), faculty);
  var code = programme.mqaCode;
  var type = String(recordType || '').trim().toLowerCase();
  var item = payload || {};
  var itemCode = String(item.code || '').trim();
  var statement = String(item.statement || '').trim();
  if (!code || !itemCode) throw new Error('Programme and record codes are required');
  if (type !== 'peo' && type !== 'plo') throw new Error('Invalid record type');
  if (!statement) throw new Error('Statement is required');

  var sheet = requireOwnProgrammeTab_(programme);

  var data = sheet.getDataRange().getValues();
  var match = findProgrammeRecordRow_(data, type, itemCode);
  if (!match) throw new Error('Record not found: ' + itemCode);

  if (type === 'peo') {
    sheet.getRange(match.row, 2).setValue(statement);
    SpreadsheetApp.flush();
    return getProgrammeDetailFor_(programme);
  }

  var parentPEO = String(item.parentPEO || '').trim();
  var mqfDomain = normalizeMQFDomain_(item.mqfDomain);
  var taxonomy = String(item.taxonomy || '').trim().toUpperCase();
  var sdg = normalizeReferenceCode_(item.sdg);
  var sc = normalizeReferenceCode_(item.sc);
  var tf = normalizeReferenceCode_(item.tf);
  var peoCodes = programmePEOCodes_(data);
  if (peoCodes.indexOf(parentPEO) === -1) throw new Error('Select a valid parent PEO');
  if (MQF_DOMAIN_CODES_.indexOf(mqfDomain) === -1) throw new Error('Select a valid MQF domain');
  if (TAXONOMY_CODES_.indexOf(taxonomy) === -1) throw new Error('Select a valid taxonomy level');
  if (isSDGEligiblePLO_(itemCode, code) && SDG_CODES_.indexOf(sdg) === -1) {
    throw new Error('Select a valid SDG');
  }
  if (!isSDGEligiblePLO_(itemCode, code) && sdg) {
    throw new Error('SDG mapping is only available for ' + sdgEligiblePLOCodes_(code).join(', '));
  }
  if (sc && SC_CODES_.indexOf(sc) === -1) {
    throw new Error('Select a valid sustainability competency');
  }
  if (['TF1', 'TF2', 'TF3', 'TF4'].indexOf(tf) === -1) {
    throw new Error('Select a valid Teras FlexS value');
  }

  // Keep the stable code in column A and update only the editable PLO fields.
  ensurePLOHeaderColumns_(sheet, data);
  sheet.getRange(match.row, 2, 1, 7).setValues([[statement, mqfDomain, parentPEO, taxonomy, sdg, sc, tf]]);
  SpreadsheetApp.flush();
  return getProgrammeDetailFor_(programme);
}

function findProgrammeRecordRow_(data, recordType, itemCode) {
  var section = '';
  var expectedCode = String(itemCode || '').trim().toUpperCase();
  for (var i = 0; i < data.length; i++) {
    var current = String(data[i][0] || '').trim();
    var marker = current.toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    if (section === recordType && marker === expectedCode) return { row: i + 1 };
  }
  return null;
}

function programmePEOCodes_(data) {
  var result = [];
  var section = '';
  for (var i = 0; i < data.length; i++) {
    var code = String(data[i][0] || '').trim();
    var marker = code.toUpperCase();
    if (marker === 'PEO') { section = 'peo'; continue; }
    if (marker === 'PLO') { section = 'plo'; continue; }
    if (section === 'peo' && code) result.push(code);
  }
  return result;
}

function normalizeMQFDomain_(value) {
  var compact = String(value || '').trim().replace(/\s+/g, '').toUpperCase();
  for (var i = 0; i < MQF_DOMAIN_CODES_.length; i++) {
    if (MQF_DOMAIN_CODES_[i].replace(/\s+/g, '').toUpperCase() === compact) return MQF_DOMAIN_CODES_[i];
  }
  return String(value || '').trim();
}

function normalizeReferenceCode_(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function isSDGEligiblePLO_(ploCode, programmeCode) {
  return sdgEligiblePLOCodes_(programmeCode).indexOf(normalizePLOCode_(ploCode)) > -1;
}

function sdgEligiblePLOCodes_(programmeCode) {
  var code = normalizeReferenceCode_(programmeCode);
  return SDG_ELIGIBLE_PLO_CODES_BY_PROGRAMME_[code] || SDG_ELIGIBLE_PLO_CODES_;
}

function normalizePLOCode_(ploCode) {
  return normalizeReferenceCode_(ploCode).replace(/^PLO0+(\d+)$/, 'PLO$1');
}

function isSCEligiblePLO_(ploCode, programmeCode) {
  return scEligiblePLOCodes_(programmeCode).indexOf(normalizePLOCode_(ploCode)) > -1;
}

function scEligiblePLOCodes_(programmeCode) {
  var code = normalizeReferenceCode_(programmeCode);
  return SC_ELIGIBLE_PLO_CODES_BY_PROGRAMME_[code] || SC_ELIGIBLE_PLO_CODES_;
}

function defaultSCForPLO_(ploCode, mqfDomain, programmeCode) {
  if (normalizePLOCode_(ploCode) === 'PLO10' && scEligiblePLOCodes_(programmeCode).indexOf('PLO10') > -1) return 'SC8';
  return isSCEligiblePLO_(ploCode, programmeCode) ? (SC_CODES_BY_MQF_DOMAIN_[normalizeReferenceCode_(mqfDomain)] || '') : '';
}

function relocateSpecialPhdSc_(plos, programmeCode) {
  if (scEligiblePLOCodes_(programmeCode).indexOf('PLO10') === -1) return;
  var plo10 = null;
  var plo11 = null;
  (plos || []).forEach(function(plo) {
    if (normalizePLOCode_(plo.code) === 'PLO10') plo10 = plo;
    if (normalizePLOCode_(plo.code) === 'PLO11') plo11 = plo;
  });
  if (!plo10 || !plo11) return;
  if (!plo10.sc && plo11.sc) plo10.sc = plo11.sc;
  plo11.sc = '';
}

function transversalFutureSkillsForMQFDomain_(mqfDomain) {
  var compact = normalizeReferenceCode_(normalizeMQFDomain_(mqfDomain));
  return TF_CODES_BY_MQF_DOMAIN_[compact] || [];
}

function ensurePLOHeaderColumns_(sheet, data) {
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() === 'PLO') {
      sheet.getRange(i + 1, 1, 1, PROGRAMME_TAB_SECTIONS.PLO.columns.length)
        .setValues([PROGRAMME_TAB_SECTIONS.PLO.columns]);
      return;
    }
  }
}

/**
 * Applies the approved SC and TF mappings to every PLO in every programme
 * tab listed on the Programme sheet. SDG values are not changed.
 */
function autoMapPLOSCAndTF() {
  var ss = programmeSpreadsheet_();
  var programmes = getProgrammes_();
  var summary = { programmesProcessed: 0, programmesSkipped: 0, plosProcessed: 0, cellsUpdated: 0 };

  programmes.forEach(function(programme) {
    var sheet = ss.getSheetByName(programme.mqaCode);
    if (!sheet) {
      summary.programmesSkipped++;
      return;
    }

    var data = sheet.getDataRange().getValues();
    var section = '';
    var groupStartRow = -1;
    var groupValues = [];
    var flush = function() {
      if (!groupValues.length) return;
      sheet.getRange(groupStartRow, 7, groupValues.length, 2).setValues(groupValues);
      groupStartRow = -1;
      groupValues = [];
    };

    ensurePLOHeaderColumns_(sheet, data);
    for (var i = 0; i < data.length; i++) {
      var marker = String(data[i][0] || '').trim().toUpperCase();
      if (marker === 'PEO') { section = 'peo'; continue; }
      if (marker === 'PLO') { section = 'plo'; continue; }
      if (section !== 'plo' || !marker) {
        flush();
        continue;
      }

      var mqfDomain = normalizeMQFDomain_(data[i][2]);
      var sc = defaultSCForPLO_(marker, mqfDomain, programme.mqaCode);
      var tfOptions = transversalFutureSkillsForMQFDomain_(mqfDomain);
      var tf = tfOptions.length === 1 ? tfOptions[0] : '';
      var row = i + 1;

      if (groupStartRow === -1) groupStartRow = row;
      if (row !== groupStartRow + groupValues.length) flush();
      if (groupStartRow === -1) groupStartRow = row;
      groupValues.push([sc, tf]);
      summary.plosProcessed++;
      if (normalizeReferenceCode_(data[i][6]) !== sc) summary.cellsUpdated++;
      if (normalizeReferenceCode_(data[i][7]) !== tf) summary.cellsUpdated++;
    }
    flush();
    summary.programmesProcessed++;
  });

  Logger.log(JSON.stringify(summary));
  return summary;
}

/**
 * Moves SDG8 from PLO8 to PLO9 for the four approved programmes and applies
 * their approved third SDG. Doctorate programmes use PLO10/SDG12/SC8; Masters
 * programmes retain PLO11/SDG17. It changes only SDG and SC cells. Existing,
 * different values are reported as conflicts rather than overwritten.
 */
function migrateApprovedSdgPlo8ToPlo9() {
  var programmes = [
    { code: 'MQA/FA5571', thirdPlo: 'PLO11', thirdSdg: 'SDG17' },
    { code: 'MQA/FA5572', thirdPlo: 'PLO11', thirdSdg: 'SDG17' },
    { code: 'MQA/FA5573', thirdPlo: 'PLO10', thirdSdg: 'SDG12', thirdSc: 'SC8' },
    { code: 'MQA/FA5574', thirdPlo: 'PLO10', thirdSdg: 'SDG12', thirdSc: 'SC8' }
  ];
  var ss = programmeSpreadsheet_();
  var summary = { migrated: [], skipped: [], conflicts: [], errors: [] };

  programmes.forEach(function(programme) {
    var programmeCode = programme.code;
    try {
      var sheet = ss.getSheetByName(programmeCode);
      if (!sheet) {
        summary.errors.push(programmeCode + ': programme sheet not found');
        return;
      }

      var rows = sheet.getDataRange().getValues();
      var plo8Row = 0;
      var plo9Row = 0;
      var thirdPloRow = 0;
      var plo11Row = 0;
      var inPloSection = false;
      for (var i = 0; i < rows.length; i++) {
        var code = normalizePLOCode_(rows[i][0]);
        if (code === 'PLO') {
          inPloSection = true;
          continue;
        }
        if (!inPloSection) continue;
        if (code === 'PLO8') plo8Row = i + 1;
        if (code === 'PLO9') plo9Row = i + 1;
        if (code === programme.thirdPlo) thirdPloRow = i + 1;
        if (code === 'PLO11') plo11Row = i + 1;
      }
      if (!plo8Row || !plo9Row || !thirdPloRow) {
        summary.errors.push(programmeCode + ': required SDG PLO not found');
        return;
      }

      var sourceSdg = normalizeReferenceCode_(rows[plo8Row - 1][5]);
      var targetSdg = normalizeReferenceCode_(rows[plo9Row - 1][5]);
      var thirdSdg = normalizeReferenceCode_(rows[thirdPloRow - 1][5]);
      var thirdSc = normalizeReferenceCode_(rows[thirdPloRow - 1][6]);
      if (!sourceSdg) {
        summary.skipped.push(programmeCode + ': PLO8 has no SDG');
        return;
      }
      if (targetSdg && targetSdg !== sourceSdg) {
        summary.conflicts.push(programmeCode + ': PLO9 already has ' + targetSdg);
        return;
      }
      if (thirdSdg && thirdSdg !== programme.thirdSdg) {
        summary.conflicts.push(programmeCode + ': ' + programme.thirdPlo + ' already has ' + thirdSdg);
        return;
      }
      if (programme.thirdSc && thirdSc && thirdSc !== programme.thirdSc) {
        summary.conflicts.push(programmeCode + ': ' + programme.thirdPlo + ' already has ' + thirdSc);
        return;
      }

      sheet.getRange(plo9Row, 6).setValue(sourceSdg);
      sheet.getRange(plo8Row, 6).clearContent();
      sheet.getRange(thirdPloRow, 6).setValue(programme.thirdSdg);
      if (programme.thirdPlo !== 'PLO11' && plo11Row) sheet.getRange(plo11Row, 6).clearContent();
      if (programme.thirdSc) {
        sheet.getRange(thirdPloRow, 7).setValue(programme.thirdSc);
        if (plo11Row) sheet.getRange(plo11Row, 7).clearContent();
      }
      summary.migrated.push(programmeCode + ': ' + sourceSdg + ', ' + programme.thirdPlo + '=' + programme.thirdSdg + (programme.thirdSc ? '/' + programme.thirdSc : ''));
    } catch (error) {
      summary.errors.push(programmeCode + ': ' + error.message);
    }
  });

  SpreadsheetApp.flush();
  Logger.log(JSON.stringify(summary));
  return summary;
}

function applyPEOMQFRollup_(peos, plos) {
  var domainsByPEO = {};
  (plos || []).forEach(function(plo) {
    var parentPEO = String(plo.parentPEO || '').trim();
    var mqfDomain = normalizeMQFDomain_(plo.mqfDomain);
    if (!parentPEO || MQF_DOMAIN_CODES_.indexOf(mqfDomain) === -1) return;
    if (!domainsByPEO[parentPEO]) domainsByPEO[parentPEO] = [];
    if (domainsByPEO[parentPEO].indexOf(mqfDomain) === -1) domainsByPEO[parentPEO].push(mqfDomain);
  });
  (peos || []).forEach(function(peo) {
    var domains = domainsByPEO[peo.code] || [];
    domains.sort(function(a, b) { return MQF_DOMAIN_CODES_.indexOf(a) - MQF_DOMAIN_CODES_.indexOf(b); });
    peo.mqfDomains = domains;
    peo.mqfDomain = domains.join(', ');
  });
}

/** Accreditations arrive either as text ("5 Jun 2013") or as an Excel serial. */
function formatAccreditation_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && isFinite(value)) {
    var millis = Math.round(value) * 86400000;
    var date = new Date(Date.UTC(1899, 11, 30) + millis);
    if (isNaN(date.getTime())) return '';
    return reviewLongDateLabel_(date);
  }
  return String(value).trim();
}

function detectLevel_(name) {
  var n = String(name || '').toLowerCase();
  if (n.indexOf('doktor') > -1 || n.indexOf('doctor') > -1 || n.indexOf('ph.d') > -1 ||
      n.indexOf('phd') > -1 || n.indexOf('doctoral') > -1 || n.indexOf('doctorate') > -1) return 'Doctorate';
  if (n.indexOf('master') > -1 || n.indexOf('sarjana') > -1) return 'Masters';
  return 'Other';
}

/**
 * Adds a new PEO or PLO row to a programme tab. PLO rows are capped at 11.
 * Returns the refreshed programme detail.
 */
function addProgrammeRecordApi(mqaCode, recordType, sessionToken, faculty) {
  var programme = requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken), faculty);
  var code = programme.mqaCode;
  var type = String(recordType || '').trim().toLowerCase();
  if (!code) throw new Error('MQA code is required');
  if (type !== 'peo' && type !== 'plo') throw new Error('Invalid record type');

  var sheet = requireOwnProgrammeTab_(programme);

  var data = sheet.getDataRange().getValues();
  var peoHeader = -1;
  var ploHeader = -1;
  var peoRows = 0;
  var ploRows = 0;
  var lastPeoRow = -1;
  var lastPloRow = -1;
  for (var i = 0; i < data.length; i++) {
    var marker = String(data[i][0] || '').trim().toUpperCase();
    if (marker === 'PEO') { peoHeader = i; continue; }
    if (marker === 'PLO') { ploHeader = i; continue; }
    if (peoHeader > -1 && ploHeader === -1 && String(data[i][0] || '').trim()) { peoRows++; lastPeoRow = i; }
    if (ploHeader > -1 && String(data[i][0] || '').trim()) { ploRows++; lastPloRow = i; }
  }
  if (peoHeader === -1) throw new Error('PEO section not found in ' + code);
  if (ploHeader === -1) throw new Error('PLO section not found in ' + code);

  if (type === 'peo') {
    var peoCode = 'PEO' + (peoRows + 1);
    var peoRow = lastPeoRow === -1 ? peoHeader + 1 : lastPeoRow + 1;
    if (peoRow >= ploHeader) {
      sheet.insertRows(peoRow + 1, 1);
    }
    sheet.getRange(peoRow + 1, 1, 1, 3).setValues([[peoCode, '', '']]);
    SpreadsheetApp.flush();
    return getProgrammeDetailFor_(programme);
  }

  if (ploRows >= MAX_PLO_COUNT_) throw new Error('Only ' + MAX_PLO_COUNT_ + ' PLOs are allowed.');
  var ploCode = 'PLO' + (ploRows + 1);
  var ploRow = lastPloRow === -1 ? ploHeader + 1 : lastPloRow + 1;
  ensurePLOHeaderColumns_(sheet, data);
  sheet.getRange(ploRow + 1, 1, 1, 8).setValues([[ploCode, '', '', '', '', '', '', '']]);
  SpreadsheetApp.flush();
  return getProgrammeDetailFor_(programme);
}

/**
 * Generates a PDF of the programme's PEO/PLO records and saves it to the
 * shared Graduate School Drive folder with the naming convention
 * MQA-FAxxxx-ddmmyy-zz (zz = daily serial). Returns the stored file details.
 */
function generatePdfApi(mqaCode, sessionToken, faculty) {
  var session = requireLogin_(sessionToken);
  var programme = requireProgrammeFacultyAccess_(mqaCode, session, faculty);
  var code = programme.mqaCode;
  var detail = getProgrammeDetailFor_(programme);
  var folder = getPdfFolder_();
  var filename = buildPdfFilename_(code, folder);

  var blob = buildPdfBlob_(programme, detail, code);
  var file = folder.createFile(blob);
  file.setName(filename);
  recordPdfInLog_(file, programme, session, 'generate');

  return {
    filename: filename,
    fileId: file.getId(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    mqaCode: code,
    programmeName: programme ? programme.name : code
  };
}

function getPdfFolder_() {
  var folder = DriveApp.getFolderById(PDF_FOLDER_ID_);
  if (!folder) throw new Error('PDF destination folder not found. Please check access for ' + PDF_FOLDER_ID_);
  return folder;
}

function buildPdfFilename_(mqaCode, folder) {
  var safeCode = String(mqaCode || '').trim().replace('/', '-');
  var now = new Date();
  var day = ('0' + now.getDate()).slice(-2);
  var month = ('0' + (now.getMonth() + 1)).slice(-2);
  var year = String(now.getFullYear()).slice(-2);
  var dateCode = day + month + year;

  var base = safeCode + '-' + dateCode + '-';
  var maxSerial = 0;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var name = files.next().getName();
    if (name.indexOf(base) === 0) {
      var match = name.slice(base.length).match(/^(\d+)/);
      if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10));
    }
  }
  var serial = ('0' + (maxSerial + 1)).slice(-2);
  return base + serial;
}

function buildPdfBlob_(programme, detail, code) {
  var name = programme && programme.name ? programme.name : code;
  var level = programme ? programme.level || '' : '';
  var faculty = programme ? (programme.facultyFull || programme.faculty || '') : '';
  var progCode = programme ? programme.progCode || '' : '';

  var tempName = 'PDFTMP_' + Utilities.getUuid().replace(/-/g, '');
  var tempSs = SpreadsheetApp.create(tempName);
  var sheet = tempSs.getSheets()[0];
  try {

    var generatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var peos = detail.peos || [];
    var plos = detail.plos || [];
    var peoCount = peos.length;
    var ploCount = plos.length;

    var values = [];
    var titleRow = 1;
    var metaRow1 = 2;
    var metaRow2 = 3;
    var metaRow3 = 4;
    var peoHeadingRow = 6;
    var peoHeaderRow = 7;
    var peoDataStart = 8;
    var ploHeadingRow = peoDataStart + peoCount + 1;
    var ploHeaderRow = ploHeadingRow + 1;
    var ploDataStart = ploHeaderRow + 1;
    var footerRow = ploDataStart + ploCount + 1;

    var totalRows = footerRow + 1;
    var lastCol = 8;

    values[titleRow] = ['MQF 2.0 (2024) — Programme Information'];
    values[metaRow1] = [name + '  ·  ' + code + (progCode ? '  ·  ' + progCode : '')];
    values[metaRow2] = [level + (faculty ? '  ·  ' + faculty : '')];
    values[metaRow3] = ['Generated: ' + generatedAt];
    values[peoHeadingRow] = ['PEO — Programme Educational Objectives'];
    values[peoHeaderRow] = ['Code', 'PEO statement', 'MQF domain'];
    for (var p = 0; p < peoCount; p++) {
      values[peoDataStart + p] = [peos[p].code, peos[p].statement || '', peos[p].mqfDomain || ''];
    }
    values[ploHeadingRow] = ['PLO — Programme Learning Outcomes'];
    values[ploHeaderRow] = ['Code', 'PLO statement', 'Parent PEO', 'MQF domain', 'Taxonomy', 'SDG', 'SC', 'TF'];
    for (var q = 0; q < ploCount; q++) {
      var sdg = isSDGEligiblePLO_(plos[q].code, code) ? plos[q].sdg || '' : '';
      var sc = isSCEligiblePLO_(plos[q].code, code) ? plos[q].sc || '' : '';
      values[ploDataStart + q] = [plos[q].code, plos[q].statement || '', plos[q].parentPEO || '', plos[q].mqfDomain || '', plos[q].taxonomy || '', sdg, sc, plos[q].tf || ''];
    }
    values[footerRow] = ['Dokumen ini dijana secara automatik oleh Sistem Maklumat Program MQF 2.0 · Pusat Pengajian Siswazah, Universiti Sultan Zainal Abidin'];

    for (var r = 1; r <= totalRows; r++) {
      if (values[r]) sheet.getRange(r, 1, 1, lastCol).setValues([padRow_(values[r], lastCol)]);
    }

    // Column widths
    sheet.setColumnWidth(1, 70).setColumnWidth(2, 280).setColumnWidth(3, 100).setColumnWidth(4, 85).setColumnWidth(5, 85).setColumnWidth(6, 70).setColumnWidth(7, 70).setColumnWidth(8, 70);

    // Title
    sheet.getRange(titleRow, 1).setFontWeight('bold').setFontSize(16).setFontColor('#004d40');
    sheet.setRowHeight(titleRow, 28);

    // Meta
    sheet.getRange(metaRow1, 1).setFontSize(11);
    sheet.getRange(metaRow2, 1).setFontSize(11);
    sheet.getRange(metaRow3, 1).setFontSize(10).setFontColor('#616161');

    // Section headings
    sheet.getRange(peoHeadingRow, 1).setFontWeight('bold').setFontSize(13).setFontColor('#004d40');
    sheet.getRange(ploHeadingRow, 1).setFontWeight('bold').setFontSize(13).setFontColor('#004d40');
    sheet.setRowHeight(peoHeadingRow, 24);
    sheet.setRowHeight(ploHeadingRow, 24);

    // Table headers
    var peoHeaderRange = sheet.getRange(peoHeaderRow, 1, 1, 3);
    peoHeaderRange.setBackground('#004d40').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    var ploHeaderRange = sheet.getRange(ploHeaderRow, 1, 1, 8);
    ploHeaderRange.setBackground('#004d40').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.setRowHeight(peoHeaderRow, 20);
    sheet.setRowHeight(ploHeaderRow, 20);

    // Zebra rows
    if (peoCount) {
      var peoDataRange = sheet.getRange(peoDataStart, 1, peoCount, 3);
      peoDataRange.setWrap(true).setVerticalAlignment('top');
      for (var z = 0; z < peoCount; z++) {
        if (z % 2 === 1) sheet.getRange(peoDataStart + z, 1, 1, 3).setBackground('#f7f7f5');
      }
      sheet.getRange(peoDataStart, 1, peoCount, 1).setFontWeight('bold');
    } else {
      sheet.getRange(peoDataStart, 1).setValue('Tiada rekod PEO.').setFontColor('#93939f');
    }

    if (ploCount) {
      var ploDataRange = sheet.getRange(ploDataStart, 1, ploCount, 8);
      ploDataRange.setWrap(true).setVerticalAlignment('top');
      for (var z2 = 0; z2 < ploCount; z2++) {
        if (z2 % 2 === 1) sheet.getRange(ploDataStart + z2, 1, 1, 8).setBackground('#f7f7f5');
      }
      sheet.getRange(ploDataStart, 1, ploCount, 1).setFontWeight('bold');
    } else {
      sheet.getRange(ploDataStart, 1).setValue('Tiada rekod PLO.').setFontColor('#93939f');
    }

    // Footer
    sheet.getRange(footerRow, 1).setFontSize(8).setFontColor('#93939f');

    // The temporary spreadsheet has one sheet, so Drive exports only this PDF content.
    sheet.setHiddenGridlines(true);
    SpreadsheetApp.flush();
    var blob = DriveApp.getFileById(tempSs.getId()).getAs(MimeType.PDF);
    blob.setName(filenameBase_(code) + '.pdf');
    return blob;
  } finally {
    try { DriveApp.getFileById(tempSs.getId()).setTrashed(true); } catch (e) { /* temp cleanup */ }
  }
}

function padRow_(row, width) {
  var out = [];
  for (var i = 0; i < width; i++) out.push(row[i] == null ? '' : row[i]);
  return out;
}


function filenameBase_(mqaCode) {
  return String(mqaCode || '').trim().replace('/', '-');
}

function escapeHtml_(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Sends the generated PDF by email to the requester from the Deputy Dean
 * (Academic) PPS address. The address is valid when it is either the executing
 * account's own email or one of its send-as aliases; otherwise the send fails.
 */
function sendPdfEmailApi(mqaCode, email, fileId, sessionToken, faculty) {
  var programme = requireProgrammeFacultyAccess_(mqaCode, requireLogin_(sessionToken), faculty);
  var to = String(email || '').trim();
  var code = programme.mqaCode;
  var id = String(fileId || '').trim();
  if (!to || !code || !id) throw new Error('Email, programme code and file ID are required');

  var from = 'pps_tdakademik@unisza.edu.my';
  var activeEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var aliases = GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); });
  var isOwn = activeEmail === from.toLowerCase();
  var isAlias = aliases.indexOf(from.toLowerCase()) !== -1;
  if (!isOwn && !isAlias) {
    throw new Error('From address ' + from + ' is not the executing account or one of its aliases.');
  }

  var file = DriveApp.getFileById(id);
  var name = programme.name || code;
  var filename = file.getName();
  var pdfBlob = file.getBlob();
  pdfBlob.setName(filename);

  var subject = 'MQF 2.0 (2024) | Maklumat Program: ' + name + ' (' + code + ')';
  var body = 'Assalamualaikum dan Salam sejahtera,\n\n' +
    'Bersama-sama ini dilampirkan dokumen PDF maklumat program berikut:\n\n' +
    'Programme: ' + name + '\n' +
    'MQA Code: ' + code + '\n' +
    'Nama Fail: ' + filename + '\n\n' +
    'Dokumen ini dijana daripada modul Nexus: Maklumat Program MQF 2.0 (2024).\n' +
    'Sekiranya terdapat sebarang pertanyaan, sila hubungi Bahagian Akademik, Pusat Pengajian Siswazah.\n\n' +
    'Sekian, terima kasih.\n\n' +
    'Timbalan Dekan (Akademik)\n' +
    'Pusat Pengajian Siswazah\n' +
    'Universiti Sultan Zainal Abidin';

  var htmlBody = 'Assalamualaikum dan Salam sejahtera,<br><br>' +
    'Bersama-sama ini dilampirkan dokumen PDF maklumat program berikut:<br><br>' +
    '<strong>Programme:</strong> ' + escapeHtml_(name) + '<br>' +
    '<strong>MQA Code:</strong> ' + escapeHtml_(code) + '<br>' +
    '<strong>Nama Fail:</strong> ' + escapeHtml_(filename) + '<br><br>' +
    'Dokumen ini dijana daripada modul <strong>Nexus: Maklumat Program MQF 2.0 (2024)</strong>.<br>' +
    'Sekiranya terdapat sebarang pertanyaan, sila hubungi Bahagian Akademik, Pusat Pengajian Siswazah.<br><br>' +
    'Sekian, terima kasih.<br><br>' +
    'Timbalan Dekan (Akademik)<br>' +
    'Pusat Pengajian Siswazah<br>' +
    'Universiti Sultan Zainal Abidin';

  var options = {
    name: 'Timbalan Dekan (Akademik) PPS',
    htmlBody: htmlBody,
    attachments: [pdfBlob]
  };
  if (isAlias) options.from = from;
  GmailApp.sendEmail(to, subject, body, options);

  return { sent: true, to: to, filename: filename, from: from };
}
