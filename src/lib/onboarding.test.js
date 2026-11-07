import { describe, expect, it } from 'vitest';
import { buyingRange, comfortBudget, investingReach, normalizeOnboarding, startMode } from './onboarding.js';
import { incomeTax } from './canada.js';
import { closingCash } from './firstHome.js';

const profile = { income: 110000, savings: 60000, debts: 400, rentNow: 1800, city: 'thunder-bay', firstTime: true, entered: true };

describe('normalizeOnboarding', () => {
  it('keeps only answers it knows', () => {
    expect(normalizeOnboarding({ done: true, goals: ['invest', 'buy', 'invest', 'nope'], portfolio: '11-50', investCash: '250000', finance: 'dscr', at: '2026-11-07' })).toEqual({
      done: true,
      skipped: false,
      at: '2026-11-07',
      goals: ['invest', 'buy'],
      portfolio: '11-50',
      investCash: 250000,
      finance: 'dscr',
    });
    expect(normalizeOnboarding({ portfolio: '7', finance: 'loan', investCash: -5 })).toMatchObject({ done: false, portfolio: null, finance: null, investCash: 0 });
    expect(normalizeOnboarding(null).goals).toEqual([]);
  });

  it('opens the app in the first mode chosen', () => {
    expect(startMode(['invest', 'buy'])).toBe('invest');
    expect(startMode(['sell'])).toBe('sell');
    expect(startMode([])).toBe('buy');
  });
});

describe('comfortBudget', () => {
  it('is take-home pay less living costs, debts and a tenth kept back', () => {
    const takeHome = (110000 - incomeTax(110000, 'ON')) / 12;
    const c = comfortBudget({ income: 110000, living: 2500, debts: 400, province: 'ON' });
    expect(c.takeHome).toBe(Math.round(takeHome));
    expect(c.budget).toBe(Math.round(takeHome * 0.9 - 2900));
    expect(comfortBudget({ income: 110000, living: null })).toBe(null);
    expect(comfortBudget({ income: 40000, living: 5000, province: 'ON' }).budget).toBe(0);
  });
});

describe('buyingRange', () => {
  it('gives the bank’s most and a comfortable price at or below it', () => {
    const r = buyingRange({ profile, living: 2500, ratePct: 5.14, insuranceMonthly: 100 });
    expect(r.max).toBeGreaterThan(200000);
    expect(r.comfortable).toBeGreaterThan(0);
    expect(r.comfortable).toBeLessThanOrEqual(r.max);
    expect(r.monthlyAtComfort).toBeLessThanOrEqual(r.budget + 1);
    expect(r.max).toBe(Math.min(r.byIncome, r.bySavings));
  });

  it('spends less comfortably when everyday costs are higher', () => {
    const low = buyingRange({ profile, living: 1500, ratePct: 5.14 });
    const high = buyingRange({ profile, living: 4000, ratePct: 5.14 });
    expect(high.comfortable).toBeLessThan(low.comfortable);
    expect(high.max).toBe(low.max); // the bank doesn't ask about groceries
  });

  it('has no comfortable figure without living costs', () => {
    const r = buyingRange({ profile, living: null, ratePct: 5.14 });
    expect(r.comfortable).toBe(null);
    expect(r.max).toBeGreaterThan(0);
  });
});

describe('investingReach', () => {
  it('covers 20% down and closing costs with a mortgage', () => {
    const r = investingReach({ cash: 150000, finance: 'bank', city: 'thunder-bay' });
    expect(r.down).toBe(Math.round(r.price * 0.2));
    expect(r.down + closingCash({ price: r.price, units: 2, firstTime: false, city: 'thunder-bay' }).total).toBeLessThanOrEqual(150000);
    expect(r.price).toBeGreaterThan(500000);
    expect(r.price).toBeLessThan(750000);
  });

  it('covers the whole price in cash', () => {
    const cash = investingReach({ cash: 150000, finance: 'cash', city: 'thunder-bay' });
    expect(cash.price).toBeLessThan(150000);
    expect(cash.price).toBeGreaterThan(130000);
    expect(investingReach({ cash: null })).toBe(null);
  });
});
