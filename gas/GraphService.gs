/** GraphService.gs — PEO/PLO visualisation graph data builder */

function getGraphData(mqaCode) {
  var peos = getPEOs(mqaCode);
  var plos = getPLOs(mqaCode);
  var nodes = [];
  var edges = [];
  var nodeSet = {};

  function addNode(id, label, type) {
    if (!nodeSet[id]) {
      nodeSet[id] = true;
      nodes.push({ id: id, label: label, type: type });
    }
  }

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

  for (var t = 0; t < 4; t++) {
    addNode('TF' + (t+1), 'TF ' + (t+1), 'TF');
  }

  for (var s = 0; s < 17; s++) {
    addNode('SDG' + (s+1), 'SDG ' + (s+1), 'SDG');
  }

  for (var c = 0; c < 8; c++) {
    addNode('SC' + (c+1), 'SC ' + (c+1), 'SC');
  }

  var domainNames = ['D1: Knowledge', 'D2: Psychomotor', 'D3: Affective',
    'D4: Communication', 'D5: Digital Skills', 'D6: Numeracy',
    'D7: Leadership', 'D8: Personal', 'D9: Entrepreneurial',
    'D10: Ethics', 'D11: Lifelong Learning'];
  for (var d = 0; d < 11; d++) {
    addNode('MQF_D' + (d+1), domainNames[d], 'MQFDomain');
  }

  peos.forEach(function(peo) {
    addNode('PEO_' + peo.code, peo.code + ': ' + (peo.description || '').substring(0, 30), 'PEO');
    edges.push({ from: 'prog_' + mqaCode, to: 'PEO_' + peo.code, type: 'has' });

    peo.tf.forEach(function(v, ti) {
      if (v) edges.push({ from: 'PEO_' + peo.code, to: 'TF' + (ti+1), type: 'maps_to' });
    });
    peo.sdg.forEach(function(v, si) {
      if (v) edges.push({ from: 'PEO_' + peo.code, to: 'SDG' + (si+1), type: 'maps_to' });
    });
    peo.sc.forEach(function(v, ci) {
      if (v) edges.push({ from: 'PEO_' + peo.code, to: 'SC' + (ci+1), type: 'maps_to' });
    });
  });

  plos.forEach(function(plo) {
    addNode('PLO_' + plo.code, plo.code + ': ' + (plo.description || '').substring(0, 30), 'PLO');
    edges.push({ from: 'prog_' + mqaCode, to: 'PLO_' + plo.code, type: 'has' });

    if (plo.embeddedPEO) {
      edges.push({ from: 'PEO_' + plo.embeddedPEO, to: 'PLO_' + plo.code, type: 'embeds' });
    }
    plo.mqfDomains.forEach(function(v, di) {
      if (v) edges.push({ from: 'PLO_' + plo.code, to: 'MQF_D' + (di+1), type: 'classified_as' });
    });
  });

  return { nodes: nodes, edges: edges };
}
