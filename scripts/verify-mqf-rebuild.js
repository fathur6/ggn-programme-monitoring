const fs = require('fs');
const childProcess = require('child_process');
const nodeAssert = require('assert');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assertContains(source, pattern, message) {
  assert(pattern.test(source), message);
}

function hasLegacySingularMQFControl(source) {
  return /<(?:input|select|textarea)\b[^>]*(?:\bv-model(?:\.[\w-]+)*|:value|\bv-bind:value)\s*=\s*["']\s*(?:(?:(?:[A-Za-z_$][\w$]*\s*(?:(?:\.\s*[A-Za-z_$][\w$]*)|(?:\[\s*['"][^'"]+['"]\s*\]))*\s*\.\s*)?)mqfDomain|(?:[A-Za-z_$][\w$]*\s*(?:(?:\.\s*[A-Za-z_$][\w$]*)|(?:\[\s*['"][^'"]+['"]\s*\]))*\s*)\[\s*['"]mqfDomain['"]\s*\])\s*["'][^>]*>/i.test(source);
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
const researchDataApi = new Function(researchData + '\nreturn RESEARCH_SHEET_HEADERS;')();
const researchReferenceApi = new Function(researchReferences + '\nreturn RESEARCH_REFERENCE_SEEDS_;')();
const researchMapping = read('gas/ResearchMappingService.gs');
const researchReview = read('gas/ResearchReviewService.gs');
const programmeService = read('gas/ProgrammeService.gs');

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
  'gas/ProgrammeService.gs',
  'scripts/test-research-mapping.js',
  'scripts/test-research-mapping-client.js',
  'scripts/test-coor-access.js'
].forEach(function(path) {
  assert(fs.existsSync(path), 'Required project file is missing: ' + path);
});
assertContains(researchMapping, /function\s+uniqueTrimmed_\s*\(/, 'Shared trimming helper is missing');
assertContains(researchMapping, /function\s+deriveTFIds_\s*\(/, 'TF derivation helper is missing');
assertContains(researchMapping, /function\s+canonicalResearchTaxonomy_\s*\(/, 'Taxonomy canonicalization helper is missing');
assertContains(researchMapping, /function\s+normalizeResearchPEO_\s*\(/, 'Research PEO normalization is missing');
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

assertContains(researchMapping, /function\s+calculatePEOCoverage_\s*\(/, 'PEO coverage helper is missing');
assertContains(researchMapping, /function\s+saveResearchPLOMappingApi_\s*\(/, 'PLO mapping save API is missing');
assertContains(researchMapping, /function\s+getResearchCoverageApi_\s*\(/, 'Research coverage API is missing');
assertContains(researchReview, /function\s+validateResearchProgramme_\s*\(/, 'Research review validation is missing');
assertContains(researchReview, /function\s+getResearchReviewApi_\s*\(/, 'Research review API is missing');
assertContains(researchReview, /function\s+saveResearchStatusApi_\s*\(/, 'Research status save API is missing');
assertContains(researchReview, /function\s+submitResearchProgrammeApi_\s*\(/, 'Research submission API is missing');
assertContains(researchReview, /function\s+isLegalResearchStatusTransition_\s*\(/, 'Research status transition legality check is missing');
assertContains(researchReview, /function\s+researchReviewAdmin_\s*\(/, 'Research review admin check is missing');
['critical', 'warnings', 'peoCoverage', 'ploTotal', 'mqfDomainCoverage', 'peosWithIssues'].forEach(function(marker) {
  assertContains(researchReview, new RegExp(marker), 'Research review output is missing: ' + marker);
});
assertContains(researchReview, /requireProgrammeAccess_\s*\(/, 'Research review APIs are not programme scoped');
assertContains(researchReview, /withResearchLock_\s*\(/, 'Research review mutations are not locked');
assertContains(researchReview, /updatedBy/, 'Research review audit field is missing');
assertContains(researchReview, /function\s+submitResearchProgrammeApi_[\s\S]*?validateResearchProgramme_\(/, 'Submission does not recompute review server-side');
assertContains(researchReview, /function\s+submitResearchProgrammeApi_[\s\S]*?critical\.length/, 'Submission does not reject critical issues');
assertContains(researchReview, /function\s+saveResearchStatusApi_[\s\S]*?isLegalResearchStatusTransition_/, 'Status save does not check transition legality');
assertContains(researchReview, /function\s+saveResearchStatusApi_[\s\S]*?['"]Submitted['"][\s\S]*?throws?\s*new\s+Error/, 'Status save does not redirect Submitted to guarded submission');
assertContains(researchMapping, /Derived from PLO mappings/, 'Derived mapping label is missing');
assertContains(programmeService, /mode:\s*String\(data\[i\]\[10\]/, 'Programme mode metadata is not exposed');
assertContains(programmeService, /function\s+isResearchProgramme_[\s\S]*?if \(mode\) return mode === 'research' \|\| mode === 'postgraduate by research';[\s\S]*?return false;/, 'Research programme predicate must fail closed when mode is missing or unknown');
assertContains(researchMapping, /function\s+requireResearchProgramme_\s*\(/, 'Research programme mode guard is missing');
assertContains(researchMapping, /requireResearchProgramme_\(mqaCode\)/, 'Research APIs do not enforce the research programme guard');
assertContains(researchMapping, /Postgraduate by Research/, 'Research profile mode is not canonical');
assertContains(researchMapping, /deriveTFIds_\(/, 'TF derivation is not invoked by mapping functions');
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
assertContains(code, /function\s+getProgrammesApi[\s\S]*?\.filter\(isResearchProgramme_\)/, 'Public programme directory is not research scoped');
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
  assert(!new RegExp('function\\s+' + name + '\\s*\\(').test(code), name + ' remains publicly callable from Code.gs');
});

assertContains(code, /function\s+approveDeleteFileApi[\s\S]*?isGraduateSchoolAdmin_/, 'Admin delete endpoint is not Graduate School-admin guarded');
assertContains(governance, /function\s+ensureGovernanceSheets_\s*\(/, 'Missing additive governance sheet setup');
assertContains(governance, /function\s+getUniversityDashboardApi_\s*\(/, 'Missing university dashboard API implementation');
assertContains(governance, /getProgrammes\(admin \? null : user\.faculty\)\.filter\(isResearchProgramme_\)/, 'University dashboard is not research scoped');
assertContains(governance, /getProgrammes\(faculty\)\.filter\(isResearchProgramme_\)/, 'Faculty report is not research scoped');
assertContains(governance, /MQFDomainState/, 'Dashboard does not monitor MQF Domain state');
assertContains(governance, /TaxonomyState/, 'Dashboard does not monitor Taxonomy state');
assertContains(governance, /function\s+computeResearchProgrammeStatus_\s*\(/, 'Research programme status integration is missing');
assertContains(governance, /function\s+isResearchMappingComplete_\s*\(/, 'Research mapping completion check is missing');
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
assertContains(index, /PLO Workspace[\s\S]*?\+ Add PLO/, 'PLO Workspace add action is missing');
assertContains(index, /Postgraduate by Research/, 'Research mode label is missing');
assertContains(index, /MQF domains/, 'MQF domain selector is missing');
assertContains(index, /Taxonomy/, 'Taxonomy label is missing');
const researchDetailStart = index.indexOf('<div v-if="currentView === \'detail\' && currentProgramme" class="research-workspace">');
const researchDetailEnd = index.indexOf('</main>', researchDetailStart);
assert(researchDetailStart !== -1 && researchDetailEnd !== -1, 'Research detail workspace source is missing');
const researchDetailSource = index.slice(researchDetailStart, researchDetailEnd);
assertContains(researchDetailSource, /Maklumat Program/, 'Programme Information category is missing');
assertContains(researchDetailSource, /Pemetaan/, 'Mapping category is missing');
assertContains(researchDetailSource, /PLO Workspace/, 'PLO workspace is missing');
assertContains(researchDetailSource, /Coverage Matrix/, 'Coverage matrix is missing');
assertContains(researchDetailSource, /TF derived from MQF mapping/, 'Derived TF label is missing');
assertContains(researchDetailSource, /Derived from PLO mappings/, 'PEO derived label is missing');
assertContains(researchDetailSource, /PLO Mapping Matrix/, 'Read-only PLO mapping matrix is missing');
assertContains(researchDetailSource, /aria-label="PLO mapping matrix"/, 'PLO mapping matrix needs an accessible name');
['MQF1', 'MQF2', 'MQF3a', 'MQF3b', 'MQF3c', 'MQF3d', 'MQF3e', 'MQF3f', 'MQF4a', 'MQF4b', 'MQF5'].forEach(function(domain) {
  assertContains(researchDetailSource, new RegExp("'" + domain + "'"), 'PLO mapping matrix is missing MQF column: ' + domain);
});
assertContains(researchDetailSource, /scope="col">\{\{ domain \}\}<\/th>/, 'PLO matrix MQF columns need table headers');
assertContains(researchDetailSource, /scope="row">\{\{ row\.code \}\}<\/th>/, 'PLO matrix PLO rows need row headers');
assertContains(researchDetailSource, /Explicit PLO mapping to/, 'PLO matrix checks need accessible labels');
assertContains(researchDetailSource, /not checked/, 'PLO matrix must expose unchecked cells');
assertContains(researchDetailSource, /Explicit PLO mapping/, 'PLO matrix legend must explain explicit mappings');
assertContains(researchDetailSource, /TF derived from MQF mapping/, 'PLO matrix legend must explain derived TF mappings');
assertContains(researchDetailSource, /SDG coverage/, 'PLO matrix needs a distinct SDG coverage column');
assertContains(researchDetailSource, /SC coverage/, 'PLO matrix needs a distinct SC coverage column');
assertContains(javascript, /function\s+projectMappingMatrixRow_\s*\(/, 'Pure PLO matrix projection is missing');
assertContains(javascript, /mappingMatrixRows:\s*function/, 'PLO matrix does not project current mappings');
assertContains(styles, /\.mapping-matrix-wrap\s*\{\s*max-width:\s*100%;\s*overflow-x:\s*auto;\s*\}/, 'PLO matrix scrolling is not contained');
assertContains(researchDetailSource, /mapping-matrix-wrap"\s+role="region"\s+tabindex="0"/, 'PLO matrix scrolling container must be keyboard focusable');
assertContains(researchDetailSource, /mapping-matrix-wrap"\s+role="region"\s+tabindex="0"\s+aria-label="PLO mapping matrix scrolling region"/, 'PLO matrix scrolling container must have an accessible name');
assertContains(researchDetailSource, /aria-describedby="mapping-matrix-instructions"/, 'PLO matrix must describe keyboard scrolling');
assert(!/\b(?:Coursework|CLO|creditHour|credit hour|Subject|Course|DCI|embeddedPEO|mqfDomain)\b/i.test(researchDetailSource), 'Course-based UI remains in the research detail workspace');
assert(!hasLegacySingularMQFControl(researchDetailSource), 'Research workspace still binds a singular legacy mqfDomain control');
assert(hasLegacySingularMQFControl('<select v-model="plo.mqfDomain"></select>'), 'Singular legacy MQF select binding is not detected');
assert(hasLegacySingularMQFControl('<select v-model="plo[\'mqfDomain\']"></select>'), 'Singular legacy MQF bracket binding is not detected');
assert(hasLegacySingularMQFControl('<input :value="mqfDomain">'), 'Singular legacy MQF input binding is not detected');
assert(!hasLegacySingularMQFControl('<input v-model="plo.mqfDomains">'), 'Plural MQF domain binding is incorrectly rejected');
assert(!hasLegacySingularMQFControl('<textarea v-model="plo[\'mqfDomains\']"></textarea>'), 'Plural MQF bracket binding is incorrectly rejected');
assert(!hasLegacySingularMQFControl('<span data-domain="mqfDomain">metadata</span>'), 'Non-control MQF metadata is incorrectly rejected');
assertContains(researchDetailSource, /<button[^>]*class="back-link"[^>]*@click="leaveResearchWorkspace"/, 'Research workspace back control must be a button');
assertContains(researchDetailSource, /role="tablist"/, 'Research categories need tablist semantics');
assertContains(researchDetailSource, /role="tab"/, 'Research category controls need tab semantics');
assertContains(researchDetailSource, /:aria-selected="researchCategory === 'information'"/, 'Information category must expose its selected state');
assertContains(researchDetailSource, /:aria-selected="researchCategory === 'mapping'"/, 'Mapping category must expose its selected state');
assert(!/showAddDialog|suggestRemoveProgramme|submitAddSuggestion|suggestAddProgramme/.test(index), 'Course-based programme suggestion UI remains public');
assert(!/getPEOsApi|getPLOsApi|savePEOsApi|savePLOsApi|getGraphDataApi|getUploadedFilesApi|uploadFileApi|suggestDeleteFileApi/.test(javascript), 'Legacy course, graph, or document routes remain in client usage');
assertContains(javascript, /self\.programmes\s*=\s*\(result\s*\|\|\s*\[\]\)\.filter\(/, 'Public programme directory is not restricted to research programmes');
[
  ['profile-programme-id', 'Programme ID', 'programmeId'],
  ['profile-created', 'Created', 'createdAt'],
  ['profile-updated', 'Last updated', 'updatedAt'],
  ['profile-updated-by', 'Last updated by', 'updatedBy']
].forEach(function(field) {
  var id = field[0];
  var control = new RegExp('<label\\s+for="' + id + '">' + field[1] + '</label>\\s*<input\\s+id="' + id + '"(?=[^>]*:value="researchProfile\\.' + field[2] + '")(?=[^>]*\\b(?:disabled|readonly)\\b)[^>]*>');
  assertContains(researchDetailSource, control, 'Research profile audit field must have a labeled read-only profile binding: ' + id);
});
assertContains(styles, /\.research-tabs button:focus-visible/, 'Research category focus treatment is missing');
assertContains(index, /Request temporary access/, 'Faculty access request workspace is missing');
assertContains(index, /createAccessRequest/, 'Access request action is missing from the UI');
assertContains(index, /Access requests/, 'Admin access request queue is missing');
assertContains(index, /Governance queue/, 'Admin governance queue is missing');
assertContains(javascript, /loadAccessRequests:\s*function\s*\(/, 'Access request loader is missing');
assertContains(javascript, /loadGovernanceItems:\s*function\s*\(/, 'Governance queue loader is missing');

const researchSheetNames = [
  'PR_ProgrammeProfile', 'PR_PEORecords', 'PR_PLORecords', 'PR_PLOMappings',
  'PR_MQFReference', 'PR_TFReference', 'PR_SDGReference', 'PR_SCReference'
];
nodeAssert.deepStrictEqual(Object.keys(researchDataApi), researchSheetNames, 'Research sheet names are not exact');
nodeAssert.deepStrictEqual(researchDataApi, {
  PR_ProgrammeProfile: ['ProgrammeId', 'MQACode', 'FacultyOrCentre', 'ProgrammeName', 'StudyLevel', 'StudyMode', 'StudyField', 'Session', 'DocumentVersion', 'DataOwner', 'MappingStatus', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'],
  PR_PEORecords: ['PeoId', 'ProgrammeId', 'Code', 'Statement', 'SortOrder', 'UpdatedAt', 'UpdatedBy'],
  PR_PLORecords: ['PloId', 'ProgrammeId', 'ParentPEO', 'Code', 'Statement', 'MQFDomainsJson', 'Taxonomy', 'Rationale', 'Status', 'UpdatedAt', 'UpdatedBy'],
  PR_PLOMappings: ['PloId', 'ProgrammeId', 'SDGIdsJson', 'SCIdsJson', 'DerivedTFIdsJson', 'MappingNote', 'UpdatedAt', 'UpdatedBy'],
  PR_MQFReference: ['Code', 'Title', 'Description', 'Active'],
  PR_TFReference: ['Code', 'Title', 'Description', 'MQFDomainsJson', 'Active'],
  PR_SDGReference: ['Code', 'Title', 'Description', 'Active'],
  PR_SCReference: ['Code', 'Title', 'Description', 'Active']
}, 'Research headers are not exact');
assert(!Object.keys(researchDataApi).some(function(name) {
  return researchDataApi[name].some(function(header) { return /Course|Subject|Credit|CLO|DCI/i.test(header); });
}), 'Research headers must not contain course fields');
nodeAssert.deepStrictEqual(researchReferenceApi.PR_TFReference.map(function(row) { return [row[0], JSON.parse(row[3])]; }), [
  ['TF1', ['MQF1', 'MQF4a']],
  ['TF2', ['MQF2', 'MQF3a', 'MQF3d', 'MQF3e']],
  ['TF3', ['MQF3a', 'MQF3b', 'MQF3c', 'MQF3f']],
  ['TF4', ['MQF3a', 'MQF3b', 'MQF4a', 'MQF4b', 'MQF5']]
], 'TF relationships are not exact');
assertContains(researchData, /LockService\.getScriptLock\(\)/, 'Research sheet creation is not locked');
assertContains(researchReferences, /function\s+getResearchReferencesApi\s*\(\)[\s\S]*?getCurrentUser\(\)/, 'Research references API lacks authentication');
assertContains(auth, /function\s+getCurrentUser\s*\(/, 'Authentication helper is missing');
assertContains(researchReferences, /function\s+getResearchReferencesApi\s*\(/, 'Research references API is missing');

console.log('MQF rebuild static checks passed.');
