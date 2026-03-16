function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-full border px-3 py-2 transition ${
        disabled
          ? 'cursor-not-allowed border-border/40 bg-muted/20 text-muted-foreground/35'
          : checked
            ? 'border-blue-500/30 bg-blue-500/12 text-foreground'
            : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-white/16 hover:text-foreground'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3 w-3 rounded border border-white/20 bg-transparent accent-blue-500"
      />
      <span className="text-[11px] font-medium leading-[16.5px] tracking-[-0.275px]">{label}</span>
    </label>
  );
}

function RotateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export default function ToggleBar({ state, onChange, onReset }) {
  const architectureOnly = state.view !== 'architecture';

  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        <Toggle
          label="Telemetry Paths Only"
          checked={state.telemetryOnly}
          onChange={(value) => onChange('telemetryOnly', value)}
        />
        <Toggle
          label="Evidence Only (L3+)"
          checked={state.evidenceOnly}
          onChange={(value) => onChange('evidenceOnly', value)}
        />
        <Toggle
          label="Adjacent Architecture Links"
          checked={state.archAdjacentOnly}
          disabled={architectureOnly}
          onChange={(value) => onChange('archAdjacentOnly', value)}
        />
        <Toggle
          label="Supplier Emphasis"
          checked={state.archSupplierFocus}
          disabled={architectureOnly}
          onChange={(value) => onChange('archSupplierFocus', value)}
        />
        <Toggle
          label="Tight Architecture Lanes"
          checked={state.archTight}
          disabled={architectureOnly}
          onChange={(value) => onChange('archTight', value)}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-blue-500"
      >
        <RotateIcon className="size-3.5" />
        Reset All
      </button>
    </section>
  );
}