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
  var user = getCurrentUser_();
  if (!user) throw new Error('Unauthorized');

  var admin = isGraduateSchoolAdmin_(user);
  var programmes = getProgrammes_(null).filter(isResearchProgramme_);
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
         overdueCount: 0,
         phase1CompleteCount: 0,
         phase2CompleteCount: 0,
         phase2CompletedItems: 0,
         phase2TotalItems: 0
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

/**
 * Lightweight dashboard: reads every PR_ sheet once (one getSheetsData snapshot),
 * then computes all programme statuses in memory. Avoids the per-programme
 * prepared-context reads that made the previous dashboard take minutes.
 */
function getFastUniversityDashboardApi_() {
  var user = getCurrentUser_();
  if (!user) throw new Error('Unauthorized');

  var admin = isGraduateSchoolAdmin_(user);
  var programmes = getProgrammes_(null).filter(isResearchProgramme_);

  var references = researchReferencesFromSeeds_();
  var byTitle = researchSnapshotByTitle_(getSpreadsheet());
  var rowSets = {};
  if (byTitle) {
    ['PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings', 'PR_PEOMappings'].forEach(function(name) {
      var data = byTitle[name] || [];
      rowSets[name] = data.length > 1 ? data.slice(1) : [];
    });
  } else {
    var ss = getSpreadsheet();
    ['PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings', 'PR_PEOMappings'].forEach(function(name) {
      var sheet = ss.getSheetByName(name);
      var data = sheet ? sheet.getDataRange().getValues() : [];
      rowSets[name] = data.length > 1 ? data.slice(1) : [];
    });
  }
  var byFaculty = {};
  var totals = createEmptyStatusTotals_();

  // Build effectiveKey map: programmeId -> SharedFromProgrammeId (owner) or itself
  var effectiveKeyMap = {};
  (rowSets.PR_ProgrammeProfile || []).forEach(function(row) {
    var pid = String(row[0] || '').trim();
    var sharedFrom = String(row[12] || '').trim();
    if (pid) effectiveKeyMap[pid] = sharedFrom || pid;
  });

  programmes.forEach(function(programme) {
    var key = getResearchProgrammeKey_(programme);
    var effectiveKey = effectiveKeyMap[key] || key;
    var reviewData = researchReviewDataFromRows_(effectiveKey, rowSets, references, programme.mqaCode, (byTitle || {})[programme.mqaCode]);
    var review = validateResearchProgramme_(reviewData);
    var metrics = review.metrics || {};
    var status = researchStatusFromMetrics_(metrics);
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
        overdueCount: 0,
        phase1CompleteCount: 0,
        phase2CompleteCount: 0,
        phase2CompletedItems: 0,
        phase2TotalItems: 0
      };
    }
    addStatusToTotals_(byFaculty[faculty], status);
    addStatusToTotals_(totals, status);
  });

  var faculties = Object.keys(byFaculty).sort().map(function(key) { return byFaculty[key]; });
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

function researchStatusFromMetrics_(metrics) {
  metrics = metrics || {};
  var peoOk = (metrics.peosTotal || 0) > 0 && (metrics.peoStatementsComplete || 0) === (metrics.peosTotal || 0);
  var ploOk = (metrics.ploTotal || 0) > 0 && (metrics.ploStatementsComplete || 0) === (metrics.ploTotal || 0);
  var mqfOk = (metrics.ploWithMQF || 0) === (metrics.ploTotal || 0) && (metrics.ploTotal || 0) > 0;
  var taxonomyOk = (metrics.ploWithValidTaxonomy || 0) === (metrics.ploTotal || 0) && (metrics.ploTotal || 0) > 0;
  var phase1Complete = peoOk && ploOk && mqfOk && taxonomyOk;
  var phase2SDGCount = Math.min(metrics.phase2SDGCount || 0, 3);
  var phase2SCCategoryCount = Math.min(metrics.phase2SCCategoryCount || 0, 3);
  var phase2CompletedItems = phase2SDGCount + phase2SCCategoryCount;
  var phase2Complete = phase2CompletedItems === 6;
  var phase2Percent = Math.round((phase2CompletedItems / 6) * 100);
  return {
    completionState: phase1Complete ? 'Complete' : 'Needs attention',
    peoState: peoOk ? 'Complete' : 'Needs attention',
    ploState: ploOk ? 'Complete' : 'Needs attention',
    mqfDomainState: mqfOk ? 'Complete' : 'Needs attention',
    taxonomyState: taxonomyOk ? 'Complete' : 'Needs attention',
    phase1Complete: phase1Complete,
    phase2Complete: phase2Complete,
    phase2Percent: phase2Percent,
    phase2CompletedItems: phase2CompletedItems,
    phase2TotalItems: 6,
    mappingState: 'Not required',
    documentState: 'Not required',
    reviewState: phase1Complete ? 'Ready' : 'Blocked',
    submissionState: phase1Complete ? 'Ready' : 'Needs attention',
    overdue: isProgrammeOverdue_({completionState: phase1Complete ? 'Complete' : 'Needs attention'}),
    counts: {
      peos: metrics.peosTotal || 0,
      peoComplete: metrics.peoStatementsComplete || 0,
      plos: metrics.ploTotal || 0,
      ploComplete: metrics.ploStatementsComplete || 0,
      mqfDomainComplete: metrics.ploWithMQF || 0,
      taxonomyComplete: metrics.ploWithValidTaxonomy || 0,
      phase2SDGCount: phase2SDGCount,
      phase2SCCategoryCount: phase2SCCategoryCount,
      mappingComplete: 0
    }
  };
}

function getFacultyReportApi_(faculty) {
  var user = getCurrentUser_();
  if (!user) throw new Error('Unauthorized');
  if (!isGraduateSchoolAdmin_(user) && String(faculty || '') !== String(user.faculty || '')) {
    throw new Error('Forbidden: faculty report is outside your authorized scope');
  }

  var programmes = getProgrammes_(faculty).filter(isResearchProgramme_);
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
  var access = requireResearchProgrammeAccess_(mqaCode, 'view-status');
  var programme = requireResearchProgramme_(mqaCode);
  return shapeStatusForUser_(programme, computeProgrammeStatus_(programme), access.user);
}

function saveProgrammeStatusApi_(mqaCode, status) {
  var access = requireResearchProgrammeAccess_(mqaCode, 'save-status');
  var programme = requireResearchProgramme_(mqaCode);
  if (!isGraduateSchoolAdmin_(access.user) && access.user.faculty !== programme.faculty) {
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
    programme.faculty,
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
  var user = getCurrentUser_();
  if (!user) throw new Error('Unauthorized');
  var sheets = ensureGovernanceSheets_();
  var data = sheets.GovernanceItems.getDataRange().getValues();
  var faculty = filters && filters.faculty;
  var status = filters && filters.status;
  return data.slice(1).filter(function(row) {
    if (!row[0]) return false;
    var programme = findProgrammeByMqaCode_(row[1]);
    if (!programme || !isResearchProgramme_(programme)) return false;
    if (!isGraduateSchoolAdmin_(user) && String(programme.faculty) !== String(user.faculty)) return false;
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

function getFacultyUserDirectoryApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Forbidden: administrator access required');
  var sheet = getSpreadsheet().getSheetByName('USER');
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(value) { return String(value || '').trim().toLowerCase(); });
  function column(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var index = headers.indexOf(names[i]);
      if (index !== -1) return index;
    }
    return fallback;
  }
  var facultyColumn = column(['faculty', 'faculty code', 'faculty/centre'], 0);
  var nameColumn = column(['name', 'staff name', 'user'], 1);
  var positionColumn = column(['position', 'role', 'designation'], 3);
  var programmes = getProgrammes_(null);
  var facultyNames = programmes.reduce(function(result, programme) {
    var code = String(programme.faculty || '').trim();
    if (code && programme.facultyFull) result[code] = String(programme.facultyFull).trim();
    return result;
  }, {});
  var groups = {};
  values.slice(1).forEach(function(row) {
    var faculty = String(row[facultyColumn] || '').trim();
    var name = String(row[nameColumn] || '').trim();
    var position = String(row[positionColumn] || '').trim();
    if (!faculty || !name) return;
    if (!groups[faculty]) {
      var fullName = facultyNames[faculty] || faculty;
      groups[faculty] = { code: faculty, name: fullName, users: [] };
    }
    groups[faculty].users.push({ name: name, position: position });
  });
  function positionRank(position) {
    var value = String(position || '').toLowerCase();
    if ((value.indexOf('deputy dean') !== -1 && value.indexOf('academic') !== -1) ||
        (value.indexOf('timbalan dekan') !== -1 && value.indexOf('akademik') !== -1)) return 1;
    if (value.indexOf('graduate coordinator') !== -1 || value.indexOf('penyelaras siswazah') !== -1) return 2;
    if (value.indexOf('faculty pic') !== -1 || value.indexOf('institute pic') !== -1 || value === 'pic' || value.indexOf(' pic') !== -1) return 3;
    return 4;
  }
  return Object.keys(groups).map(function(code) {
    var group = groups[code];
    group.users.sort(function(a, b) {
      return positionRank(a.position) - positionRank(b.position) || a.name.localeCompare(b.name);
    });
    return group;
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });
}

function saveGovernanceItemApi_(item) {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  if (!item || !item.mqaCode) throw new Error('Research programme is required');
  var programme = findProgrammeByMqaCode_(item.mqaCode);
  if (!programme || !isResearchProgramme_(programme)) throw new Error('Forbidden: programme is not postgraduate by research');
  var types = ['Revision', 'Audit', 'Administration Request'];
  var statuses = ['Open', 'In Progress', 'Blocked', 'Complete', 'Closed'];
  if (types.indexOf(String(item.type)) === -1) throw new Error('Invalid governance item type');
  if (statuses.indexOf(String(item.status)) === -1) throw new Error('Invalid governance item status');
  var sheets = ensureGovernanceSheets_();
  var sheet = sheets.GovernanceItems;
  var now = new Date();
  var id = item.itemId || ('GOV-' + Utilities.getUuid());
  sheet.appendRow([
    id, programme.mqaCode, programme.faculty, item.type, item.title || '',
    item.description || '', item.status, item.ownerEmail || '', item.dueDate || '',
    now, now, user.email
  ]);
  return { itemId: id, status: item.status };
}

function computeProgrammeStatus_(programme) {
  requireResearchProgramme_(programme.mqaCode);
  return computeResearchProgrammeStatus_(programme);
}

function computeResearchProgrammeStatus_(programme) {
  var review = validateResearchProgramme_(researchReviewData_(programme.mqaCode));
  var metrics = review.metrics || {};

  var peoOk = (metrics.peosTotal || 0) > 0 && (metrics.peoStatementsComplete || 0) === (metrics.peosTotal || 0);
  var ploOk = (metrics.ploTotal || 0) > 0 && (metrics.ploStatementsComplete || 0) === (metrics.ploTotal || 0);
  var mqfOk = (metrics.ploWithMQF || 0) === (metrics.ploTotal || 0) && (metrics.ploTotal || 0) > 0;
  var taxonomyOk = (metrics.ploWithValidTaxonomy || 0) === (metrics.ploTotal || 0) && (metrics.ploTotal || 0) > 0;
  var phase1Complete = peoOk && ploOk && mqfOk && taxonomyOk;
  var phase2SDGCount = Math.min(metrics.phase2SDGCount || 0, 3);
  var phase2SCCategoryCount = Math.min(metrics.phase2SCCategoryCount || 0, 3);
  var phase2CompletedItems = phase2SDGCount + phase2SCCategoryCount;
  var phase2Complete = phase2CompletedItems === 6;
  var phase2Percent = Math.round((phase2CompletedItems / 6) * 100);

  return {
    completionState: phase1Complete ? 'Complete' : 'Needs attention',
    peoState: peoOk ? 'Complete' : 'Needs attention',
    ploState: ploOk ? 'Complete' : 'Needs attention',
    mqfDomainState: mqfOk ? 'Complete' : 'Needs attention',
    taxonomyState: taxonomyOk ? 'Complete' : 'Needs attention',
    phase1Complete: phase1Complete,
    phase2Complete: phase2Complete,
    phase2Percent: phase2Percent,
    phase2CompletedItems: phase2CompletedItems,
    phase2TotalItems: 6,
    mappingState: 'Not required',
    documentState: 'Not required',
    reviewState: phase1Complete ? 'Ready' : 'Blocked',
    submissionState: phase1Complete ? 'Ready' : 'Needs attention',
    overdue: isProgrammeOverdue_({completionState: phase1Complete ? 'Complete' : 'Needs attention'}),
     counts: {
       peos: metrics.peosTotal || 0,
       peoComplete: metrics.peoStatementsComplete || 0,
       plos: metrics.ploTotal || 0,
       ploComplete: metrics.ploStatementsComplete || 0,
       mqfDomainComplete: metrics.ploWithMQF || 0,
      taxonomyComplete: metrics.ploWithValidTaxonomy || 0,
      phase2SDGCount: phase2SDGCount,
      phase2SCCategoryCount: phase2SCCategoryCount,
      mappingComplete: 0
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
      overdueCount: 0,
      phase1CompleteCount: 0,
      phase2CompleteCount: 0,
      phase2CompletedItems: 0,
      phase2TotalItems: 0
    };
}

function addStatusToTotals_(totals, status) {
  totals.programmeCount++;
  if (status.phase1Complete) totals.phase1CompleteCount++;
  if (status.phase2Complete) totals.phase2CompleteCount++;
  totals.phase2CompletedItems += status.phase2CompletedItems || 0;
  totals.phase2TotalItems += status.phase2TotalItems || 6;
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
