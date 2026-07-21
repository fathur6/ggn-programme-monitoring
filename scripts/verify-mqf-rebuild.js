const fs = require('fs');
const childProcess = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assertContains(source, pattern, message) {
  assert(pattern.test(source), message);
}

const auth = read('gas/Auth.gs');
const code = read('gas/Code.gs');
const governance = read('gas/GovernanceService.gs');
const access = read('gas/AccessRequestService.gs');
const peo = read('gas/PEOService.gs');
const plo = read('gas/PLOService.gs');
const graph = read('gas/GraphService.gs');
const upload = read('gas/UploadService.gs');
const suggestions = read('gas/SuggestionsService.gs');
const email = read('gas/EmailService.gs');
const index = read('gas/Index.html');
const javascript = read('gas/JavaScript.html');
const styles = read('gas/Styles.html');
const readme = read('README.md');
const configExample = read('gas/Config.gs.example');
const claspExample = read('gas/.clasp.json.example');
const researchData = read('gas/ResearchDataService.gs');
const researchReferences = read('gas/ResearchReferenceService.gs');
const researchMapping = read('gas/ResearchMappingService.gs');
const researchReview = read('gas/ResearchReviewService.gs');
const researchDetailStart = index.indexOf("<div v-if=\"currentView === 'detail'");
const researchDetailSource = index.slice(researchDetailStart === -1 ? index.length : researchDetailStart);

[
  'gas/Index.html',
  'gas/JavaScript.html',
  'gas/Styles.html',
  'gas/Auth.gs',
  'gas/Code.gs',
  'gas/GovernanceService.gs',
  'gas/AccessRequestService.gs',
  'gas/PEOService.gs',
  'gas/PLOService.gs',
  'gas/GraphService.gs',
  'gas/UploadService.gs',
  'gas/SuggestionsService.gs',
  'gas/EmailService.gs',
  'gas/appsscript.json',
  'README.md',
  'scripts/test-mqf-overdue.js',
  'gas/ResearchDataService.gs',
  'gas/ResearchReferenceService.gs',
  'gas/ResearchMappingService.gs',
  'gas/ResearchReviewService.gs',
  'scripts/test-research-mapping.js',
  'scripts/test-coor-access.js'
].forEach(function(path) {
  assert(fs.existsSync(path), 'Required project file is missing: ' + path);
});
assertContains(researchMapping, /function\s+normalizeResearchPLO_\s*\(/, 'Research PLO normalization is missing');
assertContains(researchMapping, /function\s+validatePLOParents_\s*\(/, 'Research PLO parent validation is missing');
assertContains(researchMapping, /function\s+validateDuplicateCodes_\s*\(/, 'Research duplicate validation is missing');
assertContains(researchMapping, /function\s+getResearchProgrammeApi_\s*\(/, 'Research programme API is missing');
assertContains(researchMapping, /function\s+saveResearchProfileApi_\s*\(/, 'Research profile save API is missing');
assertContains(researchMapping, /function\s+getResearchPEOsApi_\s*\(/, 'Research PEO API is missing');
assertContains(researchMapping, /function\s+saveResearchPEOsApi_\s*\(/, 'Research PEO save API is missing');
assertContains(researchMapping, /function\s+getResearchPLOsApi_\s*\(/, 'Research PLO API is missing');
assertContains(researchMapping, /function\s+saveResearchPLOsApi_\s*\(/, 'Research PLO save API is missing');
assertContains(researchMapping, /function\s+getResearchMappingsApi_\s*\(/, 'Research mapping API is missing');
assertContains(researchReferences, /function\s+deriveTFIds_\s*\(/, 'TF derivation helper is missing');
assertContains(researchMapping, /function\s+calculatePEOCoverage_\s*\(/, 'PEO coverage helper is missing');
assertContains(researchMapping, /function\s+saveResearchPLOMappingApi_\s*\(/, 'PLO mapping save API is missing');
assertContains(researchMapping, /function\s+getResearchCoverageApi_\s*\(/, 'Research coverage API is missing');
assertContains(researchReview, /function\s+validateResearchProgramme_\s*\(/, 'Research review validation is missing');
assertContains(researchReview, /function\s+getResearchReviewApi_\s*\(/, 'Research review API is missing');
assertContains(researchReview, /function\s+saveResearchStatusApi_\s*\(/, 'Research status save API is missing');
assertContains(researchReview, /function\s+submitResearchProgrammeApi_\s*\(/, 'Research submission API is missing');
['critical', 'warnings', 'peoCoverage', 'ploTotal', 'mqfDomainCoverage', 'peosWithIssues'].forEach(function(marker) {
  assertContains(researchReview, new RegExp(marker), 'Research review output is missing: ' + marker);
});
assertContains(researchReview, /requireProgrammeAccess_\s*\(/, 'Research review APIs are not programme scoped');
assertContains(researchReview, /withResearchLock_\s*\(/, 'Research review mutations are not locked');
assertContains(researchReview, /updatedBy/, 'Research review audit field is missing');
assertContains(researchMapping, /Derived from PLO mappings/, 'Derived mapping label is missing');
assert(!/\b(getPEOs|savePEOs|getPLOs|savePLOs)\s*\(/.test(researchMapping), 'Research service calls legacy PEO/PLO services');
[
  'getResearchProgrammeApi_', 'saveResearchProfileApi_', 'getResearchPEOsApi_',
  'saveResearchPEOsApi_', 'getResearchPLOsApi_', 'saveResearchPLOsApi_', 'getResearchMappingsApi_',
  'saveResearchPLOMappingApi_', 'getResearchCoverageApi_'
].forEach(function(name) {
  assertContains(researchMapping, new RegExp('function\\s+' + name + '[\\s\\S]*?requireProgrammeAccess_\\s*\\('), name + ' is not guarded');
});
['getResearchReviewApi', 'saveResearchStatusApi', 'submitResearchProgrammeApi'].forEach(function(name) {
  assertContains(code, new RegExp('function\\s+' + name + '[\\s\\S]*?return\\s+' + name + '_'), name + ' wrapper is missing');
});
[
  'getResearchProgrammeApi', 'saveResearchProfileApi', 'getResearchPEOsApi',
  'saveResearchPEOsApi', 'getResearchPLOsApi', 'saveResearchPLOsApi', 'getResearchMappingsApi',
  'saveResearchPLOMappingApi', 'getResearchCoverageApi'
].forEach(function(name) {
  assertContains(code, new RegExp('function\\s+' + name + '[\\s\\S]*?return\\s+' + name + '_'), name + ' wrapper is missing');
});

const trackedFiles = childProcess.execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
assert(trackedFiles.indexOf('gas/Config.gs') === -1, 'Unsanitized Config.gs must remain untracked');
assert(trackedFiles.indexOf('gas/.clasp.json') === -1, 'Deployment clasp metadata must remain untracked');
['gas/Config.gs', 'gas/.clasp.json'].forEach(function(path) {
  childProcess.execFileSync('git', ['check-ignore', '-q', path]);
});
assert(!trackedFiles.some(function(path) { return path.indexOf('.superpowers/') === 0 || path.indexOf('graphify-out/') === 0; }), 'Generated project artifacts must not be tracked');
assertContains(configExample, /SHEET_ID:\s*['"]YOUR_SPREADSHEET_ID['"]/, 'Config example must use a spreadsheet placeholder');
assertContains(configExample, /GOOGLE_CLIENT_ID:\s*['"]YOUR_CLIENT_ID/, 'Config example must use a client ID placeholder');
assertContains(configExample, /GOOGLE_CLIENT_SECRET:\s*['"]YOUR_CLIENT_SECRET['"]/, 'Config example must use a client secret placeholder');
assertContains(configExample, /DRIVE_FOLDER_ID:\s*['"]YOUR_DRIVE_FOLDER_ID['"]/, 'Config example must use a Drive placeholder');
assertContains(claspExample, /YOUR_SCRIPT_ID/, 'clasp example must use a script ID placeholder');
['Required Deployment Configuration', 'Secure Backup And Recovery', 'Production Deployment Checklist', 'Secret-handling', 'Test Deployment Verification'].forEach(function(section) {
  assert(readme.indexOf(section) !== -1, 'README is missing deployment section: ' + section);
});

const doGetSource = code.slice(code.indexOf('function doGet'), code.indexOf('function include'));
assertContains(code, /function\s+hasDisabledLegacyRoute_\s*\(/, 'Legacy route guard is missing');
assertContains(code, /Endpoint disabled/, 'Disabled endpoints do not return a generic response');
assert(!/sendAllAnnouncements|sendAnnouncement|sendTestAnnouncement|clearContents|appendRow/.test(doGetSource), 'doGet still exposes a side-effect operation');
assertContains(code, /function\s+sendAllAnnouncementsApi[\s\S]*?isGraduateSchoolAdmin_/, 'Email API lacks backend admin authorization');
assertContains(code, /function\s+sendAnnouncementApi[\s\S]*?isGraduateSchoolAdmin_/, 'Faculty email API lacks backend admin authorization');
assertContains(code, /function\s+sendTestAnnouncementApi[\s\S]*?isGraduateSchoolAdmin_/, 'Test email API lacks backend admin authorization');
assertContains(code, /function\s+sendAnnouncementsByFacultyListApi[\s\S]*?isGraduateSchoolAdmin_/, 'Faculty-list email API lacks backend admin authorization');
['sendTestAnnouncement', 'sendAnnouncement', 'sendAllAnnouncements', 'sendAnnouncementsByFacultyList'].forEach(function(name) {
  assertContains(email, new RegExp('function\\s+' + name + '[\\s\\S]*?isGraduateSchoolAdmin_'), name + ' lacks direct backend admin authorization');
});
assertContains(code, /function\s+hasDisabledLegacyRoute_\s*\([\s\S]*?updatePIC/, 'PIC update legacy route is not disabled');
assertContains(code, /function\s+debugGetProgrammesApi[\s\S]*?isGraduateSchoolAdmin_/, 'Debug service lacks backend admin authorization');
assertContains(code, /function\s+approveDeleteFileApi\s*\(requestId\)/, 'Delete approval must use requestId');
assertContains(upload, /function\s+approveDeleteFile\s*\(requestId\)/, 'Delete service must use requestId');
assertContains(upload, /columns\.Status\]\)\s*!==\s*['"]Pending['"]/, 'Delete service must require Pending status');
assertContains(upload, /getParents\s*\(/, 'Delete service must verify file folder membership');
assertContains(upload, /RequestId/, 'Delete records must include a request ID');
assertContains(index, /approveDelete\(d\.requestId\)/, 'Admin UI must approve a deletion request by requestId');
assertContains(javascript, /approveDeleteFileApi\(requestId\)/, 'Client approval must send requestId');
assertContains(read('gas/dump_pic.gs'), /Endpoint disabled/, 'PIC dump utility must be disabled');
assertContains(governance, /var\s+ACADEMIC_DEADLINE\s*=\s*['"]2026-07-23T23:59:59\+08:00['"]/, 'Academic deadline constant is missing or incorrect');
assertContains(governance, /function\s+isProgrammeOverdue_\s*\(/, 'Overdue helper is missing');
assert(!/overdue\s*:\s*false/.test(governance), 'Overdue status is still hard-coded false');

assertContains(auth, /isGraduateSchoolAdmin_\s*\(/, 'Missing Graduate School admin capability helper');
assertContains(auth, /canViewProgramme_\s*\(/, 'Missing programme access helper');
assertContains(auth, /requireProgrammeAccess_\s*\(/, 'Missing programme access guard');
assertContains(auth, /capabilities\s*[:=]/, 'Current user does not expose normalized capabilities');
assertContains(auth, /var\s+coorSheet\s*=\s*ss\.getSheetByName\(['"]COOR['"]\)/, 'COOR sheet lookup is missing');
assertContains(auth, /coorData\[i\]\[2\].*trim\(\)\.toLowerCase\(\)\s*===\s*emailStr/, 'COOR lookup must normalize the third-column email');
assertContains(auth, /role:\s*['"]Faculty Coordinator['"]/, 'COOR lookup must return the Faculty Coordinator role');
assertContains(auth, /faculty:\s*coorFaculty.*name:\s*String\(coorData\[i\]\[1\]\s*\|\|\s*['"]['"]\)\.trim\(\)/, 'COOR lookup must return normalized faculty and display name');
assertContains(auth, /programme\.faculty\s*===\s*String\(user\.faculty\s*\|\|\s*['"]['"]\)\.trim\(\)/, 'Non-admin programme access must remain faculty scoped');

[
  'getPEOsApi',
  'savePEOsApi',
  'getPLOsApi',
  'savePLOsApi',
  'getGraphDataApi',
  'getUploadedFilesApi',
  'uploadFileApi',
  'suggestDeleteFileApi'
].forEach(function(name) {
  const endpoint = new RegExp('function\\s+' + name + '[\\s\\S]*?requireProgrammeAccess_\\s*\\(');
  assertContains(code, endpoint, name + ' is not guarded by requireProgrammeAccess_');
});

assertContains(code, /function\s+approveDeleteFileApi[\s\S]*?isGraduateSchoolAdmin_/, 'Admin delete endpoint is not Graduate School-admin guarded');
assertContains(governance, /function\s+ensureGovernanceSheets_\s*\(/, 'Missing additive governance sheet setup');
assertContains(governance, /function\s+getUniversityDashboardApi_\s*\(/, 'Missing university dashboard API implementation');
assertContains(governance, /function\s+computeResearchProgrammeStatus_\s*\([\s\S]*?getResearchReviewApi_\s*\(/, 'Research dashboard status does not use server review results');
assertContains(governance, /MQFDomainState/, 'Dashboard does not monitor MQF Domain state');
assertContains(governance, /TaxonomyState/, 'Dashboard does not monitor Taxonomy state');
assertContains(governance, /var complete = peoComplete && ploComplete && mqfComplete && taxonomyComplete && mappingComplete;/, 'Supporting documents must not block completion readiness');
assertContains(code, /function\s+getUniversityDashboardApi\s*\(/, 'Missing university dashboard API endpoint');
assertContains(access, /7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, 'Cross-faculty access does not expire after one week');
assertContains(access, /function\s+createAccessRequestApi_\s*\(/, 'Missing access request creation');
assertContains(access, /function\s+decideAccessRequestApi_\s*\(/, 'Missing access request decision');
assertContains(access, /function\s+revokeAccessGrantApi_\s*\(/, 'Missing access grant revocation');
assertContains(access, /getActiveAccessGrant_\s*\(/, 'Missing active access grant lookup');
assertContains(peo, /Kod dan penerangan PEO diperlukan/, 'PEO validation is missing');
assertContains(plo, /Kod dan penerangan PLO diperlukan/, 'PLO validation is missing');
assertContains(plo, /function\s+getNextPLOCode\s*\(/, 'Stable PLO code helper is missing');
assertContains(plo, /match\(\/\^PLO\\s\*\(\\d\+\)\$\//, 'PLO code helper does not inspect numeric suffixes');
assertContains(plo, /p\.embeddedPEO\s*\|\|\s*''\s*,\s*p\.taxonomy/, 'PLO persistence field order changed');
assertContains(graph, /'Taxonomy'/, 'Graph does not emit taxonomy nodes');
assertContains(graph, /type:\s*'classified_as'/, 'Graph does not emit classification edges');
assertContains(upload, /isGraduateSchoolAdmin_\(user\)/, 'File deletion is not Graduate School-admin guarded');
assertContains(suggestions, /isGraduateSchoolAdmin_\(user\)/, 'Suggestion admin operations are not Graduate School-admin guarded');
assertContains(code, /function\s+prepareAllSheetsApi[\s\S]*?isGraduateSchoolAdmin_/, 'Sheet preparation is not Graduate School-admin guarded');
assertContains(index, /class="app-nav"/, 'Persistent application navigation is missing');
assertContains(index, /currentView === 'dashboard'/, 'University dashboard view is missing');
assertContains(index, /Faculty readiness/, 'Faculty readiness dashboard is missing');
assertContains(javascript, /getUniversityDashboardApi\(\)/, 'Dashboard API is not loaded by the client');
assertContains(javascript, /function\(faculty\)/, 'Dashboard faculty completion helper is missing');
assertContains(styles, /--action-green/, 'Operational Clarity action token is missing');
[
  'researchCategory', 'researchProfile', 'researchPEOs', 'researchPLOs',
  'researchMappings', 'researchReferences', 'researchCoverage', 'researchReview',
  'researchStatus', 'researchDirty', 'researchSaveState'
].forEach(function(marker) {
  assertContains(javascript, new RegExp(marker), 'Research state is missing: ' + marker);
});
[
  'loadResearchWorkspace', 'saveResearchProfile', 'saveResearchPEOs', 'saveResearchPLOs',
  'saveResearchPLOMapping', 'loadResearchCoverage', 'loadResearchReview',
  'submitResearchProgramme', 'selectAllMQFDomains', 'toggleSDG', 'toggleSC', 'leaveResearchWorkspace'
].forEach(function(name) {
  assertContains(javascript, new RegExp(name + ':\\s*function\\s*\\('), 'Research client method is missing: ' + name);
});
assert(!/getPEOsApi\(|savePEOsApi\(|getPLOsApi\(|savePLOsApi\(/.test(javascript), 'Research client still calls legacy PEO/PLO APIs');
assertContains(index, /Save PEOs/, 'PEO save action is missing');
assertContains(index, /Save PLOs/, 'PLO save action is missing');
assertContains(index, /MQF domains/, 'MQF domain selector is missing');
assertContains(index, /Taxonomy/, 'Taxonomy label is missing');
assertContains(index, /Request temporary access/, 'Faculty access request workspace is missing');
assertContains(index, /createAccessRequest/, 'Access request action is missing from the UI');
assertContains(index, /Access requests/, 'Admin access request queue is missing');
assertContains(index, /Governance queue/, 'Admin governance queue is missing');
assertContains(javascript, /loadAccessRequests:\s*function\s*\(/, 'Access request loader is missing');
assertContains(javascript, /loadGovernanceItems:\s*function\s*\(/, 'Governance queue loader is missing');

assertContains(index, /Maklumat Program/, 'Programme Information category is missing');
assertContains(index, /Pemetaan/, 'Mapping category is missing');
assertContains(index, /PLO Workspace/, 'PLO workspace is missing');
assertContains(index, /Coverage Matrix/, 'Coverage matrix is missing');
assertContains(index, /TF derived from MQF mapping/, 'Derived TF label is missing');
assertContains(index, /Derived from PLO mappings/, 'PEO derived label is missing');
assert(!/Coursework|DCI|CLO|credit hour|Subject|Course Mapping/.test(researchDetailSource), 'Course-based UI remains in the research detail workspace');

[
  'PR_ProgrammeProfile',
  'PR_PEORecords',
  'PR_PLORecords',
  'PR_PLOMappings',
  'PR_MQFReference',
  'PR_TFReference',
  'PR_SDGReference',
  'PR_SCReference'
].forEach(function(name) {
  assertContains(researchData, new RegExp(name), 'Research sheet boundary is missing: ' + name);
});
assertContains(researchData, /ProgrammeId.*MQACode.*FacultyOrCentre.*ProgrammeName.*StudyLevel.*StudyMode.*StudyField.*Session.*DocumentVersion.*DataOwner.*MappingStatus.*CreatedAt.*UpdatedAt.*UpdatedBy/, 'Programme profile headers are incomplete');
assertContains(researchData, /function\s+ensureResearchSheets_\s*\([\s\S]*?getLastRow\(\)\s*===\s*0[\s\S]*?appendRow/, 'Research sheets are not created lazily');
assertContains(researchData, /LockService\.getScriptLock\(\)[\s\S]*?tryLock\(30000\)[\s\S]*?releaseLock/, 'Research sheet initialization is not locked');
assertContains(researchData, /function\s+getResearchProgrammeKey_\s*\(/, 'Research programme key helper is missing');
assertContains(researchData, /findProgrammeByMqaCode_\(mqaCode\)/, 'Research programme key does not use the programme directory');
assertContains(researchReferences, /TF1[\s\S]*?MQF1['"]\s*,\s*['"]MQF4a/, 'TF1 reference relationship is missing');
assertContains(researchReferences, /TF2[\s\S]*?MQF2['"]\s*,\s*['"]MQF3a['"]\s*,\s*['"]MQF3d['"]\s*,\s*['"]MQF3e/, 'TF2 reference relationship is missing');
assertContains(researchReferences, /TF3[\s\S]*?MQF3a['"]\s*,\s*['"]MQF3b['"]\s*,\s*['"]MQF3c['"]\s*,\s*['"]MQF3f/, 'TF3 reference relationship is missing');
assertContains(researchReferences, /TF4[\s\S]*?MQF3a['"]\s*,\s*['"]MQF3b['"]\s*,\s*['"]MQF4a['"]\s*,\s*['"]MQF4b['"]\s*,\s*['"]MQF5/, 'TF4 reference relationship is missing');
assertContains(researchReferences, /function\s+validateReferenceIds_\s*\([\s\S]*?Invalid reference ID/, 'Reference validation is missing');
assertContains(researchReferences, /getDataRange\(\)\.getValues\(\)/, 'Reference sheets are not read');
assertContains(researchReferences, /filter\(function\(row\)\s*\{\s*return row\.active;/, 'Inactive references are not filtered');
assertContains(researchReferences, /seedResearchReferenceSheets_/, 'Reference sheets are not safely initialized');
assertContains(researchReferences, /function\s+getResearchReferencesApi\s*\([\s\S]*?getCurrentUser\s*\(\)/, 'Research references API is not authenticated');
assert(!/Course|Subject|Credit|CLO|DCI/.test(researchData), 'Course fields are present in research headers');

console.log('MQF rebuild static checks passed.');
