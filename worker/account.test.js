import { beforeEach, describe as suite, expect, it } from 'vitest';
import { AccountStore, cleanAlert } from './account.js';
import { hashKey } from './store.js';

const sqlite = await import('node:sqlite').catch(() => null);
const describe = sqlite ? suite : suite.skip;
function memorySql() {
  const db = new sqlite.DatabaseSync(':memory:');
  return {
    exec(query, ...args) {
      const st = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query) ? st.all(...args) : (st.run(...args), []);
      return { toArray: () => rows };
    },
  };
}

let now;
let a;
beforeEach(async () => {
  if (!sqlite) return;
  now = Date.parse('2026-11-02T15:00:00Z');
  a = new AccountStore(memorySql(), () => now);
  a.init(await hashKey('secret-key'));
});

describe('accounts', () => {
  it('opens only with its key', async () => {
    await expect(a.checkKey('wrong')).rejects.toThrow(/isn’t right/);
    await expect(a.checkKey('secret-key')).resolves.toBeUndefined();
    expect(() => a.init('x')).toThrow(/already exists/);
  });

  it('keeps the newest library and ignores older writes', () => {
    expect(a.read().data).toBeNull();
    a.write({ deals: [1] }, 100);
    expect(a.write({ deals: [0] }, 50)).toEqual({ updatedAt: 100, stale: true });
    a.write({ deals: [2] }, 200);
    expect(a.read()).toMatchObject({ data: { deals: [2] }, updatedAt: 200 });
  });

  it('keeps up to ten clean alerts', () => {
    const list = a.setAlerts([{ city: 'hamilton', maxLive: '2000', types: ['small', 'bogus'] }, { city: 'Not a city!' }, ...Array(12).fill({ city: 'calgary' })]);
    expect(list).toHaveLength(9); // ten taken, the bad one dropped
    expect(list[0]).toMatchObject({ city: 'hamilton', maxLive: 2000, types: ['small'], maxPrice: null });
  });

  it('confirms an email with a code before alerts use it', async () => {
    const { code } = await a.startEmail('Me@Example.com');
    await expect(a.finishEmail('000000' === code ? '111111' : '000000')).rejects.toThrow(/isn’t right/);
    const r = await a.finishEmail(code);
    expect(r).toMatchObject({ email: 'me@example.com', emailVerified: true });
    expect(a.dropEmail()).toMatchObject({ email: '', emailVerified: false });
  });

  it('forgets everything when wiped', async () => {
    a.wipe();
    expect(a.ready).toBe(false);
    await expect(a.checkKey('secret-key')).rejects.toThrow(/no account/);
  });
});

suite('alert cleaning', () => {
  it('needs a city', () => {
    expect(cleanAlert({})).toBeNull();
    expect(cleanAlert({ city: 'toronto', minPerDoor: 0 }).minPerDoor).toBe(0);
  });
});

describe('saved sections', () => {
  it('keeps each section to its shape and drops duplicates', () => {
    expect(a.read()).toMatchObject({ profile: {}, saved: [], workspaces: [] });
    a.setSection('profile', { name: 'Alex', income: 5200, sin: '123', email: 'a@b.ca' });
    expect(a.read().profile).toEqual({ name: 'Alex', income: 5200, email: 'a@b.ca' });
    const saved = a.setSection('saved', [{ ws: 'ws123456', id: 'li123456', title: 'Suite', price: 1650 }, { ws: 'ws123456', id: 'li123456' }, { ws: 'bad id!', id: 'x' }]);
    expect(saved).toHaveLength(1);
    a.setSection('workspaces', [{ id: 'wsabcdef', key: 'keykeykeykey', name: 'Main St' }]);
    expect(a.read().workspaces[0]).toMatchObject({ id: 'wsabcdef', name: 'Main St' });
    expect(() => a.setSection('nope', [])).toThrow(/Unknown/);
  });
});

describe('Squarely Plus', () => {
  let now = 1_800_000_000_000;
  let acct;
  beforeEach(() => {
    acct = new AccountStore(memorySql(), () => now);
  });
  it('is on while active, and through the paid period after a failed renewal', () => {
    expect(acct.isPlus).toBe(false);
    acct.setPlus({ status: 'active', customer: 'cus_1' });
    expect(acct.isPlus).toBe(true);
    acct.setPlus({ status: 'past_due', until: now + 1000 });
    expect(acct.isPlus).toBe(true);
    now += 2000;
    expect(acct.isPlus).toBe(false);
    expect(acct.plus().customer).toBe('cus_1');
  });
  it('is on for good for a login email the site gives Plus to, whatever Stripe says', () => {
    acct.setLoginEmail('owner@example.com');
    expect(acct.isPlus).toBe(false);
    acct.setComp(['someone@example.com', ' Owner@Example.com ']);
    expect(acct.isPlus).toBe(true);
    acct.setPlus({ status: 'canceled' });
    expect(acct.isPlus).toBe(true);
    acct.setComp(['']);
    expect(acct.isPlus).toBe(false);
  });
  it('gives no one Plus without a login email', () => {
    acct.setComp(['']);
    expect(acct.compPlus).toBe(false);
  });
  it('limits costly uses each day', () => {
    acct.useDaily('blueprint', 2);
    acct.useDaily('blueprint', 2);
    expect(() => acct.useDaily('blueprint', 2)).toThrow(/2 today/);
    now += 86_400_000;
    expect(() => acct.useDaily('blueprint', 2)).not.toThrow();
  });
});
