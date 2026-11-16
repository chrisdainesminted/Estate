import { describe, expect, it } from 'vitest';
import { offerPackData, similarHomes } from './offerPack.js';
import { DEFAULT_MARKET, localMarket, scoreListing } from './market.js';

const listing = (id, over = {}) => ({ id, address: `${id} Main St`, price: 400000, units: 2, beds: [2, 2], rents: [null, null], grossRent: null, taxes: 3600, status: 'active', url: `https://example.com/${id}`, priceHistory: [{ date: '2026-11-01', price: 420000 }, { date: '2026-11-10', price: 400000 }], ...over });
const market = localMarket(DEFAULT_MARKET, 'thunder-bay');
const feed = [listing('a'), listing('b', { price: 390000 }), listing('c', { price: 600000 }), listing('d', { units: 1, beds: [3], rents: [null] }), listing('e', { status: 'removed' })];

describe('Offer Pack', () => {
  it('compares a home with others of its kind still listed, nearest in price first', () => {
    expect(similarHomes(feed[0], feed).map((l) => l.id)).toEqual(['b', 'c']);
  });
  it('works the cash and the month out at the offer being run', () => {
    const s = scoreListing(feed[0], market);
    const p = offerPackData({ s, at: { price: 380000 }, listings: feed, province: 'ON' });
    expect(p.offerPrice).toBe(380000);
    expect(p.cash.down).toBeCloseTo(380000 * (Number(s.deal.downPct) / 100));
    expect(p.cash.total).toBeGreaterThan(p.cash.down + p.cash.transferTax);
    expect(p.monthly.left).not.toBeNull();
    expect(p.history).toHaveLength(2);
    expect(p.questions.map((q) => q.key)).toContain('legal');
  });
  it('never fills in a tax bill the listing doesn’t give', () => {
    const s = scoreListing(listing('x', { taxes: null }), market);
    const p = offerPackData({ s, listings: feed });
    expect(p.monthly.taxes).toBeNull();
    expect(p.monthly.left).toBeNull();
  });
});
