function updatePICApi(raw) {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Unauthorized');
  var ss = getSpreadsheet();
  var pic = ss.getSheetByName('PIC');
  var rows = JSON.parse(raw);
  pic.clearContents();
  pic.appendRow(['Faculty', 'Graduate Coordinator', 'Graduate Coordinator Email', 'Faculty PIC', 'Faculty PIC Email']);
  rows.forEach(function(r) { pic.appendRow(r); });
  return 'OK: ' + rows.length + ' rows written';
}
