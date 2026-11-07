// A Squarely account on the website, and a small adapter that lets the deal
// library sync to it the same way it syncs to a Claude account on the hosted
// page: get, set, and a snapshot listener (here, polling while the tab is open).
//
// Two kinds of account, and the site's server says which one is on
// (/api/config):
// - Supabase: people sign in with Supabase Auth, and everything they save is
//   kept in Supabase's database through /api/me. `link` is then
//   { id, email, supabase: true } for the signed-in person.
// - Before Supabase: a private link ({ id, key }) kept in this browser, and
//   /api/a/<id>. An old link this browser still has is brought over to the
//   Supabase account the first time the person signs in.

import { siteConfig } from './siteConfig.js';

const KEY = 'bedrock-account'; // an account link from before Supabase
const SB_KEY = 'squarely-auth'; // the Supabase session (supabase-js keeps it here)
const CONFIG_KEY = 'squarely-supabase'; // the last config, so the mode is known before the server answers
const POLL = 60000;
const MIN_PASSWORD = 8;

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // Without storage the account still works for this visit.
    }
  },
};
const preferAccount = () => {
  try {
    sessionStorage.setItem('bedrock-prefer-account', '1');
  } catch {
    // Without it, the newer of the two wins as usual.
  }
};

// ---- which kind of account this site uses ----

let config; // undefined until the server answers; then { url, anonKey } or null
let ready = null;

function cachedConfig() {
  try {
    const c = JSON.parse(store.get(CONFIG_KEY) || 'null');
    return c?.url && c?.anonKey ? c : null;
  } catch {
    return null;
  }
}

/** Accounts are in Supabase on this site (as far as this page knows yet). */
export const usingSupabase = () => Boolean(config === undefined ? cachedConfig() : config);

/**
 * Ask the site's server which accounts it uses, once. Pages that need to know
 * before they show anything (the app, the account page) wait for this.
 */
export function initAccounts() {
  if (!ready) {
    ready = siteConfig().then((c) => {
      const before = usingSupabase();
      if (c && Object.keys(c).length) {
        config = c.supabase?.url && c.supabase?.anonKey ? c.supabase : null;
        store.set(CONFIG_KEY, config ? JSON.stringify(config) : null);
      } else {
        // The server didn't answer (offline, or the Claude page): keep what was known.
        config = cachedConfig();
      }
      grabLegacyFromAddress();
      // Arriving from an email link (confirm your email, reset your password): let Supabase read it.
      if (config && /(?:^#|&)(?:access_token|error_description)=/.test(window.location.hash)) client();
      if (usingSupabase() !== before) announce();
      return config;
    });
  }
  return ready;
}

// ---- the Supabase client, loaded only when it's needed ----

let clientPromise = null;
let recovering = false;
// Opened from an emailed "reset your password" link (read before Supabase takes it out of the address).
const fromResetEmail = typeof window !== 'undefined' && /(?:^#|&)type=recovery(?:&|$)/.test(window.location.hash);

function client() {
  if (!config) return Promise.reject(new Error('Accounts aren’t switched on here.'));
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      const sb = createClient(config.url, config.anonKey, {
        auth: { storageKey: SB_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      });
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          recovering = true;
          window.dispatchEvent(new CustomEvent('squarely-recovery'));
        }
        // Not inside the callback: Supabase asks that its own calls wait until it returns.
        setTimeout(() => {
          announce();
          if (session && event === 'SIGNED_IN') bringOver();
        }, 0);
      });
      return sb;
    });
  }
  return clientPromise;
}

/** Supabase's error, in Squarely's words. */
function friendly(error) {
  const m = String(error?.message || '');
  const code = String(error?.code || '');
  let text = m;
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) text = 'That email and password don’t match.';
  else if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) text = 'Confirm your email first: open the link we sent you, then sign in.';
  else if (code === 'user_already_exists' || /already registered/i.test(m)) text = 'There’s already an account with that email. Sign in instead.';
  else if (code === 'weak_password' || /password should/i.test(m)) text = `Use at least ${MIN_PASSWORD} characters for your password, with letters and numbers.`;
  else if (code === 'same_password') text = 'That’s your current password. Choose a new one.';
  else if (error?.status === 429 || /rate limit|too many/i.test(m)) text = 'Too many tries. Wait a few minutes, then try again.';
  else if (/failed to fetch|network/i.test(m)) text = 'Couldn’t reach Squarely. Check your connection and try again.';
  else if (!text) text = 'Something went wrong. Try again in a minute.';
  const e = new Error(text);
  e.status = error?.status;
  return e;
}

function checkPassword(password) {
  if (String(password || '').length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters for your password.`);
}

let lastLink = null;
function sessionLink() {
  try {
    const s = JSON.parse(store.get(SB_KEY) || 'null');
    const u = s?.user;
    if (!u?.id || !s?.refresh_token) return null;
    const email = String(u.email || '').toLowerCase();
    if (lastLink?.id !== u.id || lastLink.email !== email) lastLink = { id: u.id, email, supabase: true };
    return lastLink;
  } catch {
    return null;
  }
}

async function accessToken() {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || null;
}

/** Where an email link should bring someone back to: the account page, then on to where they were going. */
function comeBackTo(extra = '') {
  const here = window.location;
  const next = here.pathname.startsWith('/app') ? `${here.pathname}${here.search}` : new URLSearchParams(here.search).get('next');
  const q = new URLSearchParams();
  if (next) q.set('next', next);
  if (extra) q.set(extra, '1');
  const s = q.toString();
  return `${here.origin}/account/${s ? `?${s}` : ''}`;
}

// ---- the older accounts' links ----

function legacyLink() {
  const saved = store.get(KEY);
  if (!saved) return null;
  const [id, key] = saved.split('.');
  return id && key ? { id, key } : null;
}

/** An account link in the address (#account=id.key) is kept in this browser and taken out of the address. */
function grabLegacyFromAddress() {
  if (typeof window === 'undefined') return;
  try {
    const m = /(?:^|[#&])account=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{16,128})/.exec(window.location.hash);
    if (!m) return;
    store.set(KEY, `${m[1]}.${m[2]}`);
    const rest = window.location.hash.replace(/(?:^#|&)account=[^&]*/, '').replace(/^#?&/, '#');
    window.history.replaceState(null, '', window.location.pathname + window.location.search + (rest === '#' ? '' : rest));
  } catch {
    // Left in the address; nothing else changes.
  }
}

// ---- the signed-in account ----

/** The signed-in account in this browser, or null. */
export function accountLink() {
  if (typeof window === 'undefined') return null;
  if (usingSupabase()) {
    grabLegacyFromAddress();
    return sessionLink();
  }
  grabLegacyFromAddress();
  return legacyLink();
}

/** The same account (so a re-read that changed nothing doesn't reconnect anything). */
export const sameLink = (a, b) => a === b || (Boolean(a) && Boolean(b) && a.id === b.id && a.key === b.key && a.email === b.email);

export function saveAccountLink(link) {
  store.set(KEY, link ? `${link.id}.${link.key}` : null);
}

/** The backup link for an older account (Supabase accounts sign in with a password instead). */
export const accountUrl = (link) => (link?.key ? `${window.location.origin}/app/#account=${link.id}.${link.key}` : '');

export async function accountCall(link, path = '', { method = 'GET', body } = {}) {
  let url;
  let auth;
  if (link?.supabase) {
    const token = await accessToken().catch(() => null);
    if (!token) {
      const err = new Error('You’ve been signed out. Sign in again.');
      err.status = 401;
      throw err;
    }
    url = `/api/me${path}`;
    auth = token;
  } else {
    url = `/api/a/${link.id}${path}`;
    auth = link.key;
  }
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${auth}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Couldn’t reach your account. Try again in a minute.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function createAccount() {
  const res = await fetch('/api/accounts', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Couldn’t create an account here. It works on the Squarely website.');
  return { id: data.id, key: data.key };
}

/** The library's sync target for an account: the same shape as the hosted page's database doc. */
export function accountRef(link) {
  const snap = (r) => ({ exists: Boolean(r?.data), data: () => r.data, metadata: { hasPendingWrites: false } });
  return {
    get: async () => snap(await accountCall(link)),
    set: (body) => accountCall(link, '', { method: 'PUT', body: { data: body, updatedAt: body.updatedAt } }),
    onSnapshot(onNext, onError) {
      let dead = false;
      const pull = () => {
        if (dead || document.visibilityState === 'hidden') return;
        accountCall(link)
          .then((r) => !dead && onNext(snap(r)))
          .catch((e) => !dead && (e.status === 401 || e.status === 404) && onError(e));
      };
      const timer = setInterval(pull, POLL);
      document.addEventListener('visibilitychange', pull);
      return () => {
        dead = true;
        clearInterval(timer);
        document.removeEventListener('visibilitychange', pull);
      };
    },
  };
}

// ---- bringing an older account over ----

let moving = null;

/**
 * Copy the older account this browser has a link to into the signed-in
 * Supabase account, once. Safe to call any time; does nothing without both.
 */
export function bringOver() {
  const old = legacyLink();
  const link = sessionLink();
  if (!old || !link || !usingSupabase()) return Promise.resolve(null);
  if (!moving) {
    moving = accountCall(link, '/import', { method: 'POST', body: old })
      .then((r) => {
        store.set(KEY, null);
        return r;
      })
      .catch((e) => {
        // Deleted, or already moved to someone else's account: nothing more to bring.
        if (e.status === 400 || e.status === 409) store.set(KEY, null);
        return null;
      })
      .finally(() => {
        moving = null;
      });
  }
  return moving;
}

/** Bring over an older account by signing in to it with its old email and password. */
export async function bringOverWithPassword(email, password) {
  const old = await authCall('login', { email, password });
  const r = await accountCall(sessionLink(), '/import', { method: 'POST', body: { id: old.id, key: old.key } });
  // Its deals replace this browser's, once.
  preferAccount();
  return r;
}

// ---- signing in with an email and password ----

async function authCall(path, body) {
  const res = await fetch(`/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Couldn’t reach Squarely. Try again in a minute.');
  return data;
}

function announce() {
  window.dispatchEvent(new CustomEvent('bedrock-account', { detail: accountLink() }));
}

/** Tell every part of the page (and other tabs) that the account changed. */
export function announceAccount(link) {
  if (!usingSupabase()) saveAccountLink(link);
  announce();
}

/**
 * A new account with this email and password, keeping what this browser
 * already saved. Resolves with the account, or with { confirm: true, email }
 * when Supabase first wants the email confirmed (the link it sends signs in).
 */
export async function signUp(email, password) {
  await initAccounts();
  checkPassword(password);
  if (usingSupabase()) {
    const sb = await client();
    const { data, error } = await sb.auth.signUp({ email: String(email).trim(), password, options: { emailRedirectTo: comeBackTo() } });
    if (error) throw friendly(error);
    if (!data.session) return { confirm: true, email: String(email).trim() };
    await bringOver();
    announce();
    return sessionLink();
  }
  const link = await authCall('signup', { email, password, account: legacyLink() });
  announceAccount({ id: link.id, key: link.key });
  return link;
}

export async function signIn(email, password) {
  await initAccounts();
  if (usingSupabase()) {
    const sb = await client();
    const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) throw friendly(error);
    // Signing in to an existing account: its saved library wins over this browser's, once.
    preferAccount();
    await bringOver();
    announce();
    return sessionLink();
  }
  const link = await authCall('login', { email, password });
  preferAccount();
  announceAccount({ id: link.id, key: link.key });
  return link;
}

export async function changePassword(email, password, next) {
  if (usingSupabase()) {
    checkPassword(next);
    const sb = await client();
    // The current password first, so a borrowed, signed-in device can't change it.
    const check = await sb.auth.signInWithPassword({ email, password });
    if (check.error) throw friendly(check.error);
    const { error } = await sb.auth.updateUser({ password: next });
    if (error) throw friendly(error);
    return { ok: true };
  }
  return authCall('password', { email, password, next });
}

export async function signOut() {
  if (usingSupabase()) {
    try {
      const sb = await client();
      await sb.auth.signOut({ scope: 'local' });
    } catch {
      store.set(SB_KEY, null);
    }
    lastLink = null;
    announce();
    return;
  }
  announceAccount(null);
}

/** Email a password reset link (the answer is the same whether or not the email has an account). */
export async function forgotPassword(email) {
  await initAccounts();
  if (usingSupabase()) {
    const sb = await client();
    const { error } = await sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: comeBackTo('reset') });
    if (error) throw friendly(error);
    return { ok: true };
  }
  return authCall('forgot', { email });
}

/**
 * The emailed reset link opened this page: for Supabase, ?reset=1 (Supabase
 * signs the person in from the link); before, #reset=<token>&email=<email>.
 */
export function readReset() {
  if (typeof window === 'undefined' || linkError()) return null;
  // Only from the emailed link itself, so a signed-in device can't change the password without the current one.
  if (usingSupabase()) return recovering || fromResetEmail ? { supabase: true, email: sessionLink()?.email || '' } : null;
  const q = new URLSearchParams(window.location.hash.slice(1));
  return q.get('reset') && q.get('email') ? { token: q.get('reset'), email: q.get('email') } : null;
}

/** Why an email link didn't work (it expired, or was used already), or ''. */
export function linkError() {
  if (typeof window === 'undefined') return '';
  const q = new URLSearchParams(window.location.hash.slice(1));
  const code = q.get('error_code') || q.get('error') || '';
  if (!code) return '';
  return /expired|otp/i.test(code + (q.get('error_description') || '')) ? 'That email link has expired or was already used. Ask for a new one below.' : q.get('error_description') || 'That email link didn’t work. Try again below.';
}

/** Set a new password from the emailed link; signs in on this device. */
export async function resetPassword(email, token, password) {
  checkPassword(password);
  if (usingSupabase()) {
    const sb = await client();
    const { data } = await sb.auth.getSession();
    if (!data?.session) throw new Error('This reset link has expired or was already used. Ask for a new one.');
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw friendly(error);
    recovering = false;
    preferAccount();
    await bringOver();
    announce();
    return sessionLink();
  }
  const link = await authCall('reset', { email, token, password });
  preferAccount();
  announceAccount({ id: link.id, key: link.key });
  return link;
}

/** The person landed on a page from their emailed "reset your password" link. */
export const onRecovery = (fn) => {
  window.addEventListener('squarely-recovery', fn);
  return () => window.removeEventListener('squarely-recovery', fn);
};

if (typeof window !== 'undefined') initAccounts();
