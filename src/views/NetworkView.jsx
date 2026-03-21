import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, X, GitCompare, Link2, Download, Copy, Check } from 'lucide-react';
import * as d3 from 'd3';
import { edgeDash, edgeStroke, nodeFill } from '../lib/data';
import { displayRegion } from '../lib/utils';

const LABEL_MODES = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'expanded', label: 'Expanded' },
  { value: 'focused', label: 'Focused' }
];

const RENDER_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'overview', label: 'Overview' },
  { value: 'detail', label: 'Detail' }
];

const DEGREE_OPTIONS = [
  { value: 0, label: 'All nodes' },
  { value: 2, label: 'Degree 2+' },
  { value: 4, label: 'Degree 4+' }
];


const DEALER_LAYER = 'Dealer Systems';


const INTERACTION_EASE = 'opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease, fill 160ms ease';

const DEALER_CATEGORY_OPTIONS = [
  { value: 'DMS', label: 'DMS' },
  { value: 'CRM', label: 'CRM' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Service', label: 'Service' },
  { value: 'Marketplace', label: 'Marketplace' },
  { value: 'Platform', label: 'Platform' }
];


const SCENARIO_PRESETS = [
  {
    value: 'default',
    label: 'Default',
    description: 'Balanced overview across the visible system.'
  },
  {
    value: 'dealer',
    label: 'Dealer Ecosystem',
    description: 'Foreground dealer systems, marketplaces, and retail-enabling platforms.'
  },
  {
    value: 'control',
    label: 'Control Points',
    description: 'Surfaces broad, cross-layer influence and likely control hubs.'
  },
  {
    value: 'evidence',
    label: 'Evidence Focus',
    description: 'Reduces weaker mapping and foregrounds stronger evidence.'
  },
  {
    value: 'governance',
    label: 'Governance',
    description: 'Brings governance, compliance, and regulatory structures into focus.'
  },
  {
    value: 'pathways',
    label: 'Pathways',
    description: 'Optimised for tracing movement across layers and connected pathways.'
  }
];


const VIEW_STATE_HASH_PREFIX = 'view=';

function serializeViewState(viewState) {
  try {
    return encodeURIComponent(JSON.stringify(viewState));
  } catch {
    return '';
  }
}

function deserializeViewStateFromHash(hashValue) {
  if (!hashValue) return null;
  const cleaned = String(hashValue).replace(/^#/, '');
  const payload = cleaned.startsWith(VIEW_STATE_HASH_PREFIX)
    ? cleaned.slice(VIEW_STATE_HASH_PREFIX.length)
    : cleaned;

  if (!payload) return null;

  try {
    return JSON.parse(decodeURIComponent(payload));
  } catch {
    return null;
  }
}

function formatExportBlock(title, lines = []) {
  const filtered = lines.filter(Boolean);
  if (!filtered.length) return '';
  return [`## ${title}`, ...filtered].join('');
}


function normalizeDealerCategory(node) {
  const raw = String(node?.node_type || '').toLowerCase();
  const label = String(node?.label || '').toLowerCase();
  const description = String(node?.description || '').toLowerCase();
  const notes = String(node?.notes || '').toLowerCase();
  const haystack = `${raw} ${label} ${description} ${notes}`;

  if (haystack.includes('dms')) return 'DMS';
  if (haystack.includes('crm') || haystack.includes('salesforce')) return 'CRM';

  if (
    haystack.includes('finance') ||
    haystack.includes('f&i') ||
    haystack.includes('autofi') ||
    haystack.includes('dealertrack') ||
    haystack.includes('routeone')
  ) {
    return 'Finance';
  }

  if (
    haystack.includes('service') ||
    haystack.includes('aftersales') ||
    haystack.includes('after-sales') ||
    haystack.includes('xtime') ||
    haystack.includes('solera') ||
    haystack.includes('repair')
  ) {
    return 'Service';
  }

  if (
    haystack.includes('marketplace') ||
    haystack.includes('cargurus') ||
    haystack.includes('carsales') ||
    haystack.includes('autotrader')
  ) {
    return 'Marketplace';
  }

  if (haystack.includes('platform') || haystack.includes('ecosystem')) {
    return 'Platform';
  }

  return 'Platform';
}


function isDealerNode(node) {
  return node?.layer === DEALER_LAYER;
}

function isDealerRelatedEdge(edge) {
  if (!edge) return false;
  if (edge.layer === DEALER_LAYER) return true;
  if (edge.source?.layer === DEALER_LAYER || edge.target?.layer === DEALER_LAYER) return true;
  if (edge.sourceNode?.layer === DEALER_LAYER || edge.targetNode?.layer === DEALER_LAYER) return true;
  return false;
}

function dealerCategoryStyle(node) {
  const category = normalizeDealerCategory(node);

  switch (category) {
    case 'DMS':
      return {
        category,
        stroke: '#67d7ff',
        halo: 'rgba(103,215,255,0.16)',
        dashArray: null,
        edgeStroke: 'rgba(103,215,255,0.58)',
        markerMode: 'outer',
        radiusBonus: 0.9,
        accentOpacity: 0.9
      };
    case 'CRM':
      return {
        category,
        stroke: '#8fe388',
        halo: 'rgba(143,227,136,0.15)',
        dashArray: null,
        edgeStroke: 'rgba(143,227,136,0.56)',
        markerMode: 'inner',
        radiusBonus: 0.65,
        accentOpacity: 0.88
      };
    case 'Finance':
      return {
        category,
        stroke: '#f7c76a',
        halo: 'rgba(247,199,106,0.15)',
        dashArray: '2 2',
        edgeStroke: 'rgba(247,199,106,0.54)',
        markerMode: 'dashed',
        radiusBonus: 0.7,
        accentOpacity: 0.82
      };
    case 'Service':
      return {
        category,
        stroke: '#ffab73',
        halo: 'rgba(255,171,115,0.16)',
        dashArray: '4 2',
        edgeStroke: 'rgba(255,171,115,0.54)',
        markerMode: 'halo',
        radiusBonus: 0.72,
        accentOpacity: 0.78
      };
    case 'Marketplace':
      return {
        category,
        stroke: '#d2a8ff',
        halo: 'rgba(210,168,255,0.16)',
        dashArray: null,
        edgeStroke: 'rgba(210,168,255,0.54)',
        markerMode: 'outer-soft',
        radiusBonus: 0.78,
        accentOpacity: 0.78
      };
    default:
      return {
        category: 'Platform',
        stroke: '#a7b3c7',
        halo: 'rgba(167,179,199,0.15)',
        dashArray: '1.5 2.5',
        edgeStroke: 'rgba(167,179,199,0.5)',
        markerMode: 'scale',
        radiusBonus: 1.05,
        accentOpacity: 0.7
      };
  }
}


function formatRelationshipLabel(value) {
  const raw = String(value || 'Connected').trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  const mapping = {
    'supplies': 'Supplies',
    'supply': 'Supplies',
    'integrates with': 'Integrates with',
    'integrates': 'Integrates with',
    'hosts': 'Hosts',
    'hosts on': 'Hosted on',
    'hosted on': 'Hosted on',
    'supports': 'Supports',
    'connects': 'Connects to',
    'connected': 'Connected to',
    'connects to': 'Connects to',
    'manages relationship': 'Manages relationship',
    'manages relationships': 'Manages relationship',
    'manages service': 'Manages service',
    'owns': 'Owns',
    'regulated by': 'Regulated by',
    'governs': 'Governs',
    'depends on': 'Depends on'
  };

  if (mapping[normalized]) return mapping[normalized];

  return normalized.replace(/\w/g, (char) => char.toUpperCase());
}

function summarizeVerification(node) {
  const status = node?.verification_status || node?.evidence_status || 'Unknown';
  const level = node?.verification_level ? `L${node.verification_level}` : null;
  return level ? `${level} · ${status}` : status;
}

function normalizeConfidenceRank(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('hard') || raw.includes('high') || raw.includes('verified')) return 3;
  if (raw.includes('medium') || raw.includes('moderate')) return 2;
  if (raw.includes('soft') || raw.includes('low') || raw.includes('assumed') || raw.includes('model')) return 1;
  return 0;
}

function summarizeEvidenceStrength(value) {
  const rank = normalizeConfidenceRank(value);
  if (rank >= 3) return 'Higher-confidence mapping';
  if (rank == 2) return 'Moderate-confidence mapping';
  if (rank == 1) return 'Illustrative / softer mapping';
  return 'Confidence not specified';
}

function toTitleCase(value) {
  if (!value) return 'Unknown';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w/g, (char) => char.toUpperCase());
}

function summarizeNodeRole(node, dealerCategory, relationshipCount, strongestGroupLabel = null) {
  const layer = node?.layer ? toTitleCase(node.layer) : 'network';
  const boundary = node?.control_boundary ? toTitleCase(node.control_boundary) : null;
  const type = node?.type || node?.node_type ? toTitleCase(node.type || node.node_type) : null;

  if (dealerCategory) {
    const oem = node?.oem_group ? ` for ${node.oem_group}` : '';
    const relation = strongestGroupLabel ? ` Most visible pattern: ${strongestGroupLabel.toLowerCase()}.` : '';
    return `${dealerCategory} node${oem} in ${layer.toLowerCase()}${boundary ? ` · ${boundary.toLowerCase()} boundary` : ''} · ${relationshipCount} connected relationship${relationshipCount === 1 ? '' : 's'}.${relation}`;
  }

  const relation = strongestGroupLabel ? ` Most visible pattern: ${strongestGroupLabel.toLowerCase()}.` : '';
  return `${type || 'Node'} in ${layer.toLowerCase()}${boundary ? ` · ${boundary.toLowerCase()} boundary` : ''} · ${relationshipCount} connected relationship${relationshipCount === 1 ? '' : 's'}.${relation}`;
}

function relationshipInsight(groups) {
  if (!groups?.length) return 'No connected relationships mapped yet.';
  const strongest = groups[0];
  const count = strongest.total || strongest.items?.length || 0;
  const strongestItem = strongest.items?.[0];
  const evidence = summarizeEvidenceStrength(strongestItem?.confidence || strongest.topConfidence);
  const target = strongestItem?.label ? ` with ${strongestItem.label}` : '';
  return `${strongest.label} is the clearest visible pattern (${count})${target}. ${evidence}.`;
}


function formatMetricDelta(value) {
  if (!Number.isFinite(value) || value === 0) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value}`;
}

function globalObservationTone(kind) {
  switch (kind) {
    case 'control':
      return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
    case 'evidence':
      return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
    case 'bridge':
      return 'border-violet-400/25 bg-violet-500/10 text-violet-100';
    case 'path':
      return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
    default:
      return 'border-border/30 bg-muted/10 text-foreground/80';
  }
}

function relationshipGroupPriority(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('govern')) return 90;
  if (normalized.includes('regulat')) return 88;
  if (normalized.includes('owns')) return 84;
  if (normalized.includes('integrates')) return 80;
  if (normalized.includes('supports')) return 76;
  if (normalized.includes('supplies')) return 72;
  if (normalized.includes('hosts')) return 68;
  if (normalized.includes('manages')) return 66;
  if (normalized.includes('connects')) return 64;
  return 50;
}

function confidenceVisualTone(value) {
  const rank = normalizeConfidenceRank(value);
  if (rank >= 3) {
    return { label: "Higher confidence", chip: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200", edgeOpacity: 0.22, edgeBoost: 0.34 };
  }
  if (rank === 2) {
    return { label: "Moderate confidence", chip: "border-sky-400/30 bg-sky-500/10 text-sky-200", edgeOpacity: 0.18, edgeBoost: 0.2 };
  }
  return { label: "Modelled / softer", chip: "border-amber-300/25 bg-amber-500/10 text-amber-200", edgeOpacity: 0.14, edgeBoost: 0.08 };
}

function calculateControlPointMetrics(node, canonicalNodeMap, edges) {
  if (!node) return {
    degree: 0,
    linkedLayers: 0,
    linkedRegions: 0,
    bridgeScore: 0,
    score: 0,
    level: 'Standard',
    summary: 'Local node with limited mapped control reach.'
  };

  const relatedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const linkedNodes = relatedEdges
    .map((edge) => canonicalNodeMap.get(edge.source === node.id ? edge.target : edge.source))
    .filter(Boolean);

  const degree = relatedEdges.length;
  const linkedLayers = new Set(linkedNodes.map((item) => item.layer).filter(Boolean)).size;
  const linkedRegions = new Set(linkedNodes.map((item) => item.region).filter(Boolean)).size;
  const bridgeScore = (node.layer === DEALER_LAYER ? 2 : 0) + (linkedLayers > 1 ? linkedLayers - 1 : 0) + (linkedRegions > 1 ? linkedRegions - 1 : 0);
  const confidenceBoost = normalizeConfidenceRank(node.confidence || node.verification_status || node.evidence_status);
  const score = degree * 1.6 + linkedLayers * 3 + linkedRegions * 2 + bridgeScore * 2.2 + confidenceBoost * 1.2;

  let level = 'Standard';
  if (score >= 24) level = 'Primary control point';
  else if (score >= 16) level = 'Cross-layer control point';
  else if (score >= 10) level = 'Emerging control point';

  let summary = 'Local node with limited mapped control reach.';
  if (level === 'Primary control point') {
    summary = `High-connectivity node spanning ${Math.max(1, linkedLayers)} layer${linkedLayers === 1 ? '' : 's'} and ${Math.max(1, linkedRegions)} region${linkedRegions === 1 ? '' : 's'}.`;
  } else if (level === 'Cross-layer control point') {
    summary = `Acts as a bridge across ${Math.max(1, linkedLayers)} layer${linkedLayers === 1 ? '' : 's'} with visible cross-system dependencies.`;
  } else if (level === 'Emerging control point') {
    summary = `Shows early control characteristics through ${degree} mapped relationship${degree === 1 ? '' : 's'} and multi-context links.`;
  }

  return { degree, linkedLayers, linkedRegions, bridgeScore, score, level, summary };
}

function controlPointVisualState(metrics) {
  if (!metrics) return { radiusBoost: 0, strokeBoost: 0, haloOpacity: 0, ringOpacity: 0, badge: null };
  if (metrics.level === 'Primary control point') {
    return { radiusBoost: 1.4, strokeBoost: 0.65, haloOpacity: 0.22, ringOpacity: 0.9, badge: 'Primary control point' };
  }
  if (metrics.level === 'Cross-layer control point') {
    return { radiusBoost: 0.95, strokeBoost: 0.4, haloOpacity: 0.16, ringOpacity: 0.72, badge: 'Cross-layer control point' };
  }
  if (metrics.level === 'Emerging control point') {
    return { radiusBoost: 0.55, strokeBoost: 0.2, haloOpacity: 0.1, ringOpacity: 0.5, badge: 'Emerging control point' };
  }
  return { radiusBoost: 0, strokeBoost: 0, haloOpacity: 0, ringOpacity: 0, badge: null };
}

function detailNodeRadius(node, degreeMap, selectedId, hoveredId, controlPointMetrics = null) {
  const degree = degreeMap.get(node.id) || 0;
  const base = Math.min(6.2, 4 + degree * 0.16);
  const dealerBonus = isDealerNode(node) ? dealerCategoryStyle(node).radiusBonus : 0;
  const controlPointBonus = controlPointVisualState(controlPointMetrics).radiusBoost;

  if (selectedId === node.id) return base + dealerBonus + controlPointBonus + 2.4;
  if (hoveredId === node.id) return base + dealerBonus + controlPointBonus + 1.6;
  return base + dealerBonus + controlPointBonus;
}

function detailEdgeBaseStyle(edge) {
  const confidenceTone = confidenceVisualTone(edge.confidence || edge.verification_status || edge.evidence_status);

  if (isDealerRelatedEdge(edge)) {
    const dealerNode = isDealerNode(edge.source) ? edge.source : isDealerNode(edge.target) ? edge.target : null;
    const categoryStyle = dealerCategoryStyle(dealerNode);
    const relation = String(edge.relationship || edge.relation || '').toLowerCase();

    if (relation.includes('host')) {
      return {
        stroke: 'rgba(167,179,199,0.46)',
        dashArray: '2 3',
        baseOpacity: Math.max(0.16, confidenceTone.edgeOpacity),
        widthBoost: confidenceTone.edgeBoost
      };
    }

    return {
      stroke: categoryStyle.edgeStroke,
      dashArray: categoryStyle.dashArray,
      baseOpacity: Math.max(0.16, confidenceTone.edgeOpacity + 0.03),
      widthBoost: confidenceTone.edgeBoost
    };
  }

  return {
    stroke: edgeStroke(edge),
    dashArray: edgeDash(edge),
    baseOpacity: confidenceTone.edgeOpacity,
    widthBoost: confidenceTone.edgeBoost
  };
}

function createSafeHoverEvent(event, tooltipWidth = 280, tooltipHeight = 160, padding = 16) {
  const sourceClientX = Number.isFinite(event?.clientX) ? event.clientX : 0;
  const sourceClientY = Number.isFinite(event?.clientY) ? event.clientY : 0;

  const viewportWidth =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 1440;
  const viewportHeight =
    typeof window !== 'undefined' && Number.isFinite(window.innerHeight) ? window.innerHeight : 900;
  const scrollX =
    typeof window !== 'undefined' && Number.isFinite(window.scrollX) ? window.scrollX : 0;
  const scrollY =
    typeof window !== 'undefined' && Number.isFinite(window.scrollY) ? window.scrollY : 0;

  let clientX = sourceClientX + 14;
  let clientY = sourceClientY + 14;

  if (clientX + tooltipWidth > viewportWidth - padding) {
    clientX = sourceClientX - tooltipWidth - 14;
  }

  if (clientY + tooltipHeight > viewportHeight - padding) {
    clientY = sourceClientY - tooltipHeight - 14;
  }

  clientX = Math.max(padding, Math.min(clientX, viewportWidth - tooltipWidth - padding));
  clientY = Math.max(padding, Math.min(clientY, viewportHeight - tooltipHeight - padding));

  return {
    ...event,
    clientX,
    clientY,
    pageX: clientX + scrollX,
    pageY: clientY + scrollY
  };
}



function EmptyState() {
  return (
    <div className="flex min-h-[900px] items-center justify-center rounded-xl border border-dashed border-border/40 bg-card/20 p-8 text-center text-sm text-muted-foreground">
      No nodes matched the current filter set.
    </div>
  );
}

function truncateLabel(value, max = 28) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function uniqueValues(items, accessor) {
  return [...new Set(items.map(accessor).filter(Boolean))];
}

function buildAdjacency(edges) {
  const map = new Map();

  edges.forEach((edge) => {
    if (!edge.source || !edge.target) return;
    if (!map.has(edge.source)) map.set(edge.source, new Set());
    if (!map.has(edge.target)) map.set(edge.target, new Set());
    map.get(edge.source).add(edge.target);
    map.get(edge.target).add(edge.source);
  });

  return map;
}


function makeEdgeKey(source, target) {
  return [source, target].sort().join('::');
}

function buildShortestPath(edges, startId, endId, nodeMap = new Map()) {
  if (!startId || !endId) return null;
  if (startId === endId) {
    return {
      found: true,
      nodeIds: [startId],
      edgeKeys: [],
      hops: 0,
      layers: nodeMap.get(startId)?.layer ? [nodeMap.get(startId).layer] : []
    };
  }

  const adjacency = new Map();

  edges.forEach((edge) => {
    const sourceId = typeof edge.source === 'object' ? edge.source?.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target?.id : edge.target;
    if (!sourceId || !targetId) return;

    if (!adjacency.has(sourceId)) adjacency.set(sourceId, []);
    if (!adjacency.has(targetId)) adjacency.set(targetId, []);

    adjacency.get(sourceId).push(targetId);
    adjacency.get(targetId).push(sourceId);
  });

  const queue = [startId];
  const visited = new Set([startId]);
  const previous = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current === endId) break;

    (adjacency.get(current) || []).forEach((nextId) => {
      if (visited.has(nextId)) return;
      visited.add(nextId);
      previous.set(nextId, current);
      queue.push(nextId);
    });
  }

  if (!visited.has(endId)) {
    return {
      found: false,
      nodeIds: [],
      edgeKeys: [],
      hops: null,
      layers: []
    };
  }

  const nodeIds = [];
  let cursor = endId;
  while (cursor) {
    nodeIds.unshift(cursor);
    cursor = previous.get(cursor) || null;
  }

  const edgeKeys = [];
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    edgeKeys.push(makeEdgeKey(nodeIds[index], nodeIds[index + 1]));
  }

  return {
    found: true,
    nodeIds,
    edgeKeys,
    hops: Math.max(0, nodeIds.length - 1),
    layers: [...new Set(nodeIds.map((id) => nodeMap.get(id)?.layer).filter(Boolean))]
  };
}

function buildDegreeMap(edges) {
  const map = new Map();

  edges.forEach((edge) => {
    if (!edge.source || !edge.target) return;
    map.set(edge.source, (map.get(edge.source) || 0) + 1);
    map.set(edge.target, (map.get(edge.target) || 0) + 1);
  });

  return map;
}

function getBounds(nodes) {
  return {
    minX: d3.min(nodes, (d) => d.x) ?? 0,
    maxX: d3.max(nodes, (d) => d.x) ?? 0,
    minY: d3.min(nodes, (d) => d.y) ?? 0,
    maxY: d3.max(nodes, (d) => d.y) ?? 0
  };
}

function fitTransform(width, height, bounds, padding = 88) {
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);

  const scale = Math.min(
    1.04,
    Math.max(
      0.48,
      Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight)
    )
  );

  const tx = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
  const ty = height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;

  return d3.zoomIdentity.translate(tx, ty).scale(scale);
}

function buildRegionRanks(nodes, degreeMap) {
  const byRegion = d3.group(nodes, (node) => node.region || 'Unknown');
  const ranks = new Map();

  byRegion.forEach((regionNodes) => {
    const sorted = [...regionNodes].sort((a, b) => {
      const degreeDiff = (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0);
      if (degreeDiff !== 0) return degreeDiff;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });

    sorted.forEach((node, index) => {
      ranks.set(node.id, index);
    });
  });

  return ranks;
}

function buildClusterGraph(nodes, edges, degreeMap, threshold) {
  const keptIds = new Set(
    nodes
      .filter((node) => threshold === 0 || (degreeMap.get(node.id) || 0) >= threshold)
      .map((node) => node.id)
  );

  const keptNodes = nodes.filter((node) => keptIds.has(node.id));
  const grouped = d3.group(keptNodes, (node) => `${node.region || 'Unknown'}||${node.layer || 'Unknown'}`);

  const clusterNodes = [];
  const membership = new Map();

  grouped.forEach((items, key) => {
    const [region, layer] = key.split('||');
    const preview = [...items]
      .sort((a, b) => (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0))
      .slice(0, 3)
      .map((item) => item.label)
      .filter(Boolean);

    const cluster = {
      id: key,
      region,
      layer,
      label: layer || 'Unspecified layer',
      memberCount: items.length,
      preview,
      members: items,
      type: 'cluster'
    };

    clusterNodes.push(cluster);
    items.forEach((item) => membership.set(item.id, cluster.id));
  });

  const edgeMap = new Map();

  edges.forEach((edge) => {
    const sourceCluster = membership.get(edge.source);
    const targetCluster = membership.get(edge.target);

    if (!sourceCluster || !targetCluster || sourceCluster === targetCluster) return;

    const orderedKey =
      sourceCluster < targetCluster
        ? `${sourceCluster}__${targetCluster}`
        : `${targetCluster}__${sourceCluster}`;

    if (!edgeMap.has(orderedKey)) {
      edgeMap.set(orderedKey, {
        id: orderedKey,
        source: sourceCluster,
        target: targetCluster,
        weight: 0
      });
    }

    edgeMap.get(orderedKey).weight += 1;
  });

  return {
    nodes: clusterNodes,
    edges: [...edgeMap.values()]
  };
}

function buildDetailGraph(nodes, edges, degreeMap, threshold, expandedClusterKey, options = {}) {
  const keptIds = new Set(
    nodes
      .filter((node) => threshold === 0 || (degreeMap.get(node.id) || 0) >= threshold)
      .map((node) => node.id)
  );

  const keptNodes = nodes.filter((node) => keptIds.has(node.id));
  const keptEdges = edges.filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target));
  const adjacency = new Map();
  keptNodes.forEach((node) => adjacency.set(node.id, new Set()));
  keptEdges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });

  const {
    selectedId = null,
    compareIds = [],
    activeScenarioPreset = 'default'
  } = options;

  const rankByDegree = (items) => [...items].sort((a, b) => (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0));

  const selectPresetSeeds = () => {
    const byDegree = rankByDegree(keptNodes);
    if (activeScenarioPreset === 'dealer') {
      return byDegree.filter((node) => node.layer === DEALER_LAYER).slice(0, 5);
    }
    if (activeScenarioPreset === 'governance') {
      return byDegree
        .filter((node) => {
          const layer = String(node.layer || '').toLowerCase();
          const type = String(node.type || node.node_type || '').toLowerCase();
          const boundary = String(node.control_boundary || '').toLowerCase();
          return layer.includes('governance') || type.includes('governance') || boundary.includes('regulatory') || boundary.includes('government');
        })
        .slice(0, 6);
    }
    if (activeScenarioPreset === 'evidence') {
      return byDegree
        .filter((node) => ['verified', 'hard', 'referenced'].includes(String(node.verification_status || node.confidence || '').toLowerCase()))
        .slice(0, 6);
    }
    if (activeScenarioPreset === 'control') {
      const bridgeScores = keptNodes.map((node) => {
        const neighborLayers = new Set([...(adjacency.get(node.id) || new Set())].map((id) => {
          const match = keptNodes.find((item) => item.id === id);
          return match?.layer || 'Unknown';
        }));
        return { node, score: neighborLayers.size * 10 + (degreeMap.get(node.id) || 0) };
      });
      return bridgeScores.sort((a, b) => b.score - a.score).slice(0, 5).map((item) => item.node);
    }
    if (activeScenarioPreset === 'pathways') {
      return byDegree.slice(0, 4);
    }
    return byDegree.slice(0, 3);
  };

  let seedIds = new Set();

  if (selectedId && keptIds.has(selectedId)) {
    seedIds.add(selectedId);
  }

  compareIds.filter((id) => keptIds.has(id)).forEach((id) => seedIds.add(id));

  if (expandedClusterKey) {
    const [targetRegion, targetLayer] = expandedClusterKey.split('||');
    rankByDegree(
      keptNodes.filter(
        (node) =>
          (node.region || 'Unknown') === targetRegion &&
          (node.layer || 'Unknown') === targetLayer
      )
    )
      .slice(0, 8)
      .forEach((node) => seedIds.add(node.id));
  }

  if (seedIds.size === 0) {
    selectPresetSeeds().forEach((node) => seedIds.add(node.id));
  }

  const includedIds = new Set(seedIds);
  const secondDegreeCandidates = new Map();

  seedIds.forEach((seedId) => {
    (adjacency.get(seedId) || new Set()).forEach((neighborId) => {
      includedIds.add(neighborId);
      (adjacency.get(neighborId) || new Set()).forEach((nextId) => {
        if (!includedIds.has(nextId) && !seedIds.has(nextId)) {
          secondDegreeCandidates.set(
            nextId,
            Math.max(secondDegreeCandidates.get(nextId) || 0, degreeMap.get(nextId) || 0)
          );
        }
      });
    });
  });

  [...secondDegreeCandidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, activeScenarioPreset === 'governance' ? 16 : 12)
    .forEach(([id]) => includedIds.add(id));

  if (includedIds.size < 12) {
    rankByDegree(keptNodes)
      .filter((node) => !includedIds.has(node.id))
      .slice(0, 12 - includedIds.size)
      .forEach((node) => includedIds.add(node.id));
  }

  const detailNodes = keptNodes.filter((node) => includedIds.has(node.id));
  const detailIds = new Set(detailNodes.map((node) => node.id));

  return {
    nodes: detailNodes,
    edges: keptEdges.filter((edge) => detailIds.has(edge.source) && detailIds.has(edge.target)),
    focusIds: [...seedIds]
  };
}

function shouldShowOverviewLabel(cluster, zoomK, labelMode, hoveredClusterId, expandedClusterKey) {
  if (cluster.id === hoveredClusterId || cluster.id === expandedClusterKey) return true;
  if (zoomK >= 1.6) return cluster.memberCount >= 4;
  if (labelMode === 'expanded') return cluster.memberCount >= 5;
  if (labelMode === 'focused') return cluster.memberCount >= 9;
  return cluster.memberCount >= 7;
}


function formatExpandedClusterLabel(expandedClusterKey) {
  if (!expandedClusterKey) return '';
  const [region, layer] = expandedClusterKey.split('||');
  const regionLabel = region ? displayRegion(region) : 'Unknown';
  return `${regionLabel} → ${layer || 'Unknown'}`;
}

function shouldShowDetailLabel({
  node,
  zoomK,
  labelMode,
  degreeMap,
  regionRanks,
  selectedId,
  hoveredId,
  selectedFocusSet,
  hoveredFocusSet,
  pinnedIds
}) {
  if (selectedId === node.id || hoveredId === node.id || pinnedIds.has(node.id)) return true;
  if (selectedId && selectedFocusSet.has(node.id)) return true;
  if (!selectedId && hoveredId && hoveredFocusSet.has(node.id)) return true;

  const degree = degreeMap.get(node.id) || 0;
  const rank = regionRanks.get(node.id) ?? 999;
  const zoomBonus = zoomK >= 2 ? 7 : zoomK >= 1.55 ? 4 : zoomK >= 1.2 ? 2 : 0;

  if (labelMode === 'expanded') {
    return degree >= 3 || rank < 14 + zoomBonus;
  }

  if (labelMode === 'focused') {
    return degree >= 8 || rank < 6 + zoomBonus;
  }

  return degree >= 6 || rank < 9 + zoomBonus;
}

function layerKey(value) {
  return String(value || 'Unspecified');
}

function buildDetailSublaneTargets(nodes, regions, xScale, height, topPad, bottomPad) {
  const byRegion = d3.group(nodes, (node) => node.region || 'Unknown');
  const targetMap = new Map();

  byRegion.forEach((regionNodes, region) => {
    const layers = uniqueValues(regionNodes, (node) => layerKey(node.layer)).sort((a, b) =>
      a.localeCompare(b)
    );

    const sublaneScale = d3.scalePoint().domain(layers).range([-110, 110]);

    layers.forEach((layer) => {
      const laneNodes = regionNodes
        .filter((node) => layerKey(node.layer) === layer)
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));

      const usableHeight = Math.max(220, height - topPad - bottomPad - 40);
      const step = usableHeight / Math.max(1, laneNodes.length - 1);

      laneNodes.forEach((node, index) => {
        const regionX = xScale(region) || 0;
        const sublaneX = sublaneScale(layer) || 0;
        const yTarget =
          laneNodes.length === 1
            ? topPad + usableHeight / 2
            : topPad + 20 + step * index;

        targetMap.set(node.id, {
          targetX: regionX + sublaneX,
          targetY: yTarget,
          laneLabel: layer
        });
      });
    });
  });

  return targetMap;
}

function buildFocusDistanceMap(nodeIds, links, seedIds) {
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));

  links.forEach((edge) => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source?.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
    if (!sourceId || !targetId) return;
    if (!adjacency.has(sourceId)) adjacency.set(sourceId, new Set());
    if (!adjacency.has(targetId)) adjacency.set(targetId, new Set());
    adjacency.get(sourceId).add(targetId);
    adjacency.get(targetId).add(sourceId);
  });

  const distanceMap = new Map();
  const queue = [];

  seedIds.forEach((id) => {
    if (adjacency.has(id)) {
      distanceMap.set(id, 0);
      queue.push(id);
    }
  });

  while (queue.length) {
    const current = queue.shift();
    const distance = distanceMap.get(current) ?? 0;

    (adjacency.get(current) || new Set()).forEach((nextId) => {
      if (!distanceMap.has(nextId)) {
        distanceMap.set(nextId, distance + 1);
        queue.push(nextId);
      }
    });
  }

  return distanceMap;
}

function buildConstellationTargets(nodes, links, width, height, leftPad, rightPad, topPad, bottomPad, seedIds) {
  const targetMap = new Map();
  const innerWidth = Math.max(360, width - leftPad - rightPad);
  const innerHeight = Math.max(320, height - topPad - bottomPad);
  const centerX = leftPad + innerWidth / 2;
  const centerY = topPad + innerHeight / 2;
  const nodeIds = nodes.map((node) => node.id);
  const distanceMap = buildFocusDistanceMap(nodeIds, links, seedIds);

  const seeds = nodes.filter((node) => seedIds.has(node.id));
  const ringOne = nodes.filter((node) => !seedIds.has(node.id) && (distanceMap.get(node.id) ?? 99) === 1);
  const ringTwo = nodes.filter((node) => !seedIds.has(node.id) && (distanceMap.get(node.id) ?? 99) >= 2);

  const placeRing = (items, radiusX, radiusY, startAngle = -Math.PI * 0.85, endAngle = Math.PI * 0.85) => {
    const sorted = [...items].sort((a, b) => {
      const regionCompare = String(a.region || '').localeCompare(String(b.region || ''));
      if (regionCompare !== 0) return regionCompare;
      const layerCompare = String(a.layer || '').localeCompare(String(b.layer || ''));
      if (layerCompare !== 0) return layerCompare;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });

    sorted.forEach((node, index) => {
      const t = sorted.length === 1 ? 0.5 : index / Math.max(1, sorted.length - 1);
      const angle = startAngle + (endAngle - startAngle) * t;
      targetMap.set(node.id, {
        targetX: centerX + Math.cos(angle) * radiusX,
        targetY: centerY + Math.sin(angle) * radiusY,
        laneLabel: `focus-${distanceMap.get(node.id) ?? 1}`
      });
    });
  };

  if (seeds.length === 1) {
    targetMap.set(seeds[0].id, { targetX: centerX, targetY: centerY, laneLabel: 'focus-0' });
  } else if (seeds.length > 1) {
    const seedRadiusX = Math.min(82, innerWidth * 0.1);
    const seedRadiusY = Math.min(52, innerHeight * 0.08);
    seeds
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))
      .forEach((node, index) => {
        const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / seeds.length;
        targetMap.set(node.id, {
          targetX: centerX + Math.cos(angle) * seedRadiusX,
          targetY: centerY + Math.sin(angle) * seedRadiusY,
          laneLabel: 'focus-0'
        });
      });
  }

  if (ringOne.length) {
    placeRing(
      ringOne,
      Math.min(innerWidth * 0.3, 280),
      Math.min(innerHeight * 0.26, 190),
      -Math.PI * 0.95,
      Math.PI * 0.95
    );
  }

  if (ringTwo.length) {
    placeRing(
      ringTwo,
      Math.min(innerWidth * 0.4, 380),
      Math.min(innerHeight * 0.34, 250),
      -Math.PI * 0.95,
      Math.PI * 0.95
    );
  }

  nodes.forEach((node) => {
    if (!targetMap.has(node.id)) {
      targetMap.set(node.id, { targetX: centerX, targetY: centerY, laneLabel: 'focus-1' });
    }
  });

  return { targetMap, distanceMap };
}

function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MinusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

function ExpandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}

function RotateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CardKicker({ children, className = '' }) {
  return <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ${className}`}>{children}</div>;
}

function ControlPill({ active = false, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 items-center justify-center rounded-md px-3 text-[9px] font-bold uppercase tracking-[0.16em] transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)]'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function NetworkView({
  nodes,
  edges,
  onNodeHover,
  onNodeSelect,
  onEdgeHover,
  onLeave,
  onCanvasInteract
}) {
  const hasData = nodes.length > 0;
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const hydratedFromHashRef = useRef(false);
  const initialTransformRef = useRef(null);
  const legendBeforeExpandRef = useRef(true);
  const hoveredIdRef = useRef(null);
  const hoveredClusterIdRef = useRef(null);

  const [labelMode, setLabelMode] = useState('balanced');
  const [renderMode, setRenderMode] = useState('auto');
  const [degreeThreshold, setDegreeThreshold] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredClusterId, setHoveredClusterId] = useState(null);
  const [expandedClusterKey, setExpandedClusterKey] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [pinnedPositions, setPinnedPositions] = useState({});
  const [legendVisible, setLegendVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);

  const [dealerLayerEnabled, setDealerLayerEnabled] = useState(false);
  const [dealerCategoryFilters, setDealerCategoryFilters] = useState({
    DMS: true,
    CRM: true,
    Finance: true,
    Service: true,
    Marketplace: true,
    Platform: true
  });

  const [insightSections, setInsightSections] = useState({
    why: true,
    relationships: true,
    metadata: false,
    evidence: false,
    description: false
  });
  const [expandedRelationshipGroups, setExpandedRelationshipGroups] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const [traceActive, setTraceActive] = useState(false);
  const [activeScenarioPreset, setActiveScenarioPreset] = useState('default');
  const [shareFeedback, setShareFeedback] = useState('idle');
  const [snapshotFeedback, setSnapshotFeedback] = useState('idle');
  const [exportFeedback, setExportFeedback] = useState('idle');

  const getSafeHoverEvent = (event) => createSafeHoverEvent(event);

  const dealerAwareData = useMemo(() => {
    const visibleNodes = nodes.filter((node) => {
      if (node.layer !== DEALER_LAYER) return true;
      if (!dealerLayerEnabled) return false;

      const category = normalizeDealerCategory(node);
      return Boolean(dealerCategoryFilters[category]);
    });

    const visibleIds = new Set(visibleNodes.map((node) => node.id));

    const visibleEdges = edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
    );

    return {
      nodes: visibleNodes,
      edges: visibleEdges
    };
  }, [nodes, edges, dealerLayerEnabled, dealerCategoryFilters]);

  const scenarioData = useMemo(() => {
    const canonicalNodeMap = new Map(dealerAwareData.nodes.map((node) => [node.id, node]));

    if (activeScenarioPreset === 'evidence') {
      const strongerEdges = dealerAwareData.edges.filter(
        (edge) =>
          normalizeConfidenceRank(edge.confidence || edge.verification_status || edge.evidence_status) >= 2
      );
      if (!strongerEdges.length) {
        return dealerAwareData;
      }
      const visibleIds = new Set();
      strongerEdges.forEach((edge) => {
        visibleIds.add(edge.source);
        visibleIds.add(edge.target);
      });

      return {
        nodes: dealerAwareData.nodes.filter((node) => visibleIds.has(node.id)),
        edges: strongerEdges
      };
    }

    if (activeScenarioPreset === 'governance') {
      const governanceMatch = (node) => {
        const haystack = `${node?.layer || ''} ${node?.type || ''} ${node?.node_type || ''} ${node?.label || ''} ${node?.description || ''} ${node?.notes || ''}`.toLowerCase();
        return (
          haystack.includes('govern') ||
          haystack.includes('regulat') ||
          haystack.includes('compliance') ||
          haystack.includes('policy') ||
          haystack.includes('authority') ||
          haystack.includes('standard')
        );
      };

      const focusIds = new Set(dealerAwareData.nodes.filter(governanceMatch).map((node) => node.id));
      if (!focusIds.size) {
        return dealerAwareData;
      }

      dealerAwareData.edges.forEach((edge) => {
        if (focusIds.has(edge.source) || focusIds.has(edge.target)) {
          focusIds.add(edge.source);
          focusIds.add(edge.target);
        }
      });

      return {
        nodes: dealerAwareData.nodes.filter((node) => focusIds.has(node.id)),
        edges: dealerAwareData.edges.filter(
          (edge) => focusIds.has(edge.source) && focusIds.has(edge.target)
        )
      };
    }

    return dealerAwareData;
  }, [dealerAwareData, activeScenarioPreset]);

  const baseDegreeMap = useMemo(
    () =>
      buildDegreeMap(
        scenarioData.edges.map((edge) => ({ source: edge.source, target: edge.target }))
      ),
    [scenarioData.edges]
  );

  const resolvedMode = useMemo(() => {
    if (renderMode === 'overview') return 'overview';
    if (renderMode === 'detail') return 'detail';
    if (expandedClusterKey) return 'detail';
    return scenarioData.nodes.length > 320 ? 'overview' : 'detail';
  }, [renderMode, expandedClusterKey, scenarioData.nodes.length]);

  const graph = useMemo(() => {
    if (resolvedMode === 'overview') {
      return buildClusterGraph(
        scenarioData.nodes,
        scenarioData.edges,
        baseDegreeMap,
        degreeThreshold
      );
    }

    return buildDetailGraph(
      scenarioData.nodes,
      scenarioData.edges,
      baseDegreeMap,
      degreeThreshold,
      expandedClusterKey,
      {
        selectedId,
        compareIds,
        activeScenarioPreset
      }
    );
  }, [
    resolvedMode,
    scenarioData.nodes,
    scenarioData.edges,
    baseDegreeMap,
    degreeThreshold,
    expandedClusterKey,
    selectedId,
    compareIds,
    activeScenarioPreset
  ]);

  const pinnedIds = useMemo(() => new Set(Object.keys(pinnedPositions)), [pinnedPositions]);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(null);
    }
  }, [graph.nodes, selectedId]);

  useEffect(() => {
    if (expandedClusterKey && resolvedMode === 'overview') {
      const clusterStillExists = graph.nodes.some((node) => node.id === expandedClusterKey);
      if (!clusterStillExists) {
        setExpandedClusterKey(null);
      }
    }
  }, [expandedClusterKey, graph.nodes, resolvedMode]);

  useEffect(() => {
    if (expanded && legendVisible) {
      setLegendVisible(false);
    }
  }, [expanded, legendVisible]);

  useEffect(() => {
    if (!hasData || !wrapRef.current) return undefined;

    const width = 1720;
    const height = 1100;
    const topPad = 140;
    const bottomPad = 82;
    const leftPad = 96;
    const rightPad = 96;
    let zoomK = 1;

    const rootEl = wrapRef.current;
    rootEl.innerHTML = '';

    const svg = d3
      .select(rootEl)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'h-full w-full');

    const root = svg.append('g');
    const regions = uniqueValues(graph.nodes, (node) => node.region);
    const xScale = d3.scalePoint().domain(regions).range([leftPad + 120, width - rightPad - 120]);

    function drawFrame() {
      root
        .selectAll('.region-label-bg')
        .data(regions)
        .join('rect')
        .attr('x', (region) => (xScale(region) || width / 2) - 72)
        .attr('y', 24)
        .attr('width', 144)
        .attr('height', 28)
        .attr('rx', 14)
        .attr('fill', 'rgba(8,14,24,0.92)')
        .attr('stroke', 'rgba(255,255,255,0.08)');

      root
        .selectAll('.region')
        .data(regions)
        .join('text')
        .attr('x', (region) => xScale(region))
        .attr('y', 42)
        .attr('text-anchor', 'middle')
        .attr('class', 'svg-label')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text((region) => displayRegion(region));

      root
        .selectAll('.region-rule')
        .data(regions)
        .join('line')
        .attr('x1', (region) => xScale(region))
        .attr('x2', (region) => xScale(region))
        .attr('y1', 62)
        .attr('y2', height - bottomPad)
        .attr('stroke', 'rgba(255,255,255,0.05)')
        .attr('stroke-dasharray', '4 7');
    }

    drawFrame();

    if (resolvedMode === 'overview') {
      const layers = uniqueValues(graph.nodes, (node) => node.layer);
      const yScale = d3.scalePoint().domain(layers).range([topPad + 54, height - bottomPad - 40]);

      const layoutNodes = graph.nodes.map((node, index) => ({
        ...node,
        x: (xScale(node.region) || width / 2) + ((index % 4) - 1.5) * 24,
        y: yScale(node.layer) || height / 2
      }));

      const nodeMap = new Map(layoutNodes.map((node) => [node.id, node]));
      const layoutLinks = graph.edges
        .map((edge) => ({
          ...edge,
          source: nodeMap.get(edge.source),
          target: nodeMap.get(edge.target)
        }))
        .filter((edge) => edge.source && edge.target);

      const adjacency = buildAdjacency(
        layoutLinks.map((edge) => ({
          source: edge.source.id,
          target: edge.target.id
        }))
      );

      const simulation = d3
        .forceSimulation(layoutNodes)
        .force(
          'link',
          d3
            .forceLink(layoutLinks)
            .id((datum) => datum.id)
            .distance((edge) => 80 + Math.min(160, edge.weight * 3))
            .strength(0.14)
        )
        .force('charge', d3.forceManyBody().strength(-180))
        .force('collide', d3.forceCollide().radius((datum) => 18 + Math.min(32, datum.memberCount * 1.15)))
        .force('x', d3.forceX((datum) => xScale(datum.region) || width / 2).strength(0.48))
        .force('y', d3.forceY((datum) => yScale(datum.layer) || height / 2).strength(0.28));

      for (let i = 0; i < 260; i += 1) simulation.tick();
      simulation.stop();

      layoutNodes.forEach((node) => {
        node.x = Math.max(leftPad, Math.min(width - rightPad, node.x));
        node.y = Math.max(topPad, Math.min(height - bottomPad, node.y));
      });

      const bounds = getBounds(layoutNodes);
      const initialTransform = fitTransform(width, height, bounds, 96);
      initialTransformRef.current = initialTransform;

      const linkSelection = root
        .append('g')
        .selectAll('line')
        .data(layoutLinks)
        .join('line')
        .style('transition', INTERACTION_EASE)
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
        .attr('stroke', 'rgba(106,165,255,0.42)')
        .attr('stroke-width', (d) => Math.min(5.4, 0.7 + d.weight * 0.18))
        .attr('opacity', 0.22);

      const nodeSelection = root
        .append('g')
        .selectAll('g')
        .data(layoutNodes)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .style('cursor', 'pointer');

      nodeSelection
        .append('circle')
        .style('transition', INTERACTION_EASE)
        .attr('r', (d) => Math.max(8, Math.min(28, 7 + d.memberCount * 0.72)))
        .attr('fill', (d) => (d.layer === DEALER_LAYER ? '#214637' : '#4da6ff'))
        .attr('fill-opacity', (d) => (d.layer === DEALER_LAYER ? 0.28 : 0.2))
        .attr('stroke', (d) => (d.layer === DEALER_LAYER ? '#7cefd1' : '#67d7ff'))
        .attr('stroke-width', (d) => (d.layer === DEALER_LAYER ? 1.5 : 1.2));

      nodeSelection
        .append('circle')
        .style('transition', INTERACTION_EASE)
        .attr('r', (d) => Math.max(4, Math.min(18, 4 + d.memberCount * 0.34)))
        .attr('fill', (d) => (d.layer === DEALER_LAYER ? '#7cefd1' : '#67d7ff'))
        .attr('fill-opacity', (d) => (d.layer === DEALER_LAYER ? 0.88 : 0.82))
        .attr('stroke', 'rgba(255,255,255,0.32)')
        .attr('stroke-width', 0.9);

      const labelSelection = nodeSelection
        .append('text')
        .style('transition', 'opacity 160ms ease, fill 160ms ease')
        .attr('x', 12)
        .attr('y', 4)
        .attr('class', 'svg-text')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text((d) => `${truncateLabel(d.label, 24)} (${d.memberCount})`);

      const refreshOverviewStyles = () => {
        const activeHoveredClusterId = hoveredClusterIdRef.current;
        nodeSelection.selectAll('circle')
          .attr('opacity', (d, i) => {
            if (!activeHoveredClusterId) return i === 0 ? 0.9 : 1;
            if (d.id === activeHoveredClusterId) return 1;
            if ((adjacency.get(activeHoveredClusterId) || new Set()).has(d.id)) return 0.9;
            return 0.16;
          })
          .attr('stroke-width', (d, i) => {
            const base = i === 0 ? (d.layer === DEALER_LAYER ? 1.8 : 1.45) : (d.layer === DEALER_LAYER ? 1.2 : 0.9);
            if (!activeHoveredClusterId) return base;
            if (d.id === activeHoveredClusterId) return base + 0.7;
            if ((adjacency.get(activeHoveredClusterId) || new Set()).has(d.id)) return base + 0.25;
            return Math.max(0.75, base - 0.2);
          });

        linkSelection
          .attr('opacity', (edge) => {
            if (!activeHoveredClusterId) return 0.22;
            if (edge.source.id === activeHoveredClusterId || edge.target.id === activeHoveredClusterId) return 0.92;
            if ((adjacency.get(activeHoveredClusterId) || new Set()).has(edge.source.id) || (adjacency.get(activeHoveredClusterId) || new Set()).has(edge.target.id)) return 0.14;
            return 0.04;
          })
          .attr('stroke', (edge) => {
            if (activeHoveredClusterId && (edge.source.id === activeHoveredClusterId || edge.target.id === activeHoveredClusterId)) {
              return '#7cefd1';
            }
            return 'rgba(106,165,255,0.42)';
          });

        labelSelection
          .style('opacity', (d) => {
            const visible = shouldShowOverviewLabel(d, zoomK, labelMode, activeHoveredClusterId, expandedClusterKey);
            if (!visible) return 0;
            if (!activeHoveredClusterId) return 0.96;
            if (d.id === activeHoveredClusterId) return 1;
            if ((adjacency.get(activeHoveredClusterId) || new Set()).has(d.id)) return 0.72;
            return 0.08;
          })
          .style('font-weight', (d) => {
            if (!activeHoveredClusterId) return '600';
            if (d.id === activeHoveredClusterId) return '700';
            if ((adjacency.get(activeHoveredClusterId) || new Set()).has(d.id)) return '600';
            return '500';
          });
      };

      nodeSelection
        .on('mousemove', (event, d) => {
          hoveredClusterIdRef.current = d.id;
          setHoveredClusterId(d.id);
          onNodeHover?.(getSafeHoverEvent(event), {
            ...d,
            notes: d.preview?.length ? `Representative members: ${d.preview.join(', ')}` : '',
            oem_group: d.region,
            layer: d.layer
          });
          refreshOverviewStyles();
        })
        .on('mouseleave', () => {
          hoveredClusterIdRef.current = null;
          setHoveredClusterId(null);
          onLeave?.();
          refreshOverviewStyles();
        })
        .on('click', (_, d) => {
          const representative = [...(d.members || [])]
            .sort((a, b) => {
              const degreeDiff = (baseDegreeMap.get(b.id) || 0) - (baseDegreeMap.get(a.id) || 0);
              if (degreeDiff !== 0) return degreeDiff;
              return String(a.label || '').localeCompare(String(b.label || ''));
            })[0] || null;

          setExpandedClusterKey(d.id);
          setSelectedId(representative?.id ?? null);
          onNodeSelect?.(representative ?? null);
        });

      const zoom = d3
        .zoom()
        .scaleExtent([0.45, 4.8])
        .on('start', () => onCanvasInteract?.())
        .on('zoom', (event) => {
          zoomK = event.transform.k;
          root.attr('transform', event.transform);
          setZoomPct(Math.round(event.transform.k * 100));
          refreshOverviewStyles();
        });

      zoomBehaviorRef.current = zoom;
      svg.call(zoom);
      svg.call(zoom.transform, initialTransform);
      setZoomPct(Math.round(initialTransform.k * 100));

      svg.on('mouseleave', () => {
        hoveredClusterIdRef.current = null;
        setHoveredClusterId(null);
        onLeave?.();
      });

      refreshOverviewStyles();
      svgRef.current = svg.node();

      return () => {
        svg.on('.zoom', null);
        svg.on('mouseleave', null);
        rootEl.innerHTML = '';
      };
    }

    const detailSeedIds = new Set(graph.focusIds || []);

    if (!detailSeedIds.size && selectedId && graph.nodes.some((node) => node.id === selectedId)) {
      detailSeedIds.add(selectedId);
    }

    const useConstellationLayout = detailSeedIds.size > 0 || Boolean(selectedId || expandedClusterKey || compareIds.length || activeScenarioPreset !== 'default');
    const sublaneTargets = useConstellationLayout
      ? null
      : buildDetailSublaneTargets(graph.nodes, regions, xScale, height, topPad, bottomPad);

    const initialNodes = graph.nodes.map((node, index) => {
      const target = useConstellationLayout
        ? { targetX: width / 2, targetY: height / 2, laneLabel: 'focus-1' }
        : sublaneTargets.get(node.id) || {
            targetX: xScale(node.region) || width / 2,
            targetY: height / 2,
            laneLabel: layerKey(node.layer)
          };

      return {
        ...node,
        x: target.targetX + ((index % 3) - 1) * 6,
        y: target.targetY,
        targetX: target.targetX,
        targetY: target.targetY,
        laneLabel: target.laneLabel
      };
    });

    const nodeMap = new Map(initialNodes.map((node) => [node.id, node]));
    const layoutLinks = graph.edges
      .map((edge) => ({
        ...edge,
        source: nodeMap.get(edge.source),
        target: nodeMap.get(edge.target)
      }))
      .filter((edge) => edge.source && edge.target);

    let focusDistanceMap = new Map();

    if (useConstellationLayout) {
      const { targetMap, distanceMap } = buildConstellationTargets(
        initialNodes,
        layoutLinks,
        width,
        height,
        leftPad,
        rightPad,
        topPad,
        bottomPad,
        detailSeedIds
      );

      focusDistanceMap = distanceMap;

      initialNodes.forEach((node) => {
        const pinned = pinnedPositions[node.id];
        const target = targetMap.get(node.id) || {
          targetX: width / 2,
          targetY: height / 2,
          laneLabel: 'focus-1'
        };

        node.targetX = target.targetX;
        node.targetY = target.targetY;
        node.laneLabel = target.laneLabel;
        node.x = pinned?.x ?? target.targetX;
        node.y = pinned?.y ?? target.targetY;
        node.fx = pinned?.x ?? null;
        node.fy = pinned?.y ?? null;
      });
    } else {
      initialNodes.forEach((node) => {
        const pinned = pinnedPositions[node.id];
        node.x = pinned?.x ?? node.x;
        node.y = pinned?.y ?? node.y;
        node.fx = pinned?.x ?? null;
        node.fy = pinned?.y ?? null;
      });
    }

    const layoutNodes = initialNodes;
    const adjacency = buildAdjacency(layoutLinks.map((edge) => ({ source: edge.source.id, target: edge.target.id })));
    const degreeMap = buildDegreeMap(layoutLinks.map((edge) => ({ source: edge.source.id, target: edge.target.id })));
    const controlPointMetricsMap = new Map(
      layoutNodes.map((node) => [
        node.id,
        calculateControlPointMetrics(node, nodeMap, scenarioData.edges)
      ])
    );
    const regionRanks = buildRegionRanks(layoutNodes, degreeMap);

    const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
    const selectedFocusSet = new Set();
    const hoveredFocusSet = new Set();

    if (selectedNode) {
      selectedFocusSet.add(selectedNode.id);
      (adjacency.get(selectedNode.id) || new Set()).forEach((id) => selectedFocusSet.add(id));
    }

    if (hoveredIdRef.current) {
      hoveredFocusSet.add(hoveredIdRef.current);
      (adjacency.get(hoveredIdRef.current) || new Set()).forEach((id) => hoveredFocusSet.add(id));
    }

    const simulation = d3
      .forceSimulation(layoutNodes)
      .alpha(useConstellationLayout ? 0.85 : 0.7)
      .alphaDecay(useConstellationLayout ? 0.045 : 0.035)
      .force(
        'link',
        d3
          .forceLink(layoutLinks)
          .id((datum) => datum.id)
          .distance((edge) => {
            if (useConstellationLayout) {
              const sourceDepth = focusDistanceMap.get(edge.source.id) ?? 1;
              const targetDepth = focusDistanceMap.get(edge.target.id) ?? 1;
              if (sourceDepth === 0 || targetDepth === 0) return 110;
              if (sourceDepth === 1 && targetDepth === 1) return 118;
              return 132;
            }

            if (edge.source.region === edge.target.region) {
              return edge.source.laneLabel === edge.target.laneLabel ? 26 : 56;
            }
            return 110;
          })
          .strength((edge) => {
            if (useConstellationLayout) {
              const sourceDepth = focusDistanceMap.get(edge.source.id) ?? 1;
              const targetDepth = focusDistanceMap.get(edge.target.id) ?? 1;
              if (sourceDepth === 0 || targetDepth === 0) return 0.34;
              if (sourceDepth === 1 && targetDepth === 1) return 0.08;
              return 0.05;
            }

            if (selectedNode && (edge.source.id === selectedNode.id || edge.target.id === selectedNode.id)) {
              return 0.18;
            }
            if (edge.source.region === edge.target.region && edge.source.laneLabel === edge.target.laneLabel) {
              return 0.05;
            }
            return 0.02;
          })
      )
      .force('charge', d3.forceManyBody().strength(useConstellationLayout ? -58 : -10))
      .force(
        'collide',
        d3.forceCollide().radius((datum) => {
          const degree = degreeMap.get(datum.id) || 0;
          return useConstellationLayout ? Math.min(18, 12 + degree * 0.3) : Math.min(11, 4.8 + degree * 0.08);
        })
      )
      .force('x', d3.forceX((datum) => datum.targetX).strength(useConstellationLayout ? 0.28 : 1))
      .force('y', d3.forceY((datum) => datum.targetY).strength(useConstellationLayout ? 0.28 : 0.9));

    for (let i = 0; i < (useConstellationLayout ? 260 : 220); i += 1) simulation.tick();
    simulation.stop();

    layoutNodes.forEach((node) => {
      node.x = Math.max(leftPad + 30, Math.min(width - rightPad - 30, node.x));
      node.y = Math.max(topPad + 28, Math.min(height - bottomPad - 28, node.y));
    });

    const bounds = getBounds(layoutNodes);
    const initialTransform = fitTransform(width, height, bounds, 96);
    initialTransformRef.current = initialTransform;

    const linkSelection = root
      .append('g')
      .selectAll('line')
      .data(layoutLinks)
      .join('line')
      .style('transition', INTERACTION_EASE)
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', (edge) => detailEdgeBaseStyle(edge).stroke)
      .attr('stroke-width', (edge) => {
        const style = detailEdgeBaseStyle(edge);
        const dealerBoost = isDealerRelatedEdge(edge) ? 0.35 : 0;
        if (selectedId && (edge.source.id === selectedId || edge.target.id === selectedId)) return 2.1 + dealerBoost + style.widthBoost;
        return 0.95 + dealerBoost + style.widthBoost * 0.35;
      })
      .attr('stroke-dasharray', (edge) => detailEdgeBaseStyle(edge).dashArray)
      .attr('opacity', (edge) => detailEdgeBaseStyle(edge).baseOpacity)
      .on('mousemove', (event, edge) => onEdgeHover?.(getSafeHoverEvent(event), edge))
      .on('mouseleave', () => onLeave?.());

    const nodeSelection = root
      .append('g')
      .selectAll('g')
      .data(layoutNodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    const controlPointHaloSelection = nodeSelection
      .append('circle')
      .style('transition', INTERACTION_EASE)
      .attr('r', (d) => {
        const metrics = controlPointMetricsMap.get(d.id);
        const state = controlPointVisualState(metrics);
        return detailNodeRadius(d, degreeMap, selectedId, hoveredId, metrics) + 2.8 + state.radiusBoost;
      })
      .attr('fill', 'none')
      .attr('stroke', 'rgba(124,239,209,0.7)')
      .attr('stroke-width', (d) => controlPointVisualState(controlPointMetricsMap.get(d.id)).strokeBoost)
      .attr('stroke-opacity', (d) => controlPointVisualState(controlPointMetricsMap.get(d.id)).ringOpacity)
      .attr('stroke-dasharray', (d) => {
        const metrics = controlPointMetricsMap.get(d.id);
        if (metrics?.level === 'Primary control point') return null;
        if (metrics?.level === 'Cross-layer control point') return '4 3';
        if (metrics?.level === 'Emerging control point') return '2 3';
        return null;
      })
      .attr('pointer-events', 'none');

    const circleSelection = nodeSelection
      .append('circle')
      .style('transition', INTERACTION_EASE)
      .attr('r', (d) => detailNodeRadius(d, degreeMap, selectedId, hoveredId, controlPointMetricsMap.get(d.id)))
      .attr('fill', (d) => {
        if (isDealerNode(d)) {
          return dealerCategoryStyle(d).halo;
        }
        return nodeFill(d);
      })
      .attr('stroke', (d) => {
        if (isDealerNode(d)) {
          return dealerCategoryStyle(d).stroke;
        }
        return 'rgba(255,255,255,0.24)';
      })
      .attr('stroke-width', (d) => (isDealerNode(d) ? 1.1 : 0.8))
      .attr('stroke-dasharray', (d) => (isDealerNode(d) ? dealerCategoryStyle(d).dashArray : null));

    const dealerCoreSelection = nodeSelection
      .filter((d) => isDealerNode(d))
      .append('circle')
      .style('transition', INTERACTION_EASE)
      .attr('r', (d) => Math.max(2.2, detailNodeRadius(d, degreeMap, selectedId, hoveredId, controlPointMetricsMap.get(d.id)) - 2.35))
      .attr('fill', (d) => dealerCategoryStyle(d).stroke)
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-width', 0.6)
      .attr('pointer-events', 'none');

    const dealerAccentSelection = nodeSelection
      .filter((d) => isDealerNode(d))
      .append('circle')
      .style('transition', INTERACTION_EASE)
      .attr('r', (d) => {
        const base = detailNodeRadius(d, degreeMap, selectedId, hoveredId, controlPointMetricsMap.get(d.id));
        const style = dealerCategoryStyle(d);

        switch (style.markerMode) {
          case 'inner':
            return Math.max(1.8, base - 1.55);
          case 'outer':
            return base + 0.85;
          case 'outer-soft':
            return base + 1.15;
          case 'halo':
            return base + 0.9;
          case 'scale':
            return base + 0.35;
          default:
            return base + 0.45;
        }
      })
      .attr('fill', 'none')
      .attr('stroke', (d) => dealerCategoryStyle(d).stroke)
      .attr('stroke-width', (d) => {
        const style = dealerCategoryStyle(d);
        if (style.category === 'DMS') return 1.6;
        if (style.category === 'Platform') return 1.25;
        return 1.1;
      })
      .attr('stroke-opacity', (d) => dealerCategoryStyle(d).accentOpacity)
      .attr('stroke-dasharray', (d) => {
        const style = dealerCategoryStyle(d);
        if (style.markerMode === 'dashed') return '2 2';
        if (style.markerMode === 'halo') return '5 3';
        return style.dashArray;
      })
      .attr('pointer-events', 'none');

    const hitAreaSelection = nodeSelection
      .append('circle')
      .attr('r', (d) => Math.max(14, detailNodeRadius(d, degreeMap, selectedId, hoveredId, controlPointMetricsMap.get(d.id)) + 7))
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .style('pointer-events', 'all');

    const labelSelection = nodeSelection
      .append('text')
      .style('transition', 'opacity 160ms ease, fill 160ms ease, font-weight 160ms ease')
      .attr('x', 9)
      .attr('y', 4)
      .attr('class', 'svg-text')
      .style('font-size', '10px')
      .style('font-weight', '500')
      .style('cursor', 'pointer')
      .text((d) => truncateLabel(d.label, 26));

    const handleDetailNodeSelect = (d, shouldRaise = false, target = null) => {
      if (shouldRaise && target) {
        d3.select(target).raise();
      }

      const nextId = selectedId === d.id ? null : d.id;
      setSelectedId(nextId);
      hoveredIdRef.current = null;
      setHoveredId(null);
      onNodeSelect?.(nextId ? d : null);
      refreshDetailStyles();
    };

    const refreshDetailStyles = () => {
      const activeHoveredId = hoveredIdRef.current;
      const traceIsVisible = Boolean(traceActive && tracedPath?.found && tracedNodeIds.size);
      circleSelection
        .attr('fill', (d) => {
          if (traceIsVisible && tracedNodeIds.has(d.id)) {
            if (selectedId === d.id) return '#f6d365';
            return isDealerNode(d) ? 'rgba(246,211,101,0.45)' : 'rgba(246,211,101,0.34)';
          }
          if (selectedId === d.id) return '#7cefd1';
          if (activeHoveredId === d.id) return '#b8f8e7';
          if (selectedId && selectedFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).halo : '#6dc0ff';
          if (!selectedId && activeHoveredId && hoveredFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).halo : '#6dc0ff';
          if (isDealerNode(d)) return dealerCategoryStyle(d).halo;
          return nodeFill(d);
        })
        .attr('opacity', (d) => {
          if (traceIsVisible) {
            if (tracedNodeIds.has(d.id)) return 1;
            return selectedId ? 0.06 : 0.08;
          }

          if (selectedId) {
            if (selectedFocusSet.has(d.id)) return 1;
            if (activeHoveredId && hoveredFocusSet.has(d.id) && d.id !== activeHoveredId) return 0.22;
            return 0.1;
          }

          if (activeHoveredId) {
            if (hoveredFocusSet.has(d.id)) return 1;
            return 0.12;
          }

          return 0.94;
        })
        .attr('stroke', (d) => {
          if (traceIsVisible && tracedNodeIds.has(d.id)) return 'rgba(246,211,101,0.96)';
          if (selectedId === d.id) return 'rgba(255,255,255,0.95)';
          if (activeHoveredId === d.id) return 'rgba(255,255,255,0.82)';
          if (selectedId && selectedFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).stroke : 'rgba(255,255,255,0.42)';
          if (!selectedId && activeHoveredId && hoveredFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).stroke : 'rgba(255,255,255,0.42)';
          if (isDealerNode(d)) return dealerCategoryStyle(d).stroke;
          return 'rgba(255,255,255,0.16)';
        })
        .attr('stroke-width', (d) => {
          const controlPointBoost = controlPointVisualState(controlPointMetricsMap.get(d.id)).strokeBoost;
          if (traceIsVisible && tracedNodeIds.has(d.id)) return 1.65 + controlPointBoost;
          if (selectedId === d.id) return 1.8 + controlPointBoost;
          if (activeHoveredId === d.id) return 1.4 + controlPointBoost * 0.8;
          return (isDealerNode(d) ? 1.05 : 0.8) + controlPointBoost * 0.7;
        })
        .attr('stroke-dasharray', (d) => (isDealerNode(d) ? dealerCategoryStyle(d).dashArray : null));

      controlPointHaloSelection
        .attr('opacity', (d) => {
          const state = controlPointVisualState(controlPointMetricsMap.get(d.id));
          if (!state.badge) return 0;
          if (selectedId) return selectedFocusSet.has(d.id) ? state.ringOpacity : 0.05;
          if (activeHoveredId) return hoveredFocusSet.has(d.id) ? state.ringOpacity * 0.95 : 0.05;
          return state.ringOpacity * 0.9;
        })
        .attr('stroke-opacity', (d) => {
          const state = controlPointVisualState(controlPointMetricsMap.get(d.id));
          if (!state.badge) return 0;
          if (selectedId === d.id || activeHoveredId === d.id) return Math.min(1, state.ringOpacity + 0.12);
          return state.ringOpacity;
        });

      dealerCoreSelection
        .attr('opacity', (d) => {
          if (traceIsVisible) {
            return tracedNodeIds.has(d.id) ? 0.94 : 0.05;
          }
          if (selectedId) {
            return selectedFocusSet.has(d.id) ? 0.92 : 0.08;
          }
          if (activeHoveredId) {
            return hoveredFocusSet.has(d.id) ? 0.9 : 0.12;
          }
          return 0.82;
        });

      dealerAccentSelection
        .attr('opacity', (d) => {
          if (traceIsVisible) {
            return tracedNodeIds.has(d.id) ? 0.96 : 0.04;
          }
          if (selectedId) {
            return selectedFocusSet.has(d.id) ? 0.95 : 0.06;
          }
          if (activeHoveredId) {
            return hoveredFocusSet.has(d.id) ? 0.92 : 0.1;
          }
          return 0.84;
        })
        .attr('stroke-opacity', (d) => {
          const base = dealerCategoryStyle(d).accentOpacity;
          if (selectedId && selectedFocusSet.has(d.id)) return Math.min(1, base + 0.12);
          if (!selectedId && activeHoveredId && hoveredFocusSet.has(d.id)) return Math.min(1, base + 0.08);
          return base;
        });

      linkSelection
        .attr('opacity', (edge) => {
          const traceEdgeKey = makeEdgeKey(edge.source.id, edge.target.id);
          if (traceIsVisible) {
            if (tracedEdgeKeys.has(traceEdgeKey)) return 0.96;
            return 0.025;
          }
          if (selectedId) {
            if (selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) return 0.82;
            if (activeHoveredId && hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 0.08;
            return 0.03;
          }

          if (activeHoveredId) {
            if (hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 0.82;
            return 0.035;
          }

          return detailEdgeBaseStyle(edge).baseOpacity + (isDealerRelatedEdge(edge) ? 0.04 : 0);
        })
        .attr('stroke', (edge) => {
          const traceEdgeKey = makeEdgeKey(edge.source.id, edge.target.id);
          if (traceIsVisible && tracedEdgeKeys.has(traceEdgeKey)) {
            return '#f6d365';
          }
          if (selectedId && selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) {
            return '#7cefd1';
          }
          if (!selectedId && activeHoveredId && hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) {
            return '#7cefd1';
          }
          return detailEdgeBaseStyle(edge).stroke;
        })
        .attr('stroke-dasharray', (edge) => detailEdgeBaseStyle(edge).dashArray)
        .attr('stroke-width', (edge) => {
          const style = detailEdgeBaseStyle(edge);
          const dealerBoost = isDealerRelatedEdge(edge) ? 0.35 : 0;
          const traceEdgeKey = makeEdgeKey(edge.source.id, edge.target.id);
          if (traceIsVisible) {
            if (tracedEdgeKeys.has(traceEdgeKey)) return 2.15 + dealerBoost + style.widthBoost;
            return 0.65 + style.widthBoost * 0.15;
          }
          if (selectedId) {
            if (selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) return 1.7 + dealerBoost + style.widthBoost;
            return 0.75 + dealerBoost + style.widthBoost * 0.2;
          }
          if (activeHoveredId) {
            if (hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 1.55 + dealerBoost + style.widthBoost;
            return 0.72 + dealerBoost + style.widthBoost * 0.2;
          }
          return 0.95 + dealerBoost + style.widthBoost * 0.35;
        });

      labelSelection
        .style('opacity', (d) => {
          if (traceIsVisible) {
            return tracedNodeIds.has(d.id) ? 1 : 0.03;
          }
          const visible = shouldShowDetailLabel({
            node: d,
            zoomK,
            labelMode,
            degreeMap,
            regionRanks,
            selectedId,
            hoveredId: activeHoveredId,
            selectedFocusSet,
            hoveredFocusSet,
            pinnedIds
          });

          if (!visible) return 0;

          if (selectedId) {
            if (selectedFocusSet.has(d.id)) return 1;
            if (activeHoveredId === d.id) return 0.6;
            return 0.06;
          }

          if (activeHoveredId) {
            return hoveredFocusSet.has(d.id) ? 1 : 0.07;
          }

          return 0.94;
        })
        .style('font-weight', (d) => {
          if (traceIsVisible && tracedNodeIds.has(d.id)) return selectedId === d.id ? '700' : '600';
          if (selectedId === d.id || activeHoveredId === d.id) return '700';
          if (selectedId && selectedFocusSet.has(d.id)) return '600';
          if (!selectedId && activeHoveredId && hoveredFocusSet.has(d.id)) return '600';
          return '500';
        });
    };

    const bindDetailSelectionInteractions = (selection) =>
      selection
        .on('mousemove', function (event, d) {
          d3.select(this.parentNode || this).raise();
          hoveredIdRef.current = d.id;
          setHoveredId(d.id);
          onNodeHover?.(getSafeHoverEvent(event), d);
          refreshDetailStyles();
        })
        .on('mouseleave', () => {
          hoveredIdRef.current = null;
          setHoveredId(null);
          onLeave?.();
          refreshDetailStyles();
        })
        .on('click', function (event, d) {
          event.stopPropagation?.();
          handleDetailNodeSelect(d, true, this.parentNode || this);
        });

    bindDetailSelectionInteractions(nodeSelection);
    bindDetailSelectionInteractions(hitAreaSelection);
    bindDetailSelectionInteractions(labelSelection);

    nodeSelection.on('dblclick', (_, d) => {
      setPinnedPositions((current) => {
        const next = { ...current };
        delete next[d.id];
        return next;
      });
    });

    // Detail view prioritises reliable selection over free dragging.
    // Drag was causing clicks to be interpreted as grab gestures, which made
    // re-selecting nodes after clearing selection feel broken.
    nodeSelection.on('mousedown.drag', null).on('touchstart.drag', null);

    const zoom = d3
      .zoom()
      .scaleExtent([0.42, 6.2])
      .on('start', () => {
        onCanvasInteract?.();
        onLeave?.();
      })
      .on('zoom', (event) => {
        zoomK = event.transform.k;
        root.attr('transform', event.transform);
        setZoomPct(Math.round(event.transform.k * 100));
        refreshDetailStyles();
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, initialTransform);
    setZoomPct(Math.round(initialTransform.k * 100));

    svg.on('mouseleave', () => {
      hoveredIdRef.current = null;
      setHoveredId(null);
      onLeave?.();
    });

    refreshDetailStyles();
    svgRef.current = svg.node();

    return () => {
      svg.on('.zoom', null);
      svg.on('mouseleave', null);
      rootEl.innerHTML = '';
    };
  }, [
    hasData,
    graph,
    resolvedMode,
    labelMode,
    degreeThreshold,
    selectedId,
    expandedClusterKey,
    layoutVersion,
    pinnedPositions,
    pinnedIds,
    onNodeHover,
    onNodeSelect,
    onEdgeHover,
    onLeave,
    onCanvasInteract
  ]);

  const viewStatePayload = useMemo(() => ({
    version: 1,
    renderMode,
    labelMode,
    degreeThreshold,
    dealerLayerEnabled,
    dealerCategoryFilters,
    legendVisible,
    selectedId,
    expandedClusterKey,
    compareIds,
    traceActive,
    activeScenarioPreset
  }), [
    renderMode,
    labelMode,
    degreeThreshold,
    dealerLayerEnabled,
    dealerCategoryFilters,
    legendVisible,
    selectedId,
    expandedClusterKey,
    compareIds,
    traceActive,
    activeScenarioPreset
  ]);

  useEffect(() => {
    if (hydratedFromHashRef.current) return;
    const parsed = deserializeViewStateFromHash(window.location.hash);
    hydratedFromHashRef.current = true;
    if (!parsed || typeof parsed !== 'object') return;

    if (typeof parsed.renderMode === 'string') setRenderMode(parsed.renderMode);
    if (typeof parsed.labelMode === 'string') setLabelMode(parsed.labelMode);
    if (typeof parsed.degreeThreshold === 'number') setDegreeThreshold(parsed.degreeThreshold);
    if (typeof parsed.dealerLayerEnabled === 'boolean') setDealerLayerEnabled(parsed.dealerLayerEnabled);
    if (parsed.dealerCategoryFilters && typeof parsed.dealerCategoryFilters === 'object') {
      setDealerCategoryFilters((current) => ({ ...current, ...parsed.dealerCategoryFilters }));
    }
    if (typeof parsed.legendVisible === 'boolean') setLegendVisible(parsed.legendVisible);
    if (typeof parsed.selectedId === 'string' || parsed.selectedId === null) setSelectedId(parsed.selectedId || null);
    if (typeof parsed.expandedClusterKey === 'string' || parsed.expandedClusterKey === null) {
      setExpandedClusterKey(parsed.expandedClusterKey || null);
    }
    if (Array.isArray(parsed.compareIds)) setCompareIds(parsed.compareIds.slice(0, 2));
    if (typeof parsed.traceActive === 'boolean') setTraceActive(parsed.traceActive);
    if (typeof parsed.activeScenarioPreset === 'string') setActiveScenarioPreset(parsed.activeScenarioPreset);
  }, []);

  useEffect(() => {
    if (!hydratedFromHashRef.current) return;
    const nextHash = `${VIEW_STATE_HASH_PREFIX}${serializeViewState(viewStatePayload)}`;
    if (window.location.hash.replace(/^#/, '') !== nextHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${nextHash}`);
    }
  }, [viewStatePayload]);

  useEffect(() => {
    if (shareFeedback === 'idle') return undefined;
    const timeout = window.setTimeout(() => setShareFeedback('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

  useEffect(() => {
    if (snapshotFeedback === 'idle') return undefined;
    const timeout = window.setTimeout(() => setSnapshotFeedback('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [snapshotFeedback]);

  useEffect(() => {
    if (exportFeedback === 'idle') return undefined;
    const timeout = window.setTimeout(() => setExportFeedback('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [exportFeedback]);


  const resetLayout = () => {
    setPinnedPositions({});
    setCompareIds([]);
    setTraceActive(false);
    setActiveScenarioPreset('default');
    setDealerLayerEnabled(false);
    setDealerCategoryFilters({
      DMS: true,
      CRM: true,
      Finance: true,
      Service: true,
      Marketplace: true,
      Platform: true
    });
    setRenderMode('auto');
    setLabelMode('balanced');
    setDegreeThreshold(0);
    setSelectedId(null);
    hoveredIdRef.current = null;
    hoveredClusterIdRef.current = null;
    setHoveredId(null);
    setHoveredClusterId(null);
    setExpandedClusterKey(null);
    setLayoutVersion((current) => current + 1);
    setShareFeedback('idle');
    setSnapshotFeedback('idle');
    setExportFeedback('idle');
    setZoomPct(Math.round((initialTransformRef.current?.k ?? 1) * 100));
    onNodeSelect?.(null);
    onLeave?.();

    const svgNode = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    const initialTransform = initialTransformRef.current;

    if (svgNode && zoom && initialTransform) {
      d3.select(svgNode).transition().duration(280).call(zoom.transform, initialTransform);
    }
  };

  const stepZoom = (direction) => {
    const svgNode = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svgNode || !zoom) return;

    d3.select(svgNode)
      .transition()
      .duration(180)
      .call(zoom.scaleBy, direction === 'in' ? 1.18 : 0.84);
  };

  const handleLegendToggle = () => {
    if (expanded) {
      setExpanded(false);
      setLegendVisible(true);
      legendBeforeExpandRef.current = true;
      return;
    }

    setLegendVisible((current) => !current);
  };

  const handleExpandToggle = () => {
    if (!expanded) {
      legendBeforeExpandRef.current = legendVisible;
      setLegendVisible(false);
      setExpanded(true);
      return;
    }

    setExpanded(false);
    setLegendVisible(legendBeforeExpandRef.current);
  };

  const applyScenarioPreset = (presetValue) => {
    setActiveScenarioPreset(presetValue);
    setTraceActive(false);
    setCompareIds([]);
    setSelectedId(null);
    setHoveredId(null);
    setHoveredClusterId(null);
    setExpandedClusterKey(null);
    onNodeSelect?.(null);
    onLeave?.();

    switch (presetValue) {
      case 'dealer':
        setDealerLayerEnabled(true);
        setDealerCategoryFilters({
          DMS: true,
          CRM: true,
          Finance: true,
          Service: true,
          Marketplace: true,
          Platform: true
        });
        setLabelMode('focused');
        setDegreeThreshold(0);
        setRenderMode('auto');
        break;
      case 'control':
        setDealerLayerEnabled(false);
        setLabelMode('focused');
        setDegreeThreshold(2);
        setRenderMode('auto');
        break;
      case 'evidence':
        setDealerLayerEnabled(false);
        setLabelMode('balanced');
        setDegreeThreshold(0);
        setRenderMode('auto');
        break;
      case 'governance':
        setDealerLayerEnabled(false);
        setLabelMode('focused');
        setDegreeThreshold(0);
        setRenderMode('detail');
        break;
      case 'pathways':
        setDealerLayerEnabled(true);
        setLabelMode('focused');
        setDegreeThreshold(2);
        setRenderMode('detail');
        break;
      default:
        setDealerLayerEnabled(false);
        setDealerCategoryFilters({
          DMS: true,
          CRM: true,
          Finance: true,
          Service: true,
          Marketplace: true,
          Platform: true
        });
        setLabelMode('balanced');
        setDegreeThreshold(0);
        setRenderMode('auto');
        break;
    }

    setLayoutVersion((current) => current + 1);
    setShareFeedback('idle');
    setSnapshotFeedback('idle');
    setExportFeedback('idle');
  };

  const activeFocusLabel = expandedClusterKey ? formatExpandedClusterLabel(expandedClusterKey) : '';

  const canonicalNodeMap = useMemo(
    () => new Map(scenarioData.nodes.map((item) => [item.id, item])),
    [scenarioData.nodes]
  );


  const buildNodeInsightDetail = (nodeId) => {
    if (!nodeId) return null;

    const node = canonicalNodeMap.get(nodeId) || graph.nodes.find((item) => item.id === nodeId) || null;
    if (!node) return null;

    const relatedEdges = scenarioData.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);

    const grouped = new Map();
    relatedEdges.forEach((edge) => {
      const otherId = edge.source === nodeId ? edge.target : edge.source;
      const otherNode = canonicalNodeMap.get(otherId) || graph.nodes.find((item) => item.id === otherId) || null;
      const key = edge.relationship || edge.relation || 'Connected';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        edge,
        node: otherNode,
        label: otherNode?.label || otherId,
        region: displayRegion(otherNode?.region || edge.region || 'Unknown'),
        layer: otherNode?.layer || edge.layer || 'Unknown',
        confidence: edge.confidence || 'Unknown',
        verification: edge.verification_status || edge.evidence_status || 'Unknown'
      });
    });

    const relationshipGroups = [...grouped.entries()]
      .map(([key, items]) => {
        const sortedItems = [...items].sort((a, b) => {
          const confidenceDelta = normalizeConfidenceRank(b.confidence) - normalizeConfidenceRank(a.confidence);
          if (confidenceDelta !== 0) return confidenceDelta;
          const verificationDelta = String(b.verification || '').localeCompare(String(a.verification || ''));
          if (verificationDelta !== 0) return verificationDelta;
          return String(a.label || '').localeCompare(String(b.label || ''));
        });
        const label = formatRelationshipLabel(key);
        const topConfidence = sortedItems[0]?.confidence || 'Unknown';
        const priority = relationshipGroupPriority(label) + sortedItems.length * 2 + normalizeConfidenceRank(topConfidence) * 3;
        return {
          key,
          label,
          items: sortedItems,
          total: sortedItems.length,
          topConfidence,
          priority,
          preview: sortedItems.slice(0, 3).map((item) => item.label).filter(Boolean).join(', ')
        };
      })
      .sort((a, b) => b.priority - a.priority || b.total - a.total || a.label.localeCompare(b.label));

    const dealerCategory = isDealerNode(node) ? normalizeDealerCategory(node) : null;
    const verificationSummary = summarizeVerification(node);
    const uniqueRegions = [...new Set(relatedEdges.map((edge) => canonicalNodeMap.get(edge.source === nodeId ? edge.target : edge.source)?.region || edge.region).filter(Boolean))]
      .slice(0, 4)
      .map((region) => displayRegion(region));
    const strongestRelationship = relationshipGroups[0] || null;

    return {
      node,
      dealerCategory,
      verificationSummary,
      roleSummary: summarizeNodeRole(node, dealerCategory, relatedEdges.length, strongestRelationship?.label || null),
      relationshipSummary: relationshipInsight(relationshipGroups),
      strongestRelationship,
      relationshipGroups,
      relationshipCount: relatedEdges.length,
      connectedRegionSummary: uniqueRegions.length ? uniqueRegions.join(' · ') : 'No linked regions recorded',
      evidenceSource: node.source_name || node.provenance_parent || 'Not specified',
      evidenceDate: node.source_date || node.last_validated_date || 'Not specified'
    };
  };

  const selectedNodeDetail = useMemo(() => buildNodeInsightDetail(selectedId), [selectedId, scenarioData.nodes, scenarioData.edges, graph.nodes]);

  const compareNodeDetails = useMemo(
    () => compareIds.map((nodeId) => buildNodeInsightDetail(nodeId)).filter(Boolean),
    [compareIds, scenarioData.nodes, scenarioData.edges, graph.nodes]
  );

  const traceEndpoints = useMemo(() => {

    if (selectedId) {
      const otherCompareId = compareIds.find((id) => id !== selectedId) || (!compareIds.includes(selectedId) ? compareIds[0] : null);
      if (otherCompareId) {
        return {
          startId: selectedId,
          endId: otherCompareId,
          startLabel: canonicalNodeMap.get(selectedId)?.label || selectedId,
          endLabel: canonicalNodeMap.get(otherCompareId)?.label || otherCompareId
        };
      }
    }

    if (compareIds.length === 2) {
      return {
        startId: compareIds[0],
        endId: compareIds[1],
        startLabel: canonicalNodeMap.get(compareIds[0])?.label || compareIds[0],
        endLabel: canonicalNodeMap.get(compareIds[1])?.label || compareIds[1]
      };
    }

    return null;
  }, [selectedId, compareIds, canonicalNodeMap]);

  const tracedPath = useMemo(() => {
    if (!traceActive || !traceEndpoints) return null;
    return buildShortestPath(scenarioData.edges, traceEndpoints.startId, traceEndpoints.endId, canonicalNodeMap);
  }, [traceActive, traceEndpoints, canonicalNodeMap, scenarioData.edges]);

  const tracedNodeIds = useMemo(() => new Set(tracedPath?.nodeIds || []), [tracedPath]);
  const tracedEdgeKeys = useMemo(() => new Set(tracedPath?.edgeKeys || []), [tracedPath]);


  const narrativeSummary = useMemo(() => {
    const presetConfig = SCENARIO_PRESETS.find((preset) => preset.value === activeScenarioPreset) || SCENARIO_PRESETS[0];
    const visibleNodeCount = graph.nodes.length;
    const visibleEdgeCount = (graph.edges || graph.links || []).length;
    const visibleDealerNodes = scenarioData.nodes.filter((node) => isDealerNode(node)).length;
    const strongerEvidenceEdges = scenarioData.edges.filter(
      (edge) => normalizeConfidenceRank(edge.confidence || edge.verification_status || edge.evidence_status) >= 2
    ).length;
    const governanceNodes = scenarioData.nodes.filter((node) => {
      const haystack = `${node?.layer || ''} ${node?.type || ''} ${node?.node_type || ''} ${node?.label || ''} ${node?.description || ''} ${node?.notes || ''}`.toLowerCase();
      return haystack.includes('govern') || haystack.includes('regulat') || haystack.includes('compliance') || haystack.includes('policy');
    }).length;
    const controlCandidates = graph.nodes.filter((node) => {
      const metrics = calculateControlPointMetrics(node, new Map(graph.nodes.map((item) => [item.id, item])), graph.edges || graph.links || []);
      return metrics.score >= 10;
    }).length;

    let summary = presetConfig.description;
    if (activeScenarioPreset === 'dealer') {
      summary = `${visibleDealerNodes} dealer-system node${visibleDealerNodes === 1 ? '' : 's'} visible across the current slice.`;
    } else if (activeScenarioPreset === 'control') {
      summary = `${controlCandidates} likely control point${controlCandidates === 1 ? '' : 's'} visible in the current graph.`;
    } else if (activeScenarioPreset === 'evidence') {
      summary = `${strongerEvidenceEdges} stronger-evidence relationship${strongerEvidenceEdges === 1 ? '' : 's'} remain in view.`;
    } else if (activeScenarioPreset === 'governance') {
      summary = `${governanceNodes} governance or regulatory node${governanceNodes === 1 ? '' : 's'} are foregrounded with their immediate context.`;
    } else if (activeScenarioPreset === 'pathways') {
      summary = traceActive && tracedPath?.found
        ? `${tracedPath.hops} hop${tracedPath.hops === 1 ? '' : 's'} traced across ${tracedPath.layers.length || 1} layer${tracedPath.layers.length === 1 ? '' : 's'}.`
        : 'Best used with selection, compare, and trace path to reveal cross-layer routes.';
    }

    return {
      title: presetConfig.label,
      summary,
      metrics: [
        `${visibleNodeCount} nodes`,
        `${visibleEdgeCount} links`,
        activeScenarioPreset === 'dealer'
          ? `${visibleDealerNodes} dealer`
          : activeScenarioPreset === 'evidence'
            ? `${strongerEvidenceEdges} stronger-evidence`
            : activeScenarioPreset === 'governance'
              ? `${governanceNodes} governance`
              : `${controlCandidates} control signals`
      ]
    };
  }, [activeScenarioPreset, graph.nodes, graph.edges, scenarioData.nodes, scenarioData.edges, traceActive, tracedPath]);



  const compareDeltas = useMemo(() => {
    if (compareNodeDetails.length !== 2) return [];

    const [left, right] = compareNodeDetails;
    const leftMetrics = calculateControlPointMetrics(left.node, canonicalNodeMap, scenarioData.edges);
    const rightMetrics = calculateControlPointMetrics(right.node, canonicalNodeMap, scenarioData.edges);
    const leftEvidence = normalizeConfidenceRank(left.node.confidence || left.node.verification_status || left.node.evidence_status);
    const rightEvidence = normalizeConfidenceRank(right.node.confidence || right.node.verification_status || right.node.evidence_status);

    const deltas = [];

    const relationshipDelta = left.relationshipCount - right.relationshipCount;
    if (relationshipDelta !== 0) {
      const stronger = relationshipDelta > 0 ? left.node.label : right.node.label;
      deltas.push({
        label: 'Connectivity',
        value: `${stronger} has ${Math.abs(relationshipDelta)} more mapped link${Math.abs(relationshipDelta) === 1 ? '' : 's'}.`
      });
    } else {
      deltas.push({
        label: 'Connectivity',
        value: `Both nodes show ${left.relationshipCount} mapped links in the current slice.`
      });
    }

    if (leftMetrics.level !== rightMetrics.level || leftMetrics.score !== rightMetrics.score) {
      const stronger = leftMetrics.score >= rightMetrics.score ? left.node.label : right.node.label;
      deltas.push({
        label: 'Control reach',
        value: `${stronger} shows the stronger control signal across visible layers and regions.`
      });
    }

    if (leftEvidence !== rightEvidence) {
      const stronger = leftEvidence > rightEvidence ? left.node.label : right.node.label;
      deltas.push({
        label: 'Evidence',
        value: `${stronger} is backed by the stronger visible evidence signal.`
      });
    } else {
      deltas.push({
        label: 'Evidence',
        value: `Both nodes sit at a similar evidence strength in the current model.`
      });
    }

    return deltas.slice(0, 3);
  }, [compareNodeDetails, canonicalNodeMap, scenarioData.edges]);

  const globalInsightStrip = useMemo(() => {
    const visibleNodes = graph.nodes || [];
    const visibleEdges = graph.edges || graph.links || [];
    if (!visibleNodes.length) return [];

    const layerCounts = new Map();
    visibleNodes.forEach((node) => {
      const label = toTitleCase(node.layer || 'Unknown');
      layerCounts.set(label, (layerCounts.get(label) || 0) + 1);
    });
    const dominantLayer = [...layerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const controlSummaries = visibleNodes
      .map((node) => ({
        node,
        metrics: calculateControlPointMetrics(node, canonicalNodeMap, visibleEdges)
      }))
      .sort((a, b) => b.metrics.score - a.metrics.score);

    const topControl = controlSummaries[0];
    const strongerEvidenceEdges = visibleEdges.filter(
      (edge) => normalizeConfidenceRank(edge.confidence || edge.verification_status || edge.evidence_status) >= 2
    ).length;
    const evidencePct = visibleEdges.length ? Math.round((strongerEvidenceEdges / visibleEdges.length) * 100) : 0;
    const crossLayerCount = controlSummaries.filter((item) => item.metrics.linkedLayers > 1).length;

    const observations = [];
    if (dominantLayer) {
      observations.push({
        kind: 'control',
        kicker: 'Dominant layer',
        value: `${dominantLayer[0]} · ${dominantLayer[1]} visible node${dominantLayer[1] === 1 ? '' : 's'}`,
        summary: activeScenarioPreset === 'governance'
          ? 'Governance remains foregrounded with immediate surrounding context.'
          : `${dominantLayer[0]} currently anchors the visible slice.`
      });
    }
    if (topControl?.node) {
      observations.push({
        kind: 'bridge',
        kicker: 'Control point',
        value: topControl.node.label,
        summary: topControl.metrics.summary
      });
    }
    observations.push({
      kind: 'evidence',
      kicker: 'Evidence density',
      value: `${evidencePct}% stronger-evidence edges`,
      summary: `${strongerEvidenceEdges} of ${visibleEdges.length} visible relationships are moderate or higher confidence.`
    });
    if (traceActive && tracedPath?.found) {
      observations.push({
        kind: 'path',
        kicker: 'Trace active',
        value: `${tracedPath.hops} ${tracedPath.hops === 1 ? 'hop' : 'hops'} · ${tracedPath.layers.length || 1} layers`,
        summary: `${traceEndpoints?.startLabel || 'Start'} → ${traceEndpoints?.endLabel || 'End'}`
      });
    } else {
      observations.push({
        kind: 'control',
        kicker: 'Cross-layer bridges',
        value: `${crossLayerCount} bridge candidates`,
        summary: 'Nodes touching multiple visible layers are surfaced as higher-value control signals.'
      });
    }

    return observations.slice(0, 4);
  }, [graph.nodes, graph.edges, graph.links, canonicalNodeMap, activeScenarioPreset, traceActive, tracedPath, traceEndpoints]);

  const insightExportText = useMemo(() => {
    const sections = [];

    sections.push(formatExportBlock('Narrative view', [
      narrativeSummary.title,
      narrativeSummary.summary,
      narrativeSummary.metrics.join(' · ')
    ]));

    if (globalInsightStrip.length) {
      sections.push(formatExportBlock('Global observations', globalInsightStrip.map((item) => `${item.kicker}: ${item.value} — ${item.summary}`)));
    }

    if (selectedNodeDetail) {
      sections.push(formatExportBlock('Selected node', [
        selectedNodeDetail.node.label,
        `${toTitleCase(selectedNodeDetail.node.layer || 'Unknown')} · ${displayRegion(selectedNodeDetail.node.region || 'Unknown')}`,
        selectedNodeDetail.roleSummary,
        selectedNodeDetail.relationshipSummary,
        selectedNodeDetail.strongestRelationship
          ? `Top relationship: ${selectedNodeDetail.strongestRelationship.label} (${selectedNodeDetail.strongestRelationship.total})`
          : null
      ]));
    }

    if (compareNodeDetails.length) {
      sections.push(formatExportBlock('Compare', compareNodeDetails.map((detail) => {
        const topSignal = detail.strongestRelationship
          ? `${detail.strongestRelationship.label} (${detail.strongestRelationship.total})`
          : 'No dominant relationship signal';
        return `${detail.node.label} — ${detail.roleSummary} | ${detail.relationshipCount} links | ${topSignal}`;
      })));
    }

    if (traceActive && traceEndpoints) {
      sections.push(formatExportBlock('Trace', [
        `${traceEndpoints.startLabel} → ${traceEndpoints.endLabel}`,
        tracedPath?.found
          ? `${tracedPath.hops} ${tracedPath.hops === 1 ? 'hop' : 'hops'} across ${tracedPath.layers.length || 1} layer${tracedPath.layers.length === 1 ? '' : 's'}`
          : 'No visible path in the current view'
      ]));
    }

    return sections.filter(Boolean).join('');
  }, [
    narrativeSummary,
    globalInsightStrip,
    selectedNodeDetail,
    compareNodeDetails,
    traceActive,
    traceEndpoints,
    tracedPath
  ]);

  const handleShareView = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${VIEW_STATE_HASH_PREFIX}${serializeViewState(viewStatePayload)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareFeedback('copied');
    } catch {
      setShareFeedback('copied');
    }
  };

  const handleExportSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      viewState: viewStatePayload,
      narrativeSummary,
      globalInsightStrip
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `oem-system-stack-snapshot-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSnapshotFeedback('saved');
    } catch {
      setSnapshotFeedback('saved');
    }
  };

  const handleExportInsight = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(insightExportText);
      }
      setExportFeedback('copied');
    } catch {
      setExportFeedback('copied');
    }
  };


  const toggleCompareNode = (nodeId) => {
    if (!nodeId) return;
    setCompareIds((current) => {
      if (current.includes(nodeId)) return current.filter((id) => id !== nodeId);
      if (current.length >= 2) return [current[1], nodeId];
      return [...current, nodeId];
    });
  };

  useEffect(() => {
    if (!traceEndpoints) {
      setTraceActive(false);
    }
  }, [traceEndpoints]);

  useEffect(() => {
    setExpandedRelationshipGroups({});
    setInsightSections((current) => ({
      ...current,
      why: true,
      relationships: true,
      metadata: false,
      evidence: false,
      description: false
    }));
  }, [selectedId]);

  const toggleInsightSection = (key) => {
    setInsightSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const helpText =
    resolvedMode === 'overview'
      ? expandedClusterKey
        ? 'A cluster has been expanded into local detail. Use Back to return to the high-level overview.'
        : 'Overview mode clusters the network by region and layer so the unfiltered landscape stays readable.'
      : expandedClusterKey
        ? 'Detail mode is focused on one cluster and its immediate connected neighbourhood.'
        : `Detail mode uses region sublanes so dense columns separate into clearer internal lanes. Hover highlights local relationships. Zooming in reveals more labels.${dealerLayerEnabled ? ' Dealer overlay is active and dealer nodes carry category accents for faster scanning.' : ''}`;

  if (!hasData) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardKicker>Network Controls</CardKicker>
              <div className="mt-1 text-xs text-muted-foreground">{helpText}</div>
            </div>

            <button
              type="button"
              onClick={resetLayout}
              className="flex items-center gap-2 self-start rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-blue-500 md:self-auto"
            >
              <RotateIcon className="size-3.5" />
              Reset
            </button>
          </div>

          <div className="mt-3 mb-4 flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Compare {compareIds.length}/2</span>
              <span className="text-xs text-muted-foreground">
                {compareIds.length === 1
                  ? 'Select another node to compare'
                  : compareIds.length === 2
                    ? 'Two nodes selected'
                    : 'Pin nodes to compare'}
              </span>
            </div>

            {compareIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/25 bg-black/10 px-4 py-3">
            <button
              type="button"
              onClick={handleShareView}
              className="inline-flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {shareFeedback === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {shareFeedback === 'copied' ? 'Link copied' : 'Share view'}
            </button>
            <button
              type="button"
              onClick={handleExportSnapshot}
              className="inline-flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {snapshotFeedback === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {snapshotFeedback === 'saved' ? 'Snapshot saved' : 'Snapshot JSON'}
            </button>
            <button
              type="button"
              onClick={handleExportInsight}
              className="inline-flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {exportFeedback === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {exportFeedback === 'copied' ? 'Insight copied' : 'Copy insight'}
            </button>
            <div className="ml-auto text-[11px] text-muted-foreground">
              Shareable view state follows the current preset, selection, compare, and trace state.
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border/25 bg-black/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardKicker>Scenario Presets</CardKicker>
                <div className="mt-1 text-xs text-muted-foreground">Saved narrative lenses for faster reading and comparison.</div>
              </div>
              {activeScenarioPreset !== 'default' ? (
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('default')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear preset
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {SCENARIO_PRESETS.map((preset) => (
                <ControlPill
                  key={preset.value}
                  active={activeScenarioPreset === preset.value}
                  onClick={() => applyScenarioPreset(preset.value)}
                >
                  {preset.label}
                </ControlPill>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3 xl:gap-4">
            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Render Mode</CardKicker>
              <div className="flex items-center rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                {RENDER_MODES.map((mode) => (
                  <ControlPill
                    key={mode.value}
                    active={renderMode === mode.value}
                    onClick={() => {
                      setRenderMode(mode.value);
                      if (mode.value !== 'detail') {
                        setExpandedClusterKey(null);
                        setSelectedId(null);
                      }
                    }}
                  >
                    {mode.label}
                  </ControlPill>
                ))}
              </div>
            </div>

            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Label Density</CardKicker>
              <div className="flex items-center rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                {LABEL_MODES.map((mode) => (
                  <ControlPill
                    key={mode.value}
                    active={labelMode === mode.value}
                    onClick={() => setLabelMode(mode.value)}
                  >
                    {mode.label}
                  </ControlPill>
                ))}
              </div>
            </div>

            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Node Floor</CardKicker>
              <div className="flex items-center rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                {DEGREE_OPTIONS.map((option) => (
                  <ControlPill
                    key={option.value}
                    active={degreeThreshold === option.value}
                    onClick={() => setDegreeThreshold(option.value)}
                  >
                    {option.label}
                  </ControlPill>
                ))}
              </div>
            </div>

            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Dealer Overlay</CardKicker>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                <ControlPill
                  active={!dealerLayerEnabled}
                  onClick={() => {
                    setDealerLayerEnabled(false);
                    setSelectedId(null);
                    setHoveredId(null);
                    setHoveredClusterId(null);
                    setExpandedClusterKey(null);
                    onNodeSelect?.(null);
                    onLeave?.();
                  }}
                >
                  Off
                </ControlPill>
                <ControlPill
                  active={dealerLayerEnabled}
                  onClick={() => {
                    setDealerLayerEnabled(true);
                    setSelectedId(null);
                    setHoveredId(null);
                    setHoveredClusterId(null);
                    setExpandedClusterKey(null);
                    onNodeSelect?.(null);
                    onLeave?.();
                  }}
                >
                  On
                </ControlPill>
              </div>
            </div>

            {dealerLayerEnabled ? (
              <div className="flex min-w-[240px] flex-col gap-1.5">
                <CardKicker>Dealer Categories</CardKicker>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                  {DEALER_CATEGORY_OPTIONS.map((option) => (
                    <ControlPill
                      key={option.value}
                      active={dealerCategoryFilters[option.value]}
                      onClick={() => {
                        setDealerCategoryFilters((current) => ({
                          ...current,
                          [option.value]: !current[option.value]
                        }));
                        setSelectedId(null);
                        setHoveredId(null);
                        setHoveredClusterId(null);
                        setExpandedClusterKey(null);
                        onNodeSelect?.(null);
                        onLeave?.();
                      }}
                    >
                      {option.label}
                    </ControlPill>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Display</CardKicker>
              <button
                type="button"
                onClick={handleLegendToggle}
                className={`flex h-8 items-center gap-2 rounded-md border px-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  legendVisible && !expanded
                    ? 'border-blue-500/40 bg-blue-600/10 text-blue-400'
                    : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                <EyeIcon className="size-3.5" />
                Legend
              </button>
            </div>

            <div className="flex min-w-[130px] flex-col gap-1.5">
              <CardKicker>Zoom</CardKicker>
              <div className="flex items-center rounded-md border border-border/30 bg-muted/10 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => stepZoom('out')}
                  className="p-2 text-muted-foreground transition-colors hover:text-blue-400"
                >
                  <MinusIcon className="size-3.5" />
                </button>
                <div className="mx-1 h-3 w-px bg-border/40" />
                <span className="w-10 text-center text-[9px] font-black text-foreground">{zoomPct}%</span>
                <div className="mx-1 h-3 w-px bg-border/40" />
                <button
                  type="button"
                  onClick={() => stepZoom('in')}
                  className="p-2 text-muted-foreground transition-colors hover:text-blue-400"
                >
                  <PlusIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/25 bg-card/10 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardKicker>Narrative View</CardKicker>
            <div className="mt-1 text-sm font-bold text-foreground">{narrativeSummary.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{narrativeSummary.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/65">
            {narrativeSummary.metrics.map((metric) => (
              <span key={metric} className="rounded-md border border-border/30 bg-muted/10 px-2.5 py-1">
                {metric}
              </span>
            ))}
          </div>
        </div>
      </div>


      {globalInsightStrip.length ? (
        <div className="rounded-lg border border-border/25 bg-card/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardKicker>Global Insight Strip</CardKicker>
              <div className="mt-1 text-sm font-bold text-foreground">What stands out in the current slice</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Live observations update from the visible graph, active preset, and current trace state.
              </p>
            </div>
            <div className="rounded-md border border-border/30 bg-muted/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/65">
              {graph.nodes.length} visible nodes
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4 md:grid-cols-2">
            {globalInsightStrip.map((item) => (
              <div
                key={`${item.kicker}-${item.value}`}
                className={`rounded-lg border px-3 py-3 ${globalObservationTone(item.kind)}`}
              >
                <div className="text-[10px] font-black uppercase tracking-widest">{item.kicker}</div>
                <div className="mt-2 text-sm font-semibold text-foreground">{item.value}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`grid gap-4 ${legendVisible && !expanded ? 'xl:grid-cols-[1fr_260px]' : 'grid-cols-1'}`}>
        <div className="space-y-4">
          {compareNodeDetails.length ? (
            <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardKicker>Compare</CardKicker>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {compareNodeDetails.length === 1 ? 'Pin one more node to compare side by side' : 'Side-by-side node comparison'}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {compareNodeDetails.length === 1
                      ? `Pinned: ${compareNodeDetails[0].node.label}. Select another node, then use Pin to compare in Selection Detail.`
                      : 'Compare role, evidence, and strongest relationship signals across two selected nodes.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare {compareNodeDetails.length}/2
                  </div>
                  {traceEndpoints ? (
                    <button
                      type="button"
                      onClick={() => setTraceActive((current) => !current)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        traceActive
                          ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/20'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      }`}
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      {traceActive ? 'Clear trace' : 'Trace path'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setCompareIds([]);
                      setTraceActive(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                </div>
              </div>


              {compareDeltas.length ? (
                <div className="mt-3 grid gap-2 xl:grid-cols-3">
                  {compareDeltas.map((delta) => (
                    <div
                      key={`${delta.label}-${delta.value}`}
                      className="rounded-lg border border-border/25 bg-black/10 px-3 py-3"
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest text-foreground/55">{delta.label}</div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{delta.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {traceActive && traceEndpoints ? (
                <div className={`mt-3 rounded-lg border px-3 py-3 ${
                  tracedPath?.found
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-border/25 bg-black/10'
                }`}>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <span className={tracedPath?.found ? 'text-amber-300' : 'text-foreground/60'}>
                      {tracedPath?.found ? 'Path trace active' : 'No visible path'}
                    </span>
                    {tracedPath?.found && tracedPath?.hops != null ? (
                      <span className="rounded-md border border-amber-500/25 bg-black/20 px-2 py-0.5 text-amber-200">
                        {tracedPath.hops} {tracedPath.hops === 1 ? 'hop' : 'hops'}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {traceEndpoints.startLabel} → {traceEndpoints.endLabel}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {tracedPath?.found
                      ? `Highlighted across ${tracedPath.layers.length || 1} layer${tracedPath.layers.length === 1 ? '' : 's'} in the current visible network.`
                      : 'No path is available in the current filtered view. Try expanding the view, changing presets, or tracing a different pair.'}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {[0, 1].map((slotIndex) => {
                  const detail = compareNodeDetails[slotIndex] || null;
                  if (!detail) {
                    return (
                      <div
                        key={`compare-empty-${slotIndex}`}
                        className="rounded-lg border border-dashed border-border/25 bg-black/10 px-4 py-4 text-left"
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-foreground/65">Open slot</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">Select another node to compare</div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Click any visible node, then use Pin to compare in Selection Detail.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={detail.node.id} className="rounded-lg border border-border/25 bg-black/10 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-bold text-foreground">{detail.node.label}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/60">
                            <span className="rounded-md border border-border/30 bg-muted/10 px-2 py-0.5">{detail.node.layer || 'Unknown layer'}</span>
                            <span className="rounded-md border border-border/30 bg-muted/10 px-2 py-0.5">{displayRegion(detail.node.region || 'Unknown')}</span>
                            {detail.dealerCategory ? (
                              <span
                                className="rounded-full border px-2 py-0.5"
                                style={{
                                  borderColor: dealerCategoryStyle(detail.node).stroke,
                                  backgroundColor: dealerCategoryStyle(detail.node).halo,
                                  color: dealerCategoryStyle(detail.node).stroke
                                }}
                              >
                                {detail.dealerCategory}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCompareNode(detail.node.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                          Remove
                        </button>
                      </div>

                      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{detail.roleSummary}</p>

                      <div className="mt-4 grid gap-2 md:grid-cols-3 text-[11px] text-muted-foreground">
                        <div className="rounded-md border border-border/25 bg-muted/10 px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Links</div>
                          <div className="mt-1 text-sm font-semibold text-foreground/90">{detail.relationshipCount}</div>
                        </div>
                        <div className="rounded-md border border-border/25 bg-muted/10 px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Evidence</div>
                          <div className="mt-1 text-sm font-semibold text-foreground/90">{detail.verificationSummary}</div>
                        </div>
                        <div className="rounded-md border border-border/25 bg-muted/10 px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Top signal</div>
                          <div className="mt-1 text-sm font-semibold text-foreground/90">{detail.strongestRelationship?.label || 'None yet'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardKicker>Network Intelligence</CardKicker>
              <div className="mt-1 text-lg font-bold text-foreground">Interactive Ecosystem Network</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Drag nodes, zoom the graph, and inspect cross-region relationships as the network settles into readable clusters. Dealer nodes now surface as a controlled overlay with category-aware accents.
              </p>

              {selectedNodeDetail ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/75">
                  <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1">Selected</span>
                  <span className="text-foreground">{selectedNodeDetail.node.label}</span>
                  <span className="text-muted-foreground">{selectedNodeDetail.relationshipCount} links</span>
                </div>
              ) : null}

              {expandedClusterKey ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedClusterKey(null);
                      setSelectedId(null);
                      setHoveredId(null);
                      setHoveredClusterId(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-blue-500"
                  >
                    ← Back
                  </button>
                  <div className="text-xs font-semibold text-foreground/80">{activeFocusLabel}</div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleExpandToggle}
              className="flex items-center gap-2 self-start rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-blue-500"
            >
              <ExpandIcon className="size-3.5" />
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          <div className="relative min-h-[920px] overflow-hidden rounded-xl border border-border/40 bg-black/40 backdrop-blur-md">
            <div ref={wrapRef} className="h-[920px] w-full" />

            <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
              <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => stepZoom('in')}
                  className="flex size-8 items-center justify-center rounded text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <PlusIcon className="size-4" />
                </button>
                <div className="mx-1 h-px bg-white/5" />
                <button
                  type="button"
                  onClick={() => stepZoom('out')}
                  className="flex size-8 items-center justify-center rounded text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <MinusIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

        {legendVisible && !expanded ? (
          <aside className="space-y-4">
            <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <CardKicker>Selection Detail</CardKicker>
                {selectedNodeDetail ? (
                  <span className="text-[10px] text-emerald-300/80">Active</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40">Idle</span>
                )}
              </div>

              {selectedNodeDetail ? (
                <div className="mt-4 max-h-[calc(100vh-11rem)] overflow-y-auto overflow-x-hidden pr-1">
                  <div className="sticky top-0 z-10 rounded-t-lg border-b border-border/20 bg-card/80 px-3 pb-3 pt-2 backdrop-blur-md">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-foreground">{selectedNodeDetail.node.label}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/65">
                          <span className="rounded-md border border-border/35 bg-muted/15 px-2 py-0.5">{selectedNodeDetail.node.layer || 'Unknown layer'}</span>
                          <span className="rounded-md border border-border/35 bg-muted/15 px-2 py-0.5">{displayRegion(selectedNodeDetail.node.region || 'Unknown')}</span>
                          {selectedNodeDetail.dealerCategory ? (
                            <span
                              className="rounded-full border px-2 py-1"
                              style={{
                                borderColor: dealerCategoryStyle(selectedNodeDetail.node).stroke,
                                backgroundColor: dealerCategoryStyle(selectedNodeDetail.node).halo,
                                color: dealerCategoryStyle(selectedNodeDetail.node).stroke
                              }}
                            >
                              {selectedNodeDetail.dealerCategory}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-right">
                        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-300/75">Links</div>
                        <div className="mt-0.5 text-sm font-bold text-emerald-200">{selectedNodeDetail.relationshipCount}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{selectedNodeDetail.roleSummary}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCompareNode(selectedNodeDetail.node.id)}
                        className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                          compareIds.includes(selectedNodeDetail.node.id)
                            ? 'border-blue-500/35 bg-blue-500/10 text-blue-300 hover:border-blue-400/50 hover:text-blue-200'
                            : 'border-border/30 bg-muted/10 text-muted-foreground hover:border-border/50 hover:bg-white/5 hover:text-foreground'
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                        {compareIds.includes(selectedNodeDetail.node.id) ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(null);
                          hoveredIdRef.current = null;
                          setHoveredId(null);
                          onNodeSelect?.(null);
                          onLeave?.();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-200"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3 pb-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="rounded-md border border-border/25 bg-muted/10 px-2.5 py-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Boundary</div>
                        <div className="mt-1 text-foreground/80">{toTitleCase(selectedNodeDetail.node.control_boundary || 'Unknown')}</div>
                      </div>
                      <div className="rounded-md border border-border/25 bg-muted/10 px-2.5 py-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Confidence</div>
                        <div className="mt-1 text-foreground/80">{toTitleCase(selectedNodeDetail.node.confidence || 'Unknown')}</div>
                      </div>
                    </div>

                    {selectedNodeDetail.strongestRelationship ? (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300/80">Top relationship signal</div>
                            <div className="mt-1 text-sm font-semibold text-foreground/90">{selectedNodeDetail.strongestRelationship.label}</div>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {selectedNodeDetail.strongestRelationship.preview
                                ? `Most visible with ${selectedNodeDetail.strongestRelationship.preview}${selectedNodeDetail.strongestRelationship.total > 3 ? ' and others' : ''}.`
                                : 'Most visible relationship group in the current mapped context.'}
                            </p>
                          </div>
                          <div className="rounded-md border border-emerald-500/20 bg-black/10 px-2 py-1 text-right">
                            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-300/70">Signal</div>
                            <div className="mt-0.5 text-[11px] font-semibold text-foreground/85">{summarizeEvidenceStrength(selectedNodeDetail.strongestRelationship.topConfidence)}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-md border border-border/25 bg-muted/10">
                      <button
                        type="button"
                        onClick={() => toggleInsightSection('why')}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Why it matters</span>
                        <span className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">{insightSections.why ? 'Hide' : 'Show'}</span>
                      </button>
                      {insightSections.why ? (
                        <div className="border-t border-border/20 px-3 pb-3 pt-2">
                          <p className="text-[11px] leading-relaxed text-muted-foreground">{selectedNodeDetail.relationshipSummary}</p>
                        </div>
                      ) : null}
                    </div>

                    {selectedNodeDetail.node.description ? (
                      <div className="rounded-md border border-border/25 bg-muted/10">
                        <button
                          type="button"
                          onClick={() => toggleInsightSection('description')}
                          className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Description</span>
                          <span className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">{insightSections.description ? 'Hide' : 'Show'}</span>
                        </button>
                        {insightSections.description ? (
                          <div className="border-t border-border/20 px-3 pb-3 pt-2">
                            <p className="text-[11px] leading-relaxed text-muted-foreground">{selectedNodeDetail.node.description}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-md border border-border/25 bg-muted/10">
                      <button
                        type="button"
                        onClick={() => toggleInsightSection('relationships')}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Connected relationships</span>
                          <span className="text-[10px] text-muted-foreground">{selectedNodeDetail.relationshipGroups.length} groups</span>
                        </div>
                        <span className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">{insightSections.relationships ? 'Hide' : 'Show'}</span>
                      </button>
                      {insightSections.relationships ? (
                        <div className="border-t border-border/20 px-3 pb-3 pt-2 space-y-3">
                          {selectedNodeDetail.relationshipGroups.length ? selectedNodeDetail.relationshipGroups.map((group) => {
                            const expandedGroup = Boolean(expandedRelationshipGroups[group.key]);
                            const visibleItems = expandedGroup ? group.items : group.items.slice(0, 3);
                            return (
                              <div key={group.key}>
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/65">{group.label}</div>
                                  <div className="text-[10px] text-muted-foreground">{group.total}</div>
                                </div>
                                <div className="space-y-1.5">
                                  {visibleItems.map((item, index) => (
                                    <div key={`${group.key}-${item.label}-${index}`} className="rounded-md border border-border/30 bg-black/10 px-2.5 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="text-[11px] font-semibold text-foreground/85">{item.label}</div>
                                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{toTitleCase(item.confidence)}</div>
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-muted-foreground">{item.region} · {item.layer}</div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground/75">
                                        <span className="rounded-full border border-border/30 bg-muted/10 px-1.5 py-0.5">{formatRelationshipLabel(group.key)}</span>
                                        <span className="rounded-full border border-border/30 bg-muted/10 px-1.5 py-0.5">{summarizeEvidenceStrength(item.confidence)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {group.total > 3 ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRelationshipGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}
                                    className="mt-1.5 inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 transition-colors hover:bg-white/5 hover:text-blue-300"
                                  >
                                    {expandedGroup ? 'Show less' : `View all ${group.total}`}
                                  </button>
                                ) : null}
                              </div>
                            );
                          }) : (
                            <div className="rounded-md border border-border/30 bg-black/10 px-2.5 py-2 text-[11px] text-muted-foreground">No connected relationships found.</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-border/25 bg-muted/10">
                      <button
                        type="button"
                        onClick={() => toggleInsightSection('metadata')}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Metadata</span>
                        <span className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">{insightSections.metadata ? 'Hide' : 'Show'}</span>
                      </button>
                      {insightSections.metadata ? (
                        <div className="grid grid-cols-2 gap-2 border-t border-border/20 px-3 pb-3 pt-2 text-[11px] text-muted-foreground">
                          <div className="rounded-md border border-border/25 bg-black/10 px-2.5 py-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Verification</div>
                            <div className="mt-1 text-foreground/80">{selectedNodeDetail.verificationSummary}</div>
                          </div>
                          <div className="rounded-md border border-border/25 bg-black/10 px-2.5 py-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Linked Regions</div>
                            <div className="mt-1 text-foreground/80">{selectedNodeDetail.connectedRegionSummary}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-border/25 bg-muted/10">
                      <button
                        type="button"
                        onClick={() => toggleInsightSection('evidence')}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Evidence & validation</span>
                        <span className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">{insightSections.evidence ? 'Hide' : 'Show'}</span>
                      </button>
                      {insightSections.evidence ? (
                        <div className="grid grid-cols-2 gap-2 border-t border-border/20 px-3 pb-3 pt-2 text-[11px] text-muted-foreground">
                          <div className="rounded-md border border-border/25 bg-black/10 px-2.5 py-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Evidence source</div>
                            <div className="mt-1 text-foreground/80">{selectedNodeDetail.evidenceSource}</div>
                          </div>
                          <div className="rounded-md border border-border/25 bg-black/10 px-2.5 py-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Evidence date</div>
                            <div className="mt-1 text-foreground/80">{selectedNodeDetail.evidenceDate}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-border/20 bg-black/10 px-4 py-6 text-center">
                  <div className="text-sm font-semibold text-foreground/80">Select a node to inspect it</div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Click any node to lock selection, review its metadata, and see connected relationships grouped by type.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <CardKicker>Network Legend</CardKicker>
                <span className="text-[10px] text-muted-foreground/40">ⓘ</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full border border-white shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ backgroundColor: '#2563eb' }} />
                  <span className="text-[10px] font-bold tracking-tight text-foreground/80">Verified node</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full border border-blue-400" />
                  <span className="text-[10px] font-bold tracking-tight text-foreground/80">External boundary node</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full border border-white shadow-[0_0_8px_rgba(249,115,22,0.4)]" style={{ backgroundColor: '#f97316' }} />
                  <span className="text-[10px] font-bold tracking-tight text-foreground/80">Regulatory node</span>
                </div>
                {dealerLayerEnabled ? (
                  <>
                    <div className="my-1 h-px bg-border/20" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Dealer Overlay</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold tracking-tight text-foreground/80">
                      {DEALER_CATEGORY_OPTIONS.map((option) => {
                        const style = dealerCategoryStyle({ layer: DEALER_LAYER, node_type: option.value, label: option.label });
                        return (
                          <div key={option.value} className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full border" style={{ borderColor: style.stroke, backgroundColor: style.halo, borderStyle: style.dashArray ? 'dashed' : 'solid' }} />
                            <span>{option.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="my-1 h-px bg-border/20" />
                    <div className="flex items-center gap-3">
                      <span className="h-px w-6 bg-[#59c28a]" />
                      <span className="text-[10px] font-bold tracking-tight text-foreground/80">L3 public/indirect edge</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-6 border-t border-dashed border-blue-500/40" />
                      <span className="text-[10px] font-bold tracking-tight text-foreground/80">Modelled / assumed edge</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-blue-500">ⓘ</span>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">How to Read This</div>
              </div>
              <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{helpText}</p>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}