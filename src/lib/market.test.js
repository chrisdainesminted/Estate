import { describe, expect, it } from 'vitest';
import { analyzeDeal, maxOffer } from './finance.js';
import {
  DEFAULT_MARKET,
  INSURANCE_MIN,
  addressKey,
  cleanListing,
  listingPageUrl,
  listingRent,
  listingToDeal,
  mergeFeed,
  normalizeMarket,
  rankListings,
  scoreListing,
  siteName,
  standouts,
} from './market.js';

const triplex = {
  mls: 'X13684758',
  address: '228 Archibald Street S, Thunder Bay',
  url: 'property.ca/addresses/228-archibald-street-south-thunder-bay',
  units: 3,
  beds: [2, 2, 2],
  rents: [1900, null, 1950],
  price: 529900,
  taxes: 3675,
};

describe('cleanListing', () => {
  it('keeps the facts and keys a listing by its MLS number', () => {
    const l = cleanListing(triplex);
    expect(l.id).toBe('X13684758');
    expect(l.url).toBe('https://property.ca/addresses/228-archibald-street-south-thunder-bay');
    expect(l.rents).toEqual([1900, null, 1950]);
    expect(l.status).toBe('active');
  });

  it('falls back to the address when there is no MLS number', () => {
    expect(cleanListing({ address: '65 Kenogami Ave. N.', price: 329900, units: 2 }).id).toBe('addr-65-kenogami-ave-n');
  });

  it('rejects listings without an address or a real price, and unsafe links', () => {
    expect(cleanListing({ address: '', price: 300000 })).toBeNull();
    expect(cleanListing({ address: '1 Main St', price: 'call' })).toBeNull();
    expect(cleanListing({ address: '1 Main St', price: 300000, url: 'javascript:alert(1)' }).url).toBeNull();
  });

  it('keeps a link only when it is that property’s own page', () => {
    expect(cleanListing({ address: '334 Pearl Street', price: 489900, url: 'https://www.rew.ca/properties/areas/thunder-bay-on/type/multifamily' }).url).toBeNull();
  });

  it('reads a single bedroom count as every unit having that many', () => {
    expect(cleanListing({ address: '1 Main St', price: 300000, units: 3, beds: 2 }).beds).toEqual([2, 2, 2]);
  });

  it('keeps bachelor units (0 bedrooms)', () => {
    expect(cleanListing({ address: '1 Main St', price: 300000, units: 2, beds: [0, 1] }).beds).toEqual([0, 1]);
  });
});

describe('listingPageUrl', () => {
  it('accepts pages that name the property', () => {
    for (const [url, address] of [
      ['https://www.rew.ca/properties/334-pearl-street-thunder-bay-on', '334 Pearl Street'],
      ['https://www.realtor.ca/real-estate/29965121/129-mckellar-st-n-thunder-bay', '129 McKellar Street N'],
      ['https://ontario.onepercentrealty.com/properties/1551518178/THUNDER_BAY-65_Kenogami_Ave._N.', '65 Kenogami Avenue N'],
      ['https://www.squareyards.ca/sale/on/thunder-bay/westfort/234-amelia-st-street-e', '234 Amelia Street E'],
      ['https://coldwellbanker.ca/listing/ON/Thunder-Bay/2219-Arthur-St-E-P7E-5P3/232504325', '2219 Arthur Street E'],
      ['https://www.rew.ca/properties/302-165-court-street-n-thunder-bay-on', '302-165 Court Street N'],
    ]) {
      expect(listingPageUrl(url, address)).toBe(url);
    }
  });

  it('turns away search pages, area pages and other properties', () => {
    expect(listingPageUrl('https://www.rew.ca/properties/areas/thunder-bay-on/type/multifamily', '334 Pearl Street')).toBeNull();
    expect(listingPageUrl('https://www.redfin.ca/on/thunder-bay/vickers-park', '440 Archibald Street S')).toBeNull();
    expect(listingPageUrl('https://www.keyhomes.ca/property/ontario/thunder-bay/29812012', '397 Empire Avenue')).toBeNull();
    expect(listingPageUrl('https://www.rew.ca/properties/345-ray-boulevard-thunder-bay-on', '325 Ray Boulevard')).toBeNull();
    expect(listingPageUrl('https://www.rew.ca/properties/1334-pearl-street-thunder-bay-on', '334 Pearl Street')).toBeNull();
    expect(listingPageUrl(null, '334 Pearl Street')).toBeNull();
  });
});

describe('siteName', () => {
  it('names the site a link goes to', () => {
    expect(siteName('https://www.rew.ca/properties/334-pearl-street-thunder-bay-on')).toBe('REW');
    expect(siteName('https://ontario.onepercentrealty.com/properties/1/THUNDER_BAY-65_Kenogami')).toBe('OnePercent');
    expect(siteName('https://listings.example.com/1-main-st')).toBe('listings.example.com');
  });
});

describe('addressKey', () => {
  it('matches the same street written different ways', () => {
    expect(addressKey('228 Archibald Street South, Thunder Bay, ON')).toBe(addressKey('228 ARCHIBALD ST S'));
    expect(addressKey('65 Kenogami Ave. N.')).toBe('65 kenogami ave n');
  });
});

describe('listingRent', () => {
  it('uses stated rents and fills the gaps from the rent table', () => {
    const r = listingRent(cleanListing(triplex), DEFAULT_MARKET);
    expect(r.total).toBe(1900 + DEFAULT_MARKET.rents[2] + 1950);
    expect(r.source).toBe('mixed');
  });

  it('prefers a stated total and assumes 3 bedrooms for a house, 2 per unit otherwise', () => {
    expect(listingRent({ units: 6, grossRent: 7800 }, DEFAULT_MARKET)).toEqual({ total: 7800, source: 'stated' });
    expect(listingRent({ units: 1 }, DEFAULT_MARKET).total).toBe(DEFAULT_MARKET.rents[3]);
    expect(listingRent({ units: 2 }, DEFAULT_MARKET)).toEqual({ total: 2 * DEFAULT_MARKET.rents[2], source: 'estimated' });
    expect(listingRent({ units: 6 }, DEFAULT_MARKET).total).toBe(6 * DEFAULT_MARKET.rents[1]);
    expect(listingRent({ units: 1, beds: [6] }, DEFAULT_MARKET).total).toBe(DEFAULT_MARKET.rents[4]);
  });
});

describe('listingToDeal', () => {
  it('underwrites a listing under Ontario rules with the listing assumptions', () => {
    const d = listingToDeal(cleanListing(triplex), { ...DEFAULT_MARKET, downPct: 25 });
    expect(d.country).toBe('ca');
    expect(d.downPct).toBe(25);
    expect(d.units).toBe(3);
    expect(d.unitType).toBe('triplex');
    expect(d.taxesAnnual).toBe(3675);
    expect(d.insuranceAnnual).toBe(3 * DEFAULT_MARKET.insurancePerUnit);
    expect(d.hoaMonthly).toBe(3 * DEFAULT_MARKET.utilitiesPerUnit);
    expect(d.rentPerUnit).toBe(Math.round((1900 + 1700 + 1950) / 3));
    expect(d.listingId).toBe('X13684758');
    expect(d.notes).toContain('MLS® X13684758');
  });

  it('estimates missing taxes from the price and keeps a floor under insurance', () => {
    const d = listingToDeal({ address: '1 Main St', price: 300000, units: 1 }, DEFAULT_MARKET);
    expect(d.taxesAnnual).toBe(Math.round(300000 * DEFAULT_MARKET.taxPct / 100));
    expect(d.insuranceAnnual).toBe(INSURANCE_MIN);
    expect(d.hoaMonthly).toBe(0); // tenants pay a house's utilities
  });
});

describe('scoreListing and rankListings', () => {
  const targets = { dscr: 1.25, cashFlowPerDoor: 200, coc: 8, useDscr: true, useCashFlow: true, useCoc: true };
  const page = (slug) => `https://www.rew.ca/properties/${slug}-thunder-bay-on`;
  const cheap = cleanListing({ address: '10 Cheap St', price: 180000, units: 2, rents: [1500, 1500], taxes: 2400, url: page('10-cheap-street') });
  const pricey = cleanListing({ address: '20 Dear St', price: 650000, units: 2, rents: [1500, 1500], taxes: 6000, url: page('20-dear-street') });
  const house = cleanListing({ address: '30 House Rd', price: 250000, units: 1, taxes: 3000, url: page('30-house-road') });

  it('scores cash flow per door and checks every target via the max offer', () => {
    const s = scoreListing(cheap, DEFAULT_MARKET, targets);
    const a = analyzeDeal(s.deal);
    expect(s.perDoor).toBeCloseTo(a.netCashFlow / 2, 8);
    expect(s.meets).toBe(maxOffer(s.deal, targets).price >= 180000);
    expect(scoreListing(pricey, DEFAULT_MARKET, targets).meets).toBe(false);
  });

  it('ranks by cash flow per door and filters by type, hidden and status', () => {
    const all = rankListings([pricey, house, cheap], DEFAULT_MARKET, targets);
    expect(all.map((s) => s.listing.address)[0]).toBe('10 Cheap St');
    for (let i = 1; i < all.length; i++) expect(all[i - 1].perDoor).toBeGreaterThanOrEqual(all[i].perDoor);
    expect(rankListings([pricey, house, cheap], { ...DEFAULT_MARKET, types: ['single'] }, targets).map((s) => s.listing.address)).toEqual(['30 House Rd']);
    expect(rankListings([pricey, house, cheap], { ...DEFAULT_MARKET, hidden: [cheap.id] }, targets)).toHaveLength(2);
    expect(rankListings([{ ...cheap, status: 'conditional' }], DEFAULT_MARKET, targets)).toHaveLength(0);
  });

  it('leaves out anything without a page of its own, as an older saved feed may hold', () => {
    expect(rankListings([{ ...cheap, url: null }, { ...house, url: 'https://www.redfin.ca/on/thunder-bay/fort-william' }], DEFAULT_MARKET, targets)).toHaveLength(0);
  });
});

describe('mergeFeed', () => {
  const day1 = mergeFeed(null, [triplex, { address: '65 Kenogami Ave N', price: 329900, units: 2, url: 'https://ontario.onepercentrealty.com/properties/1551518178/THUNDER_BAY-65_Kenogami_Ave._N.' }], { today: '2026-10-28', now: 1 }).feed;

  it('starts a feed with first-seen dates and price history', () => {
    expect(day1.listings).toHaveLength(2);
    expect(day1.lastRun).toMatchObject({ date: '2026-10-28', found: 2, added: 2 });
    expect(day1.listings[0]).toMatchObject({ firstSeen: '2026-10-28', lastSeen: '2026-10-28', priceHistory: [{ date: '2026-10-28', price: 529900 }] });
  });

  it('records price cuts, keeps first-seen dates and never erases known facts', () => {
    const { feed, stats } = mergeFeed(day1, [{ mls: 'X13684758', address: '228 Archibald St S', price: 509900, units: 3, url: triplex.url }], { today: '2026-10-30', now: 2 });
    const l = feed.listings.find((x) => x.id === 'X13684758');
    expect(stats).toMatchObject({ found: 1, added: 0, seenAgain: 1, priceDrops: 1 });
    expect(l.firstSeen).toBe('2026-10-28');
    expect(l.lastSeen).toBe('2026-10-30');
    expect(l.priceHistory.map((h) => h.price)).toEqual([529900, 509900]);
    expect(l.rents).toEqual([1900, null, 1950]);
    expect(l.taxes).toBe(3675);
  });

  it('matches by address when one site gives an MLS number and another does not', () => {
    const { feed, stats } = mergeFeed(day1, [{ mls: 'TB2601767', address: '65 Kenogami Avenue North, Thunder Bay', price: 329900, units: 2, url: 'https://ontario.onepercentrealty.com/properties/1551518178/THUNDER_BAY-65_Kenogami_Ave._N.' }], { today: '2026-10-29' });
    expect(stats.added).toBe(0);
    expect(feed.listings).toHaveLength(2);
    expect(feed.listings.find((x) => x.address.startsWith('65')).mls).toBe('TB2601767');
  });

  it('drops listings reported sold or gone, or not confirmed for a week', () => {
    const sold = mergeFeed(day1, [{ ...triplex, status: 'sold' }], { today: '2026-10-29' }).feed;
    expect(sold.listings.map((l) => l.id)).not.toContain('X13684758');
    // "gone" needs no link: the recheck found no page for it.
    const gone = mergeFeed(day1, [{ address: '65 Kenogami Ave N', price: 329900, status: 'gone' }], { today: '2026-10-29' }).feed;
    expect(gone.listings.map((l) => l.address)).toEqual([triplex.address]);
    expect(mergeFeed(day1, [], { today: '2026-11-04' }).feed.listings).toHaveLength(2);
    const later = mergeFeed(day1, [], { today: '2026-11-05' });
    expect(later.feed.listings).toHaveLength(0);
    expect(later.stats.removed).toBe(2);
  });

  it('turns away listings without a page of their own, and drops saved ones that have none', () => {
    const { feed, stats } = mergeFeed(day1, [{ address: '440 Archibald Street S', price: 299900 }, { address: '1 Main St', price: 1 }], { today: '2026-10-29' });
    expect(stats).toMatchObject({ found: 0, added: 0, rejected: 2 });
    expect(feed.listings).toHaveLength(2);
    const old = { ...day1, listings: [...day1.listings, { id: 'addr-282', address: '282 Algoma Street N', price: 549900, units: 1, url: null, lastSeen: '2026-10-28' }] };
    expect(mergeFeed(old, [], { today: '2026-10-29' }).feed.listings.map((l) => l.address)).not.toContain('282 Algoma Street N');
  });

  it('keeps the last 14 runs', () => {
    let feed = day1;
    for (let i = 0; i < 20; i++) feed = mergeFeed(feed, [], { today: '2026-10-29' }).feed;
    expect(feed.runs).toHaveLength(14);
  });
});

describe('standouts', () => {
  it('flags listings that beat every target and are new or cheaper in the latest run', () => {
    const targets = { dscr: 1.1, cashFlowPerDoor: 50, coc: 4, useDscr: true, useCashFlow: true, useCoc: true };
    const good = { address: '10 Cheap St', price: 180000, units: 2, rents: [1500, 1500], taxes: 2400, url: 'https://www.rew.ca/properties/10-cheap-street-thunder-bay-on' };
    const day1 = mergeFeed(null, [good], { today: '2026-10-28' }).feed;
    expect(standouts(day1, DEFAULT_MARKET, targets)).toHaveLength(1);
    const day2 = mergeFeed(day1, [good], { today: '2026-10-29' }).feed;
    expect(standouts(day2, DEFAULT_MARKET, targets)).toHaveLength(0);
    const day3 = mergeFeed(day2, [{ ...good, price: 170000 }], { today: '2026-10-30' }).feed;
    expect(standouts(day3, DEFAULT_MARKET, targets)).toHaveLength(1);
  });
});

describe('normalizeMarket', () => {
  it('fills missing settings and ignores junk', () => {
    const m = normalizeMarket({ downPct: 25, rents: { 2: 1800, 3: 'x' }, types: ['small', 'bogus'], hidden: [1, 'a'] });
    expect(m.downPct).toBe(25);
    expect(m.rents[2]).toBe(1800);
    expect(m.rents[3]).toBe(DEFAULT_MARKET.rents[3]);
    expect(m.types).toEqual(['small']);
    expect(m.hidden).toEqual(['a']);
  });
});
