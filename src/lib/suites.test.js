import { describe, expect, it } from 'vitest';
import { STEPS, allowedFor, moneyFor, stepsFor, suitePayback } from './suites.js';

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

  it('lists the same permit steps everywhere, with city pages where Bedrock has them', () => {
    expect(new Set(STEPS.map((s) => s.key)).size).toBe(STEPS.length);
    expect(stepsFor('calgary').map((s) => s.key)).toEqual(STEPS.map((s) => s.key));
    expect(stepsFor('thunder-bay').every((s) => s.url.startsWith('https://'))).toBe(true);
    expect(stepsFor('calgary').every((s) => s.url === undefined)).toBe(true);
    expect(stepsFor('ottawa')[1].body).toMatch(/BCIN/);
    expect(stepsFor('halifax')[1].body).not.toMatch(/BCIN/);
  });

  it('gives the province’s rules, the city’s where known, and its grants only there', () => {
    expect(allowedFor('ottawa')[0].text).toMatch(/Ontario law/);
    expect(allowedFor('vancouver')[0].text).toMatch(/BC/);
    expect(allowedFor('halifax')).toHaveLength(1);
    expect(allowedFor('thunder-bay').length).toBeGreaterThan(2);
    expect(moneyFor('thunder-bay').some((m) => /Additional Dwelling Unit grant/.test(m.text))).toBe(true);
    expect(moneyFor('calgary').some((m) => /Additional Dwelling Unit grant/.test(m.text))).toBe(false);
  });
});
