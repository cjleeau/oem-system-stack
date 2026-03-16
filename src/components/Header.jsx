function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function Header({ searchValue = '', onSearchChange = () => {} }) {
  return (
    <header className="sticky top-0 z-50 h-20 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
      <div className="flex h-full items-center justify-between px-6 lg:px-8">
        <div className="w-10 h-10" />

        <div className="absolute left-1/2 w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2 transition-all duration-500">
          <div className="group relative">
            <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search telemetry, nodes, or layers..."
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/60 focus:border-blue-500/40 focus:bg-white/10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-muted-foreground">⌘K</div>
          </div>
        </div>

        <div className="w-10 h-10" />
      </div>
    </header>
  );
}
