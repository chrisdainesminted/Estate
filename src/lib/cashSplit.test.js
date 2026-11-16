import { describe, expect, it } from 'vitest';
import { bestOption, candidates, cashOptions } from './cashSplit.js';
import { DEFAULT_MARKET, localMarket } from './market.js';

const market = localMarket(DEFAULT_MARKET, 'thunder-bay');
const home = (id, price, over = {}) => ({ id, address: `${id} Main St`, price, units: 2, beds: [2, 2], rents: [null, null], grossRent: null, taxes: price / 120, status: 'active', url: `https://example.com/${id}`, priceHistory: [], ...over });
const listings = [home('a', 200000), home('b', 210000), home('c', 220000), home('d', 600000), home('e', 205000, { taxes: null }), home('f', 215000, { status: 'removed' })];

describe('your cash, compared', () => {
  it('only counts homes with a real tax bill that pay for themselves, within the cash', () => {
    const ids = candidates(listings, market, 100000).map((h) => h.s.listing.id);
    expect(ids).not.toContain('e'); // no tax bill
    expect(ids).not.toContain('f'); // no longer listed
    expect(ids).not.toContain('d'); // needs more cash than there is
    for (const h of candidates(listings, market, 100000)) expect(h.monthly).toBeGreaterThanOrEqual(0);
  });

  it('finds the best one, two and three homes the cash covers, each within it', () => {
    const opts = cashOptions({ listings, market, cash: 160000 });
    expect(opts.map((o) => o.count)).toEqual([1, 2, 3]);
    for (const o of opts) {
      expect(o.cashIn).toBeLessThanOrEqual(160000);
      expect(new Set(o.homes.map((s) => s.listing.id)).size).toBe(o.count);
      expect(o.total).toBeCloseTo(o.monthly * 12 + o.principal);
    }
    expect(opts[2].total).toBeGreaterThan(opts[0].total);
    expect(bestOption(opts).count).toBe(3);
  });

  it('stops where the cash runs out', () => {
    expect(cashOptions({ listings, market, cash: 50000 }).map((o) => o.count)).toEqual([1]);
    expect(cashOptions({ listings, market, cash: 0 })).toEqual([]);
  });

  it('can count the cash left over at a savings rate, and keeping it all there', () => {
    const opts = cashOptions({ listings, market, cash: 100000, savingsPct: 3 });
    expect(opts[0]).toMatchObject({ count: 0, total: 3000 });
    expect(opts[1].interest).toBeCloseTo(opts[1].left * 0.03);
  });
});
