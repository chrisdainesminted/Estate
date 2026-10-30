import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, Clock, Wrench } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Button } from '../components/ui.jsx';
import { call, hashParams, links } from '../lib/landlordApi.js';
import { money } from '../lib/format.js';
import { byDay, dateLabel, downloadIcs, icsFile, timeLabel, whenLabel } from '../lib/when.js';

/**
 * The public side of the landlord tools, one page chosen by its link:
 * #w=…&l=… applies for a listing and picks a viewing time, #w=…&s=… is an
 * applicant's own status page, #w=…&u=…&t=… reports a repair.
 */
export default function RentPage() {
  const [params, setParams] = useState(() => hashParams(location.hash));
  useEffect(() => {
    const on = () => setParams(hashParams(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const { w, l, s, u, t } = params;
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <a href="/" aria-label="Bedrock home">
            <Logo />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {w && l ? <Apply ws={w} listingId={l} /> : w && s ? <Status ws={w} token={s} /> : w && u && t ? <Repair ws={w} unitId={u} token={t} /> : <Nothing />}
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
        Your details go only to this landlord. Bedrock deletes closed applications after 180 days.
      </footer>
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
  const [form, setForm] = useState({ name: '', email: '', phone: '', moveIn: '', people: '', message: '', website: '' });
  const [slotId, setSlotId] = useState('');
  const [sending, setSending] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
      const body = { ...form, people: form.people ? Number(form.people) : undefined, slotId: slotId || undefined };
      if (!body.moveIn) delete body.moveIn;
      const { token } = await call(`/w/${ws}/listings/${listingId}/apply`, { method: 'POST', body });
      try {
        localStorage.setItem(`bedrock-application-${listingId}`, token);
      } catch {
        // The status link on the next screen is the way back.
      }
      location.hash = `w=${ws}&s=${token}`;
    } catch (err) {
      setError(err.message);
      if (err.status === 409) call(`/w/${ws}/listings/${listingId}`).then(setData).catch(() => {});
      setSending(false);
    }
  };

  const facts = [li.beds && `${li.beds} bed`, li.baths && `${li.baths} bath`, li.area, li.available && `Available ${dateLabel(li.available)}`].filter(Boolean).join(' · ');
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">From {landlord.name}</p>
        <h1 className={`${h1} mt-1`}>{li.title || 'A place for rent'}</h1>
        {li.rent > 0 && (
          <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {money(li.rent)}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400"> a month</span>
          </p>
        )}
        {facts && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{facts}</p>}
        <dl className="mt-4 grid gap-1 text-sm">
          {li.utilities && (
            <div>
              <dt className="inline font-medium text-zinc-900 dark:text-white">Utilities: </dt>
              <dd className="inline text-zinc-600 dark:text-zinc-400">{li.utilities}</dd>
            </div>
          )}
          {li.parking && (
            <div>
              <dt className="inline font-medium text-zinc-900 dark:text-white">Parking: </dt>
              <dd className="inline text-zinc-600 dark:text-zinc-400">{li.parking}</dd>
            </div>
          )}
        </dl>
        {li.details && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{li.details}</p>}
      </div>

      <form onSubmit={submit} noValidate className="space-y-8">
        <section aria-labelledby="pick-title" className="border-t border-hairline pt-6">
          <h2 id="pick-title" className="text-lg font-semibold text-zinc-950 dark:text-white">
            Pick a viewing time
          </h2>
          <p className="mt-1 mb-4 text-sm text-zinc-600 dark:text-zinc-400">It’s held for you until the landlord confirms it.</p>
          <SlotPicker slots={slots} value={slotId} onChange={setSlotId} />
        </section>

        <section aria-labelledby="about-title" className="border-t border-hairline pt-6">
          <h2 id="about-title" className="text-lg font-semibold text-zinc-950 dark:text-white">
            About you
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
            <Field id="ap-move" title="When you’d like to move in">
              <input id="ap-move" type="date" className={input} value={form.moveIn} onChange={set('moveIn')} />
            </Field>
            <Field id="ap-people" title="How many people would live there">
              <input id="ap-people" type="number" min="1" max="20" inputMode="numeric" className={input} value={form.people} onChange={set('people')} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="ap-msg" title="Anything you’d like the landlord to know (optional)">
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
        <Button type="submit" variant="primary" disabled={sending}>
          {sending ? 'Sending…' : slotId ? 'Apply and hold this time' : 'Apply'} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
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
    call(`/w/${ws}/status/${token}`)
      .then(setSt)
      .catch((e) => setError(e.message));
  }, [ws, token]);

  if (error && !st) return <Problem>{error}</Problem>;
  if (!st) return <Loading />;
  const info = STATUS[st.status] ?? STATUS.new;
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
