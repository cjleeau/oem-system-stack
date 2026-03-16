import { clamp, displayConfidence, displayRegion, safe } from '../lib/utils';

function Row({ label, value }) {
  if (!safe(value)) return null;
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <div className="text-slate-400">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}

export default function Tooltip({ tooltip }) {
  if (!tooltip.visible || !tooltip.data) return null;

  const left = clamp(tooltip.x + 14, 12, (typeof window !== 'undefined' ? window.innerWidth : 1600) - 340);
  const top = clamp(tooltip.y + 14, 12, (typeof window !== 'undefined' ? window.innerHeight : 900) - 280);
  const datum = tooltip.data;

  return (
    <div
      className="pointer-events-none fixed z-50 w-[320px] rounded-2xl border border-white/10 bg-[#0f1622]/95 p-4 text-xs shadow-panel backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-3 text-sm font-semibold text-ink">{datum.label || datum.id || 'Relationship'}</div>
      <div className="space-y-1.5">
        <Row label="Region" value={displayRegion(datum.region)} />
        <Row label="Layer" value={datum.layer} />
        <Row label="Type" value={datum.node_type || datum.type} />
        <Row label="Boundary" value={datum.control_boundary} />
        <Row label="Confidence" value={displayConfidence(datum.confidence)} />
        <Row label="OEM" value={datum.oem_group} />
        <Row label="Relation" value={datum.relation || datum.relationship} />
        <Row label="Evidence status" value={datum.evidence_status} />
        <Row label="Verification" value={datum.verification_level} />
        <Row label="Source" value={datum.source_name} />
        <Row label="Date" value={datum.source_date} />
        <Row label="Evidence note" value={datum.evidence_note || datum.notes} />
      </div>
    </div>
  );
}
