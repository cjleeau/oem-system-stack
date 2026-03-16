import { fmtInt, pct, sentenceList } from '../lib/utils';

function DependencyTable({ rows }) {
  return (
    <div className="overflow-auto rounded-2xl border border-white/10 bg-white/5 shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {['Platform', 'Primary layer', 'OEM coverage', 'Score', 'Why it matters'].map((label) => (
              <th key={label} className="border-b border-white/10 bg-panel px-3 py-3 text-left text-xs uppercase tracking-[0.16em] text-mute">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className={index % 2 ? 'bg-white/[0.02]' : ''}>
              <td className="border-b border-white/5 px-3 py-3 text-ink">{row.label}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{row.primary_layer}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{fmtInt(row.oem_coverage)}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{row.concentration_score.toFixed(2)}</td>
              <td className="border-b border-white/5 px-3 py-3 text-slate-300">{row.label} clusters across {fmtInt(row.oem_coverage)} OEM groups and {sentenceList(row.layers.slice(0, 2))}, which makes it systemically important.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlatformDependencyView({ intelligence }) {
  const rows = intelligence.dependencyRows.slice(0, 14);
  const cloudRows = intelligence.cloudRows.slice(0, 5);
  const computeRows = intelligence.computeRows.slice(0, 5);
  const verificationRows = intelligence.verificationByLayer.slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-4">
        {[
          ['Systemic platform', rows[0]?.label || '—', rows[0] ? `${fmtInt(rows[0].oem_coverage)} OEM groups reuse this platform.` : 'No dependency signal available.'],
          ['Cloud dependency cluster', cloudRows[0]?.label || '—', cloudRows[0] ? `${fmtInt(cloudRows[0].oem_coverage)} OEM groups share this cloud dependency.` : 'No cloud dependency visible.'],
          ['Compute dependency cluster', computeRows[0]?.label || '—', computeRows[0] ? `${fmtInt(computeRows[0].oem_coverage)} OEM groups share this compute dependency.` : 'No compute dependency visible.'],
          ['Strongest verified layer', verificationRows[0]?.layer || '—', verificationRows[0] ? `${pct(verificationRows[0].verified_density)} of visible edges in this layer are L3+ / verified.` : 'No layer verification signal visible.']
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
          <div className="text-xs uppercase tracking-[0.18em] text-mute">Cross-OEM platform dependency</div>
          <p className="mt-2 text-sm text-slate-300">This view turns repeated cloud, compute, operating system, telematics, and ADAS platforms into dependency rankings. It highlights where a small number of vendors can shape architectural direction across the market.</p>
          <div className="mt-4"><DependencyTable rows={rows} /></div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-mute">Where drift can occur</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>AWS, Mobileye, Qualcomm, NVIDIA, and similar platforms matter because they create common stack dependencies.</li>
              <li>Common dependency clusters tell strategy teams where systemic switching costs accumulate.</li>
              <li>Shared platforms compress optionality and amplify supplier bargaining power.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-mute">Verification density by layer</div>
            <div className="mt-4 space-y-3">
              {verificationRows.map((row) => (
                <div key={row.layer}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{row.layer}</span>
                    <span className="text-mute">{pct(row.verified_density)} verified</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(6, row.verified_density * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
