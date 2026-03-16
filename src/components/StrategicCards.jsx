function Icon({ kind, className = 'size-5' }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'cpu') return <svg {...common}><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>;
  return <svg {...common}><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" /><path d="M12 12V8" /></svg>;
}
function GithubIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>}
function ChevronRight(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6" /></svg>}

export default function StrategicCards({ cards }) {
  if (!cards?.length) return null;
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="p-5 bg-card/40 border border-border/60 rounded-xl flex flex-col justify-between transition-all hover:border-blue-500/30 group backdrop-blur-sm min-h-[169.5px] shadow-inner">
          <div className="mb-4 flex items-start justify-between">
            <div className="size-10 rounded-lg flex items-center justify-center border border-border/40 bg-muted/60 transition-colors group-hover:border-blue-500/20 group-hover:bg-blue-500/5">
              <Icon kind="metric" className="size-5 text-muted-foreground transition-colors group-hover:text-blue-500" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">{card.title}</p>
            <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-blue-500">{card.value}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
          </div>
        </div>
      ))}
      <div className="relative min-h-[169.5px] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 transition-all hover:shadow-lg hover:shadow-blue-500/20 group flex flex-col justify-between">
        <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-20 transition-transform group-hover:scale-110"><Icon kind="cpu" className="size-16 text-white" /></div>
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-100">Research Roadmap</p>
          <h3 className="mb-2 text-lg font-black tracking-tight text-white">Resources</h3>
          <p className="mb-4 text-[11px] font-medium leading-relaxed text-blue-100">It is actively evolving.</p>
        </div>
        <a href="https://github.com/users/cjleeau/projects/1/views/4" target="_blank" rel="noreferrer" className="self-start flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-50"><GithubIcon className="size-3" />Roadmap<ChevronRight className="size-3" /></a>
      </div>
    </section>
  );
}
