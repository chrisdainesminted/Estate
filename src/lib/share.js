// Share a deal by link. The deal's inputs ride in the link's #fragment,
// which browsers never send to a server, and only the ones that differ
// from a new deal are included. Opening a link checks every field before
// anything is saved.

import { PREPAY_SCHEDULES } from './finance.js';
import { safeHttpUrl } from './format.js';
import { DEFAULT_DEAL, UNIT_TYPES } from './presets.js';

/** Links always open the public website, whoever shares them and from where. */
export const SITE_URL = 'https://bedrock.signia83.workers.dev/';

// Left out when someone shares without the property's details.
const DETAILS = ['address', 'listingUrl', 'notes'];
const TEXT_MAX = { name: 120, address: 200, listingUrl: 500, notes: 2000 };
const ENUMS = {
  country: ['us', 'ca'],
  status: ['prospect', 'owned'],
  unitType: UNIT_TYPES.map((t) => t.key),
  prepay: ['none', ...Object.keys(PREPAY_SCHEDULES)],
};
// Growth rates may be negative; every other number is zero or more.
const SIGNED = new Set(['appreciationPct', 'rentGrowthPct', 'expenseGrowthPct']);
const NUMBER_MAX = 1e9;

function encode(text) {
  let bin = '';
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Whether a deal has an address, listing link or notes to leave out. */
export const hasDetails = (deal) => DETAILS.some((k) => String(deal[k] ?? '').trim());

/**
 * The link for a deal. Without `withDetails` it leaves out the address,
 * listing link and notes. A copy of a shared deal keeps the original's
 * share id, so passing a link along never adds the same deal twice.
 */
export function shareLink(deal, { withDetails = true } = {}) {
  const d = { name: deal.name };
  for (const [k, def] of Object.entries(DEFAULT_DEAL)) {
    if (k === 'name' || (!withDetails && DETAILS.includes(k))) continue;
    if (deal[k] !== undefined && deal[k] !== def) d[k] = deal[k];
  }
  return `${SITE_URL}#deal=${encode(JSON.stringify({ v: 1, s: deal.sharedId || deal.id, d }))}`;
}

function clean(k, v) {
  const def = DEFAULT_DEAL[k];
  if (ENUMS[k]) return ENUMS[k].includes(v) ? v : undefined;
  if (typeof def === 'number') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    return Math.min(SIGNED.has(k) ? v : Math.max(v, 0), NUMBER_MAX);
  }
  if (typeof def === 'boolean') return typeof v === 'boolean' ? v : undefined;
  if (typeof def === 'string' && typeof v === 'string') {
    const text = v.slice(0, TEXT_MAX[k] ?? 200);
    return k === 'listingUrl' && text && !safeHttpUrl(text) ? undefined : text;
  }
  return undefined;
}

/**
 * The deal in a shared link's #fragment, as { fields, sharedId }, with
 * every field checked: unknown ones dropped, numbers kept finite, text
 * trimmed to length, choices kept to the ones the app knows. Null when
 * the fragment isn't a deal link.
 */
export function readShared(hash) {
  const m = /^#deal=([A-Za-z0-9_-]{1,20000})$/.exec(hash || '');
  if (!m) return null;
  let payload;
  try {
    payload = JSON.parse(decode(m[1]));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1 || !payload.d || typeof payload.d !== 'object' || Array.isArray(payload.d)) return null;
  const fields = {};
  for (const [k, v] of Object.entries(payload.d)) {
    if (!Object.hasOwn(DEFAULT_DEAL, k)) continue;
    const ok = clean(k, v);
    if (ok !== undefined) fields[k] = ok;
  }
  // The unit count has to agree with the property type.
  const type = UNIT_TYPES.find((t) => t.key === (fields.unitType ?? DEFAULT_DEAL.unitType));
  fields.units = type.key === 'multiplex' ? Math.min(Math.max(Math.round(fields.units ?? type.units), 5), 500) : type.units;
  if (!fields.name?.trim()) fields.name = 'Shared deal';
  const sharedId = typeof payload.s === 'string' && /^[\w-]{1,64}$/.test(payload.s) ? payload.s : null;
  return { fields, sharedId };
}

/** Whether a saved deal already holds exactly these shared fields. */
export const sameDeal = (deal, fields) => Object.entries(fields).every(([k, v]) => (deal[k] ?? DEFAULT_DEAL[k]) === v);
