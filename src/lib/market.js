// Daily listings for cities across Canada: the facts the morning run saves
// for each property, how Squarely turns one into a deal, and how the list is
// ranked. Pure functions, shared by the page and the run's scripts.

import { isCondo } from './condo.js';
import { DEFAULT_TARGETS, allCash, analyzeDeal, maxOffer, ownMoney } from './finance.js';
import { DEFAULT_DEAL, UNIT_TYPES } from './presets.js';
import { safeHttpUrl } from './format.js';
import { CITIES, cityByKey } from './canada.js';

/** Where the run saves the feed: data/users/<id>/<doc> in the page's database. */
export const MARKET = { city: 'Thunder Bay', region: 'ON', doc: 'thunderbay' };

/** The city the listing assumptions are set for, and the one shown first. */
export const HOME_MARKET = 'thunder-bay';

/** Cities the morning run covers: every named city (not the "elsewhere" entries). */
export const LISTING_CITIES = CITIES.filter((c) => !c.key.endsWith('-other')).map((c) => c.key);

/** Each city's feed document, and its file beside the website: thunder-bay → thunderbay. */
export const feedDoc = (cityKey) => String(cityKey).replace(/-/g, '');

/** The index of every city's feed: when each was last updated and how many listings it holds. */
export const INDEX_DOC = 'markets';

/**
 * Which city to show: the one picked, else the one you're buying in once
 * the run has listings there, else Thunder Bay.
 */
export function listingCity(picked, homeCity, index) {
  if (LISTING_CITIES.includes(picked)) return picked;
  return LISTING_CITIES.includes(homeCity) && index?.cities?.[homeCity]?.count > 0 ? homeCity : HOME_MARKET;
}

/**
 * The listing assumptions moved to another city: market rents and the
 * fallback property tax scale by that city's average rent and tax share
 * against Thunder Bay's, where the assumptions are set.
 */
export function localMarket(market, cityKey = HOME_MARKET) {
  const m = normalizeMarket(market);
  const city = cityByKey(cityKey);
  const home = cityByKey(HOME_MARKET);
  const rentRatio = city.rent / home.rent;
  const taxRatio = city.taxPct / home.taxPct;
  // Where we have the city's asking rents, each bedroom count moves by its own ratio, so untouched rents are its own.
  const surveyed = CITY_RENTS[city.key];
  const rentRatios = Object.fromEntries(Object.keys(m.rents).map((b) => [b, surveyed ? surveyed.rents[b] / DEFAULT_MARKET.rents[b] : rentRatio]));
  return {
    ...m,
    city: city.key,
    rentRatio,
    rentRatios,
    rentsSource: surveyed ? 'asking' : 'scaled',
    rentsAs: surveyed?.as ?? CITY_RENTS['thunder-bay'].as,
    taxRatio,
    rents: Object.fromEntries(Object.entries(m.rents).map(([b, r]) => [b, Math.round(r * rentRatios[b])])),
    taxPct: Math.round(m.taxPct * taxRatio * 1000) / 1000,
  };
}

/** A change made to the local assumptions, put back in Thunder Bay terms for saving. */
export function homePatch(patch, local) {
  const { city, rentRatio, rentRatios, rentsSource, rentsAs, taxRatio, ...out } = patch; // eslint-disable-line no-unused-vars
  if (patch.rents && local?.rentRatio) out.rents = Object.fromEntries(Object.entries(patch.rents).map(([b, r]) => [b, Number(r) / (local.rentRatios?.[b] ?? local.rentRatio)]));
  if (patch.taxPct != null && local?.taxRatio) out.taxPct = Number(patch.taxPct) / local.taxRatio;
  return out;
}

export const LISTING_TYPES = [
  { key: 'single', label: 'Single-family' },
  { key: 'small', label: '2–4 units' },
  { key: 'large', label: '5+ units' },
];

export const typeOf = (units) => (units >= 5 ? 'large' : units >= 2 ? 'small' : 'single');

/**
 * How many rental units a listing has: its stated count, but never fewer
 * than its per-unit bedroom or rent lists show (a saved count can be stale).
 */
export function unitsOf(listing) {
  const stated = Math.round(Number(listing?.units) || 0);
  const listed = Math.max(Array.isArray(listing?.beds) ? listing.beds.length : 0, Array.isArray(listing?.rents) ? listing.rents.length : 0);
  return Math.min(Math.max(stated, listed, 1), 500);
}

/** A home must carry at least this much insurance a year, however few units. */
export const INSURANCE_MIN = 1500;

/**
 * How listings are underwritten. Listings rarely give everything, so these
 * fill the gaps: financing, costs, and market rents by bedroom count for
 * units without a stated rent. Editable on the Listings tab.
 */
/**
 * Where the starting rates and rents come from, and when they were checked.
 * Everyone can change them; these are published figures, not guesses.
 */
export const MARKET_SOURCES = {
  checked: '2026-11-03',
  rate: {
    what: 'RBC’s 5-year fixed closed special offer for an uninsured mortgage (20% or more down, as a rental needs), October 2026. With mortgage insurance (under 20% down on a home you live in) it’s 4.84%',
    source: 'RBC Royal Bank',
    url: 'https://www.rbcroyalbank.com/mortgages/mortgage-rates.html',
  },
  dscrRate: { what: 'Low end of B-lender DSCR loan rates (7.49% to 8.49%), August 21, 2026, from one broker’s published rates', source: 'LendCity', url: 'https://lendcity.ca/rates/' },
  vacancy: {
    what: 'Thunder Bay’s rental vacancy rate, October 2025: 3.9% of units empty',
    source: 'CMHC Rental Market Survey',
    url: 'https://www03.cmhc-schl.gc.ca/hmip-pimh/en/TableMapChart/TableCategory?geographyType=CensusSubDivision&geographyId=3558004&categoryLevel1=Primary+Rental+Market&categoryLevel2=Summary+Statistics',
  },
  rents: {
    what: 'Average asking rents for units listed for rent now, by bedrooms: Thunder Bay as of September 2026, the other cities as of March 2026, the latest Rentals.ca publishes for each. Statistics Canada’s asking-rent figures come from the same listings. The 3-bedroom figure is used for 4+. Rentals.ca gives no studio average, so a studio is the 1-bedroom figure less the gap CMHC’s survey finds between the two (an estimate)',
    source: 'Rentals.ca',
    url: 'https://rentals.ca/thunder-bay',
  },
};
/**
 * Average asking rents by bedrooms (Rentals.ca), for each city with daily
 * listings. A studio is the 1-bedroom asking rent times the city's studio
 * to 1-bedroom ratio in CMHC's October 2025 survey (the five cities'
 * average where CMHC's figures aren't on hand). Thunder Bay's are
 * DEFAULT_MARKET.rents; cities not here scale Thunder Bay's by typical rent.
 */
const STUDIO_RATIO = 0.873;
const asking = (b1, b2, b3, studio = STUDIO_RATIO) => ({ 0: Math.round((b1 * studio) / 10) * 10, 1: b1, 2: b2, 3: b3, 4: b3 });
export const CITY_RENTS = {
  'thunder-bay': { rents: asking(1584, 2035, 2218, 976 / 1173), as: '2026-09', url: 'https://rentals.ca/thunder-bay' },
  calgary: { rents: asking(1532, 1848, 2243, 1438 / 1581), as: '2026-03', url: 'https://rentals.ca/calgary' },
  edmonton: { rents: asking(1288, 1634, 1993), as: '2026-03', url: 'https://rentals.ca/edmonton' },
  kelowna: { rents: asking(1743, 2217, 2910, 1394 / 1597), as: '2026-03', url: 'https://rentals.ca/kelowna' },
  vancouver: { rents: asking(2400, 3355, 3911, 1667 / 1807), as: '2026-03', url: 'https://rentals.ca/vancouver' },
  victoria: { rents: asking(1975, 2584, 3375, 1349 / 1625), as: '2026-03', url: 'https://rentals.ca/victoria' },
  regina: { rents: asking(1285, 1530, 1973), as: '2026-03', url: 'https://rentals.ca/regina' },
  saskatoon: { rents: asking(1347, 1580, 1998), as: '2026-03', url: 'https://rentals.ca/saskatoon' },
  winnipeg: { rents: asking(1445, 1786, 2075), as: '2026-03', url: 'https://rentals.ca/winnipeg' },
};

// Earlier starting figures, oldest first: saved settings still holding one move to today's sourced figure.
const OLD_DEFAULTS = [
  { rate: 4.9, dscrRate: 6, rents: { 0: 1050, 1: 1350, 2: 1700, 3: 2000, 4: 2300 } },
  // CMHC's average rents (long-time tenants included) and the B-lender loan as the default.
  { rate: 5.12, lens: 'dscr', rents: { 0: 976, 1: 1173, 2: 1493, 3: 1794, 4: 1794 } },
  // A round 4% vacancy before Thunder Bay's surveyed rate.
  { vacancyPct: 4, rents: {} },
];
const DEFAULTS_VERSION = 4;
/** Each city's rental vacancy rate (% of units empty), where CMHC's survey has it: see MARKET_SOURCES. */
export const CITY_VACANCY = { 'thunder-bay': 3.9 };
// The vacancy figures deals were filled in with before the surveyed rate.
const OLD_VACANCY = [4, 5];
// The average rents saved deals were filled in with before asking rents, by city: those move to today's.
const OLD_CITY_RENTS = {
  'thunder-bay': [976, 1173, 1493, 1794],
  calgary: [1438, 1581, 1908, 2118],
  kelowna: [1394, 1597, 2098, 2713],
  vancouver: [1667, 1807, 2364, 2820],
  victoria: [1349, 1625, 2120, 2886],
};

export const DEFAULT_MARKET = {
  // How listings are counted: 'dscr', with a DSCR loan, where the lender
  // qualifies the property on its rent; or 'own', your own money as a 20%
  // down payment with a regular mortgage at `rate`.
  lens: 'own',
  // In Canada, loans qualified on the rent come from alternative (B)
  // lenders: usually 20-25% down, at a rate above a regular mortgage's.
  dscrDownPct: 25, // DSCR programs lend up to 75-80% of the value
  dscrRate: 7.49, // see MARKET_SOURCES
  rate: 5.14, // regular mortgage: RBC's 5-year fixed, uninsured; see MARKET_SOURCES
  amortYears: 30,
  closingPct: 1, // legal, title, inspection; land transfer tax is added on top
  insurancePerUnit: 800, // $ a year per unit, at least INSURANCE_MIN
  utilitiesPerUnit: 50, // $ a month per unit the owner pays (water, shared heat) in 2+ unit buildings
  taxPct: 1, // typical property tax as % of price, for the quick check only: listings use their real bill or none
  taxes: {}, // yearly tax bills you typed in for listings that don't state one, by listing id
  mgmtPct: 8,
  maintPct: 6,
  vacancyPct: CITY_VACANCY['thunder-bay'], // Thunder Bay's surveyed rate; see MARKET_SOURCES
  capexPct: 7,
  rents: CITY_RENTS['thunder-bay'].rents, // $/mo asking rent by bedrooms (4 = 4+), Thunder Bay; see MARKET_SOURCES
  defaults: DEFAULTS_VERSION,
  types: ['single', 'small', 'large'],
  hidden: [],
};

export function normalizeMarket(m) {
  // Settings saved before the figures were sourced: any still at the old starting value move to the sourced one.
  if (m && m.defaults !== DEFAULTS_VERSION) {
    const old = m;
    m = { ...m, defaults: DEFAULTS_VERSION, rents: { ...(m.rents ?? {}) } };
    for (const was of OLD_DEFAULTS) {
      for (const k of ['rate', 'dscrRate', 'vacancyPct']) if (was[k] != null && Number(old[k]) === was[k]) m[k] = DEFAULT_MARKET[k];
      // Listings counted with the B-lender loan by default now count 20% down at a bank's rate.
      if (was.lens && old.lens === was.lens) m.lens = DEFAULT_MARKET.lens;
      for (const [b, r] of Object.entries(was.rents)) if (Number(old.rents?.[b]) === r) m.rents[b] = DEFAULT_MARKET.rents[b];
    }
    // Rents typed in a fraction of a dollar off the old figures were saved scaled from a city: keep them.
  }
  const rents = { ...DEFAULT_MARKET.rents };
  for (const k of Object.keys(rents)) if (Number(m?.rents?.[k]) > 0) rents[k] = Number(m.rents[k]);
  return {
    ...DEFAULT_MARKET,
    ...(m ?? {}),
    rents,
    // A saved choice wins; with none, the default (20% down at a bank's rate).
    lens: m?.lens === 'dscr' || m?.lens === 'own' ? m.lens : DEFAULT_MARKET.lens,
    types: Array.isArray(m?.types) ? m.types.filter((t) => LISTING_TYPES.some((x) => x.key === t)) : DEFAULT_MARKET.types,
    hidden: Array.isArray(m?.hidden) ? m.hidden.filter((x) => typeof x === 'string') : [],
    taxes: Object.fromEntries(Object.entries(m?.taxes && typeof m.taxes === 'object' ? m.taxes : {}).filter(([id, v]) => id.length <= 200 && Number(v) > 0 && Number(v) < 1e7).map(([id, v]) => [id, Math.round(Number(v))])),
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

// "gone": a saved listing whose recheck finds no for-sale page any more.
const STATUSES = ['active', 'conditional', 'sold', 'gone'];
const OFF_MARKET = new Set(['sold', 'gone']);

/**
 * The listing's own page, or null. A real listing link names the property:
 * its street number and street appear in the address of the page. Search
 * results, area pages and links to some other property don't.
 */
export function listingPageUrl(url, address) {
  const safe = safeHttpUrl(url);
  if (!safe) return null;
  const tokens = String(address ?? '')
    .toLowerCase()
    .replace(/[.,#']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const at = tokens.findIndex((t) => /^\d+[a-z]?(-\d+[a-z]?)?$/.test(t));
  if (at < 0) return null;
  // "302-165 Court St" is unit 302 at number 165; "12A" is number 12.
  const number = tokens[at].split('-').pop().replace(/[a-z]$/, '');
  const street = tokens.slice(at + 1).find((t) => /^[a-z]{3,}$/.test(t));
  let page;
  try {
    const u = new URL(safe);
    page = decodeURIComponent(u.pathname + u.search).toLowerCase();
  } catch {
    return null;
  }
  const hasNumber = new RegExp(`(^|[^0-9])${number}([^0-9]|$)`).test(page);
  return hasNumber && (!street || page.includes(street)) ? safe : null;
}

const SITE_NAMES = {
  'rew.ca': 'REW',
  'realtor.ca': 'REALTOR.ca',
  'zolo.ca': 'Zolo',
  'royallepage.ca': 'Royal LePage',
  'remax.ca': 'RE/MAX',
  'c21.ca': 'Century 21',
  'coldwellbanker.ca': 'Coldwell Banker',
  'onepercentrealty.com': 'OnePercent',
  'honestdoor.com': 'HonestDoor',
  'squareyards.ca': 'Square Yards',
  'zoocasa.com': 'Zoocasa',
  'wahi.com': 'Wahi',
  'point2homes.com': 'Point2',
  'redfin.ca': 'Redfin',
  'housesigma.com': 'HouseSigma',
  'exprealty.ca': 'eXp Realty',
  'propertyguys.com': 'PropertyGuys',
  'kijiji.ca': 'Kijiji',
  'centris.ca': 'Centris',
  'duproprio.com': 'DuProprio',
};

/** A short name for the site a listing link goes to, from the link itself. */
export function siteName(url) {
  const safe = safeHttpUrl(url);
  if (!safe) return null;
  const host = new URL(safe).hostname.replace(/^www\./, '');
  const key = Object.keys(SITE_NAMES).find((d) => host === d || host.endsWith(`.${d}`));
  return key ? SITE_NAMES[key] : host;
}

/** Check one listing as the run reported it; null when it has no address or price. */
export function cleanListing(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const address = text(raw.address, 120);
  const price = positive(raw.price);
  if (!address || !price || price < 10000) return null;
  // Unknown when the run didn't say, so a re-found listing never loses its saved count.
  const stated = positive(raw.units);
  const units = stated ? Math.min(Math.max(Math.round(stated), 1), 500) : null;
  const perUnit = (arr, fn) => (Array.isArray(arr) && arr.length ? arr.slice(0, units ?? 500).map(fn) : null);
  // A single bedroom count means every unit has that many.
  const beds = typeof raw.beds === 'number' ? Array(units ?? 1).fill(raw.beds) : raw.beds;
  const mls = text(raw.mls, 24).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const year = Math.round(Number(raw.yearBuilt));
  return {
    id: mls || `addr-${addressKey(address).replace(/ /g, '-')}`,
    mls: mls || null,
    address,
    url: listingPageUrl(raw.url, address),
    source: text(raw.source, 60) || null,
    units,
    beds: perUnit(beds, bedrooms),
    rents: perUnit(raw.rents, positive),
    grossRent: positive(raw.grossRent),
    price,
    taxes: positive(raw.taxes),
    yearBuilt: year >= 1800 && year <= 2100 ? year : null,
    highlights: text(raw.highlights, 220),
    // A distressed sale the listing states: power-of-sale, bank-owned, receivership, estate or as-is.
    distress: DISTRESS_KINDS.includes(raw.distress) ? raw.distress : null,
    status: STATUSES.includes(raw.status) ? raw.status : 'active',
  };
}
const DISTRESS_KINDS = ['power-of-sale', 'bank-owned', 'receivership', 'estate', 'as-is', 'tax-sale'];

/**
 * Monthly rent for the whole property: the listing's stated rents where it
 * gives them (a stated total wins), the rent table by bedrooms elsewhere.
 * Unknown bedroom counts assume 3 for a house, 2 per unit in a 2–4 unit
 * building and 1 in larger buildings, which are mostly one-bedrooms.
 */
export function listingRent(listing, market) {
  const m = normalizeMarket(market);
  const units = unitsOf(listing);
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

/**
 * The deal a listing becomes under Ontario rules and your listing
 * assumptions, financed the way `lens` says (your chosen one by default):
 * a DSCR loan, or your own 20% down with a regular mortgage.
 */
export function listingToDeal(listing, market, lens) {
  const m = normalizeMarket(market);
  const units = unitsOf(listing);
  const price = Number(listing.price) || 0;
  const rent = listingRent(listing, m);
  const unitType = UNIT_TYPES.find((t) => t.units === units && t.key !== 'multiplex')?.key ?? 'multiplex';
  const rentNote = { stated: 'Rents as listed.', mixed: 'Some rents estimated from your rent table.', estimated: 'Rents estimated from your rent table.' }[rent.source];
  const deal = {
    ...DEFAULT_DEAL,
    name: listing.address,
    country: 'ca',
    city: m.city ?? HOME_MARKET,
    price,
    termYears: m.amortYears,
    closingPct: m.closingPct,
    unitType,
    units,
    rentPerUnit: Math.round(rent.total / units),
    taxesAnnual: listingTaxes(listing, m) ?? 0,
    insuranceAnnual: Math.max(m.insurancePerUnit * units, INSURANCE_MIN),
    // Owner-paid utilities ride in the monthly fixed costs, as Canadian lenders count heat.
    hoaMonthly: units >= 2 ? m.utilitiesPerUnit * units : 0,
    mgmtPct: m.mgmtPct,
    maintPct: m.maintPct,
    vacancyPct: m.vacancyPct,
    capexPct: m.capexPct,
    address: listing.address,
    condo: isCondo(listing),
    listingUrl: listing.url || '',
    notes: [listing.highlights, rentNote, taxSource(listing, m) === 'you' && 'Property tax as you entered it.', listing.mls && `MLS® ${listing.mls}.`].filter(Boolean).join(' '),
    listingId: listing.id,
  };
  return (lens ?? m.lens) === 'own'
    ? ownMoney({ ...deal, rate: m.rate, refiRate: m.rate })
    : { ...deal, downPct: m.dscrDownPct, rate: m.dscrRate, refiRate: m.dscrRate };
}

/**
 * A deal made from a listing before today's figures: one still on the
 * B-lender loan default (7.49% with 25% down) moves to 20% down at the
 * bank rate, and rents it estimated from the old average-rent table move to
 * today's asking rents. Anything you changed by hand stays as you left it.
 */
export function refreshListingDeal(d) {
  if (d?.country !== 'ca') return d;
  let out = d;
  // A Canadian deal on a starting vacancy figure, in a city CMHC surveys: the city's surveyed rate.
  const vac = CITY_VACANCY[d.city];
  if (vac != null && OLD_VACANCY.includes(Number(d.vacancyPct))) out = { ...out, vacancyPct: vac };
  if (!d.listingId) return out;
  if (Number(d.rate) === 7.49 && Number(d.downPct) === 25) {
    out = ownMoney({ ...out, rate: DEFAULT_MARKET.rate, refiRate: Number(d.refiRate) === 7.49 ? DEFAULT_MARKET.rate : d.refiRate });
  }
  const old = OLD_CITY_RENTS[d.city];
  const now = CITY_RENTS[d.city]?.rents;
  if (old && now && /Rents estimated from your rent table/.test(d.notes || '')) {
    const b = old.indexOf(Number(d.rentPerUnit));
    if (b >= 0) out = { ...out, rentPerUnit: now[b] };
  }
  return out;
}

/** Price cut in the most recent move, or 0. */
export function priceDrop(listing) {
  const h = Array.isArray(listing.priceHistory) ? listing.priceHistory : [];
  const prev = h.length > 1 ? Number(h[h.length - 2].price) : 0;
  return prev > listing.price ? prev - listing.price : 0;
}

/** Your targets as a view counts them: your own down payment has no lender's DSCR test to pass. */
export const lensTargets = (targets, lens) => (lens === 'own' ? { ...targets, useDscr: false } : targets);

/**
 * A listing's yearly property tax, only ever a real figure: the bill the
 * listing states, or the one you typed in from it. Null when neither is
 * known: Squarely never guesses a home's tax.
 */
export function listingTaxes(listing, market) {
  const stated = positive(listing?.taxes);
  if (stated) return Math.round(stated);
  return normalizeMarket(market).taxes[listing?.id] ?? null;
}

/** Where a listing's tax figure came from: 'listing', 'you', or null when it isn't known. */
export function taxSource(listing, market) {
  if (positive(listing?.taxes)) return 'listing';
  return normalizeMarket(market).taxes[listing?.id] ? 'you' : null;
}

/**
 * One listing run through the engine the way your chosen view counts it:
 * cash flow per door, max offer, and whether it beats every target, plus
 * the same listing bought outright.
 */
export function scoreListing(listing, market, targets = DEFAULT_TARGETS) {
  const m = normalizeMarket(market);
  const deal = listingToDeal(listing, m);
  const a = analyzeDeal(deal);
  // Without a real tax bill the numbers would be made up, so it can't beat a target.
  const needsTax = listingTaxes(listing, m) == null;
  const offer = maxOffer(deal, lensTargets(targets, m.lens));
  return {
    listing,
    deal,
    a,
    lens: m.lens,
    cash: analyzeDeal(allCash(deal)),
    offer,
    perDoor: a.netCashFlow / a.units,
    meets: !needsTax && (offer.price == null ? a.netCashFlow > 0 : offer.price >= a.price),
    rentSource: listingRent(listing, m).source,
    needsTax,
    taxSource: taxSource(listing, m),
    drop: priceDrop(listing),
  };
}

const room = (s) => (Number.isFinite(s.offer.price) ? s.offer.price - s.a.price : s.offer.price == null ? -Infinity : Infinity);

export const SORTS = {
  perDoor: { label: 'Cash flow per door', compare: (x, y) => y.perDoor - x.perDoor },
  coc: { label: 'Cash-on-cash', compare: (x, y) => y.a.coc - x.a.coc },
  cashCoc: { label: 'All-cash return', compare: (x, y) => y.cash.coc - x.cash.coc },
  room: { label: 'Room to negotiate', compare: (x, y) => room(y) - room(x) },
  priceLow: { label: 'Price: low to high', compare: (x, y) => x.a.price - y.a.price, byPrice: true },
  priceHigh: { label: 'Price: high to low', compare: (x, y) => y.a.price - x.a.price, byPrice: true },
  newest: { label: 'Newest', compare: (x, y) => String(y.listing.firstSeen ?? '').localeCompare(String(x.listing.firstSeen ?? '')) },
};

/** Active listings of the chosen types, scored and sorted (cash flow per door breaks ties). */
// "216 Leith Street" and "216 Leith" are one house: street words, directions and punctuation don't count.
const streetKey = (a) => String(a ?? '').toLowerCase().split(',')[0].replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|crescent|cres|court|ct|place|pl|north|south|east|west|n|s|e|w)\b\.?/g, '').replace(/[^a-z0-9]/g, '');

/**
 * One entry per home: the same street address at the same price, found
 * twice by the morning run (written two ways), is kept once, as the entry
 * with the most known (a tax bill, the unit count, the fuller address).
 */
export function dedupeListings(listings) {
  const list = Array.isArray(listings) ? listings : [];
  const score = (l) => (l.taxes != null ? 4 : 0) + (l.units != null ? 2 : 0) + String(l.address ?? '').length / 1000;
  const groups = new Map(); // key → index in out
  const out = [];
  for (const l of list) {
    const street = streetKey(l.address);
    const k = street ? `${street}|${Math.round(Number(l.price) || 0)}` : null;
    if (!k || !groups.has(k)) {
      if (k) groups.set(k, out.length);
      out.push(l);
      continue;
    }
    const i = groups.get(k);
    const had = out[i];
    const firstSeen = [had.firstSeen, l.firstSeen].filter(Boolean).sort()[0];
    out[i] = { ...(score(l) > score(had) ? l : had), ...(firstSeen ? { firstSeen } : {}) };
  }
  return out;
}

export function rankListings(listings, market, targets, { types, hidden, showHidden = false, onlyMeets = false, sort = 'perDoor' } = {}) {
  const m = normalizeMarket(market);
  const want = new Set(types ?? m.types);
  const hide = new Set(hidden ?? m.hidden);
  // Older saved choices: 'price' was lowest first.
  const chosen = SORTS[sort === 'price' ? 'priceLow' : sort] ?? SORTS.perDoor;
  const order = chosen.compare;
  return (Array.isArray(listings) ? listings : [])
    // Only listings with a page of their own: an older saved feed may hold some without.
    .filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address) && want.has(typeOf(unitsOf(l))) && (showHidden || !hide.has(l.id)))
    .map((l) => scoreListing(l, m, targets))
    .filter((s) => !onlyMeets || s.meets)
    // Listings with a real tax bill first: the rest have no numbers to rank by yet.
    // By price, every listing counts; otherwise those with a real tax bill come first (the rest have no numbers to rank by yet).
    .sort((x, y) => (chosen.byPrice ? 0 : x.needsTax - y.needsTax) || order(x, y) || y.perDoor - x.perDoor);
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
 * listings on some days, so one is dropped only after `keepDays` without
 * being confirmed, or as soon as a run reports it sold or gone. A listing
 * without a link to its own page is turned away: nobody could check it.
 */
export function mergeFeed(prev, found, { today, now = Date.now(), keepDays = 7, note = '', city = HOME_MARKET } = {}) {
  const old = Array.isArray(prev?.listings) ? prev.listings : [];
  const merged = new Map(old.map((l) => [l.id, { ...l }]));
  const byAddress = new Map(old.map((l) => [addressKey(l.address), l.id]));
  const stats = { found: 0, added: 0, seenAgain: 0, priceDrops: 0, priceRises: 0, removed: 0, rejected: 0 };

  for (const raw of Array.isArray(found) ? found : []) {
    const f = cleanListing(raw);
    if (!f) {
      stats.rejected += 1;
      continue;
    }
    const id = merged.has(f.id) ? f.id : byAddress.get(addressKey(f.address));
    // Sold or gone needs no link: it only takes a saved listing off the list.
    if (OFF_MARKET.has(f.status)) {
      if (id) merged.set(id, { ...merged.get(id), status: f.status, lastSeen: today });
      continue;
    }
    // Everything else must link to its own listing page, or nobody can check it's real.
    if (!f.url) {
      stats.rejected += 1;
      continue;
    }
    stats.found += 1;
    if (id) {
      const cur = merged.get(id);
      const history = Array.isArray(cur.priceHistory) && cur.priceHistory.length ? [...cur.priceHistory] : [{ date: cur.firstSeen ?? today, price: cur.price }];
      if (f.price !== cur.price) {
        history.push({ date: today, price: f.price });
        if (f.price < cur.price) stats.priceDrops += 1;
        else stats.priceRises += 1;
      }
      const known = Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.every((x) => x == null))));
      const next = { ...cur, ...known, id, mls: cur.mls ?? f.mls, firstSeen: cur.firstSeen ?? today, lastSeen: today, priceHistory: history.slice(-12) };
      merged.set(id, { ...next, units: Math.max(unitsOf(next), unitsOf(cur)) });
      stats.seenAgain += 1;
    } else {
      merged.set(f.id, { ...f, units: unitsOf(f), firstSeen: today, lastSeen: today, priceHistory: [{ date: today, price: f.price }] });
      byAddress.set(addressKey(f.address), f.id);
      stats.added += 1;
    }
  }

  // Off the list: sold or gone, not confirmed for a week, or no page of its own.
  const cutoff = addDays(today, -keepDays);
  const listings = [...merged.values()].filter((l) => {
    const keep = String(l.lastSeen ?? today) >= cutoff && !OFF_MARKET.has(l.status) && Boolean(listingPageUrl(l.url, l.address));
    if (!keep) stats.removed += 1;
    return keep;
  });
  const run = { date: today, at: now, ...stats, note: text(note, 200) };
  return {
    feed: {
      schema: 1,
      city: `${cityByKey(city).name}, ${cityByKey(city).province}`,
      market: cityByKey(city).key,
      updatedAt: now,
      lastRun: run,
      runs: [...(Array.isArray(prev?.runs) ? prev.runs : []), run].slice(-14),
      listings,
    },
    stats,
  };
}

/**
 * The index after one city's run: for each city, the date it was last
 * searched and how many listings its feed holds.
 */
export function updateIndex(prev, cityKey, feed) {
  const cities = { ...(prev?.cities ?? {}) };
  const active = (feed?.listings ?? []).filter((l) => (l.status ?? 'active') === 'active').length;
  cities[cityKey] = { doc: feedDoc(cityKey), date: feed?.lastRun?.date ?? null, at: feed?.lastRun?.at ?? null, count: active };
  return { schema: 1, updatedAt: feed?.lastRun?.at ?? Date.now(), cities };
}

/**
 * Which cities today's run searches: the home market every day, then the
 * `count` cities searched longest ago (never-searched first, in list order).
 */
export function planRun(index, count = 4) {
  const seen = index?.cities ?? {};
  const others = LISTING_CITIES.filter((k) => k !== HOME_MARKET)
    .map((k, i) => ({ k, i, date: seen[k]?.date ?? '' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i)
    .slice(0, Math.max(0, count))
    .map((x) => x.k);
  return [HOME_MARKET, ...others];
}

const dayNumber = (iso) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86400000);

/** Days since the morning run first found a listing (how long Squarely has seen it for sale), or null. */
export function daysListed(listing, today = new Date().toISOString().slice(0, 10)) {
  if (!listing?.firstSeen || !/^\d{4}-\d{2}-\d{2}$/.test(listing.firstSeen)) return null;
  return Math.max(dayNumber(today) - dayNumber(listing.firstSeen), 0);
}

/** The asking price's moves since first seen: first price, change since then, and the points to draw. */
export function priceStory(listing) {
  const h = (Array.isArray(listing?.priceHistory) ? listing.priceHistory : []).filter((p) => Number(p.price) > 0);
  const points = h.length ? h.map((p) => ({ date: p.date, price: Number(p.price) })) : [{ date: listing?.firstSeen ?? null, price: Number(listing?.price) || 0 }];
  const first = points[0].price;
  const now = Number(listing?.price) || points.at(-1).price;
  return { first, now, change: now - first, moves: points.length - 1, points };
}

/**
 * Listings priced well under the rest of their city's list: the asking
 * price per door at least `cut` below the median per door of the same kind
 * (houses, 2–4 units, 5+ units, each against its own), once a kind has
 * at least `minGroup` listings to compare. Returns Map id → share below.
 */
export function underMarket(listings, { cut = 0.15, minGroup = 4 } = {}) {
  const active = (listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && Number(l.price) > 0);
  const kind = (l) => typeOf(unitsOf(l));
  const perDoor = (l) => Number(l.price) / unitsOf(l);
  const out = new Map();
  for (const k of LISTING_TYPES.map((t) => t.key)) {
    const group = active.filter((l) => kind(l) === k);
    if (group.length < minGroup) continue;
    const sorted = group.map(perDoor).sort((a, b) => a - b);
    const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    for (const l of group) {
      const below = 1 - perDoor(l) / mid;
      if (below >= cut) out.set(l.id, Math.round(below * 100) / 100);
    }
  }
  return out;
}

/**
 * Listings in a feed that fit a saved alert: its city's listings of the
 * types it wants, at or under its price, its cost to live in (with your
 * Home numbers) and at or over its cash flow per door.
 */
export function alertMatches(alert, feed, { market, profile, homeFor } = {}) {
  const m = localMarket(market, alert.city);
  return (feed?.listings ?? [])
    .filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address))
    .filter((l) => (alert.types ?? LISTING_TYPES.map((t) => t.key)).includes(typeOf(unitsOf(l))))
    .filter((l) => !alert.maxPrice || Number(l.price) <= alert.maxPrice)
    .map((l) => {
      const s = scoreListing(l, m);
      if (s.needsTax) return { listing: l, perDoor: null, costToLive: null, needsTax: true, canBuy: false };
      const home = homeFor && profile ? homeFor(listingToDeal(l, m, 'own'), { ...profile, city: alert.city }, m.rate) : null;
      return { listing: l, perDoor: s.perDoor, costToLive: home?.costToLive ?? null, canBuy: home?.canBuy === true };
    })
    .filter((x) => !alert.fits || x.canBuy)
    .filter((x) => !alert.maxLive || (x.costToLive != null && x.costToLive <= alert.maxLive))
    .filter((x) => alert.minPerDoor == null || (x.perDoor != null && x.perDoor >= alert.minPerDoor));
}

/** Of an alert's matches, the ones new or cheaper on or after `since` (YYYY-MM-DD). */
export const freshMatches = (matches, since) =>
  matches.filter(({ listing: l }) => String(l.firstSeen ?? '') >= since || (priceDrop(l) > 0 && String(l.priceHistory?.at(-1)?.date ?? '') >= since));

/** A plain-words name for an alert: "Duplexes to fourplexes in Hamilton under $2,000/mo to live in". */
export function alertName(alert, cityName) {
  const kinds = { single: 'houses', small: '2–4 units', large: '5+ units' };
  const types = (alert.types?.length ?? 3) === 3 ? 'Homes' : alert.types.map((t) => kinds[t]).join(' and ').replace(/^./, (c) => c.toUpperCase());
  const parts = [`${types} in ${cityName}`];
  if (alert.maxPrice) parts.push(`up to $${Math.round(alert.maxPrice).toLocaleString('en-CA')}`);
  if (alert.maxLive) parts.push(`under $${Math.round(alert.maxLive).toLocaleString('en-CA')}/mo to live in`);
  if (alert.minPerDoor != null) parts.push(`at least $${Math.round(alert.minPerDoor).toLocaleString('en-CA')}/door`);
  if (alert.fits) parts.push('that fit your budget');
  return parts.join(', ');
}
