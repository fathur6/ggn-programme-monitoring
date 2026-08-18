/** ProgrammePdfService.gs — Generate a PDF of the programme information, save it into the programme Drive folder, and return a download link. */

function generateProgrammePdfApi_(programmeIdOrMqaCode) {
  requireResearchProgrammeAccess_(programmeIdOrMqaCode, 'view-programme');
  var programme = researchProgramme_(programmeIdOrMqaCode);
  var ss = getSpreadsheet();
  var mqaCode = String(programme.mqaCode || '').trim();

  return withResearchLockRetry_(function() {
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    var key = getResearchProgrammeKey_(programme);
    var effectiveKey = researchEffectiveKey_(key, researchSheets);
    var tabValues = autoDetailTabValuesFromSpreadsheet_(ss, mqaCode);
    // Reuse the same data the dashboard/review uses: PR_ rows overridden by the
    // programme tab cells (PPS default or faculty alignment).
    var data = researchReviewDataFromSheets_(effectiveKey, researchSheets, references, mqaCode, tabValues);

    var html = buildProgrammePdfHtml_(programme, data);
    var blob = HtmlService.createHtmlOutput(html).getAs('application/pdf');

    var now = new Date();
    var fileName = mqaCode + '-ProgrammeInfo-' + formatProgrammePdfDate_(now) + '.pdf';
    var folder = getProgramFolder_(mqaCode);
    var file = folder.createFile(blob);
    file.setName(fileName);
    return {
      id: file.getId(),
      name: fileName,
      url: file.getUrl(),
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
    };
  });
}

function formatProgrammePdfDate_(now) {
  var dd = ('0' + now.getDate()).slice(-2);
  var MM = ('0' + (now.getMonth() + 1)).slice(-2);
  var yy = now.getFullYear();
  var hh = ('0' + now.getHours()).slice(-2);
  var mm = ('0' + now.getMinutes()).slice(-2);
  return dd + MM + yy + '-' + hh + mm;
}

function buildProgrammePdfHtml_(programme, data) {
  var peos = data.peos || [];
  var plos = data.plos || [];
  var peoSdgById = {};
  (data.peoSDGMappings || []).forEach(function(m) { peoSdgById[String(m.peoId)] = m.sdgIds || []; });
  var mappingByPloId = {};
  (data.mappings || []).forEach(function(m) { mappingByPloId[String(m.ploId)] = m; });

  var esc = function(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  var rows = [];
  rows.push('<h1>' + esc(programme.name || '') + '</h1>');
  rows.push('<p class="muted">' + esc(programme.mqaCode || '') + ' · ' + esc(programme.progCode || '') + ' · ' + esc(programme.level || '') + ' · Postgraduate by Research</p>');

  rows.push('<h2>Program Educational Objectives (PEO)</h2>');
  rows.push('<table><tr><th>Code</th><th>Statement</th><th>SDG</th></tr>');
  peos.forEach(function(peo) {
    var sdgs = (peoSdgById[String(peo.peoId)] || []).join(', ');
    rows.push('<tr><td>' + esc(peo.code) + '</td><td>' + esc(peo.statement) + '</td><td>' + esc(sdgs) + '</td></tr>');
  });
  rows.push('</table>');

  rows.push('<h2>Programme Learning Outcomes (PLO)</h2>');
  rows.push('<table><tr><th>Code</th><th>Statement</th><th>Parent PEO</th><th>MQF</th><th>Taxonomy</th><th>SC</th><th>TF</th></tr>');
  plos.forEach(function(plo) {
    var mapping = mappingByPloId[String(plo.ploId)] || {};
    var sc = (mapping.scIds || []).join(', ');
    var tf = (mapping.tfIds || mapping.derivedTFIds || []).join(', ');
    rows.push('<tr><td>' + esc(plo.code) + '</td><td>' + esc(plo.statement) + '</td><td>' + esc(plo.parentPEO) + '</td><td>' + esc((plo.mqfDomains || []).join(', ')) + '</td><td>' + esc(plo.taxonomy) + '</td><td>' + esc(sc) + '</td><td>' + esc(tf) + '</td></tr>');
  });
  rows.push('</table>');

  rows.push('<p class="footer">Generated: ' + new Date().toISOString() + '</p>');

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#1f2430;margin:24px;}' +
    'h1{font-size:18px;margin:0 0 4px;} .muted{color:#6b7280;margin:0 0 16px;}' +
    'h2{font-size:13px;margin:18px 0 6px;border-bottom:2px solid #1f2430;padding-bottom:4px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
    'th,td{border:1px solid #c9ccd4;padding:5px 7px;text-align:left;vertical-align:top;}' +
    'th{background:#eef1f6;font-weight:bold;}' +
    '.footer{color:#9aa0ac;font-size:10px;margin-top:20px;}' +
    '</style></head><body>' + rows.join('') + '</body></html>';
}
