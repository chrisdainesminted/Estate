import { describe, expect, it } from 'vitest';
import { propertyRisks } from './risks.js';

const keys = (x) => propertyRisks(x).map((r) => r.key);

describe('propertyRisks', () => {
  it('asks whether a duplex’s units are legal', () => {
    expect(keys({ units: 2 })).toEqual(['legal']);
    expect(keys({ units: 1 })).toEqual([]);
  });
  it('flags existing tenants, with Ontario’s rules in Ontario', () => {
    expect(keys({ units: 3, rentStated: true })).toContain('tenants');
    expect(keys({ units: 2, text: 'Both units tenanted, month-to-month' })).toContain('tenants');
    expect(propertyRisks({ units: 2, rentStated: true, province: 'ON' }).find((r) => r.key === 'tenants').text).toContain('N12');
    expect(propertyRisks({ units: 2, rentStated: true, province: 'AB' }).find((r) => r.key === 'tenants').text).not.toContain('N12');
  });
  it('flags an older home’s wiring, or asbestos before 1990', () => {
    expect(keys({ yearBuilt: 1925 })).toEqual(['old']);
    expect(keys({ yearBuilt: 1975 })).toEqual(['asbestos']);
    expect(keys({ yearBuilt: 2005 })).toEqual([]);
  });
  it('asks a condo for its fees', () => {
    expect(keys({ condo: true })).toEqual(['condo']);
  });
});
