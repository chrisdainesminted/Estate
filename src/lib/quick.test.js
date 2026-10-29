import { describe, expect, it } from 'vitest';
import { analyzeDeal } from './finance.js';
import { DEFAULT_MARKET } from './market.js';
import { makeDeal } from './presets.js';
import { quickDeal, shortPrice } from './quick.js';

describe('shortPrice', () => {
  it('names a price in thousands or millions', () => {
    expect(shortPrice(250000)).toBe('$250k');
    expect(shortPrice(1200000)).toBe('$1.2M');
    expect(shortPrice(2000000)).toBe('$2M');
    expect(shortPrice(15000000)).toBe('$15M');
  });
});

describe('quickDeal', () => {
  it('scales US taxes and insurance to the price', () => {
    const d = quickDeal({ price: 400000, rentPerUnit: 2600, unitType: 'sfh', country: 'us' });
    expect(d).toMatchObject({ name: '$400k Single Family', country: 'us', price: 400000, units: 1, rentPerUnit: 2600, taxesAnnual: 4800, insuranceAnnual: 2400 });
    expect(d.estimated).toBe(true);
    // Everything else comes from the default deal.
    const a = analyzeDeal(makeDeal(d));
    expect(a.grossRent).toBe(2600);
    expect(Number.isFinite(a.netCashFlow)).toBe(true);
  });

  it('takes the unit count from the type, and asks for it only for 5+ units', () => {
    expect(quickDeal({ price: 500000, rentPerUnit: 1500, unitType: 'duplex', units: 9 })).toMatchObject({ name: '$500k Duplex', units: 2 });
    expect(quickDeal({ price: 1200000, rentPerUnit: 1400, unitType: 'multiplex', units: 8 })).toMatchObject({ name: '$1.2M 8-unit', units: 8 });
    expect(quickDeal({ price: 900000, rentPerUnit: 1400, unitType: 'multiplex', units: 2 }).units).toBe(5);
  });

  it('follows the listing assumptions for Canadian deals', () => {
    const m = DEFAULT_MARKET;
    const d = quickDeal({ price: 450000, rentPerUnit: 1600, unitType: 'triplex', country: 'ca' }, m);
    expect(d).toMatchObject({
      country: 'ca',
      units: 3,
      downPct: 20,
      rate: m.rate,
      termYears: m.amortYears,
      closingPct: m.closingPct,
      taxesAnnual: Math.round((450000 * m.taxPct) / 100 / 100) * 100,
      insuranceAnnual: Math.max(m.insurancePerUnit * 3, 1500),
      hoaMonthly: m.utilitiesPerUnit * 3,
      capexPct: m.capexPct,
    });
    // A single-family home pays no owner utilities and at least the minimum insurance.
    expect(quickDeal({ price: 200000, rentPerUnit: 1800, unitType: 'sfh', country: 'ca' }, m)).toMatchObject({ hoaMonthly: 0, insuranceAnnual: 1500 });
  });
});
