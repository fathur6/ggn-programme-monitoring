/** AssessmentService.gs - immutable JAPSU definitions and programme alignment. */

var ASSESSMENT_SHEET_HEADERS = {
  PR_AssessmentInstruments: ['InstrumentId', 'Code', 'Name', 'Description', 'StudyLevelsJson', 'TotalMarks', 'SortOrder', 'SourceKey', 'SourceDocument', 'SourceStatus', 'Active'],
  PR_AssessmentCategories: ['CategoryId', 'InstrumentId', 'Code', 'Name', 'SortOrder', 'SourceKey', 'Active'],
  PR_AssessmentItems: ['ItemId', 'InstrumentId', 'CategoryId', 'Code', 'Title', 'Descriptor', 'DescriptorMs', 'MaxMarks', 'SortOrder', 'DefaultMQFDomainsJson', 'DefaultTaxonomy', 'DefaultPrimarySC', 'DefaultPrimarySCSource', 'SourceKey', 'Active'],
  PR_AssessmentAlignments: ['ProgrammeId', 'ItemId', 'MQFDomainsJson', 'Taxonomy', 'PrimarySC', 'Note', 'UpdatedAt', 'UpdatedBy']
};

var ASSESSMENT_SOURCE_DOCUMENTS_ = {
  master: 'JAPSU - Rubric for Master Thesis Report.docx',
  phd: 'JAPSU - Rubric for PhD Thesis Report.docx',
  viva: 'JAPSU - Report for Examination of Viva Voce.docx',
  progress: 'JAPSU - Rubric for Progress Report Evaluation.docx'
};

var ASSESSMENT_CATEGORY_DEFINITIONS_ = [
  {code: 'CAT1', name: 'Kategori 1 — Framing Penyelidikan, Jurang Ilmu & Sumbangan Asli', sections: ['1', '2', '3', '4', '5', '6', '7']},
  {code: 'CAT2', name: 'Kategori 2 — Metodologi, Pelaksanaan & Integriti Kesarjanaan', sections: ['8']},
  {code: 'CAT3', name: 'Kategori 3 — Dapatan, Penaakulan & Perbincangan Berasaskan Eviden', sections: ['9']},
  {code: 'CAT4', name: 'Kategori 4 — Kesimpulan, Impak, Nilai Ciptaan & Kualiti Tesis', sections: ['10', '11']}
];

var ASSESSMENT_DEFINITION_CACHE_ = null;
var ASSESSMENT_ROWS_CACHE_ = {};
var ASSESSMENT_SHEETS_CACHE_ = null;

function assessmentUnique_(values) {
  var seen = {};
  var result = [];
  (Array.isArray(values) ? values : []).forEach(function(value) {
    var item = String(value == null ? '' : value).trim();
    if (item && !seen[item]) {
      seen[item] = true;
      result.push(item);
    }
  });
  return result;
}

function assessmentJson_(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch (e) { return []; }
}

function assessmentStudyLevel_(value) {
  var level = String(value || '').trim().toLowerCase();
  if (level === 'master' || level === 'masters' || level === 'master degree') return 'Masters';
  if (level === 'phd' || level === 'doctorate' || level === 'doctoral' || level === 'ph.d.') return 'Doctorate';
  return '';
}

function assessmentProgrammeLevel_(programme) {
  return assessmentStudyLevel_(programme && (programme.level || programme.studyLevel));
}

function assessmentItem_(instrumentCode, categoryCode, code, title, descriptor, descriptorMs, marks, order, mqf, taxonomy, sc, sourceKey, source) {
  return {
    instrumentCode: instrumentCode,
    categoryCode: categoryCode || '',
    code: code,
    title: title,
    descriptor: descriptor,
    descriptorMs: descriptorMs || '',
    maxMarks: marks,
    sortOrder: order,
    defaultMQFDomains: [mqf],
    defaultTaxonomy: taxonomy,
    defaultPrimarySC: sc,
    defaultPrimarySCSource: source || 'Source-derived competency mapping',
    sourceKey: sourceKey
  };
}

function assessmentThesisItems_(level) {
  var phd = level === 'Doctorate';
  var source = phd ? ASSESSMENT_SOURCE_DOCUMENTS_.phd : ASSESSMENT_SOURCE_DOCUMENTS_.master;
  var title = phd ? 'Ph.D. Thesis Examination Report' : 'Master Thesis Examination Report';
  var c5 = 'C5', c6 = 'C6', a4 = 'A4', a5 = 'A5';
  var items = [];
  function add(category, code, label, descriptor, mqf, taxonomy, sc) {
    items.push(assessmentItem_('THESIS_' + (phd ? 'PHD' : 'MASTER'), category, code, label, descriptor, '', 5, items.length, mqf, taxonomy, sc, 'japsu-2026-' + (phd ? 'phd' : 'master') + '-' + code.toLowerCase(), 'Source-derived competency mapping'));
  }
  add('CAT1', 'S1', 'Section 1: Relevance of Thesis Title', phd ? 'The candidate formulates an original title that synthesises and accurately represents the research problem, contribution, and novelty.' : 'The candidate evaluates the thesis title to reflect the actual research issue, with emphasis on clarity, accuracy, and appropriateness.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S2', 'Section 2: Abstract', phd ? 'The candidate constructs an abstract to reflect the research accurately and demonstrates originality, coherence, and contribution, encapsulating the novelty of the work.' : 'The candidate appraises the abstract accurately and clearly reflects the research (problem, objectives, methodology, findings, and significance) with emphasis on clarity, conciseness, and organisation.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S3', 'Section 3: Problem Statements', phd ? 'The candidate appraises original problem statements and research gaps. The emphasis is on novelty, originality, and contribution to knowledge.' : 'The candidate judges the problem statement and research gaps with emphasis on the assessment of clarity, justification, and logic.', 'MQF2', c5, 'SC3');
  add('CAT1', 'S4', 'Section 4: Research Questions', phd ? 'The candidate formulates research questions that not only address the research problems but also advance knowledge in a novel direction.' : 'The candidate evaluates the research questions to be clearly aligned with and to sufficiently address the research problems.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S5', 'Section 5: Research Objectives', phd ? 'The candidate constructs original research objectives that demonstrate SMARTness (Specific, Measurable, Achievable, Relevant and Time-Bound), novelty, and clear contribution by aligning questions, methodology, and experimental design.' : 'The candidate evaluates the clarity, SMARTness (Specific, Measurable, Achievable, Relevant and Time-Bound) and alignment of research objectives with the questions, methodology, and design of experiments.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S6A', 'Section 6a: Relevance / Significance of the Study', phd ? 'The candidate appraises the stated significance and relevance of the study, linking it to potential value.' : 'The candidate appraises the stated significance and relevance of the study, linking it to potential value.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S6B', 'Section 6b: Relevance / Significance of the Study', 'The candidate articulates how the study’s outcomes can be applied to policy, industry, community and/or further research, demonstrating potential impact, value creation and alignment with relevant stakeholders.', 'MQF4b', phd ? a5 : a4, 'SC4');
  add('CAT1', 'S7A', 'Section 7a: Literature Review', phd ? 'The candidate constructs a coherent body of knowledge through the literature review that establishes originality and contribution.' : 'The candidate evaluates the comprehensiveness, relevance, and organisation of the literature review.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT1', 'S7B', 'Section 7b: Literature Review', phd ? 'The candidate synthesises an original body of knowledge from the literature, critically integrating diverse perspectives into a coherent framework. The review not only identifies strengths, weaknesses, and gaps but also formulates new directions, theoretical insights, or conceptual frameworks that demonstrate originality and contribution to the field.' : 'The candidate appraises the literature by comparing, contrasting, and judging the relevance of previous studies. The review highlights strengths, weaknesses, and gaps with logical justification, showing responsibility in integrating sources to support the research problem.', 'MQF2', phd ? c5 : c5, 'SC3');
  add('CAT2', 'S8A', 'Section 8a: Methodology, Research design and Research Ethics', phd ? 'The candidate designs original methodological approaches, demonstrating innovation and ethical rigour in alignment with objectives.' : 'The candidate evaluates the methodology and data collection to be sufficient, appropriate, and ethically aligned with objectives.', 'MQF2', phd ? c6 : c5, 'SC6');
  add('CAT2', 'S8B', 'Section 8b: Methodology, Research design and Research Ethics', phd ? 'The candidate adapts instruments/implementations with originality and sophistication to achieve objectives and measure variables.' : 'The candidate adapts appropriate instruments, tools or techniques to achieve objectives and measure variables.', 'MQF3a', phd ? 'P6' : 'P5', 'SC6');
  add('CAT2', 'S8C', 'Section 8c: Methodology, Research design and Research Ethics', phd ? 'The candidate embodies digital scholarship as a professional value — innovatively, ethically, and consistently synthesising advanced digital tools/software to construct original contributions and ensure strong alignment with research objectives.' : 'The candidate organises responsible, consistent, and ethical values in their use of digital tools/software in data analysis practices and align methods with research objectives.', 'MQF3d', phd ? a5 : a4, 'SC6');
  add('CAT2', 'S8D', 'Section 8d: Methodology, Research design and Research Ethics', phd ? 'The candidate embodies ethics and professionalism as a scholarly value, demonstrating originality, leadership, and sustained commitment to research integrity and ethical scholarship.' : 'The candidate integrates responsibility, research integrity and professionalism in their conduct and research environment.', 'MQF5', phd ? a5 : a4, 'SC6');
  add('CAT3', 'S9A', 'Section 9a: Results and Discussion', phd ? 'The candidate organises responsible, consistent, and ethical values in applying and interpreting numerical and quantitative reasoning within their research.' : 'The candidate organises responsible, consistent, and ethical values in applying and interpreting numerical and quantitative reasoning within their research.', 'MQF3e', phd ? a5 : a4, 'SC3');
  add('CAT3', 'S9B', 'Section 9b: Results and Discussion', phd ? 'The candidate presents relevant, supported theoretical or practical implications, showing logical consistency with the research questions, hypotheses, and conceptual framework.' : 'The candidate presents relevant, supported theoretical or practical implications, showing logical consistency with the research questions, hypotheses, and conceptual framework.', 'MQF2', phd ? c6 : c5, 'SC3');
  add('CAT3', 'S9C', 'Section 9c: Results and Discussion', 'The candidate presents numerical and statistical data (e.g. tables, figures, graphs) clearly, accurately and appropriately, enabling correct interpretation and supporting the research arguments.', 'MQF3e', phd ? a5 : a4, 'SC6');
  add('CAT4', 'S10A', 'Section 10a: Conclusion', phd ? 'The candidate synthesises original implications and contributions that demonstrate novelty, originality, and potential to advance theoretical understanding or practical application with forward-looking value.' : 'The candidate presents relevant, supported theoretical or practical implications of the research, with emphasis on logical justification and value.', 'MQF2', phd ? c6 : c5, 'SC2');
  add('CAT4', 'S10B', 'Section 10b: Conclusion', phd ? 'The candidate embodies entrepreneurial skill as a scholarly value, synthesising and constructing opportunities for originality, innovation, and significant contribution to society or the knowledge economy.' : 'The candidate integrates responsibility and consistency as guiding values in identifying applications, impacts, or value creation from research outcomes.', 'MQF4b', phd ? a5 : a4, 'SC4');
  add('CAT4', 'S11A', 'Section 11a: Quality of Thesis', phd ? 'The candidate embodies communication as a scholarly value, synthesises and constructs compelling discussions that highlight originality, multiple perspectives (positive/negative), and contribution to disciplinary knowledge.' : 'The candidate embodies responsibility and professionalism in an in-depth discussion of findings, linking implications to the broader context of current knowledge.', 'MQF3c', a5, 'SC3');
  add('CAT4', 'S11B', 'Section 11b: Quality of Thesis', phd ? 'The candidate embodies written communication as a professional value, producing a thesis that is exemplary in structure, coherence, and scholarly presentation.' : 'The candidate embodies responsibility and consistency by presenting a thesis that reflects clear organisation, ensuring a logical flow of ideas.', 'MQF3c', a5, 'SC3');
  return {code: 'THESIS_' + (phd ? 'PHD' : 'MASTER'), name: title, description: 'JAPSU thesis examination rubric.', studyLevels: [level], totalMarks: 100, sourceDocument: source, sourceKey: 'japsu-2026-' + (phd ? 'phd' : 'master') + '-thesis', items: items};
}

function assessmentVivaInstrument_(level) {
  var phd = level === 'Doctorate';
  var instrumentCode = 'VIVA_' + (phd ? 'PHD' : 'MASTER');
  var taxonomy = phd ? 'A5' : 'A4';
  var items = [
    assessmentItem_(instrumentCode, '', 'V1', 'Interpersonal Skills', 'Ability to engage, communicate, and interact professionally with examiners.', '', 5, 0, 'MQF3b', taxonomy, 'SC5', 'japsu-2026-viva-' + (phd ? 'phd' : 'master') + '-v1'),
    assessmentItem_(instrumentCode, '', 'V2', 'Communication Skills', 'Ability to convey research ideas clearly and defend his/her work during viva voce.', '', 5, 1, 'MQF3c', taxonomy, 'SC7', 'japsu-2026-viva-' + (phd ? 'phd' : 'master') + '-v2'),
    assessmentItem_(instrumentCode, '', 'V3', 'Digital skills', 'Ability to use digital tools in his/her viva voce presentation.', '', 5, 2, 'MQF3d', taxonomy, 'SC6', 'japsu-2026-viva-' + (phd ? 'phd' : 'master') + '-v3'),
    assessmentItem_(instrumentCode, '', 'V4', 'Leadership, Autonomy & Responsibility', 'Ability to show ownership of research, independence, and academic integrity.', '', 5, 3, 'MQF3f', taxonomy, 'SC8', 'japsu-2026-viva-' + (phd ? 'phd' : 'master') + '-v4'),
    assessmentItem_(instrumentCode, '', 'V5', 'Personal Skills', 'Demonstrates motivation, emotional control, adaptability, and confidence throughout his/her viva voce.', '', 5, 4, 'MQF4a', taxonomy, 'SC7', 'japsu-2026-viva-' + (phd ? 'phd' : 'master') + '-v5')
  ];
  return {code: instrumentCode, name: 'Report for Examination of Viva Voce', description: 'JAPSU viva voce examination rubric.', studyLevels: [level], totalMarks: 25, sourceDocument: ASSESSMENT_SOURCE_DOCUMENTS_.viva, sourceKey: 'japsu-2026-viva-' + (phd ? 'phd' : 'master'), items: items};
}

function assessmentProgressInstrument_(level) {
  var phd = level === 'Doctorate';
  var instrumentCode = 'PROGRESS_' + (phd ? 'PHD' : 'MASTER');
  var items = [
    assessmentItem_(instrumentCode, '', 'P1', 'Minat dan komitmen / Interest and commitment', 'The candidate demonstrates strong motivation and sustained commitment in advancing his/her research.', '', 5, 0, 'MQF4b', phd ? 'A5' : 'A4', 'SC4', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p1', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P2', 'Autonomi dan tanggungjawab / Autonomy and responsibility', 'The candidate recognises and organises the balance between freedom and responsibility in planning and executing research tasks, while critically evaluating feedback and ethical considerations into their research practices.', '', 5, 1, 'MQF3f', 'A4', 'SC8', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p2', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P3', 'Integriti / Integrity', 'The candidate embodies and upholds academic integrity through transparent data management, ethical compliance, and critical appraisal of their own scholarly practices.', '', 5, 2, 'MQF5', 'A5', 'SC8', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p3', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P4', 'Disiplin / Discipline', 'The candidate demonstrates professional commitment and discipline by consistently upholding ethical practice in research conduct, while critically appraising time management, adherence to guidelines, and professional standards.', '', 5, 3, 'MQF4a', 'A5', 'SC8', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p4', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P5', 'Keupayaan untuk bekerja secara berdikari / Ability to work independently', 'The candidate coordinates and adapts research tasks with minimal supervision, skilfully integrating critical self-evaluation and strategy adjustment to responsibly achieve research objectives.', '', 5, 4, 'MQF3a', 'P4', 'SC6', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p5', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P6', 'Kualiti kerja / Work quality', 'The candidate adapts research practices to consistently produce high-quality outputs that reflect critical evaluation of methodology, accuracy, and reliability, while adhering to ethical and professional standards.', '', 5, 5, 'MQF3a', phd ? 'P5' : 'P4', 'SC6', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p6', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P7', 'Kemahiran komunikasi lisan / Verbal communication skill', 'The candidate integrates responsible and adaptable communication values by effectively evaluating and articulating complex research ideas in oral discussions, aligning strategies to engage diverse academic audiences.', '', 5, 6, 'MQF3c', 'A4', 'SC5', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p7', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P8', 'Kemahiran komunikasi bertulis / Written communication skill', 'The candidate organizes scholarly writing values by critically evaluating and producing coherent academic work that systematically incorporates evidence, demonstrates logical flow, and adheres to established conventions.', '', 5, 7, 'MQF3c', 'A4', 'SC5', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p8', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P9', 'Kemahiran berfikir kritis / Critical thinking skill', 'The candidate critically evaluates evidence, assumptions, limitations and alternative approaches, and uses sound reasoning to justify research decisions and planned strategy adjustments.', 'Calon menilai secara kritikal bukti, andaian, limitasi dan pendekatan alternatif, serta menggunakan penaakulan yang kukuh untuk menjustifikasikan keputusan penyelidikan dan pelarasan strategi yang dirancang.', 5, 8, 'MQF2', 'C5', 'SC3', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p9', 'PPS-curated Primary SC'),
    assessmentItem_(instrumentCode, '', 'P10', 'Keupayaan untuk menyampaikan maklumat atau idea / Ability to convey information or ideas (Social skills and responsibilities)', 'The candidate integrates responsible communication values by effectively conveying and justifying research ideas, while critically aligning them with social responsibilities and professional implications.', '', 5, 9, 'MQF3b', 'A4', 'SC5', 'japsu-2026-progress-' + (phd ? 'phd' : 'master') + '-p10', 'PPS-curated Primary SC')
  ];
  return {code: instrumentCode, name: 'Rubric for Progress Report Evaluation', description: 'JAPSU progress report evaluation rubric.', studyLevels: [level], totalMarks: 50, sourceDocument: ASSESSMENT_SOURCE_DOCUMENTS_.progress, sourceKey: 'japsu-2026-progress-' + (phd ? 'phd' : 'master'), items: items};
}

function buildAssessmentDefinitions_() {
  var thesisMaster = assessmentThesisItems_('Masters');
  var thesisPhd = assessmentThesisItems_('Doctorate');
  return [thesisMaster, thesisPhd, assessmentVivaInstrument_('Masters'), assessmentVivaInstrument_('Doctorate'), assessmentProgressInstrument_('Masters'), assessmentProgressInstrument_('Doctorate')].map(function(instrument, instrumentIndex) {
    var categoryMap = {};
    instrument.items.forEach(function(item) {
      if (!categoryMap[item.categoryCode]) categoryMap[item.categoryCode] = [];
      if (item.categoryCode) categoryMap[item.categoryCode].push(item);
    });
    instrument.categories = instrument.code.indexOf('THESIS_') === 0 ? ASSESSMENT_CATEGORY_DEFINITIONS_.map(function(category, index) {
      return {code: category.code, name: category.name, sortOrder: index, sourceKey: instrument.sourceKey + '-' + category.code.toLowerCase(), items: categoryMap[category.code] || []};
    }) : [];
    instrument.sortOrder = instrumentIndex;
    instrument.sourceStatus = 'Draft';
    instrument.active = true;
    return instrument;
  });
}

function ensureAssessmentSheets_() {
  if (ASSESSMENT_SHEETS_CACHE_) return ASSESSMENT_SHEETS_CACHE_;
  var ss = getSpreadsheet();
  var result = withResearchLockRetry_(function() {
    return ensureAssessmentSheetsNoLock_(ss);
  });
  ASSESSMENT_SHEETS_CACHE_ = result;
  return result;
}

function ensureAssessmentSheetsNoLock_(ss) {
  var result = {};
  Object.keys(ASSESSMENT_SHEET_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(ASSESSMENT_SHEET_HEADERS[name]);
    result[name] = sheet;
  });
  seedAssessmentDefinitions_(result);
  return result;
}

function seedAssessmentDefinitions_(sheets) {
  var definitions = buildAssessmentDefinitions_();
  var instruments = sheets.PR_AssessmentInstruments.getDataRange().getValues();
  var categories = sheets.PR_AssessmentCategories.getDataRange().getValues();
  var items = sheets.PR_AssessmentItems.getDataRange().getValues();
  var instrumentCodes = {}, categoryKeys = {}, itemKeys = {};
  instruments.slice(1).forEach(function(row) { instrumentCodes[String(row[1] || '')] = true; });
  categories.slice(1).forEach(function(row) { categoryKeys[String(row[1] || '') + '|' + String(row[2] || '')] = true; });
  items.slice(1).forEach(function(row) { itemKeys[String(row[1] || '') + '|' + String(row[3] || '')] = true; });
  definitions.forEach(function(instrument) {
    if (!instrumentCodes[instrument.code]) {
      sheets.PR_AssessmentInstruments.appendRow([instrument.sourceKey, instrument.code, instrument.name, instrument.description,
        JSON.stringify(instrument.studyLevels), instrument.totalMarks, instrument.sortOrder, instrument.sourceKey,
        instrument.sourceDocument, instrument.sourceStatus, instrument.active]);
      instrumentCodes[instrument.code] = true;
    }
    instrument.categories.forEach(function(category) {
      var categoryKey = instrument.code + '|' + category.code;
      if (!categoryKeys[categoryKey]) {
        sheets.PR_AssessmentCategories.appendRow([instrument.sourceKey + '-' + category.code.toLowerCase(), instrument.sourceKey, category.code, category.name, category.sortOrder, category.sourceKey, true]);
        categoryKeys[categoryKey] = true;
      }
    });
    instrument.items.forEach(function(item) {
      var itemKey = instrument.code + '|' + item.code;
      if (!itemKeys[itemKey]) {
        sheets.PR_AssessmentItems.appendRow([item.sourceKey, instrument.sourceKey, item.categoryCode, item.code, item.title, item.descriptor, item.descriptorMs,
          item.maxMarks, item.sortOrder, JSON.stringify(item.defaultMQFDomains), item.defaultTaxonomy, item.defaultPrimarySC,
          item.defaultPrimarySCSource, item.sourceKey, true]);
        itemKeys[itemKey] = true;
      }
    });
  });
  ASSESSMENT_DEFINITION_CACHE_ = null;
}

function assessmentRows_(sheet) {
  var name = sheet.getName ? sheet.getName() : '';
  if (name && ASSESSMENT_ROWS_CACHE_[name]) return ASSESSMENT_ROWS_CACHE_[name];
  var values = sheet.getDataRange().getValues();
  var rows = values.length > 1 ? values.slice(1) : [];
  if (name) ASSESSMENT_ROWS_CACHE_[name] = rows;
  return rows;
}

function assessmentDefinitions_() {
  if (ASSESSMENT_DEFINITION_CACHE_) return ASSESSMENT_DEFINITION_CACHE_;
  return withResearchLockRetry_(function() {
    return assessmentDefinitionsNoLock_(ensureAssessmentSheetsNoLock_(getSpreadsheet()));
  });
}

function assessmentDefinitionsNoLock_(sheets) {
  if (ASSESSMENT_DEFINITION_CACHE_) return ASSESSMENT_DEFINITION_CACHE_;
  var instrumentRows = assessmentRows_(sheets.PR_AssessmentInstruments).reduce(function(result, row) {
    var code = String(row[1] || '').trim();
    if (code && !result.seen[code]) {
      result.seen[code] = true;
      result.rows.push(row);
    }
    return result;
  }, {seen: {}, rows: []}).rows;
  var categoryRows = assessmentRows_(sheets.PR_AssessmentCategories).reduce(function(result, row) {
    var key = String(row[1] || '').trim() + '|' + String(row[2] || '').trim();
    if (key !== '|' && !result.seen[key]) {
      result.seen[key] = true;
      result.rows.push(row);
    }
    return result;
  }, {seen: {}, rows: []}).rows;
  var itemRows = assessmentRows_(sheets.PR_AssessmentItems).reduce(function(result, row) {
    var key = String(row[1] || '').trim() + '|' + String(row[3] || '').trim();
    if (key !== '|' && !result.seen[key]) {
      result.seen[key] = true;
      result.rows.push(row);
    }
    return result;
  }, {seen: {}, rows: []}).rows;
  var categories = categoryRows.reduce(function(result, row) {
    result[String(row[1])] = result[String(row[1])] || [];
    result[String(row[1])].push({categoryId: row[0], instrumentId: row[1], code: row[2], name: row[3], sortOrder: Number(row[4]) || 0, sourceKey: row[5], items: []});
    return result;
  }, {});
  var items = itemRows.map(function(row) {
    return {itemId: row[0], instrumentId: row[1], categoryCode: row[2], code: row[3], title: row[4], descriptor: row[5], descriptorMs: row[6], maxMarks: Number(row[7]) || 0,
      sortOrder: Number(row[8]) || 0, defaultMQFDomains: assessmentJson_(row[9]), defaultTaxonomy: row[10], defaultPrimarySC: row[11], defaultPrimarySCSource: row[12], sourceKey: row[13], active: row[14] !== false};
  });
  ASSESSMENT_DEFINITION_CACHE_ = instrumentRows.filter(function(row) { return row[10] !== false && String(row[10]).toLowerCase() !== 'false'; }).map(function(row) {
    var instrument = {instrumentId: row[0], code: row[1], name: row[2], description: row[3], studyLevels: assessmentJson_(row[4]), totalMarks: Number(row[5]) || 0, sortOrder: Number(row[6]) || 0,
      sourceKey: row[7], sourceDocument: row[8], sourceStatus: row[9], categories: (categories[String(row[0])] || []).sort(function(a, b) { return a.sortOrder - b.sortOrder; }), items: []};
    instrument.items = items.filter(function(item) { return item.instrumentId === instrument.instrumentId; }).sort(function(a, b) { return a.sortOrder - b.sortOrder; });
    instrument.categories.forEach(function(category) { category.items = instrument.items.filter(function(item) { return item.categoryCode === category.code; }); });
    return instrument;
  }).sort(function(a, b) { return a.sortOrder - b.sortOrder; });
  return ASSESSMENT_DEFINITION_CACHE_;
}

function assessmentReferenceCodes_(references, key) {
  return getResearchReferenceList_(references || {}, key).map(function(reference) { return String(reference.code || '').trim(); }).filter(Boolean);
}

function assessmentTFMap_(references) {
  return getResearchReferenceList_(references || {}, 'tf').reduce(function(result, reference) {
    result[reference.code] = reference.mqfDomains || [];
    return result;
  }, {});
}

function assessmentAlignmentFromRow_(row) {
  return {programmeId: row[0], itemId: row[1], mqfDomains: assessmentJson_(row[2]), taxonomy: String(row[3] || '').trim(), primarySC: String(row[4] || '').trim(), note: String(row[5] || '').trim(), updatedAt: row[6], updatedBy: row[7]};
}

function assessmentProvenance_(baseline, effective, hasOverride) {
  var same = JSON.stringify(baseline) === JSON.stringify(effective);
  var active = Array.isArray(effective) ? effective.length > 0 : !!effective;
  if (same || !active) return {label: 'PPS default', kind: 'default', active: active};
  return {label: 'Faculty alignment', kind: 'faculty', active: true};
}

function validateAssessmentItem_(item, effective, references, requirePrimarySC) {
  var critical = [], warnings = [];
  var mqfCodes = assessmentReferenceCodes_(references, 'mqf');
  var scCodes = assessmentReferenceCodes_(references, 'sc');
  var taxonomyCodes = typeof RESEARCH_TAXONOMY_IDS !== 'undefined' ? RESEARCH_TAXONOMY_IDS : [];
  var mqf = assessmentUnique_(effective.mqfDomains);
  mqf.forEach(function(code) { if (mqfCodes.indexOf(code) === -1) critical.push('Invalid MQF reference: ' + code); });
  if (!mqf.length) critical.push('At least one MQF reference is required');
  if (effective.taxonomy && taxonomyCodes.indexOf(String(effective.taxonomy).toUpperCase()) === -1) critical.push('Invalid taxonomy reference: ' + effective.taxonomy);
  if (!effective.taxonomy) warnings.push('Taxonomy is not selected');
  if (effective.primarySC && scCodes.indexOf(effective.primarySC) === -1) critical.push('Invalid Primary SC reference: ' + effective.primarySC);
  if (requirePrimarySC && !effective.primarySC) critical.push('Exactly one Primary SC is required for review');
  if (!effective.primarySC) warnings.push('Primary SC is not selected');
  return {critical: critical, warnings: warnings, ready: critical.length === 0};
}

function assessmentProjection_(programme, definitions, alignments, references, requirePrimarySC) {
  var level = assessmentProgrammeLevel_(programme);
  var alignmentByItem = (alignments || []).reduce(function(result, row) { result[row.itemId] = row; return result; }, {});
  var tfMap = assessmentTFMap_(references);
  return definitions.filter(function(instrument) { return instrument.studyLevels.indexOf(level) !== -1; }).map(function(instrument) {
    var projectedItems = instrument.items.map(function(item) {
      var alignment = alignmentByItem[item.itemId];
      var baseline = {mqfDomains: item.defaultMQFDomains.slice(), taxonomy: item.defaultTaxonomy, primarySC: item.defaultPrimarySC};
      var effective = {
        mqfDomains: alignment ? alignment.mqfDomains.slice() : baseline.mqfDomains.slice(),
        taxonomy: alignment && alignment.taxonomy ? alignment.taxonomy : baseline.taxonomy,
        primarySC: alignment ? alignment.primarySC : baseline.primarySC,
        tfIds: []
      };
      effective.tfIds = deriveTFIds_(effective.mqfDomains, tfMap);
      var validation = validateAssessmentItem_(item, effective, references, requirePrimarySC);
      return {itemId: item.itemId, code: item.code, title: item.title, descriptor: item.descriptor, descriptorMs: item.descriptorMs, maxMarks: item.maxMarks, sortOrder: item.sortOrder,
        parentCategory: item.categoryCode, sourceKey: item.sourceKey, baseline: {mqfDomains: baseline.mqfDomains, taxonomy: baseline.taxonomy, primarySC: baseline.primarySC, primarySCSource: item.defaultPrimarySCSource},
        effective: effective, note: alignment ? alignment.note : '',
        provenance: {mqfDomains: assessmentProvenance_(baseline.mqfDomains, effective.mqfDomains, !!alignment), taxonomy: assessmentProvenance_(baseline.taxonomy, effective.taxonomy, !!alignment), primarySC: assessmentProvenance_(baseline.primarySC, effective.primarySC, !!alignment), tf: {label: 'Derived from MQF', kind: 'derived', active: effective.tfIds.length > 0}},
        validation: validation};
    });
    var categoryProjection = instrument.categories.map(function(category) {
      var categoryItems = projectedItems.filter(function(item) { return item.parentCategory === category.code; });
      return {categoryId: category.categoryId, code: category.code, name: category.name, sortOrder: category.sortOrder, items: categoryItems,
        totals: {expected: categoryItems.reduce(function(total, item) { return total + item.maxMarks; }, 0), calculated: categoryItems.reduce(function(total, item) { return total + item.maxMarks; }, 0), matches: true}};
    });
    return {instrumentId: instrument.instrumentId, code: instrument.code, name: instrument.name, description: instrument.description, studyLevels: instrument.studyLevels, totalMarks: instrument.totalMarks,
      sourceKey: instrument.sourceKey, sourceDocument: instrument.sourceDocument, sourceStatus: instrument.sourceStatus, categories: categoryProjection, items: projectedItems,
      totals: {expected: instrument.totalMarks, calculated: projectedItems.reduce(function(total, item) { return total + item.maxMarks; }, 0), matches: projectedItems.reduce(function(total, item) { return total + item.maxMarks; }, 0) === instrument.totalMarks}};
  });
}

function assessmentAllItems_(projection) {
  return (projection || []).reduce(function(result, instrument) { return result.concat(instrument.items || []); }, []);
}

function assessmentRejectClientAuthority_(payload) {
  var excludedReference = String.fromCharCode(115, 100, 103);
  var forbidden = ['tf', 'tfIds', 'derivedTFIds', excludedReference, excludedReference + 'Id', excludedReference + 'Ids'];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(function(key) {
      if (forbidden.indexOf(String(key)) !== -1) throw new Error('Assessment payload contains a forbidden client authority field: ' + key);
      walk(value[key]);
    });
  }
  walk(payload);
}

function assessmentAlignmentPayload_(payload, item, references) {
  var value = payload || {};
  var baseline = item.baseline || {};
  var defaultMQF = item.defaultMQFDomains || baseline.mqfDomains || [];
  var defaultTaxonomy = item.defaultTaxonomy || baseline.taxonomy || '';
  var defaultPrimarySC = item.defaultPrimarySC || baseline.primarySC || '';
  if (value.mqfDomains != null && !Array.isArray(value.mqfDomains)) throw new Error('MQF references must be an array');
  var mqf = assessmentUnique_(value.mqfDomains == null ? defaultMQF : value.mqfDomains);
  if (!mqf.length) throw new Error('At least one MQF reference is required');
  var taxonomy = String(value.taxonomy == null ? defaultTaxonomy : value.taxonomy).trim().toUpperCase();
  var primarySC = String(value.primarySC == null ? defaultPrimarySC : value.primarySC).trim();
  if (Array.isArray(value.primarySC)) {
    if (value.primarySC.length > 1) throw new Error('Select exactly one Primary SC per assessment item');
    primarySC = String(value.primarySC[0] || '').trim();
  }
  if (mqf.some(function(code) { return assessmentReferenceCodes_(references, 'mqf').indexOf(code) === -1; })) {
    throw new Error('Invalid MQF reference in assessment alignment');
  }
  if (taxonomy && (typeof RESEARCH_TAXONOMY_IDS === 'undefined' || RESEARCH_TAXONOMY_IDS.indexOf(taxonomy) === -1)) throw new Error('Invalid taxonomy reference in assessment alignment');
  if (primarySC && assessmentReferenceCodes_(references, 'sc').indexOf(primarySC) === -1) throw new Error('Invalid Primary SC reference in assessment alignment');
  return {mqfDomains: mqf, taxonomy: taxonomy, primarySC: primarySC, note: String(value.note || '').trim()};
}

function assessmentReplaceRows_(sheet, output) {
  var oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (output.length > oldRows && sheet.insertRowsAfter) sheet.insertRowsAfter(sheet.getLastRow(), output.length - oldRows);
  if (oldRows > 0) sheet.getRange(2, 1, oldRows, 8).clearContent();
  if (output.length > 0) sheet.getRange(2, 1, output.length, 8).setValues(output);
  ASSESSMENT_ROWS_CACHE_ = {};
}

function withPreparedAssessmentContext_(programmeIdOrMqaCode, reader, requirePrimarySC, preparedIdentity) {
  preparedIdentity = preparedIdentity || {};
  var access = preparedIdentity.access || requireResearchProgrammeAccess_(programmeIdOrMqaCode, 'view-assessment');
  var programme = preparedIdentity.programme || resolveProgramme_(programmeIdOrMqaCode);
  var key = preparedIdentity.key || getResearchProgrammeKey_(programme);
  var prepared = withResearchLockRetry_(function() {
    var ss = getSpreadsheet();
    var researchSheets = ensureResearchSheetsNoLock_(ss);
    RESEARCH_SHEETS_CACHE_ = researchSheets;
    seedResearchReferencesNoLock_(researchSheets);
    var references = getResearchReferencesNoLock_(researchSheets);
    RESEARCH_REFERENCES_CACHE_ = references;
    var sheets = ensureAssessmentSheetsNoLock_(ss);
    ASSESSMENT_SHEETS_CACHE_ = sheets;
    var definitions = assessmentDefinitionsNoLock_(sheets);
    var alignments = assessmentRows_(sheets.PR_AssessmentAlignments).filter(function(row) { return String(row[0]) === key; }).map(assessmentAlignmentFromRow_);
    return {
      access: access,
      programme: programme,
      key: key,
      sheets: sheets,
      definitions: definitions,
      alignments: alignments,
      references: references,
      requirePrimarySC: !!requirePrimarySC
    };
  });
  return reader(prepared);
}

function assessmentProjectionForProgramme_(programmeIdOrMqaCode, requirePrimarySC) {
  return withPreparedAssessmentContext_(programmeIdOrMqaCode, function(context) {
    return {access: context.access, programme: context.programme, key: context.key,
      projection: assessmentProjection_(context.programme, context.definitions, context.alignments, context.references, context.requirePrimarySC)};
  }, requirePrimarySC);
}

function getAssessmentMappingApi_(programmeIdOrMqaCode) {
  return assessmentProjectionForProgramme_(programmeIdOrMqaCode, false).projection;
}

function assessmentReviewFromProjection_(projection) {
  var critical = [], warnings = [];
  (projection || []).forEach(function(instrument) {
    if (!instrument.totals.matches) critical.push({code: 'ASSESSMENT_TOTAL_MISMATCH', instrumentCode: instrument.code, message: 'Assessment total does not reconcile for ' + instrument.name});
    instrument.items.forEach(function(item) {
      item.validation.critical.forEach(function(message) { critical.push({code: 'ASSESSMENT_ITEM_INVALID', instrumentCode: instrument.code, itemCode: item.code, message: message}); });
      item.validation.warnings.forEach(function(message) { warnings.push({code: 'ASSESSMENT_ITEM_WARNING', instrumentCode: instrument.code, itemCode: item.code, message: message}); });
    });
  });
  return {critical: critical, warnings: warnings, status: critical.length ? 'Needs attention' : 'Ready for review', instruments: projection};
}

function getAssessmentWorkspaceApi_(programmeIdOrMqaCode) {
  var access;
  try {
    access = requireResearchProgrammeAccess_(programmeIdOrMqaCode, 'view-assessment-workspace');
  } catch (error) {
    return researchWorkspaceThrowSafe_(error);
  }

  var prepared;
  try {
    var programme = resolveProgramme_(programmeIdOrMqaCode);
    var key = getResearchProgrammeKey_(programme);
    prepared = withPreparedAssessmentContext_(programmeIdOrMqaCode, function(context) { return context; }, false, {
      access: access,
      programme: programme,
      key: key
    });
  } catch (error) {
    return researchWorkspaceThrowSafe_(error);
  }

  var mapping = researchWorkspaceEndpointEnvelope_('mapping', function() {
    return assessmentProjection_(prepared.programme, prepared.definitions, prepared.alignments, prepared.references, false);
  });
  var review = researchWorkspaceEndpointEnvelope_('review', function() {
    var projection = assessmentProjection_(prepared.programme, prepared.definitions, prepared.alignments, prepared.references, true);
    return assessmentReviewFromProjection_(projection);
  });
  return {ok: true, programmeId: prepared.key, endpoints: {mapping: mapping, review: review}};
}

function saveAssessmentMappingApi_(programmeIdOrMqaCode, payload) {
  var context = assessmentProjectionForProgramme_(programmeIdOrMqaCode, false);
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-assessment');
  payload = payload || {};
  assessmentRejectClientAuthority_(payload);
  if (!Array.isArray(payload.items)) throw new Error('Assessment items are required');
  var definitions = assessmentDefinitions_();
  var applicable = assessmentAllItems_(context.projection).reduce(function(result, item) { result[item.itemId] = item; return result; }, {});
  var definitionItems = assessmentAllItems_(assessmentProjection_(context.programme, definitions, [], getResearchReferences_(), false)).reduce(function(result, item) { result[item.itemId] = item; return result; }, {});
  var references = getResearchReferences_();
  var normalized = payload.items.map(function(input) {
    if (!input || !applicable[input.itemId] || !definitionItems[input.itemId]) throw new Error('Assessment item is not part of the programme profile');
    var alignment = assessmentAlignmentPayload_(input, definitionItems[input.itemId], references);
    return {itemId: input.itemId, mqfDomains: alignment.mqfDomains, taxonomy: alignment.taxonomy, primarySC: alignment.primarySC, note: alignment.note};
  });
  var key = context.key;
  var user = access.user || getCurrentUser_();
  var sheets = ensureAssessmentSheets_();
  var now = new Date();
  withResearchLockRetry_(function() {
    var rows = assessmentRows_(sheets.PR_AssessmentAlignments);
    var byItem = {};
    rows.forEach(function(row) { if (String(row[0]) === key) byItem[String(row[1])] = row; });
    normalized.forEach(function(item) { byItem[item.itemId] = [key, item.itemId, JSON.stringify(item.mqfDomains), item.taxonomy, item.primarySC, item.note, now, user.email || '']; });
    var output = rows.filter(function(row) { return String(row[0]) !== key; }).concat(Object.keys(byItem).map(function(itemId) { return byItem[itemId]; }));
    assessmentReplaceRows_(sheets.PR_AssessmentAlignments, output);
  });
  return getAssessmentMappingApi_(programmeIdOrMqaCode);
}

function resetAssessmentMappingApi_(programmeIdOrMqaCode, itemIds) {
  var context = assessmentProjectionForProgramme_(programmeIdOrMqaCode, false);
  var access = requireProgrammeAccess_(programmeIdOrMqaCode, 'edit-assessment');
  var allowed = assessmentAllItems_(context.projection).reduce(function(result, item) { result[item.itemId] = true; return result; }, {});
  if (itemIds != null && !Array.isArray(itemIds)) throw new Error('Assessment reset item IDs must be an array');
  itemIds = Array.isArray(itemIds) ? itemIds : [];
  itemIds.forEach(function(itemId) { if (!allowed[itemId]) throw new Error('Assessment item is not part of the programme profile'); });
  var sheets = ensureAssessmentSheets_();
  var resetAll = itemIds.length === 0;
  var targets = itemIds.reduce(function(result, itemId) { result[itemId] = true; return result; }, {});
  var key = context.key;
  withResearchLockRetry_(function() {
    var rows = assessmentRows_(sheets.PR_AssessmentAlignments).filter(function(row) {
      return String(row[0]) !== key || (!resetAll && !targets[String(row[1])]);
    });
    assessmentReplaceRows_(sheets.PR_AssessmentAlignments, rows);
  });
  return getAssessmentMappingApi_(programmeIdOrMqaCode);
}

function getAssessmentReviewApi_(programmeIdOrMqaCode) {
  var result = assessmentProjectionForProgramme_(programmeIdOrMqaCode, true);
  return assessmentReviewFromProjection_(result.projection);
}
