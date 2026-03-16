function InfoIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>}
function TrendIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
function AlertIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>}

function Row({ row, icon }) {
  const Icon = icon;
  return (
    <div className="group cursor-pointer rounded-lg border border-border/40 bg-muted/20 p-3.5 transition-all hover:border-blue-500/20 hover:bg-muted/40">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2"><Icon className="size-3 text-blue-500" /><h5 className="truncate text-[13px] font-bold text-foreground transition-colors group-hover:text-blue-500">{row.label}</h5></div>
          <p className="mt-1 truncate text-[11px] leading-relaxed text-muted-foreground">{row.note}</p>
        </div>
        {row.value ? <span className="text-[11px] font-bold uppercase tracking-widest text-blue-500">{row.value}</span> : null}
      </div>
    </div>
  );
}

export default function InsightPanel({ insight }) {
  if (!insight) return null;
  const leftRows = insight.sections?.[0]?.rows || [];
  const rightRows = insight.sections?.[1]?.rows || [];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-8 shadow-inner backdrop-blur-sm transition-all group hover:border-blue-500/20">
      <div className="absolute right-0 top-0 -z-10 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/5 blur-3xl" />
      <div className="mb-8 flex items-center gap-3">
        <div className="size-10 rounded-xl border border-blue-500/20 bg-blue-600/10 flex items-center justify-center"><InfoIcon className="size-5 text-blue-500" /></div>
        <div><h2 className="text-xl font-bold tracking-tight text-foreground">{insight.title}</h2><p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Insight Detail View</p></div>
      </div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div><h4 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><TrendIcon className="size-3" />{insight.sections?.[0]?.title || 'Top Supplier Dependencies'}</h4><div className="space-y-3">{leftRows.slice(0,3).map((row, i)=><Row key={i} row={row} icon={TrendIcon} />)}</div></div>
        <div><h4 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><AlertIcon className="size-3" />{insight.sections?.[1]?.title || 'Platform Dependency Clusters'}</h4><div className="space-y-3">{rightRows.slice(0,3).map((row, i)=><Row key={i} row={row} icon={AlertIcon} />)}</div></div>
      </div>
    </section>
  );
}
