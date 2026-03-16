import { fmtInt, sentenceList } from '../lib/utils';

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
      <div className="text-xs uppercase tracking-[0.18em] text-mute">{title}</div>
      {subtitle ? <p className="mt-2 text-sm text-slate-300">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function DealerEcosystemView({ intelligence }) {
  const dealerRows = intelligence.dealerRows.slice(0, 10);
  const consultingRows = intelligence.consultingRows;
  const metrics = intelligence.dealerMetrics;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-4">
        {[
          ['Dealer platform cluster', dealerRows[0]?.label || '—', dealerRows[0] ? `${fmtInt(dealerRows[0].oem_coverage)} OEM groups show this dealer-system dependency.` : 'No dealer-system signal available.'],
          ['Transformation pattern', 'CRM + analytics', 'Dealer improvement usually starts with CRM workflow discipline, demand quality, and inventory intelligence.'],
          ['Commercial focus', 'Retail conversion + aftersales', 'Dealer systems matter because they directly influence throughput, retention, and finance penetration.'],
          ['Consulting leverage', 'Implementation + operating model', 'Consulting firms shape dealer performance through process design, integration, analytics, and journey redesign.']
        ].map(([title, value, detail]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-[0.16em] text-mute">{title}</div>
            <div className="mt-2 text-xl font-semibold text-ink">{value}</div>
            <div className="mt-2 text-sm text-slate-300">{detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card title="Dealer platforms" subtitle="These are the systems closest to dealer throughput, CRM discipline, inventory velocity, and retail conversion.">
          <div className="space-y-3">
            {dealerRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/5 bg-panelAlt/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-ink">{row.label}</div>
                  <div className="text-xs text-accentSoft">{fmtInt(row.oem_coverage)} OEMs</div>
                </div>
                <div className="mt-1 text-sm text-slate-300">{sentenceList(row.layers.slice(0, 2)) || 'Dealer Systems'} · visible in {sentenceList(row.oems.slice(0, 3))}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Consulting / implementation firms" subtitle="This is the enablement layer around dealer performance. These firms usually move outcomes by changing workflows, analytics, and customer operations.">
          <div className="space-y-3">
            {consultingRows.map((row) => (
              <div key={row.firm} className="rounded-xl border border-white/5 bg-panelAlt/80 p-3">
                <div className="font-medium text-ink">{row.firm}</div>
                <div className="mt-1 text-sm text-slate-300">{row.focus}</div>
                <div className="mt-2 text-xs text-accentSoft">Improves: {sentenceList(row.impact)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Operational metrics dealers care about" subtitle="This is the business layer. These are the metrics that make dealer technology and consulting relevant in real commercial terms.">
          <div className="space-y-3">
            {metrics.map((row) => (
              <div key={row.metric} className="rounded-xl border border-white/5 bg-panelAlt/80 p-3">
                <div className="font-medium text-ink">{row.metric}</div>
                <div className="mt-1 text-sm text-slate-300">{row.why}</div>
                <div className="mt-2 text-xs text-accentSoft">Improvement levers: {sentenceList(row.levers)}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card title="Why this matters" subtitle="Dealer transformation is where ecosystem dependencies become visible in commercial outcomes.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            'Dealer platforms influence lead conversion, stock velocity, finance penetration, and aftersales retention.',
            'Consulting firms matter because implementation quality often determines whether CRM, pricing, and retail analytics change behaviour or just add software cost.',
            'Supplier and platform choices ripple into dealer performance through pricing, stock visibility, customer operations, and service journeys.',
            'This is why ecosystem mapping needs to connect technology nodes to revenue, throughput, and operating leverage.'
          ].map((text) => (
            <div key={text} className="rounded-xl border border-white/5 bg-panelAlt/80 p-3 text-sm text-slate-300">{text}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
