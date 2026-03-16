import * as d3 from 'd3';
import useD3 from '../lib/useD3';
import { fmtInt, pct, safe } from '../lib/utils';

function Table({ title, columns, rows, maxHeight = 360 }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
      <div className="mb-3 text-xs uppercase tracking-[0.18em] text-mute">{title}</div>
      <div className="max-h-[360px] overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="sticky top-0 border-b border-white/10 bg-[#0f1622] px-3 py-2 text-left font-medium text-mute">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className={index % 2 ? 'bg-white/[0.03]' : ''}>
                {columns.map((column) => (
                  <td key={column.key} className="border-b border-white/5 px-3 py-2 text-ink">
                    {column.format ? column.format(row[column.key], row) : safe(row[column.key]) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const ref = useD3((element) => {
    const width = 520;
    const height = 240;
    const pad = { top: 10, right: 10, bottom: 28, left: 36 };
    const svg = d3.select(element).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('class', 'w-full');
    const x = d3.scaleBand().domain(data.map((item) => item.level)).range([pad.left, width - pad.right]).padding(0.22);
    const y = d3.scaleLinear().domain([0, d3.max(data, (item) => item.count) || 1]).nice().range([height - pad.bottom, pad.top]);

    svg.append('g').attr('transform', `translate(0,${height - pad.bottom})`).call(d3.axisBottom(x)).selectAll('text').attr('fill', '#9ca7b6');
    svg.append('g').attr('transform', `translate(${pad.left},0)`).call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('fill', '#9ca7b6');

    svg.selectAll('rect').data(data).join('rect')
      .attr('x', (item) => x(item.level))
      .attr('y', (item) => y(item.count))
      .attr('width', x.bandwidth())
      .attr('height', (item) => height - pad.bottom - y(item.count))
      .attr('fill', 'rgba(79,140,255,0.9)')
      .attr('stroke', 'rgba(255,255,255,0.20)');

    svg.selectAll('text.count').data(data).join('text')
      .attr('class', 'count')
      .attr('x', (item) => x(item.level) + x.bandwidth() / 2)
      .attr('y', (item) => y(item.count) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f4f7fb')
      .style('font-size', '11px')
      .text((item) => fmtInt(item.count));
  }, [data]);

  return <div ref={ref} />;
}

export default function GovernanceView({ metrics }) {
  const levelData = [4, 3, 2, 1, 0].map((level) => ({ level: String(level), count: metrics.levelCounts.get(level) || 0 }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        {[
          ['Nodes', metrics.totalNodes],
          ['Edges', metrics.totalEdges],
          ['L4', metrics.levelCounts.get(4) || 0],
          ['L3', metrics.levelCounts.get(3) || 0],
          ['L2', metrics.levelCounts.get(2) || 0],
          ['L1', metrics.levelCounts.get(1) || 0],
          ['L0', metrics.levelCounts.get(0) || 0],
          ['Missing verification level', metrics.missingRows.find((row) => row.field === 'verification_level')?.missing || 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.16em] text-mute">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-ink">{fmtInt(value)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
          <div className="mb-3 text-xs uppercase tracking-[0.18em] text-mute">Edge distribution by verification level</div>
          <BarChart data={levelData} />
        </div>
        <Table
          title="Evidence status"
          rows={metrics.statusRows}
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Count', format: (value) => fmtInt(value) },
            { key: 'pct', label: '%', format: (value) => pct(value) }
          ]}
          maxHeight={240}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Table
          title="Weakest layers"
          rows={metrics.layerRows}
          columns={[
            { key: 'layer', label: 'Layer' },
            { key: 'edges', label: 'Edges', format: (value) => fmtInt(value) },
            { key: 'verified_pct', label: '% Verified', format: (value) => pct(value) },
            { key: 'modelled_pct', label: '% Modelled', format: (value) => pct(value) }
          ]}
        />
        <Table
          title="Top OEMs by verified coverage"
          rows={metrics.oemRows}
          columns={[
            { key: 'oem', label: 'OEM' },
            { key: 'edges', label: 'Edges', format: (value) => fmtInt(value) },
            { key: 'l4', label: 'L4', format: (value) => fmtInt(value) },
            { key: 'l3', label: 'L3', format: (value) => fmtInt(value) },
            { key: 'verified_pct', label: '% Verified', format: (value) => pct(value) }
          ]}
        />
      </div>

      <Table
        title="Missing edge metadata"
        rows={metrics.missingRows}
        columns={[
          { key: 'field', label: 'Field' },
          { key: 'missing', label: 'Missing', format: (value) => fmtInt(value) },
          { key: 'pct', label: '%', format: (value) => pct(value) }
        ]}
        maxHeight={260}
      />
    </div>
  );
}
