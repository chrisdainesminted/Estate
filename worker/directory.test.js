import { beforeEach, describe as suite, expect, it } from 'vitest';
import { DirectoryStore } from './directory.js';

const sqlite = await import('node:sqlite').catch(() => null);
const describe = sqlite ? suite : suite.skip;
function memorySql() {
  const db = new sqlite.DatabaseSync(':memory:');
  return {
    exec(query, ...args) {
      const st = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query) ? st.all(...args) : (st.run(...args), []);
      return { toArray: () => rows };
    },
  };
}

const DAY = 86400000;
let now;
let d;
const listing = (n, over = {}) => ({ key: `ws:${n}`, ws: 'ws', id: String(n), kind: 'rent', title: `Home ${n}`, city: 'toronto', price: 2000 + n * 100, beds: n % 4, renewed: now, ...over });

beforeEach(() => {
  if (!sqlite) return;
  now = Date.parse('2026-11-02T15:00:00Z');
  d = new DirectoryStore(memorySql(), () => now);
  for (let i = 1; i <= 30; i++) d.upsert(listing(i), 'ON');
  d.upsert(listing(99, { kind: 'sale', price: 650000, city: 'calgary', beds: 3 }), 'AB');
});

describe('public search', () => {
  it('filters by kind, place, price and bedrooms, and pages', () => {
    expect(d.search({ kind: 'rent' }).total).toBe(30);
    expect(d.search({ kind: 'rent' }).items).toHaveLength(24);
    expect(d.search({ kind: 'rent', page: 2 }).items).toHaveLength(6);
    expect(d.search({ kind: 'sale', province: 'AB' }).items.map((x) => x.id)).toEqual(['99']);
    expect(d.search({ kind: 'rent', maxPrice: 2500 }).total).toBe(5);
    expect(d.search({ kind: 'rent', minBeds: 3 }).items.every((x) => x.beds >= 3)).toBe(true);
    expect(d.search({ kind: 'rent', sort: 'price' }).items[0].id).toBe('1');
  });

  it('drops listings not renewed in 60 days', () => {
    now += 61 * DAY;
    expect(d.search({ kind: 'rent' }).total).toBe(0);
  });

  it('hides a listing after three reports from different people, until reviewed', () => {
    d.report('ws:1', 'a', 'scam');
    d.report('ws:1', 'a', 'scam'); // the same person again doesn't count
    d.report('ws:1', 'b', 'scam');
    expect(d.search({ kind: 'rent' }).total).toBe(30);
    d.report('ws:1', 'c', 'not-available');
    expect(d.search({ kind: 'rent' }).total).toBe(29);
    expect(d.reported()[0]).toMatchObject({ id: '1', reports: 3, hidden: true });
    d.review('ws:1', true);
    expect(d.search({ kind: 'rent' }).total).toBe(30);
    expect(d.reported()).toEqual([]);
    // Refreshing a listing doesn't unhide one that was taken down.
    d.review('ws:2', false);
    d.upsert(listing(2), 'ON');
    expect(d.search({ kind: 'rent' }).total).toBe(29);
  });
});
