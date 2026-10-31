// Rent or buy, over ten years: two households start with the same savings.
// One buys with the least down and lives there (renting out the other units
// if there are any); the other keeps renting and invests what it didn't
// spend. Each month, whichever pays less invests the difference. The answer
// is what each is worth at the end: the buyer's home after selling costs and
// the mortgage, plus their investments, against the renter's investments.

import { loanRate } from './finance.js';
import { cityByKey } from './canada.js';
import { RULES, closingCash, minDownPayment, mortgagePlan } from './firstHome.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const RENT_VS_BUY_DEFAULTS = {
  years: 10,
  rentGrowthPct: 3, // rent each year
  appreciationPct: 3, // the home's value each year
  investPct: 5, // what invested money earns each year, after fees
  maintPct: 1, // upkeep each year, as a share of the home's value
  sellPct: 5, // commission and legal fees when you sell
  costGrowthPct: 2.5, // property tax and insurance each year
};

/**
 * @param o.price, o.units, o.city   the home
 * @param o.rentNow                   what you pay to rent today, a month
 * @param o.rentFromOthers            the other units' rent today, a month (0 for a house)
 * @param o.ratePct                   the mortgage rate
 * @param o.taxPct                    property tax, % of price a year
 * @param o.insuranceMonthly          home insurance, a month
 * @returns {{ rows, upfront, buyFirst, rentFirst, breakEvenYear, verdict }}
 */
export function rentVsBuy(o) {
  const d = { ...RENT_VS_BUY_DEFAULTS, ...o };
  const price = num(d.price);
  const units = Math.max(Math.round(num(d.units) || 1), 1);
  const place = cityByKey(d.city);
  const down = minDownPayment(price, units);
  const plan = mortgagePlan({ price, down, ratePct: d.ratePct, province: place.province });
  const closing = closingCash({ price, units, city: place.key, premiumPst: plan.premiumPst }).total;
  const upfront = down + closing;

  const r = loanRate(d.ratePct, { country: 'ca' }) / 1200;
  const g = (pct) => Math.pow(1 + num(pct) / 100, 1 / 12) - 1; // monthly growth for a yearly rate
  const invest = g(d.investPct);

  let balance = plan.loan;
  let value = price;
  let rent = num(d.rentNow);
  let otherRent = num(d.rentFromOthers);
  let fixed = (price * num(d.taxPct)) / 1200 + num(d.insuranceMonthly) + (units > 1 ? RULES.heatMonthly : 0);
  let buyerPot = 0;
  let renterPot = upfront; // the renter invests the cash the buyer put down
  const rows = [];

  for (let m = 1; m <= d.years * 12; m++) {
    const interest = balance * r;
    const principal = Math.min(Math.max(plan.payment - interest, 0), balance);
    balance -= principal;
    const upkeep = (value * num(d.maintPct)) / 1200;
    const buyCost = plan.payment + fixed + upkeep - otherRent;

    buyerPot *= 1 + invest;
    renterPot *= 1 + invest;
    if (buyCost > rent) renterPot += buyCost - rent;
    else buyerPot += rent - buyCost;

    value *= 1 + g(d.appreciationPct);
    rent *= 1 + g(d.rentGrowthPct);
    otherRent *= 1 + g(d.rentGrowthPct);
    fixed *= 1 + g(d.costGrowthPct);

    if (m % 12 === 0) {
      const equity = value * (1 - num(d.sellPct) / 100) - balance;
      rows.push({ year: m / 12, value, balance, buyWorth: equity + buyerPot, rentWorth: renterPot, buyCost, rent: rent / (1 + g(d.rentGrowthPct)) });
    }
  }

  const breakEven = rows.find((x) => x.buyWorth >= x.rentWorth);
  const last = rows.at(-1);
  return {
    rows,
    upfront,
    down,
    closing,
    payment: plan.payment,
    buyFirst: rows[0] ? rows[0].buyCost : 0,
    rentFirst: num(d.rentNow),
    breakEvenYear: breakEven ? breakEven.year : null,
    ahead: last ? last.buyWorth - last.rentWorth : 0,
  };
}
