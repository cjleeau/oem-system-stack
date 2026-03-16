import { CONFIDENCE_LABELS, CONFIDENCE_ORDER, REGION_LABELS, REGION_ORDER } from './constants';

export const safe = (value) => (value ?? '').toString().trim();
export const norm = (value) => safe(value).toLowerCase();
export const uniq = (items) => [...new Set(items.map((item) => safe(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
export const intl = new Intl.NumberFormat('en-US');
export const fmtInt = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? intl.format(number) : safe(value);
};
export const parseLevel = (value) => {
  const number = Number(safe(value));
  if (Number.isFinite(number)) return number;
  return 0;
};
export const pct = (value) => `${Math.round((value || 0) * 1000) / 10}%`;
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const titleCase = (value) => safe(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

export function displayRegion(value) {
  return REGION_LABELS[norm(value)] || titleCase(value);
}

export function displayConfidence(value) {
  return CONFIDENCE_LABELS[norm(value)] || titleCase(value);
}

export function compareRegion(a, b) {
  const ia = REGION_ORDER.indexOf(norm(a));
  const ib = REGION_ORDER.indexOf(norm(b));
  if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 999) - (ib >= 0 ? ib : 999);
  return safe(a).localeCompare(safe(b));
}

export function compareConfidence(a, b) {
  const ia = CONFIDENCE_ORDER.indexOf(norm(a));
  const ib = CONFIDENCE_ORDER.indexOf(norm(b));
  if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 999) - (ib >= 0 ? ib : 999);
  return safe(a).localeCompare(safe(b));
}

export function sentenceList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}
