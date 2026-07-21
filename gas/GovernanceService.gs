/** GovernanceService.gs - university reporting and additive governance records */

var ACADEMIC_DEADLINE = '2026-07-23T23:59:59+08:00';
var ACADEMIC_DEADLINE_LABEL = '23 July 2026, 11:59:59 PM MYT';

function getAcademicDeadline_() {
  return new Date(ACADEMIC_DEADLINE);
}

function isProgrammeOverdue_(status, now) {
  var completionState = String(status && status.completionState || '').trim();
  if (completionState === 'Complete' || completionState === 'Submitted') return false;
  return (now || new Date()).getTime() > getAcademicDeadline_().getTime();
}

var GOVERNANCE_HEADERS = {
  ProgrammeStatus: [
    'MQACode', 'Faculty', 'CompletionState', 'PEOState', 'PLOState',
    'MQFDomainState', 'TaxonomyState', 'MappingState', 'DocumentState',
    'ReviewState', 'SubmissionState', 'LastUpdated', 'ReportingPeriod', 'UpdatedBy'
  ],
  GovernanceItems: [
    'ItemId', 'MQACode', 'Faculty', 'Type', 'Title', 'Description', 'Status',
    'OwnerEmail', 'DueDate', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'
  ]
};

function ensureGovernanceSheets_() {
  var ss = getSpreadsheet();
  var sheets = {};
  Object.keys(GOVERNANCE_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(GOVERNANCE_HEADERS[name]);
    }
    sheets[name] = sheet;
  });
  return sheets;
}

function getUniversityDashboardApi_() {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  var admin = isGraduateSchoolAdmin_(user);
  var programmes = getProgrammes(admin ? null : user.faculty).filter(isResearchProgramme_);
  var byFaculty = {};
  var totals = createEmptyStatusTotals_();

  programmes.forEach(function(programme) {
    var status = computeProgrammeStatus_(programme);
    var faculty = programme.faculty || 'Unknown';
    if (!byFaculty[faculty]) {
      byFaculty[faculty] = {
        faculty: faculty,
        facultyFull: programme.facultyFull || faculty,
        programmeCount: 0,
        completeCount: 0,
        needsAttentionCount: 0,
        mqfDomainCompleteCount: 0,
        taxonomyCompleteCount: 0,
        mappingCompleteCount: 0,
        documentReadyCount: 0,
        reviewCount: 0,
        submissionCount: 0,
        overdueCount: 0
      };
    }
    addStatusToTotals_(byFaculty[faculty], status);
    addStatusToTotals_(totals, status);
  });

  var faculties = Object.keys(byFaculty).sort().map(function(key) {
    return byFaculty[key];
  });
  return {
    generatedAt: new Date().toISOString(),
    reportingPeriod: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM'),
    facultyCount: faculties.length,
    programmeCount: programmes.length,
    totals: totals,
    faculties: faculties,
    canDrillDown: admin,
    academicDeadline: ACADEMIC_DEADLINE_LABEL
  };
}

function getFacultyReportApi_(faculty) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (!isGraduateSchoolAdmin_(user) && String(faculty || '') !== String(user.faculty || '')) {
    throw new Error('Forbidden: faculty report is outside your authorized scope');
  }

  var programmes = getProgrammes(faculty).filter(isResearchProgramme_);
  return {
    faculty: faculty,
    programmeCount: programmes.length,
    programmes: programmes.map(function(programme) {
      var status = computeProgrammeStatus_(programme);
      return shapeStatusForUser_(programme, status, user);
    })
  };
}

function getProgrammeStatusApi_(mqaCode) {
  var access = requireProgrammeAccess_(mqaCode, 'view-status');
  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme) throw new Error('Programme not found');
  return shapeStatusForUser_(programme, computeProgrammeStatus_(programme), access.user);
}

function saveProgrammeStatusApi_(mqaCode, status) {
  var access = requireProgrammeAccess_(mqaCode, 'save-status');
  if (!isGraduateSchoolAdmin_(access.user) && access.user.faculty !== findProgrammeByMqaCode_(mqaCode).faculty) {
    throw new Error('Forbidden: only authorized programme editors may save status');
  }
  var allowed = ['Draft', 'In Progress', 'Needs Attention', 'Complete', 'Submitted', 'Under Revision', 'Under Audit'];
  if (allowed.indexOf(String(status.completionState || '')) === -1) {
    throw new Error('Invalid completion state');
  }
  var sheets = ensureGovernanceSheets_();
  var sheet = sheets.ProgrammeStatus;
  var user = access.user;
  var values = [
    mqaCode,
    findProgrammeByMqaCode_(mqaCode).faculty,
    status.completionState,
    status.peoState || '',
    status.ploState || '',
    status.mqfDomainState || '',
    status.taxonomyState || '',
    status.mappingState || '',
    status.documentState || '',
    status.reviewState || '',
    status.submissionState || '',
    new Date(),
    status.reportingPeriod || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM'),
    user.email
  ];
  var data = sheet.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mqaCode)) { row = i + 1; break; }
  }
  if (row === -1) sheet.appendRow(values);
  else sheet.getRange(row, 1, 1, values.length).setValues([values]);
  return getProgrammeStatusApi_(mqaCode);
}

function getGovernanceItemsApi_(filters) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  var sheets = ensureGovernanceSheets_();
  var data = sheets.GovernanceItems.getDataRange().getValues();
  var faculty = filters && filters.faculty;
  var status = filters && filters.status;
  return data.slice(1).filter(function(row) {
    if (!row[0]) return false;
    if (!isGraduateSchoolAdmin_(user) && String(row[2]) !== String(user.faculty)) return false;
    if (faculty && String(row[2]) !== String(faculty)) return false;
    if (status && String(row[6]) !== String(status)) return false;
    return true;
  }).map(function(row) {
    return {
      itemId: row[0], mqaCode: row[1], faculty: row[2], type: row[3], title: row[4],
      description: row[5], status: row[6], ownerEmail: row[7], dueDate: row[8],
      createdAt: row[9], updatedAt: row[10], updatedBy: row[11]
    };
  });
}

function saveGovernanceItemApi_(item) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var types = ['Revision', 'Audit', 'Administration Request'];
  var statuses = ['Open', 'In Progress', 'Blocked', 'Complete', 'Closed'];
  if (types.indexOf(String(item.type)) === -1) throw new Error('Invalid governance item type');
  if (statuses.indexOf(String(item.status)) === -1) throw new Error('Invalid governance item status');
  var sheets = ensureGovernanceSheets_();
  var sheet = sheets.GovernanceItems;
  var now = new Date();
  var id = item.itemId || ('GOV-' + Utilities.getUuid());
  sheet.appendRow([
    id, item.mqaCode || '', item.faculty || '', item.type, item.title || '',
    item.description || '', item.status, item.ownerEmail || '', item.dueDate || '',
    now, now, user.email
  ]);
  return { itemId: id, status: item.status };
}

function computeProgrammeStatus_(programme) {
  if (isResearchProgramme_(programme)) return computeResearchProgrammeStatus_(programme);
  var peos = getPEOs(programme.mqaCode);
  var plos = getPLOs(programme.mqaCode);
  var filesReady = hasProgrammeDocuments_(programme.mqaCode);
  var peoComplete = peos.length > 0 && peos.every(function(item) { return String(item.description || '').trim(); });
  var ploComplete = plos.length > 0 && plos.every(function(item) { return String(item.description || '').trim(); });
  var mqfComplete = plos.length > 0 && plos.every(function(item) { return String(item.mqfDomain || '').trim(); });
  var taxonomyComplete = plos.length > 0 && plos.every(function(item) { return String(item.taxonomy || '').trim(); });
  var mappingComplete = plos.length > 0 && plos.every(function(item) { return String(item.embeddedPEO || '').trim(); });
  var complete = peoComplete && ploComplete && mqfComplete && taxonomyComplete && mappingComplete;
  var completionState = complete ? 'Complete' : 'Needs Attention';
  return {
    completionState: completionState,
    peoState: peoComplete ? 'Complete' : 'Needs Attention',
    ploState: ploComplete ? 'Complete' : 'Needs Attention',
    mqfDomainState: mqfComplete ? 'Complete' : 'Needs Attention',
    taxonomyState: taxonomyComplete ? 'Complete' : 'Needs Attention',
    mappingState: mappingComplete ? 'Complete' : 'Needs Attention',
    documentState: filesReady ? 'Ready' : 'Needs Attention',
    reviewState: complete ? 'Ready' : 'Blocked',
    submissionState: complete ? 'Ready' : 'Draft',
    overdue: isProgrammeOverdue_({ completionState: completionState }),
    counts: {
      peos: peos.length,
      plos: plos.length,
      mqfDomainComplete: plos.filter(function(item) { return String(item.mqfDomain || '').trim(); }).length,
      taxonomyComplete: plos.filter(function(item) { return String(item.taxonomy || '').trim(); }).length,
      mappingComplete: plos.filter(function(item) { return String(item.embeddedPEO || '').trim(); }).length
    }
  };
}

function computeResearchProgrammeStatus_(programme) {
  var review = getResearchReviewApi_(programme.mqaCode);
  var metrics = review.metrics || {};
  var ready = review.status === 'Ready for review' || review.status === 'Submitted' || review.status === 'Approved';
  var submitted = review.status === 'Submitted' || review.status === 'Approved';
  var peoReady = (metrics.peosWithIssues || 0) === 0 && metrics.ploTotal > 0;
  var ploReady = metrics.ploStatementsComplete === metrics.ploTotal && metrics.ploTotal > 0;
  var mqfReady = metrics.ploWithMQF === metrics.ploTotal && metrics.ploTotal > 0;
  var taxonomyReady = metrics.ploWithValidTaxonomy === metrics.ploTotal && metrics.ploTotal > 0;
  var mappingReady = isResearchMappingComplete_(metrics);
  return {
    completionState: review.status,
    peoState: peoReady ? 'Complete' : 'Needs attention',
    ploState: ploReady ? 'Complete' : 'Needs attention',
    mqfDomainState: mqfReady ? 'Complete' : 'Needs attention',
    taxonomyState: taxonomyReady ? 'Complete' : 'Needs attention',
    mappingState: mappingReady ? 'Complete' : 'Needs attention',
    documentState: 'Not required',
    reviewState: review.critical && review.critical.length ? 'Blocked' : 'Ready',
    submissionState: submitted ? 'Submitted' : (ready ? 'Ready' : review.status),
    overdue: isProgrammeOverdue_({completionState: submitted ? 'Submitted' : review.status}),
    counts: {
      peos: review.peoCoverage ? review.peoCoverage.length : 0,
      plos: metrics.ploTotal || 0,
      mqfDomainComplete: metrics.ploWithMQF || 0,
      taxonomyComplete: metrics.ploWithValidTaxonomy || 0,
      mappingComplete: mappingReady ? metrics.ploTotal : (metrics.ploWithValidTF || 0)
    }
  };
}

function isResearchMappingComplete_(metrics) {
  metrics = metrics || {};
  return metrics.ploTotal > 0 &&
    metrics.ploWithMQF === metrics.ploTotal &&
    metrics.ploWithValidTF === metrics.ploTotal;
}

function hasProgrammeDocuments_(mqaCode) {
  try {
    var root = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var folders = root.getFoldersByName(mqaCode);
    if (!folders.hasNext()) return false;
    var files = folders.next().getFiles();
    return files.hasNext();
  } catch (e) {
    return false;
  }
}

function shapeStatusForUser_(programme, status, user) {
  var result = {
    faculty: programme.faculty,
    facultyFull: programme.facultyFull,
    status: status
  };
  if (isGraduateSchoolAdmin_(user) || programme.faculty === user.faculty) {
    result.name = programme.name;
    result.mqaCode = programme.mqaCode;
    result.progCode = programme.progCode;
    result.level = programme.level;
  }
  return result;
}

function createEmptyStatusTotals_() {
  return {
    programmeCount: 0,
    completeCount: 0,
    needsAttentionCount: 0,
    mqfDomainCompleteCount: 0,
    taxonomyCompleteCount: 0,
    mappingCompleteCount: 0,
    documentReadyCount: 0,
    reviewCount: 0,
    submissionCount: 0,
    overdueCount: 0
  };
}

function addStatusToTotals_(totals, status) {
  totals.programmeCount++;
  if (status.completionState === 'Complete') totals.completeCount++;
  else totals.needsAttentionCount++;
  if (status.mqfDomainState === 'Complete') totals.mqfDomainCompleteCount++;
  if (status.taxonomyState === 'Complete') totals.taxonomyCompleteCount++;
  if (status.mappingState === 'Complete') totals.mappingCompleteCount++;
  if (status.documentState === 'Ready') totals.documentReadyCount++;
  if (status.reviewState === 'Ready') totals.reviewCount++;
  if (status.submissionState === 'Submitted') totals.submissionCount++;
  if (status.overdue) totals.overdueCount++;
}
