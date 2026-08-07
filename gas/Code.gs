/** Code.gs — Entry point, API endpoints, and error handling */

function handleError(e) {
  console.error(e.message + (e.stack ? '\n' + e.stack : ''));
  throw new Error('Ralat berlaku. Sila cuba sebentar lagi.');
}

function withErrorHandling(fn) {
  try {
    return fn();
  } catch(e) {
    return handleError(e);
  }
}

function doGet(e) {
  var params = e && e.parameter || {};
  if (hasDisabledLegacyRoute_(params)) return disabledEndpointResponse_();
  if (params.runSeed === 'phase2') return runPhase2SeedFromUrl_();

  try {
    var code = params.code;
    var state = params.state;

    var template = HtmlService.createTemplateFromFile('Index');
    template.oauthUrl = getOAuthUrl();
    template.oauthError = '';
    template.sessionEmail = '';
    template.sessionUser = '';
    template.deploymentUrl = ScriptApp.getService().getUrl();
    template.connectionError = '';

    if (code && state) {
      try {
        var result = handleOAuthCode(code, state);
        template.sessionEmail = result.user.email;
        template.sessionUser = JSON.stringify(result.user);
      } catch (err) {
        console.error('OAuth error: ' + err.message);
        template.oauthError = err.message;
      }
      return template.evaluate()
        .setTitle('MQF 2.0 — Program Information')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    try {
      var user = getCurrentUser_();
      if (user) {
        template.sessionEmail = user.email;
        template.sessionUser = JSON.stringify(user);
      } else {
        var email = '';
        try { email = Session.getActiveUser().getEmail(); } catch (ex) {}
        if (email && email.indexOf('@unisza.edu.my') !== -1) {
          template.connectionError = 'Your account ' + email + ' could not be found in the MQF 2.0 authorised user directory. Please ask a Graduate School admin to add your email to the ADMIN or USER sheet.';
        }
      }
    } catch (err) {
      console.error('Spreadsheet access error: ' + (err.message || err));
      template.connectionError = 'Unable to connect to the MQF 2.0 data spreadsheet. Please verify that the deployment account has access to the spreadsheet. If the issue persists, contact the Graduate School administrator.';
    }

    return template.evaluate()
      .setTitle('MQF 2.0 — Program Information')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (fatalErr) {
    console.error('Fatal doGet error: ' + (fatalErr.message || fatalErr));
    var msg = String(fatalErr.message || fatalErr || 'Unknown error');
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MQF 2.0 — Unavailable</title></head><body style="font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;background:#f8f9fa"><div style="max-width:440px;background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 6px 24px rgba(0,0,0,.06);text-align:center"><h1 style="color:#1d2b4c;font-size:22px;font-weight:600;margin:0 0 10px">MQF 2.0</h1><p style="color:#4d5870;font-size:14px;line-height:1.6;margin:0">The application could not start. Please verify the deployment configuration and try again.</p><p style="color:#68738a;font-size:12px;margin-top:18px;word-break:break-all">' + msg.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p></div></body></html>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function hasDisabledLegacyRoute_(params) {
  var names = ['debug', 'pic', 'sendAll', 'sendFaculty', 'testEmail', 'updatePIC'];
  return names.some(function(name) { return Object.prototype.hasOwnProperty.call(params || {}, name); });
}

function disabledEndpointResponse_() {
  return ContentService.createTextOutput('Endpoint disabled')
    .setMimeType(ContentService.MimeType.TEXT);
}

function runPhase2SeedFromUrl_() {
  try {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) {
      return ContentService.createTextOutput('ERROR: Graduate School admin access required')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    var result = writeAllPhase2MappingsApi_();
    return ContentService.createTextOutput(
      'Phase 2 mapping seed complete.\nTotal: ' + result.total + '\nWritten: ' + result.written + '\nErrors: ' + result.errors +
      (result.errors ? '\nError details:\n' + JSON.stringify(result.errorDetails) : '')
    ).setMimeType(ContentService.MimeType.TEXT);
  } catch (e) {
    return ContentService.createTextOutput('ERROR: ' + String(e.message || e))
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function debugGetProgrammesApi() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Endpoint disabled');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) return { error: 'No sheet' };
  var data = sheet.getDataRange().getValues();
  var eseriRows = [];
  for (var i = 1; i < data.length; i++) {
    var col6 = String(data[i][6]);
    var col7 = String(data[i][7]);
    if (col6.indexOf('ESERI') > -1 || col7.indexOf('ESERI') > -1) {
      eseriRows.push({ row: i, col6: col6, col7: col7, col7Len: col7.length, col6Len: col6.length, name: data[i][1] });
    }
  }
  return { user: user, filterFaculty: user.faculty, eseriRows: eseriRows, totalRows: data.length };
}

function getProgrammesApi() {
  var user = getCurrentUser_();
  if (!user) throw new Error('Unauthorized');
  return getProgrammes_(user.role === 'Admin' ? null : user.faculty).filter(isResearchProgramme_);
}

function getUniversityDashboardApi() {
  return getFastUniversityDashboardApi_();
}

function getFacultyReportApi(faculty) {
  return getFacultyReportApi_(faculty);
}

function getProgrammeStatusApi(mqaCode) {
  return getProgrammeStatusApi_(mqaCode);
}

function saveProgrammeStatusApi(mqaCode, status) {
  return saveProgrammeStatusApi_(mqaCode, status);
}

function getGovernanceItemsApi(filters) {
  return getGovernanceItemsApi_(filters || {});
}

function getFacultyUserDirectoryApi() {
  return getFacultyUserDirectoryApi_();
}

function saveGovernanceItemApi(item) {
  return saveGovernanceItemApi_(item || {});
}

function createAccessRequestApi(request) {
  return createAccessRequestApi_(request || {});
}

function getAccessRequestsApi(filters) {
  return getAccessRequestsApi_(filters || {});
}

function decideAccessRequestApi(requestId, decision, note) {
  return decideAccessRequestApi_(requestId, decision, note || '');
}

function revokeAccessGrantApi(requestId, note) {
  return revokeAccessGrantApi_(requestId, note || '');
}

function getResearchProgrammeApi(programmeId) { return getResearchProgrammeApi_(programmeId); }
function saveResearchProfileApi(programmeId, profile) { return saveResearchProfileApi_(programmeId, profile || {}); }
function getResearchPEOsApi(programmeId) { return getResearchPEOsApi_(programmeId); }
function saveResearchPEOsApi(programmeId, peos) { return saveResearchPEOsApi_(programmeId, peos || []); }
function getResearchPLOsApi(programmeId) { return getResearchPLOsApi_(programmeId); }
function saveResearchPLOsApi(programmeId, plos) { return saveResearchPLOsApi_(programmeId, plos || []); }
function getResearchMappingsApi(programmeId) { return getResearchMappingsApi_(programmeId); }
function saveResearchPLOMappingApi(programmeId, ploId, mapping) { return saveResearchPLOMappingApi_(programmeId, ploId, mapping || {}); }
function getResearchCoverageApi(programmeId) { return getResearchCoverageApi_(programmeId); }
function getResearchReviewApi(programmeId) { return getResearchReviewApi_(programmeId); }
function getResearchWorkspaceApi(programmeId) { return getResearchWorkspaceApi_(programmeId); }
function getAssessmentWorkspaceApi(programmeId) { return getAssessmentWorkspaceApi_(programmeId); }
function saveResearchStatusApi(programmeId, status) { return saveResearchStatusApi_(programmeId, status); }
function submitResearchProgrammeApi(programmeId) { return submitResearchProgrammeApi_(programmeId); }
function getAssessmentMappingApi(programmeId) { return getAssessmentMappingApi_(programmeId); }
function saveAssessmentMappingApi(programmeId, payload) { return saveAssessmentMappingApi_(programmeId, payload || {}); }
function resetAssessmentMappingApi(programmeId, itemIds) { return resetAssessmentMappingApi_(programmeId, itemIds || []); }
function getAssessmentReviewApi(programmeId) { return getAssessmentReviewApi_(programmeId); }

function getProgrammeSDGDefaultsApi(mqaCode) { return getProgrammeSDGDefaultsApi_(mqaCode); }
function getPEOMappingsApi(programmeId) { return getPEOMappingsApi_(programmeId); }
function savePEOMappingApi(programmeId, peoId, mapping) { return savePEOMappingApi_(programmeId, peoId, mapping || {}); }
function writePhase2MappingApi(programmeId) { return writePhase2MappingApi_(programmeId); }
function writeAllPhase2MappingsApi() { return writeAllPhase2MappingsApi_(); }

function setSharedMQAOwnerApi(mqaCode, newOwnerProgrammeId) { return setSharedMQAOwnerApi_(mqaCode, newOwnerProgrammeId); }

function seedAllPEOSDGDefaultsApi() { return seedAllPEOSDGDefaultsApi_(); }

function seedAllPLOSCDefaultsApi() { return seedAllPLOSCDefaultsApi_(); }

function getResearchHealReportApi() { return getResearchHealReportApi_(); }
function getResearchHealDetailApi(programmeId) { return getResearchHealDetailApi_(programmeId); }
function healResearchAssignmentsApi(programmeId, assignments) { return healResearchAssignmentsApi_(programmeId, assignments || []); }

function approveDeleteFileApi(requestId) {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  return approveDeleteFile_(requestId);
}

function getPendingDeletionsApi() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  return getPendingDeletions_();
}

/** One-time: create per-program tabs for all programmes from the Programme sheet */
function prepareAllSheetsApi() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Programme sheet not found');
  var data = sheet.getDataRange().getValues();
  var created = [], skipped = [], errors = [], total = 0;
  
  for (var i = 1; i < data.length; i++) {
    var mqaCode = String(data[i][2] || '').trim();
    if (!mqaCode) continue;
    var programme = findProgrammeByMqaCode_(mqaCode);
    if (!isResearchProgramme_(programme)) {
      skipped.push(mqaCode);
      continue;
    }
    total++;
    
    try {
      var existing = ss.getSheetByName(mqaCode);
      if (existing) {
        skipped.push(mqaCode);
        continue;
      }
      
      var tab = ss.insertSheet(mqaCode);
      tab.getRange('A1').setValue('PEO');
      tab.getRange('A2').setValue('PLO');
      tab.setFrozenRows(0);
      created.push(mqaCode);
    } catch(e) {
      errors.push(mqaCode + ': ' + e.message);
    }
  }
  
  return { created: created, skipped: skipped, errors: errors, total: total };
}

/** Send test announcement email (to fathurrahman@unisza.edu.my only) */
function sendTestAnnouncementApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendTestAnnouncement();
  });
}

/** Send test progress email (to fathur6@gmail.com — ESERI, Penguji Sistem) */
function sendTestProgressEmailApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendTestProgressEmail();
  });
}

/** Send progress announcement to a specific faculty */
function sendProgressAnnouncementApi(fac) {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendProgressAnnouncement(fac);
  });
}

/** Send progress announcement to all faculties */
function sendAllProgressAnnouncementsApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendAllProgressAnnouncements();
  });
}

/** Send progress announcement to selected faculties (JSON array string) */
function sendProgressAnnouncementsByFacultyListApi(facList) {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendProgressAnnouncementsByFacultyList(facList);
  });
}

/** Send announcement to a specific faculty */
function sendAnnouncementApi(fac) {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendAnnouncement(fac);
  });
}

/** Send announcement to all faculties */
function sendAllAnnouncementsApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendAllAnnouncements();
  });
}

/** Send announcement to selected faculties (JSON array string) */
function sendAnnouncementsByFacultyListApi(facList) {
  return withErrorHandling(function() {
    var user = getCurrentUser_();
    if (!isGraduateSchoolAdmin_(user)) throw new Error('Admin only');
    return sendAnnouncementsByFacultyList(facList);
  });
}
