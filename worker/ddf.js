// Pulls MLS® listings from CREA's DDF® Web API for the cities set in
// DDF_CITIES (city keys, comma-separated; Thunder Bay when unset), every few
// hours from the scheduled job. Each city's listings are kept as a feed (the
// same shape as the morning run's, with first-seen dates and price history)
// in the directory's database, and joined to the morning run's file when
// /data/<city>.json is asked for (index.js).
//
// Needs, in Cloudflare (Workers → Settings → Variables, as secrets):
// - DDF_CLIENT_ID and DDF_CLIENT_SECRET: from CREA, once a REALTOR® partner
//   has signed up for DDF® and named this site as their technology provider.
// - DDF_CITIES (optional): e.g. "thunder-bay,sudbury".

import { DDF, ddfCityFilter, ddfToRaw } from '../src/lib/ddf.js';
import { LISTING_CITIES, feedDoc, mergeFeed } from '../src/lib/market.js';

export const ddfOn = (env) => Boolean(env.DDF_CLIENT_ID && env.DDF_CLIENT_SECRET);

/** The cities to pull: DDF_CITIES when it names known cities, otherwise Thunder Bay. */
export function ddfCities(env) {
  const picked = String(env.DDF_CITIES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((k) => LISTING_CITIES.includes(k));
  return picked.length ? [...new Set(picked)] : ['thunder-bay'];
}

/** An access token (they last an hour; each sync asks for a fresh one). */
export async function ddfToken(env, fetchFn = fetch) {
  const res = await fetchFn(DDF.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.DDF_CLIENT_ID, client_secret: env.DDF_CLIENT_SECRET, scope: DDF.scope }).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`DDF sign-in failed (${res.status})`);
  return data.access_token;
}

async function getJson(url, token, fetchFn) {
  const res = await fetchFn(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!res.ok) throw new Error(`DDF request failed (${res.status})`);
  return res.json();
}

/** Every active property in one city, following the API's pages (at most DDF.maxPages). */
export async function ddfProperties(cityKey, token, fetchFn = fetch) {
  const q = new URLSearchParams({ $filter: ddfCityFilter(cityKey), $top: String(DDF.pageSize) });
  let next = `${DDF.apiBase}/Property?${q.toString()}`;
  const out = [];
  for (let page = 0; next && page < DDF.maxPages; page++) {
    const data = await getJson(next, token, fetchFn);
    out.push(...(Array.isArray(data?.value) ? data.value : []));
    next = typeof data?.['@odata.nextLink'] === 'string' && data['@odata.nextLink'].startsWith(DDF.apiBase) ? data['@odata.nextLink'] : null;
  }
  return out;
}

/** Brokerage names by office key, asked once each per sync; '' when the API doesn't say. */
async function officeNames(props, token, fetchFn) {
  const names = new Map();
  for (const p of props) {
    const key = String(p.ListOfficeKey ?? '');
    if (!key || p.ListOfficeName || names.has(key) || names.size >= 200) continue;
    try {
      const o = await getJson(`${DDF.apiBase}/Office('${encodeURIComponent(key.replace(/'/g, "''"))}')`, token, fetchFn);
      names.set(key, String(o?.OfficeName ?? ''));
    } catch {
      names.set(key, '');
    }
  }
  return names;
}

/**
 * One sync: for each city, pull its listings and fold them into the feed
 * kept from last time. `store` keeps feeds: get(doc) and set(doc, feed).
 * Returns what happened, per city, for the admin page.
 */
export async function syncDdf(env, store, { fetchFn = fetch, now = Date.now() } = {}) {
  if (!ddfOn(env)) return { ok: false, reason: 'DDF_CLIENT_ID and DDF_CLIENT_SECRET are not set.' };
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const token = await ddfToken(env, fetchFn);
  const cities = {};
  for (const city of ddfCities(env)) {
    try {
      const props = await ddfProperties(city, token, fetchFn);
      const names = await officeNames(props, token, fetchFn);
      const found = props.map((p) => ddfToRaw(p, { officeName: names.get(String(p.ListOfficeKey ?? '')) }));
      const doc = feedDoc(city);
      // A listing missing from DDF for two days is off the market (DDF lists everything active).
      const { feed, stats } = mergeFeed(await store.get(doc), found, { today, now, keepDays: 2, city, note: `DDF: ${props.length} listings` });
      await store.set(doc, feed);
      cities[city] = { ...stats, count: feed.listings.length };
    } catch (e) {
      cities[city] = { error: String(e?.message || e).slice(0, 200) };
    }
  }
  return { ok: true, at: now, cities };
}
