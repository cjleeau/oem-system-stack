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
  const grouped = d3.group(
    keptNodes,
    (node) => `${node.region || 'Unknown'}||${node.layer || 'Unknown'}`
  );

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

function shouldShowDetailLabel({
  node,
  zoomK,
  labelMode,
  degreeMap,
  regionRanks,
  selectedId,
  hoveredId,
  focusSet,
  pinnedIds
}) {
  if (selectedId === node.id || hoveredId === node.id || pinnedIds.has(node.id) || focusSet.has(node.id)) {
    return true;
  }

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

    const sublaneScale = d3
      .scalePoint()
      .domain(layers)
      .range([-110, 110]);

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

function CardKicker({ children }) {
  return <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{children}</div>;
}

function ControlPill({ active = false, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-muted-foreground hover:text-foreground'
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

  const baseDegreeMap = useMemo(
    () => buildDegreeMap(edges.map((edge) => ({ source: edge.source, target: edge.target }))),
    [edges]
  );

  const resolvedMode = useMemo(() => {
    if (renderMode === 'overview') return 'overview';
    if (renderMode === 'detail') return 'detail';
    if (expandedClusterKey) return 'detail';
    return nodes.length > 320 ? 'overview' : 'detail';
  }, [renderMode, expandedClusterKey, nodes.length]);

  const graph = useMemo(() => {
    if (resolvedMode === 'overview') {
      return buildClusterGraph(nodes, edges, baseDegreeMap, degreeThreshold);
    }

    return buildDetailGraph(nodes, edges, baseDegreeMap, degreeThreshold, expandedClusterKey);
  }, [resolvedMode, nodes, edges, baseDegreeMap, degreeThreshold, expandedClusterKey]);

  const pinnedIds = useMemo(() => new Set(Object.keys(pinnedPositions)), [pinnedPositions]);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(null);
    }
  }, [graph.nodes, selectedId]);

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
    const xScale = d3
      .scalePoint()
      .domain(regions)
      .range([leftPad + 120, width - rightPad - 120]);

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
      const yScale = d3
        .scalePoint()
        .domain(layers)
        .range([topPad + 54, height - bottomPad - 40]);

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
        .attr('fill', '#4da6ff')
        .attr('fill-opacity', 0.2)
        .attr('stroke', '#67d7ff')
        .attr('stroke-width', 1.2);

      nodeSelection
        .append('circle')
        .attr('r', (d) => Math.max(4, Math.min(18, 4 + d.memberCount * 0.34)))
        .attr('fill', '#67d7ff')
        .attr('fill-opacity', 0.82)
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

    const sublaneTargets = buildDetailSublaneTargets(graph.nodes, regions, xScale, height, topPad, bottomPad);

    const layoutNodes = graph.nodes.map((node, index) => {
      const pinned = pinnedPositions[node.id];
      const target = sublaneTargets.get(node.id) || {
        targetX: xScale(node.region) || width / 2,
        targetY: height / 2,
        laneLabel: layerKey(node.layer)
      };

      return {
        ...node,
        x: pinned?.x ?? target.targetX + ((index % 3) - 1) * 6,
        y: pinned?.y ?? target.targetY,
        fx: pinned?.x ?? null,
        fy: pinned?.y ?? null,
        targetX: target.targetX,
        targetY: target.targetY,
        laneLabel: target.laneLabel
      };
    });

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
    const degreeMap = buildDegreeMap(
      layoutLinks.map((edge) => ({
        source: edge.source.id,
        target: edge.target.id
      }))
    );
    const regionRanks = buildRegionRanks(layoutNodes, degreeMap);

    const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
    const focusSet = new Set();

    if (selectedNode) {
      focusSet.add(selectedNode.id);
      (adjacency.get(selectedNode.id) || new Set()).forEach((id) => focusSet.add(id));
    }

    if (hoveredId) {
      focusSet.add(hoveredId);
      (adjacency.get(hoveredId) || new Set()).forEach((id) => focusSet.add(id));
    }

    const simulation = d3
      .forceSimulation(layoutNodes)
      .alpha(0.7)
      .alphaDecay(0.035)
      .force(
        'link',
        d3
          .forceLink(layoutLinks)
          .id((datum) => datum.id)
          .distance((edge) => {
            if (edge.source.region === edge.target.region) {
              return edge.source.laneLabel === edge.target.laneLabel ? 26 : 56;
            }
            return 110;
          })
          .strength((edge) => {
            if (selectedNode && (edge.source.id === selectedNode.id || edge.target.id === selectedNode.id)) {
              return 0.18;
            }
            if (edge.source.region === edge.target.region && edge.source.laneLabel === edge.target.laneLabel) {
              return 0.05;
            }
            return 0.02;
          })
      )
      .force('charge', d3.forceManyBody().strength(-10))
      .force(
        'collide',
        d3.forceCollide().radius((datum) => {
          const degree = degreeMap.get(datum.id) || 0;
          return Math.min(11, 4.8 + degree * 0.08);
        })
      )
      .force('x', d3.forceX((datum) => datum.targetX).strength(1))
      .force('y', d3.forceY((datum) => datum.targetY).strength(0.9));

    for (let i = 0; i < 220; i += 1) simulation.tick();
    simulation.stop();

    layoutNodes.forEach((node) => {
      node.x = Math.max(leftPad + 26, Math.min(width - rightPad - 26, node.x));
      node.y = Math.max(topPad + 24, Math.min(height - bottomPad - 24, node.y));
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
      .attr('stroke', (edge) => edgeStroke(edge))
      .attr('stroke-width', (edge) => {
        if (selectedId && (edge.source.id === selectedId || edge.target.id === selectedId)) return 2.1;
        return 0.95;
      })
      .attr('stroke-dasharray', (edge) => edgeDash(edge))
      .attr('opacity', 0.14)
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
      .attr('r', (d) => {
        const degree = degreeMap.get(d.id) || 0;
        if (selectedId === d.id) return 8.6;
        if (hoveredId === d.id) return 7.8;
        return Math.min(6.2, 4 + degree * 0.16);
      })
      .attr('fill', (d) => nodeFill(d))
      .attr('stroke', 'rgba(255,255,255,0.24)')
      .attr('stroke-width', 0.8);

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
          if (selectedId === d.id || hoveredId === d.id) return '#7cefd1';
          if ((selectedId || hoveredId) && focusSet.has(d.id)) return '#6dc0ff';
          return nodeFill(d);
        })
        .attr('opacity', (d) => {
          if (!selectedId && !hoveredId) return 0.94;
          if (focusSet.has(d.id)) return 1;
          return 0.12;
        })
        .attr('stroke', (d) => {
          if (selectedId === d.id) return 'rgba(255,255,255,0.95)';
          if (hoveredId === d.id) return 'rgba(255,255,255,0.82)';
          if ((selectedId || hoveredId) && focusSet.has(d.id)) return 'rgba(255,255,255,0.42)';
          return 'rgba(255,255,255,0.16)';
        })
        .attr('stroke-width', (d) => {
          if (selectedId === d.id) return 1.8;
          if (hoveredId === d.id) return 1.4;
          return 0.8;
        });

      linkSelection
        .attr('opacity', (edge) => {
          if (!selectedId && !hoveredId) return 0.14;
          if (focusSet.has(edge.source.id) && focusSet.has(edge.target.id)) return 0.82;
          return 0.035;
        })
        .attr('stroke', (edge) => {
          if ((selectedId || hoveredId) && focusSet.has(edge.source.id) && focusSet.has(edge.target.id)) {
            return '#7cefd1';
          }
          return edgeStroke(edge);
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
            focusSet,
            pinnedIds
          });

          if (!visible) return 0;
          if (!selectedId && !hoveredId) return 0.94;
          return focusSet.has(d.id) ? 1 : 0.07;
        })
        .style('font-weight', (d) => {
          if (selectedId === d.id || hoveredId === d.id) return '700';
          if ((selectedId || hoveredId) && focusSet.has(d.id)) return '600';
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

  const toggleExpanded = () => {
    setExpanded((current) => !current);
    if (!expanded) {
      setLegendVisible(false);
    }
  };

  const helpText =
    resolvedMode === 'overview'
      ? expandedClusterKey
        ? 'A cluster has been expanded into local detail. Reset layout to return to the high-level overview.'
        : 'Overview mode clusters the network by region and layer so the unfiltered landscape stays readable.'
      : expandedClusterKey
        ? 'Detail mode is focused on one cluster and its immediate connected neighbourhood.'
        : 'Detail mode uses region sublanes so dense columns separate into clearer internal lanes. Hover highlights local relationships. Zooming in reveals more labels.';

  if (!hasData) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardKicker>Network Controls</CardKicker>
              <div className="mt-1 text-sm text-foreground">{helpText}</div>
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

          <div className="flex flex-wrap items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <CardKicker>Render Mode</CardKicker>
              <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
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

            <div className="flex flex-col gap-1.5">
              <CardKicker>Label Density</CardKicker>
              <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
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

            <div className="flex flex-col gap-1.5">
              <CardKicker>Node Floor</CardKicker>
              <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
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

            <div className="flex flex-col gap-1.5">
              <CardKicker>Display</CardKicker>
              <button
                type="button"
                onClick={() => setLegendVisible((current) => !current)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  legendVisible
                    ? 'border-blue-500/40 bg-blue-600/10 text-blue-400'
                    : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                <EyeIcon className="size-3.5" />
                Legend
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <CardKicker>Zoom</CardKicker>
              <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
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
        <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardKicker>Network Intelligence</CardKicker>
              <div className="mt-1 text-lg font-bold text-foreground">Interactive Ecosystem Network</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Drag nodes, zoom the graph, and inspect cross-region relationships as the network settles into readable clusters.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleExpanded}
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
            <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm">
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
                <div className="my-1 h-px bg-border/20" />
                <div className="flex items-center gap-3">
                  <span className="h-px w-6 bg-[#59c28a]" />
                  <span className="text-[10px] font-bold tracking-tight text-foreground/80">L3 public/indirect edge</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 border-t border-dashed border-blue-500/40" />
                  <span className="text-[10px] font-bold tracking-tight text-foreground/80">Modelled / assumed edge</span>
                </div>
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