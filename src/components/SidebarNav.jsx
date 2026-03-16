import { VIEWS } from '../lib/constants';

function Icon({ kind, className = 'size-[18px]' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  switch (kind) {
    case 'grid':
      return (
        <svg {...common}>
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      );
    case 'network':
      return (
        <svg {...common}>
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
          <path d="M12 12V8" />
        </svg>
      );
    case 'architecture':
      return (
        <svg {...common}>
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />
        </svg>
      );
    case 'supplier':
      return (
        <svg {...common}>
          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
          <path d="M12 22V12" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <path d="m7.5 4.27 9 5.15" />
        </svg>
      );
    case 'platform':
      return (
        <svg {...common}>
          <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
          <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
          <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
        </svg>
      );
    case 'dealer':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'governance':
      return (
        <svg {...common}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      );
  }
}

const DISABLED_VIEWS = new Set(['supplier', 'platform', 'dealer']);

export default function SidebarNav({ activeView, onChange }) {
  return (
    <aside className="hidden h-full w-[256px] shrink-0 border-r border-[#262626] bg-[#0A0A0A] lg:flex lg:flex-col">
      <div className="border-b border-[#262626] px-5 py-5">
        <div className="group flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-110">
            <Icon kind="network" className="size-5 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Automotive Intelligence</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">OEM System Stack</div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-4 py-4">
        {VIEWS.map((view) => {
          const disabled = DISABLED_VIEWS.has(view.key);
          const active = activeView === view.key;

          return (
            <button
              key={view.key}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(view.key);
              }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                disabled
                  ? 'cursor-not-allowed text-muted-foreground/35'
                  : active
                    ? 'bg-blue-600/10 font-bold text-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]'
                    : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
              }`}
            >
              <Icon
                kind={view.key}
                className={`size-[18px] transition-colors ${
                  disabled
                    ? 'text-muted-foreground/35'
                    : active
                      ? 'text-blue-500'
                      : 'text-muted-foreground group-hover:text-foreground'
                }`}
              />
              <span className="text-[13px] tracking-tight">{view.label}</span>
              {active && !disabled ? (
                <div className="ml-auto size-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}