import * as d3 from 'd3';
import useD3 from '../lib/useD3';
import { LAYERS } from '../lib/constants';
import { edgeDash, edgeStroke, nodeFill } from '../lib/data';
import Legend from '../components/Legend';
import { fmtInt } from '../lib/utils';

function truncateLabel(value, max = 28) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function EmptyState() {
  return (
    <div className="flex min-h-[760px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-card/20 p-8 text-center text-sm text-muted-foreground">
      No architecture nodes matched the current filter set.
    </div>
  );
}

export default function ArchitectureView({ nodes, edges, state, onNodeHover, onNodeSelect, onEdgeHover, onLeave, onCanvasInteract }) {
  const hasData = nodes.length > 0;
  const modeLabel = state.oem === 'all' ? 'Overview mode' : `${state.oem} mode`;

  const ref = useD3(
    (element) => {
      if (!hasData) return undefined;

      const width = 1680;
      const height = 1120;
      const margin = { top: 64, right: 24, bottom: 24, left: 290 };
      const laneH = Math.max(44, Math.floor((height - margin.top - margin.bottom) / LAYERS.length));
      const maxPerLane = state.archTight ? 8 : 16;

      const svg = d3.select(element).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('class', 'h-full w-full');
      const root = svg.append('g');

      const zoom = d3.zoom().scaleExtent([0.5, 4.5]).on('start', () => onCanvasInteract?.()).on('zoom', (event) => root.attr('transform', event.transform));
      svg.call(zoom);
      svg.call(zoom.transform, d3.zoomIdentity.translate(16, 0).scale(state.oem === 'all' ? 0.84 : 1));

      const oems = [...new Set(nodes.map((node) => node.oem_group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const xScale = d3.scaleBand().domain(oems).range([margin.left, width - margin.right]).padding(0.12);

      LAYERS.forEach((layer, index) => {
        const y = margin.top + index * laneH;

        root
          .append('rect')
          .attr('x', margin.left)
          .attr('y', y)
          .attr('width', width - margin.left - margin.right)
          .attr('height', laneH - 2)
          .attr('fill', index % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)');

        root
          .append('line')
          .attr('x1', margin.left)
          .attr('x2', width - margin.right)
          .attr('y1', y)
          .attr('y2', y)
          .attr('stroke', 'rgba(255,255,255,0.08)');

        root.append('text').attr('x', 16).attr('y', y + Math.min(32, laneH - 10)).attr('class', 'svg-muted').text(layer);
      });

      root
        .selectAll('.oem-head')
        .data(oems)
        .join('text')
        .attr('x', (oem) => (xScale(oem) || margin.left) + 10)
        .attr('y', 28)
        .attr('class', 'svg-label')
        .text((oem) => oem);

      const grouped = d3.group(nodes, (node) => node.layer, (node) => node.oem_group);
      const positions = new Map();

      for (const [layer, byOem] of grouped) {
        const layerIndex = LAYERS.indexOf(layer);
        if (layerIndex < 0) continue;

        const y0 = margin.top + layerIndex * laneH + 8;

        for (const [oem, list] of byOem) {
          const x0 = xScale(oem) || margin.left;
          const colW = xScale.bandwidth();
          const boxW = Math.max(172, Math.min(colW - 12, 240));
          const boxH = 24;
          const rowsPerStack = Math.max(1, Math.floor((laneH - 16) / (boxH + 4)));

          list.slice(0, maxPerLane).forEach((node, index) => {
            const row = index % rowsPerStack;
            const stack = Math.floor(index / rowsPerStack);

            positions.set(node.id, {
              x: x0 + 6 + stack * (boxW + 10),
              y: y0 + row * (boxH + 4),
              w: boxW,
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
        .attr('stroke-width', (edge) => (Number(edge.verification_level) >= 3 ? 1.8 : 1.2))
        .attr('stroke-dasharray', (edge) => edgeDash(edge))
        .attr('opacity', (edge) => (Number(edge.verification_level) >= 3 ? 0.95 : 0.7))
        .attr('d', (edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          const x1 = source.x + source.w;
          const y1 = source.y + source.h / 2;
          const x2 = target.x;
          const y2 = target.y + target.h / 2;
          const dx = Math.min(140, Math.max(40, Math.abs(x2 - x1) * 0.35));
          return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
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
        .attr('stroke', 'rgba(255,255,255,0.34)');

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
    [hasData, nodes, edges, state.archTight, state.oem, onNodeHover, onNodeSelect, onEdgeHover, onLeave, onCanvasInteract]
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <div className="min-h-[760px] rounded-2xl border border-border/40 bg-card/20 p-2 shadow-inner backdrop-blur-sm">
        <div className="grid gap-3 border-b border-border/40 px-4 py-3 text-sm text-muted-foreground md:grid-cols-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mode</div>
            <div className="mt-1 font-medium text-foreground">{modeLabel}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visible lanes</div>
            <div className="mt-1 font-medium text-foreground">{fmtInt(LAYERS.length)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visible nodes</div>
            <div className="mt-1 font-medium text-foreground">{fmtInt(nodes.length)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visible links</div>
            <div className="mt-1 font-medium text-foreground">{fmtInt(edges.length)}</div>
          </div>
        </div>

        <div className="border-b border-border/40 px-4 py-3 text-sm text-muted-foreground">
          Lane-based stack view. OEMs remain column anchors; layers remain system lanes. Architecture links can be narrowed to adjacent lanes and supplier-focused slices without collapsing back into the grid mental model.
        </div>

        {hasData ? <div ref={ref} className="h-[760px] w-full" onMouseLeave={onLeave} /> : <EmptyState />}
      </div>

      <Legend
        title="Architecture Legend"
        helpText="Architecture view keeps OEMs as column anchors and layers as structural lanes so repeated stack patterns stay readable at a glance."
        items={[
          { type: 'box', color: '#2563eb', label: 'Verified OEM or supplier node', glow: 'rgba(37,99,235,0.4)' },
          { type: 'box', color: '#60a5fa', label: 'External ecosystem node', hollow: true },
          { type: 'box', color: '#f97316', label: 'Regulatory node', glow: 'rgba(249,115,22,0.4)' },
          { type: 'line', color: '#7ad6ff', label: 'L4 verified architecture link' },
          { type: 'line', color: '#59c28a', label: 'L3 public/indirect link' },
          { type: 'line', color: '#60a5fa', dash: '5 4', label: 'Inferred / incomplete link' }
        ]}
      />
    </div>
  );
}