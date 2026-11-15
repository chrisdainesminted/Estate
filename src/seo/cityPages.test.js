import { describe, expect, it } from 'vitest';
import { buildCityPages, sitemapLines, workOut } from './cityPages.js';
import { DEFAULT_MARKET, localMarket } from '../lib/market.js';

const listing = (id, over = {}) => ({
  id,
  address: `${id} Main Street`,
  price: 400000,
  units: 2,
  beds: [2, 2],
  rents: [null, null],
  grossRent: null,
  taxes: 3600,
  status: 'active',
  url: `https://example.com/${id}`,
  priceHistory: [],
  ...over,
});

const feed = {
  lastRun: { date: '2026-11-15' },
  listings: [
    listing('1'),
    listing('2', { price: 300000 }),
    listing('3', { taxes: null }),
    listing('4', { units: 1, beds: [3], rents: [null] }),
    listing('5', { status: 'removed' }),
    listing('6', { address: '<script>alert(1)</script>' }),
  ],
};

describe('city pages', () => {
  const pages = buildCityPages({ 'thunder-bay': feed });
  const at = (p) => pages.find((x) => x.path === p);

  it('makes an index, a city page, and a page per kind with enough listings', () => {
    expect(pages.map((p) => p.path)).toEqual(['/homes-for-sale/', '/homes-for-sale/thunder-bay/', '/homes-for-sale/thunder-bay/duplexes/']);
  });

  it('counts only active listings and names the city and kind', () => {
    const page = at('/homes-for-sale/thunder-bay/duplexes/').html;
    expect(page).toContain('<title>Duplexes for sale in Thunder Bay, worked out');
    expect(page).toContain('4 duplexes on the market');
    expect(page).not.toContain('5 Main Street');
  });

  it('never shows cash flow or a grade without a real tax bill', () => {
    const r = workOut(listing('3', { taxes: null }), localMarket(DEFAULT_MARKET, 'thunder-bay'));
    expect(r.cashFlow).toBeNull();
    expect(r.grade).toBeNull();
    expect(at('/homes-for-sale/thunder-bay/').html).toContain('Needs the tax bill');
  });

  it('escapes what the listings say', () => {
    const html = at('/homes-for-sale/thunder-bay/').html;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)');
  });

  it('lists every page in the sitemap, with the day it was checked', () => {
    const lines = sitemapLines(pages);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('/homes-for-sale/thunder-bay/</loc><lastmod>2026-11-15</lastmod>');
  });

  it('makes nothing without listings', () => {
    expect(buildCityPages({})).toEqual([]);
  });
});
