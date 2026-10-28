import { describe, expect, it } from 'vitest';
import { allCash, analyzeDeal, maxOffer, ownMoney, projectDeal, saleAnalysis, taxSnapshot } from './finance.js';
import { PRESET_DEALS } from './presets.js';
import {
  breakevenSentence,
  cashFlowMeaning,
  cashInMeaning,
  cashRankingMeaning,
  cashRentMeaning,
  cashSaleMeaning,
  cashSentence,
  cashYearsMeaning,
  cocMeaning,
  compareSummary,
  dealSentence,
  dscrMeaning,
  equityMeaning,
  leverageMeaning,
  listingSentence,
  mortgageMeaning,
  offerMeaning,
  ownCashMeaning,
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
    expect(cocMeaning(a, { useCoc: true, coc: 8 })).toBe('−\u2060$65 a year on the $70,000 you put in. Your target is 8%.');
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
    // Said aloud, 8% and 11% start with a vowel sound.
    expect(whatIfSummary(trap, { rateDelta: 1, downPct: null, rentPct: 0 })).toBe('Testing an 8% rate.');
    expect(whatIfSummary(trap, { rateDelta: 4, downPct: null, rentPct: 0 })).toBe('Testing an 11% rate.');
    expect(whatIfSummary(trap, { rateDelta: 3, downPct: null, rentPct: 0 })).toBe('Testing a 10% rate.');
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
      'B keeps the most each month: +\u2060$120.',
      'C is the easiest for a lender to approve (DSCR 1.40).',
      'C makes the most if you sell in year 10: +\u2060$120,000.',
    ]);
    expect(compareSummary([item('A', 1, 1, 1)])).toEqual([]);
  });
});

describe('the Cash tab: your own money, 20% down', () => {
  const c = analyzeDeal(ownMoney(trap));
  const s = analyzeDeal(ownMoney(strong));
  const pay = `$${Math.round(c.pi).toLocaleString('en-US')}`;

  it('says what the cash earns after the mortgage payment', () => {
    // 20% down, $200,000 at 7% over 30 years: about $1,331 a month, which tips the starter deal into a loss.
    expect(c.pi).toBeCloseTo(1330.6, 1);
    expect(cashSentence(c)).toBe(`With 20% down, it would cost you about $${Math.round(-c.netCashFlow)} a month: the rent doesn’t cover the ${pay} mortgage payment plus taxes, insurance and running costs.`);
    expect(cashSentence(s)).toBe('With 20% down, $57,500 of your own money in all, it would pay you about $527 a month after the $1,331 mortgage payment and every cost: an 11.0% cash-on-cash return.');
    expect(mortgageMeaning(analyzeDeal(ownMoney({ ...trap, price: 1000000 })), trap)).toMatch(/^Principal and interest on an \$800,000 loan /);
    expect(mortgageMeaning(c, trap)).toBe('Principal and interest on a $200,000 loan (the price minus your 20% down) at 7% over 30 years.');
    expect(cashRentMeaning(c)).toBe(`Rent $2,100, minus the ${pay} mortgage payment, $375 for taxes and insurance, and $483 of running costs.`);
  });

  it('says how long the cash takes to come back', () => {
    expect(ownCashMeaning(c)).toBe('$50,000 down + $7,500 closing costs. Cash flow alone never pays it back.');
    expect(ownCashMeaning(s)).toBe(`$50,000 down + $7,500 closing costs. Cash flow pays it back in about ${Math.round(57500 / s.annualCashFlow)} years.`);
    expect(cashYearsMeaning(c, projectDeal(ownMoney(trap), 10), 0)).toMatch(/^Cash flow over 10 years adds up to −\u2060\$[\d,]+, so none of your cash comes back from it\.$/);
    expect(cashYearsMeaning(s, projectDeal(ownMoney(strong), 10), 0)).toMatch(/^Cash flow added up over 10 years: \d+% of your cash back(, all of it by year \d+)?\.$/);
    const sale = saleAnalysis(ownMoney(strong), projectDeal(ownMoney(strong), 10));
    expect(cashSaleMeaning(sale)).toMatch(/^If you sold in year 10: \+\u2060\$[\d,]+ profit, counting every year’s cash flow, after selling costs and paying off the mortgage, like earning [\d.]+% a year on your \$57,500\.$/);
  });

  it('says whether the mortgage raises or lowers the return', () => {
    const cash = analyzeDeal(allCash(trap));
    expect(leverageMeaning(cash, c)).toMatch(/^Paying all cash would earn more per dollar: a year of mortgage payments costs 8\.0% of the loan, more than the 5\.8% the property earns on its full cost/);
    const cheap = { ...strong, rate: 3 };
    expect(leverageMeaning(analyzeDeal(allCash(cheap)), analyzeDeal(ownMoney(cheap)))).toMatch(/^The mortgage raises your return: a year of mortgage payments costs 5\.\d% of the loan, less than/);
    expect(leverageMeaning(cash, cash)).toBeNull();
  });

  it('names the deal that pays the most, or says none of them pays', () => {
    expect(cashRankingMeaning({ deal: strong, c: s })).toBe(`${strong.name} would pay the most on your cash: 11.0% a year.`);
    expect(cashRankingMeaning({ deal: trap, c })).toBe(`None of your deals pays you each month with 20% down. ${trap.name} comes closest: −1.8% a year.`);
    expect(cashRankingMeaning(undefined)).toBeNull();
  });
});
