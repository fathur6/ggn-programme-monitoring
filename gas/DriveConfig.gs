/** DriveConfig.gs — Google Drive folder configuration and lookup */

function getProgramFolder(mqaCode) {
  var root = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var folders = root.getFoldersByName(mqaCode);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(mqaCode);
}
