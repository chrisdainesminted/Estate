// Plain-language meanings for the numbers on screen: one short sentence each,
// written for someone who has never heard of DSCR. The (i) tips keep the
// textbook definitions; these say what this deal's number means for you.

import { loanConstant, paybackYears } from './finance.js';
import { money, percent } from './format.js';

// Under 50¢ a month either way counts as breaking even.
const EVEN = 0.5;

const perUnit = (units) => (units > 1 ? ' per unit' : '');

/** "a" or "an" before a number, by how it's read aloud: an 8% rate, an 11.0% return, an $18,000 loss, a 5.8% return. */
function an(text) {
  const lead = String(text).replace(/^\$/, '').match(/^\d+/)?.[0] ?? '';
  return `${lead.startsWith('8') || lead === '11' || lead === '18' ? 'an' : 'a'} ${text}`;
}

function cashClause(cf, units = 1) {
  const m = `${money(Math.abs(cf))} a month${perUnit(units)}`;
  if (cf >= EVEN) return { tone: 'keeps', text: `puts about ${m} in your pocket` };
  if (cf <= -EVEN) return { tone: 'loses', text: `would cost you about ${m} out of pocket` };
  return { tone: 'even', text: 'about breaks even each month' };
}

const lenderOk = (status) => status.key === 'sweet' || status.key === 'strong';

/** The deal in one sentence: what a lender would say, and what your bank account would see. */
export function dealSentence(a) {
  const cash = cashClause(a.netCashFlow);
  if (a.status.key === 'negative') {
    return cash.tone === 'keeps'
      ? `It ${cash.text} after every cost, but most lenders would turn it down: by their math the rent doesn’t cover the payment.`
      : `Most lenders would turn this down, and it ${cash.text}.`;
  }
  const lender = lenderOk(a.status) ? 'A lender would likely approve this' : 'A lender might approve this';
  if (cash.tone === 'loses') return `${lender}, but it ${cash.text} once repairs, vacancy and management are paid.`;
  if (cash.tone === 'even') return `${lender}, and it ${cash.text} after every cost.`;
  return lenderOk(a.status)
    ? `It ${cash.text} after every cost, and a lender would likely approve it.`
    : `It ${cash.text} after every cost, but lender approval is tight.`;
}

/** Where rent would have to be for cash flow to hit $0, or how far it could fall first. */
export function breakevenSentence(a) {
  const units = a.units || 1;
  const be = a.breakevenRent / units;
  if (!Number.isFinite(be) || be <= 0) return null;
  const now = a.grossRent / units;
  if (a.netCashFlow <= -EVEN) return `To break even, rent would need to be ${money(be)} a month${perUnit(units)}, up from ${money(now)}.`;
  if (a.netCashFlow >= EVEN) return `Rent could fall to ${money(be)} a month${perUnit(units)} before it stops paying for itself.`;
  return null;
}

/** DSCR as a plain ratio: dollars of rent per dollar of payment. */
export function dscrMeaning(a) {
  if (!Number.isFinite(a.dscr)) return 'There’s no loan payment, tax or insurance for the rent to cover.';
  return `Rent brings in ${money(Math.max(a.dscr, 0), { cents: true })} for every $1 of loan payment, tax and insurance.`;
}

/** What each DSCR band means to a lender. */
export const BAND_MEANINGS = {
  negative: 'Rent doesn’t cover the payment, so most lenders say no.',
  tight: 'Covers the payment with little to spare. Some lenders say yes.',
  sweet: 'The range most DSCR lenders look for.',
  strong: 'Comfortable coverage. Lenders like this.',
};

export function cashFlowMeaning(a) {
  const yearly = money(Math.abs(a.annualCashFlow));
  if (a.netCashFlow >= EVEN) return `What you keep each month after the loan and every running cost: ${yearly} a year.`;
  if (a.netCashFlow <= -EVEN) return `What you’d pay in each month to cover the loan and running costs: ${yearly} a year.`;
  return 'You’d about break even each month after the loan and every running cost.';
}

export function cocMeaning(a, targets) {
  if (!(a.cashInvested > 0)) return 'You put no cash in, so there’s nothing to measure the return against.';
  const goal = targets?.useCoc ? ` Your target is ${Number(targets.coc)}%.` : '';
  return `${money(a.annualCashFlow, { signed: true })} a year on the ${money(a.cashInvested)} you put in.${goal}`;
}

export function cashInMeaning(a) {
  const parts = [`${money(a.downPayment)} down`, `${money(a.closingCosts)} closing costs`];
  if (a.rehab > 0) parts.push(`${money(a.rehab)} repairs`);
  const reserves = a.reserves > 0 ? ` Lenders also want ${money(a.reserves)} kept in the bank.` : '';
  return `${parts.join(' + ')}.${reserves}`;
}

/** Rent, minus what the lender counts, minus what the lender ignores. */
export function rentFlowMeaning(a) {
  return `Rent ${money(a.grossRent)}, minus ${money(a.pitia)} for the loan, taxes and insurance, minus ${money(a.opex.total)} of running costs.`;
}

/** The what-if sliders in words, or null when they're all at the deal's own values. */
export function whatIfSummary(deal, adj) {
  const parts = [];
  if (adj.rateDelta) parts.push(`${an(`${Math.max((Number(deal.rate) || 0) + adj.rateDelta, 0).toFixed(3).replace(/\.?0+$/, '')}%`)} rate`);
  if (adj.downPct != null && adj.downPct !== Number(deal.downPct)) parts.push(`${adj.downPct}% down`);
  if (adj.rentPct) parts.push(`rent ${adj.rentPct > 0 ? 'up' : 'down'} ${Math.abs(adj.rentPct)}%`);
  if (!parts.length) return null;
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Testing ${list}.`;
}

/** How much room the deal has before rent or rate changes push it into a loss. */
export function stressSentence(a, rate, breakevenRatePct) {
  const rentMove = a.grossRent > 0 ? a.breakevenRent / a.grossRent - 1 : 0;
  const rateText = breakevenRatePct != null ? breakevenRatePct.toFixed(2) : null;
  if (a.netCashFlow < 0) {
    return `At today’s ${Number(rate)}% it already loses money. It needs ${percent(rentMove, 1, { signed: true })} rent${rateText ? ` or a rate under ${rateText}%` : ''} to break even.`;
  }
  return `Cash flow holds until rent falls ${percent(-rentMove, 1)}${rateText ? `, or the rate climbs to ${rateText}%` : ''}.`;
}

/** The max offer against the asking price, naming the target that sets it. */
export function offerMeaning(m, asking) {
  if (m.price == null) return 'Turn on a target to see the most you should pay.';
  if (!m.feasible) return 'No price works at your targets: the rent doesn’t cover costs with room to spare.';
  if (!Number.isFinite(m.price)) return 'Any price works: none of your targets limits it.';
  const limit = m.limits.find((l) => l.key === m.binding);
  const miss = limit ? ` Pay more and you’d miss your ${limit.label} target.` : '';
  const room = m.price - asking;
  return room >= 0 ? `Asking works, with ${money(room)} to spare.${miss}` : `That’s ${money(-room)} under asking.${miss}`;
}

export function outlookMeaning(years, appreciationPct) {
  return `Cash flow, loan paid down by your tenants and ${Number(appreciationPct) || 0}% yearly price growth, added up over ${years} years, before selling costs.`;
}

export function saleMeaning(sale) {
  const rate = Number.isFinite(sale.irr) ? `: like earning ${percent(sale.irr, 1)} a year on your ${money(sale.cashInvested)}` : '';
  return `${sale.profit >= 0 ? 'Profit' : 'Loss'} after selling costs and paying off the loan${rate}.`;
}

export function refiMeaning(refi, a) {
  if (refi.cashOut < 0) return `The new loan doesn’t cover the old one: you’d bring ${money(-refi.cashOut)} to close.`;
  if (refi.allCashBack) return `You’d get back all ${money(a.cashInvested)} you put in and still own the property.`;
  return `You’d get back ${money(refi.cashOut)} of the ${money(a.cashInvested)} you put in.`;
}

export function taxMeaning(t) {
  const shield = t.rules === 'ca' ? 'capital cost allowance' : 'depreciation';
  if (t.taxable < 0) {
    return t.taxDue < 0
      ? `A ${money(-t.taxable)} paper loss saves about ${money(-t.taxDue)} of tax on your other income.`
      : `No tax in year 1: ${shield} turns it into ${an(money(-t.taxable))} paper loss for later years.`;
  }
  if (t.taxDue > 0) return `About ${money(t.taxDue)} of tax in year 1, after ${shield} shelters part of the income.`;
  return `No tax in year 1: ${shield} shelters the rental income.`;
}

/** One sentence per listing: cash per door, the lender's view, and the asking price against your max. */
export function listingSentence(s) {
  const cash = cashClause(s.perDoor, s.a.units);
  if (s.lens === 'own') return ownListingSentence(s, cash);
  const lenderSays = s.a.status.key === 'negative' ? 'most lenders would turn it down' : lenderOk(s.a.status) ? 'a lender would likely approve it' : 'lender approval is tight';
  // "and" when the cash and the lender agree (both fine or both not), "but" when they don't.
  const agree = (cash.tone !== 'loses') === lenderOk(s.a.status);
  const first = `It ${cash.text}${cash.tone === 'keeps' ? ' after every cost' : ''}, ${agree ? 'and' : 'but'} ${lenderSays}.`;
  const room = Number.isFinite(s.offer?.price) ? s.offer.price - s.a.price : null;
  if (room == null) return first;
  return `${first} Asking is ${money(Math.abs(room))} ${room >= 0 ? 'under' : 'over'} your max offer.`;
}

/** A listing counted with your own 20% down and a regular mortgage: no lender's DSCR test. */
function ownListingSentence(s, cash) {
  const down = `With ${downText(s.a)} (${money(s.a.cashInvested)} of your own money)`;
  const after = { keeps: ` after the mortgage and every cost: ${an(percent(s.a.coc, 1))} cash-on-cash return`, loses: ' once the mortgage and running costs are paid', even: ' after the mortgage and every cost' }[cash.tone];
  const first = `${down}, it ${cash.text}${after}.`;
  const room = Number.isFinite(s.offer?.price) ? s.offer.price - s.a.price : null;
  return room == null ? first : `${first} Asking is ${money(Math.abs(room))} ${room >= 0 ? 'under' : 'over'} your max offer.`;
}

/** The portfolio's monthly cash flow, across every owned property. */
export function portfolioCashMeaning(p) {
  const yearly = money(Math.abs(p.annualCashFlow));
  if (p.netCashFlow >= EVEN) return `What all your rentals put in your pocket each month after every cost: ${yearly} a year.`;
  if (p.netCashFlow <= -EVEN) return `What you pay in each month to keep all your rentals running: ${yearly} a year.`;
  return 'Your rentals about break even each month after every cost.';
}

export function portfolioDscrMeaning(p) {
  if (!Number.isFinite(p.dscr)) return 'There’s no loan payment, tax or insurance for the rent to cover.';
  return `Across all your loans, rent brings in ${money(Math.max(p.dscr, 0), { cents: true })} for every $1 of payment. Lenders check this before your next loan.`;
}

export function equityMeaning(p) {
  return `What you’d own after paying off the loans: ${money(p.value)} of property, less ${money(p.debt)} owed.`;
}

/** Who wins what among compared deals: monthly cash, the lender's view, and profit at sale. */
export function compareSummary(items) {
  if (items.length < 2) return [];
  const top = (get) => items.reduce((m, x) => (get(x) > get(m) ? x : m));
  const cash = top((x) => x.a.netCashFlow);
  const lender = top((x) => (Number.isFinite(x.a.dscr) ? x.a.dscr : Infinity));
  const sale = top((x) => x.sale.profit);
  return [
    { key: 'cash', name: cash.deal.name, text: `keeps the most each month: ${money(cash.a.netCashFlow, { signed: true })}.` },
    { key: 'lender', name: lender.deal.name, text: `is the easiest for a lender to approve (DSCR ${Number.isFinite(lender.a.dscr) ? lender.a.dscr.toFixed(2) : '∞'}).` },
    { key: 'sale', name: sale.deal.name, text: `makes the most if you sell in year ${sale.sale.year}: ${money(sale.sale.profit, { signed: true })}.` },
  ];
}

// The Cash tab: your own money as a 20% down payment and a regular mortgage
// for the rest, with no DSCR lender. `c` is analyzeDeal(ownMoney(deal)).

const downText = (c) => `${percent(c.price > 0 ? c.downPayment / c.price : 0, 0)} down`;

function aboutYears(y) {
  const n = Math.max(Math.round(y), 1);
  return `about ${n} year${n === 1 ? '' : 's'}`;
}

/** The deal with 20% down in one sentence: what it pays you after the mortgage, and the return on your cash. */
export function cashSentence(c) {
  const pay = `the ${money(c.pi)} mortgage payment`;
  if (c.netCashFlow >= EVEN) {
    return `With ${downText(c)}, ${money(c.cashInvested)} of your own money in all, it would pay you about ${money(c.netCashFlow)} a month after ${pay} and every cost: ${an(percent(c.coc, 1))} cash-on-cash return.`;
  }
  if (c.netCashFlow <= -EVEN) return `With ${downText(c)}, it would cost you about ${money(-c.netCashFlow)} a month: the rent doesn’t cover ${pay} plus taxes, insurance and running costs.`;
  return `With ${downText(c)}, it only breaks even: the rent just covers ${pay} and every cost.`;
}

export function mortgageMeaning(c, deal) {
  return `Principal and interest on ${an(money(c.loanAmount))} loan (the price minus your ${downText(c)}) at ${Number(deal.rate)}% over ${Number(deal.termYears)} years.`;
}

/** The cash you put in, and how long cash flow takes to pay it back. */
export function ownCashMeaning(c) {
  const years = paybackYears(c);
  return `${cashInMeaning(c)} ${years ? `Cash flow pays it back in ${aboutYears(years)}.` : 'Cash flow alone never pays it back.'}`;
}

/**
 * The mortgage or all cash: borrowing raises your return only when a year of
 * loan payments costs less, per dollar borrowed, than the property earns on
 * its full cost. `cash` is the deal bought outright, `loan` with its mortgage.
 */
export function leverageMeaning(cash, loan) {
  const k = loanConstant(loan);
  if (k == null) return null;
  const costs = `a year of mortgage payments costs ${percent(k, 1)} of the loan`;
  return loan.coc > cash.coc
    ? `The mortgage raises your return: ${costs}, less than the ${percent(cash.coc, 1)} the property earns on its full cost, so each of your dollars makes more.`
    : `Paying all cash would earn more per dollar: ${costs}, more than the ${percent(cash.coc, 1)} the property earns on its full cost, so the mortgage drags your return down.`;
}

export function cashRentMeaning(c) {
  return `Rent ${money(c.grossRent)}, minus the ${money(c.pi)} mortgage payment, ${money(c.taxes + c.insurance + c.hoa)} for taxes and insurance${c.hoa > 0 ? ' and fees' : ''}, and ${money(c.opex.total)} of running costs.`;
}

/** Cash flow added up over the years shown, as a share of the cash put in. */
export function cashYearsMeaning(c, rows, rentGrowthPct) {
  const last = rows[rows.length - 1];
  const growth = Number(rentGrowthPct) ? `, with rent rising ${Number(rentGrowthPct)}% a year` : '';
  if (!(last.cumCashFlow > 0)) {
    return `Cash flow over ${rows.length} years${growth} adds up to ${money(last.cumCashFlow, { signed: true })}, so none of your cash comes back from it.`;
  }
  const back = rows.find((r) => r.cumCashFlow >= c.cashInvested);
  const share = c.cashInvested > 0 ? `: ${percent(last.cumCashFlow / c.cashInvested, 0)} of your cash back` : '';
  return `Cash flow added up over ${rows.length} years${growth}${share}${back ? `, all of it by year ${back.year}` : ''}.`;
}

export function cashSaleMeaning(sale) {
  const rate = Number.isFinite(sale.irr) ? `, like earning ${percent(sale.irr, 1)} a year on your ${money(sale.cashInvested)}` : '';
  return `If you sold in year ${sale.year}: ${money(sale.profit, { signed: true })} ${sale.profit >= 0 ? 'profit' : 'loss'}, counting every year’s cash flow, after selling costs and paying off the mortgage${rate}.`;
}

/** The top of the deal ranking, or a note that none of the deals pays. `top` is { deal, c }. */
export function cashRankingMeaning(top) {
  if (!top) return null;
  return top.c.netCashFlow >= EVEN
    ? `${top.deal.name} would pay the most on your cash: ${percent(top.c.coc, 1)} a year.`
    : `None of your deals pays you each month with ${downText(top.c)}. ${top.deal.name} comes closest: ${percent(top.c.coc, 1)} a year.`;
}
