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

/**
 * Month-by-month amortization for the first `months` months.
 * Returns [{ month, payment, interest, principal, balance }].
 */
export function amortize(principal, annualRatePct, termYears, months) {
  const n = Math.round(num(termYears) * 12);
  const r = pct(annualRatePct) / 12;
  const payment = monthlyPI(principal, annualRatePct, termYears);
  const rows = [];
  let balance = num(principal);
  for (let m = 1; m <= months; m++) {
    if (m > n || balance <= 0) {
      rows.push({ month: m, payment: 0, interest: 0, principal: 0, balance: 0 });
      continue;
    }
    const interest = balance * r;
    const principalPaid = Math.min(payment - interest, balance);
    balance -= principalPaid;
    rows.push({ month: m, payment: principalPaid + interest, interest, principal: principalPaid, balance });
  }
  return rows;
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

  const pi = monthlyPI(loanAmount, deal.rate, deal.termYears);
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
  const coc = cashToClose > 0 ? annualCashFlow / cashToClose : 0;

  const year1 = amortize(loanAmount, deal.rate, deal.termYears, 12);
  const year1Principal = year1.reduce((s, r) => s + r.principal, 0);
  const year1Interest = year1.reduce((s, r) => s + r.interest, 0);

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
 * rentGrowthPct; taxes, insurance and HOA grow at expenseGrowthPct; P&I is fixed.
 */
export function projectDeal(deal, years = 10) {
  const a = analyzeDeal(deal);
  const appreciation = pct(deal.appreciationPct);
  const rentGrowth = pct(deal.rentGrowthPct);
  const expenseGrowth = pct(deal.expenseGrowthPct);
  const keep = 1 - opexRate(deal);
  const fixedMonthly = a.taxes + a.insurance + a.hoa;

  const schedule = amortize(a.loanAmount, deal.rate, deal.termYears, years * 12);

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
      roi: a.cashToClose > 0 ? totalReturn / a.cashToClose : 0,
    });
  }
  return rows;
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
