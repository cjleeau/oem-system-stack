import { fmtInt, pct, sentenceList } from '../lib/utils';

function Bar({ value }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/5">
      <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(8, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

function Table({ rows }) {
  return (
    <div className="overflow-auto rounded-2xl border border-white/10 bg-white/5 shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {['Supplier', 'Type', 'OEM coverage', 'Verification density', 'Layers', 'Where drift can occur'].map((label) => (
              <th key={label} className="border-b border-white/10 bg-panel px-3 py-3 text-left text-xs uppercase tracking-[0.16em] text-mute">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className={index % 2 ? 'bg-white/[0.02]' : ''}>
              <td className="border-b border-white/5 px-3 py-3 text-ink">{row.label}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{row.node_type || '—'}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">
                <div className="min-w-[160px] space-y-2">
                  <div className="flex items-center justify-between gap-3"><span>{fmtInt(row.oem_coverage)}</span><span className="text-xs text-mute">{pct(row.oem_coverage / Math.max(1, rows[0]?.oem_coverage || 1))}</span></div>
                  <Bar value={row.oem_coverage / Math.max(1, rows[0]?.oem_coverage || 1)} />
                </div>
              </td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{pct(row.verification_density)}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{sentenceList(row.layers.slice(0, 3))}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">
                {row.label} appears across {fmtInt(row.oem_coverage)} OEM groups, which makes it a concentration signal rather than an isolated dependency.
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SupplierConcentrationView({ intelligence }) {
  const topSuppliers = intelligence.supplierRows.slice(0, 12);
  const layerRows = intelligence.layerConcentration.slice(0, 8);
  const adasRows = intelligence.adasRows.slice(0, 6);
  const cloudRows = intelligence.cloudRows.slice(0, 6);
  const computeRows = intelligence.computeRows.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-4">
        {[
          ['Supplier concentration', topSuppliers[0] ? `${topSuppliers[0].label}` : '—', topSuppliers[0] ? `${fmtInt(topSuppliers[0].oem_coverage)} OEM groups currently depend on this supplier.` : 'No visible supplier concentration.'],
          ['ADAS concentration', adasRows[0] ? adasRows[0].label : '—', adasRows[0] ? `ADAS reuse is strongest across ${fmtInt(adasRows[0].oem_coverage)} OEM groups.` : 'No ADAS supplier cluster visible.'],
          ['Cloud concentration', cloudRows[0] ? cloudRows[0].label : '—', cloudRows[0] ? `${fmtInt(cloudRows[0].oem_coverage)} OEM groups rely on the leading cloud platform.` : 'No cloud concentration visible.'],
          ['Compute concentration', computeRows[0] ? computeRows[0].label : '—', computeRows[0] ? `Compute stack concentration reaches ${fmtInt(computeRows[0].oem_coverage)} OEM groups.` : 'No compute concentration visible.']
        ].map(([title, value, detail]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-[0.16em] text-mute">{title}</div>
            <div className="mt-2 text-xl font-semibold text-ink">{value}</div>
            <div className="mt-2 text-sm text-slate-300">{detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
          <div className="text-xs uppercase tracking-[0.18em] text-mute">Top suppliers by OEM coverage</div>
          <p className="mt-2 text-sm text-slate-300">This view answers where supplier reuse is broad enough to create ecosystem concentration risk. Higher OEM coverage means switching costs, common failure modes, and bargaining power all rise together.</p>
          <div className="mt-4"><Table rows={topSuppliers} /></div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-mute">Most concentrated layers</div>
            <div className="mt-4 space-y-3">
              {layerRows.map((row) => (
                <div key={row.layer}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{row.layer}</span>
                    <span className="text-mute">{row.averageCoverage.toFixed(1)} avg OEMs / supplier</span>
                  </div>
                  <Bar value={row.averageCoverage / Math.max(1, layerRows[0]?.averageCoverage || 1)} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-mute">Where drift can occur</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>High supplier reuse means common dependency risk across multiple OEM stacks.</li>
              <li>ADAS, compute, and cloud concentration reveal where substitution is hardest.</li>
              <li>Evidence density helps separate hard ecosystem signal from modelled noise.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
