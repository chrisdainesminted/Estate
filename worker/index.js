// The website's server: static files for everything, and /api/* for the
// landlord tools. Each landlord workspace is its own Durable Object with a
// SQLite database; the landlord proves it's theirs with the private key
// they got when they made it (only its hash is stored).

import { DurableObject } from 'cloudflare:workers';
import { COLLECTIONS } from './schema.js';
import { Store, StoreError, hashKey, randomToken } from './store.js';

const MAX_BODY = 32 * 1024;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export class Workspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new Store(ctx.storage.sql);
  }

  /** One call from the Worker: { op, key?, ...args }. */
  async call(req) {
    const s = this.store;
    try {
      if (req.op === 'init') {
        s.init(await hashKey(req.key));
        return { ok: true };
      }
      if (!s.ready) throw new StoreError(404, 'There’s no workspace at this link.');
      switch (req.op) {
        case 'publicListing':
          return s.publicListing(req.listingId);
        case 'apply':
          return s.apply(req.listingId, req.body, req.ip);
        case 'status':
          return s.status(req.token);
        case 'applicantAction':
          return s.applicantAction(req.token, req.body?.action, req.body?.slotId, req.ip);
        case 'repairInfo':
          return s.repairInfo(req.unitId, req.token);
        case 'reportRepair':
          return s.reportRepair(req.unitId, req.token, req.body, req.ip);
      }
      if (!s.checkKey(await hashKey(req.key ?? ''))) throw new StoreError(401, 'This private link isn’t valid for the workspace.');
      switch (req.op) {
        case 'all':
          return s.all();
        case 'create':
          return s.create(req.collection, req.body);
        case 'update':
          return s.update(req.collection, req.id, req.body);
        case 'remove':
          return { ok: s.remove(req.collection, req.id) };
        case 'moveSlot':
          return s.moveSlot(req.id, req.body?.slotId);
        case 'createSlots': {
          const made = [];
          for (const slot of Array.isArray(req.body?.slots) ? req.body.slots.slice(0, 200) : []) made.push(s.create('slots', slot));
          return made;
        }
        default:
          throw new StoreError(404, 'Unknown request.');
      }
    } catch (e) {
      if (e instanceof StoreError) return { error: e.message, status: e.status };
      throw e;
    }
  }
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new StoreError(413, 'That’s too much text.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new StoreError(400, 'Couldn’t read that request.');
  }
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;

async function api(request, env, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;

  if (parts[0] === 'workspaces' && parts.length === 1 && method === 'POST') {
    const id = randomToken(12);
    const key = randomToken(24);
    const res = await env.WORKSPACE.get(env.WORKSPACE.idFromName(id)).call({ op: 'init', key });
    if (res.error) return json({ error: res.error }, res.status);
    return json({ id, key }, 201);
  }

  if (parts[0] !== 'w' || !ID.test(parts[1] ?? '')) return json({ error: 'Not found.' }, 404);
  const ws = env.WORKSPACE.get(env.WORKSPACE.idFromName(parts[1]));
  const rest = parts.slice(2);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const body = method === 'POST' || method === 'PUT' ? await readBody(request) : undefined;

  let call = null;
  // Public: a listing's page and application, an applicant's status, a unit's repair form.
  if (rest[0] === 'listings' && rest.length === 2 && method === 'GET') call = { op: 'publicListing', listingId: rest[1] };
  else if (rest[0] === 'listings' && rest[2] === 'apply' && method === 'POST') call = { op: 'apply', listingId: rest[1], body, ip };
  else if (rest[0] === 'status' && rest.length === 2 && method === 'GET') call = { op: 'status', token: rest[1] };
  else if (rest[0] === 'status' && rest.length === 2 && method === 'POST') call = { op: 'applicantAction', token: rest[1], body, ip };
  else if (rest[0] === 'repair' && rest.length === 3 && method === 'GET') call = { op: 'repairInfo', unitId: rest[1], token: rest[2] };
  else if (rest[0] === 'repair' && rest.length === 3 && method === 'POST') call = { op: 'reportRepair', unitId: rest[1], token: rest[2], body, ip };
  // The landlord's own records.
  else if (rest.length === 0 && method === 'GET') call = { op: 'all', key };
  else if (rest[0] === 'slots' && rest[1] === 'batch' && method === 'POST') call = { op: 'createSlots', key, body };
  else if (rest[0] === 'applications' && rest[2] === 'slot' && method === 'POST') call = { op: 'moveSlot', key, id: rest[1], body };
  else if (COLLECTIONS.includes(rest[0])) {
    if (rest.length === 1 && method === 'POST') call = { op: 'create', key, collection: rest[0], body };
    else if (rest.length === 2 && method === 'PUT') call = { op: 'update', key, collection: rest[0], id: rest[1], body };
    else if (rest.length === 2 && method === 'DELETE') call = { op: 'remove', key, collection: rest[0], id: rest[1] };
  }
  if (!call) return json({ error: 'Not found.' }, 404);
  const res = await ws.call(call);
  return res?.error ? json({ error: res.error }, res.status) : json(res);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(request, env, url);
      } catch (e) {
        if (e instanceof StoreError) return json({ error: e.message }, e.status);
        return json({ error: 'Something went wrong on our side.' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
