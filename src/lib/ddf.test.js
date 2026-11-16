import { describe, expect, it } from 'vitest';
import { combineFeeds, ddfAddress, ddfCityFilter, ddfListing, ddfPhotos, ddfToRaw, ddfUnits } from './ddf.js';
import { listingPageUrl } from './market.js';

const prop = (over = {}) => ({
  ListingKey: '27012345',
  ListingId: 'TB250123',
  ListPrice: 389900,
  UnparsedAddress: '123 Algoma Street N, Thunder Bay, Ontario P7A 4Z8',
  City: 'Thunder Bay',
  StateOrProvince: 'Ontario',
  PropertySubType: 'Single Family',
  BedroomsTotal: 3,
  TaxAnnualAmount: 3950,
  YearBuilt: 1952,
  PublicRemarks: 'Solid brick bungalow close to the hospital.',
  StandardStatus: 'Active',
  Latitude: 48.43,
  Longitude: -89.23,
  ListOfficeName: 'Example Realty Ltd., Brokerage',
  Media: [
    { MediaURL: 'https://cdn.realtor.ca/listing/2.jpg', Order: 2, MediaCategory: 'Property Photo' },
    { MediaURL: 'https://cdn.realtor.ca/listing/1.jpg', Order: 1, MediaCategory: 'Property Photo' },
    { MediaURL: 'http://insecure.example/3.jpg', Order: 3 },
  ],
  ...over,
});

describe('DDF properties as listings', () => {
  it('reads the street address without the city', () => {
    expect(ddfAddress(prop())).toBe('123 Algoma Street N');
    expect(ddfAddress(prop({ UnparsedAddress: '', StreetNumber: '45', StreetName: 'Court', StreetSuffix: 'St', UnitNumber: '302' }))).toBe('302-45 Court St');
  });

  it('counts units from the stated total or the kind of building', () => {
    expect(ddfUnits(prop())).toBe(1);
    expect(ddfUnits(prop({ PropertySubType: 'Triplex' }))).toBe(3);
    expect(ddfUnits(prop({ NumberOfUnitsTotal: 6, PropertySubType: 'Multi-family' }))).toBe(6);
    expect(ddfUnits(prop({ PropertySubType: 'Vacant Land' }))).toBeNull();
  });

  it('keeps https photos in their listed order', () => {
    expect(ddfPhotos(prop())).toEqual(['https://cdn.realtor.ca/listing/1.jpg', 'https://cdn.realtor.ca/listing/2.jpg']);
  });

  it('becomes a normal listing with a REALTOR.ca page, photos and the brokerage', () => {
    const l = ddfListing(prop());
    expect(l).toMatchObject({ id: 'TB250123', mls: 'TB250123', address: '123 Algoma Street N', price: 389900, units: 1, taxes: 3950, yearBuilt: 1952, ddf: true, brokerage: 'Example Realty Ltd., Brokerage', lat: 48.43, status: 'active' });
    expect(l.photos).toHaveLength(2);
    expect(listingPageUrl(l.url, l.address)).toBe(l.url);
    expect(l.url).toBe('https://www.realtor.ca/real-estate/27012345/123-algoma-street-n-thunder-bay');
  });

  it('marks pending sales conditional and reads distress from the remarks', () => {
    const raw = ddfToRaw(prop({ StandardStatus: 'Pending', PublicRemarks: 'Power of sale. Sold as is.' }));
    expect(raw.status).toBe('conditional');
    expect(raw.distress).toBe('power-of-sale');
  });

  it('filters one city by name and province', () => {
    expect(ddfCityFilter('thunder-bay')).toBe("City eq 'Thunder Bay' and StateOrProvince eq 'Ontario'");
    expect(ddfCityFilter('st-johns')).toContain("St. John''s");
  });
});

describe('combineFeeds', () => {
  const search = {
    schema: 1,
    lastRun: { date: '2026-11-15' },
    listings: [
      { id: 'addr-123-algoma-st-n', address: '123 Algoma St N', price: 399900, firstSeen: '2026-11-01', priceHistory: [{ date: '2026-11-01', price: 399900 }], rents: [1800], taxes: 3900 },
      { id: 'X1', mls: 'X1', address: '9 Other Ave', price: 250000, firstSeen: '2026-11-10' },
    ],
  };
  const ddf = { updatedAt: 5, listings: [{ ...ddfListing(prop()), firstSeen: '2026-11-16', lastSeen: '2026-11-16', priceHistory: [{ date: '2026-11-16', price: 389900 }] }] };

  it('shows a home both found once, as the MLS® listing, keeping the earlier history', () => {
    const out = combineFeeds(search, ddf);
    expect(out.listings).toHaveLength(2);
    const home = out.listings.find((l) => l.ddf);
    expect(home.firstSeen).toBe('2026-11-01');
    expect(home.priceHistory.map((h) => h.price)).toEqual([399900, 389900]);
    expect(home.taxes).toBe(3950);
    expect(home.rents).toEqual([1800]);
    expect(out.lastRun).toEqual(search.lastRun);
    expect(out.ddf).toEqual({ at: 5, count: 1 });
  });

  it('leaves the search alone without DDF listings, and stands alone without a search', () => {
    expect(combineFeeds(search, null)).toBe(search);
    expect(combineFeeds(null, ddf).listings).toHaveLength(1);
  });
});
