export const LAYERS = [
  'Ownership & Brand Stack',
  'Tier-1 Hardware Suppliers',
  'Battery & Cell Suppliers',
  'Semiconductor & Compute',
  'Vehicle OS & Middleware',
  'OTA & Software Update Infrastructure',
  'Telematics & TCU',
  'Connectivity Providers',
  'Cloud Infrastructure',
  'Streaming & Data Lake',
  'Data Governance & Sovereignty',
  'AI / Analytics',
  'Product APIs',
  'Dealer Systems',
  'Finance & Insurance',
  'External Insurance & Risk Ecosystem',
  'Fleet & Enterprise Integrations',
  'Regulators',
  'Energy & Charging',
  'ADAS & Mapping'
];

export const VIEWS = [
  { key: 'grid', label: 'Grid' },
  { key: 'network', label: 'Network' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'platform', label: 'Platform' },
  { key: 'dealer', label: 'Dealer' },
  { key: 'governance', label: 'Governance' },
  { key: 'docs', label: 'Docs' }
];

export const TELEMETRY_RELATIONS = new Set([
  'ROUTES DATA',
  'INGESTS',
  'STREAMS',
  'STORES',
  'PROCESSES',
  'EXPOSES DATA',
  'HOSTS TELEMETRY',
  'DATA LOCALIZATION REQUIRED',
  'MANDATORY REPORTING',
  'TRANSFERS DATA'
]);

export const REGION_ORDER = ['global', 'china', 'europe', 'india', 'japan', 'korea', 'latam', 'sea', 'us'];
export const REGION_LABELS = {
  global: 'Global',
  china: 'China',
  europe: 'Europe',
  india: 'India',
  japan: 'Japan',
  korea: 'Korea',
  latam: 'LATAM',
  sea: 'SEA',
  us: 'US'
};

export const CONFIDENCE_ORDER = ['hard', 'medium', 'soft'];
export const CONFIDENCE_LABELS = {
  hard: 'Hard',
  medium: 'Medium',
  soft: 'Soft'
};

export const DEFAULT_STATE = {
  view: 'grid',
  region: 'all',
  oem: 'all',
  layer: 'all',
  type: 'all',
  confidence: 'all',
  search: '',
  telemetryOnly: false,
  evidenceOnly: false,
  archAdjacentOnly: true,
  archSupplierFocus: false,
  archTight: false,
  selectedNodeId: null
};
