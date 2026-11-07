import { beforeEach, describe, expect, it } from 'vitest';
import { MeStore, compEmails, plusOwner, resetKeyCache, supabaseDb, supabaseOn, supabasePublic, verifyUser } from './supabase.js';

const URL_ = 'https://proj.supabase.co';
const env = { SUPABASE_URL: `${URL_}/`, SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' };
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const part = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function es256() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig', key_ops: ['verify'] };
  const sign = async (claims, header = { alg: 'ES256', kid: 'k1', typ: 'JWT' }) => {
    const head = `${part(header)}.${part(claims)}`;
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(head));
    return `${head}.${b64url(sig)}`;
  };
  return { jwk, sign };
}

const now = Date.UTC(2026, 10, 7, 12);
const good = (extra = {}) => ({ sub: A, email: 'Chris@Example.com', role: 'authenticated', aud: 'authenticated', iss: `${URL_}/auth/v1`, exp: now / 1000 + 3600, ...extra });

describe('verifyUser', () => {
  let key;
  let calls;
  let fetcher;
  beforeEach(async () => {
    resetKeyCache();
    key = await es256();
    calls = [];
    fetcher = async (url, init) => {
      calls.push(String(url));
      if (String(url).endsWith('/auth/v1/.well-known/jwks.json')) return new Response(JSON.stringify({ keys: [key.jwk] }));
      if (String(url).endsWith('/auth/v1/user')) {
        return init?.headers?.authorization === 'Bearer opaque.but.valid' ? new Response(JSON.stringify({ id: B, email: 'B@x.com' })) : new Response('{}', { status: 401 });
      }
      return new Response('nope', { status: 404 });
    };
  });

  it('accepts a live token signed with the project’s published key, without asking Supabase', async () => {
    const user = await verifyUser(env, await key.sign(good()), { fetcher, now });
    expect(user).toEqual({ id: A, email: 'chris@example.com' });
    await verifyUser(env, await key.sign(good()), { fetcher, now });
    expect(calls.filter((u) => u.includes('jwks'))).toHaveLength(1); // keys are kept a while
    expect(calls.some((u) => u.endsWith('/auth/v1/user'))).toBe(false);
  });

  it('looks again for keys when Supabase rotates them', async () => {
    await verifyUser(env, await key.sign(good()), { fetcher, now });
    const old = key;
    key = await es256(); // a new key under the same name, as a stand-in for a rotation
    await expect(verifyUser(env, await key.sign(good()), { fetcher, now: now + 1000 })).rejects.toMatchObject({ status: 401 });
    expect(await verifyUser(env, await key.sign(good()), { fetcher, now: now + 60000 })).toMatchObject({ id: A });
    // The old key's tokens no longer pass.
    await expect(verifyUser(env, await old.sign(good()), { fetcher, now: now + 120000 })).rejects.toMatchObject({ status: 401 });
  });

  it('turns away expired, foreign, anonymous-role and tampered tokens', async () => {
    for (const claims of [good({ exp: now / 1000 - 1 }), good({ iss: 'https://other.supabase.co/auth/v1' }), good({ role: 'anon' }), good({ aud: 'something-else' }), good({ sub: 'not-a-uuid' })]) {
      await expect(verifyUser(env, await key.sign(claims), { fetcher, now })).rejects.toMatchObject({ status: 401 });
    }
    const t = await key.sign(good());
    const [h, , sig] = t.split('.');
    await expect(verifyUser(env, `${h}.${part(good({ sub: B }))}.${sig}`, { fetcher, now })).rejects.toMatchObject({ status: 401 });
    await expect(verifyUser(env, 'garbage', { fetcher, now })).rejects.toMatchObject({ status: 401 });
    await expect(verifyUser(env, '', { fetcher, now })).rejects.toMatchObject({ status: 401 });
  });

  it('asks Supabase about a token it can’t check itself, and remembers the answer for a minute', async () => {
    const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(good())}.sig`;
    await expect(verifyUser(env, token, { fetcher, now })).rejects.toMatchObject({ status: 401 });
    // A token that doesn't even parse is refused without asking.
    await expect(verifyUser(env, 'opaque.but.valid', { fetcher, now })).rejects.toMatchObject({ status: 401 });
    const hs = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(good({ sub: B }))}.x`;
    let asked = 0;
    const f3 = async (url) => (String(url).endsWith('/auth/v1/user') ? (asked++, new Response(JSON.stringify({ id: B, email: 'b@x.com' }))) : new Response('{}', { status: 404 }));
    expect(await verifyUser(env, hs, { fetcher: f3, now })).toEqual({ id: B, email: 'b@x.com' });
    await verifyUser(env, hs, { fetcher: f3, now: now + 1000 });
    expect(asked).toBe(1);
  });

  it('checks shared-secret tokens itself when the secret is set', async () => {
    const secret = 'super-secret-jwt-key';
    const head = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(good())}`;
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const token = `${head}.${b64url(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(head)))}`;
    expect(await verifyUser({ ...env, SUPABASE_JWT_SECRET: secret }, token, { fetcher, now })).toEqual({ id: A, email: 'chris@example.com' });
    await expect(verifyUser({ ...env, SUPABASE_JWT_SECRET: 'wrong' }, token, { fetcher, now })).rejects.toMatchObject({ status: 401 });
  });
});

/** Just enough of Supabase's REST API, in memory, with the migration's functions. */
function fakeSupabase() {
  const tables = { accounts: [], subscriptions: [], account_private: [], usage: [] };
  const seen = [];
  const blank = (user_id) => ({ user_id, login_email: '', library: null, library_updated_at: 0, profile: {}, saved: [], applications: [], tenancies: [], workspaces: [], alerts: [], alert_email: '', alert_email_verified: false, remind_ready: false, last_sent: null, ready_sent: '', legacy_id: null });
  const match = (q) => (row) => [...q].every(([k, v]) => k === 'select' || k === 'on_conflict' || String(row[k]) === v.replace(/^eq\./, ''));
  const rpc = {
    squarely_write_library({ p_user, p_data, p_at, p_remind }) {
      let r = tables.accounts.find((x) => x.user_id === p_user);
      if (!r) tables.accounts.push((r = blank(p_user)));
      if (r.library_updated_at <= p_at) return (Object.assign(r, { library: p_data, library_updated_at: p_at, remind_ready: p_remind }), { updatedAt: p_at, stale: false });
      return { updatedAt: r.library_updated_at, stale: true };
    },
    squarely_use({ p_user, p_name, p_max, p_day }) {
      let u = tables.usage.find((x) => x.user_id === p_user && x.name === p_name && x.day === p_day);
      if (!u) return (tables.usage.push({ user_id: p_user, name: p_name, day: p_day, count: 1 }), true);
      if (u.count >= p_max) return false;
      u.count++;
      return true;
    },
  };
  const fetcher = async (url, init = {}) => {
    const u = new URL(url);
    const headers = init.headers ?? {};
    seen.push({ method: init.method, path: u.pathname, headers });
    if (headers.apikey !== env.SUPABASE_SERVICE_ROLE_KEY) return new Response('{}', { status: 401 });
    const body = init.body ? JSON.parse(init.body) : undefined;
    const ok = (data) => new Response(data === undefined ? '' : JSON.stringify(data), { status: 200 });
    if (u.pathname.startsWith('/rest/v1/rpc/')) return ok(rpc[u.pathname.split('/').pop()](body));
    if (u.pathname.startsWith('/auth/v1/admin/users/')) {
      const id = decodeURIComponent(u.pathname.split('/').pop());
      for (const t of Object.values(tables)) for (let i = t.length - 1; i >= 0; i--) if (t[i].user_id === id) t.splice(i, 1);
      return ok({});
    }
    const name = u.pathname.replace('/rest/v1/', '');
    const t = tables[name];
    const q = u.searchParams;
    if (init.method === 'GET') return ok(t.filter(match(q)));
    if (init.method === 'PATCH') {
      if (name === 'accounts' && 'legacy_id' in body && t.some((r) => r.legacy_id === body.legacy_id && !match(q)(r))) return new Response(JSON.stringify({ code: '23505' }), { status: 409 });
      t.filter(match(q)).forEach((r) => Object.assign(r, body));
      return ok();
    }
    if (init.method === 'POST') {
      const prefer = headers.prefer || '';
      const have = t.find((r) => r.user_id === body.user_id);
      if (have && prefer.includes('merge-duplicates')) Object.assign(have, body);
      else if (!have) t.push(name === 'accounts' ? { ...blank(body.user_id), ...body } : name === 'account_private' ? { pending_email: '', code_hash: '', code_until: 0, code_tries: 0, codes_hour: 0, codes_sent: 0, ...body } : { ...body });
      return ok();
    }
    return new Response('{}', { status: 405 });
  };
  return { tables, seen, fetcher, db: supabaseDb(env, fetcher) };
}

describe('MeStore', () => {
  let sb;
  let t;
  const me = (user = { id: A, email: 'chris@example.com' }, opts = {}) => new MeStore(sb.db, user, { now: () => t, ...opts });
  beforeEach(() => {
    sb = fakeSupabase();
    t = now;
  });

  it('switches on with all three settings, and tells the browser only the URL and public key', () => {
    expect(supabaseOn(env)).toBe(true);
    expect(supabaseOn({ ...env, SUPABASE_SERVICE_ROLE_KEY: '' })).toBe(false);
    expect(supabasePublic(env)).toEqual({ url: URL_, anonKey: 'anon-key' });
    expect(JSON.stringify(supabasePublic(env))).not.toContain('sb_secret');
    expect(supabasePublic({})).toBe(null);
  });

  it('sends a newer secret key only as apikey, a legacy key in both headers', async () => {
    await me().read();
    expect(sb.seen[0].headers.apikey).toBe('sb_secret_abc');
    expect(sb.seen[0].headers.authorization).toBeUndefined();
    const legacy = { ...env, SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOi.legacy.key' };
    const seen = [];
    await supabaseDb(legacy, async (u, init) => (seen.push(init.headers), new Response('[]'))).select('accounts', { user_id: `eq.${A}` });
    expect(seen[0].authorization).toBe('Bearer eyJhbGciOi.legacy.key');
  });

  it('opens an empty account on first use, in the same shape as an older account', async () => {
    const r = await me().read();
    expect(r).toMatchObject({ data: null, updatedAt: 0, alerts: [], email: '', emailVerified: false, loginEmail: 'chris@example.com', profile: {}, saved: [], workspaces: [] });
    expect(r.plus).toEqual({ active: false, comp: false, status: '', until: 0, cancelAt: 0 });
    expect(sb.tables.accounts).toHaveLength(1);
    expect(sb.tables.accounts[0].login_email).toBe('chris@example.com');
  });

  it('keeps the newest library, and notes when the savings-month email is on', async () => {
    const lib = { deals: [{ id: 'd1' }], settings: { home: { remindReady: true, readyBy: '2027-05' } } };
    expect(await me().write(lib, 200)).toEqual({ updatedAt: 200, stale: false });
    expect(await me().write({ deals: [] }, 100)).toEqual({ updatedAt: 200, stale: true });
    const r = await me().read();
    expect(r.data).toEqual(lib);
    expect(sb.tables.accounts[0].remind_ready).toBe(true);
    await expect(me().write({ big: 'x'.repeat(1_600_000) }, 300)).rejects.toMatchObject({ status: 413 });
  });

  it('cleans saved sections and alerts before they’re kept', async () => {
    const saved = await me().setSection('workspaces', [{ id: 'ws_123456', key: 'key_123456789', name: 'Mine' }, { id: 'bad id', key: 'x' }]);
    expect(saved).toEqual([{ id: 'ws_123456', key: 'key_123456789', name: 'Mine', at: 0 }]);
    await expect(me().setSection('nope', [])).rejects.toMatchObject({ status: 404 });
    const alerts = await me().setAlerts([{ city: 'thunder-bay', maxPrice: 400000 }, { city: 'Not A City!' }]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ city: 'thunder-bay', maxPrice: 400000 });
    const r = await me().read();
    expect(r.workspaces).toEqual(saved);
    expect(r.alerts).toEqual(alerts);
  });

  it('confirms an alerts email with a code, five tries at most', async () => {
    const { code, email } = await me().startEmail('Alerts@Example.com');
    expect(email).toBe('alerts@example.com');
    await expect(me().finishEmail('000000' === code ? '111111' : '000000')).rejects.toMatchObject({ status: 400 });
    const r = await me().finishEmail(code);
    expect(r).toMatchObject({ email: 'alerts@example.com', emailVerified: true });
    // The code works once.
    await expect(me().finishEmail(code)).rejects.toMatchObject({ status: 400 });
    expect((await me().dropEmail()).emailVerified).toBe(false);
    await expect(me().startEmail('not-an-email')).rejects.toMatchObject({ status: 400 });
  });

  it('expires codes and limits how many are sent an hour', async () => {
    const { code } = await me().startEmail('a@example.com');
    t += 16 * 60000;
    await expect(me().finishEmail(code)).rejects.toThrow(/expired/);
    for (let i = 0; i < 4; i++) await me().startEmail('a@example.com');
    await expect(me().startEmail('a@example.com')).rejects.toMatchObject({ status: 429 });
    t += 3600000;
    await expect(me().startEmail('a@example.com')).resolves.toBeTruthy();
  });

  it('has Plus when paid up, or for good with a PLUS_EMAILS address', async () => {
    expect(await me().isPlus()).toBe(false);
    expect(await me({ id: A, email: 'chris@example.com' }, { comp: compEmails({ PLUS_EMAILS: ' Chris@Example.com ,other@x.com' }) }).isPlus()).toBe(true);
    await me().setPlus({ status: 'active', customer: 'cus_1' });
    expect(await me().isPlus()).toBe(true);
    await me().setPlus({ status: 'past_due', until: now + 86400000 });
    expect(await me().isPlus()).toBe(true);
    await me().setPlus({ status: 'canceled' });
    expect(await me().isPlus()).toBe(false);
    expect((await me().plus()).customer).toBe('cus_1');
  });

  it('counts paid features a day at a time', async () => {
    await me().useDaily('ask', 2);
    await me().useDaily('ask', 2);
    await expect(me().useDaily('ask', 2)).rejects.toMatchObject({ status: 429 });
    t += 86400000;
    await expect(me().useDaily('ask', 2)).resolves.toBeUndefined();
  });

  it('deletes the person with everything saved to them', async () => {
    await me().write({ deals: [] }, 1);
    await me({ id: B, email: 'b@x.com' }).read();
    await me().wipe();
    expect(sb.tables.accounts.map((r) => r.user_id)).toEqual([B]);
  });

  it('brings over an older account once, without overwriting what’s already here', async () => {
    await me().setSection('saved', [{ ws: 'ws_123456', id: 'home_1234', title: 'Already saved' }]);
    const old = {
      data: { deals: [{ id: 'old' }] },
      updatedAt: 500,
      alerts: [{ city: 'sudbury' }],
      email: 'old@x.com',
      emailVerified: true,
      saved: [{ ws: 'ws_999999', id: 'home_9999', title: 'Old save' }],
      workspaces: [{ id: 'ws_777777', key: 'key_777777777', name: 'Old workspace' }],
      plusRaw: { status: 'active', customer: 'cus_old', subscription: 'sub_old', until: now + 1e9 },
      lastSent: '2026-11-01',
    };
    expect(await me().importLegacy('legacy_abc123', old)).toEqual({ ok: true, library: true });
    const r = await me().read();
    expect(r.data).toEqual(old.data);
    expect(r.saved.map((x) => x.title)).toEqual(['Already saved']);
    expect(r.workspaces.map((x) => x.name)).toEqual(['Old workspace']);
    expect(r.alerts[0].city).toBe('sudbury');
    expect(r).toMatchObject({ email: 'old@x.com', emailVerified: true });
    expect(r.plus).toMatchObject({ active: true, status: 'active' });
    expect(sb.tables.accounts[0]).toMatchObject({ legacy_id: 'legacy_abc123', last_sent: '2026-11-01' });
    // Its Stripe events now find this person.
    expect(await plusOwner(sb.db, { account: 'legacy_abc123' })).toBe(A);
    expect(await plusOwner(sb.db, { user: B })).toBe(B);
    expect(await plusOwner(sb.db, { account: 'unknown_123' })).toBe(null);
    // The same old account can't move into a second person's account.
    await expect(me({ id: B, email: 'b@x.com' }).importLegacy('legacy_abc123', old)).rejects.toMatchObject({ status: 409 });
    // An older library doesn't replace a newer one.
    await me().write({ deals: [{ id: 'new' }] }, 900);
    expect(await me().importLegacy('legacy_abc123', old)).toEqual({ ok: true, library: false });
    await expect(me().importLegacy('legacy_other1', old)).rejects.toMatchObject({ status: 409 });
  });
});
