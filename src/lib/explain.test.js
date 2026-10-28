import { describe, expect, it } from 'vitest';
import { analyzeDeal, maxOffer, projectDeal, saleAnalysis, taxSnapshot } from './finance.js';
import { PRESET_DEALS } from './presets.js';
import {
  breakevenSentence,
  cashFlowMeaning,
  cashInMeaning,
  cocMeaning,
  compareSummary,
  dealSentence,
  dscrMeaning,
  equityMeaning,
  listingSentence,
  offerMeaning,
  portfolioCashMeaning,
  portfolioDscrMeaning,
  saleMeaning,
  stressSentence,
  taxMeaning,
  whatIfSummary,
} from './explain.js';

// The starter $250k single-family: a 1.29 DSCR that still loses about $5 a month.
const trap = PRESET_DEALS[0];
const strong = { ...trap, rentPerUnit: 2900 };
const underwater = { ...trap, rentPerUnit: 1300 };

describe('dealSentence', () => {
  it('names the trap: lender yes, bank account no', () => {
    const a = analyzeDeal(trap);
    expect(a.lenderApprovedButNegative).toBe(true);
    expect(dealSentence(a)).toBe(`A lender would likely approve this, but it would cost you about $${Math.round(-a.netCashFlow)} a month out of pocket once repairs, vacancy and management are paid.`);
  });

  it('says plainly when a deal works', () => {
    const a = analyzeDeal(strong);
    expect(a.netCashFlow).toBeGreaterThan(0);
    expect(dealSentence(a)).toMatch(/^It puts about \$[\d,]+ a month in your pocket after every cost, and a lender would likely approve it\.$/);
  });

  it('says when most lenders would say no', () => {
    expect(dealSentence(analyzeDeal(underwater))).toMatch(/^Most lenders would turn this down, and it would cost you about \$[\d,]+ a month out of pocket\.$/);
  });
});

describe('number meanings', () => {
  const a = analyzeDeal(trap);

  it('reads DSCR as rent per dollar of payment', () => {
    expect(dscrMeaning(a)).toBe(`Rent brings in $${a.dscr.toFixed(2)} for every $1 of loan payment, tax and insurance.`);
  });

  it('explains cash flow, the return and the cash it takes', () => {
    expect(cashFlowMeaning(a)).toMatch(/^What you’d pay in each month .* \$65 a year\.$/);
    expect(cocMeaning(a, { useCoc: true, coc: 8 })).toBe('−$65 a year on the $70,000 you put in. Your target is 8%.');
    expect(cocMeaning(a, { useCoc: false, coc: 8 })).not.toMatch(/target/);
    expect(cashInMeaning(a)).toBe(`$62,500 down + $7,500 closing costs. Lenders also want ${'$' + Math.round(a.reserves).toLocaleString('en-US')} kept in the bank.`);
  });

  it('gives the break-even rent, or the room before it', () => {
    expect(breakevenSentence(a)).toBe(`To break even, rent would need to be $${Math.round(a.breakevenRent).toLocaleString('en-US')} a month, up from $2,100.`);
    expect(breakevenSentence(analyzeDeal(strong))).toMatch(/^Rent could fall to \$[\d,]+ a month before it stops paying for itself\.$/);
    expect(breakevenSentence(analyzeDeal({ ...strong, units: 2, unitType: 'duplex' }))).toMatch(/a month per unit/);
  });

  it('describes the stress test either way', () => {
    expect(stressSentence(a, 7, 6.96)).toBe('At today’s 7% it already loses money. It needs +0.3% rent or a rate under 6.96% to break even.');
    expect(stressSentence(analyzeDeal(strong), 7, null)).toMatch(/^Cash flow holds until rent falls \d+\.\d%\.$/);
  });
});

describe('whatIfSummary', () => {
  it('lists only the sliders that moved', () => {
    expect(whatIfSummary(trap, { rateDelta: 0, downPct: null, rentPct: 0 })).toBeNull();
    expect(whatIfSummary(trap, { rateDelta: 0, downPct: 25, rentPct: 0 })).toBeNull();
    expect(whatIfSummary(trap, { rateDelta: 0.5, downPct: null, rentPct: 0 })).toBe('Testing a 7.5% rate.');
    expect(whatIfSummary(trap, { rateDelta: -0.125, downPct: 30, rentPct: -5 })).toBe('Testing a 6.875% rate, 30% down and rent down 5%.');
  });
});

describe('offerMeaning', () => {
  it('compares the max offer with asking and names the limiting target', () => {
    const m = maxOffer(trap, { dscr: 1.25, cashFlowPerDoor: 200, coc: 8, useDscr: true, useCashFlow: true, useCoc: true });
    expect(offerMeaning(m, 250000)).toBe(`That’s $${Math.round(250000 - m.price).toLocaleString('en-US')} under asking. Pay more and you’d miss your 8% cash-on-cash target.`);
    expect(offerMeaning({ price: null, limits: [] }, 250000)).toBe('Turn on a target to see the most you should pay.');
    expect(offerMeaning({ price: 0, feasible: false, limits: [] }, 250000)).toMatch(/^No price works/);
  });
});

describe('saleMeaning and taxMeaning', () => {
  it('turns IRR into a yearly rate on the cash put in', () => {
    const sale = saleAnalysis(trap, projectDeal(trap, 10));
    expect(saleMeaning(sale)).toMatch(/^Profit after selling costs and paying off the loan: like earning \d+\.\d% a year on your \$70,000\.$/);
  });

  it('explains a paper loss, and tax saved when losses are usable', () => {
    expect(taxMeaning(taxSnapshot(trap, { rate: 32, landPct: 20, useLosses: false }))).toMatch(/^No tax in year 1: depreciation turns it into a \$[\d,]+ paper loss for later years\.$/);
    expect(taxMeaning(taxSnapshot(trap, { rate: 32, landPct: 20, useLosses: true }))).toMatch(/^A \$[\d,]+ paper loss saves about \$[\d,]+ of tax on your other income\.$/);
    expect(taxMeaning(taxSnapshot({ ...strong, country: 'ca' }, { rate: 32, landPct: 20, useLosses: false }))).toMatch(/capital cost allowance/);
  });
});

describe('listingSentence', () => {
  const listing = (deal, offerPrice) => {
    const a = analyzeDeal(deal);
    return { a, perDoor: a.netCashFlow / a.units, offer: { price: offerPrice } };
  };

  it('says "and" when cash and lender agree, "but" when they don’t', () => {
    expect(listingSentence(listing(strong, 300000))).toMatch(/^It puts about \$[\d,]+ a month in your pocket after every cost, and a lender would likely approve it\. Asking is \$50,000 under your max offer\.$/);
    expect(listingSentence(listing(trap, 200000))).toMatch(/^It would cost you about \$\d+ a month out of pocket, but a lender would likely approve it\. Asking is \$50,000 over your max offer\.$/);
    expect(listingSentence(listing(underwater, null))).toMatch(/out of pocket, and most lenders would turn it down\.$/);
  });
});

describe('portfolio and compare meanings', () => {
  it('speaks for the whole portfolio', () => {
    const p = { netCashFlow: 951, annualCashFlow: 11418, dscr: 1.71, value: 620771, debt: 397867 };
    expect(portfolioCashMeaning(p)).toBe('What all your rentals put in your pocket each month after every cost: $11,418 a year.');
    expect(portfolioDscrMeaning(p)).toBe('Across all your loans, rent brings in $1.71 for every $1 of payment. Lenders check this before your next loan.');
    expect(equityMeaning(p)).toBe('What you’d own after paying off the loans: $620,771 of property, less $397,867 owed.');
  });

  it('names the winner on cash, lender approval and sale profit', () => {
    const item = (name, cf, dscr, profit) => ({ deal: { name }, a: { netCashFlow: cf, dscr }, sale: { profit, year: 10 } });
    const lines = compareSummary([item('A', -5, 1.29, 80909), item('B', 120, 1.15, 60000), item('C', 40, 1.4, 120000)]);
    expect(lines.map((l) => `${l.name} ${l.text}`)).toEqual([
      'B keeps the most each month: +$120.',
      'C is the easiest for a lender to approve (DSCR 1.40).',
      'C makes the most if you sell in year 10: +$120,000.',
    ]);
    expect(compareSummary([item('A', 1, 1, 1)])).toEqual([]);
  });
});
