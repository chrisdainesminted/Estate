// Bedrock's public listings: one shared index of the homes landlords and
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
