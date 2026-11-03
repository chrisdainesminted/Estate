import { describe, expect, it } from 'vitest';
import { cityInAddress, moveToCity, placeLabel } from './place.js';
import { DEFAULT_MARKET, localMarket } from './market.js';
import { DEFAULT_DEAL } from './presets.js';

describe('cityInAddress', () => {
  it('finds the city an address names', () => {
    expect(cityInAddress('230 Brodie Street N, Thunder Bay, ON')).toBe('thunder-bay');
    expect(cityInAddress('12 Main St, Montréal QC')).toBe('montreal');
    expect(cityInAddress('5 Water St, St. John’s, NL')).toBe('st-johns');
    expect(cityInAddress('5 King St, Saint John, NB')).toBe('saint-john');
    expect(cityInAddress('1 University Ave, Waterloo')).toBe('kitchener');
  });
  it('ignores a street named for a city', () => {
    expect(cityInAddress('100 Victoria Ave E, Thunder Bay')).toBe('thunder-bay');
    expect(cityInAddress('100 Victoria Ave E')).toBe('victoria');
    expect(cityInAddress('100 Main St, Nowhere')).toBeNull();
    expect(cityInAddress('')).toBeNull();
  });
});

describe('moveToCity', () => {
  const deal = { ...DEFAULT_DEAL, country: 'ca', city: 'hamilton', price: 400000 };
  it('moves the estimated tax and a market rent to the new city', () => {
    const hamiltonRent = localMarket(DEFAULT_MARKET, 'hamilton').rents[2];
    // Hamilton's typical tax is 1% of the price; Toronto's 0.6%.
    const { patch, changed } = moveToCity({ ...deal, taxesAnnual: 4000, rentPerUnit: hamiltonRent }, 'toronto', DEFAULT_MARKET);
    expect(patch.city).toBe('toronto');
    expect(patch.taxesAnnual).toBe(2400);
    expect(patch.rentPerUnit).toBe(localMarket(DEFAULT_MARKET, 'toronto').rents[2]);
    expect(changed).toEqual(['property tax estimate', 'market rent']);
  });
  it('keeps numbers you typed', () => {
    const { patch, changed } = moveToCity({ ...deal, taxesAnnual: 3912, rentPerUnit: 1850 }, 'toronto', DEFAULT_MARKET);
    expect(patch).toEqual({ city: 'toronto' });
    expect(changed).toEqual([]);
  });
  it('replaces the starting tax figure', () => {
    expect(moveToCity({ ...deal, taxesAnnual: DEFAULT_DEAL.taxesAnnual }, 'toronto', DEFAULT_MARKET).patch.taxesAnnual).toBe(2400);
  });
});

describe('placeLabel', () => {
  it('names the city and province', () => {
    expect(placeLabel({ city: 'thunder-bay' })).toBe('Thunder Bay, ON');
    expect(placeLabel({ city: 'on-other' })).toBe('Elsewhere in Ontario');
  });
});
