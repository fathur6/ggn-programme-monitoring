function updatePICApi_(raw) {
  var user = getCurrentUser();
  if (!isGraduateSchoolAdmin_(user)) throw new Error('Graduate School admin only');
  var ss = getSpreadsheet();
  var pic = ss.getSheetByName('PIC');
  var rows = JSON.parse(raw);
  pic.clearContents();
  pic.appendRow(['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Faculty PIC', 'Faculty PIC Email']);
  rows.forEach(function(r) { pic.appendRow(r); });
  return 'OK: ' + rows.length + ' rows written';
}
