/** Auth.gs — User authentication and session handling */

var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';

function getCurrentUser() {
  var email = Session.getActiveUser().getEmail();
  if (!email || !email.endsWith('@unisza.edu.my')) {
    email = Session.getEffectiveUser().getEmail();
  }
  if (!email || !email.endsWith('@unisza.edu.my')) return null;

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Check PPS sheet (admin)
  var ppsSheet = ss.getSheetByName('PPS');
  if (ppsSheet) {
    var ppsData = ppsSheet.getDataRange().getValues();
    for (var i = 1; i < ppsData.length; i++) {
      if (ppsData[i][1] === email) {
        return { email: email, role: 'Admin', faculty: null, name: ppsData[i][0] };
      }
    }
  }

  // Check PIC sheet (faculty roles)
  var picSheet = ss.getSheetByName('PIC');
  if (picSheet) {
    var picData = picSheet.getDataRange().getValues();
    for (var i = 1; i < picData.length; i++) {
      if (picData[i][2] === email) {
        return { email: email, role: 'Graduate Coordinator', faculty: picData[i][0], name: picData[i][1] };
      }
      if (picData[i][4] === email) {
        return { email: email, role: 'Faculty PIC', faculty: picData[i][0], name: picData[i][3] };
      }
    }
  }

  return null;
}
