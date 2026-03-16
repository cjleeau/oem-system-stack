import { useRef, useState } from 'react';
import * as d3 from 'd3';
import useD3 from '../lib/useD3';
import { LAYERS } from '../lib/constants';
import { edgeDash, edgeStroke, nodeFill } from '../lib/data';
import Legend from '../components/Legend';

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
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

function truncateLabel(value, max = 30) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function EmptyState() {
  return (
    <div className="flex min-h-[720px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-card/20 p-8 text-center text-sm text-muted-foreground">
      No nodes matched the current filter set.
    </div>
  );
}

function Pill({ active = false, children }) {
  return (
    <button
      type="button"
      className={`rounded px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function GridView({ nodes, edges, onNodeHover, onNodeSelect, onEdgeHover, onLeave, onCanvasInteract }) {
  const hasData = nodes.length > 0;
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const [legendVisible, setLegendVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);

  const ref = useD3(
    (element) => {
      if (!hasData) return undefined;

      const cols = [...new Set(nodes.map((node) => node.oem_group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const margin = { top: 50, right: 28, bottom: 28, left: 300 };
      const cellW = 280;
      const cellH = 90;
      const width = Math.max(1600, margin.left + margin.right + cols.length * cellW);
      const height = margin.top + margin.bottom + LAYERS.length * cellH;

      const svg = d3.select(element).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('class', 'h-full w-full');
      svgRef.current = svg;

      const root = svg.append('g');
      const zoom = d3.zoom().scaleExtent([0.3, 8]).on('start', () => onCanvasInteract?.()).on('zoom', (event) => {
        root.attr('transform', event.transform);
        setZoomPct(Math.round(event.transform.k * 100));
      });

      zoomRef.current = zoom;
      svg.call(zoom);
      svg.call(zoom.transform, d3.zoomIdentity.translate(24, 12).scale(0.72));

      root
        .selectAll('.col-label')
        .data(cols)
        .join('text')
        .attr('x', (_, index) => margin.left + index * cellW + 12)
        .attr('y', 28)
        .attr('class', 'svg-label')
        .text((value) => value);

      root
        .selectAll('.row-label')
        .data(LAYERS)
        .join('text')
        .attr('x', 12)
        .attr('y', (_, index) => margin.top + index * cellH + 48)
        .attr('class', 'svg-muted')
        .text((value) => value);

      for (let row = 0; row < LAYERS.length; row += 1) {
        for (let col = 0; col < cols.length; col += 1) {
          root
            .append('rect')
            .attr('x', margin.left + col * cellW)
            .attr('y', margin.top + row * cellH)
            .attr('width', cellW)
            .attr('height', cellH)
            .attr('fill', 'rgba(255,255,255,0.01)')
            .attr('stroke', 'rgba(255,255,255,0.05)');
        }
      }

      const grouped = d3.group(nodes, (node) => node.layer, (node) => node.oem_group);
      const positions = new Map();

      for (const [layer, byCol] of grouped) {
        const rowIndex = LAYERS.indexOf(layer);
        if (rowIndex < 0) continue;

        for (const [col, list] of byCol) {
          const colIndex = cols.indexOf(col);
          if (colIndex < 0) continue;

          const x0 = margin.left + colIndex * cellW + 10;
          const y0 = margin.top + rowIndex * cellH + 10;
          const boxH = 24;

          list.slice(0, 4).forEach((node, index) => {
            positions.set(node.id, {
              x: x0,
              y: y0 + index * (boxH + 6),
              w: cellW - 20,
              h: boxH
            });
          });
        }
      }

      root
        .append('g')
        .selectAll('path')
        .data(edges.filter((edge) => positions.has(edge.source) && positions.has(edge.target)))
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', (edge) => edgeStroke(edge))
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', (edge) => edgeDash(edge))
        .attr('opacity', 0.82)
        .attr('d', (edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          const x1 = source.x + source.w;
          const y1 = source.y + source.h / 2;
          const x2 = target.x;
          const y2 = target.y + target.h / 2;
          const mx = (x1 + x2) / 2;
          return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        })
        .on('mousemove', (event, edge) => onEdgeHover(event, edge))
        .on('mouseleave', onLeave);

      const nodeGroups = root
        .append('g')
        .selectAll('g')
        .data(nodes.filter((node) => positions.has(node.id)))
        .join('g')
        .attr('transform', (node) => {
          const pos = positions.get(node.id);
          return `translate(${pos.x},${pos.y})`;
        })
        .style('cursor', 'pointer')
        .on('mousemove', (event, node) => onNodeHover(event, node))
        .on('mouseleave', onLeave)
        .on('click', (_, node) => onNodeSelect?.(node));

      nodeGroups
        .append('rect')
        .attr('width', (node) => positions.get(node.id).w)
        .attr('height', (node) => positions.get(node.id).h)
        .attr('rx', 6)
        .attr('fill', (node) => nodeFill(node))
        .attr('stroke', 'rgba(255,255,255,0.28)');

      nodeGroups
        .append('text')
        .attr('x', 10)
        .attr('y', 16)
        .attr('class', 'svg-text')
        .text((node) => truncateLabel(node.label));

      return () => {
        svg.on('.zoom', null);
      };
    },
    [hasData, nodes, edges, onNodeHover, onNodeSelect, onEdgeHover, onLeave, onCanvasInteract]
  );

  const stepZoom = (direction) => {
    if (!svgRef.current || !zoomRef.current) return;
    svgRef.current.transition().duration(180).call(zoomRef.current.scaleBy, direction === 'in' ? 1.18 : 0.84);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/20 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Render Mode</span>
            <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
              <Pill active>Auto</Pill>
              <Pill>Overview</Pill>
              <Pill>Detail</Pill>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Label Density</span>
            <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
              <Pill>Minimal</Pill>
              <Pill active>Balanced</Pill>
              <Pill>Expanded</Pill>
              <Pill>Focused</Pill>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Display</span>
            <button
              type="button"
              onClick={() => setLegendVisible((value) => !value)}
              className={`flex items-center gap-2 rounded border px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                legendVisible
                  ? 'border-blue-500/40 bg-blue-600/10 text-blue-400'
                  : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'
              }`}
            >
              <EyeIcon className="size-3" />
              Legend
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
            <button type="button" onClick={() => stepZoom('out')} className="p-1.5 text-muted-foreground transition-colors hover:text-blue-400">
              <MinusIcon className="size-3.5" />
            </button>
            <div className="mx-1 h-3 w-px bg-border/40" />
            <span className="w-8 text-center text-[9px] font-black text-foreground">{zoomPct}%</span>
            <div className="mx-1 h-3 w-px bg-border/40" />
            <button type="button" onClick={() => stepZoom('in')} className="p-1.5 text-muted-foreground transition-colors hover:text-blue-400">
              <PlusIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${legendVisible && !expanded ? 'xl:grid-cols-[1fr_280px]' : 'grid-cols-1'}`}>
        <div className="group relative aspect-[16/9] min-h-[600px] overflow-hidden rounded-2xl border border-border/40 bg-black/40 backdrop-blur-md">
          {hasData ? <div ref={ref} className="h-full w-full" onMouseLeave={onLeave} /> : <EmptyState />}

          <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
            <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur-md">
              <button type="button" onClick={() => stepZoom('in')} className="flex size-8 items-center justify-center rounded text-white/70 transition-all hover:bg-white/10 hover:text-white">
                <PlusIcon className="size-4" />
              </button>
              <div className="mx-1 h-px bg-white/5" />
              <button type="button" onClick={() => stepZoom('out')} className="flex size-8 items-center justify-center rounded text-white/70 transition-all hover:bg-white/10 hover:text-white">
                <MinusIcon className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white/70 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
            >
              <ExpandIcon className="size-4" />
            </button>
          </div>
        </div>

        {legendVisible && !expanded ? (
          <Legend
            title="Grid Legend"
            helpText="Grid view organises the visible ecosystem into layer-by-OEM cells. Zoom in to inspect individual node cards and relationship paths."
            items={[
              { type: 'box', color: '#2563eb', label: 'Verified node', glow: 'rgba(37,99,235,0.4)' },
              { type: 'box', color: '#60a5fa', label: 'External boundary node', hollow: true },
              { type: 'box', color: '#f97316', label: 'Regulatory node', glow: 'rgba(249,115,22,0.4)' },
              { type: 'line', color: '#3b82f6', label: 'L3 public/indirect link' },
              { type: 'line', color: '#60a5fa', dash: '5 4', label: 'Modelled / assumed link' }
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}