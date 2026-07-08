/** ProgrammeService.gs — Programme listing and filtering */

function getProgrammes(userFilterFaculty) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName('Programme');
  if (!sheet) throw new Error('Sheet "Programme" not found');
  var data = sheet.getDataRange().getValues();
  var columns = {
    name: 0,    // Program Name (Malay) — col A
    mqaCode: 1, // MQA Reference Code — col B
    nee: 2,     // NEC 2020 — col C
    progCode: 3,// Program Code — col D
    mode: 10,   // Mode of Study — col K (0-indexed)
    faculty: 11 // Faculty — col L
  };
  var programmes = [];
  for (var i = 1; i < data.length; i++) {
    var prog = {
      name: data[i][columns.name],
      mqaCode: data[i][columns.mqaCode],
      nee: data[i][columns.nee],
      progCode: data[i][columns.progCode],
      mode: data[i][columns.mode],
      faculty: data[i][columns.faculty]
    };
    if (userFilterFaculty && prog.faculty !== userFilterFaculty) continue;
    programmes.push(prog);
  }
  return programmes;
}
