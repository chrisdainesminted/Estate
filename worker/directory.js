// Squarely's public listings: one shared index of the homes landlords and
// sellers chose to publish, searchable by kind, place, price and size.
// Each workspace sends its listing's summary here when it changes. People
// can report a listing; three reports from different addresses hide it
// until the site's owner reviews it. Listings not renewed in 60 days drop
// out of search.

import { StoreError } from './store.js';

const KEEP_DAYS = 60;
const HIDE_AT = 3;
const PAGE = 24;
const DAY = 86400000;
const INBOX_DAYS = 365;

/** Contact and broker forms */
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** What the contact and broker forms may send, trimmed; { error } if it's not enough to answer. */
export function cleanInbox(kind, b) {
  const name = clip(b.name, 100);
  const email = clip(b.email, 200);
  const phone = clip(b.phone, 40);
  if (!name) return { error: 'Add your name.' };
  if (!EMAIL.test(email)) return { error: 'Add an email address we can reply to.' };
  if (kind === 'contact') {
    const message = clip(b.message, 4000);
    if (message.length < 5) return { error: 'Add a message.' };
    return { name, email, topic: clip(b.topic, 40), message };
  }
  if (b.consent !== true) return { error: 'Tick the box so we can pass your details to a broker.' };
  return { name, email, phone, city: clip(b.city, 60), timeline: clip(b.timeline, 40), price: Math.max(Number(b.price) || 0, 0), income: Math.max(Number(b.income) || 0, 0), note: clip(b.note, 1000), consent: true };
}

export const REPORT_REASONS = ['scam', 'not-available', 'wrong-info', 'discriminatory', 'other'];

export class DirectoryStore {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    sql.exec(
      'CREATE TABLE IF NOT EXISTS listings (key TEXT PRIMARY KEY, kind TEXT, province TEXT, city TEXT, price REAL, beds REAL, type TEXT, renewed INTEGER, data TEXT, reports INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0, cleared INTEGER DEFAULT 0)',
    );
    sql.exec('CREATE TABLE IF NOT EXISTS reports (key TEXT, ip TEXT, reason TEXT, note TEXT, at INTEGER, PRIMARY KEY (key, ip))');
    sql.exec('CREATE TABLE IF NOT EXISTS hits (bucket TEXT PRIMARY KEY, n INTEGER)');
    sql.exec('CREATE TABLE IF NOT EXISTS billed (ws TEXT PRIMARY KEY, charged TEXT)');
    // Addresses already turned into map points (lat null: looked up, not found), so each is asked about once.
    sql.exec('CREATE TABLE IF NOT EXISTS geo (q TEXT PRIMARY KEY, lat REAL, lng REAL, at INTEGER)');
    // Messages to the site's owner: contact-form notes and requests to talk to a mortgage broker.
    // Accounts with listing alerts and a confirmed email, for the daily digest.
    sql.exec('CREATE TABLE IF NOT EXISTS alerting (id TEXT PRIMARY KEY, sent TEXT)');
    sql.exec('CREATE TABLE IF NOT EXISTS inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, data TEXT, at INTEGER, done INTEGER DEFAULT 0)');
  }

  // ---- accounts that get alert emails ----

  setAlerting(id, on) {
    if (on) this.sql.exec('INSERT INTO alerting (id, sent) VALUES (?, ?) ON CONFLICT(id) DO NOTHING', id, '');
    else this.sql.exec('DELETE FROM alerting WHERE id = ?', id);
  }

  /** Up to `limit` accounts not yet sent a digest on `date`, oldest first. */
  dueAlerts(date, limit = 50) {
    return this.sql.exec('SELECT id FROM alerting WHERE sent < ? ORDER BY sent LIMIT ?', date, limit).toArray().map((r) => r.id);
  }

  markAlerted(id, date) {
    this.sql.exec('UPDATE alerting SET sent = ? WHERE id = ?', date, id);
  }

  // ---- the owner's inbox ----

  /** Keep a contact note or broker request; personal details are dropped after INBOX_DAYS. */
  addInbox(kind, data, ip) {
    this.limit(ip, `inbox-${kind}`, 5);
    this.sql.exec('INSERT INTO inbox (kind, data, at) VALUES (?, ?, ?)', kind, JSON.stringify(data), this.now());
    this.sql.exec('DELETE FROM inbox WHERE at < ?', this.now() - INBOX_DAYS * DAY);
    return { ok: true };
  }

  inbox() {
    return this.sql
      .exec('SELECT id, kind, data, at, done FROM inbox ORDER BY done, at DESC LIMIT 300')
      .toArray()
      .map((r) => ({ id: r.id, kind: r.kind, at: r.at, done: Boolean(r.done), ...JSON.parse(r.data) }));
  }

  inboxDone(id, done) {
    this.sql.exec('UPDATE inbox SET done = ? WHERE id = ?', done ? 1 : 0, Number(id));
    return { ok: true };
  }

  // ---- map points for listing addresses ----

  /** Known points for these addresses, and the ones never looked up. */
  geoGet(queries) {
    const known = {};
    const missing = [];
    for (const q of queries) {
      const row = this.sql.exec('SELECT lat, lng FROM geo WHERE q = ?', q).toArray()[0];
      if (!row) missing.push(q);
      else if (row.lat != null) known[q] = [row.lat, row.lng];
    }
    return { known, missing };
  }

  geoPut(q, point) {
    this.sql.exec('INSERT OR REPLACE INTO geo (q, lat, lng, at) VALUES (?, ?, ?, ?)', q, point?.[0] ?? null, point?.[1] ?? null, this.now());
  }

  // ---- landlords with a card on file, for the monthly charge ----

  addBilled(ws) {
    this.sql.exec('INSERT INTO billed (ws, charged) VALUES (?, ?) ON CONFLICT(ws) DO NOTHING', ws, '');
  }

  removeBilled(ws) {
    this.sql.exec('DELETE FROM billed WHERE ws = ?', ws);
  }

  /** Up to `limit` workspaces not yet charged for `month` (YYYY-MM). */
  dueBilling(month, limit = 20) {
    return this.sql.exec('SELECT ws FROM billed WHERE charged < ? ORDER BY charged LIMIT ?', month, limit).toArray().map((r) => r.ws);
  }

  markCharged(ws, month) {
    this.sql.exec('UPDATE billed SET charged = ? WHERE ws = ?', month, ws);
  }

  limit(ip, kind, max) {
    const hour = Math.floor(this.now() / 3600000);
    const bucket = `${kind}:${ip}:${hour}`;
    const n = (this.sql.exec('SELECT n FROM hits WHERE bucket = ?', bucket).toArray()[0]?.n ?? 0) + 1;
    if (n > max) throw new StoreError(429, 'Too many requests. Try again in an hour.');
    this.sql.exec('INSERT INTO hits (bucket, n) VALUES (?, ?) ON CONFLICT(bucket) DO UPDATE SET n = excluded.n', bucket, n);
    this.sql.exec('DELETE FROM hits WHERE bucket NOT LIKE ?', `%:${hour}`);
  }

  /** Add or refresh a listing (`province` from its city). A hidden listing stays hidden. */
  upsert(summary, province) {
    this.sql.exec(
      `INSERT INTO listings (key, kind, province, city, price, beds, type, renewed, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, province = excluded.province, city = excluded.city, price = excluded.price, beds = excluded.beds, type = excluded.type, renewed = excluded.renewed, data = excluded.data`,
      summary.key,
      summary.kind,
      province || '',
      summary.city || '',
      summary.price || 0,
      summary.beds || 0,
      summary.propertyType || '',
      summary.renewed || this.now(),
      JSON.stringify(summary),
    );
  }

  remove(key) {
    this.sql.exec('DELETE FROM listings WHERE key = ?', key);
    this.sql.exec('DELETE FROM reports WHERE key = ?', key);
  }

  /** One page of matching listings, newest first unless sorted by price. */
  search({ kind = 'rent', province, city, maxPrice, minPrice, minBeds, type, sort = 'new', page = 1 } = {}) {
    const where = ['hidden = 0', 'renewed > ?', 'kind = ?'];
    const args = [this.now() - KEEP_DAYS * DAY, kind === 'sale' ? 'sale' : 'rent'];
    const add = (clause, value) => {
      where.push(clause);
      args.push(value);
    };
    if (city) add('city = ?', city);
    else if (province) add('province = ?', province);
    if (Number(maxPrice) > 0) add('price <= ?', Number(maxPrice));
    if (Number(minPrice) > 0) add('price >= ?', Number(minPrice));
    if (Number(minBeds) > 0) add('beds >= ?', Number(minBeds));
    if (type) add('type = ?', type);
    const order = sort === 'price' ? 'price ASC' : sort === 'price-desc' ? 'price DESC' : 'renewed DESC';
    const total = this.sql.exec(`SELECT COUNT(*) AS n FROM listings WHERE ${where.join(' AND ')}`, ...args).toArray()[0].n;
    const p = Math.max(Math.floor(Number(page) || 1), 1);
    const rows = this.sql.exec(`SELECT data FROM listings WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, PAGE, (p - 1) * PAGE).toArray();
    return { total, page: p, pages: Math.max(Math.ceil(total / PAGE), 1), items: rows.map((r) => JSON.parse(r.data)) };
  }

  report(key, ip, reason, note) {
    this.limit(ip, 'report', 10);
    const row = this.sql.exec('SELECT reports, cleared FROM listings WHERE key = ?', key).toArray()[0];
    if (!row) throw new StoreError(404, 'That listing is gone.');
    const r = REPORT_REASONS.includes(reason) ? reason : 'other';
    const fresh = this.sql.exec('SELECT 1 AS x FROM reports WHERE key = ? AND ip = ?', key, ip).toArray().length === 0;
    if (!fresh) return { ok: true };
    this.sql.exec('INSERT INTO reports (key, ip, reason, note, at) VALUES (?, ?, ?, ?, ?)', key, ip, r, String(note || '').slice(0, 500), this.now());
    const n = row.reports + 1;
    // After the owner clears a listing, it takes fresh reports to hide it again.
    this.sql.exec('UPDATE listings SET reports = ?, hidden = CASE WHEN ? >= ? THEN 1 ELSE hidden END WHERE key = ?', n, n - row.cleared, HIDE_AT, key);
    return { ok: true };
  }

  /** For the site's owner: listings with reports, hidden ones first. */
  reported() {
    return this.sql
      .exec('SELECT key, reports, hidden, data FROM listings WHERE reports > cleared ORDER BY hidden DESC, reports DESC LIMIT 200')
      .toArray()
      .map((r) => ({
        ...JSON.parse(r.data),
        reports: r.reports,
        hidden: Boolean(r.hidden),
        reasons: this.sql.exec('SELECT reason, note, at FROM reports WHERE key = ? ORDER BY at DESC LIMIT 20', r.key).toArray(),
      }));
  }

  /** Keep a reviewed listing up (clearing its reports) or take it down. */
  review(key, keep) {
    if (keep) this.sql.exec('UPDATE listings SET hidden = 0, cleared = reports WHERE key = ?', key);
    else this.sql.exec('UPDATE listings SET hidden = 1, cleared = reports WHERE key = ?', key);
    return { ok: true };
  }
}
