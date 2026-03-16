function HelpIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>}
function InfoIcon(props){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>}

export default function Legend({ items, title='Legend', helpText }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border/40 bg-card/20 p-5 shadow-inner backdrop-blur-sm">
        <h3 className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}<HelpIcon className="size-3 text-muted-foreground/40" /></h3>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              {item.type === 'line' ? <div className="w-6 h-px" style={{ backgroundColor: item.dash ? 'transparent' : item.color, borderTop: item.dash ? `1px dashed ${item.color}` : 'none' }} /> : item.hollow ? <div className="size-2.5 rounded-full border" style={{ borderColor: item.color }} /> : <div className="size-2.5 rounded-full border border-white" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.glow || 'rgba(37,99,235,0.4)'}` }} />}
              <span className="text-[10px] font-bold tracking-tight text-foreground/80">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {helpText ? <div className="rounded-2xl border border-blue-500/20 bg-blue-600/5 p-5 backdrop-blur-sm"><div className="mb-4 flex items-center gap-2"><InfoIcon className="size-4 text-blue-500" /><h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">How to read this</h3></div><p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{helpText}</p></div> : null}
    </div>
  );
}
