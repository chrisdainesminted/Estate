// Daily listings for one market (Thunder Bay): the facts the morning run
// saves for each property, how Bedrock turns one into a deal, and how the
// list is ranked. Pure functions, shared by the page and the run's scripts.

import { DEFAULT_TARGETS, analyzeDeal, maxOffer } from './finance.js';
import { DEFAULT_DEAL, UNIT_TYPES } from './presets.js';
import { safeHttpUrl } from './format.js';

/** Where the run saves the feed: data/users/<id>/<doc> in the page's database. */
export const MARKET = { city: 'Thunder Bay', region: 'ON', doc: 'thunderbay' };

export const LISTING_TYPES = [
  { key: 'single', label: 'Single-family' },
  { key: 'small', label: '2–4 units' },
  { key: 'large', label: '5+ units' },
];

export const typeOf = (units) => (units >= 5 ? 'large' : units >= 2 ? 'small' : 'single');

/** A home must carry at least this much insurance a year, however few units. */
export const INSURANCE_MIN = 1500;

/**
 * How listings are underwritten. Listings rarely give everything, so these
 * fill the gaps: financing, costs, and market rents by bedroom count for
 * units without a stated rent. Editable on the Listings tab.
 */
export const DEFAULT_MARKET = {
  downPct: 20,
  rate: 4.9, // 5-year fixed, uninsured rental mortgage
  amortYears: 30,
  closingPct: 1, // legal, title, inspection; land transfer tax is added on top
  insurancePerUnit: 800, // $ a year per unit, at least INSURANCE_MIN
  utilitiesPerUnit: 50, // $ a month per unit the owner pays (water, shared heat) in 2+ unit buildings
  taxPct: 0.9, // property tax as % of price, only when a listing doesn't say
  mgmtPct: 8,
  maintPct: 6,
  vacancyPct: 4,
  capexPct: 7,
  rents: { 0: 1050, 1: 1350, 2: 1700, 3: 2000, 4: 2300 }, // $/mo by bedrooms (4 = 4+)
  types: ['single', 'small', 'large'],
  hidden: [],
};

export function normalizeMarket(m) {
  const rents = { ...DEFAULT_MARKET.rents };
  for (const k of Object.keys(rents)) if (Number(m?.rents?.[k]) > 0) rents[k] = Number(m.rents[k]);
  return {
    ...DEFAULT_MARKET,
    ...(m ?? {}),
    rents,
    types: Array.isArray(m?.types) ? m.types.filter((t) => LISTING_TYPES.some((x) => x.key === t)) : DEFAULT_MARKET.types,
    hidden: Array.isArray(m?.hidden) ? m.hidden.filter((x) => typeof x === 'string') : [],
  };
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const positive = (v) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const bedrooms = (v) => {
  const n = Math.round(Number(v));
  return v !== null && v !== '' && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};

const ABBREVIATIONS = [
  [/\bstreet\b/g, 'st'],
  [/\bavenue\b/g, 'ave'],
  [/\broad\b/g, 'rd'],
  [/\bdrive\b/g, 'dr'],
  [/\bcrescent\b/g, 'cres'],
  [/\bboulevard\b/g, 'blvd'],
  [/\bplace\b/g, 'pl'],
  [/\bcourt\b/g, 'crt'],
  [/\bnorth\b/g, 'n'],
  [/\bsouth\b/g, 's'],
  [/\beast\b/g, 'e'],
  [/\bwest\b/g, 'w'],
];

/** A normalized street address, so the same property matches across days and sites. */
export function addressKey(address) {
  let s = text(address, 300)
    .toLowerCase()
    .replace(/,.*$/, '')
    .replace(/[^a-z0-9 ]/g, ' ');
  for (const [re, short] of ABBREVIATIONS) s = s.replace(re, short);
  return s.replace(/\s+/g, ' ').trim();
}

const STATUSES = ['active', 'conditional', 'sold'];

/** Check one listing as the run reported it; null when it has no address or price. */
export function cleanListing(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const address = text(raw.address, 120);
  const price = positive(raw.price);
  if (!address || !price || price < 10000) return null;
  const units = Math.min(Math.max(Math.round(positive(raw.units) ?? 1), 1), 500);
  const perUnit = (arr, fn) => (Array.isArray(arr) && arr.length ? arr.slice(0, units).map(fn) : null);
  // A single bedroom count means every unit has that many.
  const beds = typeof raw.beds === 'number' ? Array(units).fill(raw.beds) : raw.beds;
  const mls = text(raw.mls, 24).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const year = Math.round(Number(raw.yearBuilt));
  return {
    id: mls || `addr-${addressKey(address).replace(/ /g, '-')}`,
    mls: mls || null,
    address,
    url: safeHttpUrl(raw.url),
    source: text(raw.source, 60) || null,
    units,
    beds: perUnit(beds, bedrooms),
    rents: perUnit(raw.rents, positive),
    grossRent: positive(raw.grossRent),
    price,
    taxes: positive(raw.taxes),
    yearBuilt: year >= 1800 && year <= 2100 ? year : null,
    highlights: text(raw.highlights, 220),
    status: STATUSES.includes(raw.status) ? raw.status : 'active',
  };
}

/**
 * Monthly rent for the whole property: the listing's stated rents where it
 * gives them (a stated total wins), the rent table by bedrooms elsewhere.
 * Unknown bedroom counts assume 3 for a house, 2 per unit in a 2–4 unit
 * building and 1 in larger buildings, which are mostly one-bedrooms.
 */
export function listingRent(listing, market) {
  const m = normalizeMarket(market);
  const units = Math.max(Math.round(Number(listing.units) || 1), 1);
  if (positive(listing.grossRent)) return { total: Number(listing.grossRent), source: 'stated' };
  let total = 0;
  let stated = 0;
  for (let i = 0; i < units; i++) {
    const rent = positive(listing.rents?.[i]);
    if (rent) {
      total += rent;
      stated += 1;
      continue;
    }
    const beds = bedrooms(listing.beds?.[i]) ?? (units === 1 ? 3 : units <= 4 ? 2 : 1);
    total += m.rents[Math.min(beds, 4)];
  }
  return { total, source: stated === 0 ? 'estimated' : stated === units ? 'stated' : 'mixed' };
}

/** The deal a listing becomes under Ontario rules and your listing assumptions. */
export function listingToDeal(listing, market) {
  const m = normalizeMarket(market);
  const units = Math.max(Math.round(Number(listing.units) || 1), 1);
  const price = Number(listing.price) || 0;
  const rent = listingRent(listing, m);
  const unitType = UNIT_TYPES.find((t) => t.units === units && t.key !== 'multiplex')?.key ?? 'multiplex';
  const rentNote = { stated: 'Rents as listed.', mixed: 'Some rents estimated from your rent table.', estimated: 'Rents estimated from your rent table.' }[rent.source];
  return {
    ...DEFAULT_DEAL,
    name: listing.address,
    country: 'ca',
    price,
    downPct: m.downPct,
    rate: m.rate,
    termYears: m.amortYears,
    closingPct: m.closingPct,
    unitType,
    units,
    rentPerUnit: Math.round(rent.total / units),
    taxesAnnual: Math.round(positive(listing.taxes) ?? (price * m.taxPct) / 100),
    insuranceAnnual: Math.max(m.insurancePerUnit * units, INSURANCE_MIN),
    // Owner-paid utilities ride in the monthly fixed costs, as Canadian lenders count heat.
    hoaMonthly: units >= 2 ? m.utilitiesPerUnit * units : 0,
    mgmtPct: m.mgmtPct,
    maintPct: m.maintPct,
    vacancyPct: m.vacancyPct,
    capexPct: m.capexPct,
    refiRate: m.rate,
    address: listing.address,
    listingUrl: listing.url || '',
    notes: [listing.highlights, rentNote, listing.mls && `MLS® ${listing.mls}.`].filter(Boolean).join(' '),
    listingId: listing.id,
  };
}

/** Price cut in the most recent move, or 0. */
export function priceDrop(listing) {
  const h = Array.isArray(listing.priceHistory) ? listing.priceHistory : [];
  const prev = h.length > 1 ? Number(h[h.length - 2].price) : 0;
  return prev > listing.price ? prev - listing.price : 0;
}

/** One listing run through the engine: cash flow per door, max offer, and whether it beats every target. */
export function scoreListing(listing, market, targets = DEFAULT_TARGETS) {
  const deal = listingToDeal(listing, market);
  const a = analyzeDeal(deal);
  const offer = maxOffer(deal, targets);
  return {
    listing,
    deal,
    a,
    offer,
    perDoor: a.netCashFlow / a.units,
    meets: offer.price == null ? a.netCashFlow > 0 : offer.price >= a.price,
    rentSource: listingRent(listing, market).source,
    taxesEstimated: !positive(listing.taxes),
    drop: priceDrop(listing),
  };
}

const room = (s) => (Number.isFinite(s.offer.price) ? s.offer.price - s.a.price : s.offer.price == null ? -Infinity : Infinity);

export const SORTS = {
  perDoor: { label: 'Cash flow per door', compare: (x, y) => y.perDoor - x.perDoor },
  coc: { label: 'Cash-on-cash', compare: (x, y) => y.a.coc - x.a.coc },
  room: { label: 'Room to negotiate', compare: (x, y) => room(y) - room(x) },
  price: { label: 'Lowest price', compare: (x, y) => x.a.price - y.a.price },
  newest: { label: 'Newest', compare: (x, y) => String(y.listing.firstSeen ?? '').localeCompare(String(x.listing.firstSeen ?? '')) },
};

/** Active listings of the chosen types, scored and sorted (cash flow per door breaks ties). */
export function rankListings(listings, market, targets, { types, hidden, showHidden = false, onlyMeets = false, sort = 'perDoor' } = {}) {
  const m = normalizeMarket(market);
  const want = new Set(types ?? m.types);
  const hide = new Set(hidden ?? m.hidden);
  const order = (SORTS[sort] ?? SORTS.perDoor).compare;
  return (Array.isArray(listings) ? listings : [])
    .filter((l) => (l.status ?? 'active') === 'active' && want.has(typeOf(l.units)) && (showHidden || !hide.has(l.id)))
    .map((l) => scoreListing(l, m, targets))
    .filter((s) => !onlyMeets || s.meets)
    .sort((x, y) => order(x, y) || y.perDoor - x.perDoor);
}

/** New in the latest run, or cut in price by it. */
export const isNew = (listing, feed) => !!feed?.lastRun?.date && listing.firstSeen === feed.lastRun.date;
export const droppedInLatestRun = (listing, feed) => priceDrop(listing) > 0 && listing.priceHistory?.at(-1)?.date === feed?.lastRun?.date;

/** What the morning alert is about: listings that beat every target and are new or cheaper today. */
export function standouts(feed, market, targets) {
  return rankListings(feed?.listings, market, targets, { onlyMeets: true }).filter((s) => isNew(s.listing, feed) || droppedInLatestRun(s.listing, feed));
}

const addDays = (isoDate, n) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Fold one run's findings into the saved feed. A listing seen again keeps
 * its first-seen date and gains a price-history entry if its price moved;
 * fields the run didn't find never erase known ones. Search misses
 * listings on some days, so one is dropped only after `keepDays` unseen,
 * or as soon as a run reports it sold.
 */
export function mergeFeed(prev, found, { today, now = Date.now(), keepDays = 21, note = '' } = {}) {
  const old = Array.isArray(prev?.listings) ? prev.listings : [];
  const merged = new Map(old.map((l) => [l.id, { ...l }]));
  const byAddress = new Map(old.map((l) => [addressKey(l.address), l.id]));
  const stats = { found: 0, added: 0, seenAgain: 0, priceDrops: 0, priceRises: 0, removed: 0 };

  for (const raw of Array.isArray(found) ? found : []) {
    const f = cleanListing(raw);
    if (!f) continue;
    stats.found += 1;
    const id = merged.has(f.id) ? f.id : byAddress.get(addressKey(f.address));
    if (id) {
      const cur = merged.get(id);
      const history = Array.isArray(cur.priceHistory) && cur.priceHistory.length ? [...cur.priceHistory] : [{ date: cur.firstSeen ?? today, price: cur.price }];
      if (f.price !== cur.price) {
        history.push({ date: today, price: f.price });
        if (f.price < cur.price) stats.priceDrops += 1;
        else stats.priceRises += 1;
      }
      const known = Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.every((x) => x == null))));
      merged.set(id, { ...cur, ...known, id, mls: cur.mls ?? f.mls, firstSeen: cur.firstSeen ?? today, lastSeen: today, priceHistory: history.slice(-12) });
      stats.seenAgain += 1;
    } else {
      merged.set(f.id, { ...f, firstSeen: today, lastSeen: today, priceHistory: [{ date: today, price: f.price }] });
      byAddress.set(addressKey(f.address), f.id);
      stats.added += 1;
    }
  }

  const cutoff = addDays(today, -keepDays);
  const listings = [...merged.values()].filter((l) => {
    const keep = String(l.lastSeen ?? today) >= cutoff && l.status !== 'sold';
    if (!keep) stats.removed += 1;
    return keep;
  });
  const run = { date: today, at: now, ...stats, note: text(note, 200) };
  return {
    feed: {
      schema: 1,
      city: `${MARKET.city}, ${MARKET.region}`,
      updatedAt: now,
      lastRun: run,
      runs: [...(Array.isArray(prev?.runs) ? prev.runs : []), run].slice(-14),
      listings,
    },
    stats,
  };
}
