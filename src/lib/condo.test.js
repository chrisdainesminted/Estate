import { describe, expect, it } from 'vitest';
import { feesLabel, isCondo, isCondoDeal } from './condo.js';

describe('isCondo', () => {
  it('knows a unit in a building', () => {
    expect(isCondo({ address: '303-235 Leland Avenue' })).toBe(true);
    expect(isCondo({ address: '12 Elm St', highlights: 'Bright condo with parking' })).toBe(true);
  });
  it('never calls a multi-unit building a condo', () => {
    expect(isCondo({ address: '100 Main St', units: 6, highlights: '6 apartment units, all rented' })).toBe(false);
    expect(isCondo({ address: '100 Main St', beds: [2, 2, 1], highlights: 'condo-quality finishes' })).toBe(false);
    expect(isCondo({ address: '100 Main St', highlights: 'Apartment building, fully rented' })).toBe(false);
  });
  it('leaves houses alone', () => {
    expect(isCondo({ address: '45 Oak Cres', highlights: 'Detached bungalow' })).toBe(false);
  });
});

describe('feesLabel', () => {
  it('says condo fees only for a condo', () => {
    expect(feesLabel({ country: 'ca', units: 6, condo: true })).toBe('Utilities you pay');
    expect(feesLabel({ country: 'ca', units: 1, condo: true })).toBe('Condo fees & utilities');
    expect(isCondoDeal({ units: 2, condo: true })).toBe(false);
  });
});
