/** EmailService.gs — Send MQF 2.0 announcement emails */

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
var MODULE_URL = 'https://script.google.com/a/macros/unisza.edu.my/s/AKfycbzZZIPnn2QpJ1TNYLXTVvrq6shPEskEh0r0lQg3aOZQ0PASK1nNWw3tEC699rkw7SSXfA/exec';
var VIDEO_URL = 'https://youtu.be/8F2r0dBkDVQ';


function buildEmailHTML(fac, recip) {
  var tda = TDA_DATA[fac];
  if (!tda) return '';
  recip = recip || {};

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
'<td style="padding:8px 12px;background:#fff;border-bottom:1px solid #eee;font-size:13px">PLO (Program Learning Outcomes) dan penerangan, serta pemetaan Domain MQF yang bersesuaian bagi setiap PLO; dan</td></tr>' +
'<tr><td style="padding:8px 12px;background:#f9f9fb;font-size:13px;vertical-align:top;width:24px;color:#1a1a2e;font-weight:600">iii.</td>' +
'<td style="padding:8px 12px;background:#f9f9fb;font-size:13px">Pemetaan PLO dengan PEO yang berkaitan.</td></tr></table>' +

// Links section
'<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%">' +
'<tr><td style="padding:12px 16px;background:#eef5ff;border-radius:6px">' +
'<p style="margin:0 0 6px;font-size:13px"><strong>Modul MQF 2.0 (2024):</strong><br>' +
'<a href="' + e(MODULE_URL) + '" style="color:#1a73e8;font-size:13px">' + e(MODULE_URL) + '</a></p>' +
'<p style="margin:0;font-size:13px"><strong>Video Tutorial:</strong><br>' +
'<a href="' + e(VIDEO_URL) + '" style="color:#1a73e8;font-size:13px">' + e(VIDEO_URL) + '</a></p>' +
'</td></tr></table>' +

'<p style="margin:0 0 12px"><strong>4.</strong> Sekiranya terdapat sebarang pertanyaan atau masalah teknikal, sila hubungi PPS di talian e-mel <a href="mailto:' + e(REPLY_TO) + '" style="color:#1a73e8;text-decoration:none">' + e(REPLY_TO) + '</a>. PPS memohon jasa baik fakulti / institut untuk melengkapkan maklumat ini selewat-lewatnya <strong>Khamis, 16 Julai 2026</strong>.</p>' +

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


// PIC sheet columns: Faculty | Grad Coordinator | GC Email | PIC Name | PIC Email
function getFacultyRecipientData_(fac) {
  var ss = getSpreadsheet();
  var pic = ss.getSheetByName('PIC');
  var data = pic.getDataRange().getValues();
  var out = { gcName: '', gcEmail: '', picName: '', picEmail: '' };

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === fac) {
      out.gcName = String(data[i][1] || '').trim();
      out.gcEmail = String(data[i][2] || '').trim();
      out.picName = String(data[i][3] || '').trim();
      out.picEmail = String(data[i][4] || '').trim();
      break;
    }
  }

  return out;
}

function getFacultyRecipients_(fac) {
  var d = getFacultyRecipientData_(fac);
  var to = [];
  if (d.gcEmail) to.push(d.gcEmail);
  if (d.picEmail) to.push(d.picEmail);
  var tda = TDA_DATA[fac];
  if (tda && tda.email) to.push(tda.email);
  return to;
}


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
    replyTo: REPLY_TO,
  });

  return 'Email sent to ' + fac + ': ' + toList.join(', ');
}


function sendAllAnnouncements() {
  if (!isGraduateSchoolAdmin_(getCurrentUser_())) throw new Error('Graduate School admin only');
  var results = [];
  var faculties = Object.keys(TDA_DATA);
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
