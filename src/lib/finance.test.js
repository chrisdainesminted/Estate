import { describe, expect, it } from 'vitest';
import {
  allCash,
  amortize,
  analyzeDeal,
  applyAdjustments,
  estimateToday,
  irr,
  isNeutralAdjustment,
  loanConstant,
  loanSchedule,
  monthlyPI,
  maxOffer,
  paybackYears,
  portfolioSummary,
  positionAt,
  prepayRate,
  projectDeal,
  refiAnalysis,
  saleAnalysis,
  stressGrid,
  taxSnapshot,
} from './finance.js';
import { dscrStatus, verdict } from './dscr.js';
import { PRESET_DEALS, PRESET_OWNED } from './presets.js';
import { niceScale } from './chartTheme.js';
import { dealsToCsv } from './export.js';

// Independent closed-form remaining balance, used to cross-check the month loop.
function balanceAfter(P, ratePct, years, k) {
  const r = ratePct / 100 / 12;
  const pmt = monthlyPI(P, ratePct, years);
  const f = Math.pow(1 + r, k);
  return P * f - (pmt * (f - 1)) / r;
}

describe('monthlyPI', () => {
  it('matches a standard amortization table', () => {
    // $200k, 7%, 30 years → $1,330.60/mo
    expect(monthlyPI(200000, 7, 30)).toBeCloseTo(1330.6, 2);
    // $375k, 7%, 30 years → $2,494.88/mo
    expect(monthlyPI(375000, 7, 30)).toBeCloseTo(2494.88, 2);
    // $300k, 6%, 15 years → $2,531.57/mo
    expect(monthlyPI(300000, 6, 15)).toBeCloseTo(2531.57, 2);
  });

  it('handles a zero rate and empty loans', () => {
    expect(monthlyPI(120000, 0, 10)).toBe(1000);
    expect(monthlyPI(0, 7, 30)).toBe(0);
    expect(monthlyPI(100000, 7, 0)).toBe(0);
  });
});

describe('amortize', () => {
  it('pays the loan off exactly over the full term', () => {
    const rows = amortize(200000, 7, 30, 360);
    const principal = rows.reduce((s, r) => s + r.principal, 0);
    expect(principal).toBeCloseTo(200000, 4);
    expect(rows[359].balance).toBeCloseTo(0, 4);
  });

  it('agrees with the closed-form balance', () => {
    const rows = amortize(200000, 7, 30, 120);
    expect(rows[11].balance).toBeCloseTo(balanceAfter(200000, 7, 30, 12), 6);
    expect(rows[119].balance).toBeCloseTo(balanceAfter(200000, 7, 30, 120), 6);
  });

  it('first month splits interest and principal correctly', () => {
    const [m1] = amortize(200000, 7, 30, 1);
    expect(m1.interest).toBeCloseTo(1166.67, 2);
    expect(m1.principal).toBeCloseTo(163.94, 2);
  });

  it('stops paying after payoff when the term is shorter than the horizon', () => {
    const rows = amortize(60000, 5, 5, 120);
    expect(rows[59].balance).toBeCloseTo(0, 6);
    expect(rows[60].payment).toBe(0);
    expect(rows[119].principal).toBe(0);
  });
});

describe('dscrStatus', () => {
  it.each([
    [0.5, 'negative'],
    [0.99, 'negative'],
    [1.0, 'tight'],
    [1.19, 'tight'],
    [1.199, 'sweet'], // displays as 1.20
    [1.2, 'sweet'],
    [1.25, 'sweet'],
    [1.2549, 'sweet'], // displays as 1.25
    [1.26, 'strong'],
    [2.4, 'strong'],
    [Infinity, 'strong'],
  ])('%s → %s', (dscr, key) => {
    expect(dscrStatus(dscr).key).toBe(key);
  });
});

describe('analyzeDeal', () => {
  const sfh = PRESET_DEALS[0]; // $250k, 25% down, 7%, $2,100 rent, $3k tax, $1.5k ins

  it('computes financing and PITIA', () => {
    const a = analyzeDeal(sfh);
    expect(a.downPayment).toBe(62500);
    expect(a.loanAmount).toBe(187500);
    expect(a.ltv).toBeCloseTo(0.75, 10);
    expect(a.closingCosts).toBe(7500);
    expect(a.cashToClose).toBe(70000);
    expect(a.pi).toBeCloseTo(1247.44, 2);
    expect(a.pitia).toBeCloseTo(1247.44 + 250 + 125, 2);
  });

  it('separates lender DSCR from real-world cash flow', () => {
    const a = analyzeDeal(sfh);
    expect(a.dscr).toBeCloseTo(2100 / 1622.44, 3);
    expect(a.status.key).toBe('strong');
    expect(a.opex.total).toBeCloseTo(2100 * 0.23, 6);
    expect(a.netCashFlow).toBeCloseTo(2100 - 1622.44 - 483, 1);
    // DSCR 1.29 looks great to a lender, but the deal loses money every month.
    expect(a.netCashFlow).toBeLessThan(0);
    expect(a.lenderApprovedButNegative).toBe(true);
  });

  it('computes cash-on-cash and year-1 paydown', () => {
    const a = analyzeDeal(sfh);
    expect(a.coc).toBeCloseTo((a.netCashFlow * 12) / 70000, 10);
    expect(a.year1Principal).toBeCloseTo(187500 - balanceAfter(187500, 7, 30, 12), 6);
  });

  it('multiplies rent by unit count', () => {
    const a = analyzeDeal(PRESET_DEALS[2]); // fourplex at $1,350/unit
    expect(a.units).toBe(4);
    expect(a.grossRent).toBe(5400);
  });

  it('applies the optional lender rent haircut to DSCR only', () => {
    const base = analyzeDeal(sfh);
    const cut = analyzeDeal({ ...sfh, lenderHaircutPct: 25 });
    expect(cut.dscr).toBeCloseTo(base.dscr * 0.75, 10);
    expect(cut.netCashFlow).toBeCloseTo(base.netCashFlow, 10);
  });

  it('finds breakeven rent where net cash flow is zero', () => {
    const a = analyzeDeal(sfh);
    const atBreakeven = analyzeDeal({ ...sfh, rentPerUnit: a.breakevenRent });
    expect(atBreakeven.netCashFlow).toBeCloseTo(0, 6);
    const at120 = analyzeDeal({ ...sfh, rentPerUnit: a.rentForDscr120 });
    expect(at120.dscr).toBeCloseTo(1.2, 10);
  });

  it('treats an all-cash purchase as infinite DSCR', () => {
    const a = analyzeDeal({ ...sfh, downPct: 100, taxesAnnual: 0, insuranceAnnual: 0 });
    expect(a.loanAmount).toBe(0);
    expect(a.dscr).toBe(Infinity);
  });
});

describe('projectDeal', () => {
  const deal = PRESET_DEALS[2];

  it('with no growth, every year earns the same cash flow', () => {
    const a = analyzeDeal(deal);
    const rows = projectDeal(deal, 10);
    expect(rows).toHaveLength(10);
    rows.forEach((r) => expect(r.cashFlow).toBeCloseTo(a.annualCashFlow, 6));
    expect(rows[9].cumCashFlow).toBeCloseTo(a.annualCashFlow * 10, 4);
  });

  it('combines cash flow, paydown and 3% appreciation into total return', () => {
    const rows = projectDeal(deal, 10);
    const y10 = rows[9];
    expect(y10.cumAppreciation).toBeCloseTo(500000 * (Math.pow(1.03, 10) - 1), 4);
    expect(y10.cumPrincipal).toBeCloseTo(375000 - balanceAfter(375000, 7, 30, 120), 4);
    expect(y10.totalReturn).toBeCloseTo(y10.cumCashFlow + y10.cumPrincipal + y10.cumAppreciation, 6);
    expect(y10.equity).toBeCloseTo(y10.value - y10.balance, 6);
  });

  it('grows rent and fixed expenses when asked', () => {
    const rows = projectDeal({ ...deal, rentGrowthPct: 3, expenseGrowthPct: 3 }, 10);
    expect(rows[9].cashFlow).toBeGreaterThan(rows[0].cashFlow);
  });
});

describe('applyAdjustments', () => {
  const deal = PRESET_DEALS[0];

  it('shifts rate, overrides down payment, scales rent', () => {
    const d = applyAdjustments(deal, { rateDelta: 1.5, downPct: 30, rentPct: -10 });
    expect(d.rate).toBe(8.5);
    expect(d.downPct).toBe(30);
    expect(d.rentPerUnit).toBeCloseTo(1890, 10);
    expect(deal.rate).toBe(7); // original untouched
  });

  it('keeps the deal down payment when no override is set', () => {
    expect(applyAdjustments(deal, { rateDelta: 0, downPct: null, rentPct: 0 }).downPct).toBe(25);
    expect(isNeutralAdjustment({ rateDelta: 0, downPct: null, rentPct: 0 })).toBe(true);
    expect(isNeutralAdjustment({ rateDelta: 0.25, downPct: null, rentPct: 0 })).toBe(false);
  });

  it('never produces a negative rate', () => {
    expect(applyAdjustments({ ...deal, rate: 1 }, { rateDelta: -2 }).rate).toBe(0);
  });
});

describe('verdict', () => {
  it('flags the lender-approved, cash-negative trap first', () => {
    expect(verdict(analyzeDeal(PRESET_DEALS[0])).key).toBe('trap');
    expect(verdict(analyzeDeal(PRESET_DEALS[2])).key).toBe('good');
    expect(verdict(analyzeDeal({ ...PRESET_DEALS[0], rentPerUnit: 1500 })).key).toBe('negative');
  });
});

describe('niceScale', () => {
  it('skips a negative tick when the negative part is tiny', () => {
    const s = niceScale(-650, 112000);
    expect(s.ticks).toEqual([0, 25000, 50000, 75000, 100000, 125000]);
    expect(s.domain).toEqual([-650, 125000]);
  });
  it('keeps real negative ranges on clean ticks', () => {
    const s = niceScale(-30000, 90000);
    expect(s.ticks[0]).toBeLessThan(0);
    expect(s.ticks).toContain(0);
    expect(s.domain).toEqual([s.ticks[0], s.ticks[s.ticks.length - 1]]);
  });
});

describe('interest-only loans', () => {
  it('pays interest only during the IO period, then amortizes the rest of the term', () => {
    const rows = amortize(300000, 7, 30, 360, 10);
    expect(rows[0].payment).toBeCloseTo(300000 * 0.07 / 12, 6);
    expect(rows[119].principal).toBe(0);
    expect(rows[119].balance).toBe(300000);
    expect(rows[120].payment).toBeCloseTo(monthlyPI(300000, 7, 20), 6);
    expect(rows[359].balance).toBeCloseTo(0, 4);
  });

  it('qualifies DSCR on the interest-only payment and reports the later payment', () => {
    const deal = { ...PRESET_DEALS[0], ioYears: 10 };
    const a = analyzeDeal(deal);
    expect(a.interestOnly).toBe(true);
    expect(a.pi).toBeCloseTo(187500 * 0.07 / 12, 6);
    expect(a.amortizingPI).toBeCloseTo(monthlyPI(187500, 7, 20), 6);
    expect(a.year1Principal).toBe(0);
    expect(a.dscr).toBeGreaterThan(analyzeDeal(PRESET_DEALS[0]).dscr);
  });

  it('steps cash flow down when interest-only ends inside the projection', () => {
    const rows = projectDeal({ ...PRESET_DEALS[0], ioYears: 5 }, 10);
    expect(rows[5].cashFlow).toBeLessThan(rows[4].cashFlow);
  });

  it('keeps at least a year of amortization', () => {
    const a = analyzeDeal({ ...PRESET_DEALS[0], termYears: 10, ioYears: 10 });
    expect(a.ioYears).toBe(9);
  });
});

describe('cash invested, rehab and reserves', () => {
  it('adds rehab to cash invested and uses it for cash-on-cash', () => {
    const a = analyzeDeal({ ...PRESET_DEALS[2], rehabCost: 20000 });
    expect(a.cashToClose).toBe(140000);
    expect(a.cashInvested).toBe(160000);
    expect(a.coc).toBeCloseTo(a.annualCashFlow / 160000, 10);
  });

  it('holds reserves as months of PITIA on top of cash invested', () => {
    const a = analyzeDeal(PRESET_DEALS[0]);
    expect(a.reserves).toBeCloseTo(6 * a.pitia, 6);
    expect(a.cashNeeded).toBeCloseTo(a.cashInvested + a.reserves, 6);
  });
});

describe('irr', () => {
  it('matches hand-checked cases', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 6);
    expect(irr([-1000, 0, 0, 1331])).toBeCloseTo(0.1, 6);
    expect(irr([-1000, 100, 100, 1100])).toBeCloseTo(0.1, 6);
  });
  it('returns NaN when no rate can break even', () => {
    expect(irr([-100, -10])).toBeNaN();
  });
});

describe('saleAnalysis', () => {
  const deal = PRESET_DEALS[2];
  const rows = projectDeal(deal, 10);
  const sale = saleAnalysis(deal, rows);
  const y10 = rows[9];

  it('nets selling costs and the loan payoff from the sale price', () => {
    expect(sale.salePrice).toBeCloseTo(500000 * Math.pow(1.03, 10), 4);
    expect(sale.sellingCosts).toBeCloseTo(sale.salePrice * 0.07, 6);
    expect(sale.netProceeds).toBeCloseTo(sale.salePrice - sale.sellingCosts - y10.balance, 6);
  });

  it('profit is cash flow plus net proceeds minus everything invested', () => {
    expect(sale.profit).toBeCloseTo(y10.cumCashFlow + sale.netProceeds - 140000, 6);
    // Paper total return ignores selling costs and closing costs, so it is higher.
    expect(sale.profit).toBeLessThan(y10.totalReturn);
    expect(sale.profit).toBeCloseTo(y10.totalReturn - sale.sellingCosts - 15000, 4);
  });

  it('IRR zeroes the NPV of the deal cash flows', () => {
    const flows = [-140000, ...rows.map((r) => r.cashFlow)];
    flows[10] += sale.netProceeds;
    const npv = flows.reduce((s, cf, t) => s + cf / Math.pow(1 + sale.irr, t), 0);
    expect(Math.abs(npv)).toBeLessThan(0.01);
    expect(sale.equityMultiple).toBeCloseTo((y10.cumCashFlow + sale.netProceeds) / 140000, 10);
  });
});

describe('portfolio', () => {
  const build = (deal) => {
    const rows = projectDeal(deal, 10);
    return { deal, a: analyzeDeal(deal), rows, sale: saleAnalysis(deal, rows) };
  };

  it('estimates value and balance today from years owned', () => {
    const d = PRESET_OWNED[0];
    const today = estimateToday(d);
    expect(today.value).toBeCloseTo(340000 * Math.pow(1.03, 3), 4);
    expect(today.balance).toBeCloseTo(balanceAfter(255000, 4.75, 30, 36), 4);
    expect(estimateToday({ ...d, yearsOwned: 0 }).balance).toBe(255000);
  });

  it('sums cash flow and uses global DSCR (total rent over total PITIA)', () => {
    const items = [...PRESET_OWNED, PRESET_DEALS[0]].map(build);
    const p = portfolioSummary(items);
    expect(p.properties).toBe(3);
    expect(p.units).toBe(4);
    expect(p.netCashFlow).toBeCloseTo(items.reduce((s, x) => s + x.a.netCashFlow, 0), 6);
    expect(p.dscr).toBeCloseTo(items.reduce((s, x) => s + x.a.lenderRent, 0) / items.reduce((s, x) => s + x.a.pitia, 0), 10);
    expect(p.traps).toBe(1);
    expect(p.coc).toBeCloseTo(p.annualCashFlow / p.cashInvested, 10);
  });

  it('handles an empty portfolio', () => {
    const p = portfolioSummary([]);
    expect(p.properties).toBe(0);
    expect(p.coc).toBe(0);
  });
});

describe('dealsToCsv', () => {
  const build = (deal) => {
    const rows = projectDeal(deal, 10);
    return { deal, a: analyzeDeal(deal), rows, sale: saleAnalysis(deal, rows) };
  };

  it('writes a header and one row per deal with matching column counts', () => {
    const csv = dealsToCsv([...PRESET_DEALS, ...PRESET_OWNED].map(build));
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(6);
    const cols = lines[0].split(',').length;
    lines.forEach((l) => expect(l.split(',').length).toBe(cols));
    expect(lines[1].startsWith('$250k Single-Family,,Prospect,')).toBe(true); // name, (no address), status
  });

  it('quotes names containing commas and quotes', () => {
    const csv = dealsToCsv([build({ ...PRESET_DEALS[0], name: 'Smith, "Big" Duplex' })]);
    expect(csv.split('\r\n')[1].startsWith('"Smith, ""Big"" Duplex",')).toBe(true);
  });
});

describe('maxOffer', () => {
  const deal = PRESET_DEALS[1]; // $500k duplex
  const all = { dscr: 1.25, cashFlowPerDoor: 200, coc: 8, useDscr: true, useCashFlow: true, useCoc: true };

  it('each ceiling lands exactly on its target', () => {
    const m = maxOffer(deal, all);
    const at = (key) => analyzeDeal({ ...deal, price: m.limits.find((l) => l.key === key).price });
    expect(at('dscr').dscr).toBeCloseTo(1.25, 8);
    expect(at('cashFlow').netCashFlow / 2).toBeCloseTo(200, 6);
    expect(at('coc').coc).toBeCloseTo(0.08, 8);
  });

  it('the offer is the tightest ceiling and meets every target', () => {
    const m = maxOffer(deal, all);
    expect(m.price).toBe(Math.min(...m.limits.map((l) => l.price)));
    const a = analyzeDeal({ ...deal, price: m.price });
    expect(a.dscr).toBeGreaterThanOrEqual(1.25 - 1e-9);
    expect(a.netCashFlow / 2).toBeGreaterThanOrEqual(200 - 1e-6);
    expect(a.coc).toBeGreaterThanOrEqual(0.08 - 1e-9);
    expect(m.vsAsking).toBeCloseTo(m.price - 500000, 6);
  });

  it('respects interest-only payments and rehab', () => {
    const io = { ...deal, ioYears: 10, rehabCost: 15000 };
    const m = maxOffer(io, { ...all, useDscr: false, useCashFlow: false });
    expect(analyzeDeal({ ...io, price: m.price }).coc).toBeCloseTo(0.08, 8);
  });

  it('reports no feasible price when rent cannot cover fixed costs', () => {
    const m = maxOffer({ ...deal, rentPerUnit: 300 }, all);
    expect(m.feasible).toBe(false);
  });

  it('returns no price when every target is off', () => {
    expect(maxOffer(deal, { ...all, useDscr: false, useCashFlow: false, useCoc: false }).price).toBeNull();
  });
});

describe('prepayment penalties', () => {
  it('steps down by loan year', () => {
    expect(prepayRate('5-4-3-2-1', 6)).toBe(0.05);
    expect(prepayRate('5-4-3-2-1', 12)).toBe(0.05);
    expect(prepayRate('5-4-3-2-1', 13)).toBe(0.04);
    expect(prepayRate('5-4-3-2-1', 60)).toBe(0.01);
    expect(prepayRate('5-4-3-2-1', 61)).toBe(0);
    expect(prepayRate('none', 6)).toBe(0);
  });

  it('charges a sale inside the penalty window', () => {
    const rows = projectDeal({ ...PRESET_DEALS[0], prepay: '3-2-1' }, 10);
    expect(rows[1].prepayPenalty).toBeCloseTo(rows[1].balance * 0.02, 6);
    expect(rows[3].prepayPenalty).toBe(0);
    const plain = projectDeal(PRESET_DEALS[0], 10);
    expect(rows[1].profitIfSold).toBeCloseTo(plain[1].profitIfSold - rows[1].prepayPenalty, 6);
  });
});

describe('ARV and cash-out refinance', () => {
  // A BRRRR-style deal: buy at $200k, $40k rehab, worth $300k after, refinance at 75% after year 1.
  const brrrr = {
    ...PRESET_DEALS[0],
    price: 200000,
    downPct: 20,
    rehabCost: 40000,
    arv: 300000,
    rentPerUnit: 2400,
    refiEnabled: true,
    refiYear: 1,
    refiLtv: 75,
    refiRate: 7.25,
    refiTermYears: 30,
    refiCostPct: 2,
    prepay: '3-2-1',
  };

  it('values the property from its after-repair value', () => {
    const a = analyzeDeal(brrrr);
    expect(a.value).toBe(300000);
    expect(a.forcedEquity).toBe(300000 - 200000 - 40000);
    expect(projectDeal(brrrr, 10)[0].value).toBeCloseTo(300000 * 1.03, 6);
  });

  it('pays off the old loan with penalty and fees, and hands back the rest', () => {
    const r = refiAnalysis(brrrr);
    const oldBalance = amortize(160000, 7, 30, 12)[11].balance;
    expect(r.year).toBe(1);
    expect(r.value).toBeCloseTo(309000, 6);
    expect(r.newLoan).toBeCloseTo(309000 * 0.75, 6);
    expect(r.oldBalance).toBeCloseTo(oldBalance, 6);
    expect(r.penalty).toBeCloseTo(oldBalance * 0.03, 6);
    expect(r.costs).toBeCloseTo(r.newLoan * 0.02, 6);
    expect(r.cashOut).toBeCloseTo(r.newLoan - oldBalance - r.penalty - r.costs, 6);
    expect(r.cashLeft).toBeCloseTo(analyzeDeal(brrrr).cashInvested - r.cashOut, 6);
    expect(r.payment).toBeCloseTo(monthlyPI(r.newLoan, 7.25, 30), 6);
  });

  it('carries the new loan through the projection, sale and IRR', () => {
    const rows = projectDeal(brrrr, 10);
    const r = refiAnalysis(brrrr);
    expect(rows[0].refiCash).toBeCloseTo(r.cashOut, 6);
    expect(rows[1].refiCash).toBe(0);
    expect(rows[1].cashFlow).toBeLessThan(rows[0].cashFlow); // bigger loan, bigger payment
    const newBal = amortize(r.newLoan, 7.25, 30, 108)[107].balance;
    expect(rows[9].balance).toBeCloseTo(newBal, 4);

    const sale = saleAnalysis(brrrr, rows);
    const flows = [-analyzeDeal(brrrr).cashInvested, ...rows.map((x) => x.cashFlow + x.refiCash)];
    flows[10] += sale.netProceeds;
    const npv = flows.reduce((s, cf, t) => s + cf / Math.pow(1 + sale.irr, t), 0);
    expect(Math.abs(npv)).toBeLessThan(0.01);
    expect(sale.profit).toBeCloseTo(rows[9].cumCashFlow + rows[9].cumCashOut + sale.netProceeds - analyzeDeal(brrrr).cashInvested, 6);
  });

  it('nets refinance costs out of total return', () => {
    const rows = projectDeal(brrrr, 10);
    const y = rows[9];
    expect(y.totalReturn).toBeCloseTo(y.cumCashFlow + y.cumPrincipal + y.cumAppreciation - y.cumRefiCosts, 6);
  });

  it('follows the refinance for an owned property', () => {
    const owned = { ...brrrr, status: 'owned', yearsOwned: 3 };
    const today = estimateToday(owned);
    expect(today.refinanced).toBe(true);
    const r = refiAnalysis(owned);
    expect(today.balance).toBeCloseTo(amortize(r.newLoan, 7.25, 30, 24)[23].balance, 4);
    const p = portfolioSummary([{ deal: owned, a: analyzeDeal(owned), rows: projectDeal(owned, 10) }]);
    expect(p.netCashFlow).toBeCloseTo(r.netCashFlow, 6);
  });

  it('has no refinance when disabled', () => {
    expect(refiAnalysis({ ...brrrr, refiEnabled: false })).toBeNull();
  });
});

describe('cash-on-cash after a refinance', () => {
  // A strong rehab: worth $340k after, so the refinance returns more than was invested.
  const base = { ...PRESET_DEALS[0], price: 200000, downPct: 20, rehabCost: 40000, arv: 340000, refiEnabled: true, refiYear: 1, refiLtv: 75, refiRate: 7.25, refiTermYears: 30, refiCostPct: 2 };
  it('is unlimited only when all cash is back and the deal still pays', () => {
    const pays = refiAnalysis({ ...base, rentPerUnit: 3600 });
    expect(pays.allCashBack).toBe(true);
    expect(pays.netCashFlow).toBeGreaterThan(0);
    expect(pays.cocAfter).toBe(Infinity);
    const loses = refiAnalysis({ ...base, rentPerUnit: 2400 });
    expect(loses.allCashBack).toBe(true);
    expect(loses.netCashFlow).toBeLessThan(0);
    expect(loses.cocAfter).toBeNaN();
  });
  it('is an ordinary percentage while cash is still in the deal', () => {
    const r = refiAnalysis({ ...base, arv: 300000, rentPerUnit: 3200 });
    expect(r.cashLeft).toBeGreaterThan(0);
    expect(r.cocAfter).toBeCloseTo((r.netCashFlow * 12) / r.cashLeft, 10);
  });
});

describe('today for owned properties', () => {
  it('uses the amortizing payment once an interest-only period has ended', () => {
    const d = { ...PRESET_OWNED[0], ioYears: 2, yearsOwned: 3 };
    const t = estimateToday(d);
    const a = analyzeDeal(d);
    expect(a.interestOnly).toBe(true);
    expect(t.payment).toBeCloseTo(monthlyPI(255000, 4.75, 28), 6); // IO for 2 of 30 years, then 28 to amortize
    expect(t.payment).toBeGreaterThan(a.pi);
    expect(t.netCashFlow).toBeCloseTo(a.grossRent * 0.77 - (t.payment + a.taxes + a.insurance + a.hoa), 6);
  });

  it('a prospect today is the deal at purchase', () => {
    const t = estimateToday(PRESET_DEALS[0]);
    const a = analyzeDeal(PRESET_DEALS[0]);
    expect(t.pitia).toBeCloseTo(a.pitia, 6);
    expect(t.netCashFlow).toBeCloseTo(a.netCashFlow, 6);
    expect(t.lenderApprovedButNegative).toBe(true);
  });

  it('projects the portfolio ten years from today, not from purchase', () => {
    const d = PRESET_OWNED[1]; // owned 5 years
    const p = portfolioSummary([{ deal: d, a: analyzeDeal(d) }]);
    const later = positionAt(d, 60 + 120);
    expect(p.year10Equity).toBeCloseTo(later.equity, 6);
    expect(later.value).toBeCloseTo(215000 * 1.03 ** 15, 4);
    expect(p.year10Proceeds).toBeCloseTo(later.value * 0.93 - later.balance, 4);
  });
});

describe('taxSnapshot', () => {
  const sfh = PRESET_DEALS[0];
  const tax = { rate: 32, landPct: 20, useLosses: false };

  it('depreciates the building share over 27.5 years', () => {
    const t = taxSnapshot(sfh, tax);
    expect(t.basis).toBeCloseTo((250000 + 7500) * 0.8, 6);
    expect(t.depreciation).toBeCloseTo(206000 / 27.5, 6);
  });

  it('deducts operating costs, interest and depreciation but not the CapEx reserve', () => {
    const t = taxSnapshot(sfh, tax);
    const a = analyzeDeal(sfh);
    expect(t.rentCollected).toBeCloseTo(2100 * 12 * 0.95, 6);
    expect(t.operating).toBeCloseTo((168 + 105 + 250 + 125) * 12, 6);
    expect(t.taxable).toBeCloseTo(t.rentCollected - t.operating - a.year1Interest - t.depreciation, 6);
  });

  it('carries a loss forward unless you can use it', () => {
    const kept = taxSnapshot(sfh, tax);
    expect(kept.taxable).toBeLessThan(0);
    expect(kept.taxDue).toBe(0);
    expect(kept.carryForward).toBeCloseTo(-kept.taxable, 6);
    expect(kept.afterTaxCashFlow).toBeCloseTo(analyzeDeal(sfh).annualCashFlow, 6);
    const used = taxSnapshot(sfh, { ...tax, useLosses: true });
    expect(used.taxDue).toBeCloseTo(used.taxable * 0.32, 6);
    expect(used.afterTaxCashFlow).toBeCloseTo(analyzeDeal(sfh).annualCashFlow - used.taxable * 0.32, 6);
    expect(used.carryForward).toBe(0);
  });

  it('taxes a profit and credits depreciation for the tax it avoids', () => {
    const rich = { ...PRESET_DEALS[2], rentPerUnit: 2200 };
    const t = taxSnapshot(rich, tax);
    expect(t.taxable).toBeGreaterThan(t.depreciation); // profitable even after depreciation
    expect(t.taxDue).toBeCloseTo(t.taxable * 0.32, 6);
    expect(t.depreciationSaves).toBeCloseTo(t.depreciation * 0.32, 6);
  });
});

describe('stressGrid', () => {
  it('has the saved deal at its center and gets worse with higher rates and lower rent', () => {
    const deal = PRESET_DEALS[1];
    const g = stressGrid(deal);
    const center = g[3][2];
    expect(center.rentPct).toBe(0);
    expect(center.rateDelta).toBe(0);
    expect(center.netCashFlow).toBeCloseTo(analyzeDeal(deal).netCashFlow, 6);
    expect(g[3][6].netCashFlow).toBeLessThan(center.netCashFlow);
    expect(g[0][2].netCashFlow).toBeLessThan(center.netCashFlow);
    expect(g[6][0].dscr).toBeGreaterThan(center.dscr);
  });
});

describe('loanSchedule', () => {
  it('adds up to the payments and notes interest-only and the refinance', () => {
    const deal = { ...PRESET_DEALS[0], ioYears: 5 };
    const s = loanSchedule(deal, 10);
    expect(s[0].principal).toBe(0);
    expect(s[0].note).toBe('Interest only');
    expect(s[5].note).toBe('Payments rise: principal starts');
    expect(s[5].payment).toBeGreaterThan(s[4].payment);
    s.forEach((y) => expect(y.payment).toBeCloseTo(y.interest + y.principal, 6));
    const refi = loanSchedule({ ...PRESET_DEALS[0], refiEnabled: true, refiYear: 2, arv: 300000, refiLtv: 75, refiRate: 7, refiTermYears: 30, refiCostPct: 2 }, 10);
    expect(refi[1].note).toMatch(/^Refinanced at year end/);
    expect(refi[2].balance).toBeGreaterThan(refi[0].balance);
  });
});

describe('safeHttpUrl', () => {
  it('keeps http(s) links and adds https to bare domains', async () => {
    const { safeHttpUrl } = await import('./format.js');
    expect(safeHttpUrl('https://www.zillow.com/homedetails/1')).toBe('https://www.zillow.com/homedetails/1');
    expect(safeHttpUrl('redfin.com/home/2')).toBe('https://redfin.com/home/2');
  });
  it('refuses scripts, data and empty values', async () => {
    const { safeHttpUrl } = await import('./format.js');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('  ')).toBeNull();
  });
});

describe('breakevenRate', () => {
  it('finds the rate where cash flow is zero', async () => {
    const { breakevenRate } = await import('./finance.js');
    const deal = PRESET_DEALS[2]; // cash-flowing fourplex at 7%
    const r = breakevenRate(deal);
    expect(r).toBeGreaterThan(7);
    expect(analyzeDeal({ ...deal, rate: r }).netCashFlow).toBeCloseTo(0, 4);
  });
  it('is null when the deal loses money even at 0%', async () => {
    const { breakevenRate } = await import('./finance.js');
    expect(breakevenRate({ ...PRESET_DEALS[0], rentPerUnit: 600 })).toBeNull();
  });
});

describe('Canadian rules', () => {
  const ca = { ...PRESET_DEALS[1], country: 'ca', closingPct: 1 }; // $500k duplex, Ontario
  const all = { dscr: 1.25, cashFlowPerDoor: 200, coc: 8, useDscr: true, useCashFlow: true, useCoc: true };

  it('compounds the mortgage rate semi-annually', async () => {
    const { loanRate } = await import('./finance.js');
    // The standard Canadian figure for $400k at 5% over 25 years.
    expect(monthlyPI(400000, loanRate(5, { country: 'ca' }), 25)).toBeCloseTo(2326.42, 2);
    expect(loanRate(5, { country: 'us' })).toBe(5);
    expect(analyzeDeal({ ...ca, price: 500000, downPct: 20, rate: 5, termYears: 25 }).pi).toBeCloseTo(2326.42, 2);
  });

  it('charges Ontario land transfer tax by band', async () => {
    const { ontarioLandTransferTax } = await import('./finance.js');
    expect(ontarioLandTransferTax(55000)).toBeCloseTo(275, 6);
    expect(ontarioLandTransferTax(300000)).toBeCloseTo(2975, 6);
    expect(ontarioLandTransferTax(404900)).toBeCloseTo(4573, 6);
    expect(ontarioLandTransferTax(500000)).toBeCloseTo(6475, 6);
    // The 2.5% band over $2M applies to one or two single-family homes only.
    expect(ontarioLandTransferTax(2500000, 1)).toBeCloseTo(48975, 6);
    expect(ontarioLandTransferTax(2500000, 3)).toBeCloseTo(46475, 6);
  });

  it('adds the tax to closing costs and cash invested', () => {
    const a = analyzeDeal(ca);
    expect(a.landTransferTax).toBeCloseTo(6475, 6);
    expect(a.closingCosts).toBeCloseTo(5000 + 6475, 6);
    expect(a.cashInvested).toBeCloseTo(125000 + 11475, 6);
    expect(analyzeDeal(PRESET_DEALS[1]).landTransferTax).toBe(0);
  });

  it('still lands the max offer exactly on each target', () => {
    const m = maxOffer({ ...ca, rentPerUnit: 2600 }, all);
    const at = (key) => analyzeDeal({ ...ca, rentPerUnit: 2600, price: m.limits.find((l) => l.key === key).price });
    expect(at('dscr').dscr).toBeCloseTo(1.25, 8);
    expect(at('cashFlow').netCashFlow / 2).toBeCloseTo(200, 6);
    expect(at('coc').coc).toBeCloseTo(0.08, 6);
  });

  it('caps CCA so it never creates or deepens a rental loss', () => {
    const tax = { rate: 30, landPct: 20, useLosses: false };
    const losing = taxSnapshot({ ...ca, rentPerUnit: 1500 }, tax);
    expect(losing.rules).toBe('ca');
    expect(losing.depreciation).toBe(0);
    expect(losing.taxable).toBeLessThan(0);
    // The loss itself still reduces tax on other income, whatever the US toggle says.
    expect(losing.taxDue).toBeCloseTo(losing.taxable * 0.3, 6);
    expect(losing.ccaUnused).toBeCloseTo(losing.ccaAvailable, 6);

    const earning = taxSnapshot({ ...ca, rentPerUnit: 3400 }, tax);
    const before = earning.rentCollected - earning.operating - earning.interest;
    expect(earning.ccaAvailable).toBeCloseTo(earning.basis * 0.04, 6);
    expect(earning.depreciation).toBeCloseTo(Math.min(earning.ccaAvailable, before), 6);
    expect(earning.taxable).toBeCloseTo(before - earning.depreciation, 6);
    expect(earning.taxable).toBeGreaterThanOrEqual(0);
  });
});

describe('allCash', () => {
  const deal = PRESET_DEALS[0];
  const c = analyzeDeal(allCash(deal));

  it('drops the loan, its payment and the lender reserves', () => {
    expect(c.loanAmount).toBe(0);
    expect(c.pi).toBe(0);
    expect(c.reserves).toBe(0);
    expect(c.cashInvested).toBeCloseTo(deal.price + c.closingCosts + (deal.rehabCost || 0), 6);
  });

  it('leaves cash-on-cash as the income on the full cost', () => {
    expect(c.coc).toBeCloseTo(c.annualCashFlow / c.cashInvested, 10);
    expect(c.netCashFlow).toBeCloseTo(c.grossRent - c.taxes - c.insurance - c.hoa - c.opex.total, 6);
    expect(paybackYears(c)).toBeCloseTo(c.cashInvested / c.annualCashFlow, 10);
    expect(paybackYears(analyzeDeal(allCash({ ...deal, rentPerUnit: 300 })))).toBeNull();
  });

  it('prices a loan by a year of payments over the amount borrowed', () => {
    const loan = analyzeDeal(deal);
    // $187,500 at 7% over 30 years: $1,247.44 a month, about 7.98% of the loan a year.
    expect(loanConstant(loan)).toBeCloseTo((1247.44 * 12) / 187500, 4);
    expect(loanConstant(c)).toBeNull();
  });
});
