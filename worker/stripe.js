// Just enough of Stripe's API for landlord billing: save a card through
// Stripe Checkout, charge it each month, and check that webhook calls
// really come from Stripe. Card details never touch Squarely.

import { StoreError } from './store.js';

/** Stripe's form encoding: { a: { b: 1 }, c: [x] } → a[b]=1&c[0]=x */
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export function stripeClient(secret, fetchImpl = fetch) {
  const request = async (method, path, params, { idempotencyKey } = {}) => {
    const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: params ? form(params).toString() : undefined,
    }).catch(() => {
      throw new StoreError(502, 'Couldn’t reach Stripe. Try again in a minute.');
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };
  const must = async (...args) => {
    const r = await request(...args);
    if (!r.ok) throw new StoreError(502, r.data?.error?.message || 'Stripe didn’t accept that.');
    return r.data;
  };
  return {
    createCustomer: (ws, email) => must('POST', 'customers', { email: email || undefined, metadata: { workspace: ws } }),
    setupSession: (customer, ws, successUrl, cancelUrl) =>
      must('POST', 'checkout/sessions', { mode: 'setup', customer, currency: 'cad', 'payment_method_types[0]': 'card', success_url: successUrl, cancel_url: cancelUrl, metadata: { workspace: ws } }),
    setupIntent: (id) => must('GET', `setup_intents/${id}`),
    paymentMethod: (id) => must('GET', `payment_methods/${id}`),
    detach: (id) => must('POST', `payment_methods/${id}/detach`, {}),
    /** Charge a saved card. Resolves with Stripe's answer, whether or not it went through. */
    charge: (customer, paymentMethod, cents, description, metadata, idempotencyKey) =>
      request('POST', 'payment_intents', { amount: cents, currency: 'cad', customer, payment_method: paymentMethod, off_session: true, confirm: true, description, metadata }, { idempotencyKey }),
  };
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Whether a webhook body was signed by Stripe with this secret, within
 * five minutes. The header looks like "t=1700000000,v1=abc…".
 */
export async function verifyWebhook(payload, header, secret, now = Date.now()) {
  const parts = Object.fromEntries(
    String(header || '')
      .split(',')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2),
  );
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const sigs = String(header)
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  return sigs.some((s) => s.length === sig.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ sig.charCodeAt(i)), 0) === 0);
}
