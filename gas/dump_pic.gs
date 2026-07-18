// Temporary debug — run via clasp
function dumpPIC() {
  var ss = getSpreadsheet();
  var pic = ss.getSheetByName('PIC');
  var data = pic.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    Logger.log(JSON.stringify(data[i]));
  }
  return data.slice(0,50).map(function(r){ return r.join(' | '); }).join('\n');
}
