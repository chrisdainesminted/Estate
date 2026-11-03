import { describe, expect, it } from 'vitest';
import { afterRepairValue, brrrrFor, distanceKm, isCondo, needsWork, normalizeBrrrr, rankBrrrr } from './brrrr.js';
import { DEFAULT_MARKET, localMarket } from './market.js';

const L = (id, price, extra = {}) => ({ id, address: `${id.charCodeAt(0)} Main Street`, url: `https://www.realtor.ca/real-estate/${price}/${id.charCodeAt(0)}-main-street-thunder-bay`, price, units: 1, beds: [3], taxes: 3000, status: 'active', ...extra });
const street = [L('a', 140000, { highlights: 'Handyman special, sold as is' }), L('b', 290000), L('c', 300000), L('d', 310000), L('e', 320000), L('f', 600000, { beds: [6] })];
const market = localMarket(DEFAULT_MARKET, 'thunder-bay');

describe('value once fixed up', () => {
  it('is the middle price of similar homes, not counting the home itself', () => {
    const v = afterRepairValue(street[0], street);
    expect(v.value).toBe(305000); // b, c, d, e: within a bedroom; not the 6-bedroom
    expect(v.count).toBe(4);
    expect(v.byBeds).toBe(true);
  });
  it('compares with similar homes nearby when it knows where they are', () => {
    // a, b, c, d sit within a few hundred metres; e is across town.
    const points = { a: [48.38, -89.25], b: [48.381, -89.251], c: [48.382, -89.249], d: [48.379, -89.252], e: [48.45, -89.2] };
    const v = afterRepairValue(street[0], street, points);
    expect(v.radiusKm).toBe(1);
    expect(v.count).toBe(3);
    expect(v.value).toBe(300000); // b, c, d; not e
    expect(afterRepairValue(street[0], street).radiusKm).toBeNull();
    expect(distanceKm([48.38, -89.25], [48.45, -89.2])).toBeGreaterThan(8);
  });
  it('compares a condo unit only with condos', () => {
    expect(isCondo({ address: '303-235 Leland Avenue S' })).toBe(true);
    expect(isCondo({ address: '235 Leland Avenue S' })).toBe(false);
    expect(afterRepairValue({ id: 'z', address: '5-10 King St', price: 150000, units: 1, beds: [2] }, street)).toBeNull();
  });
  it('spots a listing that says it needs work', () => {
    expect(needsWork(street[0])).toBe(true);
    expect(needsWork(street[1])).toBe(false);
  });
});

describe('the BRRRR plan', () => {
  it('works out cash in, the refinance and the value added', () => {
    const r = brrrrFor(street[0], street, market, { rehab: 30000 }, 'thunder-bay');
    expect(r.rehab).toBe(30000);
    expect(r.loan).toBe(112000); // 80% of $140,000
    expect(r.newLoan).toBe(244000); // 80% of $305,000
    expect(r.cashBack).toBeCloseTo(244000 - 112000 - 244000 * 0.015);
    expect(r.cashLeft).toBeCloseTo(r.cashIn - r.cashBack);
    expect(r.created).toBeCloseTo(305000 - r.allIn);
    expect(r.created).toBeGreaterThan(100000);
    expect(r.fixer).toBe(true);
  });
  it('uses your own rehab estimate for a listing', () => {
    expect(brrrrFor(street[0], street, market, { rehabs: { a: 80000 } }, 'thunder-bay').rehab).toBe(80000);
  });
  it('leaves the rent after refinancing unknown without a tax bill', () => {
    const r = brrrrFor({ ...street[0], taxes: null }, street, market, {}, 'thunder-bay');
    expect(r.cashFlow).toBeNull();
    expect(r.grade).toBe('unknownRent');
  });
  it('ranks the cheap one first, and the overpriced one last', () => {
    const { ranked } = rankBrrrr(street, market, {}, 'thunder-bay');
    expect(ranked[0].listing.id).toBe('a');
    expect(ranked.at(-1).created).toBeLessThan(0);
  });
  it('keeps settings sane', () => {
    expect(normalizeBrrrr({ refiPct: 95, downPct: 1, rehabs: { a: 5, 'bad id!': 3 } })).toMatchObject({ refiPct: 80, downPct: 5, rehabs: { a: 5 } });
  });
});
