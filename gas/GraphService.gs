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

  function domainId(domain) {
    return 'MQF_' + domain.replace(/\s+/g, '_');
  }

  var ss = getSpreadsheet();
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

  peos.forEach(function(peo) {
    addNode('PEO_' + peo.code, peo.code + ': ' + (peo.description || '').substring(0, 30), 'PEO');
    edges.push({ from: 'prog_' + mqaCode, to: 'PEO_' + peo.code, type: 'has' });
    if (peo.mqfDomain) {
      addNode(domainId(peo.mqfDomain), peo.mqfDomain, 'MQFDomain');
      edges.push({ from: 'PEO_' + peo.code, to: domainId(peo.mqfDomain), type: 'maps_to' });
    }
  });

  plos.forEach(function(plo) {
    addNode('PLO_' + plo.code, plo.code + ': ' + (plo.description || '').substring(0, 30), 'PLO');
    edges.push({ from: 'prog_' + mqaCode, to: 'PLO_' + plo.code, type: 'has' });
    if (plo.embeddedPEO) {
      edges.push({ from: 'PEO_' + plo.embeddedPEO, to: 'PLO_' + plo.code, type: 'embeds' });
    }
    if (plo.mqfDomain) {
      addNode(domainId(plo.mqfDomain), plo.mqfDomain, 'MQFDomain');
      edges.push({ from: 'PLO_' + plo.code, to: domainId(plo.mqfDomain), type: 'classified_as' });
    }
  });

  return { nodes: nodes, edges: edges };
}
