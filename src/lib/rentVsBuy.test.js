import { describe, expect, it } from 'vitest';
import { rentVsBuy } from './rentVsBuy.js';

const base = { price: 400000, units: 1, city: 'thunder-bay', rentNow: 1700, ratePct: 4.9, taxPct: 1, insuranceMonthly: 125 };

describe('rent vs buy', () => {
  it('runs ten years, one row a year, with the least down and closing costs up front', () => {
    const r = rentVsBuy(base);
    expect(r.rows).toHaveLength(10);
    expect(r.down).toBe(20000);
    expect(r.upfront).toBeGreaterThan(r.down);
    expect(r.rows[9].balance).toBeLessThan(r.rows[0].balance);
  });

  it('a tenant paying part of the mortgage makes buying come out further ahead', () => {
    const alone = rentVsBuy(base);
    const duplex = rentVsBuy({ ...base, units: 2, rentFromOthers: 1400 });
    expect(duplex.ahead).toBeGreaterThan(alone.ahead);
    expect(duplex.buyFirst).toBeLessThan(alone.buyFirst);
  });

  it('cheap rent and a flat market favour renting', () => {
    const r = rentVsBuy({ ...base, rentNow: 900, appreciationPct: 0, investPct: 7 });
    expect(r.ahead).toBeLessThan(0);
    expect(r.breakEvenYear).toBeNull();
  });
});
