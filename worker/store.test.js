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

describe('photos, messages and publishing', () => {
  let listing;
  beforeEach(() => {
    if (!sqlite) return;
    listing = s.create('listings', { kind: 'sale', title: 'Bungalow', price: 450000, city: 'winnipeg', address: '9 Elm St', active: true, public: true });
  });

  it('keeps up to ten photos per listing, cover first, and serves them', () => {
    const jpg = new Uint8Array([255, 216, 255, 1, 2, 3]);
    let l = s.addPhoto(listing.id, 'image/jpeg', jpg);
    l = s.addPhoto(listing.id, 'image/png', new Uint8Array([137, 80, 78, 71]));
    expect(l.photoIds).toHaveLength(2);
    expect(s.getPhoto(l.photoIds[0]).mime).toBe('image/jpeg');
    l = s.coverPhoto(listing.id, l.photoIds[1]);
    expect(s.getPhoto(l.photoIds[0]).mime).toBe('image/png');
    expect(() => s.addPhoto(listing.id, 'image/gif', jpg)).toThrow(/JPEG, PNG or WebP/);
    expect(() => s.addPhoto(listing.id, 'image/jpeg', new Uint8Array(1_600_000))).toThrow(/too large/);
    l = s.removePhoto(listing.id, l.photoIds[0]);
    expect(l.photoIds).toHaveLength(1);
    // Saving the listing keeps its photos.
    expect(s.update('listings', listing.id, { title: 'Brick bungalow', photoIds: [] }).photoIds).toHaveLength(1);
  });

  it('shows a sale listing’s address and price publicly', () => {
    const p = s.publicListing(listing.id);
    expect(p.listing).toMatchObject({ kind: 'sale', price: 450000, address: '9 Elm St' });
  });

  it('carries a thread both ways, each side’s messages read by the other', () => {
    const { token } = s.apply(listing.id, { name: 'Bo', email: 'bo@example.com', message: 'Is it still for sale?' }, 'ip');
    const app = s.list('applications')[0];
    s.landlordMessage(app.id, 'Yes! Want to see it Saturday?');
    let st = s.applicantMessage(token, 'Saturday works.', 'ip');
    expect(st.messages.map((m) => m.from)).toEqual(['landlord', 'applicant']);
    expect(s.thread(app.id)[0].read).toBe(true); // the applicant opened their page
    expect(s.get('applications', app.id).read).toBe(false); // a new message to read
    s.markRead(app.id, 'applicant');
    expect(s.thread(app.id).every((m) => m.read)).toBe(true);
    expect(() => s.create('messages', { applicationId: app.id, from: 'applicant', body: 'forged' })).toThrow();
    expect(() => s.landlordMessage(app.id, '   ')).toThrow(/Write a message/);
    s.remove('applications', app.id);
    expect(s.list('messages')).toEqual([]);
  });

  it('summarizes public listings for the search, and leaves others out', () => {
    expect(s.summary(listing.id, 'ws1')).toMatchObject({ key: `ws1:${listing.id}`, kind: 'sale', price: 450000, city: 'winnipeg' });
    expect(s.summary(listing.id, 'ws1', { needVerified: true })).toBeNull();
    s.update('listings', listing.id, { public: false });
    expect(s.summary(listing.id, 'ws1')).toBeNull();
  });

  it('confirms the owner’s email with a code, and forgets it when the email changes', async () => {
    s.update('settings', 'main', { email: 'me@example.com' });
    const { code } = await s.startVerify();
    await expect(s.finishVerify('000000' === code ? '111111' : '000000')).rejects.toThrow(/isn’t right/);
    await s.finishVerify(code);
    expect(s.get('settings', 'main').emailVerified).toBe(true);
    expect(s.summary(listing.id, 'ws1', { needVerified: true })).not.toBeNull();
    s.update('settings', 'main', { email: 'new@example.com' });
    expect(s.get('settings', 'main').emailVerified).toBe(false);
  });
});
