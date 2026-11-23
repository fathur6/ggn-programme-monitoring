/**
 * Modern PDF design for the programme information sheet.
 *
 * A temporary Google Slides deck is laid out at A4 portrait, then exported to
 * PDF with DriveApp. Slides is used instead of a spreadsheet because it can draw
 * rounded cards, place both logos precisely and keep the typography consistent.
 */

var PDF_L_ = {
  w: 595,
  h: 842,
  m: 40,
  gutter: 515,
  ink: '#10231C',
  green: '#0B3B2E',
  greenSoft: '#EDF5F0',
  gold: '#C9A227',
  muted: '#6B7A73',
  line: '#E4E9E6',
  card: '#F6F9F7',
  rowAlt: '#F8FBFA',
  white: '#FFFFFF'
};

var PDF_TEMPLATE_ID_ = '1SJzzwvvAi5ziEFt6P_PfvkNIAYBXcfZQstMavh4pKtU';
var PDF_LOGO_URLS_ = {
  unisza: 'https://www.unisza.edu.my/wp-content/uploads/2021/04/logo_left-1024x385.png',
  gs: 'https://i.postimg.cc/L6bJj0H1/GS-logo-color-cropped.png'
};

function pdfRound_(slide, x, y, width, height, fill, stroke) {
  var shapeType = SlidesApp.ShapeType.ROUND_RECTANGLE || SlidesApp.ShapeType.ROUNDED_RECTANGLE;
  var shape;
  try {
    shape = slide.insertShape(shapeType, x, y, width, height);
  } catch (err) {
    shape = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, width, height);
  }
  shape.getFill().setSolidFill(fill || PDF_L_.white);
  try {
    var line = shape.getLine();
    line.setSolidFill(stroke || fill || PDF_L_.white);
    line.setWeight(0.75);
  } catch (err) { /* outlines are optional */ }
  return shape;
}

function pdfText_(slide, value, x, y, width, height, opts) {
  var options = opts || {};
  var content = String(value == null ? '' : value);
  if (!content.trim()) return null;
  var box = slide.insertTextBox(content, x, y, width, height);
  var text = box.getText();
  try {
    var style = text.getTextStyle();
    style.setFontFamily('Arial');
    style.setFontSize(options.size || 8.6);
    style.setBold(!!options.bold);
    style.setForegroundColor(options.color || PDF_L_.ink);
  } catch (err) { /* keep the default style */ }
  try { box.setContentAlignment(SlidesApp.ContentAlignment.TOP); } catch (err) { /* middle is fine */ }
  if (options.align) {
    try {
      var alignments = SlidesApp.ParagraphAlignment;
      var value = options.align === 'right'
        ? (alignments.RIGHT || alignments.END)
        : alignments.CENTER;
      text.getParagraphStyle().setParagraphAlignment(value);
    } catch (err) { /* left alignment is the default */ }
  }
  return box;
}

function pdfLogo_(slide, key, x, y, height, alignRight) {
  var url = PDF_LOGO_URLS_[key];
  if (!url) return null;
  try {
    var image = slide.insertImage(url);
    var ratio = image.getWidth() / (image.getHeight() || 1);
    var width = height * ratio;
    image.setWidth(width);
    image.setHeight(height);
    image.setTop(y);
    image.setLeft(alignRight ? x - width : x);
    return image;
  } catch (err) {
    console.error('pdf logo ' + key + ' unavailable: ' + (err && err.message ? err.message : err));
    return null;
  }
}

function pdfTextHeight_(value, width, size, bold) {
  var charWidth = size * (bold ? 0.6 : 0.55);
  var perLine = Math.max(6, Math.floor(width / charWidth));
  var lines = 0;
  String(value == null ? '' : value).split('\n').forEach(function (segment) {
    lines += Math.max(1, Math.ceil((segment.length || 1) / perLine));
  });
  return lines * size * 1.32 + 2;
}

function pdfStartPage_(state, programme, code, first) {
  var existing = state.pres.getSlides();
  var slide = first && existing.length
    ? existing[0]
    : state.pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  state.slide = slide;
  state.page += 1;

  if (first) {
    pdfLogo_(slide, 'unisza', PDF_L_.m, 34, 30, false);
    pdfLogo_(slide, 'gs', PDF_L_.w - PDF_L_.m, 34, 30, true);
    pdfRound_(slide, PDF_L_.m, 78, PDF_L_.gutter, 0.8, PDF_L_.line);

    pdfText_(slide, 'PUSAT PENGAJIAN SISWAZAH  ·  GRADUATE SCHOOL', PDF_L_.m, 88, 400, 12, {
      size: 7.4, bold: true, color: PDF_L_.muted
    });
    pdfText_(slide, 'Programme Information', PDF_L_.m, 100, 420, 30, {
      size: 22, bold: true, color: PDF_L_.ink
    });
    pdfRound_(slide, PDF_L_.m, 134, 92, 17, PDF_L_.greenSoft);
    pdfText_(slide, 'MQF 2.0 (2024)', PDF_L_.m, 138.5, 92, 12, {
      size: 7.6, bold: true, color: PDF_L_.green, align: 'center'
    });

    pdfRound_(slide, PDF_L_.m, 162, PDF_L_.gutter, 78, PDF_L_.card);
    pdfText_(slide, state.name, PDF_L_.m + 16, 174, PDF_L_.gutter - 32, 18, {
      size: 13, bold: true, color: PDF_L_.ink
    });
    pdfText_(slide, state.metaLine, PDF_L_.m + 16, 196, PDF_L_.gutter - 32, 14, {
      size: 8.8, color: PDF_L_.muted
    });
    pdfText_(slide, state.facultyLine, PDF_L_.m + 16, 212, PDF_L_.gutter - 32, 14, {
      size: 8.4, color: PDF_L_.muted
    });
    state.y = 262;
  } else {
    pdfLogo_(slide, 'unisza', PDF_L_.m, 30, 18, false);
    pdfLogo_(slide, 'gs', PDF_L_.w - PDF_L_.m, 30, 18, true);
    pdfRound_(slide, PDF_L_.m, 56, PDF_L_.gutter, 0.8, PDF_L_.line);
    pdfText_(slide, state.name + '  ·  ' + code, PDF_L_.m, 64, 380, 12, {
      size: 8.2, bold: true, color: PDF_L_.muted
    });
    pdfText_(slide, 'MQF 2.0 (2024)', PDF_L_.w - PDF_L_.m - 120, 64, 120, 12, {
      size: 8.2, color: PDF_L_.muted, align: 'right'
    });
    state.y = 88;
  }
}

function pdfSectionHeading_(state, title, note) {
  var slide = state.slide;
  pdfRound_(slide, PDF_L_.m, state.y + 3, 4, 14, PDF_L_.gold);
  pdfText_(slide, title, PDF_L_.m + 12, state.y, 360, 20, {
    size: 12.4, bold: true, color: PDF_L_.green
  });
  if (note) {
    pdfText_(slide, note, PDF_L_.w - PDF_L_.m - 160, state.y + 3, 160, 14, {
      size: 8, color: PDF_L_.muted, align: 'right'
    });
  }
  state.y += 24;
}

function pdfTableHead_(state, columns, width) {
  var height = 22;
  pdfRound_(state.slide, PDF_L_.m, state.y, width, height, PDF_L_.green);
  var x = PDF_L_.m;
  columns.forEach(function (column) {
    pdfText_(state.slide, column.label, x + 4, state.y + 6.4, column.width - 8, 12, {
      size: 6.8, bold: true, color: PDF_L_.white
    });
    x += column.width;
  });
  state.y += height + 3;
}

function pdfRowHeight_(columns, row, size) {
  var inner = columns.map(function (column) {
    return pdfTextHeight_(row[column.key], column.width - 14, size, !!column.bold);
  });
  return Math.max.apply(null, inner) + 12;
}

function pdfDrawRow_(state, columns, row, width, rowHeight, alternate) {
  var size = 8.1;
  pdfRound_(state.slide, PDF_L_.m, state.y, width, rowHeight,
    alternate ? PDF_L_.rowAlt : PDF_L_.white, PDF_L_.line);
  var x = PDF_L_.m;
  columns.forEach(function (column) {
    pdfText_(state.slide, row[column.key], x + 4, state.y + 6, column.width - 8,
      rowHeight - 10, {
        size: size,
        bold: !!column.bold,
        color: column.color || (column.bold ? PDF_L_.ink : PDF_L_.ink)
      });
    x += column.width;
  });
  state.y += rowHeight + 3;
}

function pdfDrawTable_(state, spec) {
  if (!spec.rows.length) {
    pdfSectionHeading_(state, spec.title, spec.note);
    pdfText_(state.slide, spec.empty || 'Tiada rekod.', PDF_L_.m + 12, state.y, 400, 14, {
      size: 9, color: PDF_L_.muted
    });
    state.y += 28;
    return;
  }

  pdfSectionHeading_(state, spec.title, spec.note);
  pdfTableHead_(state, spec.columns, spec.width);

  spec.rows.forEach(function (row, index) {
    var height = pdfRowHeight_(spec.columns, row, 8.5);
    if (state.y + height > PDF_L_.h - 74) {
      pdfStartPage_(state, state.programme, state.code, false);
      pdfSectionHeading_(state, spec.title + ' (continued)', spec.note);
      pdfTableHead_(state, spec.columns, spec.width);
    }
    pdfDrawRow_(state, spec.columns, row, spec.width, height, index % 2 === 1);
  });
  state.y += 8;
}

/**
 * The Slides service cannot change a page size, so every document starts as a
 * copy of an A4 portrait template and is then filled in.
 */
function pdfOpenTemplate_(title) {
  try {
    var copy = DriveApp.getFileById(PDF_TEMPLATE_ID_).makeCopy(title);
    var presentation = SlidesApp.openById(copy.getId());
    var existing = presentation.getSlides();
    for (var i = existing.length - 1; i >= 0; i--) {
      try { existing[i].remove(); } catch (e) { /* keep going */ }
    }
    return presentation;
  } catch (err) {
    console.error('PDF template unavailable: ' + (err && err.message ? err.message : err));
    return null;
  }
}

function buildProgrammePdfBlob_(programme, detail, code, meta) {
  var info = meta || {};
  var name = programme && programme.name ? programme.name : code;
  var level = programme ? programme.level || '' : '';
  var faculty = programme ? (programme.facultyFull || programme.faculty || '') : '';
  var progCode = programme ? programme.progCode || '' : '';
  var generatedAt = info.generatedAt ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm');
  var filename = info.filename || filenameBase_(code);
  var by = info.by || '';
  var email = info.email || '';

  var deckTitle = 'PDFTMP_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  var presentation = pdfOpenTemplate_(deckTitle) || SlidesApp.create(deckTitle);
  var presentationId = presentation.getId();
  try {

    var state = {
      pres: presentation,
      slides: presentation.getSlides(),
      slide: null,
      y: 0,
      page: 0,
      programme: programme,
      code: code,
      name: name,
      metaLine: [
        code,
        progCode ? 'Programme code ' + progCode : '',
        level
      ].filter(Boolean).join('   ·   '),
      facultyLine: faculty || '',
      generatedAt: generatedAt,
      filename: filename,
      by: by,
      email: email
    };
    state.slides = presentation.getSlides();
    pdfStartPage_(state, programme, code, true);

    var peos = detail.peos || [];
    var plos = detail.plos || [];

    pdfDrawTable_(state, {
      title: 'PEO — Programme Educational Objectives',
      note: peos.length + ' records',
      width: PDF_L_.gutter,
      empty: 'Tiada rekod PEO.',
      columns: [
        { key: 'code', label: 'CODE', width: 58, bold: true },
        { key: 'statement', label: 'PEO STATEMENT', width: 372 },
        { key: 'mqfDomain', label: 'MQF DOMAIN', width: 85, color: PDF_L_.muted }
      ],
      rows: peos.map(function (peo) {
        return {
          code: peo.code,
          statement: peo.statement || '',
          mqfDomain: peo.mqfDomain || ''
        };
      })
    });

    pdfDrawTable_(state, {
      title: 'PLO — Programme Learning Outcomes',
      note: plos.length + ' records',
      width: PDF_L_.gutter,
      empty: 'Tiada rekod PLO.',
      columns: [
        { key: 'code', label: 'CODE', width: 56, bold: true },
        { key: 'statement', label: 'PLO STATEMENT', width: 170 },
        { key: 'parentPEO', label: 'PEO', width: 48, color: PDF_L_.muted },
        { key: 'mqfDomain', label: 'MQF', width: 54, color: PDF_L_.muted },
        { key: 'taxonomy', label: 'TAX', width: 42, color: PDF_L_.muted },
        { key: 'sdg', label: 'SDG', width: 54, color: PDF_L_.muted },
        { key: 'sc', label: 'SC', width: 46, color: PDF_L_.muted },
        { key: 'tf', label: 'TF', width: 45, color: PDF_L_.muted }
      ],
      rows: plos.map(function (plo) {
        return {
          code: plo.code,
          statement: plo.statement || '',
          parentPEO: plo.parentPEO || '',
          mqfDomain: plo.mqfDomain || '',
          taxonomy: plo.taxonomy || '',
          sdg: isSDGEligiblePLO_(plo.code, code, programme && programme.faculty) ? plo.sdg || '' : '',
          sc: plo.sc || '',
          tf: plo.tf || ''
        };
      })
    });

    var slides = presentation.getSlides();
    var total = slides.length;
    slides.forEach(function (slide, index) {
      pdfRound_(slide, PDF_L_.m, PDF_L_.h - 56, PDF_L_.gutter, 0.8, PDF_L_.line);
      var who = by && by !== email ? by + '  ·  ' + email : (email || by || 'Pusat Pengajian Siswazah');
      var left = 'Generated by ' + who;
      pdfText_(slide, left, PDF_L_.m, PDF_L_.h - 46, 330, 12, {
        size: 7.2, color: PDF_L_.muted
      });
      pdfText_(slide, filename + '.pdf  ·  ' + generatedAt + '  ·  ' + (index + 1) + '/' + total,
        PDF_L_.w - PDF_L_.m - 215, PDF_L_.h - 46, 215, 12, {
          size: 7.2, color: PDF_L_.muted, align: 'right'
        });
    });

    presentation.saveAndClose();
    var file = DriveApp.getFileById(presentationId);
    var blob = file.getAs(MimeType.PDF);
    blob.setName(filenameBase_(code) + '.pdf');
    return blob;
  } finally {
    if (presentationId) {
      try { DriveApp.getFileById(presentationId).setTrashed(true); } catch (e) { /* cleanup */ }
    }
  }
}

/**
 * Run once from the Apps Script editor if the presentations permission is ever
 * missing. It creates a throwaway deck and removes it again.
 */
function authorizePdfDesign() {
  var deck = SlidesApp.create('PDF design authorisation probe');
  var id = deck.getId();
  deck.saveAndClose();
  DriveApp.getFileById(id).setTrashed(true);
  return 'Slides permission granted.';
}
