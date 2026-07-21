/** ProgrammeService.gs — Programme listing and filtering */

function getProgrammes(userFilterFaculty) {
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
      level: detectLevel(data[i][columns.name]),
      mode: String(data[i][10] || '').trim()
    };
    if (userFilterFaculty && prog.faculty !== String(userFilterFaculty).trim()) continue;
    programmes.push(prog);
  }
  return programmes;
}

function isResearchProgramme_(programme) {
  if (!programme) return false;
  if (programme.research === true) return true;
  var mode = String(programme.mode || '').trim().toLowerCase();
  if (mode) return mode === 'research' || mode === 'postgraduate by research';
  var level = String(programme.level || '').trim().toLowerCase();
  return level === 'masters' || level === 'master' || level === 'doctorate' || level === 'doctoral';
}

function findProgrammeByMqaCode_(mqaCode) {
  var code = String(mqaCode || '').trim();
  if (!code) return null;
  var programmes = getProgrammes(null);
  for (var i = 0; i < programmes.length; i++) {
    if (String(programmes[i].mqaCode).trim() === code) return programmes[i];
  }
  return null;
}

function detectLevel(name) {
  var n = String(name).toLowerCase();
  if (n.indexOf('doctor') > -1 || n.indexOf('doktor') > -1) return 'Doctorate';
  if (n.indexOf('master') > -1 || n.indexOf('sarjana') > -1) return 'Masters';
  return 'Other';
}
