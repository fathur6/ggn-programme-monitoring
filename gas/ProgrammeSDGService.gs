/** ProgrammeSDGService.gs — Per-programme PPS-default SDG assignments. */

var PROGRAMME_SDG_DEFAULTS_ = {
  'MQA/FA5581|FKI':      ['SDG4', 'SDG16', 'SDG10'],
  'MQA/FA5582|FKI':      ['SDG4', 'SDG5', 'SDG10'],
  'MQA/FA5585|FKI':      ['SDG4', 'SDG16', 'SDG10'],
  'MQA/FA14263|FKI':     ['SDG4', 'SDG5', 'SDG10'],
  'MQA/FA5586|FPP':      ['SDG8', 'SDG9', 'SDG12'],
  'MQA/FA12015|FPP':     ['SDG8', 'SDG10', 'SDG1'],
  'MQA/FA10911|FPP':     ['SDG8', 'SDG1', 'SDG10'],
  'MQA/FA10912|FPP':     ['SDG8', 'SDG16', 'SDG12'],
  'MQA/FA10899|FPP':     ['SDG8', 'SDG9', 'SDG12'],
  'MQA/FA5587|FPP':      ['SDG8', 'SDG9', 'SDG12'],
  'MQA/FA12016|FPP':     ['SDG8', 'SDG10', 'SDG1'],
  'MQA/FA10901|FPP':     ['SDG8', 'SDG1', 'SDG10'],
  'MQA/FA12017|FPP':     ['SDG8', 'SDG16', 'SDG12'],
  'MQA/FA10900|FPP':     ['SDG8', 'SDG9', 'SDG12'],
  'MQA/FA5592|FUHA':     ['SDG16', 'SDG17', 'SDG10'],
  'MQA/FA5593|FUHA':     ['SDG16', 'SDG5', 'SDG10'],
  'MQA/FA6149|FUHA':     ['SDG8', 'SDG16', 'SDG12'],
  'MQA/FA5048|FUHA':     ['SDG16', 'SDG5', 'SDG10'],
  'MQA/FA10523|FUHA':    ['SDG10', 'SDG16', 'SDG5'],
  'MQA/FA5571|FBK':      ['SDG4', 'SDG10', 'SDG17'],
  'MQA/FA5572|FBK':      ['SDG4', 'SDG10', 'SDG17'],
  'MQA/FA5573|FBK':      ['SDG4', 'SDG10', 'SDG17'],
  'MQA/FA5574|FBK':      ['SDG4', 'SDG10', 'SDG17'],
  'MQA/FA10914|FRIT':    ['SDG4', 'SDG9', 'SDG11'],
  'MQA/FA5588|FRIT':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA5029|FRIT':     ['SDG9', 'SDG11', 'SDG7'],
  'MQA/FA10916|FRIT':    ['SDG9', 'SDG12', 'SDG8'],
  'MQA/FA10915|FRIT':    ['SDG4', 'SDG9', 'SDG11'],
  'MQA/FA5589|FRIT':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA10913|FRIT':    ['SDG9', 'SDG11', 'SDG7'],
  'MQA/FA10917|FRIT':    ['SDG9', 'SDG12', 'SDG8'],
  'MQA/FA5575|FIK':      ['SDG9', 'SDG4', 'SDG8'],
  'MQA/FA10908|FIK':     ['SDG4', 'SDG9', 'SDG8'],
  'MQA/FA5576|FIK':      ['SDG9', 'SDG4', 'SDG8'],
  'MQA/FA10910|FIK':     ['SDG4', 'SDG9', 'SDG8'],
  'MQA/FA10909|FIK':     ['SDG4', 'SDG9', 'SDG8'],
  'MQA/FA5588|FBIM':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA12018|FBIM':    ['SDG3', 'SDG14', 'SDG15'],
  'MQA/FA15710|FBIM':    ['SDG2', 'SDG3', 'SDG12'],
  'MQA/FA5594|FBIM':     ['SDG2', 'SDG15', 'SDG13'],
  'MQA/FA5589|FBIM':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA12019|FBIM':    ['SDG3', 'SDG14', 'SDG15'],
  'MQA/PA12020|FBIM':    ['SDG2', 'SDG3', 'SDG12'],
  'MQA/FA5595|FBIM':     ['SDG2', 'SDG15', 'SDG13'],
  'MQA/FA7492|FBIM':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA7493|FBIM':     ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA5590|FP':       ['SDG3', 'SDG10', 'SDG4'],
  'MQA/PA09374|FP':      ['SDG3', 'SDG8', 'SDG11'],
  'MQA/FA5591|FP':       ['SDG3', 'SDG10', 'SDG4'],
  'MQA/PA09375|FP':      ['SDG3', 'SDG8', 'SDG11'],
  'MQA/FA5590|FSK':      ['SDG3', 'SDG10', 'SDG4'],
  'MQA/FA10906|FSK':     ['SDG3', 'SDG4', 'SDG5'],
  'MQA/FA5591|FSK':      ['SDG3', 'SDG10', 'SDG4'],
  'MQA/FA10907|FSK':     ['SDG3', 'SDG4', 'SDG5'],
  'MQA/FA5583|FSSG':     ['SDG10', 'SDG16', 'SDG5'],
  'MQA/FA10902|FSSG':    ['SDG1', 'SDG10', 'SDG3'],
  'MQA/FA10904|FSSG':    ['SDG8', 'SDG11', 'SDG12'],
  'MQA/FA10523|FSSG':    ['SDG10', 'SDG16', 'SDG5'],
  'MQA/FA10903|FSSG':    ['SDG1', 'SDG10', 'SDG3'],
  'MQA/FA10905|FSSG':    ['SDG8', 'SDG11', 'SDG12'],
  'MQA/FA5590|FF':       ['SDG3', 'SDG9', 'SDG4'],
  'MQA/FA5591|FF':       ['SDG3', 'SDG9', 'SDG4'],
  'MQA/FA5588|ESERI':    ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA7492|ESERI':    ['SDG13', 'SDG6', 'SDG14'],
  'MQA/FA5589|ESERI':    ['SDG13', 'SDG14', 'SDG15'],
  'MQA/FA7493|ESERI':    ['SDG13', 'SDG6', 'SDG14'],
  'MQA/FA9287|INSPIRE':  ['SDG4', 'SDG16', 'SDG11'],
  'MQA/FA9288|INSPIRE':  ['SDG4', 'SDG16', 'SDG11']
};

function getProgrammeSDGKey_(programme, mqaCode) {
  var faculty = String(programme && programme.faculty || '').trim();
  var code = String(mqaCode || programme && programme.mqaCode || '').trim();
  return code && faculty ? (code + '|' + faculty) : '';
}

function getProgrammeSDGDefaults_(programme, mqaCode) {
  var key = getProgrammeSDGKey_(programme, mqaCode);
  var defaults = key && PROGRAMME_SDG_DEFAULTS_[key];
  return Array.isArray(defaults) ? defaults.slice() : [];
}

function ensureProgrammeSDGDefaults_(key, programme, sheets) {
  var profileRows = researchRows_(sheets.PR_ProgrammeProfile);
  var index = profileRows.findIndex(function(row) { return String(row[0]) === key; });
  if (index === -1) return false;
  var row = profileRows[index].slice();
  var existing = row[11];
  if (typeof existing === 'string' && existing.trim()) {
    try { var parsed = JSON.parse(existing); if (Array.isArray(parsed) && parsed.length > 0) return false; } catch (e) {}
  }
  var defaults = getProgrammeSDGDefaults_(programme);
  if (!defaults.length) return false;
  row[11] = JSON.stringify(defaults);
  sheets.PR_ProgrammeProfile.getRange(index + 2, 12, 1, 1).setValues([[row[11]]]);

  var allPEOs = researchRows_(sheets.PR_PEORecords).filter(function(r) { return String(r[1]) === key; });
  var peoMappingRows = researchRows_(sheets.PR_PEOMappings);
  var user = getCurrentUser_() || {email: ''};
  var now = new Date();
  allPEOs.forEach(function(peoRow) {
    var peoId = String(peoRow[0]);
    var exists = peoMappingRows.some(function(r) { return String(r[0]) === peoId && String(r[1]) === key; });
    if (!exists) {
      sheets.PR_PEOMappings.appendRow([peoId, key, JSON.stringify(defaults), 'PPS default auto-applied', now, user.email || '']);
    }
  });
  return true;
}

function setSharedMQAOwnerApi_(mqaCode, newOwnerProgrammeId) {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var code = String(mqaCode || '').trim();
  var owner = String(newOwnerProgrammeId || '').trim();
  if (!code || !owner) throw new Error('MQA code and owner programme ID are required');
  var existing = SHARED_MQA_OWNERS_[code];
  if (!existing) throw new Error('MQA code is not a shared code: ' + code);
  return withResearchLockRetry_(function() {
    var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
    var profileRows = researchRows_(sheets.PR_ProgrammeProfile);
    var updated = 0;
    profileRows.forEach(function(row, index) {
      if (String(row[1]).trim() === code && String(row[12] || '').trim()) {
        sheets.PR_ProgrammeProfile.getRange(index + 2, 13, 1, 1).setValues([[owner]]);
        RESEARCH_ROWS_CACHE_ = {};
        updated++;
      }
    });
    return {mqaCode: code, previousOwner: existing, newOwner: owner, sharedProgrammesUpdated: updated};
  });
}
function getProgrammeSDGDefaultsApi_(mqaCode) {
  if (!getCurrentUser_()) throw new Error('Unauthorized');
  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme) return {sdgIds: [], source: 'PPS default'};
  var sdgIds = getProgrammeSDGDefaults_(programme);
  return {sdgIds: sdgIds, source: 'PPS default'};
}
