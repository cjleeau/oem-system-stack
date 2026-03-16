import { CONSULTING_FIRMS, DEALER_METRICS } from './dealerData';
import { fmtInt, parseLevel, pct, safe, sentenceList } from './utils';

const SUPPLIER_TYPES = new Set([
  'Tier1',
  'Battery',
  'Semiconductor',
  'Connectivity',
  'Cloud',
  'Cloud Vendor',
  'DealerVendor',
  'DealerTech',
  'Insurance',
  'Fleet',
  'Mapping',
  'DataPlatform',
  'ADAS',
  'Charging',
  'Payments',
  'Cybersecurity',
  'Compute',
  'API'
]);

const PLATFORM_TYPES = new Set([
  'Cloud',
  'Cloud Vendor',
  'Semiconductor',
  'Compute',
  'OS',
  'Vehicle OS',
  'OTA',
  'AI',
  'DataPlatform',
  'Mapping',
  'ADAS',
  'API',
  'Telematics',
  'TCU'
]);

const PLATFORM_LAYERS = new Set([
  'Cloud Infrastructure',
  'Streaming & Data Lake',
  'Vehicle OS & Middleware',
  'OTA & Software Update Infrastructure',
  'AI / Analytics',
  'Product APIs',
  'ADAS & Mapping',
  'Semiconductor & Compute',
  'Telematics & TCU'
]);

const CLOUD_HINTS = ['aws', 'azure', 'google cloud', 'gcp', 'alibaba cloud', 'oracle cloud', 'ibm cloud'];
const ADAS_HINTS = ['mobileye', 'adas', 'bosch', 'continental', 'aptiv', 'zenseact', 'autonomous'];
const COMPUTE_HINTS = ['qualcomm', 'nvidia', 'intel', 'amd', 'snapdragon', 'drive'];

function nonMetaOems(oem) {
  return !['GLOBAL', 'MULTI', 'UNKNOWN', ''].includes(safe(oem).toUpperCase());
}

function getNodeKind(node) {
  const label = safe(node.label).toLowerCase();
  const type = safe(node.node_type || node.type);
  if (SUPPLIER_TYPES.has(type) || ['external', 'partner'].includes(node.control_boundary)) return 'supplier';
  if (PLATFORM_TYPES.has(type) || PLATFORM_LAYERS.has(node.layer)) return 'platform';
  if (label.includes('dealer')) return 'dealer';
  return 'entity';
}

function aggregateByLabel(nodes, predicate) {
  const map = new Map();
  nodes.filter(predicate).forEach((node) => {
    const key = safe(node.label);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        label: key,
        node_type: safe(node.node_type || node.type),
        primary_layer: safe(node.layer),
        oems: new Set(),
        layers: new Set(),
        regions: new Set(),
        node_count: 0,
        verified_nodes: 0,
        evidence_weight: 0
      });
    }
    const row = map.get(key);
    row.node_count += 1;
    if (nonMetaOems(node.oem_group)) row.oems.add(node.oem_group);
    if (node.layer) row.layers.add(node.layer);
    if (node.region) row.regions.add(node.region);
    const level = parseLevel(node.verification_level);
    if (level >= 3) row.verified_nodes += 1;
    row.evidence_weight += Math.max(level, 1);
  });

  return [...map.values()].map((row) => ({
    ...row,
    oem_coverage: row.oems.size,
    layer_count: row.layers.size,
    region_count: row.regions.size,
    verification_density: row.node_count ? row.verified_nodes / row.node_count : 0,
    weighted_prominence: row.node_count ? row.evidence_weight / row.node_count : 0,
    oems: [...row.oems],
    layers: [...row.layers],
    regions: [...row.regions]
  }));
}

function buildLayerConcentration(rows) {
  const byLayer = new Map();
  rows.forEach((row) => {
    row.layers.forEach((layer) => {
      if (!byLayer.has(layer)) byLayer.set(layer, { layer, suppliers: 0, oemCoverage: 0, weighted: 0 });
      const agg = byLayer.get(layer);
      agg.suppliers += 1;
      agg.oemCoverage += row.oem_coverage;
      agg.weighted += row.weighted_prominence;
    });
  });
  return [...byLayer.values()]
    .map((row) => ({ ...row, averageCoverage: row.suppliers ? row.oemCoverage / row.suppliers : 0 }))
    .sort((a, b) => b.averageCoverage - a.averageCoverage);
}

function aggregateEdgeConcentration(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const layerAgg = new Map();
  const oemAgg = new Map();

  edges.forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const level = parseLevel(edge.verification_level);
    const oem = source?.oem_group || target?.oem_group || 'UNKNOWN';
    const layers = [source?.layer, target?.layer].filter(Boolean);

    if (!oemAgg.has(oem)) oemAgg.set(oem, { oem, edgeCount: 0, verified: 0, inferred: 0, suppliers: new Set() });
    const oRow = oemAgg.get(oem);
    oRow.edgeCount += 1;
    if (level >= 3) oRow.verified += 1;
    if (level <= 1) oRow.inferred += 1;
    [source, target].forEach((node) => {
      if (!node) return;
      if (getNodeKind(node) === 'supplier') oRow.suppliers.add(node.label);
    });

    layers.forEach((layer) => {
      if (!layerAgg.has(layer)) layerAgg.set(layer, { layer, edgeCount: 0, verified: 0, inferred: 0 });
      const lRow = layerAgg.get(layer);
      lRow.edgeCount += 1;
      if (level >= 3) lRow.verified += 1;
      if (level <= 1) lRow.inferred += 1;
    });
  });

  return {
    verificationByOem: [...oemAgg.values()]
      .filter((row) => nonMetaOems(row.oem))
      .map((row) => ({
        ...row,
        supplier_diversity: row.suppliers.size,
        verified_density: row.edgeCount ? row.verified / row.edgeCount : 0,
        inferred_density: row.edgeCount ? row.inferred / row.edgeCount : 0
      }))
      .sort((a, b) => b.verified_density - a.verified_density),
    verificationByLayer: [...layerAgg.values()]
      .map((row) => ({
        ...row,
        verified_density: row.edgeCount ? row.verified / row.edgeCount : 0,
        inferred_density: row.edgeCount ? row.inferred / row.edgeCount : 0
      }))
      .sort((a, b) => b.edgeCount - a.edgeCount)
  };
}

export function buildIntelligence(nodes, edges, state) {
  const supplierRows = aggregateByLabel(nodes, (node) => getNodeKind(node) === 'supplier')
    .sort((a, b) => b.oem_coverage - a.oem_coverage || b.weighted_prominence - a.weighted_prominence || b.node_count - a.node_count);

  const platformRows = aggregateByLabel(nodes, (node) => getNodeKind(node) === 'platform')
    .sort((a, b) => b.oem_coverage - a.oem_coverage || b.weighted_prominence - a.weighted_prominence || b.node_count - a.node_count);

  const dealerRows = aggregateByLabel(nodes, (node) => node.layer === 'Dealer Systems' || safe(node.node_type).toLowerCase().includes('dealer'))
    .sort((a, b) => b.oem_coverage - a.oem_coverage || b.node_count - a.node_count);

  const cloudRows = platformRows.filter((row) => CLOUD_HINTS.some((hint) => row.label.toLowerCase().includes(hint)) || row.primary_layer === 'Cloud Infrastructure');
  const adasRows = supplierRows.filter((row) => ADAS_HINTS.some((hint) => row.label.toLowerCase().includes(hint)) || row.primary_layer === 'ADAS & Mapping');
  const computeRows = platformRows.filter((row) => COMPUTE_HINTS.some((hint) => row.label.toLowerCase().includes(hint)) || row.primary_layer === 'Semiconductor & Compute');
  const dependencyRows = platformRows.map((row) => ({
    ...row,
    concentration_score: row.oem_coverage * 0.6 + row.weighted_prominence * 0.25 + row.layer_count * 0.15
  })).sort((a, b) => b.concentration_score - a.concentration_score);

  const layerConcentration = buildLayerConcentration(supplierRows);
  const { verificationByOem, verificationByLayer } = aggregateEdgeConcentration(nodes, edges);
  const inferredRiskLayer = [...verificationByLayer].sort((a, b) => b.inferred_density - a.inferred_density)[0];
  const diversityLeader = [...verificationByOem].sort((a, b) => b.supplier_diversity - a.supplier_diversity)[0];
  const verifiedLeader = verificationByOem[0];

  const strategicCards = [
    {
      title: 'Most reused supplier',
      value: supplierRows[0]?.label || '—',
      detail: supplierRows[0] ? `${supplierRows[0].oem_coverage} OEM groups · ${sentenceList(supplierRows[0].layers.slice(0, 2))}` : 'No supplier signal in the current slice.'
    },
    {
      title: 'Most reused cloud platform',
      value: cloudRows[0]?.label || '—',
      detail: cloudRows[0] ? `${cloudRows[0].oem_coverage} OEM groups · ${pct(cloudRows[0].verification_density)} verified nodes` : 'No cloud concentration found.'
    },
    {
      title: 'Most concentrated layer',
      value: layerConcentration[0]?.layer || '—',
      detail: layerConcentration[0] ? `${layerConcentration[0].averageCoverage.toFixed(1)} average OEMs per supplier` : 'No layer concentration visible.'
    },
    {
      title: 'Highest supplier diversity OEM',
      value: diversityLeader?.oem || '—',
      detail: diversityLeader ? `${diversityLeader.supplier_diversity} distinct supplier labels in the current slice` : 'No OEM diversity signal available.'
    },
    {
      title: 'Strongest verified coverage',
      value: verifiedLeader?.oem || '—',
      detail: verifiedLeader ? `${pct(verifiedLeader.verified_density)} of visible edges are L3+ / verified` : 'No verification density signal available.'
    },
    {
      title: 'Largest inferred-risk layer',
      value: inferredRiskLayer?.layer || '—',
      detail: inferredRiskLayer ? `${pct(inferredRiskLayer.inferred_density)} inferred or missing evidence density` : 'No inferred-risk signal available.'
    },
    {
      title: 'Top dealer platform cluster',
      value: dealerRows[0]?.label || '—',
      detail: dealerRows[0] ? `${dealerRows[0].oem_coverage} OEM groups with dealer-system presence` : 'Dealer-system data is sparse in the current slice.'
    }
  ];

  const filterNarrative = [
    state.oem !== 'all' ? `${state.oem} is the current OEM focus.` : 'The current slice spans multiple OEM groups.',
    state.layer !== 'all' ? `${state.layer} is the active layer lens.` : 'No single layer is isolated, so concentration can be read cross-stack.',
    state.evidenceOnly ? 'Evidence-only mode is on, so weaker relationships are suppressed.' : 'Inferred and modelled links are still visible where present.'
  ];

  return {
    supplierRows,
    platformRows,
    dealerRows,
    cloudRows,
    adasRows,
    computeRows,
    dependencyRows,
    layerConcentration,
    verificationByOem,
    verificationByLayer,
    strategicCards,
    filterNarrative,
    consultingRows: CONSULTING_FIRMS,
    dealerMetrics: DEALER_METRICS
  };
}

export function buildInsightPanel(intelligence, state, selectedNode, filteredNodes, filteredEdges) {
  const topSuppliers = intelligence.supplierRows.slice(0, 3);
  const topCloud = intelligence.cloudRows.slice(0, 3);
  const topCompute = intelligence.computeRows.slice(0, 3);
  const topAdas = intelligence.adasRows.slice(0, 3);
  const topDependency = intelligence.dependencyRows.slice(0, 3);

  const title = selectedNode
    ? `${selectedNode.label} — why it matters`
    : state.oem !== 'all'
      ? `${state.oem} — current intelligence slice`
      : 'Current ecosystem intelligence';

  const context = selectedNode
    ? `${selectedNode.label} sits in ${selectedNode.layer} for ${selectedNode.oem_group || 'the current ecosystem slice'}.`
    : `${fmtInt(filteredNodes.length)} nodes and ${fmtInt(filteredEdges.length)} edges remain visible after the current filters.`;

  const bullets = [];

  if (selectedNode && getNodeKind(selectedNode) === 'supplier') {
    const match = intelligence.supplierRows.find((row) => row.label === selectedNode.label);
    if (match) {
      bullets.push(`${match.label} appears across ${match.oem_coverage} OEM groups, which makes it a cross-stack dependency rather than a one-off supplier.`);
      bullets.push(`It is most active in ${sentenceList(match.layers.slice(0, 3))}, so failure or switching cost would travel through multiple system lanes.`);
    }
  }

  if (selectedNode && getNodeKind(selectedNode) === 'platform') {
    const match = intelligence.platformRows.find((row) => row.label === selectedNode.label);
    if (match) {
      bullets.push(`${match.label} appears across ${match.oem_coverage} OEM groups, which makes it systemically relevant in the current data slice.`);
      bullets.push(`Its current concentration profile is strongest in ${sentenceList(match.layers.slice(0, 3))}.`);
    }
  }

  if (!bullets.length && topSuppliers[0]) {
    bullets.push(`${topSuppliers[0].label} is the most reused visible supplier, covering ${topSuppliers[0].oem_coverage} OEM groups.`);
  }
  if (topCloud[0]) bullets.push(`${topCloud[0].label} is the dominant cloud dependency in the visible slice.`);
  if (topAdas[0]) bullets.push(`${topAdas[0].label} is the strongest repeated ADAS dependency currently visible.`);
  if (topCompute[0]) bullets.push(`${topCompute[0].label} anchors repeated compute or semiconductor dependency across the current slice.`);

  const sections = [
    {
      title: 'Top supplier dependencies',
      rows: topSuppliers.map((row) => ({
        label: row.label,
        value: `${row.oem_coverage} OEMs`,
        note: sentenceList(row.layers.slice(0, 2))
      }))
    },
    {
      title: 'Platform dependency clusters',
      rows: topDependency.map((row) => ({
        label: row.label,
        value: `${row.oem_coverage} OEMs`,
        note: `${row.primary_layer || 'Cross-stack'} · score ${row.concentration_score.toFixed(2)}`
      }))
    },
    {
      title: 'Why this matters',
      rows: bullets.map((bullet) => ({ label: 'Interpretation', value: '', note: bullet }))
    }
  ];

  return {
    title,
    context,
    sections,
    narrative: intelligence.filterNarrative
  };
}
