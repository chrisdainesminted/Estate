import { describe, expect, it } from 'vitest';
import { ddfCities, ddfOn, syncDdf } from './ddf.js';
import { DDF } from '../src/lib/ddf.js';

const env = { DDF_CLIENT_ID: 'id', DDF_CLIENT_SECRET: 'secret' };

const property = (n, over = {}) => ({
  ListingKey: `k${n}`,
  ListingId: `M${n}`,
  ListPrice: 300000 + n * 1000,
  UnparsedAddress: `${n} Red River Road, Thunder Bay, Ontario`,
  City: 'Thunder Bay',
  StateOrProvince: 'Ontario',
  PropertySubType: 'Single Family',
  StandardStatus: 'Active',
  ListOfficeKey: 'o1',
  ...over,
});

/** A pretend DDF: a token, two pages of properties, one office. */
function fakeDdf(pages) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url === DDF.tokenUrl) return ok({ access_token: 'tok', expires_in: 3600 });
    if (init.headers?.authorization !== 'Bearer tok') return new Response('{}', { status: 401 });
    if (String(url).includes("/Office('o1')")) return ok({ OfficeName: 'Lakehead Realty, Brokerage' });
    const page = String(url).includes('page2') ? 1 : 0;
    return ok({ value: pages[page] ?? [], ...(page === 0 && pages[1] ? { '@odata.nextLink': `${DDF.apiBase}/Property?page2` } : {}) });
  };
  return { fetchFn, calls };
}

const memory = () => {
  const m = new Map();
  return { get: async (d) => m.get(d) ?? null, set: async (d, v) => void m.set(d, v), m };
};

describe('DDF sync', () => {
  it('stays off until both keys are set', async () => {
    expect(ddfOn({})).toBe(false);
    expect(await syncDdf({}, memory())).toMatchObject({ ok: false });
  });

  it('reads the cities to pull, defaulting to Thunder Bay', () => {
    expect(ddfCities({})).toEqual(['thunder-bay']);
    expect(ddfCities({ DDF_CITIES: 'sudbury, nowhere ,thunder-bay' })).toEqual(['sudbury', 'thunder-bay']);
  });

  it('signs in, follows pages, names the brokerage and keeps a feed per city', async () => {
    const { fetchFn, calls } = fakeDdf([[property(1), property(2)], [property(3)]]);
    const store = memory();
    const report = await syncDdf(env, store, { fetchFn, now: Date.parse('2026-11-16T15:00:00Z') });
    expect(report.cities['thunder-bay']).toMatchObject({ added: 3, count: 3 });
    const feed = store.m.get('thunderbay');
    expect(feed.listings.map((l) => l.mls).sort()).toEqual(['M1', 'M2', 'M3']);
    expect(feed.listings[0]).toMatchObject({ ddf: true, brokerage: 'Lakehead Realty, Brokerage', firstSeen: '2026-11-16' });
    // The token request sends the client credentials as a form.
    expect(calls[0].init.body).toContain('grant_type=client_credentials');
    // The brokerage was asked about once.
    expect(calls.filter((c) => c.url.includes('Office')).length).toBe(1);
  });

  it('tracks price changes and drops a listing gone for two days', async () => {
    const store = memory();
    await syncDdf(env, store, { fetchFn: fakeDdf([[property(1), property(2)]]).fetchFn, now: Date.parse('2026-11-16T15:00:00Z') });
    await syncDdf(env, store, { fetchFn: fakeDdf([[property(1, { ListPrice: 290000 })]]).fetchFn, now: Date.parse('2026-11-17T15:00:00Z') });
    let feed = store.m.get('thunderbay');
    expect(feed.listings.find((l) => l.mls === 'M1').priceHistory.map((h) => h.price)).toEqual([301000, 290000]);
    expect(feed.listings.some((l) => l.mls === 'M2')).toBe(true);
    await syncDdf(env, store, { fetchFn: fakeDdf([[property(1, { ListPrice: 290000 })]]).fetchFn, now: Date.parse('2026-11-19T15:00:00Z') });
    feed = store.m.get('thunderbay');
    expect(feed.listings.map((l) => l.mls)).toEqual(['M1']);
  });

  it('reports a failed city without stopping', async () => {
    const fetchFn = async (url) => (url === DDF.tokenUrl ? new Response(JSON.stringify({ access_token: 'tok' })) : new Response('nope', { status: 500 }));
    const report = await syncDdf(env, memory(), { fetchFn });
    expect(report.cities['thunder-bay'].error).toMatch(/500/);
  });
});
