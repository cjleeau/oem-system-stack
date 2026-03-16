# Methodology

This product keeps the original CSV workflow intact. Data continues to load from:

- `public/data/nodes.csv`
- `public/data/edges.csv`

## Supported compatibility fields

The migration safely supports:

- `relation` or `relationship`
- `node_type` or `type`
- `evidence_status`
- `verification_level`
- `provenance_id`
- `confidence`
- `control_boundary`
- `notes`
- `oem_group`
- `layer`
- `region`

## Evidence model

- **L4** = OEM-primary or direct primary evidence
- **L3** = public-indirect evidence such as supplier releases or reputable public announcements
- **L2** = trade-source or secondary technical evidence
- **L1** = modelled or inferred
- **L0** = missing or placeholder

