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

  return {
    price,
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

  const schedule = amortize(a.loanAmount, deal.rate, deal.termYears, years * 12, deal.ioYears);

  const rows = [];
  let cumCashFlow = 0;
  let cumPrincipal = 0;
  for (let y = 1; y <= years; y++) {
    const rent = a.grossRent * Math.pow(1 + rentGrowth, y - 1);
    const fixed = fixedMonthly * Math.pow(1 + expenseGrowth, y - 1);
    const yearRows = schedule.slice((y - 1) * 12, y * 12);
    const debtService = yearRows.reduce((s, r) => s + r.payment, 0);
    const principal = yearRows.reduce((s, r) => s + r.principal, 0);
    const cashFlow = rent * keep * 12 - fixed * 12 - debtService;
    const value = a.price * Math.pow(1 + appreciation, y);
    const balance = yearRows.length ? yearRows[yearRows.length - 1].balance : a.loanAmount;

    cumCashFlow += cashFlow;
    cumPrincipal += principal;
    const cumAppreciation = value - a.price;
    const totalReturn = cumCashFlow + cumPrincipal + cumAppreciation;
    const sellingCosts = value * sellRate;
    const netProceeds = value - sellingCosts - balance;
    const profitIfSold = cumCashFlow + netProceeds - a.cashInvested;

    rows.push({
      year: y,
      cashFlow,
      principal,
      cumCashFlow,
      cumPrincipal,
      cumAppreciation,
      totalReturn,
      value,
      balance,
      equity: value - balance,
      roi: a.cashInvested > 0 ? totalReturn / a.cashInvested : 0,
      sellingCosts,
      netProceeds,
      profitIfSold,
    });
  }
  return rows;
}

/**
 * Exit analysis: sell at the end of the projection. IRR uses the cash
 * invested today, each year's cash flow, and net sale proceeds in the last year.
 */
export function saleAnalysis(deal, rows) {
  const a = analyzeDeal(deal);
  const last = rows[rows.length - 1];
  const flows = [-a.cashInvested, ...rows.map((r) => r.cashFlow)];
  flows[flows.length - 1] += last.netProceeds;
  const returned = last.cumCashFlow + last.netProceeds;
  return {
    year: last.year,
    salePrice: last.value,
    sellingCosts: last.sellingCosts,
    loanPayoff: last.balance,
    netProceeds: last.netProceeds,
    totalCashFlow: last.cumCashFlow,
    cashInvested: a.cashInvested,
    profit: last.profitIfSold,
    equityMultiple: a.cashInvested > 0 ? returned / a.cashInvested : NaN,
    irr: a.cashInvested > 0 ? irr(flows) : NaN,
  };
}

/** Estimated value and loan balance today for a property owned `yearsOwned` years. */
export function estimateToday(deal) {
  const a = analyzeDeal(deal);
  const yearsOwned = Math.max(num(deal.yearsOwned), 0);
  const months = Math.round(yearsOwned * 12);
  const value = a.price * Math.pow(1 + pct(deal.appreciationPct), yearsOwned);
  const balance = months > 0 ? amortize(a.loanAmount, deal.rate, deal.termYears, months, deal.ioYears)[months - 1].balance : a.loanAmount;
  return { value, balance, equity: value - balance };
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
    t.units += a.units;
    t.grossRent += a.grossRent;
    t.lenderRent += a.lenderRent;
    t.pitia += a.pitia;
    t.opex += a.opex.total;
    t.netCashFlow += a.netCashFlow;
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
