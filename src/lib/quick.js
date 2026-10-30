// The quick check: a deal from just a price, a rent and a property type.
// Everything else starts at typical values the person can change later.

import { cityByKey } from './canada.js';
import { OWN_DOWN_PCT } from './finance.js';
import { DEFAULT_MARKET, INSURANCE_MIN, normalizeMarket } from './market.js';
import { DEFAULT_DEAL, UNIT_TYPES } from './presets.js';

// US estimates as shares of the price, from the default deal: 1.2% tax and 0.6% insurance a year.
const US_TAX_SHARE = DEFAULT_DEAL.taxesAnnual / DEFAULT_DEAL.price;
const US_INSURANCE_SHARE = DEFAULT_DEAL.insuranceAnnual / DEFAULT_DEAL.price;

const round100 = (x) => Math.round(x / 100) * 100;

/** "$300k" or "$1.2M": short enough for a deal name. */
export function shortPrice(price) {
  const p = Math.max(Number(price) || 0, 0);
  if (p >= 1e6) return `$${(p / 1e6).toFixed(p >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  return `$${Math.round(p / 1000)}k`;
}

/**
 * The fields of a new deal from a quick check. US deals scale the default
 * taxes and insurance to the price; Canadian ones follow the listing
 * assumptions (the city's province's rules and property tax, the regular
 * mortgage with 20% down, insurance, utilities and running costs).
 */
export function quickDeal({ price, rentPerUnit, unitType, units, country, city = 'thunder-bay' }, market = DEFAULT_MARKET) {
  const type = UNIT_TYPES.find((t) => t.key === unitType) ?? UNIT_TYPES[0];
  const n = type.key === 'multiplex' ? Math.max(Math.round(Number(units) || type.units), 5) : type.units;
  const p = Math.max(Number(price) || 0, 0);
  const common = {
    name: `${shortPrice(p)} ${type.key === 'multiplex' ? `${n}-unit` : type.label}`,
    price: p,
    unitType: type.key,
    units: n,
    rentPerUnit: Math.max(Number(rentPerUnit) || 0, 0),
    // Taxes and insurance are guessed from the price until someone types real ones.
    estimated: true,
  };
  if (country !== 'ca') {
    return { ...common, country: 'us', taxesAnnual: round100(p * US_TAX_SHARE), insuranceAnnual: round100(p * US_INSURANCE_SHARE) };
  }
  const m = normalizeMarket(market);
  return {
    ...common,
    country: 'ca',
    city: cityByKey(city).key,
    downPct: OWN_DOWN_PCT,
    rate: m.rate,
    refiRate: m.rate,
    termYears: m.amortYears,
    closingPct: m.closingPct,
    // The listing assumptions' tax rate is Thunder Bay's; elsewhere, the city's typical rate.
    taxesAnnual: round100((p * (cityByKey(city).key === 'thunder-bay' ? m.taxPct : cityByKey(city).taxPct)) / 100),
    insuranceAnnual: Math.max(m.insurancePerUnit * n, INSURANCE_MIN),
    hoaMonthly: n >= 2 ? m.utilitiesPerUnit * n : 0,
    mgmtPct: m.mgmtPct,
    maintPct: m.maintPct,
    vacancyPct: m.vacancyPct,
    capexPct: m.capexPct,
  };
}
