// A property someone already owns, from what they know about it (the
// address, what they paid and when, the down payment, the mortgage payment,
// the rent), turned into a deal for the portfolio. What they don't know is
// worked out: the down payment as a %, the interest rate from the payment,
// what's owed today, and how fast its value has grown.

import { DEFAULT_DEAL, UNIT_TYPES, switchRules } from './presets.js';
import { cityByKey } from './canada.js';
import { loanRate, monthlyPI } from './finance.js';
import { CITY_VACANCY, INSURANCE_MIN, normalizeMarket } from './market.js';
import { cityInAddress } from './place.js';
import { kindOf, valueAdded } from './workValue.js';

const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Years from a purchase month ('YYYY-MM') to `today`, to the month; 0 for a future or missing date. */
export function yearsSince(month, today = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return 0;
  const months = (today.getFullYear() - Number(m[1])) * 12 + (today.getMonth() + 1 - Number(m[2]));
  return Math.max(months, 0) / 12;
}

/**
 * The yearly rate (as quoted in Canada, compounded twice a year) that makes
 * `loan` cost `payment` a month over `amortYears`. Null when the payment
 * couldn't pay the loan off (too small) or there's nothing to work from.
 */
export function rateFromPayment(loan, payment, amortYears) {
  const L = num(loan);
  const P = num(payment);
  const n = num(amortYears);
  if (!L || !P || !n || L <= 0 || P <= 0) return null;
  const pay = (r) => monthlyPI(L, loanRate(r, { country: 'ca' }), n);
  if (P < pay(0) - 0.5) return null; // less than the loan with no interest at all
  if (P > pay(30)) return null;
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pay(mid) < P) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/** Yearly growth from `price` to `worth` over `years`, as a %, when there's enough time to tell. */
export function growthPct(price, worth, years) {
  const p = num(price);
  const w = num(worth);
  if (!p || !w || p <= 0 || w <= 0 || years < 0.5) return null;
  const g = (Math.pow(w / p, 1 / years) - 1) * 100;
  return Math.round(Math.min(Math.max(g, -15), 25) * 10) / 10;
}

export const EMPTY_OWNED = { address: '', city: null, units: 1, price: null, bought: '', down: null, payment: null, rate: null, amortYears: 25, rent: null, taxes: null, worth: null, dscrLoan: false, work: null, workNotes: '', workItems: [] };

/**
 * Everything worked out from the form: `deal`, the fields to save, and what
 * was assumed, so the form can show it ({ downPct, rate, rateFrom, years,
 * appreciationPct, growthFrom, taxesFrom }). Null until there's a price.
 */
export function ownedDeal(form, market, today = new Date()) {
  const f = { ...EMPTY_OWNED, ...form };
  const m = normalizeMarket(market);
  const price = num(f.price);
  if (!price || price <= 0) return null;
  const city = cityByKey(f.city ?? cityInAddress(f.address) ?? m.city).key;
  const units = Math.min(Math.max(Math.round(num(f.units) ?? 1), 1), 200);
  const down = Math.min(Math.max(num(f.down) ?? price * 0.2, 0), price);
  const amortYears = Math.min(Math.max(num(f.amortYears) ?? 25, 1), 40);
  const years = yearsSince(f.bought, today);
  const fromPayment = rateFromPayment(price - down, f.payment, amortYears);
  const rate = fromPayment ?? num(f.rate) ?? m.rate;
  const rateFrom = fromPayment != null ? 'payment' : num(f.rate) != null ? 'you' : 'today';
  // Work put into the place: money spent, which (unless they tell us what it's worth) adds that much to its value.
  const items = Array.isArray(f.workItems) && f.workItems.length ? f.workItems.map(cleanWorkItem) : null;
  const work = items ? items.reduce((t, w) => t + w.cost, 0) : Math.max(num(f.work) ?? 0, 0);
  const added = items ? items.reduce((t, w) => t + valueAdded(w), 0) : valueAdded({ what: f.workNotes, cost: work });
  const growth = growthPct(price + added, f.worth, years);
  const appreciationPct = growth ?? 3;
  const taxes = num(f.taxes);
  const place = cityByKey(city);
  const street = String(f.address || '').split(',')[0].trim();
  const deal = {
    ...switchRules(DEFAULT_DEAL, 'ca'),
    name: street || 'My property',
    address: String(f.address || '').trim(),
    country: 'ca',
    city,
    status: 'owned',
    dscrLoan: f.dscrLoan === true,
    price,
    downPct: Math.round((down / price) * 10000) / 100,
    rate,
    refiRate: m.rate,
    termYears: amortYears,
    yearsOwned: Math.round(years * 100) / 100,
    unitType: UNIT_TYPES.find((t) => t.units === units && t.key !== 'multiplex')?.key ?? 'multiplex',
    units,
    rentPerUnit: Math.round((num(f.rent) ?? 0) / units),
    taxesAnnual: taxes ?? Math.round((price * (1 + appreciationPct / 100) ** years * (city === 'thunder-bay' ? m.taxPct : place.taxPct)) / 100),
    insuranceAnnual: Math.max(m.insurancePerUnit * units, INSURANCE_MIN),
    hoaMonthly: units >= 2 ? m.utilitiesPerUnit * units : 0,
    mgmtPct: m.mgmtPct,
    maintPct: m.maintPct,
    vacancyPct: CITY_VACANCY[city] ?? m.vacancyPct,
    capexPct: m.capexPct,
    appreciationPct,
    estimated: taxes == null,
    ...workPatch(items ? { price, items } : { price, work, notes: f.workNotes }),
    bought: /^\d{4}-\d{2}$/.test(f.bought) ? f.bought : '',
  };
  return {
    deal,
    downPct: deal.downPct,
    rate,
    rateFrom,
    years,
    appreciationPct,
    growthFrom: growth != null ? 'worth' : 'typical',
    taxesFrom: taxes != null ? 'you' : 'typical',
    work,
    added,
    highRate: rate > 12,
  };
}

const ITEM_ID = /^[A-Za-z0-9_-]{1,24}$/;
const newId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** One job done on the place: what, what it cost, and when ('YYYY-MM', optional). */
export function cleanWorkItem(w) {
  return {
    id: typeof w?.id === 'string' && ITEM_ID.test(w.id) ? w.id : newId(),
    what: String(w?.what ?? '').slice(0, 200),
    cost: Math.max(num(w?.cost) ?? 0, 0),
    when: /^\d{4}-\d{2}$/.test(String(w?.when ?? '')) ? w.when : '',
    // A repair (an expense that year) or an improvement (capital, claimed as CCA): their pick, or '' to go by the description.
    kind: w?.kind === 'repair' || w?.kind === 'improvement' ? w.kind : '',
    // What it adds to the home's value: their own figure, or null to go by the description and the cost studies.
    addsValue: w?.addsValue != null && w.addsValue !== '' && Number.isFinite(Number(w.addsValue)) ? Math.max(Number(w.addsValue), 0) : null,
  };
}

/**
 * Every job done on the homes you own, for a tax year's paperwork: those
 * dated in `year`, and those with no date (so they aren't missed). Each is
 * { property, address, what, cost, when, kind }.
 */
export function workForTax(deals, year) {
  const y = String(year);
  return (Array.isArray(deals) ? deals : [])
    .filter((d) => d?.status === 'owned')
    .flatMap((d) => workItemsOf(d).map((w) => ({ property: d.name || 'Property', address: d.address || '', ...w, kind: kindOf(w) })))
    .filter((w) => w.cost > 0 && (!w.when || w.when.startsWith(y)))
    .sort((a, b) => (a.when || '9999').localeCompare(b.when || '9999'));
}

/** The jobs on a deal; one from before jobs were listed separately (a single amount and note) becomes the first. */
export function workItemsOf(deal) {
  if (Array.isArray(deal?.workItems)) return deal.workItems.map(cleanWorkItem);
  const spent = Math.max(num(deal?.rehabCost) ?? 0, 0);
  return spent > 0 || deal?.workNotes ? [cleanWorkItem({ id: 'w0', what: deal?.workNotes ?? '', cost: spent })] : [];
}

/**
 * The deal fields for work put into an owned place: each job
 * (`workItems`), their total (`rehabCost`, so it counts as cash put in), a
 * one-line summary, and its value right after (`arv`): the price plus the
 * work unless they've said otherwise (`arvAuto`). A single `work` amount
 * with `notes` is one job.
 */
export function workPatch({ price, items, work, notes, arv, arvAuto = true }) {
  const list = (items ?? (num(work) > 0 || notes ? [{ what: notes, cost: work }] : [])).slice(0, 50).map(cleanWorkItem);
  const spent = list.reduce((t, w) => t + w.cost, 0);
  // Only what the work adds to the value goes into it: a new kitchen does, tree removal doesn't.
  const added = list.reduce((t, w) => t + valueAdded(w), 0);
  const auto = arvAuto !== false;
  return {
    workItems: list,
    rehabCost: spent,
    workNotes: list.map((w) => w.what.trim()).filter(Boolean).join(', ').slice(0, 500),
    arvAuto: auto,
    arv: auto ? (added > 0 ? Math.round((num(price) ?? 0) + added) : 0) : Math.max(num(arv) ?? 0, 0),
  };
}
