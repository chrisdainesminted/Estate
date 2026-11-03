// BRRRR: buy a home priced under the homes like it, renovate it, rent it,
// refinance at its new value to take your cash back out, and repeat.
// Each listing is measured against similar homes for sale in the same city
// (its likely value once fixed up), then run through the whole plan: what
// you put in, what the refinance hands back, the equity left behind, and
// what it rents for after. Then they're ranked.

import { loanRate, monthlyPI } from './finance.js';
import { transferTax } from './canada.js';
import { listingPageUrl, listingRent, listingTaxes, normalizeMarket, unitsOf, INSURANCE_MIN } from './market.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pos = (v) => Math.max(num(v), 0);

export const DEFAULT_BRRRR = {
  rehab: 30000, // your renovation budget for a house; add `rehabPerUnit` for each extra unit
  rehabPerUnit: 15000,
  months: 4, // buying to refinancing: renovation, then a tenant in
  downPct: 20, // rental purchases need at least 20% down in Canada
  refiPct: 80, // Canadian lenders refinance up to 80% of the appraised value
  refiCostPct: 1.5, // appraisal, legal and lender fees, of the new loan
  rehabs: {}, // your own estimate for a listing, by id
};

export function normalizeBrrrr(b) {
  const out = { ...DEFAULT_BRRRR };
  for (const k of ['rehab', 'rehabPerUnit', 'months', 'downPct', 'refiPct', 'refiCostPct']) if (b && Number.isFinite(Number(b[k]))) out[k] = Math.max(Number(b[k]), 0);
  out.downPct = Math.min(Math.max(out.downPct, 5), 100);
  out.refiPct = Math.min(out.refiPct, 80);
  out.rehabs = Object.fromEntries(Object.entries(b?.rehabs && typeof b.rehabs === 'object' ? b.rehabs : {}).filter(([k, v]) => /^[\w-]{1,80}$/.test(k) && Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Number(v)]));
  return out;
}

/** Bedrooms across all units ("2+1" is 3), or null when the listing doesn't say. */
export function bedsOf(listing) {
  const beds = Array.isArray(listing?.beds) ? listing.beds : listing?.beds != null ? [listing.beds] : [];
  let total = 0;
  let known = false;
  for (const b of beds) {
    const parts = String(b ?? '').match(/\d+/g);
    if (!parts) continue;
    known = true;
    total += parts.map(Number).reduce((x, y) => x + y, 0);
  }
  return known ? total : null;
}

// A unit in a building (an address like "303-235 Leland Avenue", or a listing
// that says condo) is only compared with other condos, never with whole houses.
const CONDO = /\b(condo(minium)?|apartment|strata)\b/i;
export const isCondo = (l) => /^\s*(unit\s*|suite\s*|#\s*)?\d+[a-z]?\s*-\s*\d+/i.test(String(l?.address ?? '')) || CONDO.test(`${l?.highlights ?? ''} ${l?.type ?? ''}`);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = (s.length - 1) / 2;
  return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2;
};

// Words sellers use for a home that needs work: a BRRRR buyer's best lead.
const FIXER = /\b(handyman|tlc|fixer|needs (some )?(work|updating|tlc|love)|as[- ]is|investor (special|alert)|estate sale|bring your (ideas|tools)|potential|renovat(e|ion) (needed|required)|sweat equity|vacant)\b/i;
export const needsWork = (listing) => FIXER.test(`${listing?.highlights ?? ''} ${listing?.description ?? ''}`);

/**
 * What a listing is likely worth once fixed up: the middle asking price of
 * similar homes for sale in the same city (the same number of units, and
 * within a bedroom where listings say), not counting the home itself.
 * Needs at least three; null otherwise.
 */
export function afterRepairValue(listing, listings) {
  const units = Math.min(unitsOf(listing), 5);
  const beds = bedsOf(listing);
  const condo = isCondo(listing);
  const others = listings.filter((l) => l.id !== listing.id && (l.status ?? 'active') === 'active' && num(l.price) > 0 && Math.min(unitsOf(l), 5) === units && isCondo(l) === condo);
  const close = beds != null ? others.filter((l) => bedsOf(l) != null && Math.abs(bedsOf(l) - beds) <= 1) : [];
  const comps = close.length >= 3 ? close : others;
  if (comps.length < 3) return null;
  return { value: Math.round(median(comps.map((l) => num(l.price))) / 1000) * 1000, count: comps.length, byBeds: comps === close, condo, comps: comps.map((l) => l.id) };
}

/**
 * One listing through the whole BRRRR plan. `market` is the city's listing
 * assumptions (rate, costs, rents); `plan` the BRRRR settings. Null when
 * there's no tax bill (no guessing) or nothing similar to compare it with.
 */
export function brrrrFor(listing, listings, market, plan = DEFAULT_BRRRR, city = 'thunder-bay') {
  const m = normalizeMarket(market);
  const p = normalizeBrrrr(plan);
  const taxes = listingTaxes(listing, m);
  const arv = afterRepairValue(listing, listings);
  if (!arv) return { listing, arv, missing: 'comps' };
  // Without the tax bill the monthly numbers stay unknown (no guessing); the value side still ranks.
  const taxKnown = taxes != null;
  const tax = taxKnown ? taxes : 0;
  const units = unitsOf(listing);
  const price = num(listing.price);
  const rehab = p.rehabs[listing.id] ?? p.rehab + p.rehabPerUnit * Math.max(units - 1, 0);
  const closing = (price * num(m.closingPct)) / 100 + transferTax(price, { city, units });
  const loan = (price * (100 - p.downPct)) / 100;
  const insurance = Math.max(m.insurancePerUnit * units, INSURANCE_MIN) / 12;
  const utilities = units >= 2 ? m.utilitiesPerUnit * units : 0;
  const rate = loanRate(m.rate, { country: 'ca' });
  // While it's being fixed up: interest on the loan, tax, insurance and utilities, and no rent.
  const holding = p.months * ((loan * rate) / 1200 + tax / 12 + insurance + utilities);
  const cashIn = price - loan + closing + rehab + holding;
  const allIn = price + closing + rehab + holding;
  const newLoan = (arv.value * p.refiPct) / 100;
  const refiCost = (newLoan * p.refiCostPct) / 100;
  const cashBack = newLoan - loan - refiCost;
  const cashLeft = cashIn - cashBack;
  const equity = arv.value - newLoan;
  const created = arv.value - allIn; // value added beyond everything spent
  // Renting it after the refinance.
  const rent = listingRent(listing, m);
  const payment = monthlyPI(newLoan, rate, m.amortYears);
  const opex = (rent.total * (m.mgmtPct + m.maintPct + m.vacancyPct + m.capexPct)) / 100;
  const cashFlow = taxKnown ? rent.total - opex - tax / 12 - insurance - utilities - payment : null;
  const discount = 1 - price / arv.value;
  const back = cashIn > 0 ? Math.min(cashBack / cashIn, 1.5) : 0;
  // The score: how far under its neighbours it's priced once the work is paid
  // for (the most weight), how much of your cash comes back, and whether the
  // rent covers everything after.
  // Up to 60 points for value added (40% of the value or more earns them all), 25 for
  // getting all your cash back, 15 for rent that covers everything (less as it runs short).
  const valuePts = Math.min(Math.max(created / arv.value, 0) * 150, 60);
  const backPts = Math.min(Math.max(back, 0), 1) * 25;
  const flowPts = cashFlow == null ? 0 : cashFlow >= 0 ? Math.min(15, 8 + cashFlow / 50) : Math.max(0, 8 + cashFlow / 25);
  const score = Math.round(valuePts + backPts + flowPts);
  const grade =
    cashFlow == null ? (created > 0 ? 'unknownRent' : 'weak') : created >= arv.value * 0.15 && back >= 0.75 && cashFlow >= 0 ? 'strong' : created > 0 && cashFlow >= -150 ? 'maybe' : 'weak';
  return {
    listing,
    arv,
    units,
    price,
    rehab,
    rehabOwn: p.rehabs[listing.id] != null,
    closing,
    holding,
    loan,
    cashIn,
    allIn,
    newLoan,
    refiCost,
    cashBack,
    cashLeft,
    equity,
    created,
    discount,
    back,
    rent: rent.total,
    rentSource: rent.source,
    payment,
    cashFlow,
    score,
    grade,
    taxKnown,
    fixer: needsWork(listing),
    url: listingPageUrl(listing.url, listing.address),
  };
}

export const GRADES = {
  strong: { label: 'Strong BRRRR', tone: 'good', text: 'Value added is at least 15% of what it’d be worth, most of your cash comes back, and the rent covers it after.' },
  maybe: { label: 'Could work', tone: 'warn', text: 'Adds value, but leaves more cash in or runs close to break-even. Check the rehab budget.' },
  unknownRent: { label: 'Priced under, tax not listed', tone: 'warn', text: 'Adds value, but the listing gives no tax bill, so what it rents for after the refinance is unknown. Ask the agent for it.' },
  weak: { label: 'Weak', tone: 'muted', text: 'Costs about what it would be worth once fixed, or the rent doesn’t cover it.' },
};

/** Every listing ranked for BRRRR, best first; ones with nothing similar to compare against last. */
export function rankBrrrr(listings, market, plan, city, { hidden = [] } = {}) {
  const hide = new Set(hidden);
  const active = (listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && num(l.price) > 0 && listingPageUrl(l.url, l.address));
  const all = active.filter((l) => !hide.has(l.id)).map((l) => brrrrFor(l, active, market, plan, city));
  const ranked = all.filter((r) => !r.missing).sort((a, b) => b.score - a.score || b.created - a.created);
  ranked.forEach((r, i) => (r.rank = i + 1));
  return { ranked, unranked: all.filter((r) => r.missing) };
}
