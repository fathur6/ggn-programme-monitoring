# MQF 2.0 Program Information System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GAS web app for faculty to manage Programme, PEO, PLO data with graph visualization, file upload, and admin approval workflow.

**Architecture:** Single GAS project bound to the existing spreadsheet. HtmlService serves the frontend (Vue 3 + Tailwind CSS from CDN). All data stored in the spreadsheet tabs. Auth via Session.getActiveUser() + email lookup in PIC/PPS sheets.

**Tech Stack:** Google Apps Script, HtmlService, Vue 3 (CDN), Tailwind CSS (CDN), D3.js or vis.js (CDN), Google Drive API, LockService

## Global Constraints
- Auth restricted to @unisza.edu.my emails only
- 67 per-program tabs accessed by MQA code name
- Lazy-load per-program tab data (never load all 67 at once)
- LockService for all write operations, 30s timeout
- PDF files only for upload (Drive)
- Rename uploads to {MQA_CODE}-{TYPE}-{DDMMYYYY}.pdf

---

### Task 1: GAS Project Scaffolding + Auth Module

**Files:**
- Create: `Code.gs` — doGet, routing, user context
- Create: `Auth.gs` — session validation, role resolution
- Create: `Index.html` — HtmlService template shell
- Create: `Styles.html` — Tailwind + custom CSS
- Create: `JavaScript.html` — Vue 3 app mount point

**Interfaces:**
- Consumes: Existing spreadsheet (bound script)
- Produces: `getCurrentUser()` → `{email, role, faculty, name}` or null
- Produces: `doGet()` → HtmlService output

- [ ] **Step 1: Bound the script to the spreadsheet**

Open the Google Sheet → Extensions → Apps Script. Create a new project bound to this spreadsheet. Delete the default placeholder code.

- [ ] **Step 2: Create Code.gs — entry point**

```javascript
function doGet() {
  var user = getCurrentUser();
  if (!user) {
    return HtmlService.createHtmlOutput('<h3>Akses Ditolak</h3><p>Hanya pengguna @unisza.edu.my yang dibenarkan.</p>')
      .setTitle('MQF 2.0 — Access Denied');
  }
  var template = HtmlService.createTemplateFromFile('Index');
  template.user = JSON.stringify(user);
  return template.evaluate()
    .setTitle('MQF 2.0 — Program Information')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}
```

- [ ] **Step 3: Create Auth.gs — role resolution**

```javascript
var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function getCurrentUser() {
  var email = Session.getActiveUser().getEmail();
  if (!email || email.indexOf('@unisza.edu.my') === -1) return null;

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
```

- [ ] **Step 4: Create Index.html — template shell**

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <?!= include('Styles'); ?>
</head>
<body class="bg-gray-50">
  <div id="app">
    <div class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500">Memuatkan...</p>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.min.js"></script>
  <script>
    var CURRENT_USER = <?= user ?>;
  </script>
  <?!= include('JavaScript'); ?>
</body>
</html>
```

- [ ] **Step 5: Create Styles.html — custom CSS**

```html
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; }
  .accordion-enter-active, .accordion-leave-active { transition: all 0.3s ease; }
  .accordion-enter, .accordion-leave-to { opacity: 0; max-height: 0; }
  .btn { @apply px-4 py-2 rounded text-white font-medium text-sm; }
  .btn-primary { @apply bg-blue-600 hover:bg-blue-700; }
  .btn-danger { @apply bg-red-600 hover:bg-red-700; }
  .btn-success { @apply bg-green-600 hover:bg-green-700; }
  .card { @apply bg-white rounded-lg shadow p-4 mb-4; }
</style>
```

- [ ] **Step 6: Create JavaScript.html — Vue app mount**

```html
<script>
new Vue({
  el: '#app',
  data: {
    user: CURRENT_USER,
    currentView: 'programmes',
    currentProgramme: null,
    programmes: [],
    loading: true,
    error: null
  },
  methods: {
    setView: function(view, programme) {
      this.currentView = view;
      this.currentProgramme = programme || null;
    }
  }
});
</script>
```

- [ ] **Step 7: Deploy and test auth**

In the script editor: Deploy → New deployment → Web app → Execute as: "User accessing the web app" → Who has access: "Anyone within @unisza.edu.my"

Open the web app URL. Verify it loads with your user context. Verify an unauthenticated user sees "Akses Ditolak".

---

### Task 2: Programme List View

**Files:**
- Create: `ProgrammeService.gs`
- Modify: `JavaScript.html` — add programme list component

**Interfaces:**
- Consumes: `getCurrentUser()` → user context from Task 1
- Produces: `getProgrammes(faculty)` → `[{name, mqaCode, nee, progCode, mode, faculty}]`

- [ ] **Step 1: Create ProgrammeService.gs**

```javascript
function getProgrammes(userFilterFaculty) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Programme');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
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
```

- [ ] **Step 2: Add server-side endpoint to Code.gs**

```javascript
// In Code.gs — after doGet
function getProgrammesApi() {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return getProgrammes(user.role === 'Admin' ? null : user.faculty);
}
```

- [ ] **Step 3: Update JavaScript.html — programme list**

```html
<script>
new Vue({
  el: '#app',
  data: {
    user: CURRENT_USER,
    currentView: 'programmes',
    currentProgramme: null,
    programmes: [],
    search: '',
    loading: false,
    error: null
  },
  computed: {
    filteredProgrammes: function() {
      var self = this;
      if (!this.search) return this.programmes;
      var q = this.search.toLowerCase();
      return this.programmes.filter(function(p) {
        return p.name.toLowerCase().indexOf(q) > -1 ||
               p.mqaCode.toLowerCase().indexOf(q) > -1 ||
               p.progCode.toLowerCase().indexOf(q) > -1;
      });
    }
  },
  methods: {
    loadProgrammes: function() {
      this.loading = true;
      var self = this;
      google.script.run
        .withSuccessHandler(function(result) {
          self.programmes = result;
          self.loading = false;
        })
        .withFailureHandler(function(err) {
          self.error = err.message;
          self.loading = false;
        })
        .getProgrammesApi();
    },
    openProgramme: function(prog) {
      this.currentProgramme = prog;
      this.currentView = 'detail';
    },
    setView: function(view) {
      this.currentView = view;
    }
  },
  mounted: function() {
    this.loadProgrammes();
  }
});
</script>
```

Replace the `<div id="app">` content in Index.html with:

```html
<div id="app" class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between">
    <h1 class="text-lg font-semibold text-gray-800">MQF 2.0 — Program Information</h1>
    <div class="text-sm text-gray-500">{{ user.name }} ({{ user.role }})</div>
  </header>

  <main class="max-w-6xl mx-auto p-6" v-if="currentView === 'programmes'">
    <input v-model="search" type="text" placeholder="Cari program..." class="w-full border rounded-lg px-4 py-2 mb-4">

    <div v-if="loading" class="text-center py-8 text-gray-400">Memuatkan...</div>
    <div v-if="error" class="text-red-600 bg-red-50 border border-red-200 rounded p-4">{{ error }}</div>

    <div v-for="p in filteredProgrammes" @click="openProgramme(p)" class="card cursor-pointer hover:shadow-md transition">
      <div class="font-medium">{{ p.name }}</div>
      <div class="text-sm text-gray-500 mt-1">{{ p.mqaCode }} · {{ p.progCode }} · {{ p.mode }}</div>
      <div class="text-xs text-gray-400 mt-1">{{ p.faculty }}</div>
    </div>
  </main>
</div>
```

- [ ] **Step 4: Deploy and test**

Save all files. Deploy as new version. Verify programme list loads, search filters, click opens detail view (shows loading/detail view placeholder for now).

---

### Task 3: Per-Program Tab Data Reader (PEO + PLO)

**Files:**
- Create: `PEOService.gs`
- Create: `PLOService.gs`

**Interfaces:**
- Consumes: `mqaCode` → sheet name
- Produces: `getPEOs(mqaCode)` → `[{code, description, domain, tf:[4], sdg:[17], sc:[8]}]`
- Produces: `getPLOs(mqaCode)` → `[{code, description, embeddedPEO, mqfDomains:[11]}]`

- [ ] **Step 1: Create PEOService.gs**

```javascript
function getPEOs(mqaCode) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  // Section A starts at row 1
  // Columns: A=Code, B=Desc, C=Domain, D-G=TF(4), H-X=SDG(17), Y-AF=SC(8)
  var data = sheet.getRange('A1:AF').getValues();
  var peos = [];
  var inSectionA = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[0].toString().toUpperCase().indexOf('PEO') === 0) {
      inSectionA = true;
    }
    if (inSectionA && row[0] && row[0].toString().toUpperCase().indexOf('PLO') === 0) {
      break; // hit Section B
    }
    if (!inSectionA || !row[0]) continue;

    peos.push({
      code: row[0],
      description: row[1],
      domain: row[2],
      tf: [row[3], row[4], row[5], row[6]],
      sdg: row.slice(7, 24), // H-X = indices 7-23 (17 items)
      sc: row.slice(24, 32)  // Y-AF = indices 24-31 (8 items)
    });
  }
  return peos;
}
```

- [ ] **Step 2: Create PLOService.gs**

```javascript
function getPLOs(mqaCode) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(mqaCode);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var plos = [];
  var inSectionB = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[0].toString().toUpperCase().indexOf('PLO') === 0) {
      inSectionB = true;
    }
    if (!inSectionB || !row[0]) continue;

    // A=Code, B=Desc, C=Embedded PEO, D-N=MQF Domain(11), O+=PLO Mapping
    plos.push({
      code: row[0],
      description: row[1],
      embeddedPEO: row[2],
      mqfDomains: row.slice(3, 14), // D-N = indices 3-13 (11 items)
      mapping: row.slice(14)
    });
  }
  return plos;
}
```

- [ ] **Step 3: Add API endpoints to Code.gs**

```javascript
function getPEOsApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPEOs(mqaCode);
}

function getPLOsApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getPLOs(mqaCode);
}
```

- [ ] **Step 4: Deploy and test**

Deploy new version. Open any programme detail. Call `getPEOsApi('FA5581')` manually from the console or add a temp debug button. Verify PEO/PLO rows returned correctly.

---

### Task 4: Entry View — PEO Section (Accordion CRUD)

**Files:**
- Modify: `JavaScript.html` — detail view template + PEO component
- Modify: `Index.html` — detail view layout
- Modify: `PEOService.gs` — add save/delete methods

**Interfaces:**
- Consumes: `getPEOsApi(mqaCode)` from Task 3
- Produces: `savePEOs(mqaCode, peos)` → updated PEO array

- [ ] **Step 1: Add savePEOs to PEOService.gs**

```javascript
function savePEOs(mqaCode, peos) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(mqaCode);
    if (!sheet) throw new Error('Program tidak dijumpai: ' + mqaCode);

    // Clear existing PEO rows (find Section A bounds)
    var data = sheet.getDataRange().getValues();
    var startRow = -1, endRow = -1;
    for (var i = 0; i < data.length; i++) {
      var code = (data[i][0] || '').toString().toUpperCase();
      if (code.indexOf('PEO') === 0 && startRow === -1) startRow = i + 1;
      if (code.indexOf('PLO') === 0 && startRow > -1) { endRow = i; break; }
    }
    if (startRow === -1) throw new Error('Section A tidak dijumpai');
    if (endRow === -1) endRow = data.length + 1;

    if (endRow > startRow) {
      sheet.getRange(startRow, 1, endRow - startRow, 32).clearContent();
    }

    // Write new PEO rows
    if (peos.length > 0) {
      var rows = peos.map(function(p) {
        return [p.code, p.description, p.domain]
          .concat(p.tf)
          .concat(p.sdg)
          .concat(p.sc.slice(0, 8));
      });
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    }
    return peos;
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Build detail view template in Index.html**

Replace the `<main>` block with programme detail toggle:

```html
<main class="max-w-6xl mx-auto p-6">
  <!-- Programme List View -->
  <div v-if="currentView === 'programmes'">
    <!-- ... existing list template ... -->
  </div>

  <!-- Detail View -->
  <div v-if="currentView === 'detail' && currentProgramme">
    <button @click="setView('programmes')" class="text-blue-600 text-sm mb-4">&larr; Kembali ke senarai</button>

    <div class="card">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold">{{ currentProgramme.name }}</h2>
          <p class="text-sm text-gray-500">{{ currentProgramme.mqaCode }} · {{ currentProgramme.progCode }}</p>
        </div>
        <button @click="toggleViewMode" class="btn btn-primary">
          {{ viewMode === 'entry' ? 'Paparan Graf' : 'Paparan Data' }}
        </button>
      </div>
    </div>

    <!-- Entry View -->
    <div v-if="viewMode === 'entry'">
      <div class="card">
        <div @click="peoOpen = !peoOpen" class="flex items-center justify-between cursor-pointer">
          <h3 class="font-semibold text-lg">A — Program Educational Objectives (PEO)</h3>
          <span>{{ peoOpen ? '▲' : '▼' }}</span>
        </div>
        <div v-show="peoOpen" class="mt-4">
          <table class="w-full text-sm" v-if="peos.length > 0">
            <thead>
              <tr class="bg-gray-100">
                <th class="p-2 text-left">Code</th>
                <th class="p-2 text-left">Description</th>
                <th class="p-2 text-left">Domain</th>
                <th class="p-2 text-center">TF</th>
                <th class="p-2 text-center">SDG</th>
                <th class="p-2 text-center">SC</th>
                <th class="p-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(peo, idx) in peos" :key="idx" class="border-t">
                <td class="p-2"><input v-model="peo.code" class="w-16 border rounded px-1"></td>
                <td class="p-2"><input v-model="peo.description" class="w-full border rounded px-1"></td>
                <td class="p-2"><input v-model="peo.domain" class="w-24 border rounded px-1"></td>
                <td class="p-2 text-center text-xs">
                  <div v-for="(v, ti) in peo.tf" :key="ti">
                    <label><input type="checkbox" v-model="peo.tf[ti]"> TF{{ ti+1 }}</label>
                  </div>
                </td>
                <td class="p-2 text-center text-xs">
                  <div>SDG 1-17 (checkbox matrix)</div>
                </td>
                <td class="p-2 text-center text-xs">
                  <div>SC 1-8 (checkbox matrix)</div>
                </td>
                <td class="p-2"><button @click="removePEO(idx)" class="text-red-500 text-xs">Padam</button></td>
              </tr>
            </tbody>
          </table>
          <button @click="addPEO" class="btn btn-success mt-2 text-xs">+ Tambah PEO</button>
          <button @click="savePEOs" class="btn btn-primary mt-2 ml-2 text-xs" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>

      <div class="card">
        <div @click="ploOpen = !ploOpen" class="flex items-center justify-between cursor-pointer">
          <h3 class="font-semibold text-lg">B — Programme Learning Outcomes (PLO)</h3>
          <span>{{ ploOpen ? '▲' : '▼' }}</span>
        </div>
        <div v-show="ploOpen" class="mt-4">
          <p class="text-gray-400 text-sm">PLO section will be implemented in Task 5.</p>
        </div>
      </div>
    </div>

    <!-- Graph View -->
    <div v-if="viewMode === 'graph'">
      <p class="text-gray-400 text-sm">Graf akan dilaksanakan dalam Task 6.</p>
    </div>
  </div>
</main>
```

- [ ] **Step 3: Add PEO methods to Vue instance in JavaScript.html**

```javascript
data: {
  // ... existing data ...
  viewMode: 'entry',
  peoOpen: false,
  ploOpen: false,
  peos: [],
  saving: false
},
methods: {
  // ... existing methods ...
  toggleViewMode: function() {
    this.viewMode = this.viewMode === 'entry' ? 'graph' : 'entry';
  },
  loadPEOs: function() {
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) { self.peos = r; })
      .getPEOsApi(this.currentProgramme.mqaCode);
  },
  addPEO: function() {
    this.peos.push({
      code: 'PEO' + (this.peos.length + 1),
      description: '',
      domain: '',
      tf: [false, false, false, false],
      sdg: new Array(17).fill(false),
      sc: new Array(8).fill(false)
    });
  },
  removePEO: function(idx) {
    this.peos.splice(idx, 1);
  },
  savePEOs: function() {
    this.saving = true;
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) {
        self.peos = r;
        self.saving = false;
        alert('PEO berjaya disimpan.');
      })
      .withFailureHandler(function(e) {
        self.saving = false;
        alert('Ralat: ' + e.message);
      })
      .savePEOs(this.currentProgramme.mqaCode, this.peos);
  }
},
watch: {
  currentProgramme: function() {
    if (this.currentProgramme) this.loadPEOs();
  }
}
```

- [ ] **Step 4: Deploy and test**

Deploy new version. Open a programme. Verify: PEO accordion shows data, inline editing works, add/remove rows works, save persists to sheet, reload shows saved data.

---

### Task 5: Entry View — PLO Section (Accordion CRUD)

**Files:**
- Modify: `PLOService.gs` — add save/delete methods
- Modify: `JavaScript.html` — PLO accordion template + methods
- Modify: `Index.html` — PLO table UI

**Interfaces:**
- Consumes: `getPLOsApi(mqaCode)` from Task 3
- Produces: `savePLOs(mqaCode, plos)` → updated PLO array

- [ ] **Step 1: Add savePLOs to PLOService.gs**

```javascript
function savePLOs(mqaCode, plos) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    throw new Error('Sistem sibuk. Sila cuba sebentar lagi.');
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(mqaCode);
    if (!sheet) throw new Error('Program tidak dijumpai');

    var data = sheet.getDataRange().getValues();
    var startRow = -1;
    for (var i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().toUpperCase().indexOf('PLO') === 0) {
        if (startRow === -1) startRow = i + 1;
      }
    }
    if (startRow === -1) throw new Error('Section B tidak dijumpai');

    // Clear existing PLO rows to end of sheet
    var lastRow = sheet.getLastRow();
    if (lastRow >= startRow) {
      sheet.getRange(startRow, 1, lastRow - startRow + 1, 25).clearContent();
    }

    if (plos.length > 0) {
      var rows = plos.map(function(p) {
        return [p.code, p.description, p.embeddedPEO]
          .concat(p.mqfDomains.slice(0, 11))
          .concat(p.mapping || []);
      });
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    }
    return plos;
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Add PLO UI to Index.html (replace placeholder)**

Replace the PLO placeholder in Index.html:

```html
<div v-show="ploOpen" class="mt-4">
  <table class="w-full text-sm" v-if="plos.length > 0">
    <thead>
      <tr class="bg-gray-100">
        <th class="p-2 text-left">Code</th>
        <th class="p-2 text-left">Description</th>
        <th class="p-2 text-left">Embedded PEO</th>
        <th class="p-2 text-left">MQF Domain</th>
        <th class="p-2"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(plo, idx) in plos" :key="idx" class="border-t">
        <td class="p-2"><input v-model="plo.code" class="w-16 border rounded px-1"></td>
        <td class="p-2"><input v-model="plo.description" class="w-full border rounded px-1"></td>
        <td class="p-2">
          <select v-model="plo.embeddedPEO" class="border rounded px-1">
            <option value="">—</option>
            <option v-for="peo in peos" :value="peo.code">{{ peo.code }}</option>
          </select>
        </td>
        <td class="p-2 text-xs">
          <div v-for="(d, di) in plo.mqfDomains" :key="di" class="inline-block mr-1">
            <label><input type="checkbox" v-model="plo.mqfDomains[di]"> D{{ di+1 }}</label>
          </div>
        </td>
        <td class="p-2"><button @click="removePLO(idx)" class="text-red-500 text-xs">Padam</button></td>
      </tr>
    </tbody>
  </table>
  <button @click="addPLO" class="btn btn-success mt-2 text-xs">+ Tambah PLO</button>
  <button @click="savePLOs" class="btn btn-primary mt-2 ml-2 text-xs" :disabled="savingPLO">{{ savingPLO ? 'Menyimpan...' : 'Simpan' }}</button>
</div>
```

- [ ] **Step 3: Add PLO methods to Vue instance**

```javascript
data: {
  // ... add:
  plos: [],
  savingPLO: false
},
methods: {
  loadPLOs: function() {
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) { self.plos = r; })
      .getPLOsApi(this.currentProgramme.mqaCode);
  },
  addPLO: function() {
    this.plos.push({
      code: 'PLO' + (this.plos.length + 1),
      description: '',
      embeddedPEO: '',
      mqfDomains: new Array(11).fill(false),
      mapping: []
    });
  },
  removePLO: function(idx) {
    this.plos.splice(idx, 1);
  },
  savePLOs: function() {
    this.savingPLO = true;
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) {
        self.plos = r;
        self.savingPLO = false;
        alert('PLO berjaya disimpan.');
      })
      .withFailureHandler(function(e) {
        self.savingPLO = false;
        alert('Ralat: ' + e.message);
      })
      .savePLOs(this.currentProgramme.mqaCode, this.plos);
  }
},
// Update watch to load both:
watch: {
  currentProgramme: function() {
    if (this.currentProgramme) {
      this.loadPEOs();
      this.loadPLOs();
    }
  }
}
```

- [ ] **Step 4: Deploy and test**

Deploy. Verify PLO accordion shows data, inline edit works, PEO selector shows available PEOs, MQF domain checkboxes work, save persists.

---

### Task 6: Graph Visualization View

**Files:**
- Create: `GraphService.gs` — build D3-compatible graph JSON
- Modify: `JavaScript.html` — graph render component
- Modify: `Index.html` — graph container

**Interfaces:**
- Consumes: `getPEOsApi(mqaCode)`, `getPLOsApi(mqaCode)` from Tasks 4-5
- Produces: `getGraphData(mqaCode)` → `{nodes: [{id, label, type}], links: [{source, target, type}]}`

- [ ] **Step 1: Create GraphService.gs**

```javascript
function getGraphData(mqaCode) {
  var peos = getPEOs(mqaCode);
  var plos = getPLOs(mqaCode);
  var nodes = [];
  var links = [];
  var nodeSet = {};

  function addNode(id, label, type) {
    if (!nodeSet[id]) {
      nodeSet[id] = true;
      nodes.push({ id: id, label: label, type: type });
    }
  }

  // Programme node
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var progSheet = ss.getSheetByName('Programme');
  var progData = progSheet.getDataRange().getValues();
  var progName = mqaCode;
  for (var i = 1; i < progData.length; i++) {
    if (progData[i][1] === mqaCode) {
      progName = progData[i][0];
      break;
    }
  }
  addNode('prog_' + mqaCode, progName, 'Programme');

  // TF nodes (4)
  for (var t = 0; t < 4; t++) {
    addNode('TF' + (t+1), 'TF ' + (t+1), 'TF');
  }

  // SDG nodes (17)
  for (var s = 0; s < 17; s++) {
    addNode('SDG' + (s+1), 'SDG ' + (s+1), 'SDG');
  }

  // SC nodes (8)
  for (var c = 0; c < 8; c++) {
    addNode('SC' + (c+1), 'SC ' + (c+1), 'SC');
  }

  // MQF Domain nodes (11)
  var domainNames = ['D1: Knowledge', 'D2: Psychomotor', 'D3: Affective',
    'D4: Communication', 'D5: Digital Skills', 'D6: Numeracy',
    'D7: Leadership', 'D8: Personal', 'D9: Entrepreneurial',
    'D10: Ethics', 'D11: Lifelong Learning'];
  for (var d = 0; d < 11; d++) {
    addNode('MQF_D' + (d+1), domainNames[d], 'MQFDomain');
  }

  // PEO nodes + edges
  peos.forEach(function(peo) {
    addNode('PEO_' + peo.code, peo.code + ': ' + (peo.description || '').substring(0, 30), 'PEO');
    links.push({ source: 'prog_' + mqaCode, target: 'PEO_' + peo.code, type: 'has' });

    peo.tf.forEach(function(v, ti) {
      if (v) links.push({ source: 'PEO_' + peo.code, target: 'TF' + (ti+1), type: 'maps_to' });
    });
    peo.sdg.forEach(function(v, si) {
      if (v) links.push({ source: 'PEO_' + peo.code, target: 'SDG' + (si+1), type: 'maps_to' });
    });
    peo.sc.forEach(function(v, ci) {
      if (v) links.push({ source: 'PEO_' + peo.code, target: 'SC' + (ci+1), type: 'maps_to' });
    });
  });

  // PLO nodes + edges
  plos.forEach(function(plo) {
    addNode('PLO_' + plo.code, plo.code + ': ' + (plo.description || '').substring(0, 30), 'PLO');
    links.push({ source: 'prog_' + mqaCode, target: 'PLO_' + plo.code, type: 'has' });

    if (plo.embeddedPEO) {
      links.push({ source: 'PEO_' + plo.embeddedPEO, target: 'PLO_' + plo.code, type: 'embeds' });
    }
    plo.mqfDomains.forEach(function(v, di) {
      if (v) links.push({ source: 'PLO_' + plo.code, target: 'MQF_D' + (di+1), type: 'classified_as' });
    });
  });

  return { nodes: nodes, links: links };
}
```

- [ ] **Step 2: Add API endpoint to Code.gs**

```javascript
function getGraphDataApi(mqaCode) {
  if (!getCurrentUser()) throw new Error('Unauthorized');
  return getGraphData(mqaCode);
}
```

- [ ] **Step 3: Add D3.js to Index.html**

Add D3.js CDN before the Vue script:

```html
<script src="https://d3js.org/d3.v7.min.js"></script>
```

- [ ] **Step 4: Add graph container to Index.html (replace placeholder)**

Replace the graph placeholder:

```html
<div v-if="viewMode === 'graph'">
  <div id="graph-container" style="width:100%;height:600px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;"></div>
</div>
```

- [ ] **Step 5: Add graph render method to Vue**

```javascript
methods: {
  renderGraph: function() {
    var self = this;
    google.script.run
      .withSuccessHandler(function(data) {
        self.$nextTick(function() {
          self.drawD3Graph(data);
        });
      })
      .getGraphDataApi(this.currentProgramme.mqaCode);
  },
  drawD3Graph: function(data) {
    var container = document.getElementById('graph-container');
    if (!container) return;
    container.innerHTML = '';

    var width = container.clientWidth;
    var height = 600;
    var svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height);

    var colorMap = {
      Programme: '#3B82F6',
      PEO: '#10B981',
      PLO: '#F59E0B',
      TF: '#EF4444',
      SDG: '#8B5CF6',
      SC: '#EC4899',
      MQFDomain: '#6366F1'
    };

    var linkColorMap = {
      has: '#9CA3AF',
      maps_to: '#60A5FA',
      embeds: '#34D399',
      classified_as: '#FBBF24'
    };

    var simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(function(d) { return d.id; }).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    var link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', function(d) { return linkColorMap[d.type] || '#999'; })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    var node = svg.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('r', 8)
      .attr('fill', function(d) { return colorMap[d.type] || '#999'; })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .call(d3.drag()
        .on('start', function(e, d) { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', function(e, d) { d.fx = e.x; d.fy = e.y; })
        .on('end', function(e, d) { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    var label = svg.append('g')
      .selectAll('text')
      .data(data.nodes)
      .enter().append('text')
      .text(function(d) { return d.label; })
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4);

    simulation.on('tick', function() {
      link.attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; });
      node.attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; });
      label.attr('x', function(d) { return d.x; }).attr('y', function(d) { return d.y; });
    });

    // Legend
    var legendData = [
      {label: 'Programme', color: '#3B82F6'},
      {label: 'PEO', color: '#10B981'},
      {label: 'PLO', color: '#F59E0B'},
      {label: 'TF', color: '#EF4444'},
      {label: 'SDG', color: '#8B5CF6'},
      {label: 'SC', color: '#EC4899'},
      {label: 'MQF Domain', color: '#6366F1'}
    ];
    var legend = svg.append('g').attr('transform', 'translate(10, 10)');
    legendData.forEach(function(item, i) {
      var g = legend.append('g').attr('transform', 'translate(0, ' + (i * 20) + ')');
      g.append('circle').attr('r', 5).attr('fill', item.color);
      g.append('text').attr('x', 12).attr('y', 4).attr('font-size', '11px').text(item.label);
    });
  }
},
// Call renderGraph when switching to graph mode
watch: {
  viewMode: function(mode) {
    if (mode === 'graph' && this.currentProgramme) {
      this.$nextTick(function() { this.renderGraph(); });
    }
  }
}
```

- [ ] **Step 6: Deploy and test**

Deploy. Open a programme with PEO → TF/SDG/SC mappings. Click "Paparan Graf". Verify force-directed graph renders with coloured nodes and edges. Toggle back to entry view.

---

### Task 7: File Upload & Preview

**Files:**
- Create: `UploadService.gs` — upload, list, delete (suggest), approve delete
- Create: `DriveConfig.gs` — Drive folder ID configuration
- Modify: `Index.html` — upload section in detail view
- Modify: `JavaScript.html` — upload methods

- [ ] **Step 1: Create DriveConfig.gs**

```javascript
var DRIVE_ROOT_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID'; // Set this

function getProgramFolder(mqaCode) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  var folders = root.getFoldersByName(mqaCode);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(mqaCode);
}
```

- [ ] **Step 2: Create UploadService.gs**

```javascript
function getUploadedFiles(mqaCode) {
  var folder = getProgramFolder(mqaCode);
  var files = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var f = files.next();
    result.push({
      id: f.getId(),
      name: f.getName(),
      url: f.getUrl(),
      size: f.getSize(),
      date: f.getDateCreated().toISOString().split('T')[0]
    });
  }
  return result.sort(function(a, b) { return b.date.localeCompare(a.date); });
}

function uploadFile(mqaCode, fileType, fileBlob) {
  if (!fileBlob) throw new Error('Sila pilih fail.');
  if (fileBlob.getContentType() !== 'application/pdf') throw new Error('Hanya format PDF dibenarkan.');

  var now = new Date();
  var dd = ('0' + now.getDate()).slice(-2);
  var MM = ('0' + (now.getMonth() + 1)).slice(-2);
  var yy = now.getFullYear();
  var dateStr = dd + MM + yy;
  var fileName = mqaCode + '-' + fileType + '-' + dateStr + '.pdf';

  var folder = getProgramFolder(mqaCode);
  var existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) throw new Error('Fail dengan nama yang sama sudah wujud.');

  var file = folder.createFile(fileBlob);
  file.setName(fileName);
  return { id: file.getId(), name: fileName, url: file.getUrl() };
}

function suggestDeleteFile(fileId, mqaCode) {
  // Store suggestion in a "PendingDeletions" sheet
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingDeletions');
  if (!sheet) {
    sheet = ss.insertSheet('PendingDeletions');
    sheet.appendRow(['FileID', 'FileName', 'Programme', 'RequestedBy', 'RequestedDate', 'Status']);
  }
  var file = DriveApp.getFileById(fileId);
  var user = getCurrentUser();
  sheet.appendRow([fileId, file.getName(), mqaCode, user.email, new Date(), 'Pending']);
  return { success: true };
}

function approveDeleteFile(fileId) {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Hanya Admin boleh meluluskan.');
  var file = DriveApp.getFileById(fileId);
  file.setTrashed(true);
  // Update suggestion status
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingDeletions');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === fileId) {
        sheet.getRange(i + 1, 6).setValue('Approved');
        break;
      }
    }
  }
  return { success: true };
}
```

- [ ] **Step 3: Add file upload section to Index.html**

Add inside the detail view, after the PLO accordion:

```html
<div class="card">
  <div @click="uploadOpen = !uploadOpen" class="flex items-center justify-between cursor-pointer">
    <h3 class="font-semibold text-lg">Muat Naik Dokumen</h3>
    <span>{{ uploadOpen ? '▲' : '▼' }}</span>
  </div>
  <div v-show="uploadOpen" class="mt-4">
    <div class="mb-4">
      <select v-model="uploadType" class="border rounded px-3 py-2 mr-2">
        <option value="DCI">DCI</option>
        <option value="OTH">Lain-lain</option>
      </select>
      <input type="file" ref="fileInput" accept="application/pdf" class="border rounded px-3 py-2">
      <button @click="doUpload" class="btn btn-primary text-xs mt-2">Muat Naik</button>
    </div>

    <table class="w-full text-sm" v-if="files.length > 0">
      <thead><tr class="bg-gray-100">
        <th class="p-2 text-left">Nama Fail</th>
        <th class="p-2 text-left">Tarikh</th>
        <th class="p-2"></th>
      </tr></thead>
      <tbody>
        <tr v-for="f in files" :key="f.id" class="border-t">
          <td class="p-2">
            <a :href="'https://drive.google.com/file/d/' + f.id + '/preview'" target="_blank" class="text-blue-600 underline">{{ f.name }}</a>
          </td>
          <td class="p-2 text-gray-500">{{ f.date }}</td>
          <td class="p-2">
            <button @click="requestDelete(f)" class="text-red-500 text-xs">Padam</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-gray-400 text-sm">Tiada fail dimuat naik.</p>

    <!-- Preview iframe -->
    <div v-if="previewFile" class="mt-4">
      <iframe :src="'https://drive.google.com/file/d/' + previewFile.id + '/preview'" width="100%" height="500px" frameborder="0"></iframe>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add upload methods to Vue**

```javascript
data: {
  // ...add:
  uploadOpen: false,
  uploadType: 'DCI',
  files: [],
  previewFile: null
},
methods: {
  loadFiles: function() {
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) { self.files = r; })
      .getUploadedFiles(this.currentProgramme.mqaCode);
  },
  doUpload: function() {
    var input = this.$refs.fileInput;
    if (!input.files || !input.files[0]) { alert('Sila pilih fail.'); return; }
    var self = this;
    google.script.run
      .withSuccessHandler(function() {
        alert('Fail berjaya dimuat naik.');
        self.loadFiles();
      })
      .withFailureHandler(function(e) { alert('Ralat: ' + e.message); })
      .uploadFile(this.currentProgramme.mqaCode, this.uploadType, input);
  },
  requestDelete: function(file) {
    if (!confirm('Hantar permintaan padam fail ini?')) return;
    var self = this;
    google.script.run
      .withSuccessHandler(function() {
        alert('Permintaan padam dihantar untuk kelulusan Admin.');
      })
      .withFailureHandler(function(e) { alert('Ralat: ' + e.message); })
      .suggestDeleteFile(file.id, self.currentProgramme.mqaCode);
  }
},
// In watch, add loadFiles:
watch: {
  currentProgramme: function() {
    if (this.currentProgramme) {
      this.loadPEOs();
      this.loadPLOs();
      this.loadFiles();
    }
  }
}
```

- [ ] **Step 5: Deploy and test**

Deploy. Open a programme. Upload a PDF. Verify it lists. Click the file link → iframe preview loads. Click Padam → confirmation dialog → pending approval.

---

### Task 8: Admin Suggestion/Approval Workflow

**Files:**
- Create: `SuggestionsService.gs` — add, list pending, approve, reject
- Modify: `Index.html` — Admin panel view
- Modify: `JavaScript.html` — Admin methods, navigation
- Modify: `Code.gs` — Add/Remove programme suggestion endpoints

- [ ] **Step 1: Create SuggestionsService.gs**

```javascript
function suggestAddProgramme(programmeData) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingSuggestions');
  if (!sheet) {
    sheet = ss.insertSheet('PendingSuggestions');
    sheet.appendRow(['Type', 'Data', 'ProgrammeCode', 'Faculty', 'RequestedBy', 'RequestedDate', 'Status', 'Reason']);
  }
  sheet.appendRow(['Add', JSON.stringify(programmeData), programmeData.mqaCode || '', user.faculty, user.email, new Date(), 'Pending', '']);
  return { success: true };
}

function suggestRemoveProgramme(mqaCode) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingSuggestions');
  if (!sheet) {
    sheet = ss.insertSheet('PendingSuggestions');
    sheet.appendRow(['Type', 'Data', 'ProgrammeCode', 'Faculty', 'RequestedBy', 'RequestedDate', 'Status', 'Reason']);
  }
  sheet.appendRow(['Remove', '', mqaCode, user.faculty, user.email, new Date(), 'Pending', '']);
  return { success: true };
}

function getPendingSuggestions() {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Unauthorized');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingSuggestions');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][6] === 'Pending') {
      result.push({
        type: data[i][0],
        data: data[i][1],
        programmeCode: data[i][2],
        faculty: data[i][3],
        requestedBy: data[i][4],
        requestedDate: data[i][5],
        status: data[i][6],
        row: i + 1
      });
    }
  }
  return result;
}

function approveSuggestion(row) {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Unauthorized');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingSuggestions');
  var data = sheet.getDataRange().getValues();
  var suggestion = data[row - 1];

  if (suggestion[0] === 'Add') {
    var progData = JSON.parse(suggestion[1]);
    var progSheet = ss.getSheetByName('Programme');
    progSheet.appendRow([progData.name, progData.mqaCode, progData.nee, progData.progCode, '', '', '', '', '', '', progData.mode, progData.faculty]);
  } else if (suggestion[0] === 'Remove') {
    var progSheet = ss.getSheetByName('Programme');
    var progData = progSheet.getDataRange().getValues();
    for (var i = 1; i < progData.length; i++) {
      if (progData[i][1] === suggestion[2]) {
        progSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  sheet.getRange(row, 7).setValue('Approved');
  sheet.getRange(row, 8).setValue('Diluluskan oleh ' + user.email);
  return { success: true };
}

function rejectSuggestion(row, reason) {
  var user = getCurrentUser();
  if (!user || user.role !== 'Admin') throw new Error('Unauthorized');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PendingSuggestions');
  sheet.getRange(row, 7).setValue('Rejected');
  sheet.getRange(row, 8).setValue(reason || 'Ditolak oleh ' + user.email);
  return { success: true };
}
```

- [ ] **Step 2: Add API endpoints to Code.gs**

```javascript
function getPendingSuggestionsApi() { return getPendingSuggestions(); }
function approveSuggestionApi(row) { return approveSuggestion(row); }
function rejectSuggestionApi(row, reason) { return rejectSuggestion(row, reason); }
function suggestAddProgrammeApi(data) { return suggestAddProgramme(data); }
function suggestRemoveProgrammeApi(code) { return suggestRemoveProgramme(code); }
```

- [ ] **Step 3: Add Admin navigation and panel to Index.html**

Add navigation tabs after the header, before `<main>`:

```html
<div v-if="user.role === 'Admin'" class="bg-white border-b px-6 py-2">
  <button @click="adminView = 'suggestions'" class="mr-4 text-sm" :class="adminView === 'suggestions' ? 'text-blue-600 font-medium' : 'text-gray-500'">Kelulusan</button>
</div>
```

Add Admin panel after the programme detail section (or as a separate view):

```html
<!-- Admin Suggestions Panel -->
<div v-if="currentView === 'admin' && user.role === 'Admin'" class="card">
  <h3 class="font-semibold text-lg mb-4">Cadangan Menunggu Kelulusan</h3>
  <div v-if="pendingSuggestions.length === 0" class="text-gray-400 text-sm">Tiada cadangan.</div>
  <div v-for="s in pendingSuggestions" :key="s.row" class="border rounded p-3 mb-2">
    <div class="flex items-center justify-between">
      <div>
        <span class="font-medium">{{ s.type === 'Add' ? 'Tambah' : 'Padam' }}</span>
        <span class="text-gray-600 ml-2">{{ s.programmeCode || '(baru)' }}</span>
        <span class="text-gray-400 text-xs ml-2">oleh {{ s.requestedBy }} · {{ s.requestedDate }}</span>
      </div>
      <div>
        <button @click="approveSuggestion(s)" class="btn btn-success text-xs mr-1">Lulus</button>
        <button @click="openRejectDialog(s)" class="btn btn-danger text-xs">Tolak</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add Admin methods to Vue**

```javascript
data: {
  // ...add:
  adminView: 'suggestions',
  pendingSuggestions: [],
  rejectDialog: null,
  rejectReason: ''
},
methods: {
  loadPendingSuggestions: function() {
    if (this.user.role !== 'Admin') return;
    var self = this;
    google.script.run
      .withSuccessHandler(function(r) { self.pendingSuggestions = r; })
      .getPendingSuggestionsApi();
  },
  approveSuggestion: function(s) {
    var self = this;
    google.script.run
      .withSuccessHandler(function() {
        alert('Diluluskan.');
        self.loadPendingSuggestions();
        self.loadProgrammes();
      })
      .approveSuggestionApi(s.row);
  },
  openRejectDialog: function(s) {
    this.rejectDialog = s;
    this.rejectReason = '';
  },
  confirmReject: function() {
    var self = this;
    var reason = this.rejectReason || 'Tiada sebab';
    google.script.run
      .withSuccessHandler(function() {
        alert('Ditolak.');
        self.rejectDialog = null;
        self.loadPendingSuggestions();
      })
      .rejectSuggestionApi(this.rejectDialog.row, reason);
  }
},
mounted: function() {
  this.loadProgrammes();
  this.loadPendingSuggestions();
}
```

Add a simple modal for reject reason in Index.html:

```html
<div v-if="rejectDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" @click.self="rejectDialog=null">
  <div class="bg-white rounded-lg p-6 w-96">
    <h4 class="font-semibold mb-3">Sebab Penolakan</h4>
    <textarea v-model="rejectReason" class="w-full border rounded p-2 mb-3" rows="3"></textarea>
    <div class="flex justify-end">
      <button @click="rejectDialog=null" class="btn bg-gray-300 text-gray-700 mr-2">Batal</button>
      <button @click="confirmReject" class="btn btn-danger">Tolak</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add "Cadangan" programme list buttons**

Add to each programme card in list view:

```html
<button v-if="user.role !== 'Admin'" @click.stop="suggestRemove(p)" class="text-red-400 text-xs hover:text-red-600">Cadang Padam</button>
```

And at top of programme list:

```html
<button v-if="user.role !== 'Admin'" @click="showAddDialog = true" class="btn btn-primary text-xs mb-4">+ Cadang Tambah Program</button>
```

- [ ] **Step 6: Deploy and test**

Deploy. Login as non-admin user. Verify "Cadang Tambah/Padam" buttons visible. Submit a suggestion. Login as Admin. Verify it appears in Kelulusan panel. Approve. Verify programme list updates. Reject another. Verify it disappears with reason.

---

### Task 9: Concurrency, Error Handling & Final Polish

**Files:**
- Modify: `All service files` — ensure LockService guards
- Create: `Config.gs` — constants and shared utilities
- Modify: `Index.html` — loading states, error toasts
- Modify: `JavaScript.html` — global error handler

- [ ] **Step 1: Create Config.gs**

```javascript
var APP_NAME = 'MQF 2.0 Program Information';
var LOCK_TIMEOUT_MS = 30000;
var ALLOWED_DOMAIN = '@unisza.edu.my';
var SHEET_NAMES = {
  programme: 'Programme',
  pic: 'PIC',
  pps: 'PPS',
  suggestions: 'PendingSuggestions',
  deletions: 'PendingDeletions'
};
```

- [ ] **Step 2: Add global error handler to Code.gs**

```javascript
function handleError(e) {
  console.error(e.message + (e.stack ? '\n' + e.stack : ''));
  throw new Error('Ralat berlaku. Sila cuba sebentar lagi.');
}

// Wrap all API functions with try/catch
// Example wrapper pattern — apply to each endpoint:
function withErrorHandling(fn) {
  try {
    return fn();
  } catch(e) {
    return handleError(e);
  }
}
```

- [ ] **Step 3: Add LockService guard to all write operations**

Every `save*`, `approve*`, `reject*`, `uploadFile`, `suggest*` function already includes LockService from Tasks 4-8. Verify each has:

```javascript
var lock = LockService.getScriptLock();
try { lock.waitLock(LOCK_TIMEOUT_MS); } catch(e) { throw new Error('Sistem sibuk. Sila cuba sebentar lagi.'); }
try { /* write operation */ } finally { lock.releaseLock(); }
```

- [ ] **Step 4: Add loading skeletons and toast notifications to Index.html**

Add a global toast component:

```html
<!-- Toast notification -->
<div v-if="toast" class="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
  {{ toast }}
</div>
```

- [ ] **Step 5: Add toast methods to Vue**

```javascript
data: {
  // ...add:
  toast: null,
  toastTimer: null
},
methods: {
  showToast: function(msg) {
    var self = this;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = msg;
    this.toastTimer = setTimeout(function() { self.toast = null; }, 3000);
  }
}
// Replace all alert() calls with this.showToast()
```

- [ ] **Step 6: Final deploy and integration test**

Deploy as final version. Test full flow:
1. Login as non-admin → view programme list → open details → edit PEO/PLO → save → graph view → upload PDF → suggest add/remove
2. Login as admin → verify pending suggestions → approve/reject → verify programme list reflects changes → verify file delete approval
3. Open two browser tabs with different users → verify LockService prevents simultaneous save conflicts
4. Verify @unisza.edu.my domain restriction works
5. Test with a non-@unisza.edu.my account → denied access
