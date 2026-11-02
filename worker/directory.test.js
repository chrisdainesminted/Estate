import { beforeEach, describe as suite, expect, it } from 'vitest';
import { DirectoryStore, cleanInbox, inboxEmail } from './directory.js';

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

describe('map points', () => {
  it('remembers points and misses, and says which addresses are new', () => {
    expect(d.geoGet(['a', 'b'])).toEqual({ known: {}, missing: ['a', 'b'] });
    d.geoPut('a', [48.4, -89.2]);
    d.geoPut('b', null);
    expect(d.geoGet(['a', 'b', 'c'])).toEqual({ known: { a: [48.4, -89.2] }, missing: ['c'] });
  });
});

describe('owner inbox', () => {
  it('keeps contact notes and broker requests, newest first, until marked done', () => {
    d.addInbox('contact', { name: 'A', email: 'a@b.ca', message: 'Hello there' }, '1.1.1.1');
    now += 1000;
    d.addInbox('broker', { name: 'B', email: 'b@b.ca', consent: true }, '1.1.1.1');
    const [first, second] = d.inbox();
    expect(first).toMatchObject({ kind: 'broker', name: 'B', done: false });
    expect(second.kind).toBe('contact');
    d.inboxDone(first.id, true);
    expect(d.inbox()[1]).toMatchObject({ name: 'B', done: true });
  });

  it('limits how many one address can send', () => {
    for (let i = 0; i < 5; i++) d.addInbox('contact', { name: 'A' }, '2.2.2.2');
    expect(() => d.addInbox('contact', { name: 'A' }, '2.2.2.2')).toThrow(/Too many/);
  });
});

describe('form checks', () => {
  it('needs a name, a real-looking email, and a message or consent', () => {
    expect(cleanInbox('contact', { name: '', email: 'a@b.ca', message: 'hi there' }).error).toMatch(/name/);
    expect(cleanInbox('contact', { name: 'A', email: 'nope', message: 'hi there' }).error).toMatch(/email/);
    expect(cleanInbox('contact', { name: 'A', email: 'a@b.ca', message: 'hey' }).error).toMatch(/message/);
    expect(cleanInbox('contact', { name: ' A ', email: 'a@b.ca', message: 'Hello there', extra: 'x' })).toEqual({ name: 'A', email: 'a@b.ca', topic: '', message: 'Hello there' });
    expect(cleanInbox('broker', { name: 'A', email: 'a@b.ca' }).error).toMatch(/Tick/);
    expect(cleanInbox('broker', { name: 'A', email: 'a@b.ca', consent: true, price: '400000' })).toMatchObject({ price: 400000, consent: true });
  });
});

suite('the owner email for a new request', () => {
  it('lists what a broker request shared, with a reply-to for the person', () => {
    const e = inboxEmail('broker', { name: 'Ana Silva', email: 'ana@example.ca', phone: '807-555-0100', city: 'Thunder Bay', timeline: '3-6 months', price: 412000, income: 85000, note: 'Self-employed', consent: true }, 'https://example.dev');
    expect(e.subject).toBe('Squarely: Broker request from Ana Silva (Thunder Bay)');
    expect(e.replyTo).toBe('ana@example.ca');
    expect(e.text).toContain('Phone: 807-555-0100');
    expect(e.text).toContain('Income they shared: $85,000');
    expect(e.text).toContain('What Squarely says they could buy: $412,000');
    expect(e.text).toContain('https://example.dev/homes/#admin');
  });
  it('leaves out what a request didn’t include', () => {
    const e = inboxEmail('broker', { name: 'Bo', email: 'bo@example.ca', phone: '', city: '', timeline: '', price: 0, income: 0, note: '', consent: true });
    expect(e.text).not.toMatch(/Phone|Income|could buy|Note/);
    expect(e.subject).toBe('Squarely: Broker request from Bo');
  });
  it('passes on a contact message', () => {
    const e = inboxEmail('contact', { name: 'Cy', email: 'cy@example.ca', topic: 'listing', message: 'This one is sold.' });
    expect(e.subject).toBe('Squarely: Message from Cy');
    expect(e.text).toContain('This one is sold.');
  });
});

suite('owner email subject', () => {
  it('has no line breaks', () => {
    expect(inboxEmail('contact', { name: 'A\r\nBcc: x@y.z', email: 'a@b.ca', message: 'hello there' }).subject).not.toMatch(/[\r\n]/);
  });
});
