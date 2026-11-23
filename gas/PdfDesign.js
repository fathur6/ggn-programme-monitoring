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

var PDF_LOGO_CACHE_ = {};
var PDF_LOGO_SOURCES_ = {
  unisza: 'https://www.unisza.edu.my/wp-content/uploads/2021/04/logo_left-1024x385.png',
  gs: 'https://i.postimg.cc/L6bJj0H1/GS-logo-color-cropped.png'
};

/**
 * Logos are downloaded once and cached in Drive so later runs never depend on
 * an external host. A missing logo is skipped rather than failing the document.
 */
function pdfLogoBlob_(key) {
  if (Object.prototype.hasOwnProperty.call(PDF_LOGO_CACHE_, key)) return PDF_LOGO_CACHE_[key];
  PDF_LOGO_CACHE_[key] = null;

  try {
    var folder = pdfAssetsFolder_();
    var existing = folder.getFilesByName('logo-' + key + '.png');
    if (existing.hasNext()) {
      PDF_LOGO_CACHE_[key] = existing.next().getBlob();
      return PDF_LOGO_CACHE_[key];
    }
    var source = PDF_LOGO_SOURCES_[key];
    if (!source) return null;
    var response = UrlFetchApp.fetch(source, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    var blob = response.getBlob().setName('logo-' + key + '.png');
    folder.createFile(blob);
    PDF_LOGO_CACHE_[key] = blob;
    return blob;
  } catch (err) {
    console.error('pdf logo ' + key + ' unavailable: ' + (err && err.message ? err.message : err));
    return null;
  }
}

function pdfAssetsFolder_() {
  var folder = getPdfFolder_();
  var found = folder.getFoldersByName('Brand assets');
  if (found.hasNext()) return found.next();
  return folder.createFolder('Brand assets');
}

function pdfRound_(slide, x, y, width, height, fill, stroke) {
  var shape = slide.insertShape(SlidesApp.ShapeType.ROUNDED_RECTANGLE, x, y, width, height);
  shape.getFill().setSolidFill(fill || PDF_L_.white);
  var line = shape.getLine();
  line.setSolidFill(stroke || fill || PDF_L_.white);
  line.setWeight(0.75);
  return shape;
}

function pdfText_(slide, value, x, y, width, height, opts) {
  var options = opts || {};
  var box = slide.insertTextBox(String(value == null ? '' : value), x, y, width, height);
  var text = box.getText();
  var style = text.getTextStyle();
  style.setFontFamily('Arial');
  style.setFontSize(options.size || 8.6);
  style.setBold(!!options.bold);
  style.setForegroundColor(options.color || PDF_L_.ink);
  box.setContentAlignment(SlidesApp.ContentAlignment.TOP);
  if (options.align === 'right') {
    text.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);
  } else if (options.align === 'center') {
    text.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
  return box;
}

function pdfLogo_(slide, key, x, y, height, alignRight) {
  var blob = pdfLogoBlob_(key);
  if (!blob) return null;
  var image = slide.insertImage(blob);
  var ratio = image.getWidth() / (image.getHeight() || 1);
  var width = height * ratio;
  image.setWidth(width);
  image.setHeight(height);
  image.setTop(y);
  image.setLeft(alignRight ? x - width : x);
  return image;
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
  var slide = first ? state.slides[0] : state.pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  if (first) slide.setLayout(SlidesApp.PredefinedLayout.BLANK);
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
    pdfText_(state.slide, column.label, x + 7, state.y + 6.4, column.width - 10, 12, {
      size: 7.2, bold: true, color: PDF_L_.white
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
  var size = 8.5;
  pdfRound_(state.slide, PDF_L_.m, state.y, width, rowHeight,
    alternate ? PDF_L_.rowAlt : PDF_L_.white, PDF_L_.line);
  var x = PDF_L_.m;
  columns.forEach(function (column) {
    pdfText_(state.slide, row[column.key], x + 7, state.y + 6, column.width - 14,
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

  var presentation = SlidesApp.create('PDFTMP_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10));
  var presentationId = presentation.getId();
  try {
    presentation.setPageWidth(PDF_L_.w);
    presentation.setPageHeight(PDF_L_.h);

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
        { key: 'code', label: 'CODE', width: 44, bold: true },
        { key: 'statement', label: 'PLO STATEMENT', width: 205 },
        { key: 'parentPEO', label: 'PEO', width: 46, color: PDF_L_.muted },
        { key: 'mqfDomain', label: 'MQF', width: 52, color: PDF_L_.muted },
        { key: 'taxonomy', label: 'TAXONOMY', width: 52, color: PDF_L_.muted },
        { key: 'sdg', label: 'SDG', width: 38, color: PDF_L_.muted },
        { key: 'sc', label: 'SC', width: 40, color: PDF_L_.muted },
        { key: 'tf', label: 'TF', width: 38, color: PDF_L_.muted }
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
      var left = 'Generated by ' + (by || 'Pusat Pengajian Siswazah') + (email ? '  ·  ' + email : '');
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
