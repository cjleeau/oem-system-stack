import { useEffect, useMemo, useRef, useState } from 'react';
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

const DEALER_CATEGORY_OPTIONS = [
  { value: 'DMS', label: 'DMS' },
  { value: 'CRM', label: 'CRM' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Service', label: 'Service' },
  { value: 'Marketplace', label: 'Marketplace' },
  { value: 'Platform', label: 'Platform' }
];

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

function detailNodeRadius(node, degreeMap, selectedId, hoveredId) {
  const degree = degreeMap.get(node.id) || 0;
  const base = Math.min(6.2, 4 + degree * 0.16);
  const dealerBonus = isDealerNode(node) ? dealerCategoryStyle(node).radiusBonus : 0;

  if (selectedId === node.id) return base + dealerBonus + 2.4;
  if (hoveredId === node.id) return base + dealerBonus + 1.6;
  return base + dealerBonus;
}

function detailEdgeBaseStyle(edge) {
  if (isDealerRelatedEdge(edge)) {
    const dealerNode = isDealerNode(edge.source) ? edge.source : isDealerNode(edge.target) ? edge.target : null;
    const categoryStyle = dealerCategoryStyle(dealerNode);
    const relation = String(edge.relationship || edge.relation || '').toLowerCase();

    if (relation.includes('host')) {
      return {
        stroke: 'rgba(167,179,199,0.46)',
        dashArray: '2 3'
      };
    }

    if (relation.includes('support')) {
      return {
        stroke: categoryStyle.edgeStroke,
        dashArray: categoryStyle.dashArray
      };
    }

    return {
      stroke: categoryStyle.edgeStroke,
      dashArray: categoryStyle.dashArray
    };
  }

  return {
    stroke: edgeStroke(edge),
    dashArray: edgeDash(edge)
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

function buildDetailGraph(nodes, edges, degreeMap, threshold, expandedClusterKey) {
  const keptIds = new Set(
    nodes
      .filter((node) => threshold === 0 || (degreeMap.get(node.id) || 0) >= threshold)
      .map((node) => node.id)
  );

  if (!expandedClusterKey) {
    const detailNodes = nodes.filter((node) => keptIds.has(node.id));
    const detailIds = new Set(detailNodes.map((node) => node.id));

    return {
      nodes: detailNodes,
      edges: edges.filter((edge) => detailIds.has(edge.source) && detailIds.has(edge.target))
    };
  }

  const [targetRegion, targetLayer] = expandedClusterKey.split('||');

  const seedIds = new Set(
    nodes
      .filter(
        (node) =>
          keptIds.has(node.id) &&
          (node.region || 'Unknown') === targetRegion &&
          (node.layer || 'Unknown') === targetLayer
      )
      .map((node) => node.id)
  );

  const includedIds = new Set(seedIds);

  edges.forEach((edge) => {
    if (seedIds.has(edge.source)) includedIds.add(edge.target);
    if (seedIds.has(edge.target)) includedIds.add(edge.source);
  });

  const detailNodes = nodes.filter((node) => includedIds.has(node.id));
  const detailIds = new Set(detailNodes.map((node) => node.id));

  return {
    nodes: detailNodes,
    edges: edges.filter((edge) => detailIds.has(edge.source) && detailIds.has(edge.target))
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
  const initialTransformRef = useRef(null);
  const legendBeforeExpandRef = useRef(true);

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

  const baseDegreeMap = useMemo(
    () =>
      buildDegreeMap(
        dealerAwareData.edges.map((edge) => ({ source: edge.source, target: edge.target }))
      ),
    [dealerAwareData.edges]
  );

  const resolvedMode = useMemo(() => {
    if (renderMode === 'overview') return 'overview';
    if (renderMode === 'detail') return 'detail';
    if (expandedClusterKey) return 'detail';
    return dealerAwareData.nodes.length > 320 ? 'overview' : 'detail';
  }, [renderMode, expandedClusterKey, dealerAwareData.nodes.length]);

  const graph = useMemo(() => {
    if (resolvedMode === 'overview') {
      return buildClusterGraph(
        dealerAwareData.nodes,
        dealerAwareData.edges,
        baseDegreeMap,
        degreeThreshold
      );
    }

    return buildDetailGraph(
      dealerAwareData.nodes,
      dealerAwareData.edges,
      baseDegreeMap,
      degreeThreshold,
      expandedClusterKey
    );
  }, [
    resolvedMode,
    dealerAwareData.nodes,
    dealerAwareData.edges,
    baseDegreeMap,
    degreeThreshold,
    expandedClusterKey
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
        .attr('r', (d) => Math.max(8, Math.min(28, 7 + d.memberCount * 0.72)))
        .attr('fill', (d) => (d.layer === DEALER_LAYER ? '#214637' : '#4da6ff'))
        .attr('fill-opacity', (d) => (d.layer === DEALER_LAYER ? 0.28 : 0.2))
        .attr('stroke', (d) => (d.layer === DEALER_LAYER ? '#7cefd1' : '#67d7ff'))
        .attr('stroke-width', (d) => (d.layer === DEALER_LAYER ? 1.5 : 1.2));

      nodeSelection
        .append('circle')
        .attr('r', (d) => Math.max(4, Math.min(18, 4 + d.memberCount * 0.34)))
        .attr('fill', (d) => (d.layer === DEALER_LAYER ? '#7cefd1' : '#67d7ff'))
        .attr('fill-opacity', (d) => (d.layer === DEALER_LAYER ? 0.88 : 0.82))
        .attr('stroke', 'rgba(255,255,255,0.32)')
        .attr('stroke-width', 0.9);

      const labelSelection = nodeSelection
        .append('text')
        .attr('x', 12)
        .attr('y', 4)
        .attr('class', 'svg-text')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text((d) => `${truncateLabel(d.label, 24)} (${d.memberCount})`);

      const refreshOverviewStyles = () => {
        nodeSelection.selectAll('circle').attr('opacity', (d, i) => {
          if (!hoveredClusterId) return i === 0 ? 0.9 : 1;
          if (d.id === hoveredClusterId) return 1;
          if ((adjacency.get(hoveredClusterId) || new Set()).has(d.id)) return 0.88;
          return 0.18;
        });

        linkSelection
          .attr('opacity', (edge) => {
            if (!hoveredClusterId) return 0.22;
            if (edge.source.id === hoveredClusterId || edge.target.id === hoveredClusterId) return 0.9;
            return 0.05;
          })
          .attr('stroke', (edge) => {
            if (hoveredClusterId && (edge.source.id === hoveredClusterId || edge.target.id === hoveredClusterId)) {
              return '#7cefd1';
            }
            return 'rgba(106,165,255,0.42)';
          });

        labelSelection.style('opacity', (d) =>
          shouldShowOverviewLabel(d, zoomK, labelMode, hoveredClusterId, expandedClusterKey) ? 0.96 : 0
        );
      };

      nodeSelection
        .on('mousemove', (event, d) => {
          setHoveredClusterId(d.id);
          onNodeHover?.(event, {
            ...d,
            notes: d.preview?.length ? `Representative members: ${d.preview.join(', ')}` : '',
            oem_group: d.region,
            layer: d.layer
          });
          refreshOverviewStyles();
        })
        .on('mouseleave', () => {
          setHoveredClusterId(null);
          onLeave?.();
          refreshOverviewStyles();
        })
        .on('click', (_, d) => {
          setExpandedClusterKey(d.id);
          setSelectedId(null);
          onNodeSelect?.(null);
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

    const detailSeedIds = new Set();

    if (selectedId && graph.nodes.some((node) => node.id === selectedId)) {
      detailSeedIds.add(selectedId);
    } else if (expandedClusterKey) {
      const [detailRegion, detailLayer] = expandedClusterKey.split('||');
      graph.nodes.forEach((node) => {
        if ((node.region || 'Unknown') === detailRegion && (node.layer || 'Unknown') === detailLayer) {
          detailSeedIds.add(node.id);
        }
      });
    }

    const useConstellationLayout = Boolean(selectedId || expandedClusterKey);
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
    const regionRanks = buildRegionRanks(layoutNodes, degreeMap);

    const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
    const selectedFocusSet = new Set();
    const hoveredFocusSet = new Set();

    if (selectedNode) {
      selectedFocusSet.add(selectedNode.id);
      (adjacency.get(selectedNode.id) || new Set()).forEach((id) => selectedFocusSet.add(id));
    }

    if (hoveredId) {
      hoveredFocusSet.add(hoveredId);
      (adjacency.get(hoveredId) || new Set()).forEach((id) => hoveredFocusSet.add(id));
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
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', (edge) => detailEdgeBaseStyle(edge).stroke)
      .attr('stroke-width', (edge) => {
        const dealerBoost = isDealerRelatedEdge(edge) ? 0.35 : 0;
        if (selectedId && (edge.source.id === selectedId || edge.target.id === selectedId)) return 2.1 + dealerBoost;
        return 0.95 + dealerBoost;
      })
      .attr('stroke-dasharray', (edge) => detailEdgeBaseStyle(edge).dashArray)
      .attr('opacity', (edge) => (isDealerRelatedEdge(edge) ? 0.2 : 0.14))
      .on('mousemove', (event, edge) => onEdgeHover?.(event, edge))
      .on('mouseleave', () => onLeave?.());

    const nodeSelection = root
      .append('g')
      .selectAll('g')
      .data(layoutNodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'grab');

    const circleSelection = nodeSelection
      .append('circle')
      .attr('r', (d) => detailNodeRadius(d, degreeMap, selectedId, hoveredId))
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
      .attr('r', (d) => Math.max(2.2, detailNodeRadius(d, degreeMap, selectedId, hoveredId) - 2.35))
      .attr('fill', (d) => dealerCategoryStyle(d).stroke)
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-width', 0.6)
      .attr('pointer-events', 'none');

    const dealerAccentSelection = nodeSelection
      .filter((d) => isDealerNode(d))
      .append('circle')
      .attr('r', (d) => {
        const base = detailNodeRadius(d, degreeMap, selectedId, hoveredId);
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

    const labelSelection = nodeSelection
      .append('text')
      .attr('x', 9)
      .attr('y', 4)
      .attr('class', 'svg-text')
      .style('font-size', '10px')
      .style('font-weight', '500')
      .text((d) => truncateLabel(d.label, 26));

    const refreshDetailStyles = () => {
      circleSelection
        .attr('fill', (d) => {
          if (selectedId === d.id) return '#7cefd1';
          if (hoveredId === d.id) return '#b8f8e7';
          if (selectedId && selectedFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).halo : '#6dc0ff';
          if (!selectedId && hoveredId && hoveredFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).halo : '#6dc0ff';
          if (isDealerNode(d)) return dealerCategoryStyle(d).halo;
          return nodeFill(d);
        })
        .attr('opacity', (d) => {
          if (selectedId) {
            if (selectedFocusSet.has(d.id)) return 1;
            if (hoveredId && hoveredFocusSet.has(d.id) && d.id !== hoveredId) return 0.22;
            return 0.1;
          }

          if (hoveredId) {
            if (hoveredFocusSet.has(d.id)) return 1;
            return 0.12;
          }

          return 0.94;
        })
        .attr('stroke', (d) => {
          if (selectedId === d.id) return 'rgba(255,255,255,0.95)';
          if (hoveredId === d.id) return 'rgba(255,255,255,0.82)';
          if (selectedId && selectedFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).stroke : 'rgba(255,255,255,0.42)';
          if (!selectedId && hoveredId && hoveredFocusSet.has(d.id)) return isDealerNode(d) ? dealerCategoryStyle(d).stroke : 'rgba(255,255,255,0.42)';
          if (isDealerNode(d)) return dealerCategoryStyle(d).stroke;
          return 'rgba(255,255,255,0.16)';
        })
        .attr('stroke-width', (d) => {
          if (selectedId === d.id) return 1.8;
          if (hoveredId === d.id) return 1.4;
          return isDealerNode(d) ? 1.05 : 0.8;
        })
        .attr('stroke-dasharray', (d) => (isDealerNode(d) ? dealerCategoryStyle(d).dashArray : null));

      dealerCoreSelection
        .attr('opacity', (d) => {
          if (selectedId) {
            return selectedFocusSet.has(d.id) ? 0.92 : 0.08;
          }
          if (hoveredId) {
            return hoveredFocusSet.has(d.id) ? 0.9 : 0.12;
          }
          return 0.82;
        });

      dealerAccentSelection
        .attr('opacity', (d) => {
          if (selectedId) {
            return selectedFocusSet.has(d.id) ? 0.95 : 0.06;
          }
          if (hoveredId) {
            return hoveredFocusSet.has(d.id) ? 0.92 : 0.1;
          }
          return 0.84;
        })
        .attr('stroke-opacity', (d) => {
          const base = dealerCategoryStyle(d).accentOpacity;
          if (selectedId && selectedFocusSet.has(d.id)) return Math.min(1, base + 0.12);
          if (!selectedId && hoveredId && hoveredFocusSet.has(d.id)) return Math.min(1, base + 0.08);
          return base;
        });

      linkSelection
        .attr('opacity', (edge) => {
          if (selectedId) {
            if (selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) return 0.82;
            if (hoveredId && hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 0.08;
            return 0.03;
          }

          if (hoveredId) {
            if (hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 0.82;
            return 0.035;
          }

          return isDealerRelatedEdge(edge) ? 0.19 : 0.14;
        })
        .attr('stroke', (edge) => {
          if (selectedId && selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) {
            return '#7cefd1';
          }
          if (!selectedId && hoveredId && hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) {
            return '#7cefd1';
          }
          return detailEdgeBaseStyle(edge).stroke;
        })
        .attr('stroke-dasharray', (edge) => detailEdgeBaseStyle(edge).dashArray)
        .attr('stroke-width', (edge) => {
          const dealerBoost = isDealerRelatedEdge(edge) ? 0.35 : 0;
          if (selectedId) {
            if (selectedFocusSet.has(edge.source.id) && selectedFocusSet.has(edge.target.id)) return 1.7 + dealerBoost;
            return 0.75 + dealerBoost;
          }
          if (hoveredId) {
            if (hoveredFocusSet.has(edge.source.id) && hoveredFocusSet.has(edge.target.id)) return 1.55 + dealerBoost;
            return 0.72 + dealerBoost;
          }
          return 0.95 + dealerBoost;
        });

      labelSelection
        .style('opacity', (d) => {
          const visible = shouldShowDetailLabel({
            node: d,
            zoomK,
            labelMode,
            degreeMap,
            regionRanks,
            selectedId,
            hoveredId,
            selectedFocusSet,
            hoveredFocusSet,
            pinnedIds
          });

          if (!visible) return 0;

          if (selectedId) {
            if (selectedFocusSet.has(d.id)) return 1;
            if (hoveredId === d.id) return 0.6;
            return 0.06;
          }

          if (hoveredId) {
            return hoveredFocusSet.has(d.id) ? 1 : 0.07;
          }

          return 0.94;
        })
        .style('font-weight', (d) => {
          if (selectedId === d.id || hoveredId === d.id) return '700';
          if (selectedId && selectedFocusSet.has(d.id)) return '600';
          if (!selectedId && hoveredId && hoveredFocusSet.has(d.id)) return '600';
          return '500';
        });
    };

    nodeSelection
      .on('mousemove', (event, d) => {
        setHoveredId(d.id);
        onNodeHover?.(event, d);
        refreshDetailStyles();
      })
      .on('mouseleave', () => {
        setHoveredId(null);
        onLeave?.();
        refreshDetailStyles();
      })
      .on('click', (_, d) => {
        const nextId = selectedId === d.id ? null : d.id;
        setSelectedId(nextId);
        setHoveredId(null);
        onNodeSelect?.(nextId ? d : null);
      })
      .on('dblclick', (_, d) => {
        setPinnedPositions((current) => {
          const next = { ...current };
          delete next[d.id];
          return next;
        });
      });

    const drag = d3
      .drag()
      .on('start', (event, d) => {
        onCanvasInteract?.();
        onLeave?.();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent?.target).style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        d.fx = Math.max(leftPad + 26, Math.min(width - rightPad - 26, event.x));
        d.fy = Math.max(topPad + 24, Math.min(height - bottomPad - 24, event.y));
        d.x = d.fx;
        d.y = d.fy;

        nodeSelection
          .filter((item) => item.id === d.id)
          .attr('transform', `translate(${d.x},${d.y})`);

        linkSelection
          .filter((edge) => edge.source.id === d.id || edge.target.id === d.id)
          .attr('x1', (edge) => edge.source.x)
          .attr('y1', (edge) => edge.source.y)
          .attr('x2', (edge) => edge.target.x)
          .attr('y2', (edge) => edge.target.y);
      })
      .on('end', (_, d) => {
        const x = Math.max(leftPad + 26, Math.min(width - rightPad - 26, d.fx ?? d.x));
        const y = Math.max(topPad + 24, Math.min(height - bottomPad - 24, d.fy ?? d.y));

        setPinnedPositions((current) => ({
          ...current,
          [d.id]: { x, y }
        }));
      });

    nodeSelection.call(drag);

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
    hoveredId,
    hoveredClusterId,
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

  const resetLayout = () => {
    setPinnedPositions({});
    setSelectedId(null);
    setHoveredId(null);
    setHoveredClusterId(null);
    setExpandedClusterKey(null);
    setLayoutVersion((current) => current + 1);
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

  const activeFocusLabel = expandedClusterKey ? formatExpandedClusterLabel(expandedClusterKey) : '';

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

      <div className={`grid gap-4 ${legendVisible && !expanded ? 'xl:grid-cols-[1fr_260px]' : 'grid-cols-1'}`}>
        <div className="rounded-lg border border-border/30 bg-card/10 px-4 py-3 backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardKicker>Network Intelligence</CardKicker>
              <div className="mt-1 text-lg font-bold text-foreground">Interactive Ecosystem Network</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Drag nodes, zoom the graph, and inspect cross-region relationships as the network settles into readable clusters. Dealer nodes now surface as a controlled overlay with category-aware accents.
              </p>

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

        {legendVisible && !expanded ? (
          <aside className="space-y-4">
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
                    <div className="text-[10px] font-black uppercase tracking-widest text-foreground/50">
                      Dealer Overlay
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold tracking-tight text-foreground/80">
                      {DEALER_CATEGORY_OPTIONS.map((option) => {
                        const style = dealerCategoryStyle({ layer: DEALER_LAYER, node_type: option.value, label: option.label });
                        return (
                          <div key={option.value} className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full border"
                              style={{
                                borderColor: style.stroke,
                                backgroundColor: style.halo,
                                borderStyle: style.dashArray ? 'dashed' : 'solid'
                              }}
                            />
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