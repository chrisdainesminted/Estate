import { describe, expect, it } from 'vitest';
import { STEPS, suitePayback } from './suites.js';

describe('suitePayback', () => {
  it('repays cash from rent after empty months and upkeep', () => {
    const s = suitePayback({ buildCost: 90000, rent: 1400 });
    expect(s.cashIn).toBe(90000);
    expect(s.netRent).toBeCloseTo(1400 * 0.88, 6);
    expect(s.paybackYears).toBeCloseTo(90000 / (1400 * 0.88 * 12), 6);
  });

  it('takes the loan payment off the rent when you borrow to build', () => {
    const s = suitePayback({ buildCost: 90000, rent: 1400, borrowPct: 100, ratePct: 5, years: 25 });
    expect(s.cashIn).toBe(0);
    expect(s.payment).toBeGreaterThan(500);
    expect(s.monthly).toBeCloseTo(s.netRent - s.payment, 6);
    expect(suitePayback({ buildCost: 300000, rent: 500, borrowPct: 100 }).paybackYears).toBeNull();
  });

  it('lists the permit steps with unique keys and a source each', () => {
    expect(new Set(STEPS.map((s) => s.key)).size).toBe(STEPS.length);
    expect(STEPS.every((s) => s.url.startsWith('https://'))).toBe(true);
  });
});
