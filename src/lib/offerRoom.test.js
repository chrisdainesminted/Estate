import { describe, expect, it } from 'vitest';
import { cutsOf, marketSignals, offerRange, offerStrength, offerTimeline } from './offerRoom.js';
import { carryOffMarket } from './market.js';

const today = '2026-11-16';
const daysAgo = (n) => new Date(Date.parse(`${today}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
const home = (id, price, firstSeen, over = {}) => ({ id, address: `${id} Main St`, price, units: 1, beds: [3], status: 'active', firstSeen, priceHistory: [{ date: firstSeen, price }], ...over });
const others = Array.from({ length: 8 }, (_, i) => home(`o${i}`, 400000 + i * 5000, daysAgo(20)));

describe('offer guidance', () => {
  it('reads a stale, cut, overpriced listing as the buyer’s market', () => {
    const l = home('x', 470000, daysAgo(70), { priceHistory: [{ date: daysAgo(70), price: 510000 }, { date: daysAgo(20), price: 470000 }] });
    expect(cutsOf(l)).toMatchObject({ count: 1 });
    const m = marketSignals({ listing: l, listings: [l, ...others], today });
    expect(m.leverage).toBe(3);
    expect(m.signals.map((x) => x.key)).toEqual(['days', 'cuts', 'ask']);
    const r = offerRange(l, m);
    expect(r.basis).toBe('listing');
    expect(r.open).toBeLessThan(l.price * 0.95);
  });

  it('reads a new, well-priced listing as the seller’s, and the range goes up to asking or past it', () => {
    const l = home('y', 380000, daysAgo(3));
    const m = marketSignals({ listing: l, listings: [l, ...others], today });
    expect(m.leverage).toBeLessThan(0);
    expect(offerRange(l, m).high).toBeGreaterThanOrEqual(380000);
  });

  it('centres on sold prices when the buyer’s agent sends some', () => {
    const l = home('z', 450000, daysAgo(30));
    const m = marketSignals({ listing: l, listings: [l, ...others], sold: [{ price: 420000 }, { price: 430000 }, { price: 425000 }], today });
    const r = offerRange(l, m);
    expect(r.basis).toBe('sold');
    expect(r.open).toBe(Math.round((425000 * 0.98) / 1000) * 1000);
  });

  it('counts homes like it that left the market quickly as competition', () => {
    const l = home('q', 420000, daysAgo(10));
    const gone = [1, 2, 3].map((i) => ({ id: `g${i}`, units: 1, price: 410000 + i * 1000, days: 9 }));
    const m = marketSignals({ listing: l, listings: [l, ...others], offMarket: gone, today });
    expect(m.signals.find((x) => x.key === 'gone').tone).toBe('seller');
  });

  it('scores a firmer, higher, bigger-deposit offer as stronger', () => {
    const range = { low: 380000, open: 390000, high: 400000 };
    const m = { leverage: 0 };
    const weak = offerStrength(375000, range, m, { financing: true, inspection: true, depositPct: 1 });
    const strong = offerStrength(400000, range, m, { financing: false, inspection: false, depositPct: 5, flexible: true });
    expect(weak.key).toBe('long');
    expect(strong.key).toBe('strong');
    expect(strong.reasons.length).toBeGreaterThan(2);
  });

  it('lays out the dates that follow, conditions included only when chosen', () => {
    const t = offerTimeline(today, { financing: true, inspection: false, closingDays: 45 });
    expect(t.map((x) => x.key)).toEqual(['offer', 'deposit', 'financing', 'insurance', 'lawyer', 'closing']);
    expect(t.at(-1).date).toBe('2027-01-01'); // 45 days after acceptance (the next day)
  });
});

describe('homes that came off the market', () => {
  it('keeps each listing that disappeared, with its last price and days listed, and the conditional ones', () => {
    const prev = { listings: [home('a', 300000, '2026-10-01', { lastSeen: '2026-11-15', priceHistory: [{ date: '2026-10-01', price: 320000 }, { date: '2026-10-20', price: 300000 }] }), home('b', 400000, '2026-11-01')] };
    const next = { listings: [home('b', 400000, '2026-11-01'), home('c', 350000, '2026-11-10', { status: 'conditional' })] };
    const out = carryOffMarket(prev, next, today);
    const a = out.offMarket.find((r) => r.id === 'a');
    expect(a).toMatchObject({ price: 300000, firstPrice: 320000, cuts: 1, days: 45, status: 'left' });
    expect(out.offMarket.find((r) => r.id === 'c').status).toBe('conditional');
    expect(out.offMarket.find((r) => r.id === 'b')).toBeUndefined();
    // Carried forward the next day, and dropped after a year.
    expect(carryOffMarket(out, { listings: next.listings }, '2026-11-17').offMarket.some((r) => r.id === 'a')).toBe(true);
    expect(carryOffMarket(out, { listings: [] }, '2027-12-01').offMarket.some((r) => r.id === 'a')).toBe(false);
  });
});
