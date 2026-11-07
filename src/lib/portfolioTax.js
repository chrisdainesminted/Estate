// A tax year's rental expenses for the homes you own in Portfolio, laid out
// by the CRA's form T776 lines, so the landlord's Expenses & taxes has them
// without typing them in again:
//
// - 8710 Interest: mortgage interest for the months owned that year, from
//   the loan's own schedule (price, down payment, rate, amortization).
// - 9180 Property taxes, 8690 Insurance, 9220 Utilities the owner pays:
//   the yearly amounts in Portfolio, for the months owned.
// - 8960 Repairs and maintenance: jobs marked as repairs, dated that year.
// - Improvements dated that year: capital, claimed over years as capital
//   cost allowance (class 8 for appliances and furniture, class 1 for the
//   building and what's built into it).
//
// Each line carries a `source` key, so it's added once and kept in step.

import { analyzeDeal, loanTimeline } from './finance.js';
import { workItemsOf } from './ownedHome.js';
import { kindOf } from './workValue.js';

const round2 = (v) => Math.round(v * 100) / 100;
const ym = (d) => d.getFullYear() * 12 + d.getMonth(); // months since year 0
const fromYm = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;

/** The month a deal was bought: its purchase month, or worked back from how long it's been owned. */
export function boughtMonth(deal, today = new Date()) {
  if (/^\d{4}-\d{2}$/.test(String(deal?.bought ?? ''))) {
    const [y, m] = deal.bought.split('-').map(Number);
    return y * 12 + (m - 1);
  }
  return ym(today) - Math.round(Math.max(Number(deal?.yearsOwned) || 0, 0) * 12);
}

const APPLIANCE = /\b(appliance|fridge|refrigerator|stove|range|oven|washer|dryer|dishwasher|microwave|furniture|furnish)/i;
/** The capital cost allowance class for an improvement: 8 for appliances and furniture, 1 for the building. */
export const ccaClassFor = (what) => (APPLIANCE.test(String(what ?? '')) ? '8' : '1');

/**
 * Everything Portfolio knows for `year`: { expenses, assets, undated }.
 * expenses: { source, home, category, line, label, amount, date, note, estimate }
 * assets: { source, home, label, ccaClass, cost, available }
 * undated: work with no month, which can't be placed in a year.
 */
export function portfolioTaxLines(deals, year, today = new Date()) {
  const y = Number(year);
  const nowYm = ym(today);
  const expenses = [];
  const assets = [];
  const undated = [];
  for (const d of Array.isArray(deals) ? deals : []) {
    if (d?.status !== 'owned' || d.example) continue;
    const home = d.name || d.address || 'Property';
    const start = boughtMonth(d, today);
    const first = Math.max(y * 12, start);
    const last = Math.min(y * 12 + 11, nowYm);
    const months = Math.max(last - first + 1, 0);
    const endDate = last >= first ? (last === nowYm ? today.toISOString().slice(0, 10) : `${fromYm(last)}-${new Date(Math.floor(last / 12), (last % 12) + 1, 0).getDate()}`) : `${y}-12-31`;
    const owned = months > 0 ? `${months === 12 ? 'the whole year' : `${months} ${months === 1 ? 'month' : 'months'}`}` : '';
    const add = (key, category, amount, label, estimate = false) => {
      if (!(amount > 0.005)) return;
      expenses.push({ source: `pf:${d.id}:${y}:${key}`, home, category, amount: round2(amount), date: endDate, label, note: `${home}: ${label} (from Portfolio${estimate ? ', an estimate: check your statements' : ''})`, estimate });
    };
    if (months > 0) {
      // Mortgage interest, month by month from the loan's schedule.
      const a = analyzeDeal(d);
      if (a.loanAmount > 0) {
        const { rows } = loanTimeline(d, last - start + 1);
        let interest = 0;
        for (let mm = first; mm <= last; mm++) interest += rows[mm - start]?.interest ?? 0;
        add('interest', 'interest', interest, `mortgage interest, ${owned}`);
      }
      add('propertyTax', 'propertyTax', (Number(d.taxesAnnual) || 0) * (months / 12), `property tax, ${owned}`, d.estimated === true);
      add('insurance', 'insurance', (Number(d.insuranceAnnual) || 0) * (months / 12), `insurance, ${owned}`, true);
      add('utilities', 'utilities', (Number(d.hoaMonthly) || 0) * months, `utilities you pay, ${owned}`, true);
    }
    for (const w of workItemsOf(d)) {
      if (!(w.cost > 0)) continue;
      if (!w.when) {
        undated.push({ home, what: w.what || 'Work', cost: w.cost });
        continue;
      }
      if (!w.when.startsWith(String(y))) continue;
      const [wy, wm] = w.when.split('-').map(Number);
      const date = `${w.when}-${new Date(wy, wm, 0).getDate()}`;
      if (kindOf(w) === 'repair') {
        expenses.push({ source: `pf:${d.id}:${w.id}`, home, category: 'repairs', amount: round2(w.cost), date, label: w.what || 'Repair', note: `${home}: ${w.what || 'repair'} (from Portfolio)`, estimate: false });
      } else {
        assets.push({ source: `pf:${d.id}:${w.id}`, home, label: `${home}: ${w.what || 'Improvement'}`.slice(0, 120), ccaClass: ccaClassFor(w.what), cost: round2(w.cost), available: `${w.when}-01` });
      }
    }
  }
  return { expenses, assets, undated };
}
