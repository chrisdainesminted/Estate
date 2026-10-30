// The website's server: static files for everything, and /api/* for the
// listings platform and landlord tools.
//
// - Each landlord or seller workspace is its own Durable Object with a
//   SQLite database (store.js). The owner proves it's theirs with the
//   private key they got when they made it; only its hash is stored.
// - One more Durable Object, the directory (directory.js), indexes the
//   listings people chose to publish, for the public search.
//
// Optional settings in Cloudflare (Workers → bedrock → Settings → Variables):
// - RESEND_API_KEY and EMAIL_FROM: send email (sign-in codes). With both set,
//   a listing appears in public search only once its owner confirms their email.
// - ADMIN_KEY: opens the review page for reported listings (/homes/#admin).

import { DurableObject } from 'cloudflare:workers';
import { COLLECTIONS } from './schema.js';
import { PHOTO_TYPES, Store, StoreError, hashKey, randomToken } from './store.js';
import { DirectoryStore, REPORT_REASONS } from './directory.js';
import { cityByKey } from '../src/lib/canada.js';

const MAX_BODY = 32 * 1024;
const MAX_PHOTO = 1_500_000;
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const canEmail = (env) => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
const directory = (env) => env.DIRECTORY.get(env.DIRECTORY.idFromName('main'));

/** Equal strings in time that doesn't depend on where they differ. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(env, to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new StoreError(502, 'The email couldn’t be sent. Try again in a minute.');
}

export class Workspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.store = new Store(ctx.storage.sql);
  }

  /** Bring the public search in line with this listing (or all of them). */
  async publish(ws, listingId) {
    const s = this.store;
    const ids = listingId ? [listingId] : s.list('listings').map((l) => l.id);
    for (const id of ids) {
      const summary = s.summary(id, ws, { needVerified: canEmail(this.env) });
      if (summary) await directory(this.env).upsert(summary, cityByKey(summary.city || 'on-other').province);
      else await directory(this.env).remove(`${ws}:${id}`);
    }
  }

  /** One call from the Worker: { op, ws, key?, ...args }. */
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
        case 'photo':
          return s.getPhoto(req.photoId);
        case 'apply':
          return s.apply(req.listingId, req.body, req.ip);
        case 'status':
          return s.status(req.token);
        case 'applicantAction':
          return s.applicantAction(req.token, req.body?.action, req.body?.slotId, req.ip);
        case 'applicantMessage':
          return s.applicantMessage(req.token, req.body?.body, req.ip);
        case 'repairInfo':
          return s.repairInfo(req.unitId, req.token);
        case 'reportRepair':
          return s.reportRepair(req.unitId, req.token, req.body, req.ip);
      }
      if (!s.checkKey(await hashKey(req.key ?? ''))) throw new StoreError(401, 'This private link isn’t valid for the workspace.');
      switch (req.op) {
        case 'all':
          return { ...s.all(), config: { verification: canEmail(this.env) } };
        case 'create': {
          const item = s.create(req.collection, req.body);
          if (req.collection === 'listings') await this.publish(req.ws, item.id);
          return item;
        }
        case 'update': {
          const item = s.update(req.collection, req.id, req.body);
          if (req.collection === 'listings') await this.publish(req.ws, req.id);
          if (req.collection === 'settings') await this.publish(req.ws);
          return item;
        }
        case 'remove': {
          const ok = s.remove(req.collection, req.id);
          if (req.collection === 'listings') await directory(this.env).remove(`${req.ws}:${req.id}`);
          return { ok };
        }
        case 'moveSlot':
          return s.moveSlot(req.id, req.body?.slotId);
        case 'createSlots': {
          const made = [];
          for (const slot of Array.isArray(req.body?.slots) ? req.body.slots.slice(0, 200) : []) made.push(s.create('slots', slot));
          return made;
        }
        case 'message':
          return s.landlordMessage(req.body?.applicationId, req.body?.body);
        case 'readThread':
          s.markRead(req.id, 'applicant');
          return { ok: true };
        case 'addPhoto': {
          const l = s.addPhoto(req.listingId, req.mime, req.bytes);
          await this.publish(req.ws, req.listingId);
          return l;
        }
        case 'removePhoto': {
          const l = s.removePhoto(req.listingId, req.photoId);
          await this.publish(req.ws, req.listingId);
          return l;
        }
        case 'coverPhoto': {
          const l = s.coverPhoto(req.listingId, req.photoId);
          await this.publish(req.ws, req.listingId);
          return l;
        }
        case 'renew': {
          const l = s.renew(req.listingId);
          await this.publish(req.ws, req.listingId);
          return l;
        }
        case 'verifySend': {
          if (!canEmail(this.env)) throw new StoreError(501, 'Email isn’t set up on this site yet.');
          const { email, code } = await s.startVerify();
          await sendEmail(this.env, email, `Your Bedrock code: ${code}`, `Your code is ${code}. Enter it in Bedrock to confirm your email. It expires in 15 minutes.\n\nIf you didn’t ask for this, ignore this email.`);
          return { ok: true, email };
        }
        case 'verifyCheck': {
          const settings = await s.finishVerify(req.body?.code);
          await this.publish(req.ws);
          return settings;
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

export class Directory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new DirectoryStore(ctx.storage.sql);
  }

  upsert(summary, province) {
    this.store.upsert(summary, province);
  }

  remove(key) {
    this.store.remove(key);
  }

  async call(req) {
    try {
      switch (req.op) {
        case 'search':
          return this.store.search(req.query);
        case 'report':
          return this.store.report(req.key, req.ip, req.reason, req.note);
        case 'reported':
          return this.store.reported();
        case 'review':
          return this.store.review(req.key, req.keep);
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
const answer = (res) => (res?.error ? json({ error: res.error }, res.status) : json(res));

async function api(request, env, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  const ip = request.headers.get('cf-connecting-ip') || 'local';

  if (parts[0] === 'workspaces' && parts.length === 1 && method === 'POST') {
    const id = randomToken(12);
    const key = randomToken(24);
    const res = await env.WORKSPACE.get(env.WORKSPACE.idFromName(id)).call({ op: 'init', key, ws: id });
    if (res.error) return json({ error: res.error }, res.status);
    return json({ id, key }, 201);
  }

  // The public search, and reporting a listing.
  if (parts[0] === 'listings' && parts.length === 1 && method === 'GET') {
    const q = Object.fromEntries(url.searchParams);
    return answer(await directory(env).call({ op: 'search', query: q }));
  }
  if (parts[0] === 'listings' && parts[1] === 'report' && method === 'POST') {
    const body = await readBody(request);
    if (typeof body.key !== 'string' || body.key.length > 140) return json({ error: 'Not found.' }, 404);
    return answer(await directory(env).call({ op: 'report', key: body.key, ip, reason: REPORT_REASONS.includes(body.reason) ? body.reason : 'other', note: body.note }));
  }
  if (parts[0] === 'config' && method === 'GET') return json({ verification: canEmail(env), review: Boolean(env.ADMIN_KEY) });

  // The site owner's review of reported listings.
  if (parts[0] === 'admin') {
    const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.ADMIN_KEY || !sameText(key, env.ADMIN_KEY)) return json({ error: 'Not allowed.' }, 401);
    if (parts[1] === 'reported' && method === 'GET') return answer(await directory(env).call({ op: 'reported' }));
    if (parts[1] === 'review' && method === 'POST') {
      const body = await readBody(request);
      return answer(await directory(env).call({ op: 'review', key: String(body.key || ''), keep: Boolean(body.keep) }));
    }
    return json({ error: 'Not found.' }, 404);
  }

  if (parts[0] !== 'w' || !ID.test(parts[1] ?? '')) return json({ error: 'Not found.' }, 404);
  const wsId = parts[1];
  const ws = env.WORKSPACE.get(env.WORKSPACE.idFromName(wsId));
  const rest = parts.slice(2);
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  // Photos: served to anyone (their ids are unguessable), uploaded as raw image bytes.
  if (rest[0] === 'photos' && rest.length === 2 && method === 'GET') {
    const res = await ws.call({ op: 'photo', ws: wsId, photoId: rest[1] });
    if (res?.error) return json({ error: res.error }, res.status);
    return new Response(res.data, { headers: { 'content-type': res.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  if (rest[0] === 'listings' && rest[2] === 'photos' && rest.length === 3 && method === 'POST') {
    const mime = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!PHOTO_TYPES.includes(mime)) return json({ error: 'Photos must be JPEG, PNG or WebP.' }, 415);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO) return json({ error: 'That photo is too large.' }, 413);
    return answer(await ws.call({ op: 'addPhoto', ws: wsId, key, listingId: rest[1], mime, bytes }));
  }

  const body = method === 'POST' || method === 'PUT' ? await readBody(request) : undefined;
  let call = null;
  // Public: a listing's page and application, an applicant's status and messages, a unit's repair form.
  if (rest[0] === 'listings' && rest.length === 2 && method === 'GET') call = { op: 'publicListing', listingId: rest[1] };
  else if (rest[0] === 'listings' && rest[2] === 'apply' && method === 'POST') call = { op: 'apply', listingId: rest[1], body, ip };
  else if (rest[0] === 'status' && rest.length === 2 && method === 'GET') call = { op: 'status', token: rest[1] };
  else if (rest[0] === 'status' && rest.length === 2 && method === 'POST') call = { op: 'applicantAction', token: rest[1], body, ip };
  else if (rest[0] === 'status' && rest[2] === 'messages' && method === 'POST') call = { op: 'applicantMessage', token: rest[1], body, ip };
  else if (rest[0] === 'repair' && rest.length === 3 && method === 'GET') call = { op: 'repairInfo', unitId: rest[1], token: rest[2] };
  else if (rest[0] === 'repair' && rest.length === 3 && method === 'POST') call = { op: 'reportRepair', unitId: rest[1], token: rest[2], body, ip };
  // The owner's own records.
  else if (rest.length === 0 && method === 'GET') call = { op: 'all', key };
  else if (rest[0] === 'slots' && rest[1] === 'batch' && method === 'POST') call = { op: 'createSlots', key, body };
  else if (rest[0] === 'applications' && rest[2] === 'slot' && method === 'POST') call = { op: 'moveSlot', key, id: rest[1], body };
  else if (rest[0] === 'applications' && rest[2] === 'read' && method === 'POST') call = { op: 'readThread', key, id: rest[1] };
  else if (rest[0] === 'messages' && rest.length === 1 && method === 'POST') call = { op: 'message', key, body };
  else if (rest[0] === 'listings' && rest[2] === 'photos' && rest.length === 4 && method === 'DELETE') call = { op: 'removePhoto', key, listingId: rest[1], photoId: rest[3] };
  else if (rest[0] === 'listings' && rest[2] === 'cover' && method === 'POST') call = { op: 'coverPhoto', key, listingId: rest[1], photoId: body?.photoId };
  else if (rest[0] === 'listings' && rest[2] === 'renew' && method === 'POST') call = { op: 'renew', key, listingId: rest[1] };
  else if (rest[0] === 'verify' && rest[1] === 'send' && method === 'POST') call = { op: 'verifySend', key };
  else if (rest[0] === 'verify' && rest[1] === 'check' && method === 'POST') call = { op: 'verifyCheck', key, body };
  else if (COLLECTIONS.includes(rest[0])) {
    if (rest.length === 1 && method === 'POST') call = { op: 'create', key, collection: rest[0], body };
    else if (rest.length === 2 && method === 'PUT') call = { op: 'update', key, collection: rest[0], id: rest[1], body };
    else if (rest.length === 2 && method === 'DELETE') call = { op: 'remove', key, collection: rest[0], id: rest[1] };
  }
  if (!call) return json({ error: 'Not found.' }, 404);
  return answer(await ws.call({ ...call, ws: wsId }));
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
