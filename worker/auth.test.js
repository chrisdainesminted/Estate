import { describe as suite, expect, it } from 'vitest';
import { LoginStore } from './auth.js';

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

describe('sign in with email and password', () => {
  it('signs up, signs in, and opens the same account', async () => {
    let now = 1_000_000;
    const l = new LoginStore(memorySql(), () => now);
    const account = { id: 'acct123456', key: 'the-account-key-123' };
    await expect(l.signup('nope', 'longenough', account)).rejects.toThrow(/email/);
    await expect(l.signup('A@B.ca', 'short', account)).rejects.toThrow(/8 characters/);
    await l.signup(' A@B.ca ', 'correct horse', account);
    await expect(l.signup('a@b.ca', 'another one', account)).rejects.toThrow(/already/);
    expect(await l.login('a@b.ca', 'correct horse')).toEqual(account);
    await expect(l.login('a@b.ca', 'wrong pass')).rejects.toThrow(/don’t match/);
    await expect(l.login('nobody@b.ca', 'whatever1')).rejects.toThrow(/don’t match/);
    await l.changePassword('a@b.ca', 'correct horse', 'battery staple');
    expect(await l.login('a@b.ca', 'battery staple')).toEqual(account);
    await expect(l.login('a@b.ca', 'correct horse')).rejects.toThrow(/don’t match/);
  }, 20000);

  it('pauses after ten wrong passwords', async () => {
    let now = 1_000_000;
    const l = new LoginStore(memorySql(), () => now);
    await l.signup('c@d.ca', 'good password', { id: 'acct654321', key: 'k-k-k-k-k-k' });
    for (let i = 0; i < 10; i++) await expect(l.login('c@d.ca', 'bad')).rejects.toThrow();
    await expect(l.login('c@d.ca', 'good password')).rejects.toThrow(/Too many/);
    now += 16 * 60000;
    expect((await l.login('c@d.ca', 'good password')).id).toBe('acct654321');
  }, 30000);
});

describe('password reset', () => {
  it('resets with the emailed token once, giving the account a new key', async () => {
    let now = 5_000_000;
    const l = new LoginStore(memorySql(), () => now);
    await l.signup('r@s.ca', 'first password', { id: 'acctreset1', key: 'old-key-old-key' });
    expect(await l.startReset('nobody@s.ca')).toBeNull();
    const { token } = await l.startReset('R@S.ca');
    await expect(l.startReset('r@s.ca')).rejects.toThrow(/just sent/);
    await expect(l.finishReset('r@s.ca', 'wrong-token', 'new password 1', async () => 'x')).rejects.toThrow(/expired/);
    const opened = await l.finishReset('r@s.ca', token, 'new password 1', async (id) => `new-key-for-${id}`);
    expect(opened).toEqual({ id: 'acctreset1', key: 'new-key-for-acctreset1' });
    expect(await l.login('r@s.ca', 'new password 1')).toEqual(opened);
    await expect(l.login('r@s.ca', 'first password')).rejects.toThrow(/don’t match/);
    await expect(l.finishReset('r@s.ca', token, 'another one 2', async () => 'y')).rejects.toThrow(/expired/);
  }, 30000);

  it('expires after an hour', async () => {
    let now = 5_000_000;
    const l = new LoginStore(memorySql(), () => now);
    await l.signup('t@s.ca', 'first password', { id: 'acctreset2', key: 'k-k-k-k-k-k' });
    const { token } = await l.startReset('t@s.ca');
    now += 61 * 60000;
    await expect(l.finishReset('t@s.ca', token, 'new password 1', async () => 'z')).rejects.toThrow(/expired/);
  }, 20000);
});
