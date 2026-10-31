import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, Flag, Printer, Receipt, Send, ShieldAlert, Wallet, Wrench } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountLink from '../components/AccountLink.jsx';
import { useAccount } from '../hooks/useAccount.js';
import { Button } from '../components/ui.jsx';
import { call, hashParams, links } from '../lib/landlordApi.js';
import { money } from '../lib/format.js';
import { byDay, dateLabel, downloadIcs, icsFile, timeLabel, whenLabel } from '../lib/when.js';
import { PROPERTY_TYPES } from '../../worker/schema.js';
import { cityByKey } from '../lib/canada.js';
import { minDownPayment, mortgagePlan } from '../lib/firstHome.js';
import { DEFAULT_MARKET } from '../lib/market.js';

/**
 * The public side of the landlord tools, one page chosen by its link:
 * #w=…&l=… applies for a listing and picks a viewing time, #w=…&s=… is an
 * applicant's own status page, #w=…&u=…&t=… is a tenant's page: report a
 * repair, or (with &v=pay) pay rent and get receipts.
 */
export default function RentPage() {
  const [params, setParams] = useState(() => hashParams(location.hash));
  useEffect(() => {
    const on = () => setParams(hashParams(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const { w, l, s, u, t, v } = params;
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Squarely home">
            <Logo />
          </a>
          <AccountLink />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {w && l ? <Apply ws={w} listingId={l} /> : w && s ? <Status ws={w} token={s} /> : w && u && t ? <Tenant ws={w} unitId={u} token={t} start={v === 'pay' ? 'pay' : 'repair'} /> : <Nothing />}
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
        Your details go only to this landlord. Squarely deletes closed applications after 180 days.{' '}
        <a href="/privacy/" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white">
          Privacy
        </a>
      </footer>
      <SiteFooter width="max-w-2xl" />
    </div>
  );
}

const h1 = 'text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const input = 'field w-full px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100';

function Nothing() {
  return (
    <div>
      <h1 className={h1}>This link is missing something</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">Ask the landlord to send it again, or copy the whole link into your browser.</p>
    </div>
  );
}

function Loading() {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>;
}

function Problem({ children }) {
  return (
    <p role="alert" className="flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function Field({ id, title, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

/** Viewing times grouped by day, as one radio group. */
function SlotPicker({ slots, value, onChange, noneLabel = 'None of these work for me' }) {
  if (!slots.length) return <p className="text-sm text-zinc-600 dark:text-zinc-400">No viewing times are open right now. Apply anyway and the landlord will suggest one.</p>;
  return (
    <fieldset>
      <legend className="sr-only">Viewing time</legend>
      <div className="grid gap-4">
        {byDay(slots).map((g) => (
          <div key={g.day}>
            <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.list.map((sl) => (
                <label
                  key={sl.id}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--accent) ${value === sl.id ? 'border-(--accent) bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-(--line-strong) text-zinc-800 dark:text-zinc-200'}`}
                >
                  <input type="radio" name="slot" value={sl.id} checked={value === sl.id} onChange={() => onChange(sl.id)} className="sr-only" />
                  {timeLabel(sl.start)}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="radio" name="slot" value="" checked={!value} onChange={() => onChange('')} className="accent-emerald-600" />
          {noneLabel}
        </label>
      </div>
    </fieldset>
  );
}

function Apply({ ws, listingId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', moveIn: '', people: '', message: '', income: '', employer: '', workYears: '', refName: '', refPhone: '', pets: '', website: '' });
  const [slotId, setSlotId] = useState('');
  const [sending, setSending] = useState(false);
  const [keep, setKeep] = useState(true);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const account = useAccount();
  // Fill the form from the saved rental profile once it loads (without overwriting anything typed).
  const profile = account.data?.profile;
  useEffect(() => {
    if (!profile) return;
    setForm((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' && profile[k] != null ? String(profile[k]) : v])));
  }, [profile]);

  useEffect(() => {
    call(`/w/${ws}/listings/${listingId}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [ws, listingId]);

  if (error && !data) return <Problem>{error}</Problem>;
  if (!data) return <Loading />;
  const { listing: li, slots, landlord } = data;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const n = (v) => (v === '' || v == null ? undefined : Number(v));
      const body = { ...form, people: n(form.people), income: n(form.income), workYears: n(form.workYears), slotId: slotId || undefined };
      if (!body.moveIn) delete body.moveIn;
      const { token } = await call(`/w/${ws}/listings/${listingId}/apply`, { method: 'POST', body });
      try {
        localStorage.setItem(`bedrock-application-${listingId}`, token);
      } catch {
        // The status link on the next screen is the way back.
      }
      if (account.link) {
        // Keep the application (and, if asked, these details) in the account.
        await account.update('applications', (list) => [{ ws, token, listingId, title: li.title, at: Date.now() }, ...list]).catch(() => {});
        if (keep) {
          const { message, moveIn, website, ...details } = body; // eslint-disable-line no-unused-vars
          await account.update('profile', (p) => ({ ...p, ...details, ...(message ? { message } : {}) })).catch(() => {});
        }
      }
      location.hash = `w=${ws}&s=${token}`;
    } catch (err) {
      setError(err.message);
      if (err.status === 409) call(`/w/${ws}/listings/${listingId}`).then(setData).catch(() => {});
      setSending(false);
    }
  };

  const sale = li.kind === 'sale';
  return (
    <div className="space-y-8">
      <ListingDetails li={li} landlord={landlord} ws={ws} />
      <SafetyNote sale={sale} />

      <form onSubmit={submit} noValidate className="space-y-8">
        <section aria-labelledby="pick-title" className="border-t border-hairline pt-6">
          <h2 id="pick-title" className="text-lg font-semibold text-zinc-950 dark:text-white">
            {sale ? 'Pick a time to see it' : 'Pick a viewing time'}
          </h2>
          <p className="mt-1 mb-4 text-sm text-zinc-600 dark:text-zinc-400">It’s held for you until the {sale ? 'seller' : 'landlord'} confirms it.</p>
          <SlotPicker slots={slots} value={slotId} onChange={setSlotId} />
        </section>

        <section aria-labelledby="about-title" className="border-t border-hairline pt-6">
          <h2 id="about-title" className="text-lg font-semibold text-zinc-950 dark:text-white">
            {sale ? 'Contact the seller' : 'About you'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="ap-name" title="Your name">
                <input id="ap-name" className={input} value={form.name} onChange={set('name')} autoComplete="name" required />
              </Field>
            </div>
            <Field id="ap-email" title="Email">
              <input id="ap-email" type="email" className={input} value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
            <Field id="ap-phone" title="Phone" hint="An email or a phone number, or both">
              <input id="ap-phone" type="tel" className={input} value={form.phone} onChange={set('phone')} autoComplete="tel" />
            </Field>
            {!sale && (
              <>
                <Field id="ap-move" title="When you’d like to move in">
                  <input id="ap-move" type="date" className={input} value={form.moveIn} onChange={set('moveIn')} />
                </Field>
                <Field id="ap-people" title="How many people would live there">
                  <input id="ap-people" type="number" min="1" max="20" inputMode="numeric" className={input} value={form.people} onChange={set('people')} />
                </Field>
                <details className="group rounded-md border border-hairline sm:col-span-2">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Stand out: add income and references <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
                  </summary>
                  <div className="grid gap-4 border-t border-hairline p-4 sm:grid-cols-2">
                    <Field id="ap-income" title="Household income, a month before tax">
                      <input id="ap-income" type="number" min="0" step="100" inputMode="numeric" className={input} value={form.income} onChange={set('income')} />
                    </Field>
                    <Field id="ap-employer" title="Where you work">
                      <input id="ap-employer" className={input} value={form.employer} onChange={set('employer')} maxLength={120} />
                    </Field>
                    <Field id="ap-years" title="Years there">
                      <input id="ap-years" type="number" min="0" step="0.5" inputMode="decimal" className={input} value={form.workYears} onChange={set('workYears')} />
                    </Field>
                    <Field id="ap-pets" title="Pets">
                      <input id="ap-pets" className={input} value={form.pets} onChange={set('pets')} maxLength={200} placeholder="None, or one cat" />
                    </Field>
                    <Field id="ap-ref" title="A current or past landlord">
                      <input id="ap-ref" className={input} value={form.refName} onChange={set('refName')} maxLength={100} />
                    </Field>
                    <Field id="ap-refphone" title="Their phone">
                      <input id="ap-refphone" type="tel" className={input} value={form.refPhone} onChange={set('refPhone')} maxLength={40} />
                    </Field>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                      Only this landlord sees these. You never need to give your Social Insurance Number. If they ask for a credit check, you can get your own report free from
                      Equifax or TransUnion and share it.
                    </p>
                  </div>
                </details>
              </>
            )}
            <div className="sm:col-span-2">
              <Field id="ap-msg" title={sale ? 'Your message or questions (optional)' : 'Anything you’d like the landlord to know (optional)'}>
                <textarea id="ap-msg" rows={4} className={input} value={form.message} onChange={set('message')} maxLength={2000} />
              </Field>
            </div>
            {/* People don't see this field; bots fill it in. */}
            <div aria-hidden className="absolute -left-[9999px]">
              <label htmlFor="ap-website">Website</label>
              <input id="ap-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </div>
          </div>
        </section>

        {error && <Problem>{error}</Problem>}
        {account.link ? (
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="accent-emerald-600" />
            Save these details to my profile for next time
          </label>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <a href="/account/" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
              Create a free account
            </a>{' '}
            to fill this in for you next time and keep every application in one place.
          </p>
        )}
        <Button type="submit" variant="primary" disabled={sending}>
          {sending ? 'Sending…' : sale ? (slotId ? 'Send and hold this time' : 'Send to the seller') : slotId ? 'Apply and hold this time' : 'Apply'} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
      <ReportListing listingKey={`${ws}:${listingId}`} />
    </div>
  );
}

const STATUS = {
  new: { icon: Clock, tone: 'text-amber-700 dark:text-amber-300', title: 'Sent. Waiting for the landlord.', body: 'You’ll see their answer here. Keep this page’s link to come back.' },
  viewing: { icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-400', title: 'Your viewing is confirmed', body: '' },
  approved: { icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-400', title: 'The landlord would like to rent to you', body: 'They’ll be in touch about the lease and deposit.' },
  declined: { icon: AlertTriangle, tone: 'text-zinc-700 dark:text-zinc-300', title: 'The landlord isn’t going ahead with this application', body: 'Thanks for your interest. Your viewing time, if you had one, has been released.' },
  withdrawn: { icon: AlertTriangle, tone: 'text-zinc-700 dark:text-zinc-300', title: 'You withdrew this application', body: 'Your viewing time, if you had one, has been released.' },
};

function Status({ ws, token }) {
  const [st, setSt] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = () =>
      call(`/w/${ws}/status/${token}`)
        .then(setSt)
        .catch((e) => setError(e.message));
    load();
    // Replies arrive while the page is open: check every 30 seconds while it's showing.
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 30000);
    return () => clearInterval(t);
  }, [ws, token]);

  if (error && !st) return <Problem>{error}</Problem>;
  if (!st) return <Loading />;
  const who = st.kind === 'sale' ? 'seller' : 'landlord';
  const base = STATUS[st.status] ?? STATUS.new;
  const info = { ...base, title: base.title.replace('landlord', who), body: base.body.replace('landlord', who) };
  const Icon = info.icon;

  const act = async (action, slotId) => {
    setBusy(true);
    setError('');
    try {
      setSt(await call(`/w/${ws}/status/${token}`, { method: 'POST', body: { action, slotId } }));
      setPick('');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const link = links.status(ws, token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Selecting the link text works as well.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{st.listing?.title ? `${st.listing.title}${st.listing.area ? ` · ${st.listing.area}` : ''}` : 'Your application'}</p>
        <h1 className={`${h1} mt-1 flex items-start gap-2 ${info.tone}`}>
          <Icon className="mt-1 size-6 shrink-0" aria-hidden />
          <span>{info.title}</span>
        </h1>
        {info.body && <p className="mt-2 text-zinc-600 dark:text-zinc-400">{info.body}</p>}
        <SaveToAccount section="applications" match={(a) => a.token === token} item={{ ws, token, title: st.listing?.title || '', at: Date.now() }} what="this application" />
      </div>

      {st.viewing && st.status !== 'declined' && st.status !== 'withdrawn' && (
        <div className="panel p-5">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{st.viewing.confirmed ? 'Viewing' : 'Viewing time you asked for'}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{whenLabel(st.viewing.start)}</p>
          {st.listing?.address && <p className="mt-1 text-zinc-700 dark:text-zinc-300">{st.listing.address}</p>}
          {st.viewing.confirmed && (
            <Button
              className="mt-4"
              onClick={() =>
                downloadIcs('viewing.ics', icsFile({ title: `Viewing: ${st.listing?.title || 'rental'}`, start: st.viewing.start, minutes: st.viewing.minutes, location: st.listing?.address || st.listing?.area || '', uid: `${token}@bedrock` }))
              }
            >
              <CalendarPlus className="size-4" aria-hidden /> Add to my calendar
            </Button>
          )}
        </div>
      )}

      {st.note && (
        <div className="border-l-2 border-(--accent) pl-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">From {st.landlord.name}</p>
          <p className="mt-1 whitespace-pre-line text-zinc-800 dark:text-zinc-200">{st.note}</p>
        </div>
      )}

      <Thread ws={ws} token={token} st={st} onChange={setSt} />

      {(st.status === 'viewing' || st.status === 'approved') && (st.landlord.email || st.landlord.phone) && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Reach {st.landlord.name}:{' '}
          {st.landlord.email && (
            <a className="font-medium text-emerald-700 underline dark:text-emerald-400" href={`mailto:${st.landlord.email}`}>
              {st.landlord.email}
            </a>
          )}
          {st.landlord.email && st.landlord.phone && ' · '}
          {st.landlord.phone && (
            <a className="font-medium text-emerald-700 underline dark:text-emerald-400" href={`tel:${st.landlord.phone}`}>
              {st.landlord.phone}
            </a>
          )}
        </p>
      )}

      {st.status === 'new' && (
        <section aria-labelledby="change-title" className="border-t border-hairline pt-6">
          <h2 id="change-title" className="text-base font-semibold text-zinc-950 dark:text-white">
            {st.viewing ? 'Need a different time?' : 'Pick a viewing time'}
          </h2>
          <div className="mt-3">
            <SlotPicker slots={st.slots} value={pick} onChange={setPick} noneLabel={st.viewing ? 'Keep my time' : 'Not yet'} />
          </div>
          {pick && (
            <Button className="mt-4" variant="primary" disabled={busy} onClick={() => act('reschedule', pick)}>
              Switch to {whenLabel(st.slots.find((x) => x.id === pick)?.start ?? new Date().toISOString())}
            </Button>
          )}
        </section>
      )}

      {error && <Problem>{error}</Problem>}

      <section className="border-t border-hairline pt-6 text-sm">
        <p className="font-medium text-zinc-900 dark:text-white">Keep this link to check back</p>
        <div className="mt-2 flex gap-2">
          <input readOnly aria-label="Your status link" value={link} className={`${input} min-w-0 flex-1 text-xs`} onFocus={(e) => e.target.select()} />
          <Button onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        </div>
        {(st.status === 'new' || st.status === 'viewing') && (
          <button type="button" disabled={busy} onClick={() => act('withdraw')} className="mt-4 text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Withdraw my application
          </button>
        )}
      </section>
    </div>
  );
}

/** A tenant's page: pay rent and get receipts, or report a repair. */
function Tenant({ ws, unitId, token, start }) {
  const [tab, setTab] = useState(start);
  return (
    <div>
      <div role="tablist" aria-label="Tenant page" className="mb-8 inline-flex overflow-hidden rounded-md border border-(--line-strong) text-sm">
        {[
          ['pay', 'Pay rent', Wallet],
          ['repair', 'Report a repair', Wrench],
        ].map(([k, label, Icon], i) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 ${i ? 'border-l border-(--line-strong)' : ''} ${tab === k ? 'bg-zinc-950/[0.05] font-semibold text-zinc-950 shadow-[inset_0_-2px_0_var(--accent)] dark:bg-white/[0.07] dark:text-white' : 'font-medium text-zinc-600 hover:bg-well dark:text-zinc-400'}`}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === 'pay' ? <PayRent ws={ws} unitId={unitId} token={token} /> : <Repair ws={ws} unitId={unitId} token={token} />}
    </div>
  );
}

const monthLabel = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

function CopyText({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-well dark:text-emerald-400"
      aria-label={`Copy ${label}`}
    >
      <Copy className="size-3.5" aria-hidden /> {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Keep this page in the account: a button when signed in, a nudge to sign up when not. */
function SaveToAccount({ section, match, item, what }) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  if (account.status === 'loading') return null;
  if (!account.link)
    return (
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        <a href="/account/" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
          Create a free account
        </a>{' '}
        to keep {what} with your other homes and rentals.
      </p>
    );
  const saved = (account.data?.[section] ?? []).some(match);
  return saved ? (
    <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-4" aria-hidden /> Saved to <a href="/account/" className="underline underline-offset-2">your account</a>
    </p>
  ) : (
    <Button
      className="mt-3"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await account.update(section, (list) => [item, ...list]).catch(() => {});
        setBusy(false);
      }}
    >
      Save to my account
    </Button>
  );
}

/** This month's rent, how to send it by e-Transfer, "I've sent it", and receipts. */
function PayRent({ ws, unitId, token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const base = `/w/${ws}/pay/${unitId}/${token}`;
  useEffect(() => {
    call(base)
      .then((d) => (setInfo(d), setForm({ amount: d.status.owing || d.status.rent || '', sentOn: new Date().toLocaleDateString('en-CA'), note: '', website: '' })))
      .catch((e) => setError(e.message));
  }, [base]);
  if (error && !info) return <Problem>{error}</Problem>;
  if (!info) return <Loading />;
  if (receipt) return <RentReceipt r={receipt} info={info} onBack={() => setReceipt(null)} />;
  const st = info.status;
  const pending = info.claims.filter((c) => c.status === 'pending');
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await call(base, { method: 'POST', body: { ...form, amount: Number(form.amount), month: st.month } });
      setInfo(d);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {info.unit}
          {info.tenant ? ` · ${info.tenant}` : ''}
        </p>
        <h1 className={`${h1} mt-1`}>Rent for {monthLabel(st.month)}</h1>
        <SaveToAccount section="tenancies" match={(x) => x.ws === ws && x.unitId === unitId} item={{ ws, unitId, token, label: [info.unit, info.address].filter(Boolean).join(', '), landlord: info.landlord?.name || '', at: Date.now() }} what="this rental" />
        <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">
          {money(st.owing)}
          <span className="ml-2 text-base font-medium text-zinc-500 dark:text-zinc-400">{st.owing === 0 ? 'all paid, thank you' : `due on the ${st.dueDay}${['th', 'st', 'nd', 'rd'][st.dueDay % 10 > 3 || [11, 12, 13].includes(st.dueDay) ? 0 : st.dueDay % 10]}`}</span>
        </p>
        {st.paid > 0 && st.owing > 0 && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{money(st.paid)} of {money(st.rent)} received so far.</p>}
      </div>

      {info.etransfer ? (
        <div className="rounded-xl border border-(--line-strong) bg-(--panel) p-5">
          <p className="font-semibold text-zinc-950 dark:text-white">Pay by Interac e-Transfer</p>
          <dl className="mt-3 divide-y divide-hairline text-sm">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Send to</dt>
              <dd className="flex items-center gap-1 font-medium text-zinc-950 dark:text-white">
                {info.etransfer.email} <CopyText value={info.etransfer.email} label="the email" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Message</dt>
              <dd className="flex items-center gap-1 font-mono font-medium text-zinc-950 dark:text-white">
                {info.reference} <CopyText value={info.reference} label="the message" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Amount</dt>
              <dd className="font-medium tabular-nums text-zinc-950 dark:text-white">{money(st.owing || st.rent)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {info.etransfer.autodeposit ? 'Autodeposit is on, so no security question is needed.' : 'If your bank asks for a security question, agree the answer with your landlord another way, never in the message.'}
            {info.etransfer.note ? ` ${info.etransfer.note}` : ''}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-hairline p-5 text-sm text-zinc-600 dark:text-zinc-400">
          {info.landlord.name} hasn’t added e-Transfer details yet. Pay the way you’ve agreed, then let them know below.
        </p>
      )}

      {st.owing > 0 && form && (
        <form onSubmit={send} className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Sent it? Let {info.landlord.name} know</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-amt" title="Amount sent">
              <input id="pay-amt" type="number" min="1" step="0.01" className={input} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field id="pay-on" title="Sent on">
              <input id="pay-on" type="date" className={input} value={form.sentOn} onChange={(e) => setForm((f) => ({ ...f, sentOn: e.target.value }))} />
            </Field>
          </div>
          <Field id="pay-note" title="Note (optional)">
            <input id="pay-note" className={input} value={form.note} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="hidden" aria-hidden />
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            <Send className="size-4" aria-hidden /> {busy ? 'Sending…' : 'I’ve sent it'}
          </Button>
        </form>
      )}

      {pending.length > 0 && (
        <div className="rounded-md bg-amber-500/10 p-4 text-sm text-amber-950 ring-1 ring-amber-600/20 ring-inset dark:text-amber-100">
          {pending.map((c) => (
            <p key={c.id}>
              You said you sent {money(c.amount)} {c.sentOn ? `on ${dateLabel(c.sentOn)}` : ''}. Waiting for {info.landlord.name} to confirm it arrived.
            </p>
          ))}
        </div>
      )}

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-white">
          <Receipt className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden /> Receipts
        </h2>
        {info.receipts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Receipts appear here once {info.landlord.name} records a payment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline rounded-md border border-hairline">
            {info.receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium text-zinc-950 dark:text-white">{monthLabel(r.month)}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{r.paidOn ? `Received ${dateLabel(r.paidOn)}` : 'Received'}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(r.amount)}</span>
                  <Button className="px-2.5 py-1" onClick={() => setReceipt(r)}>
                    View
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A rent receipt, ready to print or save as a PDF from the browser. */
function RentReceipt({ r, info, onBack }) {
  return (
    <div>
      <div className="mb-6 flex gap-2 print:hidden">
        <Button onClick={onBack}>
          <ChevronLeft className="size-4" aria-hidden /> Back
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print or save as PDF
        </Button>
      </div>
      <article className="rounded-xl border border-(--line-strong) bg-(--panel) p-6 print:border-0 print:p-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Rent receipt</p>
        <h1 className={`${h1} mt-2`}>{money(r.amount)} received</h1>
        <dl className="mt-6 divide-y divide-hairline text-sm">
          {[
            ['For', `Rent for ${monthLabel(r.month)}`],
            ['Received', r.paidOn ? dateLabel(r.paidOn) : '—'],
            ['How', r.method || '—'],
            ['From', info.tenant || 'The tenant'],
            ['Home', [info.unit, info.address].filter(Boolean).join(', ')],
            ['Landlord', info.landlord.name],
            ['Receipt no.', r.id.slice(0, 10).toUpperCase()],
          ].map(([k, val]) => (
            <div key={k} className="flex justify-between gap-6 py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400">{k}</dt>
              <dd className="text-right font-medium text-zinc-950 dark:text-white">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">Recorded by {info.landlord.name} with Squarely. Keep it for your records and your provincial rent credit, where there is one.</p>
      </article>
    </div>
  );
}

function Repair({ ws, unitId, token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', details: '', urgency: 'normal', reportedBy: '', contact: '', entryOk: false, website: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    call(`/w/${ws}/repair/${unitId}/${token}`)
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [ws, unitId, token]);

  if (error && !info) return <Problem>{error}</Problem>;
  if (!info) return <Loading />;
  if (sent)
    return (
      <div>
        <h1 className={`${h1} flex items-start gap-2 text-emerald-700 dark:text-emerald-400`}>
          <CheckCircle2 className="mt-1 size-6 shrink-0" aria-hidden />
          Sent to {info.landlord.name}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">They’ll be in touch to arrange the repair. You can report something else any time with the same link.</p>
        <Button className="mt-6" onClick={() => (setSent(false), setForm((f) => ({ ...f, title: '', details: '' })))}>
          Report something else
        </Button>
      </div>
    );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await call(`/w/${ws}/repair/${unitId}/${token}`, { method: 'POST', body: form });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{info.unit}</p>
        <h1 className={`${h1} mt-1 flex items-center gap-2`}>
          <Wrench className="size-6 text-emerald-700 dark:text-emerald-400" aria-hidden /> Report a repair
        </h1>
      </div>
      <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        Fire, a gas smell, or someone hurt: call 911 first. For a flood or no heat in winter, also phone your landlord right away.
      </p>
      <Field id="rp-title" title="What needs fixing?">
        <input id="rp-title" className={input} value={form.title} onChange={set('title')} placeholder="Kitchen tap is leaking" maxLength={120} />
      </Field>
      <Field id="rp-details" title="Details (optional)" hint="Where it is, when it started, anything you’ve tried">
        <textarea id="rp-details" rows={4} className={input} value={form.details} onChange={set('details')} maxLength={3000} />
      </Field>
      <Field id="rp-urgency" title="How urgent is it?">
        <select id="rp-urgency" className={input} value={form.urgency} onChange={set('urgency')}>
          <option value="low">Whenever is convenient</option>
          <option value="normal">Soon, within a few days</option>
          <option value="urgent">Urgent: water, heat, power, locks or safety</option>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rp-name" title="Your name">
          <input id="rp-name" className={input} value={form.reportedBy} onChange={set('reportedBy')} autoComplete="name" />
        </Field>
        <Field id="rp-contact" title="Phone or email">
          <input id="rp-contact" className={input} value={form.contact} onChange={set('contact')} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={form.entryOk} onChange={set('entryOk')} className="mt-0.5 size-4 accent-emerald-600" />
        The landlord or a repair person may come in to fix it if I’m not home (with notice as the law requires).
      </label>
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="rp-website">Website</label>
        <input id="rp-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>
      {error && <Problem>{error}</Problem>}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send to my landlord'}
      </Button>
    </form>
  );
}

const photoUrl = (ws, id) => `/api/w/${ws}/photos/${id}`;
const placeOf = (li) => [li.area, li.city ? cityByKey(li.city).name.replace(/^Elsewhere in /, '') : ''].filter(Boolean).join(', ');

/** Photos, one at a time, with arrows and a count. */
function Gallery({ ws, ids, title }) {
  const [i, setI] = useState(0);
  if (!ids?.length) return null;
  const n = ids.length;
  return (
    <figure className="relative overflow-hidden rounded-md border border-hairline bg-zinc-900">
      <img src={photoUrl(ws, ids[i])} alt={`${title}, photo ${i + 1} of ${n}`} className="aspect-[4/3] w-full object-cover" />
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => setI((i - 1 + n) % n)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label="Next photo" onClick={() => setI((i + 1) % n)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <figcaption className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white tabular-nums">
            {i + 1} / {n}
          </figcaption>
        </>
      )}
    </figure>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

/** What the place is: photos, price, the facts, the description. */
function ListingDetails({ li, landlord, ws }) {
  const sale = li.kind === 'sale';
  const type = PROPERTY_TYPES.find((t) => t.key === li.propertyType)?.label;
  const price = sale ? li.price : li.rent;
  // For a home for sale: the mortgage at the least down, at a typical 5-year fixed rate.
  const down = sale && price > 0 ? minDownPayment(price) : 0;
  const plan = sale && price > 0 ? mortgagePlan({ price, down, ratePct: DEFAULT_MARKET.rate }) : null;
  return (
    <div className="space-y-5">
      <Gallery ws={ws} ids={li.photos} title={li.title} />
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {sale ? 'For sale by owner' : 'For rent'} · {landlord.name}
          {landlord.verified && (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-4" aria-hidden /> Email confirmed
            </span>
          )}
        </p>
        <h1 className={`${h1} mt-1`}>{li.title || (sale ? 'A home for sale' : 'A place for rent')}</h1>
        {price > 0 && (
          <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {money(price)}
            {!sale && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400"> a month</span>}
          </p>
        )}
        {(li.address || placeOf(li)) && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{sale && li.address ? `${li.address}, ${placeOf(li)}` : placeOf(li)}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-hairline py-4 text-sm sm:grid-cols-3">
        {type && <Fact label="Type">{type}</Fact>}
        {li.beds > 0 && <Fact label="Bedrooms">{li.beds}</Fact>}
        {li.baths > 0 && <Fact label="Bathrooms">{li.baths}</Fact>}
        {li.sqft > 0 && <Fact label="Size">{li.sqft.toLocaleString('en-CA')} sq ft</Fact>}
        {sale && li.lot && <Fact label="Lot">{li.lot}</Fact>}
        {sale && li.yearBuilt > 0 && <Fact label="Built">{li.yearBuilt}</Fact>}
        {sale && li.taxes > 0 && <Fact label="Property tax">{money(li.taxes)}/yr</Fact>}
        {!sale && li.available && <Fact label="Available">{dateLabel(li.available)}</Fact>}
        {!sale && li.utilities && <Fact label="Utilities">{li.utilities}</Fact>}
        {li.parking && <Fact label="Parking">{li.parking}</Fact>}
      </dl>
      {li.details && <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{li.details}</p>}
      {plan && (
        <div className="panel p-4 text-sm">
          <p className="text-zinc-700 dark:text-zinc-300">
            With the least down ({money(down)}), the mortgage would be about <span className="font-semibold text-zinc-950 dark:text-white">{money(plan.payment)} a month</span> at {DEFAULT_MARKET.rate}% over {plan.amortYears} years
            {plan.insured ? ', with mortgage insurance' : ''}.
          </p>
          <a href="/app/?view=home" className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            See what you could buy <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}

/** The scam signs, where people are about to send their details. */
function SafetyNote({ sale }) {
  return (
    <aside aria-label="Stay safe" className="flex gap-2.5 border border-hairline px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p>
        {sale
          ? 'See the home in person and use a real estate lawyer before you pay anything. Never wire money or pay a deposit to hold a viewing.'
          : 'See the place in person before you pay anything. Never send a deposit, e-Transfer or ID to someone who can’t show it to you, or who says they’re away.'}{' '}
        Squarely never asks you for money.
      </p>
    </aside>
  );
}

const REASONS = [
  ['scam', 'Looks like a scam'],
  ['not-available', 'It’s no longer available'],
  ['wrong-info', 'The details are wrong'],
  ['discriminatory', 'It turns people away for who they are'],
  ['other', 'Something else'],
];

function ReportListing({ listingKey }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('scam');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (done) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Thanks. We’ll take a look; listings with several reports are hidden until they’re reviewed.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <Flag className="size-4" aria-hidden /> Report this listing
      </button>
    );
  return (
    <form
      className="space-y-3 border-t border-hairline pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await call('/listings/report', { method: 'POST', body: { key: listingKey, reason, note } });
          setDone(true);
        } catch (err) {
          setError(err.status === 404 ? 'This listing isn’t in Squarely’s public listings; tell the person who sent you the link.' : err.message);
        }
      }}
    >
      <Field id="rep-reason" title="What’s wrong?">
        <select id="rep-reason" className={input} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field id="rep-note" title="Anything else (optional)">
        <textarea id="rep-note" rows={2} className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      {error && <Problem>{error}</Problem>}
      <Button type="submit">Send report</Button>
    </form>
  );
}

/** The conversation with the landlord or seller, newest at the bottom. */
function Thread({ ws, token, st, onChange }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const who = st.kind === 'sale' ? 'the seller' : 'the landlord';
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      onChange(await call(`/w/${ws}/status/${token}/messages`, { method: 'POST', body: { body: text } }));
      setText('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <section aria-labelledby="thread-title" className="border-t border-hairline pt-6">
      <h2 id="thread-title" className="text-base font-semibold text-zinc-950 dark:text-white">
        Messages
      </h2>
      <ol className="mt-3 space-y-3" aria-live="polite">
        {st.messages.length === 0 && <li className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet. Ask {who} anything here.</li>}
        {st.messages.map((m, i) => (
          <li key={i} className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${m.from === 'applicant' ? 'ml-auto bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-50' : 'bg-zinc-100 text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-100'}`}>
            <p className="sr-only">{m.from === 'applicant' ? 'You' : st.landlord.name}:</p>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="mt-1 text-[11px] opacity-70">{new Date(m.created).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </li>
        ))}
      </ol>
      {st.status !== 'withdrawn' && (
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="msg-body" className="sr-only">
              Message {who}
            </label>
            <textarea id="msg-body" rows={2} className={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={`Message ${who}`} />
          </div>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()} aria-label="Send message">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      )}
      {error && <Problem>{error}</Problem>}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">This page checks for replies every 30 seconds while it’s open. Keep its link to come back.</p>
    </section>
  );
}
