import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  benefits,
  buyCheck,
  closingCash,
  homeFor,
  liveIn,
  maxPrice,
  minDownPayment,
  monthsToSave,
  mortgagePlan,
  normalizeProfile,
  premiumRate,
  qualify,
  qualifyingRate,
} from './firstHome.js';

describe('down payment and insurance', () => {
  it('asks 5% of the first $500,000 and 10% of the rest', () => {
    expect(minDownPayment(400000)).toBe(20000);
    expect(minDownPayment(600000)).toBe(35000);
    expect(minDownPayment(1500000)).toBe(300000);
  });

  it('asks at least 10% on a three or four unit home', () => {
    expect(minDownPayment(450000, 3)).toBe(45000);
    expect(minDownPayment(450000, 2)).toBe(22500);
  });

  it('prices insurance by how much is borrowed, more over 25 years', () => {
    expect(premiumRate(0.8, 30)).toBe(0);
    expect(premiumRate(0.9, 25)).toBeCloseTo(0.031, 10);
    expect(premiumRate(0.95, 30)).toBeCloseTo(0.042, 10);
    expect(premiumRate(0.96, 25)).toBeNaN();
  });

  it('adds the premium to the loan and charges PST on it at closing', () => {
    const plan = mortgagePlan({ price: 400000, down: 20000, ratePct: 4.5, firstTime: true });
    expect(plan.insured).toBe(true);
    expect(plan.amortYears).toBe(30);
    expect(plan.premium).toBeCloseTo(380000 * 0.042, 6);
    expect(plan.loan).toBeCloseTo(380000 * 1.042, 6);
    expect(plan.premiumPst).toBeCloseTo(380000 * 0.042 * 0.08, 6);
    expect(mortgagePlan({ price: 400000, down: 20000, ratePct: 4.5, firstTime: false }).amortYears).toBe(25);
    expect(mortgagePlan({ price: 400000, down: 80000, ratePct: 4.5 }).premium).toBe(0);
  });
});

describe('qualifying', () => {
  it('stress tests at the higher of the rate plus 2 or 5.25%', () => {
    expect(qualifyingRate(4.9)).toBeCloseTo(6.9, 10);
    expect(qualifyingRate(3)).toBe(5.25);
  });

  it('counts all of a second unit’s rent and half on three or four units', () => {
    const plan = { ...mortgagePlan({ price: 400000, down: 20000, ratePct: 4.5 }), ratePct: 4.5 };
    const profile = normalizeProfile({ income: 60000 });
    expect(qualify({ profile, plan, units: 2, rentFromOthers: 1500 }).rentCounted).toBe(1500);
    expect(qualify({ profile, plan, units: 3, rentFromOthers: 3000 }).rentCounted).toBe(1500);
    const alone = qualify({ profile, plan, units: 1 });
    const hacked = qualify({ profile, plan, units: 2, rentFromOthers: 1500 });
    expect(hacked.gds).toBeLessThan(alone.gds);
  });

  it('takes the first-time buyer land transfer refund off closing costs', () => {
    const c = closingCash({ price: 400000, firstTime: true });
    expect(c.ltt).toBe(4475);
    expect(c.refund).toBe(4000);
    expect(c.total).toBeCloseTo(475 + 6000, 6);
    expect(closingCash({ price: 400000, firstTime: false }).refund).toBe(0);
  });

  it('says whether you can buy, and how much cash is short', () => {
    const rich = buyCheck({ profile: { income: 150000, savings: 100000, debts: 0 }, price: 350000, ratePct: 4.5, taxesMonthly: 400 });
    expect(rich.canBuy).toBe(true);
    const short = buyCheck({ profile: { income: 150000, savings: 5000 }, price: 350000, ratePct: 4.5, taxesMonthly: 400 });
    expect(short.canBuy).toBe(false);
    expect(short.shortCash).toBeGreaterThan(0);
  });

  it('lets a house hack buy more than a single home on the same income', () => {
    const profile = { income: 65000, savings: 60000, debts: 300 };
    const single = maxPrice({ profile, units: 1, ratePct: 4.5 });
    const duplex = maxPrice({ profile, units: 2, ratePct: 4.5, rentPerOtherUnit: 1500 });
    expect(duplex.byIncome).toBeGreaterThan(single.byIncome + 60000);
    expect(['income', 'savings']).toContain(duplex.limit);
  });
});

describe('living in it', () => {
  it('nets the tenants’ rent against the full cost of the home', () => {
    const deal = { units: 2, rentPerUnit: 1500, taxesAnnual: 4800, insuranceAnnual: 2400, hoaMonthly: 150, maintPct: 5, capexPct: 5, vacancyPct: 4 };
    const l = liveIn({ deal, payment: 2000 });
    expect(l.rentIn).toBe(1500);
    expect(l.setAside).toBeCloseTo(300 + 60, 6);
    expect(l.outgoing).toBeCloseTo(2000 + 400 + 200 + 150 + 360, 6);
    expect(l.costToLive).toBeCloseTo(l.outgoing - 1500, 6);
  });
});

describe('money you can get', () => {
  it('adds up the cash for a first-time buyer, and the GST rebate on a new home', () => {
    const resale = benefits({ profile: { ...DEFAULT_PROFILE, monthlySave: 800 }, price: 400000 });
    expect(resale.list.map((b) => b.key)).toEqual(['fhsa', 'ltt', 'hbtc', 'hbp']);
    expect(resale.total).toBe(Math.round(8000 * 0.2965) + 4000 + 1500);
    const fresh = benefits({ profile: { ...DEFAULT_PROFILE, newBuild: true }, price: 600000 });
    expect(fresh.list.find((b) => b.key === 'gst').amount).toBe(30000);
    expect(benefits({ profile: { ...DEFAULT_PROFILE, newBuild: true }, price: 1250000 }).list.find((b) => b.key === 'gst').amount).toBe(25000);
    expect(benefits({ profile: { firstTime: false }, price: 400000 }).total).toBe(0);
  });

  it('counts the months to save, faster with more each month', () => {
    expect(monthsToSave({ profile: { savings: 50000 }, target: 40000 })).toBe(0);
    const slow = monthsToSave({ profile: { savings: 0, monthlySave: 500 }, target: 30000 });
    const fast = monthsToSave({ profile: { savings: 0, monthlySave: 1000 }, target: 30000 });
    expect(fast).toBeLessThan(slow);
    expect(slow).toBeLessThan(60); // FHSA refunds bring it in under 60 months of $500
  });
});

describe('homeFor', () => {
  it('works out living in a listing, and skips 5+ unit buildings', () => {
    const deal = { units: 2, price: 350000, rentPerUnit: 1500, taxesAnnual: 4000, insuranceAnnual: 1800, hoaMonthly: 200, maintPct: 5, capexPct: 5, vacancyPct: 4 };
    const h = homeFor(deal, { income: 70000, savings: 40000, debts: 0 }, 4.5);
    expect(h.down).toBe(17500);
    expect(h.costToLive).toBeLessThan(1500);
    expect(typeof h.canBuy).toBe('boolean');
    expect(homeFor({ ...deal, units: 6 }, {}, 4.5)).toBeNull();
  });
});
