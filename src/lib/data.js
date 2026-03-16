import * as d3 from 'd3';
import { LAYERS, TELEMETRY_RELATIONS } from './constants';
import { compareConfidence, compareRegion, norm, parseLevel, safe, uniq } from './utils';

async function loadCsvWithFallback(primaryPath, fallbackPath) {
  try {
    const data = await d3.csv(primaryPath);
    if (Array.isArray(data) && data.length >= 0) return data;
  } catch {
    // fall through to the secondary path
  }

  return d3.csv(fallbackPath);
}

function normaliseLayer(value) {
  const layer = safe(value);
  if (layer === 'Telematics / TCU') return 'Telematics & TCU';
  return layer;
}

function normaliseNode(node) {
  const nodeType = safe(node.node_type || node.type);
  const layer = normaliseLayer(node.layer);
  const label = safe(node.label || node.name || node.id);
  const controlBoundary = norm(node.control_boundary);

  return {
    ...node,
    id: safe(node.id),
    label,
    region: norm(node.region),
    layer,
    oem_group: safe(node.oem_group),
    node_type: nodeType,
    type: safe(node.type || node.node_type),
    control_boundary: controlBoundary,
    confidence: norm(node.confidence),
    notes: safe(node.notes || node.description),
    description: safe(node.description),
    evidence_status: safe(node.evidence_status).toUpperCase(),
    evidence_class: safe(node.evidence_class),
    verification_level: safe(node.verification_level),
    verification_status: safe(node.verification_status),
    verification_owner: safe(node.verification_owner),
    provenance_id: safe(node.provenance_id),
    provenance_parent: safe(node.provenance_parent),
    source_name: safe(node.source_name),
    source_url: safe(node.source_url),
    source_date: safe(node.source_date),
    evidence_note: safe(node.evidence_note),
    citation_required: safe(node.citation_required),
    last_validated_date: safe(node.last_validated_date),
    last_reviewed: safe(node.last_reviewed),
    layerIndex: LAYERS.indexOf(layer)
  };
}

function normaliseEdge(edge) {
  return {
    ...edge,
    id: safe(edge.id || edge.edge_id || edge.provenance_id),
    source: safe(edge.source),
    target: safe(edge.target),
    relation: safe(edge.relation || edge.relationship),
    relationship: safe(edge.relationship || edge.relation),
    confidence: norm(edge.confidence),
    region: norm(edge.region),
    layer: normaliseLayer(edge.layer),
    notes: safe(edge.notes),
    evidence_status: safe(edge.evidence_status).toUpperCase(),
    evidence_class: safe(edge.evidence_class),
    verification_level: safe(edge.verification_level),
    verification_status: safe(edge.verification_status),
    verification_owner: safe(edge.verification_owner),
    telemetry_edge: safe(edge.telemetry_edge).toLowerCase() === 'true' || safe(edge.telemetry_edge) === '1',
    verified_edge: safe(edge.verified_edge).toLowerCase() === 'true' || safe(edge.verified_edge) === '1',
    provenance_id: safe(edge.provenance_id),
    provenance_parent: safe(edge.provenance_parent),
    source_name: safe(edge.source_name),
    source_url: safe(edge.source_url),
    source_date: safe(edge.source_date),
    evidence_note: safe(edge.evidence_note),
    citation_required: safe(edge.citation_required),
    last_validated_date: safe(edge.last_validated_date),
    last_reviewed: safe(edge.last_reviewed)
  };
}

export async function loadData(base = '') {
  const primaryBase = `${base}/data`;
  const secondaryBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

  const [nodesRaw, edgesRaw] = await Promise.all([
    loadCsvWithFallback(`${primaryBase}/nodes.csv`, `${secondaryBase}/nodes.csv`),
    loadCsvWithFallback(`${primaryBase}/edges.csv`, `${secondaryBase}/edges.csv`)
  ]);

  const nodes = nodesRaw
    .map(normaliseNode)
    .filter((node) => node.id && node.layerIndex >= 0);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = edgesRaw
    .map(normaliseEdge)
    .filter((edge) => edge.id && edge.source && edge.target)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  if (!nodes.length) {
    throw new Error('nodes.csv loaded but produced zero valid nodes. Check layer names and required id values.');
  }

  return { nodes, edges };
}

export function isVerifiedEdge(edge) {
  return edge.evidence_status === 'VERIFIED' || edge.verified_edge || !!edge.source_url;
}

export function isEvidencePass(edge) {
  return edge.evidence_status === 'VERIFIED' || edge.verified_edge || parseLevel(edge.verification_level) >= 3;
}

export function isTelemetryEdge(edge) {
  return edge.telemetry_edge || TELEMETRY_RELATIONS.has(safe(edge.relation).toUpperCase());
}

export function edgeStroke(edge) {
  const level = parseLevel(edge.verification_level);
  if (level >= 4) return 'rgba(122, 214, 255, 0.95)';
  if (level >= 3) return 'rgba(89, 194, 138, 0.92)';
  if (level >= 2) return 'rgba(79, 140, 255, 0.82)';
  return 'rgba(156, 167, 182, 0.72)';
}

export function edgeDash(edge) {
  const level = parseLevel(edge.verification_level);
  if (level >= 3) return null;
  if (level >= 2) return '6 4';
  return '5 4';
}

export function nodeFill(node) {
  if (norm(node.control_boundary) === 'regulatory') return 'rgba(244, 162, 97, 0.90)';
  if (norm(node.control_boundary) === 'external' || norm(node.control_boundary) === 'partner') return 'rgba(59, 130, 246, 0.72)';
  return 'rgba(24, 144, 255, 0.80)';
}

function matchesSearch(text, query) {
  if (!query) return true;
  return norm(text).includes(norm(query));
}

function matchesNodeFilters(node, state, override = {}) {
  const next = { ...state, ...override };
  if (next.region !== 'all' && node.region !== next.region) return false;
  if (next.oem !== 'all' && node.oem_group !== next.oem) return false;
  if (next.layer !== 'all' && node.layer !== next.layer) return false;
  if (next.type !== 'all' && safe(node.node_type || node.type) !== next.type) return false;
  if (next.confidence !== 'all' && node.confidence !== next.confidence) return false;
  return true;
}

function nodeMatchesSearch(node, query) {
  return matchesSearch([node.label, node.notes, node.description, node.region, node.layer, node.oem_group, node.node_type].join(' '), query);
}

function matchesEdgeFilters(edge, nodeMap, state) {
  const source = nodeMap.get(edge.source);
  const target = nodeMap.get(edge.target);
  if (!source || !target) return false;
  if (state.region !== 'all' && source.region !== state.region && target.region !== state.region && edge.region !== state.region) return false;
  if (state.oem !== 'all' && source.oem_group !== state.oem && target.oem_group !== state.oem) return false;
  if (state.layer !== 'all' && source.layer !== state.layer && target.layer !== state.layer && edge.layer !== state.layer) return false;
  if (state.confidence !== 'all' && edge.confidence !== state.confidence && source.confidence !== state.confidence && target.confidence !== state.confidence) return false;
  if (state.search) {
    const hay = [edge.relation, edge.notes, edge.evidence_note, source.label, target.label].join(' ');
    if (!matchesSearch(hay, state.search)) return false;
  }
  if (state.telemetryOnly && !isTelemetryEdge(edge)) return false;
  if (state.evidenceOnly && !isEvidencePass(edge)) return false;
  return true;
}

export function buildFilteredData(nodesAll, edgesAll, state) {
  const baseNodeMap = new Map(nodesAll.map((node) => [node.id, node]));
  const scopedNodes = nodesAll.filter((node) => matchesNodeFilters(node, state));
  const scopedNodeIds = new Set(scopedNodes.map((node) => node.id));

  let edges = edgesAll.filter((edge) => scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target));
  edges = edges.filter((edge) => matchesEdgeFilters(edge, baseNodeMap, state));

  let nodes;
  if (state.search) {
    const edgeMatchedIds = new Set();
    edges.forEach((edge) => {
      edgeMatchedIds.add(edge.source);
      edgeMatchedIds.add(edge.target);
    });
    nodes = scopedNodes.filter((node) => nodeMatchesSearch(node, state.search) || edgeMatchedIds.has(node.id));
  } else {
    nodes = scopedNodes;
  }

  let nodeIds = new Set(nodes.map((node) => node.id));
  edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  if (state.archAdjacentOnly && state.view === 'architecture') {
    edges = edges.filter((edge) => {
      const source = baseNodeMap.get(edge.source);
      const target = baseNodeMap.get(edge.target);
      if (!source || !target) return false;
      return Math.abs(source.layerIndex - target.layerIndex) <= 1;
    });
  }

  if (state.evidenceOnly) {
    const keep = new Set();
    edges.forEach((edge) => {
      keep.add(edge.source);
      keep.add(edge.target);
    });
    nodes = nodes.filter((node) => keep.has(node.id));
    nodeIds = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }

  if (state.archSupplierFocus && state.view === 'architecture') {
    const supplierTerms = ['supplier', 'battery', 'semiconductor', 'cloud', 'telematics', 'connectivity'];
    nodes = nodes.filter((node) => {
      const hay = norm(`${node.layer} ${node.node_type} ${node.label}`);
      return supplierTerms.some((term) => hay.includes(term)) || node.control_boundary === 'external' || node.oem_group === state.oem || state.oem === 'all';
    });
    nodeIds = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }

  return {
    nodes,
    edges,
    nodeMap: new Map(nodes.map((node) => [node.id, node]))
  };
}

function optionEnabled(nodesAll, state, field, value) {
  const override = { [field]: value };
  const resetSelf = { [field]: 'all' };
  return nodesAll.some((node) => matchesNodeFilters(node, { ...state, ...resetSelf }, override));
}

export function getFilterOptions(nodesAll, state) {
  const types = uniq(nodesAll.map((node) => safe(node.node_type || node.type)));
  return {
    regions: uniq(nodesAll.map((node) => node.region))
      .sort(compareRegion)
      .map((value) => ({ value, enabled: optionEnabled(nodesAll, state, 'region', value) })),
    oems: uniq(nodesAll.map((node) => node.oem_group))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, enabled: optionEnabled(nodesAll, state, 'oem', value) })),
    layers: LAYERS.filter((value) => value).map((value) => ({ value, enabled: optionEnabled(nodesAll, state, 'layer', value) })),
    types: types.map((value) => ({ value, enabled: optionEnabled(nodesAll, state, 'type', value) })),
    confidences: uniq(nodesAll.map((node) => node.confidence))
      .sort(compareConfidence)
      .map((value) => ({ value, enabled: optionEnabled(nodesAll, state, 'confidence', value) }))
  };
}

export function getGovernanceMetrics(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const levelCounts = new Map([[4, 0], [3, 0], [2, 0], [1, 0], [0, 0]]);
  const missingFields = {
    evidence_status: 0,
    verification_level: 0,
    verification_status: 0,
    source_url: 0,
    source_name: 0,
    source_date: 0,
    provenance_id: 0
  };

  edges.forEach((edge) => {
    const parsedLevel = parseLevel(edge.verification_level);
    levelCounts.set(parsedLevel, (levelCounts.get(parsedLevel) || 0) + 1);
    Object.keys(missingFields).forEach((key) => {
      if (!safe(edge[key])) missingFields[key] += 1;
    });
  });

  const oemAgg = new Map();
  const layerAgg = new Map();
  const statusAgg = new Map();

  edges.forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const oem = source?.oem_group || target?.oem_group || 'UNKNOWN';
    const layerSet = [source?.layer, target?.layer].filter(Boolean);
    const level = parseLevel(edge.verification_level);
    const status = edge.evidence_status || 'BLANK';

    if (!oemAgg.has(oem)) oemAgg.set(oem, { oem, edges: 0, l4: 0, l3: 0, l2: 0, l1: 0 });
    const oemRow = oemAgg.get(oem);
    oemRow.edges += 1;
    if (level >= 4) oemRow.l4 += 1;
    else if (level >= 3) oemRow.l3 += 1;
    else if (level >= 2) oemRow.l2 += 1;
    else if (level >= 1) oemRow.l1 += 1;

    layerSet.forEach((layer) => {
      if (!layerAgg.has(layer)) layerAgg.set(layer, { layer, edges: 0, l4: 0, l3: 0, l2: 0, l1: 0 });
      const layerRow = layerAgg.get(layer);
      layerRow.edges += 1;
      if (level >= 4) layerRow.l4 += 1;
      else if (level >= 3) layerRow.l3 += 1;
      else if (level >= 2) layerRow.l2 += 1;
      else if (level >= 1) layerRow.l1 += 1;
    });

    statusAgg.set(status, (statusAgg.get(status) || 0) + 1);
  });

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    levelCounts,
    missingRows: Object.entries(missingFields)
      .map(([field, missing]) => ({ field, missing, pct: edges.length ? missing / edges.length : 0 }))
      .sort((a, b) => b.missing - a.missing),
    statusRows: [...statusAgg.entries()]
      .map(([status, count]) => ({ status, count, pct: edges.length ? count / edges.length : 0 }))
      .sort((a, b) => b.count - a.count),
    oemRows: [...oemAgg.values()]
      .map((row) => ({ ...row, verified_pct: row.edges ? (row.l4 + row.l3) / row.edges : 0 }))
      .sort((a, b) => b.verified_pct - a.verified_pct),
    layerRows: [...layerAgg.values()]
      .map((row) => ({ ...row, verified_pct: row.edges ? (row.l4 + row.l3) / row.edges : 0, modelled_pct: row.edges ? row.l1 / row.edges : 0 }))
      .sort((a, b) => a.verified_pct - b.verified_pct)
  };
}
