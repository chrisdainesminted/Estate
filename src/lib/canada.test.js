import { describe, expect, it } from 'vitest';
import { CITIES, PROVINCES, cityByKey, deductionRefund, guessCity, incomeTax, provincialHomeCredit, transferRelief, transferTax } from './canada.js';

describe('places', () => {
  it('has every province and territory, each with an elsewhere entry', () => {
    expect(PROVINCES).toHaveLength(13);
    for (const p of PROVINCES) expect(CITIES.some((c) => c.key === `${p.code.toLowerCase()}-other` && c.province === p.code)).toBe(true);
    expect(new Set(CITIES.map((c) => c.key)).size).toBe(CITIES.length);
  });

  it('falls back to Toronto for an unknown city, and guesses from the time zone', () => {
    expect(cityByKey('nowhere').key).toBe('toronto');
    expect(guessCity('America/Vancouver')).toBe('vancouver');
    expect(guessCity('Europe/Paris')).toBe('toronto');
  });
});

describe('land transfer tax', () => {
  it('uses Ontario’s bands, and adds Toronto’s on top in Toronto', () => {
    expect(transferTax(400000, { city: 'thunder-bay' })).toBeCloseTo(4475, 6);
    expect(transferTax(400000, { city: 'toronto' })).toBeCloseTo(8950, 6);
    const relief = transferRelief(400000, { city: 'toronto' });
    expect(relief.map((r) => r.amount)).toEqual([4000, 4475]);
  });

  it('exempts a BC first-time buyer’s first $500,000 up to $835,000, phased out by $860,000', () => {
    expect(transferTax(500000, { city: 'vancouver' })).toBeCloseTo(8000, 6);
    expect(transferRelief(500000, { city: 'vancouver' })[0].amount).toBeCloseTo(8000, 6);
    expect(transferRelief(840000, { city: 'vancouver' })[0].amount).toBeCloseTo(6400, 6);
    expect(transferRelief(900000, { city: 'vancouver' })).toEqual([]);
  });

  it('charges Manitoba’s bands, Alberta’s title fee, and Montréal more than the rest of Quebec', () => {
    expect(transferTax(300000, { city: 'winnipeg' })).toBeCloseTo(3650, 6);
    expect(transferTax(400000, { city: 'calgary' })).toBe(450);
    expect(transferTax(700000, { city: 'montreal' })).toBeGreaterThan(transferTax(700000, { city: 'quebec-city' }));
    expect(transferRelief(400000, { city: 'quebec-city' })[0].amount).toBeLessThanOrEqual(5875);
  });

  it('gives no relief where the province has none', () => {
    expect(transferRelief(400000, { city: 'halifax' })).toEqual([]);
    expect(transferRelief(400000, { city: 'calgary' })).toEqual([]);
  });

  it('adds Quebec’s and Saskatchewan’s home buyers’ credits only there', () => {
    expect(provincialHomeCredit('QC').amount).toBe(1400);
    expect(provincialHomeCredit('ON')).toBeNull();
  });
});

describe('income tax', () => {
  it('refunds an $8,000 FHSA deposit at about the marginal rate, more where tax is higher', () => {
    expect(deductionRefund(70000, 8000, 'ON')).toBeCloseTo(8000 * (0.205 + 0.0915), 0);
    expect(deductionRefund(70000, 8000, 'QC')).toBeGreaterThan(deductionRefund(70000, 8000, 'AB'));
    expect(incomeTax(15000, 'AB')).toBe(0);
  });
});
