/** ProgrammeService.gs — Programme listing and filtering */

var PROGRAMMES_CACHE_ = null;

function getProgrammes_(userFilterFaculty) {
  if (PROGRAMMES_CACHE_) return filterProgrammesByFaculty_(PROGRAMMES_CACHE_, userFilterFaculty);
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Sheet "Programme" not found');
  var data = sheet.getDataRange().getValues();
  var columns = {
    nameMy: 0,  // Malay name — col A
    name: 1,    // English name — col B
    mqaCode: 2, // MQA Reference Code — col C
    nee: 3,     // NEC 2020 — col D
    progCode: 4,// Program Code — col E
    faculty: 7  // Faculty abbrev — col H (matches PIC sheet)
  };
  var programmes = [];
  for (var i = 1; i < data.length; i++) {
    var prog = {
      name: data[i][columns.name] || data[i][columns.nameMy],
      nameMy: data[i][columns.nameMy],
      mqaCode: data[i][columns.mqaCode],
      nee: data[i][columns.nee],
      progCode: data[i][columns.progCode],
      faculty: String(data[i][columns.faculty] || '').trim(),
      facultyFull: String(data[i][6] || '').trim(),
      level: detectLevel(data[i][columns.name] || data[i][columns.nameMy]),
      mode: String(data[i][10] || '').trim(),
      researchDetail: hasResearchDetailSheet_(ss, data[i][columns.mqaCode])
    };
    prog.programmeId = programmeIdentity_(prog);
    programmes.push(prog);
  }
  PROGRAMMES_CACHE_ = programmes;
  return filterProgrammesByFaculty_(programmes, userFilterFaculty);
}

function filterProgrammesByFaculty_(programmes, userFilterFaculty) {
  if (!userFilterFaculty) return programmes;
  var faculty = String(userFilterFaculty).trim();
  return programmes.filter(function(programme) { return programme.faculty === faculty; });
}

function hasResearchDetailSheet_(ss, mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!/^MQA\/(?:FA|PA)\d+$/i.test(code)) return false;
  // The supplied workbook defines MQA/FA... and MQA/PA... tabs as programme-detail tabs.
  return !!ss.getSheetByName(code);
}

function isResearchProgramme_(programme) {
  if (!programme) return false;
  var mode = String(programme.mode || '').trim().toLowerCase();
  if (mode) return mode === 'research' || mode === 'postgraduate by research';
  return programme.researchDetail === true;
}

function findProgrammeByMqaCode_(mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!code) return null;
  var programmes = getProgrammes_(null);
  for (var i = 0; i < programmes.length; i++) {
    if (String(programmes[i].mqaCode).trim() === code) return programmes[i];
  }
  return null;
}

function findProgrammesByMqaCode_(mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!code) return [];
  return getProgrammes_(null).filter(function(programme) {
    return String(programme.mqaCode || '').trim() === code;
  });
}

function programmeIdentity_(programme) {
  return [
    String(programme && programme.faculty || '').trim(),
    String(programme && programme.progCode || '').trim(),
    String(programme && programme.mqaCode || '').trim()
  ].join('::');
}

function findProgrammeByIdentity_(programmeId) {
  var identity = String(programmeId || '').trim();
  if (!identity) return null;
  var programmes = getProgrammes_(null);
  for (var i = 0; i < programmes.length; i++) {
    if (String(programmes[i].programmeId || programmeIdentity_(programmes[i])).trim() === identity) return programmes[i];
  }
  return null;
}

function resolveProgramme_(programmeIdOrMqaCode) {
  return findProgrammeByIdentity_(programmeIdOrMqaCode) || findProgrammeByMqaCode_(programmeIdOrMqaCode);
}

function detectLevel(name) {
  var n = String(name || '').toLowerCase();
  if (n.indexOf('doktor falsafah') > -1 || n.indexOf('doktor') > -1 || n.indexOf('doctor') > -1 ||
      n.indexOf('doctoral') > -1 || n.indexOf('doctorate') > -1 ||
      n.indexOf('ph.d') > -1 || n.indexOf('phd') > -1) return 'Doctorate';
  if (n.indexOf('master') > -1 || n.indexOf('sarjana') > -1) return 'Masters';
  return 'Other';
}
