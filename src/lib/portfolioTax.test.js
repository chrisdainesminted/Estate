import { describe, expect, it } from 'vitest';
import { boughtMonth, ccaClassFor, portfolioTaxLines } from './portfolioTax.js';
import { loanRate, monthlyPI } from './finance.js';

const today = new Date(2026, 10, 7); // Nov 7, 2026
const home = {
  id: 'd1',
  status: 'owned',
  name: '318 Dease St',
  country: 'ca',
  price: 200000,
  downPct: 20,
  rate: 5,
  termYears: 25,
  bought: '2025-08',
  taxesAnnual: 3000,
  insuranceAnnual: 1500,
  hoaMonthly: 0,
  estimated: false,
  workItems: [
    { id: 'w1', what: 'New windows', cost: 14500, when: '2026-04' },
    { id: 'w2', what: 'Tree removal', cost: 3500, when: '2026-06' },
    { id: 'w3', what: 'New fridge', cost: 1400, when: '2026-07' },
    { id: 'w4', what: 'Plumbing', cost: 850, when: '2025-10' },
    { id: 'w5', what: 'Deck', cost: 4000 },
  ],
};

describe('portfolioTaxLines', () => {
  it('works out a full past year from Portfolio', () => {
    const r = portfolioTaxLines([home], 2025, today);
    const by = Object.fromEntries(r.expenses.map((e) => [e.category, e]));
    // Owned August to December: 5 months.
    expect(by.propertyTax.amount).toBe(1250);
    expect(by.insurance.amount).toBe(625);
    expect(by.propertyTax.date).toBe('2025-12-31');
    // Interest: about 5 months on $160,000 at 5%, a little under 160,000 × 5% × 5/12.
    expect(by.interest.amount).toBeGreaterThan(3200);
    expect(by.interest.amount).toBeLessThan(3334);
    expect(by.repairs).toMatchObject({ amount: 850, date: '2025-10-31' });
    expect(r.assets).toEqual([]);
  });

  it('uses the loan’s own schedule for interest', () => {
    const r = portfolioTaxLines([{ ...home, bought: '2026-01', workItems: [] }], 2026, today);
    const monthly = monthlyPI(160000, loanRate(5, { country: 'ca' }), 25);
    const interest = r.expenses.find((e) => e.category === 'interest').amount;
    // Jan to Nov: 11 payments, mostly interest early on.
    expect(interest).toBeGreaterThan(monthly * 11 * 0.6);
    expect(interest).toBeLessThan(monthly * 11);
    expect(r.expenses.find((e) => e.category === 'propertyTax').date).toBe('2026-11-07');
  });

  it('puts repairs in expenses and improvements in capital cost allowance', () => {
    const r = portfolioTaxLines([home], 2026, today);
    expect(r.expenses.filter((e) => e.category === 'repairs').map((e) => e.label)).toEqual(['Tree removal']);
    expect(r.assets.map((a) => [a.label, a.ccaClass, a.cost, a.available])).toEqual([
      ['318 Dease St: New windows', '1', 14500, '2026-04-01'],
      ['318 Dease St: New fridge', '8', 1400, '2026-07-01'],
    ]);
    expect(r.undated).toEqual([{ home: '318 Dease St', what: 'Deck', cost: 4000 }]);
    // Each line has a stable key, so it's added once.
    expect(new Set(r.expenses.map((e) => e.source)).size).toBe(r.expenses.length);
  });

  it('skips years before it was bought, and homes you don’t own', () => {
    expect(portfolioTaxLines([home], 2024, today).expenses).toEqual([]);
    expect(portfolioTaxLines([{ ...home, status: 'prospect' }], 2026, today).expenses).toEqual([]);
  });

  it('knows when it was bought, and the CCA class', () => {
    expect(boughtMonth({ bought: '2025-08' })).toBe(2025 * 12 + 7);
    expect(boughtMonth({ yearsOwned: 1 }, today)).toBe(2025 * 12 + 10);
    expect(ccaClassFor('New dishwasher')).toBe('8');
    expect(ccaClassFor('New roof')).toBe('1');
  });
});
