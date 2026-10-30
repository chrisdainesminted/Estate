import { beforeEach, describe as suite, expect, it } from 'vitest';
import { Store, hashKey } from './store.js';
import { clean } from './schema.js';

// Node's built-in SQLite stands in for the Durable Object's. Node versions
// without it (before 22.13) skip these tests instead of failing the build.
const sqlite = await import('node:sqlite').catch(() => null);
const describe = sqlite ? suite : suite.skip;
const DatabaseSync = sqlite?.DatabaseSync;

// The Durable Object's sql.exec, over Node's SQLite: runs at once, rows on toArray().
function memorySql() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(query, ...args) {
      const st = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query) ? st.all(...args) : (st.run(...args), []);
      return { toArray: () => rows };
    },
  };
}

const HOUR = 3600000;
let now;
let s;
const future = (h) => new Date(now + h * HOUR).toISOString();

beforeEach(async () => {
  if (!sqlite) return;
  now = Date.parse('2026-11-02T15:00:00Z');
  s = new Store(memorySql(), () => now);
  s.init(await hashKey('secret-key'));
});

describe('workspace', () => {
  it('opens only with its key, and can’t be made twice', async () => {
    expect(s.checkKey(await hashKey('secret-key'))).toBe(true);
    expect(s.checkKey(await hashKey('wrong'))).toBe(false);
    expect(() => s.init('x')).toThrow(/already exists/);
  });

  it('keeps records to their schema', () => {
    expect(clean('listings', { title: '  2-bed  ', rent: 1800, evil: 'x', active: 'yes' })).toEqual({ title: '2-bed', rent: 1800 });
    const u = s.create('units', { label: 'Upper', rent: 1700, repairToken: 'mine' });
    expect(u.repairToken).not.toBe('mine');
    expect(u.repairToken.length).toBeGreaterThan(10);
  });
});

describe('applying and booking a viewing', () => {
  let listing;
  let slot;
  beforeEach(() => {
    listing = s.create('listings', { title: 'Upper 2-bed', rent: 1800, area: 'Port Arthur', address: '12 Secret St', active: true });
    [slot] = [s.create('slots', { listingId: listing.id, start: future(48), minutes: 30 })];
  });

  it('shows the public listing without the address, with open times', () => {
    const p = s.publicListing(listing.id);
    expect(p.listing.address).toBeUndefined();
    expect(p.slots.map((x) => x.id)).toEqual([slot.id]);
  });

  it('holds the picked time, so no one else can take it', () => {
    const { token } = s.apply(listing.id, { name: 'Ana', email: 'ana@example.com', slotId: slot.id, people: 2 }, '1.1.1.1');
    expect(s.get('slots', slot.id).status).toBe('held');
    expect(s.publicListing(listing.id).slots).toEqual([]);
    expect(() => s.apply(listing.id, { name: 'Ben', email: 'ben@example.com', slotId: slot.id }, '2.2.2.2')).toThrow(/took that time/);
    const st = s.status(token);
    expect(st.status).toBe('new');
    expect(st.listing.address).toBe('');
    expect(st.landlord.email).toBeUndefined();
  });

  it('books the time when the landlord confirms, and shares the address', () => {
    const { token } = s.apply(listing.id, { name: 'Ana', email: 'ana@example.com', slotId: slot.id }, '1.1.1.1');
    const app = s.list('applications')[0];
    s.update('applications', app.id, { status: 'viewing' });
    expect(s.get('slots', slot.id).status).toBe('booked');
    const st = s.status(token);
    expect(st.viewing.confirmed).toBe(true);
    expect(st.listing.address).toBe('12 Secret St');
  });

  it('frees the time when an application is declined or withdrawn', () => {
    const { token } = s.apply(listing.id, { name: 'Ana', email: 'ana@example.com', slotId: slot.id }, '1.1.1.1');
    s.applicantAction(token, 'withdraw', null, '1.1.1.1');
    expect(s.get('slots', slot.id)).toMatchObject({ status: 'open', applicationId: '' });
  });

  it('lets an applicant move to another open time before it’s confirmed', () => {
    const other = s.create('slots', { listingId: listing.id, start: future(72), minutes: 30 });
    const { token } = s.apply(listing.id, { name: 'Ana', phone: '807-555-0100', slotId: slot.id }, '1.1.1.1');
    s.applicantAction(token, 'reschedule', other.id, '1.1.1.1');
    expect(s.get('slots', slot.id).status).toBe('open');
    expect(s.get('slots', other.id).status).toBe('held');
  });

  it('needs a name and a way to reach you, and turns away bots and floods', () => {
    expect(() => s.apply(listing.id, { name: '', email: 'a@b.co' }, 'ip')).toThrow(/name/);
    expect(() => s.apply(listing.id, { name: 'A' }, 'ip2')).toThrow(/email or phone/);
    expect(() => s.apply(listing.id, { name: 'A', email: 'a@b.co', website: 'spam' }, 'ip3')).toThrow();
    for (let i = 0; i < 5; i++) s.apply(listing.id, { name: `P${i}`, email: 'p@b.co' }, 'flood');
    expect(() => s.apply(listing.id, { name: 'P6', email: 'p@b.co' }, 'flood')).toThrow(/Too many/);
  });

  it('won’t take applications for a listing that’s off', () => {
    s.update('listings', listing.id, { active: false });
    expect(() => s.apply(listing.id, { name: 'A', email: 'a@b.co' }, 'ip')).toThrow(/isn’t taking/);
  });

  it('clears out closed applications after 180 days', () => {
    const { token } = s.apply(listing.id, { name: 'Ana', email: 'ana@example.com' }, '1.1.1.1');
    s.applicantAction(token, 'withdraw', null, '1.1.1.1');
    now += 181 * 24 * HOUR;
    expect(s.all().applications).toEqual([]);
  });
});

describe('repairs', () => {
  it('takes a repair report only with the unit’s own link', () => {
    const u = s.create('units', { label: 'Basement' });
    expect(() => s.reportRepair(u.id, 'nope-nope-nope', { title: 'Leak' }, 'ip')).toThrow(/isn’t valid/);
    s.reportRepair(u.id, u.repairToken, { title: 'Leak under sink', urgency: 'urgent', status: 'fixed' }, 'ip');
    const [m] = s.list('maintenance');
    expect(m).toMatchObject({ unitId: u.id, title: 'Leak under sink', urgency: 'urgent', status: 'reported', read: false });
  });
});
