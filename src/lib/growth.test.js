import { describe, expect, it } from 'vitest';
import { analyzeDeal } from './finance.js';
import { dealAt, simulateGrowth } from './growth.js';
import { PRESET_DEALS, PRESET_OWNED } from './presets.js';

const fourplex = PRESET_DEALS[2];
const plan = (over = {}) => ({ cashOnHand: 0, monthlySavings: 0, reinvest: true, targetDoors: 0, ...over });

describe('dealAt', () => {
  it('prices the template forward by its growth rates', () => {
    const d = dealAt({ ...fourplex, rentGrowthPct: 2 }, 24);
    expect(d.price).toBeCloseTo(500000 * 1.03 ** 2, 6);
    expect(d.rentPerUnit).toBeCloseTo(1350 * 1.02 ** 2, 6);
    expect(dealAt(fourplex, 0).price).toBe(500000);
  });
});

describe('simulateGrowth', () => {
  it('does nothing without cash or a deal', () => {
    const s = simulateGrowth({ template: fourplex, plan: plan() });
    expect(s.purchases).toHaveLength(0);
    expect(s.end.doors).toBe(0);
    expect(simulateGrowth({ plan: plan({ cashOnHand: 1e6 }) }).purchases).toHaveLength(0);
  });

  it('buys today when cash covers cash invested plus reserves, not before', () => {
    const a = analyzeDeal(fourplex);
    const exact = simulateGrowth({ template: fourplex, plan: plan({ cashOnHand: a.cashNeeded }) });
    expect(exact.purchases[0].month).toBe(0);
    const short = simulateGrowth({ template: fourplex, plan: plan({ cashOnHand: a.cashNeeded - 1 }) });
    expect(short.purchases.length === 0 || short.purchases[0].month > 0).toBe(true);
  });

  it('never dips below the reserves it must hold', () => {
    const s = simulateGrowth({ owned: PRESET_OWNED, template: fourplex, plan: plan({ cashOnHand: 160000, monthlySavings: 4000 }) });
    expect(s.purchases.length).toBeGreaterThan(1);
    s.monthly.forEach((x) => expect(x.cash).toBeGreaterThanOrEqual(x.reserves - 1e-6));
  });

  it('counts existing doors and stops at the door target', () => {
    const s = simulateGrowth({ owned: PRESET_OWNED, template: fourplex, plan: plan({ cashOnHand: 5e6, targetDoors: 11 }) });
    expect(s.start.doors).toBe(3);
    // 3 owned + two fourplexes = 11; a third would overshoot.
    expect(s.end.doors).toBe(11);
    expect(s.purchases).toHaveLength(2);
  });

  it('adds reinvested cash flow to cash, or reports it as taken', () => {
    const base = { owned: PRESET_OWNED, plan: plan({ cashOnHand: 0 }) };
    const kept = simulateGrowth({ ...base, plan: { ...base.plan, reinvest: true } });
    const taken = simulateGrowth({ ...base, plan: { ...base.plan, reinvest: false } });
    expect(kept.end.cash).toBeCloseTo(taken.cashFlowTaken, 4);
    expect(taken.end.cash).toBe(0);
  });

  it('recycles refinance cash so a BRRRR deal buys sooner', () => {
    const brrrr = { ...PRESET_DEALS[0], price: 200000, downPct: 20, rehabCost: 40000, arv: 300000, rentPerUnit: 2400 };
    const p = plan({ cashOnHand: 120000, monthlySavings: 1500 });
    const hold = simulateGrowth({ template: brrrr, plan: p });
    const refi = simulateGrowth({ template: { ...brrrr, refiEnabled: true, refiYear: 1, refiLtv: 75, refiRate: 7.25, refiTermYears: 30, refiCostPct: 2 }, plan: p });
    expect(refi.purchases.length).toBeGreaterThan(hold.purchases.length);
  });
});
