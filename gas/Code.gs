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
  var code = e && e.parameter && e.parameter.code;
  var state = e && e.parameter && e.parameter.state;

  // Debug mode: /exec?debug=1 — returns JSON of all ESERI faculty values
  if (e && e.parameter && e.parameter.debug) {
    return ContentService.createTextOutput(JSON.stringify(debugGetProgrammesApi()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Debug PIC: /exec?pic=1 — returns raw PIC sheet data
  if (e && e.parameter && e.parameter.pic) {
    var ss = getSpreadsheet();
    var pic = ss.getSheetByName('PIC');
    var data = pic.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify(data, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Send all: /exec?sendAll=1 — sends announcement to all 15 faculties
  if (e && e.parameter && e.parameter.sendAll) {
    var results = sendAllAnnouncements();
    return ContentService.createTextOutput(JSON.stringify(results, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Send single: /exec?sendFaculty=FF — sends announcement to a specific faculty
  if (e && e.parameter && e.parameter.sendFaculty) {
    try {
      var result = sendAnnouncement(e.parameter.sendFaculty);
      return ContentService.createTextOutput(result)
        .setMimeType(ContentService.MimeType.TEXT);
    } catch(err) {
      return ContentService.createTextOutput('Error: ' + err.message)
        .setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // Test email: /exec?testEmail=1 — sends test email for FBK (mailmerge demo)
  if (e && e.parameter && e.parameter.testEmail) {
    var result = sendTestAnnouncement();
    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.TEXT);
  }

  // Update PIC: /exec?updatePIC=1 — rewrites PIC sheet with correct data
  if (e && e.parameter && e.parameter.updatePIC) {
    var ss = getSpreadsheet();
    var pic = ss.getSheetByName('PIC');
    pic.clearContents();
    pic.appendRow(['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Faculty PIC', 'Faculty PIC Email']);
    var rows = [
      ['FBK','DR. MOHD HAZLI BIN YAH @ ALIAS','mohdhazli@unisza.edu.my','NORMA BINTI JUSOH','normajusoh@unisza.edu.my'],
      ['FBIM','DR. NORNASUHA BINTI YUSOFF','nornasuhayusoff@unisza.edu.my','MOHAMMAD AMIRUL IZZUDDIN BIN AZMI','izzuddinazmi@unisza.edu.my'],
      ['FF','DR. ZALINA BINTI ZAHARI','zalinazahari@unisza.edu.my','FAIRUZ BINTI ZAKARIA','fairuzzakaria@unisza.edu.my'],
      ['FIK','DR. MUHAMMAD DANIAL BIN ZAKARIA','mdanialzakaria@unisza.edu.my','NOR HIDAYAH BINTI SULAIMAN','hidayahsulaiman@unisza.edu.my'],
      ['FKI','PROF. MADYA DR. SITI FATIMAH BINTI SALLEH','sitifatimah@unisza.edu.my','NOR SUHAIDA AMIRA BINTI MOHAMAD','nsuhaidaamira@unisza.edu.my'],
      ['FUPL','DR. MUHAMAD HAFIZUDDIN BIN GHANI','hafizuddinghani@unisza.edu.my','NOR NAJIHAN BINTI MAT RIFIN','najihanmrifin@unisza.edu.my'],
      ['FPP','DR. ROSMARIA BINTI JAFFAR @ HARUN','rosmaria@unisza.edu.my','MERISSA BINTI ABDUL AZIZ','merissaaziz@unisza.edu.my'],
      ['FP','DR. NOOR AZUIN BINTI SULIMAN','azuinsuliman@unisza.edu.my','NURUL AIDA BINTI HAMDAN','aidahamdan@unisza.edu.my'],
      ['FPV','DR. HUSNA FASIHAH BINTI MOHD YUSOFF','husnafasihah@unisza.edu.my','NOOR HAFIZAL BINTI ABDUL AZIS','noorhafizal@unisza.edu.my'],
      ['FRIT','PROF. MADYA TS. DR. YEW BEEN SEOK','bseokyew@unisza.edu.my','NORZILAYATI BINTI HARUN','norzilayati@unisza.edu.my'],
      ['FSK','DR. MOHD NIZAM BIN ZAHARY','nizamzahary@unisza.edu.my','WAN MAIMUNAH BINTI WAN AWANG','maimunahawang@unisza.edu.my'],
      ['FSSG','TS. DR. NOORJIMA BINTI ABD WAHAB','noorjimaabdwahab@unisza.edu.my','WAN FAZILA BINTI WAN OMAR @ WAN JOHOR','wanfazila@unisza.edu.my'],
      ['FUHA','DR. IYLLYANA BINTI CHE ROSLI','iyllyanarosli@unisza.edu.my','HAYATI BINTI ABD. HADI','hayatihadi@unisza.edu.my'],
      ['ESERI','PROF. MADYA DR. NORHAYATI BINTI NGAH','norhayatingah@unisza.edu.my','NURUL AFIQAH HAZLIN BINTI FAIRUS','afiqahazlin@unisza.edu.my'],
      ['INSPIRE','DR. NOORSAFUAN BIN CHE NOH','noorsafuancn@unisza.edu.my','NURUL NAJIHAH BINTI MAT SAMAN','najihahmsaman@unisza.edu.my'],
    ];
    rows.forEach(function(r) { pic.appendRow(r); });
    return ContentService.createTextOutput('PIC updated: ' + rows.length + ' faculties')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.oauthUrl = getOAuthUrl();
  template.oauthError = '';
  template.sessionEmail = '';
  template.sessionUser = '';
  template.deploymentUrl = ScriptApp.getService().getUrl();

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

  var user = getCurrentUser();
  if (user) {
    template.sessionEmail = user.email;
    template.sessionUser = JSON.stringify(user);
  }

  return template.evaluate()
    .setTitle('MQF 2.0 — Program Information')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function debugGetProgrammesApi() {
  var user = getCurrentUser();
  if (!user) return { error: 'Unauthorized' };
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
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return getProgrammes(user.role === 'Admin' ? null : user.faculty);
}

function getUniversityDashboardApi() {
  return getUniversityDashboardApi_();
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

function getPEOsApi(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-peos');
  return getPEOs(mqaCode);
}

function getPLOsApi(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-plos');
  return getPLOs(mqaCode);
}

function savePEOsApi(mqaCode, peos) {
  requireProgrammeAccess_(mqaCode, 'edit-peos');
  return savePEOs(mqaCode, peos);
}

function savePLOsApi(mqaCode, plos) {
  requireProgrammeAccess_(mqaCode, 'edit-plos');
  return savePLOs(mqaCode, plos);
}

function getGraphDataApi(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-graph');
  return getGraphData(mqaCode);
}

function getUploadedFilesApi(mqaCode) {
  requireProgrammeAccess_(mqaCode, 'view-documents');
  return getUploadedFiles(mqaCode);
}

function uploadFileApi(mqaCode, fileType, fileBlob) {
  requireProgrammeAccess_(mqaCode, 'upload-document');
  return uploadFile(mqaCode, fileType, fileBlob);
}

function suggestDeleteFileApi(fileId, mqaCode) {
  requireProgrammeAccess_(mqaCode, 'request-document-deletion');
  return suggestDeleteFile(fileId, mqaCode);
}

function approveDeleteFileApi(fileId) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  return approveDeleteFile(fileId);
}

function suggestAddProgrammeApi(programmeData) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return suggestAddProgramme(programmeData);
}

function suggestRemoveProgrammeApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return suggestRemoveProgramme(mqaCode);
}

function getPendingSuggestionsApi() {
  if (!isGraduateSchoolAdmin_(getCurrentUser())) throw new Error('Graduate School admin only');
  return getPendingSuggestions();
}

function approveSuggestionApi(rowIndex) {
  if (!isGraduateSchoolAdmin_(getCurrentUser())) throw new Error('Graduate School admin only');
  return approveSuggestion(rowIndex);
}

function rejectSuggestionApi(rowIndex, note) {
  if (!isGraduateSchoolAdmin_(getCurrentUser())) throw new Error('Graduate School admin only');
  return rejectSuggestion(rowIndex, note);
}

function getPendingDeletionsApi() {
  if (!isGraduateSchoolAdmin_(getCurrentUser())) throw new Error('Graduate School admin only');
  return getPendingDeletions();
}

/** One-time: create per-program tabs for all programmes from the Programme sheet */
function prepareAllSheetsApi() {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Programme sheet not found');
  var data = sheet.getDataRange().getValues();
  var created = [], skipped = [], errors = [];
  
  for (var i = 1; i < data.length; i++) {
    var mqaCode = String(data[i][2] || '').trim();
    if (!mqaCode) continue;
    
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
  
  return { created: created, skipped: skipped, errors: errors, total: data.length - 1 };
}

/** Send test announcement email (to fathurrahman@unisza.edu.my only) */
function sendTestAnnouncementApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser();
    if (!user || user.role !== 'Admin') throw new Error('Admin only');
    return sendTestAnnouncement();
  });
}

/** Send announcement to a specific faculty */
function sendAnnouncementApi(fac) {
  return withErrorHandling(function() {
    var user = getCurrentUser();
    if (!user || user.role !== 'Admin') throw new Error('Admin only');
    return sendAnnouncement(fac);
  });
}

/** Send announcement to all faculties */
function sendAllAnnouncementsApi() {
  return withErrorHandling(function() {
    var user = getCurrentUser();
    if (!user || user.role !== 'Admin') throw new Error('Admin only');
    return sendAllAnnouncements();
  });
}

/** Send announcement to selected faculties (JSON array string) */
function sendAnnouncementsByFacultyListApi(facList) {
  return withErrorHandling(function() {
    var user = getCurrentUser();
    if (!user || user.role !== 'Admin') throw new Error('Admin only');
    return sendAnnouncementsByFacultyList(facList);
  });
}
