import { displayConfidence, displayRegion, safe } from '../lib/utils';

function labelFor(field, value) {
  if (field === 'region') return displayRegion(value);
  if (field === 'confidence') return displayConfidence(value);
  return safe(value);
}

function Chevron(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex min-w-[140px] flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ label, field, value, options, onChange }) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-border/60 bg-muted/40 px-3 pr-10 text-xs font-medium text-foreground outline-none transition focus:border-blue-500/40"
        >
          <option value="all">All</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={!option.enabled}>
              {labelFor(field, option.value)}
            </option>
          ))}
        </select>
        <Chevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </Field>
  );
}

function SearchField({ value, onChange }) {
  return (
    <Field label="Search">
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Denso, BMW, Qualcomm..."
        className="h-10 w-full rounded-md border border-border/60 bg-muted/40 px-3 text-xs font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-500/40"
      />
    </Field>
  );
}

export default function Filters({ state, options, onChange }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SelectField field="region" label="Region" value={state.region} options={options.regions} onChange={(value) => onChange('region', value)} />
        <SelectField field="oem" label="OEM Group" value={state.oem} options={options.oems} onChange={(value) => onChange('oem', value)} />
        <SelectField field="layer" label="Layer" value={state.layer} options={options.layers} onChange={(value) => onChange('layer', value)} />
        <SelectField field="type" label="Type" value={state.type} options={options.types} onChange={(value) => onChange('type', value)} />
        <SelectField field="confidence" label="Confidence" value={state.confidence} options={options.confidences} onChange={(value) => onChange('confidence', value)} />
        <SearchField value={state.search} onChange={(value) => onChange('search', value)} />
      </div>
    </section>
  );
}