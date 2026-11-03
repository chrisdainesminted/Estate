// Where a Canadian deal is, and what follows from it. A deal's city sets
// its province's land transfer tax; moving it to another city also moves
// the figures Squarely filled in from the old one (the estimated property
// tax, and a market rent for a bedroom count) to the new city's. Anything
// typed in by hand stays as it is.

import { CITIES, cityByKey } from './canada.js';
import { dealPlace } from './finance.js';
import { CITY_VACANCY, localMarket, normalizeMarket } from './market.js';
import { DEFAULT_DEAL } from './presets.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round100 = (x) => Math.round(x / 100) * 100;
const plain = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\./g, '')
    .replace(/[^a-z' -]/g, ' ')
    .replace(/\s+/g, ' ');

// The names a city goes by in an address.
const ALIASES = {
  kitchener: ['kitchener', 'waterloo', 'kitchener-waterloo'],
  sudbury: ['sudbury', 'greater sudbury'],
  'quebec-city': ['quebec city', 'ville de quebec'],
  'st-johns': ["st john's", 'st johns', "saint john's"],
  'saint-john': ['saint john'],
};
const NAMES = CITIES.filter((c) => !c.key.endsWith('-other')).flatMap((c) => (ALIASES[c.key] ?? [plain(c.name)]).map((n) => [n, c.key]));

/**
 * The city an address names, or null: "230 Brodie Street N, Thunder Bay, ON"
 * is Thunder Bay. Only the part after the first comma counts when there is
 * one, so a street named for a city ("Victoria Ave") doesn't. The last city
 * named wins.
 */
export function cityInAddress(address) {
  const raw = String(address ?? '');
  const tail = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const text = ` ${plain(tail)} `;
  let best = null;
  for (const [name, key] of NAMES) {
    const at = text.lastIndexOf(` ${name} `);
    if (at >= 0 && (!best || at > best.at || (at === best.at && name.length > best.len))) best = { at, key, len: name.length };
  }
  return best?.key ?? null;
}

/** A city's typical property tax as a % of the price, the way new deals estimate it. */
function taxPct(cityKey, market) {
  const m = normalizeMarket(market);
  return cityKey === 'thunder-bay' ? m.taxPct : cityByKey(cityKey).taxPct;
}

/**
 * What changes when a Canadian deal moves to `to`: its city, and the figures
 * that were the old city's estimates. { patch, changed } where `changed`
 * names what moved, for telling the person.
 */
export function moveToCity(deal, to, market) {
  const from = dealPlace(deal).key;
  const next = cityByKey(to).key;
  const patch = { city: next };
  const changed = [];
  if (from === next) return { patch, changed };
  const price = num(deal.price);
  const tax = num(deal.taxesAnnual);
  // Still the starting figure or the old city's estimate: the new city's estimate instead.
  if (price > 0 && (deal.estimated || tax === DEFAULT_DEAL.taxesAnnual || tax === round100((price * taxPct(from, market)) / 100))) {
    const t = round100((price * taxPct(next, market)) / 100);
    if (t !== tax) {
      patch.taxesAnnual = t;
      patch.estimated = true;
      changed.push('property tax estimate');
    }
  }
  const oldRents = localMarket(market, from).rents;
  const newRents = localMarket(market, next).rents;
  const b = Object.keys(oldRents).find((k) => oldRents[k] === num(deal.rentPerUnit));
  if (b != null && newRents[b] !== num(deal.rentPerUnit)) {
    patch.rentPerUnit = newRents[b];
    changed.push('market rent');
  }
  // A starting vacancy figure, or the old city's surveyed rate: the new city's, where it's surveyed.
  const vac = num(deal.vacancyPct);
  if (CITY_VACANCY[next] != null && ([4, 5].includes(vac) || vac === CITY_VACANCY[from]) && vac !== CITY_VACANCY[next]) {
    patch.vacancyPct = CITY_VACANCY[next];
    changed.push('vacancy rate');
  }
  return { patch, changed };
}

/** "Thunder Bay, ON", or "Elsewhere in Ontario". */
export function placeLabel(deal) {
  const c = dealPlace(deal);
  return c.key.endsWith('-other') ? c.name : `${c.name}, ${c.province}`;
}
