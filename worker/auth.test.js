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
