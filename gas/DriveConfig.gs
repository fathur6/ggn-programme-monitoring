/** DriveConfig.gs — Google Drive folder configuration and lookup */

var DRIVE_ROOT_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';

function getProgramFolder(mqaCode) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  var folders = root.getFoldersByName(mqaCode);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(mqaCode);
}
