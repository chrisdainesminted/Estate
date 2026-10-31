// A Bedrock account: someone's numbers, deals and listing alerts, kept so
// they follow them to every device. There's no password: the account opens
// with a private link, and only a hash of its key is stored. An email is
// optional and only for alerts, confirmed with a code before anything is
// sent to it.

import { StoreError, hashKey } from './store.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MAX_DATA = 1_500_000; // characters of saved library
const MAX_ALERTS = 10;
const CITY = /^[a-z-]{2,30}$/;
const TYPES = ['single', 'small', 'large'];

function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** An alert kept to what it may hold: a city, property types, and the most it may cost. */
export function cleanAlert(a, i = 0) {
  if (!a || typeof a !== 'object' || typeof a.city !== 'string' || !CITY.test(a.city)) return null;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  const types = (Array.isArray(a.types) ? a.types : TYPES).filter((t) => TYPES.includes(t));
  return {
    id: typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(a.id) ? a.id : `a${Date.now().toString(36)}${i}`,
    city: a.city,
    types: types.length ? types : TYPES,
    maxPrice: n(a.maxPrice),
    maxLive: n(a.maxLive), // the most it may cost to live in, a month
    minPerDoor: Number.isFinite(Number(a.minPerDoor)) && a.minPerDoor !== '' && a.minPerDoor != null ? Math.round(Number(a.minPerDoor)) : null,
    since: typeof a.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.since) ? a.since : new Date().toISOString().slice(0, 10),
  };
}

export class AccountStore {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
  }

  meta(k) {
    return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v ?? null;
  }

  setMeta(k, v) {
    this.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, String(v));
  }

  get ready() {
    return Boolean(this.meta('keyHash'));
  }

  init(keyHash) {
    if (this.ready) throw new StoreError(409, 'That account already exists.');
    this.setMeta('keyHash', keyHash);
    this.setMeta('created', this.now());
  }

  async checkKey(key) {
    if (!this.ready) throw new StoreError(404, 'There’s no account at this link.');
    if (!sameText(this.meta('keyHash'), await hashKey(key))) throw new StoreError(401, 'This account link isn’t right.');
  }

  /** Everything the app needs on load. */
  read() {
    const data = this.meta('data');
    return {
      data: data ? JSON.parse(data) : null,
      updatedAt: Number(this.meta('updatedAt') || 0),
      alerts: this.alerts(),
      email: this.meta('email') || '',
      emailVerified: this.meta('emailVerified') === '1',
    };
  }

  /** Save the library if it's newer than what's kept (the newest edit wins). */
  write(data, updatedAt) {
    const at = Number(updatedAt) || 0;
    const body = JSON.stringify(data ?? null);
    if (body.length > MAX_DATA) throw new StoreError(413, 'That’s more than an account can hold.');
    if (at < Number(this.meta('updatedAt') || 0)) return { updatedAt: Number(this.meta('updatedAt')), stale: true };
    this.setMeta('data', body);
    this.setMeta('updatedAt', at);
    return { updatedAt: at, stale: false };
  }

  alerts() {
    const raw = this.meta('alerts');
    return raw ? JSON.parse(raw) : [];
  }

  setAlerts(list) {
    const alerts = (Array.isArray(list) ? list : []).slice(0, MAX_ALERTS).map(cleanAlert).filter(Boolean);
    this.setMeta('alerts', JSON.stringify(alerts));
    return alerts;
  }

  // ---- email for alerts ----

  async startEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(e)) throw new StoreError(400, 'Enter an email address.');
    const hour = Math.floor(this.now() / 3600000);
    const sent = this.meta(`codes:${hour}`) ? Number(this.meta(`codes:${hour}`)) : 0;
    if (sent >= 5) throw new StoreError(429, 'Too many codes this hour. Try again later.');
    this.setMeta(`codes:${hour}`, sent + 1);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    this.setMeta('pendingEmail', e);
    this.setMeta('codeHash', await hashKey(`${e}:${code}`));
    this.setMeta('codeUntil', this.now() + 15 * 60000);
    this.setMeta('codeTries', 0);
    return { email: e, code };
  }

  async finishEmail(code) {
    const e = this.meta('pendingEmail') || '';
    const tries = Number(this.meta('codeTries') || 0) + 1;
    this.setMeta('codeTries', tries);
    if (!e || tries > 5 || Number(this.meta('codeUntil') || 0) < this.now()) throw new StoreError(400, 'That code has expired. Send a new one.');
    if (!sameText(this.meta('codeHash'), await hashKey(`${e}:${String(code).trim()}`))) throw new StoreError(400, 'That code isn’t right.');
    this.setMeta('email', e);
    this.setMeta('emailVerified', '1');
    this.setMeta('codeHash', '');
    return this.read();
  }

  dropEmail() {
    this.setMeta('email', '');
    this.setMeta('emailVerified', '0');
    return this.read();
  }

  /** The date alerts were last emailed (YYYY-MM-DD), so each digest covers only what's new. */
  lastSent() {
    return this.meta('lastSent') || '';
  }

  markSent(date) {
    this.setMeta('lastSent', date);
  }

  /** Forget everything: the account link stops working. */
  wipe() {
    this.sql.exec('DELETE FROM meta');
    return { ok: true };
  }
}
