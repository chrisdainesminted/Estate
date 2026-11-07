// Squarely accounts in Supabase: who's signed in (a Supabase Auth access
// token, checked here), and their saved data in Supabase Postgres (see
// supabase/migrations). The browser signs in with Supabase directly; it
// sends its access token to /api/me, and this server reads and writes the
// person's rows with the service role key, after checking and cleaning
// what's saved. Turned on by three settings in Cloudflare:
//
// - SUPABASE_URL: the project's URL, https://<ref>.supabase.co
// - SUPABASE_ANON_KEY: its anon (publishable) key, which the browser uses to sign in
// - SUPABASE_SERVICE_ROLE_KEY: its service role (secret) key, a secret, used only here
//
// Optional: SUPABASE_JWT_SECRET, for projects that still sign tokens with a
// shared secret. Without it such tokens are checked by asking Supabase.

import { StoreError, hashKey } from './store.js';
import { EMAIL, SECTIONS, cleanAlert, plusActive } from './account.js';

const MAX_DATA = 1_500_000; // characters of saved library
const MAX_ALERTS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const supabaseOn = (env) => Boolean(env?.SUPABASE_URL && env?.SUPABASE_ANON_KEY && env?.SUPABASE_SERVICE_ROLE_KEY);
const base = (env) => String(env.SUPABASE_URL).replace(/\/+$/, '');

/** What the browser needs to sign in: the project's URL and its public key. */
export const supabasePublic = (env) => (supabaseOn(env) ? { url: base(env), anonKey: String(env.SUPABASE_ANON_KEY) } : null);

/** Login emails given Plus for good (the PLUS_EMAILS setting). */
export const compEmails = (env) => new Set(String(env?.PLUS_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));

export const isUuid = (v) => typeof v === 'string' && UUID.test(v);

function unb64url(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

// ---- who's signed in ----

let jwks = { url: '', at: 0, keys: [] };
async function signingKeys(env, fetcher, now, fresh = false) {
  const url = `${base(env)}/auth/v1/.well-known/jwks.json`;
  if (!fresh && jwks.url === url && now - jwks.at < 10 * 60000) return jwks.keys;
  const res = await fetcher(url).catch(() => null);
  const keys = res?.ok ? ((await res.json().catch(() => ({})))?.keys ?? []) : [];
  jwks = { url, at: now, keys };
  return keys;
}

/** For tests: forget the signing keys fetched so far. */
export function resetKeyCache() {
  jwks = { url: '', at: 0, keys: [] };
  asked.clear();
}

const VERIFY = {
  ES256: { key: { name: 'ECDSA', namedCurve: 'P-256' }, sig: { name: 'ECDSA', hash: 'SHA-256' } },
  RS256: { key: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, sig: { name: 'RSASSA-PKCS1-v1_5' } },
};

// Tokens Supabase vouched for, for a minute, when they can't be checked here.
const asked = new Map();

/**
 * The person an access token belongs to: { id, email }. Checked against the
 * project's published signing keys (or its shared secret) without a network
 * call when possible; otherwise Supabase is asked. Throws 401 when it's not
 * a live token for a signed-in person of this project.
 */
export async function verifyUser(env, token, { fetcher = fetch, now = Date.now() } = {}) {
  const bad = new StoreError(401, 'You’ve been signed out. Sign in again.');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw bad;
  let header;
  let claims;
  try {
    header = JSON.parse(dec.decode(unb64url(parts[0])));
    claims = JSON.parse(dec.decode(unb64url(parts[1])));
  } catch {
    throw bad;
  }
  const signed = enc.encode(`${parts[0]}.${parts[1]}`);
  let checked = false;
  if (VERIFY[header.alg]) {
    const find = (keys) => keys.find((k) => k.kid === header.kid && (k.alg ?? header.alg) === header.alg);
    const valid = async (jwk) => {
      const { key_ops: _ops, ...pub } = jwk;
      const key = await crypto.subtle.importKey('jwk', pub, VERIFY[header.alg].key, false, ['verify']).catch(() => null);
      return Boolean(key) && crypto.subtle.verify(VERIFY[header.alg].sig, key, unb64url(parts[2]), signed);
    };
    let jwk = find(await signingKeys(env, fetcher, now));
    let ok = jwk ? await valid(jwk) : false;
    // A key this server hasn't seen yet (Supabase rotated its keys): look again, at most every 30 seconds.
    if (!ok && now - jwks.at > 30000) {
      jwk = find(await signingKeys(env, fetcher, now, true));
      ok = jwk ? await valid(jwk) : false;
    }
    if (jwk && !ok) throw bad;
    checked = ok;
  } else if (header.alg === 'HS256' && env.SUPABASE_JWT_SECRET) {
    const key = await crypto.subtle.importKey('raw', enc.encode(env.SUPABASE_JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('HMAC', key, unb64url(parts[2]), signed))) throw bad;
    checked = true;
  }
  if (checked) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!(Number(claims.exp) * 1000 > now) || claims.iss !== `${base(env)}/auth/v1` || !aud.includes('authenticated') || claims.role !== 'authenticated' || !isUuid(claims.sub)) throw bad;
    return { id: claims.sub, email: String(claims.email || '').toLowerCase() };
  }
  // A token this server can't check itself: Supabase says whose it is.
  const hit = asked.get(token);
  if (hit && hit.until > now) return hit.user;
  const res = await fetcher(`${base(env)}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res) throw new StoreError(502, 'Couldn’t reach the account service. Try again in a minute.');
  if (!res.ok) throw bad;
  const u = await res.json().catch(() => ({}));
  if (!isUuid(u.id)) throw bad;
  const user = { id: u.id, email: String(u.email || '').toLowerCase() };
  if (asked.size > 500) asked.clear();
  asked.set(token, { user, until: Math.min(now + 60000, Number(claims.exp) * 1000 || now + 60000) });
  return user;
}

// ---- the database ----

/** A small client for the project's REST API (PostgREST) and Auth admin API, with the service role key. */
export function supabaseDb(env, fetcher = fetch) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY);
  // Legacy keys are tokens and go in both headers; newer secret keys (sb_secret_…) only as apikey.
  const auth = key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {};
  async function call(method, path, body, prefer) {
    const res = await fetcher(`${base(env)}${path}`, {
      method,
      headers: { apikey: key, ...auth, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(prefer ? { prefer } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res) throw new StoreError(502, 'Couldn’t reach the account database. Try again in a minute.');
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      if (data?.code === '23505') throw new StoreError(409, 'That’s already saved to another account.');
      if (data?.code === '23503') throw new StoreError(404, 'That account no longer exists.');
      console.error('supabase', method, path.split('?')[0], res.status, data?.message || text.slice(0, 200));
      throw new StoreError(502, 'The account database didn’t answer. Try again in a minute.');
    }
    return data;
  }
  const q = (filters) => new URLSearchParams(filters).toString();
  return {
    select: (table, filters) => call('GET', `/rest/v1/${table}?${q(filters)}`),
    insert: (table, row, { ignore = false } = {}) => call('POST', `/rest/v1/${table}${ignore ? '?on_conflict=user_id' : ''}`, row, ignore ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal'),
    upsert: (table, row) => call('POST', `/rest/v1/${table}?on_conflict=user_id`, row, 'resolution=merge-duplicates,return=minimal'),
    update: (table, filters, patch) => call('PATCH', `/rest/v1/${table}?${q(filters)}`, patch, 'return=minimal'),
    rpc: (fn, args) => call('POST', `/rest/v1/rpc/${fn}`, args),
    deleteUser: (id) => call('DELETE', `/auth/v1/admin/users/${encodeURIComponent(id)}`),
  };
}

const remindOn = (data) => data?.settings?.home?.remindReady === true && typeof data?.settings?.home?.readyBy === 'string';
const SECTION_NAMES = Object.keys(SECTIONS);

/**
 * One signed-in person's account, in the same shapes the older account
 * (account.js) uses, so the app can't tell them apart.
 */
export class MeStore {
  constructor(db, user, { comp = new Set(), now = () => Date.now() } = {}) {
    this.db = db;
    this.user = user;
    this.comp = comp;
    this.now = now;
    this.id = { user_id: `eq.${user.id}` };
    this.row = null;
    this.sub = undefined;
  }

  /** The account row, made on first use (a sign-up from before the database had its trigger). */
  async load() {
    if (this.row) return this.row;
    let row = (await this.db.select('accounts', { ...this.id, select: '*' }))?.[0];
    if (!row) {
      await this.db.insert('accounts', { user_id: this.user.id, login_email: this.user.email }, { ignore: true });
      row = (await this.db.select('accounts', { ...this.id, select: '*' }))?.[0];
      if (!row) throw new StoreError(502, 'Couldn’t open your account. Try again in a minute.');
    }
    if (this.user.email && row.login_email !== this.user.email) {
      await this.db.update('accounts', this.id, { login_email: this.user.email });
      row.login_email = this.user.email;
    }
    this.row = row;
    return row;
  }

  async plus() {
    if (this.sub === undefined) this.sub = (await this.db.select('subscriptions', { ...this.id, select: '*' }))?.[0] ?? null;
    const s = this.sub;
    return s ? { status: s.status, customer: s.customer, subscription: s.subscription, until: Number(s.until) || 0, cancelAt: Number(s.cancel_at) || 0 } : {};
  }

  async setPlus(patch) {
    const p = { ...(await this.plus()), ...patch };
    const row = { user_id: this.user.id, status: p.status || '', customer: p.customer || '', subscription: p.subscription || '', until: Number(p.until) || 0, cancel_at: Number(p.cancelAt) || 0 };
    await this.db.upsert('subscriptions', row);
    this.sub = row;
    return p;
  }

  get compPlus() {
    return Boolean(this.user.email) && this.comp.has(this.user.email);
  }

  async isPlus() {
    return this.compPlus || plusActive(await this.plus(), this.now());
  }

  /** Everything the app needs on load. */
  async read() {
    const r = await this.load();
    const p = await this.plus();
    return {
      data: r.library ?? null,
      updatedAt: Number(r.library_updated_at) || 0,
      alerts: Array.isArray(r.alerts) ? r.alerts : [],
      email: r.alert_email || '',
      emailVerified: r.alert_email_verified === true,
      loginEmail: this.user.email,
      plus: { active: await this.isPlus(), comp: this.compPlus, status: p.status || '', until: p.until || 0, cancelAt: p.cancelAt || 0 },
      ...Object.fromEntries(SECTION_NAMES.map((k) => [k, r[k] ?? (k === 'profile' ? {} : [])])),
    };
  }

  /** Save the library if it's newer than what's kept (the newest edit wins). */
  async write(data, updatedAt) {
    const body = JSON.stringify(data ?? null);
    if (body.length > MAX_DATA) throw new StoreError(413, 'That’s more than an account can hold.');
    await this.load();
    const r = await this.db.rpc('squarely_write_library', { p_user: this.user.id, p_data: data ?? null, p_at: Number(updatedAt) || 0, p_remind: remindOn(data) });
    return { updatedAt: Number(r?.updatedAt) || 0, stale: r?.stale === true };
  }

  async setSection(name, value) {
    if (!SECTIONS[name]) throw new StoreError(404, 'Unknown section.');
    const clean = SECTIONS[name](value);
    if (JSON.stringify(clean).length > 200_000) throw new StoreError(413, 'That’s more than an account can hold.');
    await this.load();
    await this.db.update('accounts', this.id, { [name]: clean });
    return clean;
  }

  async setAlerts(list) {
    const alerts = (Array.isArray(list) ? list : []).slice(0, MAX_ALERTS).map(cleanAlert).filter(Boolean);
    await this.load();
    await this.db.update('accounts', this.id, { alerts });
    return alerts;
  }

  // ---- email for alerts, confirmed with a code ----

  async secrets() {
    let s = (await this.db.select('account_private', { ...this.id, select: '*' }))?.[0];
    if (!s) {
      await this.db.insert('account_private', { user_id: this.user.id }, { ignore: true });
      s = { pending_email: '', code_hash: '', code_until: 0, code_tries: 0, codes_hour: 0, codes_sent: 0 };
    }
    return s;
  }

  async startEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(e)) throw new StoreError(400, 'Enter an email address.');
    await this.load();
    const s = await this.secrets();
    const hour = Math.floor(this.now() / 3600000);
    const sent = Number(s.codes_hour) === hour ? Number(s.codes_sent) || 0 : 0;
    if (sent >= 5) throw new StoreError(429, 'Too many codes this hour. Try again later.');
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    await this.db.update('account_private', this.id, {
      pending_email: e,
      code_hash: await hashKey(`${e}:${code}`),
      code_until: this.now() + 15 * 60000,
      code_tries: 0,
      codes_hour: hour,
      codes_sent: sent + 1,
    });
    return { email: e, code };
  }

  async finishEmail(code) {
    await this.load();
    const s = await this.secrets();
    const e = s.pending_email || '';
    const tries = (Number(s.code_tries) || 0) + 1;
    await this.db.update('account_private', this.id, { code_tries: tries });
    if (!e || !s.code_hash || tries > 5 || Number(s.code_until) < this.now()) throw new StoreError(400, 'That code has expired. Send a new one.');
    if (s.code_hash !== (await hashKey(`${e}:${String(code).trim()}`))) throw new StoreError(400, 'That code isn’t right.');
    await this.db.update('account_private', this.id, { code_hash: '' });
    await this.db.update('accounts', this.id, { alert_email: e, alert_email_verified: true });
    Object.assign(this.row, { alert_email: e, alert_email_verified: true });
    return this.read();
  }

  async dropEmail() {
    await this.load();
    await this.db.update('accounts', this.id, { alert_email: '', alert_email_verified: false });
    Object.assign(this.row, { alert_email: '', alert_email_verified: false });
    return this.read();
  }

  /** At most `max` uses of something costly a day (reading blueprints, Ask Squarely). */
  async useDaily(name, max) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (!(await this.db.rpc('squarely_use', { p_user: this.user.id, p_name: name, p_max: max, p_day: day }))) throw new StoreError(429, `That’s ${max} today. Try again tomorrow.`);
  }

  /** Delete the person and everything saved to them (their rows go with their login). */
  async wipe() {
    await this.db.deleteUser(this.user.id);
    return { ok: true };
  }

  /**
   * Bring over an account from before Squarely used Supabase (`old` is what
   * that account's 'export' gives). The library: the newer one wins. Sections,
   * alerts and the alerts email: only where this account has none yet. Plus:
   * only when this account has no subscription. An old account moves once.
   */
  async importLegacy(legacyId, old) {
    const r = await this.load();
    if (r.legacy_id && r.legacy_id !== legacyId) throw new StoreError(409, 'This account already brought over a different one.');
    const patch = {};
    if (!r.legacy_id) patch.legacy_id = legacyId;
    for (const k of SECTION_NAMES) {
      const mine = r[k];
      const empty = k === 'profile' ? !mine || !Object.keys(mine).length : !Array.isArray(mine) || !mine.length;
      const theirs = SECTIONS[k](old?.[k]);
      if (empty && (k === 'profile' ? Object.keys(theirs).length : theirs.length)) patch[k] = theirs;
    }
    if (!(Array.isArray(r.alerts) && r.alerts.length) && Array.isArray(old?.alerts) && old.alerts.length) patch.alerts = old.alerts.slice(0, MAX_ALERTS).map(cleanAlert).filter(Boolean);
    if (!r.alert_email && old?.emailVerified && EMAIL.test(String(old.email || ''))) Object.assign(patch, { alert_email: old.email, alert_email_verified: true });
    if (old?.lastSent && /^\d{4}-\d{2}-\d{2}$/.test(old.lastSent) && !r.last_sent) patch.last_sent = old.lastSent;
    if (old?.readySent && !r.ready_sent) patch.ready_sent = String(old.readySent).slice(0, 20);
    if (Object.keys(patch).length) {
      await this.db.update('accounts', this.id, patch);
      Object.assign(r, patch);
    }
    const lib = old?.data != null ? await this.write(old.data, old.updatedAt) : null;
    const theirs = old?.plusRaw ?? {};
    const mine = await this.plus();
    if (!mine.status && !mine.customer && (theirs.status || theirs.customer)) await this.setPlus({ status: theirs.status || '', customer: theirs.customer || '', subscription: theirs.subscription || '', until: theirs.until || 0, cancelAt: theirs.cancelAt || 0 });
    return { ok: true, library: lib ? !lib.stale : false };
  }
}

/** The person whose Stripe subscription this is, by their user id or the older account it was bought on. */
export async function plusOwner(db, { user, account }) {
  if (isUuid(user)) return user;
  if (!account) return null;
  const row = (await db.select('accounts', { legacy_id: `eq.${account}`, select: 'user_id' }))?.[0];
  return row?.user_id ?? null;
}
