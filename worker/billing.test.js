import { describe as suite, expect, it } from 'vitest';
import { PLAN, managerWouldCharge, monthlyBill, unitFee } from './pricing.js';
import { stripeClient, verifyWebhook } from './stripe.js';
import { Store, hashKey } from './store.js';

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

const unit = (id, rent, tenant = 'Sam') => ({ id, label: id, rent, tenantName: tenant });

suite('pricing', () => {
  it('takes 2% of the rent, capped at $30 a unit', () => {
    expect(PLAN).toMatchObject({ rate: 0.02, capPerUnit: 30, freeUnits: 1 });
    expect(unitFee(unit('a', 1800))).toBe(30); // 2% would be $36
    expect(unitFee(unit('a', 1200))).toBe(24);
    expect(unitFee(unit('a', 1200, ''))).toBe(0); // vacant
  });

  it('waives the unit with the biggest fee, and charges nothing for one unit', () => {
    expect(monthlyBill([unit('a', 1800)]).total).toBe(0);
    const b = monthlyBill([unit('a', 1200), unit('b', 2000), unit('c', 900, '')]);
    expect(b.lines.find((l) => l.unitId === 'b').free).toBe(true);
    expect(b.total).toBe(24);
    expect(b.cents).toBe(2400);
    expect(managerWouldCharge([unit('a', 1200), unit('b', 2000)])).toBe(256);
  });
});

suite('stripe', () => {
  it('accepts only webhooks signed with the secret, within five minutes', async () => {
    const secret = 'whsec_test';
    const payload = '{"id":"evt_1"}';
    const t = 1_800_000_000;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyWebhook(payload, `t=${t},v1=${sig}`, secret, t * 1000)).toBe(true);
    expect(await verifyWebhook(payload + ' ', `t=${t},v1=${sig}`, secret, t * 1000)).toBe(false);
    expect(await verifyWebhook(payload, `t=${t},v1=${sig}`, 'whsec_other', t * 1000)).toBe(false);
    expect(await verifyWebhook(payload, `t=${t},v1=${sig}`, secret, (t + 600) * 1000)).toBe(false);
  });

  it('charges once per landlord and month, with an idempotency key', async () => {
    const calls = [];
    const fake = async (url, init) => (calls.push({ url, init }), { ok: true, status: 200, json: async () => ({ id: 'pi_1', status: 'succeeded' }) });
    const r = await stripeClient('sk_test', fake).charge('cus_1', 'pm_1', 2400, 'Squarely', { workspace: 'ws1', month: '2026-11' }, 'bedrock-ws1-2026-11');
    expect(r.data.status).toBe('succeeded');
    expect(calls[0].url).toMatch(/payment_intents$/);
    expect(calls[0].init.headers['idempotency-key']).toBe('bedrock-ws1-2026-11');
    expect(calls[0].init.body).toMatch(/amount=2400/);
    expect(calls[0].init.body).toMatch(/off_session=true/);
    expect(calls[0].init.body).toMatch(/metadata%5Bworkspace%5D=ws1/);
  });
});

describe('the free unit, with billing on', () => {
  it('tracks one tenanted unit free, and asks for a card for a second', async () => {
    const s = new Store(memorySql(), () => Date.now(), { billing: true });
    s.init(await hashKey('k'));
    s.create('units', { label: 'Upper', rent: 1800, tenantName: 'Sam' });
    const empty = s.create('units', { label: 'Basement', rent: 1200 }); // vacant: fine
    expect(() => s.update('units', empty.id, { tenantName: 'Ana' })).toThrow(/Add a card in Billing/);
    expect(() => s.create('units', { label: 'Garage suite', rent: 900, tenantName: 'Lee' })).toThrow(/Add a card/);
    s.setCard({ paymentMethod: 'pm_1', brand: 'visa', last4: '4242' });
    expect(s.update('units', empty.id, { tenantName: 'Ana' }).tenantName).toBe('Ana');
    s.recordInvoice({ month: '2026-11', cents: 2400, status: 'failed', stripeId: 'pi_1' });
    s.recordInvoice({ month: '2026-11', cents: 2400, status: 'paid', stripeId: 'pi_2' });
    expect(s.billing().invoices).toHaveLength(1);
    expect(s.invoiceByStripe('pi_2').status).toBe('paid');
  });

  it('never limits anyone when billing is off', async () => {
    const s = new Store(memorySql());
    s.init(await hashKey('k'));
    s.create('units', { label: 'A', rent: 1800, tenantName: 'Sam' });
    expect(s.create('units', { label: 'B', rent: 1800, tenantName: 'Ana' }).label).toBe('B');
  });
});
