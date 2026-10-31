// Email-and-password sign-in for Squarely accounts. A login record maps an
// email (stored only as a hash) to an account. The password is never kept:
// only a PBKDF2 hash to check it, and the account's key sealed with a second
// key derived from the password, so the record alone can't open the account.

import { StoreError } from './store.js';

const ITERATIONS = 100000; // the most Workers allow for PBKDF2
const MIN_PASSWORD = 8;
const MAX_FAILS = 10; // wrong passwords in a row before a 15-minute pause
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export const normalEmail = (email) => String(email || '').trim().toLowerCase();

async function sha(text) {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function pbkdf2(password, salt, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS };
  if (usage === 'bits') return b64(await crypto.subtle.deriveBits(params, base, 256));
  return crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD) throw new StoreError(400, `Use at least ${MIN_PASSWORD} characters for your password.`);
  if (p.length > 200) throw new StoreError(400, 'That password is too long.');
  return p;
}

export class LoginStore {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    sql.exec(
      'CREATE TABLE IF NOT EXISTS logins (email TEXT PRIMARY KEY, account TEXT, hash TEXT, salt TEXT, keySalt TEXT, iv TEXT, sealed TEXT, fails INTEGER DEFAULT 0, pausedUntil INTEGER DEFAULT 0, created INTEGER)',
    );
    // Password resets: a one-time token (only its hash is kept) that expires in an hour.
    for (const col of ['resetHash TEXT', 'resetUntil INTEGER DEFAULT 0', 'resetSentAt INTEGER DEFAULT 0']) {
      try {
        sql.exec(`ALTER TABLE logins ADD COLUMN ${col}`);
      } catch {
        // Already there.
      }
    }
  }

  async row(email) {
    return this.sql.exec('SELECT * FROM logins WHERE email = ?', await sha(normalEmail(email))).toArray()[0] ?? null;
  }

  async seal(email, password, account) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keySalt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const hash = await pbkdf2(password, salt, 'bits');
    const key = await pbkdf2(password, keySalt, 'key');
    const sealed = b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(account.key)));
    return { email: await sha(normalEmail(email)), account: account.id, hash, salt: b64(salt), keySalt: b64(keySalt), iv: b64(iv), sealed };
  }

  /** A new login for an account. One login per email. */
  async signup(email, password, account) {
    if (!EMAIL.test(normalEmail(email))) throw new StoreError(400, 'Enter your email address.');
    checkPassword(password);
    if (await this.row(email)) throw new StoreError(409, 'There’s already an account with that email. Sign in instead.');
    const r = await this.seal(email, password, account);
    this.sql.exec(
      'INSERT INTO logins (email, account, hash, salt, keySalt, iv, sealed, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      r.email,
      r.account,
      r.hash,
      r.salt,
      r.keySalt,
      r.iv,
      r.sealed,
      this.now(),
    );
    return { id: account.id };
  }

  /** The account { id, key } for a right email and password. */
  async login(email, password) {
    const row = await this.row(email);
    const wrong = new StoreError(401, 'That email and password don’t match.');
    if (!row) {
      await pbkdf2(String(password || 'x'), new Uint8Array(16), 'bits'); // same time either way
      throw wrong;
    }
    if (row.pausedUntil > this.now()) throw new StoreError(429, 'Too many tries. Wait 15 minutes, then try again.');
    const hash = await pbkdf2(String(password || ''), unb64(row.salt), 'bits');
    if (!sameText(hash, row.hash)) {
      const fails = row.fails + 1;
      this.sql.exec('UPDATE logins SET fails = ?, pausedUntil = ? WHERE email = ?', fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? this.now() + 15 * 60000 : 0, row.email);
      throw wrong;
    }
    this.sql.exec('UPDATE logins SET fails = 0, pausedUntil = 0 WHERE email = ?', row.email);
    const key = await pbkdf2(String(password), unb64(row.keySalt), 'key');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(row.iv) }, key, unb64(row.sealed));
    return { id: row.account, key: new TextDecoder().decode(plain) };
  }

  async changePassword(email, password, next) {
    const account = await this.login(email, password);
    checkPassword(next);
    const r = await this.seal(email, next, account);
    this.sql.exec('UPDATE logins SET hash = ?, salt = ?, keySalt = ?, iv = ?, sealed = ? WHERE email = ?', r.hash, r.salt, r.keySalt, r.iv, r.sealed, r.email);
    return { ok: true };
  }

  /**
   * Start a reset: a one-time token for this email, or null when there's no
   * such login (the caller answers the same either way). At most one email
   * a minute per address.
   */
  async startReset(email) {
    const row = await this.row(email);
    if (!row) return null;
    if (row.resetSentAt > this.now() - 60000) throw new StoreError(429, 'We just sent a reset email. Check your inbox, or try again in a minute.');
    const token = b64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    this.sql.exec('UPDATE logins SET resetHash = ?, resetUntil = ?, resetSentAt = ? WHERE email = ?', await sha(`reset:${token}`), this.now() + 3600000, this.now(), row.email);
    return { token };
  }

  /**
   * Finish a reset with the emailed token and a new password. The old
   * password can't unseal the account's key, so `rekey(accountId)` gives
   * the account a new key, which is sealed with the new password.
   */
  async finishReset(email, token, password, rekey) {
    const row = await this.row(email);
    const bad = new StoreError(400, 'This reset link has expired or was already used. Ask for a new one.');
    if (!row || !row.resetHash || row.resetUntil < this.now()) throw bad;
    if (!sameText(row.resetHash, await sha(`reset:${String(token || '')}`))) throw bad;
    checkPassword(password);
    const key = await rekey(row.account);
    const r = await this.seal(email, password, { id: row.account, key });
    this.sql.exec(
      'UPDATE logins SET hash = ?, salt = ?, keySalt = ?, iv = ?, sealed = ?, resetHash = NULL, resetUntil = 0, fails = 0, pausedUntil = 0 WHERE email = ?',
      r.hash,
      r.salt,
      r.keySalt,
      r.iv,
      r.sealed,
      r.email,
    );
    return { id: row.account, key };
  }

  /** Remove the login for an account (when the account is deleted). */
  async remove(email) {
    this.sql.exec('DELETE FROM logins WHERE email = ?', await sha(normalEmail(email)));
  }
}
