import { describe, expect, it } from 'vitest';
import { homeWorth, netProceeds, normalizeSell, totalBeds } from './selling.js';

const L = (id, price, units, beds) => ({ id, price, units, beds, status: 'active' });
const feed = [L('a', 300000, 1, [3]), L('b', 340000, 1, ['3']), L('c', 360000, 1, ['2+1']), L('d', 420000, 1, [4]), L('e', 900000, 1, [6]), L('f', 500000, 2, [2, 2]), L('g', 250000, 1, [3], 'sold')];
feed[6].status = 'sold';

describe('homeWorth', () => {
  it('reads bedrooms, including basements like 2+1', () => {
    expect(totalBeds(L('x', 1, 1, ['2+1']))).toBe(3);
    expect(totalBeds(L('x', 1, 2, [2, 2]))).toBe(4);
    expect(totalBeds({})).toBeNull();
  });
  it('prices from similar homes for sale, within a bedroom', () => {
    const w = homeWorth({ units: 1, beds: 3, listings: feed });
    expect(w.byBeds).toBe(true);
    expect(w.count).toBe(4); // a, b, c, d; not the 6-bed, the duplex or the sold one
    expect(w.estimate).toBe(350000);
    expect(w.low).toBeLessThan(w.estimate);
    expect(w.high).toBeGreaterThan(w.estimate);
  });
  it('says nothing with fewer than three to compare', () => {
    expect(homeWorth({ units: 2, beds: 4, listings: feed })).toBeNull();
  });
});

describe('netProceeds', () => {
  it('takes off commission, HST on it, the mortgage and the costs', () => {
    const n = netProceeds({ price: 500000, province: 'ON', commissionPct: 5, mortgage: 300000, ratePct: 4, penalty: null, legal: 1500, moving: 2000 });
    expect(n.lines.find((l) => l.key === 'commission').amount).toBe(25000);
    expect(n.lines.find((l) => l.key === 'tax').amount).toBeCloseTo(3250);
    expect(n.lines.find((l) => l.key === 'penalty').amount).toBe(3000);
    expect(n.net).toBeCloseTo(500000 - 25000 - 3250 - 300000 - 3000 - 1500 - 2000);
    expect(n.penaltyEstimated).toBe(true);
  });
  it('charges no commission on a private sale, and GST outside HST provinces', () => {
    expect(netProceeds({ price: 400000, privateSale: true }).lines.find((l) => l.key === 'commission').amount).toBe(0);
    expect(netProceeds({ price: 400000, province: 'AB' }).lines.find((l) => l.key === 'tax').amount).toBeCloseTo(1000);
  });
});

describe('normalizeSell', () => {
  it('keeps what it should', () => {
    const s = normalizeSell({ units: 2, price: 450000, done: { worth: true, list: 'yes' }, city: 'thunder-bay' });
    expect(s).toMatchObject({ units: 2, price: 450000, done: { worth: true }, city: 'thunder-bay', penalty: null });
  });
});
