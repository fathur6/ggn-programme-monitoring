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

function getProgrammesApi() {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return getProgrammes(user.role === 'Admin' ? null : user.faculty);
}

function getPEOsApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPEOs(mqaCode);
}

function getPLOsApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPLOs(mqaCode);
}

function savePEOsApi(mqaCode, peos) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return savePEOs(mqaCode, peos);
}

function savePLOsApi(mqaCode, plos) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return savePLOs(mqaCode, plos);
}

function getGraphDataApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getGraphData(mqaCode);
}

function getUploadedFilesApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getUploadedFiles(mqaCode);
}

function uploadFileApi(mqaCode, fileType, fileBlob) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return uploadFile(mqaCode, fileType, fileBlob);
}

function suggestDeleteFileApi(fileId, mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return suggestDeleteFile(fileId, mqaCode);
}

function approveDeleteFileApi(fileId) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
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
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPendingSuggestions();
}

function approveSuggestionApi(rowIndex) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return approveSuggestion(rowIndex);
}

function rejectSuggestionApi(rowIndex, note) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return rejectSuggestion(rowIndex, note);
}

function getPendingDeletionsApi() {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPendingDeletions();
}
