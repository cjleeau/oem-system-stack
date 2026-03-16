import { VIEWS } from '../lib/constants';

export default function Tabs({ activeView, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VIEWS.map((view) => (
        <button
          key={view.key}
          type="button"
          onClick={() => onChange(view.key)}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            activeView === view.key
              ? 'border-accent bg-accent/15 text-ink shadow-card'
              : 'border-white/10 bg-white/5 text-mute hover:border-white/20 hover:text-ink'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
