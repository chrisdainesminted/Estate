// CREA's Data Distribution Facility (DDF®): the official feed of MLS®
// listings for websites. A REALTOR® member (an agent or brokerage partner)
// signs up for it, names this site as their technology provider, and gets
// a client id and secret for it. With those set in Cloudflare
// (DDF_CLIENT_ID, DDF_CLIENT_SECRET), the server pulls the listings every
// few hours (worker/ddf.js) and they join the morning search's listings for
// each city, taking the place of any home both found.
//
// The DDF Web API is OData (RESO field names), with OAuth2 client
// credentials. See CREA's DDF documentation for the terms of display.

import { addressKey, cleanListing } from './market.js';
import { cityByKey } from './canada.js';

export const DDF = {
  tokenUrl: 'https://identity.crea.ca/connect/token',
  apiBase: 'https://ddfapi.realtor.ca/odata/v1',
  scope: 'DDFApi_Read',
  pageSize: 100,
  maxPages: 20,
};

// What every page showing DDF® listings must carry (CREA's trademark notice).
export const DDF_NOTICE =
  'The trademarks REALTOR®, REALTORS®, and the REALTOR® logo are controlled by The Canadian Real Estate Association (CREA) and identify real estate professionals who are members of CREA. The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by CREA and identify the quality of services provided by real estate professionals who are members of CREA.';

const PROVINCES = {
  NL: 'Newfoundland & Labrador',
  PE: 'Prince Edward Island',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  QC: 'Quebec',
  ON: 'Ontario',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  AB: 'Alberta',
  BC: 'British Columbia',
  YT: 'Yukon',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
};

const UNIT_WORDS = { duplex: 2, triplex: 3, fourplex: 4, quadruplex: 4, 'multi-family': null };
const DISTRESS_WORDS = [
  [/power of sale/i, 'power-of-sale'],
  [/bank[- ]owned|foreclos/i, 'bank-owned'],
  [/receivership/i, 'receivership'],
  [/estate sale/i, 'estate'],
  [/\bas[- ]is\b/i, 'as-is'],
];

const str = (v) => (v == null ? '' : String(v).trim());
const num = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const slug = (s) =>
  str(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The street address of a DDF property, without the city. */
export function ddfAddress(p) {
  const unparsed = str(p.UnparsedAddress).split(',')[0];
  if (unparsed) return unparsed;
  const street = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix, p.StreetDirSuffix].map(str).filter(Boolean).join(' ');
  return p.UnitNumber ? `${str(p.UnitNumber)}-${street}` : street;
}

/** How many homes are in the building: stated, or read from its kind (duplex, triplex...). */
export function ddfUnits(p) {
  const stated = num(p.NumberOfUnitsTotal);
  if (stated) return Math.round(stated);
  const kind = `${str(p.PropertySubType)} ${str(p.BuildingType ?? '')}`.toLowerCase();
  for (const [word, n] of Object.entries(UNIT_WORDS)) if (kind.includes(word)) return n;
  return /single|detached|semi|row|town|condo|apartment/.test(kind) ? 1 : null;
}

/** Photo links in their listed order, at most 12. */
export function ddfPhotos(p) {
  const media = Array.isArray(p.Media) ? p.Media : [];
  return media
    .filter((m) => /^https:\/\//i.test(str(m?.MediaURL)) && (!m.MediaCategory || /photo/i.test(m.MediaCategory)))
    .sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0))
    .map((m) => str(m.MediaURL))
    .slice(0, 12);
}

/**
 * One DDF property as the morning run would report a listing, plus what
 * only DDF has: photos, the listing brokerage and a map point.
 */
export function ddfToRaw(p, { officeName = '' } = {}) {
  const address = ddfAddress(p);
  const mls = str(p.ListingId) || str(p.ListingKey);
  const city = str(p.City);
  // REALTOR.ca's own page for the listing; its address is in the link.
  const url = str(p.ListingURL) && /^https?:\/\//i.test(str(p.ListingURL)) ? str(p.ListingURL) : `https://www.realtor.ca/real-estate/${encodeURIComponent(str(p.ListingKey))}/${slug(`${address} ${city}`)}`;
  const remarks = str(p.PublicRemarks);
  const status = /pending|conditional|under contract/i.test(str(p.StandardStatus)) ? 'conditional' : /closed|sold/i.test(str(p.StandardStatus)) ? 'sold' : /withdrawn|expired|cancel|delete/i.test(str(p.StandardStatus)) ? 'gone' : 'active';
  const lat = Number(p.Latitude);
  const lng = Number(p.Longitude);
  return {
    address,
    mls,
    url,
    source: 'realtor.ca',
    price: num(p.ListPrice),
    units: ddfUnits(p),
    beds: num(p.BedroomsTotal) != null && ddfUnits(p) === 1 ? Math.round(Number(p.BedroomsTotal)) : undefined,
    taxes: num(p.TaxAnnualAmount),
    yearBuilt: num(p.YearBuilt),
    highlights: remarks.length > 200 ? `${remarks.slice(0, 197).replace(/\s+\S*$/, '')}…` : remarks,
    distress: DISTRESS_WORDS.find(([re]) => re.test(remarks))?.[1] ?? null,
    status,
    ddf: true,
    photos: ddfPhotos(p),
    brokerage: str(officeName || p.ListOfficeName),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  };
}

/** The OData filter for one city's active listings. */
export function ddfCityFilter(cityKey) {
  const place = cityByKey(cityKey);
  // Names are written with a plain apostrophe in the feed ("St. John's").
  const name = place.name.replace(/[’‘]/g, "'").replace(/'/g, "''");
  const province = PROVINCES[place.province] ?? place.province;
  return `City eq '${name}' and StateOrProvince eq '${province.replace(/'/g, "''")}'`;
}

/**
 * The search's listings and DDF's, as one feed for the city: a home both
 * found shows once, as DDF's (the official record), keeping the earliest
 * date anyone saw it and its longer price history.
 */
export function combineFeeds(search, ddf) {
  if (!ddf?.listings?.length) return search;
  const base = search ?? { ...ddf, listings: [] };
  const official = ddf.listings;
  const byMls = new Map(official.filter((l) => l.mls).map((l) => [l.mls, l]));
  const byAddr = new Map(official.map((l) => [addressKey(l.address), l]));
  const merged = new Map(official.map((l) => [l.id, { ...l }]));
  const rest = [];
  for (const l of search?.listings ?? []) {
    const twin = (l.mls && byMls.get(l.mls)) || byAddr.get(addressKey(l.address));
    if (!twin) {
      rest.push(l);
      continue;
    }
    const cur = merged.get(twin.id);
    const earlier = String(l.firstSeen ?? '9999') < String(cur.firstSeen ?? '9999');
    merged.set(twin.id, {
      ...cur,
      firstSeen: earlier ? l.firstSeen : cur.firstSeen,
      priceHistory: longerHistory(l.priceHistory, cur),
      // Rents and a tax bill the search found stay, when DDF doesn't give them.
      taxes: cur.taxes ?? l.taxes ?? null,
      rents: cur.rents ?? l.rents ?? null,
      grossRent: cur.grossRent ?? l.grossRent ?? null,
    });
  }
  return { ...base, listings: [...merged.values(), ...rest], ddf: { at: ddf.updatedAt ?? null, count: official.length } };
}

/** The search's price history when it starts earlier, ending at DDF's price today. */
function longerHistory(found, cur) {
  const mine = Array.isArray(cur.priceHistory) ? cur.priceHistory : [];
  if (!Array.isArray(found) || !found.length || String(found[0]?.date ?? '') >= String(mine[0]?.date ?? '9999')) return mine;
  const last = found.at(-1);
  return (Number(last?.price) === Number(cur.price) ? found : [...found, { date: cur.lastSeen ?? cur.firstSeen, price: cur.price }]).slice(-12);
}

/** Keep only what cleanListing accepts, so a DDF property becomes a normal listing. */
export const ddfListing = (p, opts) => cleanListing(ddfToRaw(p, opts));
