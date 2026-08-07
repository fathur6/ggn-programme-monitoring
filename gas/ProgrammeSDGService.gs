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
    try { var parsed = JSON.parse(existing); if (Array.isArray(parsed) && parsed.length > 0) {
      // Check if PEO-SDG mappings already exist for this programme
      var peoMappings = researchRows_(sheets.PR_PEOMappings).filter(function(r) { return String(r[1]) === key && String(r[2] || '').trim(); });
      if (peoMappings.length > 0) return false;
    } } catch (e) {}
  }
  var defaults = getProgrammeSDGDefaults_(programme);
  if (!defaults.length) return false;
  row[11] = JSON.stringify(defaults);
  sheets.PR_ProgrammeProfile.getRange(index + 2, 12, 1, 1).setValues([[row[11]]]);

  // Assign the 3 SDGs to the last 3 PEOs only, one SDG per PEO
  var allPEOs = researchRows_(sheets.PR_PEORecords).filter(function(r) { return String(r[1]) === key; });
  if (allPEOs.length < 3) return true;
  var last3PEOs = allPEOs.slice(-3);
  var peoMappingRows = researchRows_(sheets.PR_PEOMappings);
  var user = getCurrentUser_() || {email: ''};
  var now = new Date();
  var assignments = matchSDGsToPEOs_(last3PEOs, defaults);
  assignments.forEach(function(assignment) {
    var peoId = assignment.peoId;
    var sdgId = assignment.sdgId;
    var existingMapping = peoMappingRows.filter(function(r) { return String(r[0]) === peoId && String(r[1]) === key; })[0];
    if (!existingMapping || !String(existingMapping[2] || '').trim()) {
      if (existingMapping) {
        var idx = peoMappingRows.indexOf(existingMapping);
        sheets.PR_PEOMappings.getRange(idx + 2, 3, 1, 1).setValues([[JSON.stringify([sdgId])]]);
      } else {
        sheets.PR_PEOMappings.appendRow([peoId, key, JSON.stringify([sdgId]), 'PPS default auto-assigned', now, user.email || '']);
      }
    }
  });
  return true;
}

var SDG_KEYWORD_MAP_ = {
  SDG1:  ['poverty', 'poor'],
  SDG2:  ['hunger', 'food', 'agriculture', 'nutrition', 'crop', 'farm'],
  SDG3:  ['health', 'medical', 'well-being', 'wellbeing', 'sports', 'fitness', 'disease', 'patient'],
  SDG4:  ['education', 'learning', 'knowledge', 'teaching', 'training', 'lifelong', 'self-development', 'professional development', 'continuous'],
  SDG5:  ['gender', 'women', 'equality', 'diversity', 'inclusive', 'diverse'],
  SDG6:  ['water', 'sanitation', 'clean water'],
  SDG7:  ['energy', 'renewable', 'clean energy'],
  SDG8:  ['economic', 'work', 'employment', 'management', 'business', 'tourism', 'entrepreneur', 'career', 'collaborat', 'teamwork', 'leadership', 'autonomy'],
  SDG9:  ['innovate', 'innovation', 'technology', 'industry', 'infrastructure', 'digital', 'method', 'technique', 'design', 'research method'],
  SDG10: ['inequality', 'equity', 'ethical', 'ethics', 'professional', 'social', 'community', 'access', 'responsible', 'values'],
  SDG11: ['city', 'urban', 'sustainable cities', 'heritage', 'civilization', 'civilisation', 'community development'],
  SDG12: ['consumption', 'production', 'resource', 'sustainable', 'sustainability', 'environment'],
  SDG13: ['climate', 'environmental', 'environment'],
  SDG14: ['marine', 'ocean', 'aquatic', 'fisheries', 'biodiversity', 'life below'],
  SDG15: ['land', 'forest', 'ecosystem', 'biodiversity', 'life on land'],
  SDG16: ['peace', 'justice', 'law', 'institution', 'governance', 'legal', 'islamic', 'shariah', 'syariah'],
  SDG17: ['partnership', 'global', 'international', 'cooperation', 'collaboration', 'language', 'arabic', 'english']
};

function sdgKeywordScore_(statement, sdgId) {
  var keywords = SDG_KEYWORD_MAP_[sdgId] || [];
  var lower = (statement || '').toLowerCase();
  return keywords.reduce(function(score, keyword) {
    return score + (lower.indexOf(keyword) !== -1 ? 1 : 0);
  }, 0);
}

function matchSDGsToPEOs_(peoRows, sdgIds) {
  // Greedy: for each PEO, find the best unmatched SDG by keyword score
  var used = {};
  return peoRows.map(function(peoRow) {
    var statement = String(peoRow[3] || peoRow[2] || ''); // col 3=statement (PR_PEORecords), col 2=legacy
    var bestSDG = '';
    var bestScore = -1;
    sdgIds.forEach(function(sdgId) {
      if (used[sdgId]) return;
      var score = sdgKeywordScore_(statement, sdgId);
      if (score > bestScore) {
        bestScore = score;
        bestSDG = sdgId;
      }
    });
    if (bestSDG) used[bestSDG] = true;
    if (!bestSDG) {
      // Fallback: assign first unused SDG
      bestSDG = sdgIds.filter(function(id) { return !used[id]; })[0] || sdgIds[0];
      if (bestSDG) used[bestSDG] = true;
    }
    return {peoId: String(peoRow[0]), sdgId: bestSDG};
  });
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

function seedAllPEOSDGDefaultsApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
  seedResearchReferencesNoLock_(sheets);
  var programmes = getProgrammes_().filter(isResearchProgramme_);
  var allWrites = [];
  var seeded = 0, skipped = 0;
  programmes.forEach(function(programme) {
    var key = getResearchProgrammeKey_(programme);
    var profileRows = researchRows_(sheets.PR_ProgrammeProfile).filter(function(r) { return String(r[0]) === key; });
    if (!profileRows.length) { skipped++; return; }
    var peoMappings = researchRows_(sheets.PR_PEOMappings).filter(function(r) { return String(r[1]) === key && String(r[2] || '').trim(); });
    if (peoMappings.length) { skipped++; return; }
    var defaults = getProgrammeSDGDefaults_(programme);
    if (!defaults.length) { skipped++; return; }
    var allPEOs = researchRows_(sheets.PR_PEORecords).filter(function(r) { return String(r[1]) === key; });
    if (allPEOs.length < 3) { skipped++; return; }
    var last3PEOs = allPEOs.slice(-3);
    var now = new Date();
    var assignments = matchSDGsToPEOs_(last3PEOs, defaults);
    assignments.forEach(function(a) {
      allWrites.push({kind: 'append', sheet: sheets.PR_PEOMappings, row: [a.peoId, key, JSON.stringify([a.sdgId]), 'PPS default bulk-seeded', now, user.email || '']});
    });
    seeded++;
  });
  if (allWrites.length > 0) {
    withResearchLockRetry_(function() {
      RESEARCH_ROWS_CACHE_ = {};
      allWrites.forEach(function(w) { w.sheet.appendRow(w.row); });
    });
  }
  return {seeded: seeded, skipped: skipped, total: programmes.length};
}

var PLO_MQF_TO_SC_ = {
  MQF1:  'SC1',
  MQF2:  'SC3',
  MQF3a: 'SC5',
  MQF3b: 'SC5',
  MQF3c: 'SC6',
  MQF3d: 'SC6',
  MQF3e: 'SC4',
  MQF3f: 'SC7',
  MQF4a: 'SC7',
  MQF4b: 'SC4',
  MQF5:  'SC8'
};

var PLO_SC_KEYWORD_MAP_ = {
  SC1:  ['system', 'interconnect', 'holistic', 'complex system', 'synthesise', 'synthesize', 'integrate knowledge'],
  SC2:  ['anticipat', 'forecast', 'future', 'scenario', 'predict', 'foresight', 'vision'],
  SC3:  ['critical', 'evaluat', 'analys', 'assess', 'judge', 'reasoning', 'apprais', 'interpret'],
  SC4:  ['strategic', 'plan', 'design', 'develop', 'implement', 'create', 'entrepreneur', 'manage', 'leader'],
  SC5:  ['collaborat', 'team', 'interpersonal', 'communicat', 'social skill', 'group', 'negotiate', 'network'],
  SC6:  ['problem.solving', 'resolv', 'solution', 'digital', 'numerical', 'quantitative', 'method', 'technique', 'tool', 'data'],
  SC7:  ['self', 'autonomy', 'independent', 'lifelong', 'personal', 'continuous', 'self.develop', 'self.direct', 'adapt'],
  SC8:  ['ethic', 'value', 'norm', 'professional', 'integrity', 'accountab', 'responsib']
};

function matchPLOToSC_(plo) {
  var mqfDomains = plo.mqfDomains || [];
  var statement = String(plo.statement || '').toLowerCase();
  // Start with MQF-based default
  var defaultSC = '';
  for (var i = 0; i < mqfDomains.length; i++) {
    var sc = PLO_MQF_TO_SC_[mqfDomains[i]];
    if (sc) { defaultSC = sc; break; }
  }
  if (!defaultSC) return 'SC3';
  // Keyword-refine: check if another SC scores significantly higher
  var candidates = Object.keys(PLO_SC_KEYWORD_MAP_);
  var bestSC = defaultSC;
  var bestScore = -1;
  for (var c = 0; c < candidates.length; c++) {
    var scId = candidates[c];
    var keywords = PLO_SC_KEYWORD_MAP_[scId] || [];
    var score = keywords.reduce(function(s, kw) { return s + (statement.indexOf(kw) !== -1 ? 1 : 0); }, 0);
    if (score > bestScore) { bestScore = score; bestSC = scId; }
  }
  // Only override if keyword match is clearly better (2+ points above default)
  if (bestSC !== defaultSC) {
    var defaultScore = (PLO_SC_KEYWORD_MAP_[defaultSC] || []).reduce(function(s, kw) { return s + (statement.indexOf(kw) !== -1 ? 1 : 0); }, 0);
    if (bestScore <= defaultScore + 1) bestSC = defaultSC;
  }
  return bestSC;
}

function seedAllPLOSCDefaultsApi_() {
  var user = getCurrentUser_();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var sheets = ensureResearchSheetsNoLock_(getSpreadsheet());
  seedResearchReferencesNoLock_(sheets);
  var programmes = getProgrammes_().filter(isResearchProgramme_);
  var allWrites = [];
  var seeded = 0, skipped = 0;
  var now = new Date();
  programmes.forEach(function(programme) {
    var key = getResearchProgrammeKey_(programme);
    var allPLOs = researchRows_(sheets.PR_PLORecords).filter(function(r) { return String(r[1]) === key; });
    if (!allPLOs.length) { skipped++; return; }
    allPLOs.forEach(function(ploRow) {
      var ploId = String(ploRow[0]);
      var existingMapping = researchRows_(sheets.PR_PLOMappings).filter(function(r) { return String(r[0]) === ploId && String(r[1]) === key; })[0];
      var existingSC = existingMapping ? String(existingMapping[2] || '').trim() : '';
      if (existingSC && existingSC !== '[]') return;
      var mqfDomains = parseResearchJson_(ploRow[5]);
      var scId = matchPLOToSC_({mqfDomains: mqfDomains, statement: ploRow[4]});
      if (existingMapping) {
        var idx = researchRows_(sheets.PR_PLOMappings).indexOf(existingMapping);
        allWrites.push({kind: 'update', sheet: sheets.PR_PLOMappings, row: idx + 2, col: 3, value: JSON.stringify([scId])});
      } else {
        allWrites.push({kind: 'append', sheet: sheets.PR_PLOMappings, row: [ploId, key, JSON.stringify([scId]), '[]', 'PPS default auto-assigned', now, user.email || '']});
      }
      seeded++;
    });
  });
  // Batch all writes under one brief lock
  if (allWrites.length > 0) {
    withResearchLockRetry_(function() {
      RESEARCH_ROWS_CACHE_ = {};
      allWrites.forEach(function(w) {
        if (w.kind === 'update') w.sheet.getRange(w.row, w.col, 1, 1).setValues([[w.value]]);
        else w.sheet.appendRow(w.row);
      });
    });
  }
  return {seeded: seeded, skipped: skipped, total: programmes.length};
}
