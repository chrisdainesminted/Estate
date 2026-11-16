// Your cash, compared: with what you have saved, is it better to buy one
// rental or split it across two or three? From the city's real listings
// (only those with a real tax bill), each bought with 20% down at a bank's
// rate as rentals must be, the best one, two and three homes the cash can
// cover, measured by their first year: the cash flow left after every
// cost, plus the mortgage principal the tenants pay down. Homes that would
// cost you money each month are left out.

import { dedupeListings, scoreListing, unitsOf } from './market.js';

/** How many of the best candidates the two- and three-home searches look through. */
const POOL = 40;

const one = (s) => ({
  s,
  cash: s.a.cashInvested,
  monthly: s.a.netCashFlow,
  principal: s.a.year1Principal,
  total: s.a.annualCashFlow + s.a.year1Principal,
  doors: unitsOf(s.listing),
});

/** Every home the cash could buy on its own, as rentals: 20% down, real tax bill, cash flow of at least $0. */
export function candidates(listings, market, cash) {
  const m = { ...market, lens: 'own' };
  return dedupeListings((listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && Number(l.price) > 0))
    .map((l) => scoreListing(l, m))
    .filter((s) => !s.needsTax && s.a.netCashFlow >= 0 && s.a.cashInvested <= cash)
    .map(one);
}

function option(homes, cash, savingsPct) {
  const sum = (k) => homes.reduce((t, h) => t + h[k], 0);
  const cashIn = sum('cash');
  const left = cash - cashIn;
  const interest = savingsPct > 0 ? left * (savingsPct / 100) : 0;
  const total = sum('total') + interest;
  return {
    count: homes.length,
    homes: homes.map((h) => h.s),
    cashIn,
    left,
    monthly: sum('monthly'),
    principal: sum('principal'),
    interest,
    total,
    doors: sum('doors'),
    // The first year's return on everything you started with, the idle cash included.
    returnPct: cash > 0 ? total / cash : 0,
  };
}

/**
 * The best way to put `cash` to work with one, two, … `maxHomes` homes:
 * [{ count, homes, cashIn, left, monthly, principal, interest, total,
 * doors, returnPct }], one entry per count that the cash can cover. With
 * `savingsPct`, the cash not spent earns that rate, and an entry with
 * count 0 is keeping all of it there.
 */
export function cashOptions({ listings, market, cash, maxHomes = 3, savingsPct = 0 }) {
  const budget = Number(cash) || 0;
  if (budget <= 0) return [];
  const all = candidates(listings, market, budget);
  // The best by return on the cash they take, and the best outright: good pairs and threes come from both.
  const byEfficiency = [...all].sort((a, b) => b.total / b.cash - a.total / a.cash).slice(0, POOL);
  const byTotal = [...all].sort((a, b) => b.total - a.total).slice(0, POOL);
  const pool = [...new Set([...byEfficiency, ...byTotal])];

  const out = [];
  if (savingsPct > 0) out.push(option([], budget, savingsPct));
  let best1 = null;
  for (const h of all) if (!best1 || h.total > best1.total) best1 = h;
  if (best1) out.push(option([best1], budget, savingsPct));
  const pick = (k) => {
    let best = null;
    const walk = (start, chosen, spent, total) => {
      if (chosen.length === k) {
        if (!best || total > best.total) best = { homes: [...chosen], total };
        return;
      }
      for (let i = start; i < pool.length; i++) {
        const h = pool[i];
        if (spent + h.cash > budget) continue;
        chosen.push(h);
        walk(i + 1, chosen, spent + h.cash, total + h.total);
        chosen.pop();
      }
    };
    walk(0, [], 0, 0);
    return best && option(best.homes, budget, savingsPct);
  };
  for (let k = 2; k <= maxHomes; k++) {
    const o = pick(k);
    if (o) out.push(o);
  }
  return out;
}

/** The option that returns the most in the first year, or null. */
export const bestOption = (options) => options.reduce((b, o) => (!b || o.total > b.total ? o : b), null);
