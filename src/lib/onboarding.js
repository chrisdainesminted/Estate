// The questions a new account answers once: what they're here for, and the
// numbers that turn into their own ranges (what they can buy, comfortably
// and at most; what their cash buys as a rental; their portfolio's size).

import { cityByKey, incomeTax } from './canada.js';
import { RULES, buyCheck, closingCash, maxPrice, normalizeProfile } from './firstHome.js';

export const GOALS = [
  { value: 'buy', label: 'Buy a home', hint: 'To live in, maybe with a unit to rent out' },
  { value: 'invest', label: 'Invest in rentals', hint: 'Find, run the numbers on and manage properties' },
  { value: 'sell', label: 'Sell a property', hint: 'What it’s worth and what you’d walk away with' },
];

export const PORTFOLIO = [
  { value: '0', label: 'None yet' },
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-100', label: '51–100' },
  { value: '100+', label: '100+' },
];

export const FINANCE = [
  { value: 'bank', label: 'A bank mortgage', hint: 'On your income, usually 20% down on a rental' },
  { value: 'dscr', label: 'A rental (DSCR) loan', hint: 'On the property’s rent, not your income' },
  { value: 'cash', label: 'All cash', hint: 'No mortgage' },
];

export const DEFAULT_ONBOARDING = { done: false, skipped: false, at: null, goals: [], portfolio: null, investCash: null, finance: null };

const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : null);

export function normalizeOnboarding(o) {
  const out = { ...DEFAULT_ONBOARDING };
  if (!o || typeof o !== 'object') return out;
  out.done = o.done === true;
  out.skipped = o.skipped === true;
  out.at = typeof o.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.at) ? o.at : null;
  out.goals = [...new Set((Array.isArray(o.goals) ? o.goals : []).filter((g) => GOALS.some((x) => x.value === g)))];
  out.portfolio = PORTFOLIO.some((x) => x.value === o.portfolio) ? o.portfolio : null;
  out.investCash = num(o.investCash);
  out.finance = FINANCE.some((x) => x.value === o.finance) ? o.finance : null;
  return out;
}

/** The mode the app opens in: the first thing they said they're here for. */
export const startMode = (goals) => (goals?.[0] === 'invest' ? 'invest' : goals?.[0] === 'sell' ? 'sell' : 'buy');

/**
 * What a household can spend on housing each month and still live the way
 * it does: take-home pay, less everyday costs and debt payments, less a
 * tenth of take-home kept for savings and surprises. Null without living costs.
 */
export function comfortBudget({ income, living, debts = 0, province = 'ON' }) {
  if (num(living) == null || !num(income)) return null;
  const takeHome = (num(income) - incomeTax(num(income), province)) / 12;
  const budget = takeHome * 0.9 - num(living) - (num(debts) ?? 0);
  return { takeHome: Math.round(takeHome), budget: Math.max(Math.round(budget), 0) };
}

function highest(ok, hi = 3000000) {
  let lo = 0;
  let top = hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + top) / 2;
    if (ok(mid)) lo = mid;
    else top = mid;
  }
  return Math.floor(lo / 1000) * 1000;
}

/**
 * A buyer's range for a home on their own: `comfortable`, the price whose
 * monthly cost (mortgage at today's rate, property tax, heat and insurance)
 * fits their comfort budget, and `max`, the most a bank would lend on that
 * their savings also cover. `comfortable` is never above `max`; it's null
 * without living costs.
 */
export function buyingRange({ profile, living, ratePct, insuranceMonthly = 0 }) {
  const p = normalizeProfile(profile);
  const city = cityByKey(p.city);
  const taxPct = p.taxPct ?? city.taxPct;
  const max = maxPrice({ profile: p, units: 1, ratePct, taxPct, city: city.key });
  const comfort = comfortBudget({ income: p.income, living, debts: p.debts, province: city.province });
  const monthlyAt = (price) => {
    const c = buyCheck({ profile: p, price, units: 1, ratePct, taxesMonthly: (price * taxPct) / 1200, city: city.key });
    return c.plan.payment + (price * taxPct) / 1200 + RULES.heatMonthly + num(insuranceMonthly);
  };
  const comfortable = comfort ? Math.min(highest((price) => monthlyAt(price) <= comfort.budget), max.price) : null;
  return {
    max: max.price,
    byIncome: max.byIncome,
    bySavings: max.bySavings,
    limit: max.limit,
    comfortable,
    budget: comfort?.budget ?? null,
    takeHome: comfort?.takeHome ?? null,
    monthlyAtMax: max.price > 0 ? Math.round(monthlyAt(max.price)) : 0,
    monthlyAtComfort: comfortable ? Math.round(monthlyAt(comfortable)) : null,
  };
}

/**
 * The most a rental can cost with the cash someone has to invest: 20% down
 * and closing costs on a mortgage (bank or rental loan), or the whole price
 * and closing costs in cash. Null without cash.
 */
export function investingReach({ cash, finance = 'bank', city, units = 2 }) {
  const c = num(cash);
  if (!c) return null;
  const where = cityByKey(city).key;
  const share = finance === 'cash' ? 1 : 0.2;
  const price = highest((p) => p * share + closingCash({ price: p, units, firstTime: false, city: where }).total <= c, 20000000);
  return { price, down: Math.round(price * share), closing: Math.round(closingCash({ price, units, firstTime: false, city: where }).total), share };
}
