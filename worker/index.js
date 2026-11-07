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
// - GOOGLE_MAPS_KEY (optional): a Google Maps browser key with the Street View Static and Maps Static
//   APIs on, restricted to this site's address. Listings then show a Street View photo of the house.
// - PLUS_EMAILS: login emails, comma-separated, that have Squarely Plus for
//   good without paying (the owner's own account, say). A secret, so the
//   addresses stay out of the code.
// - STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET: landlord billing (pricing.js).
//   A daily job charges each landlord with a card once a month; the webhook
//   at /api/stripe/webhook hears when a card is saved or a charge settles.
// - SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY: accounts
//   in Supabase (supabase.js). With all three set, people sign up and sign in
//   with Supabase Auth and everything they save is kept in its database.

import { DurableObject } from 'cloudflare:workers';
import { COLLECTIONS } from './schema.js';
import { PHOTO_TYPES, Store, StoreError, hashKey, randomToken } from './store.js';
import { DirectoryStore, REPORT_REASONS, cleanInbox, inboxEmail } from './directory.js';
import { taxReminder } from '../src/lib/landlord.js';
import { AccountStore } from './account.js';
import { LoginStore, normalEmail } from './auth.js';
import { alertMatches, alertName, feedDoc, freshMatches, normalizeMarket } from '../src/lib/market.js';
import { homeFor, withGift } from '../src/lib/firstHome.js';
import { readyReminder } from '../src/lib/journey.js';
import { cityByKey } from '../src/lib/canada.js';
import { monthlyBill } from './pricing.js';
import { stripeClient, verifyWebhook } from './stripe.js';
import { MAX_PLAN_BYTES, readBlueprint } from './blueprint.js';
import { askSquarely } from './ask.js';
import { MeStore, compEmails, isUuid, plusOwner, supabaseDb, supabaseOn, supabasePublic, verifyUser } from './supabase.js';

const MAX_BODY = 32 * 1024;
const MAX_PHOTO = 1_500_000;
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const canEmail = (env) => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
const canBill = (env) => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const directory = (env) => env.DIRECTORY.get(env.DIRECTORY.idFromName('main'));

/** Equal strings in time that doesn't depend on where they differ. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(env, to, subject, text, replyTo) {
  // Local development only (EMAIL_DEV=log in .dev.vars): print the email instead of sending it.
  if (env.EMAIL_DEV === 'log') {
    console.log(`EMAIL to ${to}: ${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new StoreError(502, 'The email couldn’t be sent. Try again in a minute.');
}

export class Workspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.store = new Store(ctx.storage.sql, undefined, { billing: canBill(env) });
  }

  /** Calls only the Worker itself makes (from Stripe's webhook and the monthly job), never from a browser. */
  async internal(req) {
    const s = this.store;
    switch (req.op) {
      case 'cardSaved':
        s.setCard(req.card);
        return { ok: true };
      case 'charge': {
        if (!s.billing().card) return { skipped: 'no card' };
        const bill = monthlyBill(s.list('units'));
        if (bill.cents < 50) return s.recordInvoice({ month: req.month, cents: 0, status: 'free' });
        const stripe = stripeClient(this.env.STRIPE_SECRET_KEY);
        const r = await stripe.charge(
          s.meta('billingCustomer'),
          s.billing().card.paymentMethod,
          bill.cents,
          `Squarely rent tracker, ${req.month}: ${bill.tenanted} tenanted unit${bill.tenanted === 1 ? '' : 's'}`,
          { workspace: req.ws, month: req.month },
          `bedrock-${req.ws}-${req.month}`,
        );
        const pi = r.data?.error?.payment_intent ?? r.data;
        const status = r.ok && pi?.status === 'succeeded' ? 'paid' : pi?.status === 'processing' ? 'processing' : 'failed';
        return s.recordInvoice({ month: req.month, cents: bill.cents, status, stripeId: pi?.id || '', error: r.ok ? '' : r.data?.error?.message || 'The charge didn’t go through.' });
      }
      case 'taxReminder': {
        const settings = s.get('settings', 'main') ?? {};
        if (!settings.taxReminder || !settings.email || (canEmail(this.env) && !settings.emailVerified)) return { skipped: true };
        const note = taxReminder({ settings, payments: s.list('payments'), expenses: s.list('expenses'), assets: s.list('assets'), year: req.year, origin: req.origin });
        return { to: settings.email, ...note };
      }
      case 'invoiceUpdate': {
        const inv = s.invoiceByStripe(req.stripeId);
        if (inv) s.recordInvoice({ ...inv, status: req.status, error: req.error || '' });
        return { ok: true };
      }
      default:
        throw new Error('Unknown internal request.');
    }
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
        case 'payInfo':
          return s.payInfo(req.unitId, req.token);
        case 'payClaim':
          return s.payClaim(req.unitId, req.token, req.body, req.ip);
      }
      // The books and their receipts also open with the view-only link a co-owner gets.
      if (req.op === 'books' || req.op === 'receipt') {
        const h = await hashKey(req.key ?? '');
        if (!s.checkKey(h) && !s.checkViewKey(h)) throw new StoreError(401, 'This link isn’t valid for these books.');
        return req.op === 'books' ? s.books() : s.getReceipt(req.receiptId);
      }
      if (!s.checkKey(await hashKey(req.key ?? ''))) throw new StoreError(401, 'This private link isn’t valid for the workspace.');
      switch (req.op) {
        case 'all':
          return { ...s.all(), config: { verification: canEmail(this.env), billing: canBill(this.env), booksShared: s.hasViewKey } };
        case 'shareBooks': {
          const viewKey = randomToken(24);
          s.setViewKey(await hashKey(viewKey));
          return { key: viewKey };
        }
        case 'unshareBooks':
          s.setViewKey('');
          return { ok: true };
        case 'addReceipt':
          return s.addReceipt(req.expenseId, req.mime, req.bytes);
        case 'removeReceipt':
          return s.removeReceipt(req.expenseId);
        case 'billingSetup': {
          if (!canBill(this.env)) throw new StoreError(501, 'Billing isn’t set up on this site yet.');
          const stripe = stripeClient(this.env.STRIPE_SECRET_KEY);
          let customer = s.meta('billingCustomer');
          if (!customer) {
            customer = (await stripe.createCustomer(req.ws, s.get('settings', 'main')?.email)).id;
            s.setCustomer(customer);
          }
          const back = `${req.origin}/app/?view=landlord`;
          const session = await stripe.setupSession(customer, req.ws, `${back}#billing=saved`, `${back}#billing=cancelled`);
          return { url: session.url };
        }
        case 'billingRemove': {
          const card = s.billing().card;
          if (card && canBill(this.env)) await stripeClient(this.env.STRIPE_SECRET_KEY).detach(card.paymentMethod).catch(() => {});
          s.clearCard();
          await directory(this.env).removeBilled(req.ws);
          return s.billing();
        }
        case 'create': {
          const item = s.create(req.collection, req.body);
          if (req.collection === 'listings') await this.publish(req.ws, item.id);
          return item;
        }
        case 'update': {
          const item = s.update(req.collection, req.id, req.body);
          if (req.collection === 'listings') await this.publish(req.ws, req.id);
          if (req.collection === 'settings') await this.publish(req.ws);
          if (req.collection === 'settings' && req.body && 'taxReminder' in req.body) await directory(this.env).setReminder(req.ws, Boolean(item.taxReminder));
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
          await sendEmail(this.env, email, `Your Squarely code: ${code}`, `Your code is ${code}. Enter it in Squarely to confirm your email. It expires in 15 minutes.\n\nIf you didn’t ask for this, ignore this email.`);
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
    this.env = env;
    this.store = new DirectoryStore(ctx.storage.sql);
    this.logins = new LoginStore(ctx.storage.sql);
  }

  /** Email-and-password sign-in (auth.js). Rate-limited per address. */
  async auth(req) {
    try {
      this.store.limit(req.ip, `auth-${req.op}`, req.op === 'login' ? 30 : req.op === 'forgot' ? 5 : 10);
      if (req.op === 'signup') return await this.logins.signup(req.email, req.password, req.account);
      if (req.op === 'login') return await this.logins.login(req.email, req.password);
      if (req.op === 'password') return await this.logins.changePassword(req.email, req.password, req.next);
      if (req.op === 'remove') return (await this.logins.remove(req.email), { ok: true });
      if (req.op === 'forgot') return (await this.logins.startReset(req.email)) ?? { token: null };
      if (req.op === 'reset') return await this.logins.finishReset(req.email, req.token, req.password, (id) => this.env.ACCOUNT.get(this.env.ACCOUNT.idFromName(id)).rekey());
      throw new StoreError(404, 'Unknown request.');
    } catch (e) {
      if (e instanceof StoreError) return { error: e.message, status: e.status };
      throw e;
    }
  }

  upsert(summary, province) {
    this.store.upsert(summary, province);
  }

  remove(key) {
    this.store.remove(key);
  }

  setReminder(ws, on) {
    this.store.setReminder(ws, on);
  }

  dueReminders(year, limit) {
    return this.store.dueReminders(year, limit);
  }

  markReminded(ws, year) {
    this.store.markReminded(ws, year);
  }

  addBilled(ws) {
    this.store.addBilled(ws);
  }

  removeBilled(ws) {
    this.store.removeBilled(ws);
  }

  dueBilling(month, limit) {
    return this.store.dueBilling(month, limit);
  }

  markCharged(ws, month) {
    this.store.markCharged(ws, month);
  }

  setAlerting(id, on) {
    this.store.setAlerting(id, on);
  }

  dueAlerts(date, limit) {
    return this.store.dueAlerts(date, limit);
  }

  markAlerted(id, date) {
    this.store.markAlerted(id, date);
  }

  /**
   * Map points for listing addresses: cached ones straight away, and up to
   * GEO_PER_CALL new ones looked up on OpenStreetMap's Nominatim, one a
   * second at most across the whole site, as its usage policy asks.
   */
  async geocode(queries, ip) {
    this.store.limit(ip, 'geo', 120);
    const { known, missing } = this.store.geoGet(queries);
    for (const q of missing.slice(0, GEO_PER_CALL)) {
      const wait = (this.geoAt ?? 0) + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.geoAt = Date.now();
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&q=${encodeURIComponent(q)}`, {
          headers: { 'user-agent': 'Squarely/1.0 (https://bedrock.signia83.workers.dev/)', 'accept-language': 'en-CA' },
        });
        if (!res.ok) break; // leave the rest for later rather than record a miss
        const hit = (await res.json())[0];
        const point = hit ? [Number(hit.lat), Number(hit.lon)] : null;
        this.store.geoPut(q, point);
        if (point) known[q] = point;
      } catch {
        break;
      }
    }
    const pending = this.store.geoGet(queries).missing.length;
    return { points: known, pending };
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
        case 'addInbox':
          return this.store.addInbox(req.kind, req.data, req.ip);
        case 'inbox':
          return this.store.inbox();
        case 'inboxDone':
          return this.store.inboxDone(req.id, req.done);
        case 'geocode':
          return await this.geocode(req.queries, req.ip);
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

/**
 * One person's account: their library and listing alerts (see account.js).
 * Every call but 'init' carries the account key.
 */
export class Account extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.store = new AccountStore(ctx.storage.sql);
  }

  async call(req) {
    const a = this.store;
    a.setComp(String(this.env.PLUS_EMAILS || '').split(','));
    try {
      if (req.op === 'init') {
        a.init(await hashKey(req.key));
        return { ok: true };
      }
      await a.checkKey(req.key);
      switch (req.op) {
        case 'read':
          return a.read();
        case 'export':
          // Everything, for moving this account to Supabase.
          return { ...a.read(), plusRaw: a.plus(), lastSent: a.lastSent(), readySent: a.meta('readySent') || '' };
        case 'write': {
          // Turning the savings-month email on or off changes whether the daily run looks at this account.
          const reminder = (d) => `${d?.settings?.home?.remindReady === true}|${d?.settings?.home?.readyBy ?? ''}`;
          const before = reminder(a.read().data);
          const r = a.write(req.body?.data, req.body?.updatedAt);
          if (!r.stale && reminder(a.read().data) !== before) await this.register(req.id);
          return r;
        }
        case 'alerts': {
          const alerts = a.setAlerts(req.body?.alerts);
          await this.register(req.id);
          return { alerts };
        }
        case 'emailSend': {
          if (!canEmail(this.env)) throw new StoreError(501, 'Email isn’t set up on this site yet; alerts show in the app for now.');
          const { email, code } = await a.startEmail(req.body?.email);
          await sendEmail(this.env, email, `Your Squarely code: ${code}`, `Your code is ${code}. Enter it in Squarely to get listing alerts by email. It expires in 15 minutes.\n\nIf you didn’t ask for this, ignore this email.`);
          return { ok: true, email };
        }
        case 'emailCheck': {
          const r = await a.finishEmail(req.body?.code);
          await this.register(req.id);
          return r;
        }
        case 'emailDrop': {
          const r = a.dropEmail();
          await this.register(req.id);
          return r;
        }
        case 'section':
          return { [req.name]: a.setSection(req.name, req.body?.value) };
        case 'plusStart': {
          if (!canBill(this.env)) throw new StoreError(501, 'Squarely Plus isn’t on sale on this site yet.');
          if (a.isPlus) throw new StoreError(409, 'You already have Squarely Plus.');
          const stripe = stripeClient(this.env.STRIPE_SECRET_KEY);
          let customer = a.plus().customer;
          if (!customer) {
            const r = a.read();
            customer = (await stripe.createCustomer(null, r.loginEmail || r.email, { account: req.id })).id;
            a.setPlus({ customer });
          }
          const back = `${req.origin}/app/`;
          const session = await stripe.subscribeSession({ customer, account: req.id, successUrl: `${back}?plus=welcome`, cancelUrl: `${back}?plus=cancelled` });
          return { url: session.url };
        }
        case 'plusManage': {
          if (!canBill(this.env) || !a.plus().customer) throw new StoreError(404, 'There’s no subscription on this account.');
          const portal = await stripeClient(this.env.STRIPE_SECRET_KEY).portalSession(a.plus().customer, `${req.origin}/app/`);
          return { url: portal.url };
        }
        case 'blueprint': {
          if (!a.isPlus) throw new StoreError(402, 'Reading blueprints is part of Squarely Plus.');
          if (!this.env.ANTHROPIC_API_KEY) throw new StoreError(501, 'Reading blueprints isn’t switched on for this site yet. Type the rooms in for now.');
          a.useDaily('blueprint', 20);
          return readBlueprint(this.env.ANTHROPIC_API_KEY, req.body ?? {});
        }
        case 'ask': {
          if (!a.isPlus) throw new StoreError(402, 'Ask Squarely on the website is part of Squarely Plus.');
          if (!this.env.ANTHROPIC_API_KEY) throw new StoreError(501, 'Ask Squarely isn’t switched on for this site yet.');
          a.useDaily('ask', 40);
          return askSquarely(this.env.ANTHROPIC_API_KEY, req.body ?? {});
        }
        case 'setLoginEmail':
          a.setLoginEmail(req.email);
          return { ok: true };
        case 'wipe': {
          await directory(this.env).setAlerting(req.id, false);
          const login = a.read().loginEmail;
          if (login) await directory(this.env).auth({ op: 'remove', email: login, ip: 'internal' });
          return a.wipe();
        }
        default:
          throw new StoreError(404, 'Unknown request.');
      }
    } catch (e) {
      if (e instanceof StoreError) return { error: e.message, status: e.status };
      throw e;
    }
  }

  /** After a password reset (called only by the Directory, never from a browser). */
  async rekey() {
    return this.store.rekey();
  }

  /** What Stripe says about the Plus subscription (called only from its signed webhook). */
  async plusUpdate(id, patch) {
    if (!this.store.ready) return { ok: false };
    this.store.setPlus(patch);
    await this.register(id);
    return { ok: true };
  }

  /** On the daily digest list only with a confirmed email and alerts or the savings-month email. */
  async register(id) {
    const r = this.store.read();
    const home = r.data?.settings?.home;
    const remind = home?.remindReady === true && typeof home?.readyBy === 'string';
    // Listing alert emails are part of Plus; the savings-month email is for everyone.
    await directory(this.env).setAlerting(id, Boolean(r.emailVerified && r.email && ((r.alerts.length && r.plus.active) || remind)));
  }

  /** The day's alert email (see sendDigest). */
  async digest(id, today, origin) {
    const a = this.store;
    if (!a.ready) return { sent: false };
    const r = a.read();
    if (!r.emailVerified || !r.email) return { sent: false };
    const out = await sendDigest(
      this.env,
      { data: r.data, alerts: r.alerts, email: r.email, plus: a.isPlus, lastSent: a.lastSent(), readySent: a.meta('readySent') || '' },
      today,
      origin,
      async (p) => {
        if (p.readySent) a.setMeta('readySent', p.readySent);
        if (p.lastSent) a.markSent(p.lastSent);
      },
    );
    return { sent: out.sent };
  }
}

/**
 * One person's email for the day: the savings-month note when it's due,
 * and listings new or cheaper since the last email, for each alert (alerts
 * are part of Plus). `remember` saves { readySent } and { lastSent } as
 * soon as each is true, so nothing is sent twice.
 */
async function sendDigest(env, { data, alerts, email, plus, lastSent, readySent }, today, origin, remember) {
  const since = lastSent || today;
  const market = data?.settings?.market;
  const profile = withGift(data?.settings?.home);
  let sent = false;
  // The month the savings plan said they'd be ready: one email, once.
  const note = readyReminder({ profile: data?.settings?.home, ratePct: normalizeMarket(market).rate, today, origin, sent: readySent || '' });
  if (note) {
    await sendEmail(env, email, note.subject, `${note.body}\n\nTo stop these emails, open Squarely and turn off email in your account.`);
    await remember({ readySent: note.month });
    sent = true;
  }
  if (!alerts?.length || !plus) return { sent };
  const feeds = new Map();
  const sections = [];
  for (const alert of alerts) {
    if (!feeds.has(alert.city)) {
      const res = await env.ASSETS.fetch(new Request(`${origin}/data/${feedDoc(alert.city)}.json`));
      feeds.set(alert.city, res.ok ? await res.json().catch(() => null) : null);
    }
    const fresh = freshMatches(alertMatches(alert, feeds.get(alert.city), { market, profile, homeFor }), alert.since > since ? alert.since : since);
    if (fresh.length) sections.push({ alert, fresh });
  }
  await remember({ lastSent: today });
  if (!sections.length) return { sent };
  const body = sections
    .map(({ alert, fresh }) =>
      [
        `${alertName(alert, cityByKey(alert.city).name)}: ${fresh.length} new or cheaper`,
        ...fresh.slice(0, 10).map(({ listing: l, costToLive, perDoor }) => `- ${l.address}, $${Math.round(l.price).toLocaleString('en-CA')}${costToLive != null ? `, about ${Math.round(costToLive).toLocaleString('en-CA')}/mo to live in` : ''}${perDoor == null ? ', tax not listed yet' : `, ${perDoor >= 0 ? '+' : '-'}${Math.abs(Math.round(perDoor)).toLocaleString('en-CA')}/door`}\n  ${l.url}`),
      ].join('\n'),
    )
    .join('\n\n');
  await sendEmail(env, email, `Squarely: ${sections.reduce((n, x) => n + x.fresh.length, 0)} homes match your alerts`, `${body}\n\nSee them all in Squarely: ${origin}/app/?view=listings\n\nTo stop these emails, open Squarely and turn off email alerts in your account.`);
  return { sent: true };
}

async function readBody(request, max = MAX_BODY) {
  if (Number(request.headers.get('content-length') || 0) > max) throw new StoreError(413, 'That’s too much to send at once.');
  const text = await request.text();
  if (text.length > max) throw new StoreError(413, 'That’s too much text.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new StoreError(400, 'Couldn’t read that request.');
  }
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const GEO_PER_CALL = 4;
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

  // Accounts in Supabase: everything with the person's access token.
  if (parts[0] === 'me') {
    if (!supabaseOn(env)) return json({ error: 'Not found.' }, 404);
    return meApi(request, env, url, parts.slice(1).join('/'), method);
  }
  const moved = () => json({ error: 'Squarely accounts have moved. Make your account again with the same email; your saved deals come with you.' }, 410);

  // Accounts: create one, then everything else with its key.
  if (parts[0] === 'accounts' && parts.length === 1 && method === 'POST') {
    if (supabaseOn(env)) return moved();
    const id = randomToken(12);
    const key = randomToken(24);
    const res = await env.ACCOUNT.get(env.ACCOUNT.idFromName(id)).call({ op: 'init', key });
    if (res.error) return json({ error: res.error }, res.status);
    return json({ id, key }, 201);
  }
  // Sign up, sign in and change password with an email and password.
  if (parts[0] === 'auth' && parts.length === 2 && method === 'POST') {
    const body = await readBody(request);
    const email = normalEmail(body.email);
    if (parts[1] === 'login') return answer(await directory(env).auth({ op: 'login', email, password: body.password, ip }));
    if (parts[1] === 'password') return answer(await directory(env).auth({ op: 'password', email, password: body.password, next: body.next, ip }));
    if (parts[1] === 'forgot') {
      if (!canEmail(env)) return json({ error: 'Password reset by email isn’t switched on yet. Use the backup link from your account page, or contact us.' }, 501);
      const res = await directory(env).auth({ op: 'forgot', email, ip });
      if (res.error) return json({ error: res.error }, res.status);
      if (res.token) {
        const link = `${url.origin}/account/#reset=${res.token}&email=${encodeURIComponent(email)}`;
        await sendEmail(
          env,
          email,
          'Reset your Squarely password',
          `Someone (hopefully you) asked to reset the password for your Squarely account.\n\nChoose a new password here: ${link}\n\nThe link works once and expires in an hour. After the reset, sign in again on your other devices; your old backup link stops working and your account page shows a new one.\n\nIf you didn’t ask for this, ignore this email: your password stays the same.`,
        );
      }
      // The same answer whether or not there's an account with that email.
      return json({ ok: true });
    }
    if (parts[1] === 'reset') return answer(await directory(env).auth({ op: 'reset', email, token: body.token, password: body.password, ip }));
    if (parts[1] === 'signup') {
      if (supabaseOn(env)) return moved();
      // Attach the account this browser already has, if it sends one that opens; otherwise start a new one.
      let account = null;
      if (body.account && ID.test(body.account.id ?? '') && typeof body.account.key === 'string') {
        const r = await env.ACCOUNT.get(env.ACCOUNT.idFromName(body.account.id)).call({ op: 'read', id: body.account.id, key: body.account.key });
        if (!r.error && !r.loginEmail) account = { id: body.account.id, key: body.account.key };
      }
      if (!account) {
        account = { id: randomToken(12), key: randomToken(24) };
        const made = await env.ACCOUNT.get(env.ACCOUNT.idFromName(account.id)).call({ op: 'init', key: account.key });
        if (made.error) return json({ error: made.error }, made.status);
      }
      const res = await directory(env).auth({ op: 'signup', email, password: body.password, account, ip });
      if (res.error) return json({ error: res.error }, res.status);
      await env.ACCOUNT.get(env.ACCOUNT.idFromName(account.id)).call({ op: 'setLoginEmail', id: account.id, key: account.key, email });
      return json(account, 201);
    }
    return json({ error: 'Not found.' }, 404);
  }

  if (parts[0] === 'a' && ID.test(parts[1] ?? '')) {
    const id = parts[1];
    const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const sub = parts.slice(2).join('/');
    // A whole library, or a plan as base64, is bigger than an ordinary request.
    const limit = sub === 'blueprint' ? Math.ceil(MAX_PLAN_BYTES * 1.4) : sub === '' ? 2_000_000 : sub === 'ask' ? 64 * 1024 : MAX_BODY;
    const body = method === 'GET' || method === 'DELETE' ? null : await readBody(request, limit);
    const op =
      sub === '' && method === 'GET' ? 'read'
      : sub === '' && method === 'PUT' ? 'write'
      : sub === '' && method === 'DELETE' ? 'wipe'
      : sub === 'alerts' && method === 'PUT' ? 'alerts'
      : sub === 'email' && method === 'POST' ? 'emailSend'
      : sub === 'email/check' && method === 'POST' ? 'emailCheck'
      : sub === 'email' && method === 'DELETE' ? 'emailDrop'
      : /^s\/[a-z]+$/.test(sub) && method === 'PUT' ? 'section'
      : sub === 'plus' && method === 'POST' ? 'plusStart'
      : sub === 'plus/manage' && method === 'POST' ? 'plusManage'
      : sub === 'blueprint' && method === 'POST' ? 'blueprint'
      : sub === 'ask' && method === 'POST' ? 'ask'
      : null;
    if (!op) return json({ error: 'Not found.' }, 404);
    return answer(await env.ACCOUNT.get(env.ACCOUNT.idFromName(id)).call({ op, id, key, body, name: sub.slice(2), origin: url.origin }));
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
  // A note to the site's owner, or a request to be put in touch with a mortgage broker.
  if ((parts[0] === 'contact' || parts[0] === 'broker') && parts.length === 1 && method === 'POST') {
    const body = await readBody(request);
    if (body.website) return json({ ok: true }); // the honeypot field people never see
    const data = cleanInbox(parts[0], body);
    if (data.error) return json({ error: data.error }, 400);
    const saved = await directory(env).call({ op: 'addInbox', kind: parts[0], data, ip });
    if (!saved?.error && canEmail(env) && env.OWNER_EMAIL) {
      const note = inboxEmail(parts[0], data, url.origin);
      await sendEmail(env, env.OWNER_EMAIL, note.subject, note.text, note.replyTo).catch((e) => console.error('owner email failed', e?.message));
    }
    return answer(saved);
  }

  // Map points for listing addresses ("228 Archibald Street S, Thunder Bay, ON").
  if (parts[0] === 'geo' && method === 'POST') {
    const body = await readBody(request);
    const queries = [...new Set((Array.isArray(body.queries) ? body.queries : []).filter((q) => typeof q === 'string' && q.length > 3 && q.length <= 160))].slice(0, 80);
    return answer(await directory(env).call({ op: 'geocode', queries, ip }));
  }
  // mapsKey: a Google Maps browser key (GOOGLE_MAPS_KEY), for Street View and satellite photos of listings. Browser keys are public by
  // design; restrict it to this site's address in Google Cloud so it only works here.
  if (parts[0] === 'config' && method === 'GET') return json({ verification: canEmail(env), review: Boolean(env.ADMIN_KEY), billing: canBill(env), mapsKey: String(env.GOOGLE_MAPS_KEY || ''), supabase: supabasePublic(env) });
  if (parts[0] === 'stripe' && parts[1] === 'webhook' && method === 'POST') return stripeWebhook(request, env);

  // The site owner's review of reported listings.
  if (parts[0] === 'admin') {
    const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.ADMIN_KEY || !sameText(key, env.ADMIN_KEY)) return json({ error: 'Not allowed.' }, 401);
    if (parts[1] === 'reported' && method === 'GET') return answer(await directory(env).call({ op: 'reported' }));
    if (parts[1] === 'inbox' && method === 'GET') return answer(await directory(env).call({ op: 'inbox' }));
    if (parts[1] === 'inbox' && method === 'POST') {
      const body = await readBody(request);
      return answer(await directory(env).call({ op: 'inboxDone', id: body.id, done: Boolean(body.done) }));
    }
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
    return new Response(res.data, { headers: { 'content-type': res.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }
  if (rest[0] === 'listings' && rest[2] === 'photos' && rest.length === 3 && method === 'POST') {
    const mime = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!PHOTO_TYPES.includes(mime)) return json({ error: 'Photos must be JPEG, PNG or WebP.' }, 415);
    if (Number(request.headers.get('content-length') || 0) > MAX_PHOTO) return json({ error: 'That photo is too large.' }, 413);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO) return json({ error: 'That photo is too large.' }, 413);
    return answer(await ws.call({ op: 'addPhoto', ws: wsId, key, listingId: rest[1], mime, bytes }));
  }

  // Receipts: a private photo per expense, read with the workspace's key (or the co-owner's view-only key).
  if (rest[0] === 'receipts' && rest.length === 2 && method === 'GET') {
    const res = await ws.call({ op: 'receipt', ws: wsId, key, receiptId: rest[1] });
    if (res?.error) return json({ error: res.error }, res.status);
    return new Response(res.data, { headers: { 'content-type': res.mime, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
  }
  if (rest[0] === 'expenses' && rest[2] === 'receipt' && rest.length === 3 && method === 'POST') {
    const mime = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!PHOTO_TYPES.includes(mime)) return json({ error: 'Receipts must be a JPEG, PNG or WebP photo.' }, 415);
    if (Number(request.headers.get('content-length') || 0) > MAX_PHOTO) return json({ error: 'That photo is too large.' }, 413);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO) return json({ error: 'That photo is too large.' }, 413);
    return answer(await ws.call({ op: 'addReceipt', ws: wsId, key, expenseId: rest[1], mime, bytes }));
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
  else if (rest[0] === 'pay' && rest.length === 3 && method === 'GET') call = { op: 'payInfo', unitId: rest[1], token: rest[2] };
  else if (rest[0] === 'pay' && rest.length === 3 && method === 'POST') call = { op: 'payClaim', unitId: rest[1], token: rest[2], body, ip };
  // The owner's own records.
  else if (rest.length === 0 && method === 'GET') call = { op: 'all', key };
  else if (rest[0] === 'books' && rest.length === 1 && method === 'GET') call = { op: 'books', key };
  else if (rest[0] === 'share' && rest.length === 1 && method === 'POST') call = { op: 'shareBooks', key };
  else if (rest[0] === 'share' && rest.length === 1 && method === 'DELETE') call = { op: 'unshareBooks', key };
  else if (rest[0] === 'expenses' && rest[2] === 'receipt' && rest.length === 3 && method === 'DELETE') call = { op: 'removeReceipt', key, expenseId: rest[1] };
  else if (rest[0] === 'slots' && rest[1] === 'batch' && method === 'POST') call = { op: 'createSlots', key, body };
  else if (rest[0] === 'applications' && rest[2] === 'slot' && method === 'POST') call = { op: 'moveSlot', key, id: rest[1], body };
  else if (rest[0] === 'applications' && rest[2] === 'read' && method === 'POST') call = { op: 'readThread', key, id: rest[1] };
  else if (rest[0] === 'messages' && rest.length === 1 && method === 'POST') call = { op: 'message', key, body };
  else if (rest[0] === 'listings' && rest[2] === 'photos' && rest.length === 4 && method === 'DELETE') call = { op: 'removePhoto', key, listingId: rest[1], photoId: rest[3] };
  else if (rest[0] === 'listings' && rest[2] === 'cover' && method === 'POST') call = { op: 'coverPhoto', key, listingId: rest[1], photoId: body?.photoId };
  else if (rest[0] === 'listings' && rest[2] === 'renew' && method === 'POST') call = { op: 'renew', key, listingId: rest[1] };
  else if (rest[0] === 'billing' && rest[1] === 'setup' && method === 'POST') call = { op: 'billingSetup', key, origin: url.origin };
  else if (rest[0] === 'billing' && rest[1] === 'card' && method === 'DELETE') call = { op: 'billingRemove', key };
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

/**
 * /api/me: the signed-in person's account in Supabase, with the same
 * requests and answers as /api/a/<id> (the older accounts), plus 'import'
 * to bring one of those over.
 */
async function meApi(request, env, url, sub, method) {
  const user = await verifyUser(env, (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  // A whole library, or a plan as base64, is bigger than an ordinary request.
  const limit = sub === 'blueprint' ? Math.ceil(MAX_PLAN_BYTES * 1.4) : sub === '' ? 2_000_000 : sub === 'ask' ? 64 * 1024 : MAX_BODY;
  const body = method === 'GET' || method === 'DELETE' ? null : await readBody(request, limit);
  const me = new MeStore(supabaseDb(env), user, { comp: compEmails(env) });
  const post = method === 'POST';
  const section = /^s\/([a-z]+)$/.exec(sub);

  if (sub === '' && method === 'GET') return json(await me.read());
  if (sub === '' && method === 'PUT') return json(await me.write(body?.data, body?.updatedAt));
  if (sub === '' && method === 'DELETE') return json(await me.wipe());
  if (sub === 'alerts' && method === 'PUT') return json({ alerts: await me.setAlerts(body?.alerts) });
  if (section && method === 'PUT') return json({ [section[1]]: await me.setSection(section[1], body?.value) });
  if (sub === 'email' && post) {
    if (!canEmail(env)) throw new StoreError(501, 'Email isn’t set up on this site yet; alerts show in the app for now.');
    const { email, code } = await me.startEmail(body?.email);
    await sendEmail(env, email, `Your Squarely code: ${code}`, `Your code is ${code}. Enter it in Squarely to get listing alerts by email. It expires in 15 minutes.\n\nIf you didn’t ask for this, ignore this email.`);
    return json({ ok: true, email });
  }
  if (sub === 'email/check' && post) return json(await me.finishEmail(body?.code));
  if (sub === 'email' && method === 'DELETE') return json(await me.dropEmail());
  if (sub === 'plus' && post) {
    if (!canBill(env)) throw new StoreError(501, 'Squarely Plus isn’t on sale on this site yet.');
    if (await me.isPlus()) throw new StoreError(409, 'You already have Squarely Plus.');
    const stripe = stripeClient(env.STRIPE_SECRET_KEY);
    let { customer } = await me.plus();
    if (!customer) {
      customer = (await stripe.createCustomer(null, user.email, { user: user.id })).id;
      await me.setPlus({ customer });
    }
    const back = `${url.origin}/app/`;
    const session = await stripe.subscribeSession({ customer, account: user.id, metadata: { user: user.id }, successUrl: `${back}?plus=welcome`, cancelUrl: `${back}?plus=cancelled` });
    return json({ url: session.url });
  }
  if (sub === 'plus/manage' && post) {
    const { customer } = await me.plus();
    if (!canBill(env) || !customer) throw new StoreError(404, 'There’s no subscription on this account.');
    return json({ url: (await stripeClient(env.STRIPE_SECRET_KEY).portalSession(customer, `${url.origin}/app/`)).url });
  }
  if (sub === 'blueprint' && post) {
    if (!(await me.isPlus())) throw new StoreError(402, 'Reading blueprints is part of Squarely Plus.');
    if (!env.ANTHROPIC_API_KEY) throw new StoreError(501, 'Reading blueprints isn’t switched on for this site yet. Type the rooms in for now.');
    await me.useDaily('blueprint', 20);
    return json(await readBlueprint(env.ANTHROPIC_API_KEY, body ?? {}));
  }
  if (sub === 'ask' && post) {
    if (!(await me.isPlus())) throw new StoreError(402, 'Ask Squarely on the website is part of Squarely Plus.');
    if (!env.ANTHROPIC_API_KEY) throw new StoreError(501, 'Ask Squarely isn’t switched on for this site yet.');
    await me.useDaily('ask', 40);
    return json(await askSquarely(env.ANTHROPIC_API_KEY, body ?? {}));
  }
  if (sub === 'import' && post) {
    // An account from before: its private link ({ id, key }), from this browser or from signing in with its old password.
    const id = String(body?.id || '');
    if (!ID.test(id) || typeof body?.key !== 'string') throw new StoreError(400, 'That isn’t an account link.');
    const old = await env.ACCOUNT.get(env.ACCOUNT.idFromName(id)).call({ op: 'export', id, key: body.key });
    if (old?.error) throw new StoreError(400, 'That older account didn’t open. It may have been deleted.');
    const r = await me.importLegacy(id, old);
    // Its emails now come from the new account only.
    await directory(env).setAlerting(id, false);
    return json(r);
  }
  return json({ error: 'Not found.' }, 404);
}

/** Stripe tells us when a card is saved and when a charge settles. */
async function stripeWebhook(request, env) {
  if (!canBill(env)) return json({ error: 'Not set up.' }, 404);
  const payload = await request.text();
  if (!(await verifyWebhook(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return json({ error: 'Bad signature.' }, 400);
  const event = JSON.parse(payload);
  const obj = event.data?.object ?? {};
  // Squarely Plus: the subscription's state, kept on the account it was bought for.
  const accountId = obj.metadata?.account;
  const userId = obj.metadata?.user;
  if ((accountId && ID.test(accountId)) || isUuid(userId)) {
    let patch = null;
    if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') patch = { status: 'active', customer: obj.customer, subscription: obj.subscription };
    if (event.type.startsWith('customer.subscription.')) {
      const end = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
      patch = {
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status,
        subscription: obj.id,
        customer: obj.customer,
        until: end ? end * 1000 : 0,
        cancelAt: obj.cancel_at_period_end && end ? end * 1000 : 0,
      };
    }
    if (patch && accountId && ID.test(accountId)) await env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId)).plusUpdate(accountId, patch);
    if (patch && supabaseOn(env)) {
      // Bought in Supabase, or on an older account that has since moved there.
      const db = supabaseDb(env);
      const owner = await plusOwner(db, { user: userId, account: accountId });
      try {
        if (owner) await new MeStore(db, { id: owner, email: '' }).setPlus(patch);
      } catch (e) {
        // The person deleted their account since: nothing to keep in step. Anything else, Stripe tries again.
        if (!(e instanceof StoreError && e.status === 404)) throw e;
      }
    }
    return json({ ok: true });
  }
  const wsId = obj.metadata?.workspace;
  if (!wsId || !ID.test(wsId)) return json({ ok: true });
  const ws = env.WORKSPACE.get(env.WORKSPACE.idFromName(wsId));
  if (event.type === 'checkout.session.completed' && obj.mode === 'setup' && obj.setup_intent) {
    const stripe = stripeClient(env.STRIPE_SECRET_KEY);
    const intent = await stripe.setupIntent(obj.setup_intent);
    const pm = await stripe.paymentMethod(intent.payment_method);
    await ws.internal({ op: 'cardSaved', card: { paymentMethod: pm.id, brand: pm.card?.brand || 'card', last4: pm.card?.last4 || '', expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year } });
    await directory(env).addBilled(wsId);
    // A new card after a failed charge: try again in the next daily run.
    await directory(env).markCharged(wsId, '');
  }
  if (event.type === 'payment_intent.succeeded') await ws.internal({ op: 'invoiceUpdate', stripeId: obj.id, status: 'paid' });
  if (event.type === 'payment_intent.payment_failed') await ws.internal({ op: 'invoiceUpdate', stripeId: obj.id, status: 'failed', error: obj.last_payment_error?.message });
  return json({ ok: true });
}

/** Each day, charge up to 20 landlords not yet charged this month (spread out to stay within Cloudflare's per-run limits). */
async function chargeMonth(env) {
  if (!canBill(env)) return;
  const month = thisMonth();
  for (const wsId of await directory(env).dueBilling(month, 20)) {
    try {
      await env.WORKSPACE.get(env.WORKSPACE.idFromName(wsId)).internal({ op: 'charge', ws: wsId, month });
      await directory(env).markCharged(wsId, month);
    } catch {
      // Stripe or the workspace didn't answer: this one is tried again tomorrow.
    }
  }
}

/** Each day in February, up to 50 landlords who asked get last year's tax-season email. */
async function sendTaxReminders(env) {
  const now = new Date();
  if (!canEmail(env) || now.getUTCMonth() !== 1) return;
  const year = now.getUTCFullYear() - 1;
  const origin = env.SITE_URL || 'https://bedrock.signia83.workers.dev';
  for (const wsId of await directory(env).dueReminders(year, 50)) {
    try {
      const r = await env.WORKSPACE.get(env.WORKSPACE.idFromName(wsId)).internal({ op: 'taxReminder', year, origin });
      if (r?.to) await sendEmail(env, r.to, r.subject, r.text);
    } catch {
      // Tried again tomorrow only if it wasn't marked: mark it so one bad workspace can't hold up the rest.
    }
    await directory(env).markReminded(wsId, year);
  }
}

/** Each day, at most 50 Supabase accounts' emails: alerts and the savings-month note. */
async function sendSupabaseAlerts(env) {
  if (!canEmail(env) || !supabaseOn(env)) return;
  const today = new Date().toISOString().slice(0, 10);
  const origin = env.SITE_URL || 'https://bedrock.signia83.workers.dev';
  const db = supabaseDb(env);
  const comp = compEmails(env);
  for (const row of (await db.rpc('squarely_due_alerts', { p_today: today, p_limit: 50 })) ?? []) {
    const me = new MeStore(db, { id: row.user_id, email: row.login_email || '' }, { comp });
    const remember = (p) => db.update('accounts', { user_id: `eq.${row.user_id}` }, { ...(p.readySent ? { ready_sent: p.readySent } : {}), ...(p.lastSent ? { last_sent: p.lastSent } : {}) });
    try {
      await sendDigest(env, { data: row.library, alerts: row.alerts, email: row.alert_email, plus: await me.isPlus(), lastSent: row.last_sent || '', readySent: row.ready_sent || '' }, today, origin, remember);
    } catch (e) {
      console.error('alerts failed', e?.message);
    }
    // Looked at today, whether or not anything went out: tomorrow it's someone else's turn first.
    await remember({ lastSent: today }).catch(() => {});
  }
}

/** Each day, at most 50 accounts' alert emails (only once email is set up). */
async function sendAlerts(env) {
  if (!canEmail(env) || !env.ACCOUNT) return;
  const today = new Date().toISOString().slice(0, 10);
  const origin = env.SITE_URL || 'https://bedrock.signia83.workers.dev';
  for (const id of await directory(env).dueAlerts(today, 50)) {
    try {
      await env.ACCOUNT.get(env.ACCOUNT.idFromName(id)).digest(id, today, origin);
    } catch {
      // One failed email shouldn't stop the rest; it's tried again tomorrow.
    }
    await directory(env).markAlerted(id, today);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([chargeMonth(env), sendAlerts(env), sendSupabaseAlerts(env), sendTaxReminders(env)]));
  },

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
