// Growth plan: month by month, how fast savings, cash flow and refinance
// cash let you keep buying a repeatable deal, while holding every lender's
// reserves. Pure functions; the UI only renders what this returns.

import { analyzeDeal, loanTimeline, projectDeal, startingValue } from './finance.js';

export const DEFAULT_PLAN = {
  cashOnHand: 100000,
  monthlySavings: 3000,
  reinvest: true,
  templateId: null,
  targetDoors: 20,
};

const num = (v) => Number(v) || 0;
const pct = (v) => num(v) / 100;

/**
 * The template deal as it would be priced `months` from now: price, value,
 * rehab and taxes follow appreciation; rent follows rent growth; insurance
 * and HOA follow expense growth.
 */
export function dealAt(template, months) {
  const t = months / 12;
  const appr = Math.pow(1 + pct(template.appreciationPct), t);
  const rent = Math.pow(1 + pct(template.rentGrowthPct), t);
  const exp = Math.pow(1 + pct(template.expenseGrowthPct), t);
  return {
    ...template,
    price: num(template.price) * appr,
    arv: num(template.arv) * appr,
    rehabCost: num(template.rehabCost) * appr,
    taxesAnnual: num(template.taxesAnnual) * appr,
    rentPerUnit: num(template.rentPerUnit) * rent,
    insuranceAnnual: num(template.insuranceAnnual) * exp,
    hoaMonthly: num(template.hoaMonthly) * exp,
  };
}

// One property in the simulation: its projection indexed by age in months.
function holding(deal, ageAtStart, horizonMonths, boughtAt) {
  const a = analyzeDeal(deal);
  const span = ageAtStart + horizonMonths + 12;
  const years = Math.ceil(span / 12);
  const rows = projectDeal(deal, years);
  const { rows: loan, refi } = loanTimeline(deal, years * 12);
  const base = startingValue(deal);
  const growth = 1 + pct(deal.appreciationPct);
  return {
    deal,
    a,
    ageAtStart,
    boughtAt,
    refiAge: refi ? refi.month : null,
    refiCash: refi ? refi.cashOut : 0,
    // Monthly cash flow in the ownership year containing month `age` (1-based).
    cashFlowAt: (age) => (age >= 1 ? rows[Math.ceil(age / 12) - 1].cashFlow / 12 : 0),
    equityAt: (age) => {
      const value = base * Math.pow(growth, age / 12);
      const balance = age >= 1 ? loan[age - 1].balance : a.loanAmount;
      return { value, balance };
    },
  };
}

/**
 * Simulate `years` of buying. Each month: savings arrive, cash flow arrives
 * (if reinvested), refinance cash-outs arrive; then buy as many copies of
 * the template as cash allows while still holding reserves for every
 * property, until the door target is reached.
 *
 * owned: deals already owned (their yearsOwned sets their age today).
 */
export function simulateGrowth({ owned = [], template = null, plan = DEFAULT_PLAN, years = 10 }) {
  const months = years * 12;
  const props = owned.map((d) => holding(d, Math.round(num(d.yearsOwned) * 12), months, null));
  let cash = Math.max(num(plan.cashOnHand), 0);
  const savings = Math.max(num(plan.monthlySavings), 0);
  const target = Math.max(Math.round(num(plan.targetDoors)), 0);
  const doorsOf = () => props.reduce((s, p) => s + p.a.units, 0);
  const reservesOf = () => props.reduce((s, p) => s + p.a.reserves, 0);

  const purchases = [];
  const monthly = [];
  let cashFlowTaken = 0;

  const ageOf = (p, m) => p.ageAtStart + (p.boughtAt == null ? m : m - p.boughtAt);

  const snapshot = (m) => {
    let value = 0;
    let debt = 0;
    let cf = 0;
    props.forEach((p) => {
      const age = ageOf(p, m);
      const e = p.equityAt(age);
      value += e.value;
      debt += e.balance;
      cf += p.cashFlowAt(Math.max(age, 1));
    });
    return { month: m, doors: doorsOf(), properties: props.length, cash, reserves: reservesOf(), value, debt, equity: value - debt, monthlyCashFlow: cf };
  };

  const buyWhileAffordable = (m) => {
    if (!template) return;
    for (;;) {
      if (target && doorsOf() >= target) return;
      const deal = dealAt(template, m);
      const a = analyzeDeal(deal);
      // A cent of slack so floating-point rounding never blocks an exactly-funded purchase.
      if (!(a.cashInvested > 0) || cash - a.cashInvested < reservesOf() + a.reserves - 0.01) return;
      cash -= a.cashInvested;
      props.push(holding(deal, 0, months - m, m));
      purchases.push({ month: m, price: a.price, cashInvested: a.cashInvested, reserves: a.reserves, monthlyCashFlow: a.netCashFlow, doorsAfter: doorsOf() });
    }
  };

  monthly.push(snapshot(0));
  buyWhileAffordable(0);
  for (let m = 1; m <= months; m++) {
    let cf = 0;
    let refiCash = 0;
    props.forEach((p) => {
      const age = ageOf(p, m);
      if (age < 1) return;
      cf += p.cashFlowAt(age);
      if (p.refiAge === age) refiCash += p.refiCash;
    });
    cash += savings + refiCash;
    if (plan.reinvest) cash += cf;
    else cashFlowTaken += cf;
    buyWhileAffordable(m);
    monthly.push(snapshot(m));
  }

  const yearly = monthly.filter((s) => s.month % 12 === 0).map((s) => ({ ...s, year: s.month / 12 }));
  const end = monthly[monthly.length - 1];
  const start = monthly[0];
  return {
    purchases,
    monthly,
    yearly,
    start,
    end,
    nextPurchase: purchases[0] ?? null,
    cashFlowTaken,
    template: template ? analyzeDeal(template) : null,
  };
}
