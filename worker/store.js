// One landlord's workspace: listings, viewing slots, applications, units
// and tenants, rent payments, repairs and expenses, kept in the Durable
// Object's SQLite database. Pure logic over a `sql.exec(query, ...args)`
// interface, so it runs the same in the Worker and in tests.

import { APPLY_FIELDS, COLLECTIONS, EMAIL, REPAIR_FIELDS, clean } from './schema.js';

const MAX_ITEMS = 3000; // per collection
const KEEP_CLOSED_DAYS = 180; // declined or withdrawn applications are deleted after this
const DAY = 86400000;

export class StoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const newId = () => randomToken(9);

export async function hashKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)));
  return b64url(new Uint8Array(digest));
}

/** Equal strings in time that doesn't depend on where they differ. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class Store {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
    sql.exec('CREATE TABLE IF NOT EXISTS items (collection TEXT, id TEXT, data TEXT, created INTEGER, updated INTEGER, PRIMARY KEY (collection, id))');
    sql.exec('CREATE TABLE IF NOT EXISTS hits (bucket TEXT PRIMARY KEY, n INTEGER)');
  }

  meta(k) {
    return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v ?? null;
  }

  setMeta(k, v) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
  }

  get ready() {
    return this.meta('keyHash') != null;
  }

  init(keyHash) {
    if (this.ready) throw new StoreError(409, 'This workspace already exists.');
    this.setMeta('keyHash', keyHash);
    this.setMeta('created', String(this.now()));
  }

  checkKey(keyHash) {
    return sameText(this.meta('keyHash'), keyHash);
  }

  /** At most `max` of `kind` from one address an hour. */
  limit(ip, kind, max) {
    const hour = Math.floor(this.now() / 3600000);
    const bucket = `${kind}:${ip}:${hour}`;
    const n = (this.sql.exec('SELECT n FROM hits WHERE bucket = ?', bucket).toArray()[0]?.n ?? 0) + 1;
    if (n > max) throw new StoreError(429, 'Too many requests. Try again in an hour.');
    this.sql.exec('INSERT INTO hits (bucket, n) VALUES (?, ?) ON CONFLICT(bucket) DO UPDATE SET n = excluded.n', bucket, n);
    this.sql.exec('DELETE FROM hits WHERE bucket NOT LIKE ?', `%:${hour}`);
  }

  // ---- records ----

  row(r) {
    return { ...JSON.parse(r.data), id: r.id, created: r.created, updated: r.updated };
  }

  get(collection, id) {
    const r = this.sql.exec('SELECT * FROM items WHERE collection = ? AND id = ?', collection, id).toArray()[0];
    return r ? this.row(r) : null;
  }

  list(collection) {
    return this.sql.exec('SELECT * FROM items WHERE collection = ? ORDER BY created', collection).toArray().map((r) => this.row(r));
  }

  write(collection, id, data, created) {
    const t = this.now();
    const { id: _i, created: _c, updated: _u, ...body } = data;
    this.sql.exec(
      'INSERT INTO items (collection, id, data, created, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
      collection,
      id,
      JSON.stringify(body),
      created ?? t,
      t,
    );
    return this.get(collection, id);
  }

  /** Everything, for the landlord's screen; old closed applications are cleared out first. */
  all() {
    this.purge();
    return Object.fromEntries(COLLECTIONS.map((c) => [c, c === 'settings' ? (this.get('settings', 'main') ?? {}) : this.list(c)]));
  }

  purge() {
    const cutoff = this.now() - KEEP_CLOSED_DAYS * DAY;
    for (const a of this.list('applications')) if ((a.status === 'declined' || a.status === 'withdrawn') && a.updated < cutoff) this.remove('applications', a.id);
    for (const s of this.list('slots')) if (s.status === 'open' && Date.parse(s.start) < this.now() - 30 * DAY) this.remove('slots', s.id);
  }

  create(collection, input) {
    if (!COLLECTIONS.includes(collection) || collection === 'settings') throw new StoreError(404, 'Unknown kind of record.');
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM items WHERE collection = ?', collection).toArray()[0].n;
    if (n >= MAX_ITEMS) throw new StoreError(413, 'Too many records of this kind.');
    const data = clean(collection, input);
    if (collection === 'units') data.repairToken = randomToken(12);
    if (collection === 'slots') {
      if (!data.start || !data.listingId) throw new StoreError(400, 'A viewing slot needs a listing and a start time.');
      data.status = 'open';
      data.applicationId = '';
    }
    if (collection === 'applications') data.token = randomToken(18);
    return this.write(collection, newId(), data);
  }

  update(collection, id, patch) {
    if (collection === 'settings') return this.write('settings', 'main', { ...(this.get('settings', 'main') ?? {}), ...clean('settings', patch) });
    const old = this.get(collection, id);
    if (!old) throw new StoreError(404, 'Not found.');
    const changes = clean(collection, patch);
    if (collection === 'slots') {
      // Booking state moves only through applications.
      delete changes.status;
      delete changes.applicationId;
    }
    const next = this.write(collection, id, { ...old, ...changes }, old.created);
    if (collection === 'applications' && changes.status && changes.status !== old.status) this.applicationMoved(next);
    return this.get(collection, id);
  }

  /** An application's viewing slot follows its status: booked once confirmed, freed if it closes. */
  applicationMoved(app) {
    const slot = app.slotId ? this.get('slots', app.slotId) : null;
    if (!slot || slot.applicationId !== app.id) return;
    if (app.status === 'viewing' || app.status === 'approved') this.write('slots', slot.id, { ...slot, status: 'booked' }, slot.created);
    if (app.status === 'declined' || app.status === 'withdrawn') this.write('slots', slot.id, { ...slot, status: 'open', applicationId: '' }, slot.created);
  }

  remove(collection, id) {
    const old = this.get(collection, id);
    if (!old) return false;
    this.sql.exec('DELETE FROM items WHERE collection = ? AND id = ?', collection, id);
    if (collection === 'applications' && old.slotId) {
      const slot = this.get('slots', old.slotId);
      if (slot?.applicationId === id) this.write('slots', slot.id, { ...slot, status: 'open', applicationId: '' }, slot.created);
    }
    if (collection === 'slots' && old.applicationId) {
      const app = this.get('applications', old.applicationId);
      if (app) this.write('applications', app.id, { ...app, slotId: '' }, app.created);
    }
    if (collection === 'listings') for (const s of this.list('slots')) if (s.listingId === id && s.status === 'open') this.remove('slots', s.id);
    return true;
  }

  /** Move an application to another open slot (or none). */
  moveSlot(appId, slotId) {
    const app = this.get('applications', appId);
    if (!app) throw new StoreError(404, 'Not found.');
    const slot = slotId ? this.get('slots', slotId) : null;
    if (slotId && (!slot || slot.status !== 'open')) throw new StoreError(409, 'That time is no longer open.');
    const old = app.slotId ? this.get('slots', app.slotId) : null;
    if (old?.applicationId === appId) this.write('slots', old.id, { ...old, status: 'open', applicationId: '' }, old.created);
    if (slot) this.write('slots', slot.id, { ...slot, status: app.status === 'viewing' ? 'booked' : 'held', applicationId: appId }, slot.created);
    return this.write('applications', appId, { ...app, slotId: slot ? slot.id : '' }, app.created);
  }

  // ---- public ----

  settingsPublic(withContact) {
    const s = this.get('settings', 'main') ?? {};
    return { name: s.name || 'The landlord', ...(withContact ? { email: s.email || '', phone: s.phone || '' } : {}) };
  }

  openSlots(listingId) {
    const soon = this.now() + 60 * 60000; // not within the next hour
    return this.list('slots')
      .filter((s) => s.listingId === listingId && s.status === 'open' && Date.parse(s.start) > soon)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((s) => ({ id: s.id, start: s.start, minutes: s.minutes || 30 }));
  }

  publicListing(listingId) {
    const l = this.get('listings', listingId);
    if (!l || l.active === false) throw new StoreError(404, 'This listing isn’t taking applications.');
    const { title, area, rent, beds, baths, available, utilities, parking, details } = l;
    return { listing: { id: l.id, title, area, rent, beds, baths, available, utilities, parking, details }, slots: this.openSlots(listingId), landlord: this.settingsPublic(false) };
  }

  apply(listingId, input, ip) {
    this.limit(ip, 'apply', 5);
    if (input?.website) throw new StoreError(400, 'Something went wrong.'); // a form field people can't see: bots fill it in
    this.publicListing(listingId); // must be open
    const data = clean('applications', input, APPLY_FIELDS);
    if (!data.name) throw new StoreError(400, 'Add your name.');
    if (!data.email && !data.phone) throw new StoreError(400, 'Add an email or phone number so the landlord can reach you.');
    if (data.email && !EMAIL.test(data.email)) throw new StoreError(400, 'That email doesn’t look right.');
    let slot = null;
    if (input.slotId) {
      slot = this.get('slots', String(input.slotId));
      if (!slot || slot.listingId !== listingId || slot.status !== 'open' || Date.parse(slot.start) <= this.now()) throw new StoreError(409, 'Someone just took that time. Pick another.');
    }
    const app = this.create('applications', { ...data, listingId, status: 'new', read: false });
    if (slot) {
      this.write('slots', slot.id, { ...slot, status: 'held', applicationId: app.id }, slot.created);
      this.write('applications', app.id, { ...app, slotId: slot.id }, app.created);
    }
    return { token: app.token };
  }

  appByToken(token) {
    if (typeof token !== 'string' || token.length < 10) return null;
    return this.list('applications').find((a) => sameText(a.token, token)) ?? null;
  }

  status(token) {
    const a = this.appByToken(token);
    if (!a) throw new StoreError(404, 'We couldn’t find that application.');
    const l = this.get('listings', a.listingId);
    const slot = a.slotId ? this.get('slots', a.slotId) : null;
    const confirmed = a.status === 'viewing' || a.status === 'approved';
    return {
      status: a.status,
      name: a.name,
      listing: l ? { title: l.title, area: l.area, address: confirmed ? l.address : '' } : null,
      viewing: slot ? { start: slot.start, minutes: slot.minutes || 30, confirmed: slot.status === 'booked' } : null,
      note: a.note || '',
      landlord: this.settingsPublic(confirmed),
      slots: a.status === 'new' && l ? this.openSlots(l.id) : [],
    };
  }

  /** The applicant cancels, or picks another time while the landlord hasn't confirmed one. */
  applicantAction(token, action, slotId, ip) {
    this.limit(ip, 'status', 30);
    const a = this.appByToken(token);
    if (!a) throw new StoreError(404, 'We couldn’t find that application.');
    if (action === 'withdraw') this.update('applications', a.id, { status: 'withdrawn' });
    else if (action === 'reschedule' && a.status === 'new') this.moveSlot(a.id, slotId || '');
    else throw new StoreError(400, 'That can’t be changed now.');
    return this.status(token);
  }

  unitByToken(unitId, token) {
    const u = this.get('units', unitId);
    if (!u || !sameText(u.repairToken, token)) throw new StoreError(404, 'This repair link isn’t valid. Ask your landlord for a new one.');
    return u;
  }

  repairInfo(unitId, token) {
    const u = this.unitByToken(unitId, token);
    return { unit: u.label || 'Your unit', landlord: this.settingsPublic(false) };
  }

  reportRepair(unitId, token, input, ip) {
    this.limit(ip, 'repair', 10);
    if (input?.website) throw new StoreError(400, 'Something went wrong.');
    this.unitByToken(unitId, token);
    const data = clean('maintenance', input, REPAIR_FIELDS);
    if (!data.title) throw new StoreError(400, 'Say what needs fixing.');
    this.create('maintenance', { ...data, unitId, status: 'reported', urgency: data.urgency || 'normal', read: false });
    return { ok: true };
  }
}
