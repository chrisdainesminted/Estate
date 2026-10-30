// First-time buyers in Ontario: the down payment and mortgage insurance on a
// home you live in, whether a bank would lend on it (with rent from the
// other units counted, as for a house hack), what living there costs you,
// and the government money you can get. Rules change often: RULES_CHECKED
// says when these were last checked, and the app shows it beside them.

import { loanRate, monthlyPI, ontarioLandTransferTax } from './finance.js';

export const RULES_CHECKED = '2026-10-29';

export const RULES = {
  insuredCap: 1500000, // homes at this price or more need 20% down, uninsured
  gds: 0.39, // housing costs ÷ income
  tds: 0.44, // housing costs plus other debts ÷ income
  minQualifyingRate: 5.25, // the stress test: the higher of this or your rate + 2
  stressAdd: 2,
  heatMonthly: 100, // what lenders usually count for heat when it isn't known
  amortFirstTime: 30, // insured, first-time buyers (since Dec 15, 2024)
  amortInsured: 25,
  amortConventional: 30,
  premiumPst: 0.08, // Ontario charges PST on the insurance premium, paid at closing
  lttRefundMax: 4000, // Ontario first-time buyer land transfer tax refund
  homeBuyersCredit: 1500, // federal: $10,000 × 15%
  fhsaYear: 8000,
  fhsaLifetime: 40000,
  hbp: 60000, // RRSP Home Buyers' Plan, per person
  gstRebateMax: 50000, // new homes only: full to $1M, phased out by $1.5M
};

// CMHC premiums by loan-to-value, with a surcharge for amortizations over 25 years.
const PREMIUMS = [
  [0.65, 0.006],
  [0.75, 0.017],
  [0.8, 0.024],
  [0.85, 0.028],
  [0.9, 0.031],
  [0.95, 0.04],
];
const LONG_AMORT_SURCHARGE = 0.002;

export const DEFAULT_PROFILE = {
  income: 70000, // household, before tax, a year
  savings: 20000, // set aside for buying
  monthlySave: 800,
  debts: 300, // monthly: car, student loan, cards (minimums)
  rentNow: 1400, // what you pay to live today, a month
  firstTime: true,
  newBuild: false,
  targetPrice: 400000, // the home you're saving for
  targetUnits: 2, // a duplex: live in one unit, rent the other
  entered: false, // false until the person gives their own numbers; until then these are an example
};

// The answers the first-visit questions ask for.
const STARTER_KEYS = ['income', 'savings', 'debts', 'rentNow'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function normalizeProfile(p) {
  const out = { ...DEFAULT_PROFILE };
  for (const k of ['income', 'savings', 'monthlySave', 'debts', 'rentNow', 'targetPrice']) if (p && Number.isFinite(Number(p[k]))) out[k] = Math.max(Number(p[k]), 0);
  for (const k of ['firstTime', 'newBuild']) if (typeof p?.[k] === 'boolean') out[k] = p[k];
  if ([1, 2, 3, 4].includes(Number(p?.targetUnits))) out.targetUnits = Number(p.targetUnits);
  // Profiles saved before this flag existed count as entered once any answer differs from the example.
  out.entered = typeof p?.entered === 'boolean' ? p.entered : STARTER_KEYS.some((k) => typeof p?.[k] === 'number' && p[k] !== DEFAULT_PROFILE[k]);
  return out;
}

/**
 * The least you can put down on a home you'll live in: 5% of the first
 * $500,000 and 10% of the rest (at least 10% on 3–4 units), and 20% at
 * $1.5 million or more, where insurance isn't available.
 */
export function minDownPayment(price, units = 1) {
  const p = Math.max(num(price), 0);
  if (p >= RULES.insuredCap) return p * 0.2;
  const tiered = Math.min(p, 500000) * 0.05 + Math.max(p - 500000, 0) * 0.1;
  return units >= 3 ? Math.max(tiered, p * 0.1) : tiered;
}

/** The insurance premium rate for a loan-to-value, or 0 when 20% or more is down. */
export function premiumRate(ltv, amortYears) {
  if (ltv <= 0.8 + 1e-9) return 0;
  const tier = PREMIUMS.find(([cap]) => ltv <= cap + 1e-9);
  if (!tier) return NaN; // more than 95% borrowed: not insurable
  return tier[1] + (amortYears > 25 ? LONG_AMORT_SURCHARGE : 0);
}

/**
 * The mortgage on a home you live in: insured below 20% down, with the
 * premium added to the loan and Ontario's PST on it due at closing.
 */
export function mortgagePlan({ price, down, ratePct, firstTime = true }) {
  const p = Math.max(num(price), 0);
  const d = Math.min(Math.max(num(down), 0), p);
  const base = p - d;
  const ltv = p > 0 ? base / p : 0;
  const insured = ltv > 0.8 + 1e-9;
  const amortYears = insured ? (firstTime ? RULES.amortFirstTime : RULES.amortInsured) : RULES.amortConventional;
  const rate = insured ? premiumRate(ltv, amortYears) : 0;
  const premium = Number.isFinite(rate) ? base * rate : NaN;
  const loan = base + (Number.isFinite(premium) ? premium : 0);
  const payment = monthlyPI(loan, loanRate(ratePct, { country: 'ca' }), amortYears);
  return { price: p, down: d, base, ltv, insured, insurable: Number.isFinite(rate), amortYears, premiumRate: rate, premium, premiumPst: insured && Number.isFinite(premium) ? premium * RULES.premiumPst : 0, loan, payment };
}

/** The higher of your rate plus 2 points, or 5.25%. */
export const qualifyingRate = (ratePct) => Math.max(num(ratePct) + RULES.stressAdd, RULES.minQualifyingRate);

/**
 * Whether a lender would approve it: housing costs at the qualifying rate
 * within 39% of income (GDS), and with your other debts within 44% (TDS).
 * Rent from the other units counts as income: all of it for a second unit,
 * half of it on a three or four unit home.
 */
export function qualify({ profile, plan, units = 1, taxesMonthly = 0, condoMonthly = 0, rentFromOthers = 0 }) {
  const income = num(profile.income);
  const counted = units <= 1 ? 0 : units === 2 ? rentFromOthers : rentFromOthers * 0.5;
  const yearly = income + counted * 12;
  const qualPayment = monthlyPI(plan.loan, loanRate(qualifyingRate(plan.ratePct ?? 0), { country: 'ca' }), plan.amortYears);
  const housing = qualPayment + num(taxesMonthly) + RULES.heatMonthly + num(condoMonthly) * 0.5;
  const gds = yearly > 0 ? (housing * 12) / yearly : Infinity;
  const tds = yearly > 0 ? ((housing + num(profile.debts)) * 12) / yearly : Infinity;
  return { incomeCounted: yearly, rentCounted: counted, qualPayment, housing, gds, tds, pass: gds <= RULES.gds && tds <= RULES.tds && plan.insurable };
}

/** Cash you need on closing day beyond the down payment. */
export function closingCash({ price, units = 1, firstTime = true, otherPct = 1.5, premiumPst = 0 }) {
  const ltt = ontarioLandTransferTax(price, units);
  const refund = firstTime ? Math.min(ltt, RULES.lttRefundMax) : 0;
  const other = num(price) * (num(otherPct) / 100);
  return { ltt, refund, other, premiumPst, total: ltt - refund + other + premiumPst };
}

/**
 * Everything about buying one home to live in: the least down, the cash it
 * takes, the payment, and whether you'd qualify, given your profile.
 */
export function buyCheck({ profile, price, units = 1, ratePct, taxesMonthly, condoMonthly = 0, rentFromOthers = 0, down }) {
  const prof = normalizeProfile(profile);
  const minDown = minDownPayment(price, units);
  const d = down == null ? minDown : Math.max(num(down), minDown);
  const plan = { ...mortgagePlan({ price, down: d, ratePct, firstTime: prof.firstTime }), ratePct: num(ratePct) };
  const closing = closingCash({ price, units, firstTime: prof.firstTime, premiumPst: plan.premiumPst });
  const cashNeeded = d + closing.total;
  const q = qualify({ profile: prof, plan, units, taxesMonthly, condoMonthly, rentFromOthers });
  const shortCash = Math.max(cashNeeded - prof.savings, 0);
  return { minDown, down: d, plan, closing, cashNeeded, shortCash, qualify: q, canBuy: q.pass && shortCash === 0 };
}

/**
 * The highest price a bank would lend on for you, and the highest your
 * savings cover, for a home with `units` units at the given rent per other
 * unit and property tax rate. The lower of the two is what you can buy.
 */
export function maxPrice({ profile, units = 1, ratePct, taxPct = 1.4, rentPerOtherUnit = 0 }) {
  const prof = normalizeProfile(profile);
  const rentFromOthers = Math.max(units - 1, 0) * num(rentPerOtherUnit);
  const check = (price) => buyCheck({ profile: prof, price, units, ratePct, taxesMonthly: (price * num(taxPct)) / 1200, rentFromOthers });
  const search = (ok) => {
    let lo = 0;
    let hi = 3000000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (ok(check(mid))) lo = mid;
      else hi = mid;
    }
    return Math.floor(lo / 1000) * 1000;
  };
  const byIncome = search((c) => c.qualify.pass);
  const bySavings = search((c) => c.shortCash === 0);
  return { byIncome, bySavings, price: Math.min(byIncome, bySavings), limit: byIncome <= bySavings ? 'income' : 'savings' };
}

/**
 * Living in one unit and renting the rest: what the home costs you each
 * month once the tenants' rent comes in, next to the rent you pay today.
 * Self-managed, so no management fee; repairs and big replacements are set
 * aside on the whole home's rent, and empty months on the rented units.
 */
export function liveIn({ deal, payment }) {
  const units = Math.max(Math.round(num(deal.units)), 1);
  const rentEach = num(deal.rentPerUnit);
  const rentIn = rentEach * (units - 1);
  const setAside = (rentEach * units * (num(deal.maintPct) + num(deal.capexPct))) / 100 + (rentIn * num(deal.vacancyPct)) / 100;
  const taxes = num(deal.taxesAnnual) / 12;
  const insurance = num(deal.insuranceAnnual) / 12;
  const utilities = num(deal.hoaMonthly);
  const outgoing = payment + taxes + insurance + utilities + setAside;
  return { units, rentIn, payment, taxes, insurance, utilities, setAside, outgoing, costToLive: outgoing - rentIn };
}

/** A rough Ontario combined marginal tax rate, for estimating refunds. */
export function marginalRate(income) {
  const i = num(income);
  if (i <= 55000) return 0.2005;
  if (i <= 111000) return 0.2965;
  if (i <= 150000) return 0.4341;
  return 0.4641;
}

/**
 * The money a first-time buyer can get, in dollars where it's money in your
 * pocket. `access` items unlock cash you already have rather than adding to it.
 */
export function benefits({ profile, price, units = 1 }) {
  const prof = normalizeProfile(profile);
  const list = [];
  if (prof.firstTime) {
    const fhsa = Math.min(RULES.fhsaYear, prof.monthlySave * 12);
    list.push({
      key: 'fhsa',
      name: 'First Home Savings Account (FHSA)',
      amount: Math.round(fhsa * marginalRate(prof.income)),
      per: 'a year',
      what: `Your yearly deposits (up to $8,000, $40,000 in all) come off your taxable income, and you take it all out tax-free to buy. At $${Math.round(fhsa).toLocaleString('en-US')} a year that's a refund of about this much each spring.`,
      url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html',
    });
    const ltt = ontarioLandTransferTax(price, units);
    list.push({
      key: 'ltt',
      name: 'Ontario land transfer tax refund',
      amount: Math.round(Math.min(ltt, RULES.lttRefundMax)),
      per: 'once',
      what: 'Up to $4,000 off the land transfer tax at closing. Your lawyer claims it when the sale closes.',
      url: 'https://www.ontario.ca/document/land-transfer-tax/refunds-first-time-homebuyers',
    });
    list.push({
      key: 'hbtc',
      name: 'First-time home buyers’ tax credit',
      amount: RULES.homeBuyersCredit,
      per: 'once',
      what: 'Claim $10,000 on your tax return the year you buy, which takes $1,500 off your federal tax.',
      url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31270-home-buyers-amount.html',
    });
    if (prof.newBuild) {
      const p = num(price);
      const full = Math.min(p * 0.05, RULES.gstRebateMax);
      const amount = p <= 1000000 ? full : p >= 1500000 ? 0 : full * ((1500000 - p) / 500000);
      list.push({
        key: 'gst',
        name: 'First-time buyers’ GST rebate (new homes)',
        amount: Math.round(amount),
        per: 'once',
        what: 'The 5% federal part of the sales tax back on a newly built home: all of it up to $1 million, less up to $1.5 million.',
        url: 'https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2026/first-time-buyers-can-save-more-on-new-homes-the-first-time-home-buyers-gst-hst-rebate-is-available-now.html',
      });
    }
    list.push({
      key: 'hbp',
      name: 'RRSP Home Buyers’ Plan',
      amount: 0,
      access: RULES.hbp,
      per: 'once',
      what: 'Borrow up to $60,000 from your own RRSP for the down payment, tax-free, and pay it back over 15 years.',
      url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan.html',
    });
  }
  if (units >= 2) {
    list.push({
      key: 'refi',
      name: 'Insured refinance to add a suite',
      amount: 0,
      what: 'Already own? You can refinance up to 90% of the home’s value, including the value the new suite adds, over up to 30 years, to pay for building it.',
      url: 'https://www.canada.ca/en/department-finance/news/2024/12/2024-fall-economic-statement-making-it-easier-for-homeowners-to-build-secondary-suites.html',
    });
  }
  return { list, total: list.reduce((s, b) => s + b.amount, 0) };
}

/**
 * Months until your savings cover `target`: monthly deposits into an FHSA
 * (up to $8,000 a year), with each spring's tax refund added back in.
 */
export function monthsToSave({ profile, target }) {
  const prof = normalizeProfile(profile);
  const goal = num(target);
  if (prof.savings >= goal) return 0;
  const rate = prof.firstTime ? marginalRate(prof.income) : 0;
  let saved = prof.savings;
  let inFhsa = 0;
  let refundDue = 0;
  for (let m = 1; m <= 600; m++) {
    saved += prof.monthlySave;
    if (m % 12 === 0 && prof.firstTime) {
      // A year of deposits goes in the FHSA (up to its limits); the refund lands next spring.
      const deposit = Math.min(prof.monthlySave * 12, RULES.fhsaYear, RULES.fhsaLifetime - inFhsa);
      inFhsa += deposit;
      refundDue += deposit * rate;
    }
    if (m % 12 === 4 && refundDue > 0) {
      saved += refundDue;
      refundDue = 0;
    }
    if (saved >= goal) return m;
  }
  return null;
}

/**
 * Living in a listing (or any deal) as a first-time buyer: the least down at
 * the regular mortgage rate, whether you'd qualify with the other units'
 * rent counted, and what it would cost you each month. Null for 5+ units,
 * which the homeowner programs don't cover.
 */
export function homeFor(deal, profile, ratePct) {
  const units = Math.max(Math.round(num(deal.units)), 1);
  if (units > 4) return null;
  const check = buyCheck({ profile, price: num(deal.price), units, ratePct, taxesMonthly: num(deal.taxesAnnual) / 12, rentFromOthers: num(deal.rentPerUnit) * (units - 1) });
  const live = liveIn({ deal, payment: check.plan.payment });
  return { canBuy: check.canBuy, down: check.down, cashNeeded: check.cashNeeded, shortCash: check.shortCash, qualifies: check.qualify.pass, costToLive: live.costToLive };
}
