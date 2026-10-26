import { describe, expect, it } from 'vitest';
import {
  amortize,
  analyzeDeal,
  applyAdjustments,
  estimateToday,
  irr,
  isNeutralAdjustment,
  monthlyPI,
  portfolioSummary,
  projectDeal,
  saleAnalysis,
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
    expect(lines[1].startsWith('$250k Single-Family,Prospect,')).toBe(true);
  });

  it('quotes names containing commas and quotes', () => {
    const csv = dealsToCsv([build({ ...PRESET_DEALS[0], name: 'Smith, "Big" Duplex' })]);
    expect(csv.split('\r\n')[1].startsWith('"Smith, ""Big"" Duplex",')).toBe(true);
  });
});
