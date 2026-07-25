/** EmailService.gs — Send MQF 2.0 announcement & progress update emails */

var TDA_DATA = {
  FBK:  { name: 'Prof. Madya Dr. Siti Salwa Binti Mohd Noor', email: 'salwamnoor@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Bahasa dan Komunikasi' },
  FBIM: { name: 'Dr. Nurul Zaizuliana Binti Rois Anwar', email: 'zaizuliana@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Biosumber & Industri Makanan' },
  FF:   { name: 'Dr. Nurulumi Binti Ahmad', email: 'numiahmad@unisza.edu.my', role: 'Timbalan Dekan (Akademik Dan Siswazah)', full: 'Fakulti Farmasi' },
  FIK:  { name: 'Prof. Madya Dr. Wan Suryani Binti Wan Awang', email: 'suryani@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Informatik & Komputeran' },
  FKI:  { name: 'Dr. Aman Daima Bin Md. Zain', email: 'amandaima@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Pengajian Kontemporari Islam' },
  FUPL: { name: 'Dr. Muhamad Hafizuddin Bin Ghani', email: 'hafizuddinghani@unisza.edu.my', role: 'Timbalan Dekan (Akademik Dan Siswazah)', full: 'Fakulti Pengajian Umum dan Pendidikan Lanjutan' },
  FPP:  { name: 'Prof. Madya Dr. Wan Anisah Binti Endut', email: 'wanisah@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Perniagaan dan Pengurusan' },
  FP:   { name: 'Prof. Madya Dr. Azizul Fadzli Bin Wan Jusoh @ Ab Rahim', email: 'azizulfadzli@unisza.edu.my', role: 'Timbalan Dekan Ijazah Lanjutan dan Pengajian Profesional', full: 'Fakulti Perubatan' },
  FPV:  { name: 'Dr. Noor Syaheera Binti Ibrahim', email: 'syaheeraibrahim@unisza.edu.my', role: 'Timbalan Dekan (Akademik Dan Siswazah)', full: 'Fakulti Perubatan Veterinar' },
  FRIT: { name: 'Prof. Ir. Dr. Mohd Shahir Bin Kasim', email: 'shahirkasim@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Reka Bentuk Inovatif dan Teknologi' },
  FSK:  { name: 'Prof. Madya Ts. Dr. Kamarul Amin Bin Abdullah @ Abu Bakar', email: 'kamarulaminab@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Sains Kesihatan' },
  FSSG: { name: 'Prof. Madya Dr. Wan Nor Jazmina Binti Wan Ariffin', email: 'wnjazmina@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Sains Sosial Gunaan' },
  FUHA: { name: 'Dr. Shariffah Nuridah Aishah Binti Syed Nong Mohamad', email: 'aishah@unisza.edu.my', role: 'Timbalan Dekan (Akademik & Siswazah)', full: 'Fakulti Undang-undang & Hubungan Antarabangsa' },
  ESERI: { name: 'Dr. Abdul Rahman Bin Hassan', email: 'rahmanhassan@unisza.edu.my', role: 'Timbalan Pengarah', full: 'Institut Penyelidikan Alam Sekitar Pantai Timur' },
  INSPIRE: { name: 'Prof. Madya Dr. Wan Khairul Aiman Bin Wan Mokhtar', email: 'wkhairulaiman@unisza.edu.my', role: 'Timbalan Pengarah', full: 'Institut Penyelidikan Produk & Ketamadunan Melayu Islam' },
};

var REPLY_TO = 'pps_tdakademik@unisza.edu.my';
var SENDER_NAME = 'Timbalan Dekan Akademik PPS';
var VIDEO_URL = 'https://youtu.be/8F2r0dBkDVQ';
var PROGRESS_VIDEO_URL = 'https://youtu.be/I97ngC0IvTs';


/* ===================================================================
   1. HTML BUILDERS
   =================================================================== */

/** Build announcement email HTML (original — first notification) */
function buildEmailHTML(fac, recip) {
  var directory = getFacultyRecipientData_(fac);
  var fallback = TDA_DATA[fac] || {};
  var tda = { name: directory.tdaName || fallback.name || '', email: directory.tdaEmail || fallback.email || '', role: directory.tdaRole || fallback.role || '', full: directory.facultyFull || fallback.full || fac };
  if (!tda) return '';
  recip = recip || {};

  var e = function(s) { return (s + '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var governanceUrl = '';
  try { governanceUrl = ScriptApp.getService().getUrl() || ''; } catch (ignore) {}

  var addrHtml = '';
  addrHtml += '<p style="margin:0;font-size:13px;color:#666"><strong>Y. Brs. ' + e(tda.name) + '</strong></p>';
  addrHtml += '<p style="margin:0 0 6px;font-size:13px;color:#666">' + e(tda.role) + '</p>';
  if (recip.gcName) {
    addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(recip.gcName) + '</p>';
    addrHtml += '<p style="margin:0 0 6px;font-size:12px;color:#999">Penyelaras Siswazah</p>';
  }
  if (recip.picName) {
    addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(recip.picName) + '</p>';
    addrHtml += '<p style="margin:0 0 6px;font-size:12px;color:#999">PIC Fakulti</p>';
  }
  addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(tda.full) + '</p>';

  return '' +
'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333;background:#f4f4f4">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0">' +
'<tr><td align="center">' +
'<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">' +
// Header
'<tr><td style="background:#1a1a2e;padding:30px 40px;text-align:center">' +
'<img src="https://i.postimg.cc/L6bJj0H1/GS-logo-color-cropped.png" alt="UniSZA Graduate School" style="width:90px;height:auto;margin-bottom:12px">' +
'<h1 style="color:#fff;font-size:18px;font-weight:400;margin:0">Pusat Pengajian Siswazah</h1>' +
'<p style="color:rgba(255,255,255,.6);font-size:13px;margin:4px 0 0">Universiti Sultan Zainal Abidin</p>' +
'</td></tr>' +
// Body
'<tr><td style="padding:30px 40px">' +
'<p style="margin:0 0 16px">Assalamualaikum w.b.t. dan Salam Sejahtera,</p>' +

'<table cellpadding="0" cellspacing="0" style="background:#f9f9fb;border-left:3px solid #1a1a2e;padding:12px 16px;margin:0 0 20px;border-radius:0 4px 4px 0;width:100%">' +
'<tr><td>' + addrHtml +
'</td></tr></table>' +

'<p style="margin:0 0 16px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">TAJUK</p>' +
'<h2 style="font-size:15px;font-weight:600;color:#1a1a2e;margin:0 0 20px;line-height:1.4">Pengisian Maklumat PEO, PLO dan Pemetaan MQF 2.0 (2024) Bagi Program di ' + e(tda.full) + '</h2>' +

'<p style="margin:0 0 12px">Dengan segala hormatnya, perkara di atas dirujuk.</p>' +

'<p style="margin:0 0 12px"><strong>2.</strong> Sukacita dimaklumkan bahawa Pusat Pengajian Siswazah (PPS) sedang melaksanakan inisiatif pengisian maklumat <strong>Program Educational Objectives (PEO)</strong> dan <strong>Program Learning Outcomes (PLO)</strong> bagi tujuan pemetaan MQF 2.0 (2024) untuk semua program yang ditawarkan di ' + e(tda.full) + '.</p>' +

'<p style="margin:0 0 12px"><strong>3.</strong> Sehubungan dengan itu, kami memohon kerjasama pihak tuan/puan untuk mengisi maklumat berikut di dalam sistem yang telah disediakan:</p>' +

'<table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%">' +
'<tr><td style="padding:8px 12px;background:#f9f9fb;border-bottom:1px solid #eee;font-size:13px;vertical-align:top;width:24px;color:#1a1a2e;font-weight:600">i.</td>' +
'<td style="padding:8px 12px;background:#f9f9fb;border-bottom:1px solid #eee;font-size:13px">PEO (Program Educational Objectives) dan penerangan bagi setiap PEO;</td></tr>' +
'<tr><td style="padding:8px 12px;background:#fff;border-bottom:1px solid #eee;font-size:13px;vertical-align:top;width:24px;color:#1a1a2e;font-weight:600">ii.</td>' +
'<td style="padding:8px 12px;background:#fff;border-bottom:1px solid #eee;font-size:13px">PLO (Program Learning Outcomes) dan penerangan, Domain MQF serta Taksonomi yang bersesuaian bagi setiap PLO; dan</td></tr>' +
'<tr><td style="padding:8px 12px;background:#f9f9fb;font-size:13px;vertical-align:top;width:24px;color:#1a1a2e;font-weight:600">iii.</td>' +
'<td style="padding:8px 12px;background:#f9f9fb;font-size:13px">Pemetaan PLO dengan Parent PEO, SDG, TF (Teras FlexS) dan SC (Sustainable Competencies).</td></tr></table>' +

// Links section
'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:12px 16px;background:#eef5ff;border-radius:6px">' +
'<p style="margin:0;font-size:13px"><strong>Video Tutorial:</strong><br>' +
'<a href="' + e(VIDEO_URL) + '" style="color:#1a73e8;font-size:13px">' + e(VIDEO_URL) + '</a></p>' +
'</td></tr></table>' +

'<p style="margin:0 0 12px"><strong>4.</strong> Sekiranya terdapat sebarang pertanyaan atau masalah teknikal, sila hubungi PPS di talian e-mel <a href="mailto:' + e(REPLY_TO) + '" style="color:#1a73e8;text-decoration:none">' + e(REPLY_TO) + '</a>. PPS memohon jasa baik fakulti / institut untuk melengkapkan maklumat ini selewat-lewatnya <strong>Khamis, 23 Julai 2026</strong>.</p>' +

'<p style="margin:0 0 4px">Kerjasama dan perhatian tuan/puan dalam perkara ini amat dihargai dan didahului dengan ucapan terima kasih.</p>' +
'<p style="margin:0 0 20px">Sekian.</p>' +

'<p style="margin:0 0 2px">Yang benar,</p>' +
'<p style="margin:0;font-weight:600;color:#1a1a2e">DR. FATHURRAHMAN BIN LANANAN</p>' +
'<p style="margin:0;font-size:13px;color:#666">Timbalan Dekan (Akademik)</p>' +
'<p style="margin:0;font-size:13px;color:#666">Pusat Pengajian Siswazah</p>' +
'<p style="margin:0 0 20px;font-size:13px;color:#666">Universiti Sultan Zainal Abidin</p>' +

'</td></tr>' +
// Footer
'<tr><td style="background:#f9f9fb;padding:16px 40px;text-align:center;border-top:1px solid #eee">' +
'<p style="margin:0;font-size:11px;color:#999">E-mel ini dihasilkan secara automatik oleh Sistem Maklumat MQF 2.0 Pusat Pengajian Siswazah, UniSZA.</p>' +
'</td></tr></table>' +
'</td></tr></table></body></html>';
}


/** Build progress-update email HTML (second notification — based on JKPS briefing video) */
function buildProgressEmailHTML(fac, recip, optStatus) {
  var directory = getFacultyRecipientData_(fac);
  var fallback = TDA_DATA[fac] || {};
  var tda = { name: directory.tdaName || fallback.name || '', email: directory.tdaEmail || fallback.email || '', role: directory.tdaRole || fallback.role || '', full: directory.facultyFull || fallback.full || fac };
  if (!tda) return '';
  recip = recip || {};
  var status = optStatus || {};
  // status.lbl = 'lengkap', 'separuh', 'kosong', '' (default)
  // status.note = optional extra note

  var e = function(s) { return (s + '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

  var addrHtml = '';
  addrHtml += '<p style="margin:0;font-size:13px;color:#666"><strong>Y. Brs. ' + e(tda.name) + '</strong></p>';
  addrHtml += '<p style="margin:0 0 6px;font-size:13px;color:#666">' + e(tda.role) + '</p>';
  if (recip.gcName) {
    addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(recip.gcName) + '</p>';
    addrHtml += '<p style="margin:0 0 6px;font-size:12px;color:#999">Penyelaras Siswazah</p>';
  }
  if (recip.picName) {
    addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(recip.picName) + '</p>';
    addrHtml += '<p style="margin:0 0 6px;font-size:12px;color:#999">PIC Fakulti / Institut</p>';
  }
  addrHtml += '<p style="margin:0;font-size:13px;color:#888">' + e(tda.full) + '</p>';

  // Status badge
  var statusBadge = '';
  if (status.lbl === 'lengkap') {
    statusBadge = '<span style="display:inline-block;background:#e6f7e6;color:#2e7d32;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600">&#10003; Lengkap</span>';
  } else if (status.lbl === 'separuh') {
    statusBadge = '<span style="display:inline-block;background:#fff8e1;color:#f57f17;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600">&#9679; Separuh Jalan</span>';
  } else if (status.lbl === 'kosong') {
    statusBadge = '<span style="display:inline-block;background:#fce4ec;color:#c62828;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600">&#10005; Belum Mula</span>';
  }

  return '' +
'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333;background:#f4f4f4">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0">' +
'<tr><td align="center">' +
'<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">' +
// Header
'<tr><td style="background:#1a1a2e;padding:30px 40px;text-align:center">' +
'<img src="https://i.postimg.cc/L6bJj0H1/GS-logo-color-cropped.png" alt="UniSZA Graduate School" style="width:90px;height:auto;margin-bottom:12px">' +
'<h1 style="color:#fff;font-size:18px;font-weight:400;margin:0">Pusat Pengajian Siswazah</h1>' +
'<p style="color:rgba(255,255,255,.6);font-size:13px;margin:4px 0 0">Universiti Sultan Zainal Abidin</p>' +
'</td></tr>' +
// Body
'<tr><td style="padding:30px 40px">' +

'<p style="margin:0 0 16px">Assalamualaikum w.b.t. dan Salam Sejahtera,</p>' +

'<table cellpadding="0" cellspacing="0" style="background:#f9f9fb;border-left:3px solid #1a1a2e;padding:12px 16px;margin:0 0 20px;border-radius:0 4px 4px 0;width:100%">' +
'<tr><td>' + addrHtml +
'</td></tr></table>' +

'<p style="margin:0 0 16px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">TAJUK</p>' +
'<h2 style="font-size:15px;font-weight:600;color:#1a1a2e;margin:0 0 20px;line-height:1.4">Perkembangan Pengisian MQF 2.0 (2024) — Maklumat PEO, PLO, Domain MQF dan Taksonomi</h2>' +

// Status section
(statusBadge ? '<table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%"><tr><td style="text-align:center;padding:12px;background:#f9f9fb;border-radius:6px">Status Semasa: ' + statusBadge + (status.note ? '<br><span style="font-size:12px;color:#888;margin-top:4px;display:inline-block">' + e(status.note) + '</span>' : '') + '</td></tr></table>' : '') +

'<p style="margin:0 0 12px"><strong>1.</strong> Sukacita dimaklumkan perkembangan terkini inisiatif pengisian maklumat MQF 2.0 (2024) bagi 69 program pasca siswazah di bawah struktur penyelidikan yang sedang dipantau oleh Pusat Pengajian Siswazah (PPS).</p>' +

'<p style="margin:0 0 12px"><strong>2.</strong> Setakat ini, fakulti dan institut yang telah melengkapkan <strong>Checkpoint 1</strong> (PEO, PLO, Domain MQF dan Taksonomi) adalah seperti berikut:</p>' +

'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FBIM — Fakulti Biosumber &amp; Industri Makanan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FBK — Fakulti Bahasa dan Komunikasi</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FF — Fakulti Farmasi</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FP — Fakulti Perubatan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FPP — Fakulti Perniagaan dan Pengurusan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FSK — Fakulti Sains Kesihatan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#e6f7e6;border-bottom:1px solid #eee;font-size:13px;color:#2e7d32">&#10003; FUHA — Fakulti Undang-undang &amp; Hubungan Antarabangsa</td></tr>' +
'</table>' +

'<p style="margin:0 0 12px"><strong>3.</strong> Manakala fakulti dan institut yang masih dalam proses atau belum memulakan pengisian:</p>' +

'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:6px 12px;background:#fff8e1;border-bottom:1px solid #eee;font-size:13px;color:#f57f17">&#9679; FRIT — Separuh Jalan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#fff8e1;border-bottom:1px solid #eee;font-size:13px;color:#f57f17">&#9679; FSSG — Separuh Jalan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#fff8e1;border-bottom:1px solid #eee;font-size:13px;color:#f57f17">&#9679; INSPIRE — Separuh Jalan</td></tr>' +
'<tr><td style="padding:6px 12px;background:#fce4ec;border-bottom:1px solid #eee;font-size:13px;color:#c62828">&#10005; FIK — Belum Mula (masalah login)</td></tr>' +
'<tr><td style="padding:6px 12px;background:#fce4ec;font-size:13px;color:#c62828">&#10005; FKI — Belum Mula (masalah login)</td></tr>' +
'</table>' +

'<p style="margin:0 0 12px"><strong>4.</strong> Untuk makluman, setiap fakulti / institut telah diberikan <strong>tiga (3) login</strong> iaitu:</p>' +

'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:6px 12px;background:#f9f9fb;border-bottom:1px solid #eee;font-size:13px">• Timbalan Dekan Akademik &amp; Siswazah / Timbalan Pengarah</td></tr>' +
'<tr><td style="padding:6px 12px;background:#fff;border-bottom:1px solid #eee;font-size:13px">• Penyelaras Siswazah</td></tr>' +
'<tr><td style="padding:6px 12px;background:#f9f9fb;font-size:13px">• PIC Fakulti / Institut</td></tr>' +
'</table>' +

'<p style="margin:0 0 12px">Sekiranya pihak tuan/puan memerlukan tambahan akses untuk Penyelaras Program Akademik, sila maklumkan kepada PPS untuk pengemaskinian.</p>' +

// Checkpoints timeline
'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:12px 16px;background:#f3e5f5;border-radius:6px">' +
'<p style="margin:0 0 8px;font-size:13px;color:#6a1b9a"><strong>Timeline Checkpoint:</strong></p>' +
'<p style="margin:0 0 4px;font-size:13px;color:#333"><strong>Checkpoint 1 (23 Julai — Khamis):</strong> Masukkan PEO, PLO, Domain MQF &amp; Taksonomi &#10003;</p>' +
'<p style="margin:0;font-size:13px;color:#333"><strong>Checkpoint 2 (26 Julai — Ahad):</strong> Pemetaan lengkap — SDG (minimum 3 pada peringkat program), TF (Teras FlexS) dan SC (Ways of Thinking, Ways of Practicing, Ways of Being)</p>' +
'</td></tr></table>' +

'<p style="margin:0 0 12px"><strong>5.</strong> Peringatan penting: Parent PEO dipilih bagi setiap PLO. TF (Teras FlexS) dicadangkan berdasarkan Domain MQF yang dipilih, manakala SDG dan SC perlu dilengkapkan dalam modul. Fokus kepada Checkpoint 1 dahulu.</p>' +

// Links section
'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:12px 16px;background:#eef5ff;border-radius:6px">' +
'<p style="margin:0 0 6px;font-size:13px"><strong>Governan Program Akademik Pascasiswazah:</strong><br>' +
'<a href="' + e(governanceUrl) + '" style="color:#1a73e8;font-size:13px">' + e(governanceUrl) + '</a></p>' +
'<p style="margin:0;font-size:13px"><strong>Video Taklimat Perkembangan (JKPS):</strong><br>' +
'<a href="' + e(PROGRESS_VIDEO_URL) + '" style="color:#1a73e8;font-size:13px">' + e(PROGRESS_VIDEO_URL) + '</a></p>' +
'</td></tr></table>' +

'<p style="margin:0 0 12px"><strong>6.</strong> Sekiranya terdapat sebarang pertanyaan atau masalah teknikal, sila hubungi PPS di talian e-mel <a href="mailto:' + e(REPLY_TO) + '" style="color:#1a73e8;text-decoration:none">' + e(REPLY_TO) + '</a>.</p>' +

'<p style="margin:0 0 4px">Kerjasama dan komitmen tuan/puan dalam merealisasikan inisiatif ini amat dihargai dan didahului dengan ucapan terima kasih.</p>' +
'<p style="margin:0 0 20px">Sekian.</p>' +

'<p style="margin:0 0 2px">Yang benar,</p>' +
'<p style="margin:0;font-weight:600;color:#1a1a2e">DR. FATHURRAHMAN BIN LANANAN</p>' +
'<p style="margin:0;font-size:13px;color:#666">Timbalan Dekan (Akademik)</p>' +
'<p style="margin:0;font-size:13px;color:#666">Pusat Pengajian Siswazah</p>' +
'<p style="margin:0 0 20px;font-size:13px;color:#666">Universiti Sultan Zainal Abidin</p>' +

'</td></tr>' +
// Footer
'<tr><td style="background:#f9f9fb;padding:16px 40px;text-align:center;border-top:1px solid #eee">' +
'<p style="margin:0;font-size:11px;color:#999">E-mel ini dihasilkan secara automatik oleh Sistem Maklumat MQF 2.0 Pusat Pengajian Siswazah, UniSZA.</p>' +
'</td></tr></table>' +
'</td></tr></table></body></html>';
}


/* ===================================================================
   2. RECIPIENT LOOKUP (USER sheet)
   =================================================================== */

function getUserSheetColumns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
    return String(value || '').trim().toLowerCase();
  });
  function find(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var index = headers.indexOf(names[i]);
      if (index !== -1) return index;
    }
    return fallback;
  }
  return {
    faculty: find(['faculty', 'faculty code', 'faculty/centre'], 0),
    name: find(['name', 'staff name', 'user'], 1),
    email: find(['email', 'email address'], 2),
    position: find(['position', 'role', 'designation'], 3)
  };
}

function getFacultyRecipientData_(fac) {
  var ss = getSpreadsheet();
  var userSheet = ss.getSheetByName('USER');
  var fallback = TDA_DATA[fac] || {};
  var out = { facultyFull: fallback.full || fac, tdaName: '', tdaEmail: '', tdaRole: '', gcName: '', gcEmail: '', picName: '', picEmail: '' };
  if (!userSheet) return out;
  var data = userSheet.getDataRange().getValues();
  var columns = getUserSheetColumns_(userSheet);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][columns.faculty]).trim() === fac) {
      var name = String(data[i][columns.name] || '').trim();
      var email = String(data[i][columns.email] || '').trim();
      var position = String(data[i][columns.position] || '').trim();
      var positionLower = position.toLowerCase();
      if ((positionLower.indexOf('deputy dean') !== -1 && positionLower.indexOf('academic') !== -1) ||
          (positionLower.indexOf('timbalan dekan') !== -1 && positionLower.indexOf('akademik') !== -1) ||
          positionLower.indexOf('deputy director') !== -1 || positionLower.indexOf('timbalan pengarah') !== -1) {
        if (!out.tdaEmail) { out.tdaName = name; out.tdaEmail = email; out.tdaRole = position; }
      }
      if ((positionLower === 'graduate coordinator' || positionLower.indexOf('graduate coordinator') > -1 || positionLower.indexOf('penyelaras siswazah') > -1) && !out.gcEmail) {
        out.gcName = name;
        out.gcEmail = email;
      }
      if ((positionLower.indexOf('pic') > -1) && !out.picEmail) {
        out.picName = name;
        out.picEmail = email;
      }
    }
  }

  return out;
}

function getFacultyRecipients_(fac) {
  var ss = getSpreadsheet();
  var userSheet = ss.getSheetByName('USER');
  var to = [];
  if (userSheet) {
    var data = userSheet.getDataRange().getValues();
    var columns = getUserSheetColumns_(userSheet);
    data.slice(1).forEach(function(row) {
      if (String(row[columns.faculty] || '').trim() === fac) {
        var email = String(row[columns.email] || '').trim().toLowerCase();
        if (email && to.indexOf(email) === -1) to.push(email);
      }
    });
  }
  if (!userSheet) {
    var fallback = TDA_DATA[fac];
    if (fallback && fallback.email) to.push(fallback.email.toLowerCase());
  }
  return to;
}

function getFacultyCodes_() {
  var codes = {};
  var sheet = getSpreadsheet().getSheetByName('USER');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    var columns = getUserSheetColumns_(sheet);
    data.slice(1).forEach(function(row) {
      var faculty = String(row[columns.faculty] || '').trim();
      if (faculty) codes[faculty] = true;
    });
  }
  if (!sheet) Object.keys(TDA_DATA).forEach(function(faculty) { codes[faculty] = true; });
  return Object.keys(codes).sort();
}


/* ===================================================================
   3. FACULTY STATUS HELPER (from video transcript)
   =================================================================== */

/** Return status object for each faculty based on the JKPS briefing (23 Jul 2026) */
function getFacultyProgressStatus_(fac) {
  var map = {
    FBK:    { lbl: 'lengkap' },
    FBIM:   { lbl: 'lengkap' },
    FF:     { lbl: 'lengkap' },
    FP:     { lbl: 'lengkap' },
    FPP:    { lbl: 'lengkap' },
    FSK:    { lbl: 'lengkap' },
    FUHA:   { lbl: 'lengkap' },
    FRIT:   { lbl: 'separuh', note: 'Sedang dalam proses pengisian' },
    FSSG:   { lbl: 'separuh', note: 'Sedang dalam proses pengisian' },
    INSPIRE:{ lbl: 'separuh', note: 'Sedang dalam proses pengisian' },
    FIK:    { lbl: 'kosong', note: 'Masalah login — telah dihubungi pihak PPS' },
    FKI:    { lbl: 'kosong', note: 'Masalah login — telah dihubungi pihak PPS' },
    FUPL:   { lbl: '' },
    FPV:    { lbl: '' },
    ESERI:  { lbl: '' },
  };
  return map[fac] || { lbl: '' };
}


/* ===================================================================
   4. PROGRESS UPDATE SENDERS
   =================================================================== */

/**
 * sendTestProgressEmail — Send a test progress-update email to a custom recipient.
 * Use this for testing without sending to real faculty recipients.
 * Override fac, recipientName, recipientEmail, and position as needed.
 *
 * Example defaults: ESERI, Fathurrahman Lananan, fathur6@gmail.com, Penguji Sistem
 */
function sendTestProgressEmail() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');

  // --- CUSTOMISE THESE FOR TESTING ---
  var fac = 'ESERI';
  var recipientName = 'Fathurrahman Lananan';
  var recipientEmail = 'fathur6@gmail.com';
  var recipientPosition = 'Penguji Sistem';
  // --- END CUSTOMISATION ---

  var tda = TDA_DATA[fac];
  if (!tda) throw new Error('Unknown faculty: ' + fac);

  var status = getFacultyProgressStatus_(fac);

  // Build custom address block for test
  var subject = '[TEST] PERKEMBANGAN PENGISIAN MQF 2.0 (2024) — ' + fac;
  var htmlBody = buildProgressEmailHTML(fac, {
    gcName: recipientName,
    picName: '',
  }, status);

  // Replace the gcName in HTML with custom info
  // Since buildProgressEmailHTML already uses gcName, we just pass it

  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });

  return 'Test progress email sent to ' + recipientEmail + '\n' +
    'Faculty: ' + fac + ' (' + tda.full + ')\n' +
    'Recipient: ' + recipientName + ' (' + recipientPosition + ')\n' +
    'Status: ' + (status.lbl || 'default');
}


/**
 * sendProgressAnnouncement — Send the progress-update email to a specific faculty's real recipients.
 */
function sendProgressAnnouncement(fac) {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  fac = String(fac).toUpperCase();
  if (!TDA_DATA[fac]) throw new Error('Unknown faculty: ' + fac);

  var recip = getFacultyRecipientData_(fac);
  var toList = getFacultyRecipients_(fac);
  if (toList.length === 0) throw new Error('No recipients found for ' + fac);

  var status = getFacultyProgressStatus_(fac);
  var subject = 'PERKEMBANGAN PENGISIAN MQF 2.0 (2024) — ' + fac;
  var htmlBody = buildProgressEmailHTML(fac, {
    gcName: recip.gcName,
    picName: recip.picName,
  }, status);

  GmailApp.sendEmail(toList.join(','), subject, '', {
    htmlBody: htmlBody,
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });

  return 'Progress email sent to ' + fac + ': ' + toList.join(', ');
}


/**
 * sendAllProgressAnnouncements — Send progress-update email to all faculties/institutes.
 * Skips faculties where TDA_DATA entries lack recipient data.
 */
function sendAllProgressAnnouncements() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var results = [];
  var faculties = getFacultyCodes_();
  for (var i = 0; i < faculties.length; i++) {
    try {
      var r = sendProgressAnnouncement(faculties[i]);
      results.push({ faculty: faculties[i], status: 'OK', detail: r });
    } catch (e) {
      results.push({ faculty: faculties[i], status: 'ERROR', detail: e.message });
    }
  }
  return results;
}


/**
 * sendProgressAnnouncementsByFacultyList — Send progress-update email to selected faculties only.
 * @param {string} facList — JSON array of faculty codes, e.g. '["FBK","FIK","ESERI"]'
 */
function sendProgressAnnouncementsByFacultyList(facList) {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var results = [];
  var arr = JSON.parse(facList);
  for (var i = 0; i < arr.length; i++) {
    try {
      var r = sendProgressAnnouncement(arr[i]);
      results.push({ faculty: arr[i], status: 'OK', detail: r });
    } catch (e) {
      results.push({ faculty: arr[i], status: 'ERROR', detail: e.message });
    }
  }
  return results;
}


/* ===================================================================
   5. ORIGINAL ANNOUNCEMENT SENDERS (unchanged — keep for backward compat)
   =================================================================== */

function sendTestAnnouncement() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var fac = 'FBK';
  var recip = getFacultyRecipientData_(fac);
  var subject = '[TEST] PENGISIAN MAKLUMAT PEO, PLO DAN PEMETAAN MQF 2.0 (2024) — ' + fac;
  var htmlBody = buildEmailHTML(fac, {
    gcName: recip.gcName,
    picName: recip.picName,
  });

  var info = 'To: ' + recip.gcName + ' (GC), ' + recip.picName + ' (PIC), ' + TDA_DATA[fac].name + ' (TDA)';
  GmailApp.sendEmail('fathurrahman@unisza.edu.my', subject, '', {
    htmlBody: htmlBody,
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });

  return 'Test email sent to fathurrahman@unisza.edu.my\n' + info;
}


function sendAnnouncement(fac) {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  fac = String(fac).toUpperCase();
  if (!TDA_DATA[fac]) throw new Error('Unknown faculty: ' + fac);

  var recip = getFacultyRecipientData_(fac);
  var toList = getFacultyRecipients_(fac);
  if (toList.length === 0) throw new Error('No recipients found for ' + fac);

  var subject = 'PENGISIAN MAKLUMAT PEO, PLO DAN PEMETAAN MQF 2.0 (2024) — ' + fac;
  var htmlBody = buildEmailHTML(fac, {
    gcName: recip.gcName,
    picName: recip.picName,
  });

  GmailApp.sendEmail(toList.join(','), subject, '', {
    htmlBody: htmlBody,
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });

  return 'Email sent to ' + fac + ': ' + toList.join(', ');
}


function sendAllAnnouncements() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var results = [];
  var faculties = getFacultyCodes_();
  for (var i = 0; i < faculties.length; i++) {
    try {
      var r = sendAnnouncement(faculties[i]);
      results.push({ faculty: faculties[i], status: 'OK', detail: r });
    } catch (e) {
      results.push({ faculty: faculties[i], status: 'ERROR', detail: e.message });
    }
  }
  return results;
}


function sendAnnouncementsByFacultyList(facList) {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var results = [];
  var arr = JSON.parse(facList);
  for (var i = 0; i < arr.length; i++) {
    try {
      var r = sendAnnouncement(arr[i]);
      results.push({ faculty: arr[i], status: 'OK', detail: r });
    } catch (e) {
      results.push({ faculty: arr[i], status: 'ERROR', detail: e.message });
    }
  }
  return results;
}
