// Pure calculation engine. All percentage inputs on a deal are whole numbers
// (7 means 7%); dollar amounts are as labelled (annual taxes/insurance,
// monthly HOA and rent). Nothing here touches React or the DOM.

import { dscrStatus } from './dscr.js';

const pct = (v) => (Number(v) || 0) / 100;
const num = (v) => Number(v) || 0;

/** Monthly principal & interest payment. Falls back to straight-line when the rate is 0. */
export function monthlyPI(principal, annualRatePct, termYears) {
  const P = num(principal);
  const n = Math.round(num(termYears) * 12);
  if (P <= 0 || n <= 0) return 0;
  const r = pct(annualRatePct) / 12;
  if (r === 0) return P / n;
  const f = Math.pow(1 + r, n);
  return (P * r * f) / (f - 1);
}

/** Interest-only months, capped so at least one year of amortization remains. */
function ioMonthsFor(termYears, ioYears) {
  const n = Math.round(num(termYears) * 12);
  return Math.min(Math.max(Math.round(num(ioYears) * 12), 0), Math.max(n - 12, 0));
}

/**
 * Month-by-month schedule for the first `months` months. With `ioYears`, the
 * loan pays interest only for that period, then amortizes the full balance
 * over the remaining term (the usual DSCR interest-only structure).
 * Returns [{ month, payment, interest, principal, balance }].
 */
export function amortize(principal, annualRatePct, termYears, months, ioYears = 0) {
  const n = Math.round(num(termYears) * 12);
  const r = pct(annualRatePct) / 12;
  const ioMonths = ioMonthsFor(termYears, ioYears);
  const amortizing = monthlyPI(principal, annualRatePct, (n - ioMonths) / 12);
  const rows = [];
  let balance = num(principal);
  for (let m = 1; m <= months; m++) {
    if (m > n || balance <= 0) {
      rows.push({ month: m, payment: 0, interest: 0, principal: 0, balance: 0 });
      continue;
    }
    const interest = balance * r;
    if (m <= ioMonths) {
      rows.push({ month: m, payment: interest, interest, principal: 0, balance });
      continue;
    }
    const principalPaid = Math.min(amortizing - interest, balance);
    balance -= principalPaid;
    rows.push({ month: m, payment: principalPaid + interest, interest, principal: principalPaid, balance });
  }
  return rows;
}

/** Internal rate of return for annual cash flows (flows[0] is today). NaN if none exists. */
export function irr(flows) {
  const npv = (rate) => flows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = npv(mid);
    if (Math.abs(f) < 1e-7 || hi - lo < 1e-10) return mid;
    if (f * fLo > 0) {
      lo = mid;
      fLo = f;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Step-down prepayment penalties common on DSCR loans, as % of the balance paid off in loan year 1, 2, ... */
export const PREPAY_SCHEDULES = {
  none: [],
  '3-2-1': [3, 2, 1],
  '5-4-3-2-1': [5, 4, 3, 2, 1],
};

/**
 * Penalty rate for paying a loan off after `ageMonths`. A payoff at the
 * end of month 12 still counts as loan year 1 (paid before the anniversary).
 */
export function prepayRate(schedule, ageMonths) {
  const steps = PREPAY_SCHEDULES[schedule] ?? [];
  const year = Math.max(Math.ceil(ageMonths / 12), 1);
  return (steps[year - 1] ?? 0) / 100;
}

/** The property's value right after any rehab: the after-repair value when given, else the price. */
export function startingValue(deal) {
  const arv = num(deal.arv);
  return arv > 0 ? arv : num(deal.price);
}

/** Month of a planned cash-out refinance (end of its year), or null. Never in the sale year. */
function refiMonthFor(deal, horizonMonths) {
  if (!deal.refiEnabled) return null;
  const m = Math.min(Math.max(Math.round(num(deal.refiYear) || 1), 1), 29) * 12;
  return m < horizonMonths ? m : null;
}

/**
 * Month-by-month debt over `months`: the purchase loan, then (optionally)
 * a cash-out refinance at the end of refiYear that pays it off and starts
 * a new amortizing loan. Rows carry the age of whichever loan is active so
 * a payoff can be charged its prepayment penalty.
 */
export function loanTimeline(deal, months) {
  const price = num(deal.price);
  const loan = Math.max(price - price * pct(deal.downPct), 0);
  const refiMonth = refiMonthFor(deal, months + 1);
  const firstLen = refiMonth ?? months;
  const rows = amortize(loan, deal.rate, deal.termYears, Math.min(firstLen, months), deal.ioYears).map((r) => ({ ...r, loanAge: r.month }));
  if (refiMonth == null || refiMonth > months) return { rows, refi: null };

  const value = startingValue(deal) * Math.pow(1 + pct(deal.appreciationPct), refiMonth / 12);
  const oldBalance = rows[refiMonth - 1].balance;
  const penalty = oldBalance * prepayRate(deal.prepay, refiMonth);
  const newLoan = value * pct(deal.refiLtv);
  const costs = newLoan * pct(deal.refiCostPct);
  const refi = {
    month: refiMonth,
    year: refiMonth / 12,
    value,
    oldBalance,
    penalty,
    newLoan,
    costs,
    cashOut: newLoan - oldBalance - penalty - costs,
  };
  const second = amortize(newLoan, deal.refiRate, deal.refiTermYears, months - refiMonth, 0);
  second.forEach((r, i) => rows.push({ ...r, month: refiMonth + i + 1, loanAge: i + 1 }));
  return { rows, refi };
}

/** Sum of the OpEx percentages on a deal, as a fraction (0.23 for 23%). */
export function opexRate(deal) {
  return pct(deal.mgmtPct) + pct(deal.maintPct) + pct(deal.vacancyPct) + pct(deal.capexPct);
}

/** Full single-deal analysis: financing, lender DSCR, real-world cash flow, returns. */
export function analyzeDeal(deal) {
  const price = num(deal.price);
  const downPayment = price * pct(deal.downPct);
  const loanAmount = Math.max(price - downPayment, 0);
  const ltv = price > 0 ? loanAmount / price : 0;
  const closingCosts = price * pct(deal.closingPct);
  const cashToClose = downPayment + closingCosts;
  const rehab = Math.max(num(deal.rehabCost), 0);
  // Everything you actually spend: the denominator for cash-on-cash and IRR.
  const cashInvested = cashToClose + rehab;

  // Lenders qualify interest-only DSCR loans on the interest-only payment.
  const ioMonths = ioMonthsFor(deal.termYears, deal.ioYears);
  const schedule12 = amortize(loanAmount, deal.rate, deal.termYears, 12, deal.ioYears);
  const pi = schedule12[0]?.payment ?? 0;
  const amortizingPI = ioMonths > 0 ? monthlyPI(loanAmount, deal.rate, num(deal.termYears) - ioMonths / 12) : pi;
  const taxes = num(deal.taxesAnnual) / 12;
  const insurance = num(deal.insuranceAnnual) / 12;
  const hoa = num(deal.hoaMonthly);
  const fixedCosts = taxes + insurance + hoa;
  const pitia = pi + fixedCosts;

  const units = Math.max(Math.round(num(deal.units)), 1);
  const grossRent = num(deal.rentPerUnit) * units;
  const lenderRent = grossRent * (1 - pct(deal.lenderHaircutPct));
  const dscr = pitia > 0 ? lenderRent / pitia : Infinity;

  const opex = {
    management: grossRent * pct(deal.mgmtPct),
    maintenance: grossRent * pct(deal.maintPct),
    vacancy: grossRent * pct(deal.vacancyPct),
    capex: grossRent * pct(deal.capexPct),
  };
  opex.total = opex.management + opex.maintenance + opex.vacancy + opex.capex;

  const netCashFlow = grossRent - pitia - opex.total;
  const annualCashFlow = netCashFlow * 12;
  const coc = cashInvested > 0 ? annualCashFlow / cashInvested : 0;

  // Liquid reserves lenders want on hand (months of PITIA). Held, not spent.
  const reserves = Math.max(num(deal.reserveMonths), 0) * pitia;
  const cashNeeded = cashInvested + reserves;

  const year1Principal = schedule12.reduce((s, r) => s + r.principal, 0);
  const year1Interest = schedule12.reduce((s, r) => s + r.interest, 0);

  // Net operating income excludes debt service, so cap rate is financing-independent.
  const noiMonthly = grossRent - opex.total - fixedCosts;
  const capRate = price > 0 ? (noiMonthly * 12) / price : 0;

  // Rent needed for the deal to break even after OpEx, and to hit a 1.20 DSCR.
  const keep = 1 - opexRate(deal);
  const breakevenRent = keep > 0 ? pitia / keep : Infinity;
  const haircutKeep = 1 - pct(deal.lenderHaircutPct);
  const rentForDscr120 = haircutKeep > 0 ? (1.2 * pitia) / haircutKeep : Infinity;

  const status = dscrStatus(dscr);
  const value = startingValue(deal);

  return {
    price,
    value,
    // Equity created by the rehab: after-repair value beyond price + rehab spent.
    forcedEquity: num(deal.arv) > 0 ? value - price - rehab : 0,
    downPayment,
    loanAmount,
    ltv,
    closingCosts,
    cashToClose,
    rehab,
    cashInvested,
    reserves,
    cashNeeded,
    interestOnly: ioMonths > 0,
    ioYears: ioMonths / 12,
    amortizingPI,
    pi,
    taxes,
    insurance,
    hoa,
    pitia,
    units,
    grossRent,
    lenderRent,
    dscr,
    status,
    opex,
    netCashFlow,
    annualCashFlow,
    coc,
    year1Principal,
    year1Interest,
    year1TotalReturn: annualCashFlow + year1Principal,
    noiMonthly,
    capRate,
    breakevenRent,
    rentForDscr120,
    // The trap this tool exists to catch: the lender says yes, the bank account says no.
    lenderApprovedButNegative: Number.isFinite(dscr) && round2(dscr) >= 1 && netCashFlow < 0,
  };
}

/**
 * Year-by-year wealth projection. Rent (and the OpEx tied to it) grows at
 * rentGrowthPct; taxes, insurance and HOA grow at expenseGrowthPct; debt
 * service follows the loan schedule (it steps up when interest-only ends).
 * Each row also says what selling that year would net, after selling costs,
 * the loan payoff and everything invested.
 */
export function projectDeal(deal, years = 10) {
  const a = analyzeDeal(deal);
  const appreciation = pct(deal.appreciationPct);
  const rentGrowth = pct(deal.rentGrowthPct);
  const expenseGrowth = pct(deal.expenseGrowthPct);
  const keep = 1 - opexRate(deal);
  const fixedMonthly = a.taxes + a.insurance + a.hoa;
  const sellRate = pct(deal.sellingCostPct);
  const base = startingValue(deal);

  const { rows: schedule, refi } = loanTimeline(deal, years * 12);

  const rows = [];
  let cumCashFlow = 0;
  let cumPrincipal = 0;
  let cumCashOut = 0;
  let cumRefiCosts = 0;
  for (let y = 1; y <= years; y++) {
    const rent = a.grossRent * Math.pow(1 + rentGrowth, y - 1);
    const fixed = fixedMonthly * Math.pow(1 + expenseGrowth, y - 1);
    const yearRows = schedule.slice((y - 1) * 12, y * 12);
    const debtService = yearRows.reduce((s, r) => s + r.payment, 0);
    const principal = yearRows.reduce((s, r) => s + r.principal, 0);
    const cashFlow = rent * keep * 12 - fixed * 12 - debtService;
    const value = base * Math.pow(1 + appreciation, y);
    const end = yearRows[yearRows.length - 1];
    const balance = end ? end.balance : a.loanAmount;

    // A refinance at the end of this year hands back cash and costs a penalty plus fees.
    const refiCash = refi && refi.year === y ? refi.cashOut : 0;
    const refiCosts = refi && refi.year === y ? refi.penalty + refi.costs : 0;

    cumCashFlow += cashFlow;
    cumPrincipal += principal;
    cumCashOut += refiCash;
    cumRefiCosts += refiCosts;
    // Appreciation is measured from the price, so value added by the rehab counts here.
    const cumAppreciation = value - a.price;
    const totalReturn = cumCashFlow + cumPrincipal + cumAppreciation - cumRefiCosts;
    const sellingCosts = value * sellRate;
    const prepayPenalty = end ? balance * prepayRate(deal.prepay, end.loanAge) : 0;
    const netProceeds = value - sellingCosts - balance - prepayPenalty;
    const profitIfSold = cumCashFlow + cumCashOut + netProceeds - a.cashInvested;

    rows.push({
      year: y,
      cashFlow,
      refiCash,
      principal,
      cumCashFlow,
      cumCashOut,
      cumPrincipal,
      cumAppreciation,
      cumRefiCosts,
      totalReturn,
      value,
      balance,
      equity: value - balance,
      roi: a.cashInvested > 0 ? totalReturn / a.cashInvested : 0,
      sellingCosts,
      prepayPenalty,
      netProceeds,
      profitIfSold,
    });
  }
  return rows;
}

/**
 * The cash-out refinance, if the deal plans one: what it pays off, what it
 * hands back, and what the deal looks like on the new loan (the lender's
 * DSCR check for the refinance included). Null when there is none.
 */
export function refiAnalysis(deal, years = 10) {
  const { rows, refi } = loanTimeline(deal, years * 12);
  if (!refi) return null;
  const a = analyzeDeal(deal);
  const yearsIn = refi.year;
  const rent = a.grossRent * Math.pow(1 + pct(deal.rentGrowthPct), yearsIn);
  const fixed = (a.taxes + a.insurance + a.hoa) * Math.pow(1 + pct(deal.expenseGrowthPct), yearsIn);
  const payment = rows[refi.month]?.payment ?? monthlyPI(refi.newLoan, deal.refiRate, deal.refiTermYears);
  const pitia = payment + fixed;
  const lenderRent = rent * (1 - pct(deal.lenderHaircutPct));
  const netCashFlow = rent * (1 - opexRate(deal)) - pitia;
  const cashLeft = a.cashInvested - refi.cashOut;
  const dscr = pitia > 0 ? lenderRent / pitia : Infinity;
  return {
    ...refi,
    payment,
    pitia,
    dscr,
    status: dscrStatus(dscr),
    netCashFlow,
    cashLeft,
    allCashBack: cashLeft <= 0,
    // Cash-on-cash on what's still in the deal: unlimited once all of it is back
    // and the deal still pays; undefined (NaN) if it is back but losing money.
    cocAfter: cashLeft > 0 ? (netCashFlow * 12) / cashLeft : netCashFlow > 0 ? Infinity : NaN,
    ltv: refi.value > 0 ? refi.newLoan / refi.value : 0,
    equityAfter: refi.value - refi.newLoan,
  };
}

/**
 * Exit analysis: sell at the end of the projection. IRR uses the cash
 * invested today, each year's cash flow (plus any refinance cash-out), and
 * net sale proceeds in the last year.
 */
export function saleAnalysis(deal, rows) {
  const a = analyzeDeal(deal);
  const last = rows[rows.length - 1];
  const flows = [-a.cashInvested, ...rows.map((r) => r.cashFlow + r.refiCash)];
  flows[flows.length - 1] += last.netProceeds;
  const returned = last.cumCashFlow + last.cumCashOut + last.netProceeds;
  return {
    year: last.year,
    salePrice: last.value,
    sellingCosts: last.sellingCosts,
    loanPayoff: last.balance,
    prepayPenalty: last.prepayPenalty,
    netProceeds: last.netProceeds,
    totalCashFlow: last.cumCashFlow,
    cashOut: last.cumCashOut,
    cashInvested: a.cashInvested,
    profit: last.profitIfSold,
    equityMultiple: a.cashInvested > 0 ? returned / a.cashInvested : NaN,
    irr: a.cashInvested > 0 ? irr(flows) : NaN,
  };
}

/**
 * Estimated value and loan balance today for a property owned `yearsOwned`
 * years, following its refinance if that has already happened.
 */
export function estimateToday(deal) {
  const a = analyzeDeal(deal);
  const yearsOwned = Math.max(num(deal.yearsOwned), 0);
  const months = Math.round(yearsOwned * 12);
  const value = startingValue(deal) * Math.pow(1 + pct(deal.appreciationPct), yearsOwned);
  const { rows, refi } = loanTimeline(deal, Math.max(months, 1));
  const balance = months > 0 ? rows[months - 1].balance : a.loanAmount;
  return { value, balance, equity: value - balance, refinanced: !!refi && months >= refi.month };
}

/**
 * Roll a set of analyzed deals into portfolio totals. Each item is
 * { deal, a, rows, sale }. DSCR here is global DSCR: total lender rent over
 * total PITIA, the way lenders look at a borrower's whole schedule.
 */
export function portfolioSummary(items) {
  const t = {
    properties: items.length,
    units: 0,
    grossRent: 0,
    lenderRent: 0,
    pitia: 0,
    opex: 0,
    netCashFlow: 0,
    cashInvested: 0,
    reserves: 0,
    value: 0,
    debt: 0,
    year10Equity: 0,
    year10Profit: 0,
    negative: 0,
    traps: 0,
  };
  items.forEach(({ deal, a, rows }) => {
    const today = estimateToday(deal);
    // Once a property has been refinanced, its payment and cash flow are the new loan's.
    const now = today.refinanced ? refiAnalysis(deal) : null;
    t.units += a.units;
    t.grossRent += a.grossRent;
    t.lenderRent += a.lenderRent;
    t.pitia += now ? now.pitia : a.pitia;
    t.opex += a.opex.total;
    t.netCashFlow += now ? now.netCashFlow : a.netCashFlow;
    t.cashInvested += a.cashInvested;
    t.reserves += a.reserves;
    t.value += today.value;
    t.debt += today.balance;
    t.year10Equity += rows[rows.length - 1].equity;
    t.year10Profit += rows[rows.length - 1].profitIfSold;
    if (a.netCashFlow < 0) t.negative += 1;
    if (a.lenderApprovedButNegative) t.traps += 1;
  });
  t.annualCashFlow = t.netCashFlow * 12;
  t.equity = t.value - t.debt;
  t.ltv = t.value > 0 ? t.debt / t.value : 0;
  t.dscr = t.pitia > 0 ? t.lenderRent / t.pitia : Infinity;
  t.status = dscrStatus(t.dscr);
  t.coc = t.cashInvested > 0 ? t.annualCashFlow / t.cashInvested : 0;
  return t;
}

export const DEFAULT_TARGETS = { dscr: 1.25, cashFlowPerDoor: 200, coc: 8, useDscr: true, useCashFlow: true, useCoc: true };

/**
 * The highest purchase price that still meets every active target, solved
 * exactly: the loan, its payment and closing costs all scale linearly with
 * price, so each target gives a closed-form ceiling. Taxes, insurance, HOA,
 * rent and rehab are held as entered.
 *
 * targets: { dscr, cashFlowPerDoor ($/door/mo), coc (%), useDscr, useCashFlow, useCoc }
 */
export function maxOffer(deal, targets = DEFAULT_TARGETS) {
  const a = analyzeDeal(deal);
  const d = Math.min(pct(deal.downPct), 1);
  const s = d + pct(deal.closingPct);
  const fixed = a.taxes + a.insurance + a.hoa;
  const keep = 1 - opexRate(deal);
  const R = a.grossRent * keep - fixed; // monthly cash before the loan payment
  // Monthly payment per dollar of price (interest-only loans qualify on interest).
  const perLoanDollar = a.interestOnly ? pct(deal.rate) / 12 : monthlyPI(1, deal.rate, deal.termYears);
  const q = (1 - d) * perLoanDollar;

  const ceiling = (numerator, denominator) => {
    if (denominator <= 0) return numerator >= 0 ? Infinity : 0;
    return Math.max(numerator / denominator, 0);
  };

  const limits = [];
  if (targets.useDscr && num(targets.dscr) > 0) {
    limits.push({ key: 'dscr', label: `DSCR ≥ ${num(targets.dscr).toFixed(2)}`, price: ceiling(a.lenderRent / num(targets.dscr) - fixed, q) });
  }
  if (targets.useCashFlow) {
    const need = num(targets.cashFlowPerDoor) * a.units;
    limits.push({ key: 'cashFlow', label: `$${num(targets.cashFlowPerDoor)}/door cash flow`, price: ceiling(R - need, q) });
  }
  if (targets.useCoc && num(targets.coc) > 0) {
    const C = pct(targets.coc);
    limits.push({ key: 'coc', label: `${num(targets.coc)}% cash-on-cash`, price: ceiling(12 * R - C * a.rehab, 12 * q + C * s) });
  }

  if (!limits.length) return { limits, price: null, binding: null };
  const binding = limits.reduce((m, l) => (l.price < m.price ? l : m));
  const price = binding.price;
  return {
    limits,
    binding: binding.key,
    price,
    feasible: Number.isFinite(price) && price > 0,
    vsAsking: Number.isFinite(price) ? price - a.price : Infinity,
  };
}

/**
 * Apply "what-if" slider adjustments to a deal without mutating it.
 * adj = { rateDelta: pct points, downPct: absolute % or null, rentPct: % change }
 */
export function applyAdjustments(deal, adj) {
  if (!adj) return deal;
  return {
    ...deal,
    rate: Math.max(num(deal.rate) + num(adj.rateDelta), 0),
    downPct: adj.downPct == null ? deal.downPct : adj.downPct,
    rentPerUnit: num(deal.rentPerUnit) * (1 + pct(adj.rentPct)),
  };
}

export function isNeutralAdjustment(adj) {
  return !adj || (num(adj.rateDelta) === 0 && adj.downPct == null && num(adj.rentPct) === 0);
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}
