import { useState } from 'react';
import { BadgeCheck, ClipboardList, Handshake, Home, MapPin, MessageSquare } from 'lucide-react';
import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

const ROLES = [
  { key: 'broker', label: 'Mortgage broker' },
  { key: 'agent', label: 'Real estate agent' },
];

// What arrives with each introduction: exactly what the app's broker and agent forms collect.
const BROKER_GETS = [
  'Their name, email and phone, and the city they want to buy in',
  'When they want to buy',
  'The income they shared and what Squarely estimates they could buy',
  'Often a pre-approval summary: how they’re paid, years in their work, where the down payment comes from, and the documents they’ve gathered',
];
const AGENT_GETS = [
  'Their name, email and phone, and whether they’re buying or selling',
  'The city, and when they want to move',
  'The listing they were looking at, with its link, when they asked from a home’s page',
  'Their budget or the offer they’re thinking about',
];

const STEPS = [
  [ClipboardList, 'A buyer runs their numbers', 'What they can afford, the cash they need to close, and homes for sale that fit them, all in the app.'],
  [MessageSquare, 'They ask for an introduction', 'From “Have a broker call me”, “Send it to a broker” or “Talk to an agent”. They tick a box agreeing to have their details passed to one licensed professional.'],
  [Handshake, 'We introduce them to you', 'You get their details and what they told us, and you reach out. One partner per request: the buyer isn’t sold to a list.'],
];

/** Partner with Squarely: what mortgage brokers and real estate agents get, how it's paid, and a form to apply. */
export default function Partners() {
  const [f, setF] = useState({ role: 'broker', name: '', email: '', phone: '', brokerage: '', licence: '', areas: '', note: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const role = ROLES.find((r) => r.key === f.role);

  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    const message = [
      `Partner application: ${role.label}`,
      `Brokerage: ${f.brokerage}`,
      `Licence number: ${f.licence}`,
      f.phone && `Phone: ${f.phone}`,
      `Areas served: ${f.areas}`,
      f.note && `Note: ${f.note}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: f.name, email: f.email, topic: f.role === 'agent' ? 'Partner: real estate agent' : 'Partner: mortgage broker', message, website: f.website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message });
    }
  };

  return (
    <PageShell>
      <h1 className={h1}>Partner with Squarely</h1>
      <p className={lede}>
        For mortgage brokers and real estate agents. Squarely helps people work out what they can afford, get ready to buy, and find homes that fit them. When they’re ready for a
        professional, they ask us to introduce them, and that’s where you come in.
      </p>

      <h2 className={h2}>How it works</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map(([Icon, title, body], i) => (
          <li key={title} className="elevated rounded-xl p-5">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Step {i + 1}</p>
            <p className="mt-1 font-semibold text-zinc-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
          </li>
        ))}
      </ol>

      <h2 className={h2}>What comes with each introduction</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Gets icon={Handshake} title="Mortgage brokers" items={BROKER_GETS} />
        <Gets icon={Home} title="Real estate agents" items={AGENT_GETS} />
      </div>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Every request comes from a person who asked for it and agreed to have their details shared. We never sell lists or pass on anyone who didn’t ask.
      </p>

      <h2 className={h2}>How partners pay</h2>
      <div className={prose}>
        <p>
          <strong className="text-zinc-950 dark:text-white">Mortgage brokers:</strong> a referral fee only when a mortgage you arrange funds. It’s set out in a written agreement
          and disclosed to the buyer, as provincial rules require. Nothing to pay up front.
        </p>
        <p>
          <strong className="text-zinc-950 dark:text-white">Real estate agents:</strong> a flat monthly fee to be the agent we introduce buyers and sellers to in your area. We
          don’t take a share of your commission.
        </p>
        <p>We’re a young service. Before you sign anything, we’ll show you how many introductions your area has had, so you can judge it for yourself.</p>
      </div>

      <h2 className={h2}>What we ask of partners</h2>
      <ul className="mt-4 space-y-2.5">
        {[
          'A current licence in the province you work in (FSRA in Ontario for mortgages, RECO for real estate, or your province’s regulator). We check it.',
          'A reply to every introduction within one business day.',
          'A free first conversation, with no pressure to sign.',
          'Straight answers for first-time buyers, including when the answer is “not yet”.',
        ].map((t) => (
          <li key={t} className="flex gap-2.5 text-zinc-700 dark:text-zinc-300">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <h2 className={h2} id="apply">
        Apply to partner
      </h2>
      {state.status === 'sent' ? (
        <div className="mt-5 rounded-xl bg-emerald-500/10 p-5 text-emerald-900 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-100" role="status">
          <p className="font-semibold">Thanks, {f.name.split(' ')[0]}. Your application is in.</p>
          <p className="mt-1 text-sm">We’ll check your licence and reply to {f.email}, usually within two business days.</p>
        </div>
      ) : (
        <form onSubmit={send} className="elevated mt-5 space-y-4 rounded-xl p-5 sm:p-6">
          <fieldset>
            <legend className={label}>I’m a</legend>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.key}
                  className={`cursor-pointer rounded-full focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-500 px-3.5 py-1.5 text-sm ring-1 ring-inset ${f.role === r.key ? 'bg-emerald-600 font-medium text-white ring-emerald-600' : 'text-zinc-700 ring-(--line-strong) dark:text-zinc-300'}`}
                >
                  <input type="radio" name="role" value={r.key} checked={f.role === r.key} onChange={set('role')} className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name" value={f.name} onChange={set('name')} required autoComplete="name" />
            <Field id="p-email" label="Email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
            <Field id="p-phone" label="Phone (optional)" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
            <Field id="p-brokerage" label="Brokerage" value={f.brokerage} onChange={set('brokerage')} required autoComplete="organization" />
            <Field id="p-licence" label="Licence number" value={f.licence} onChange={set('licence')} required />
            <Field id="p-areas" label="Cities you serve" value={f.areas} onChange={set('areas')} required placeholder="e.g. Thunder Bay, Kenora" />
          </div>
          <div>
            <label htmlFor="p-note" className={label}>
              Anything else (optional)
            </label>
            <textarea id="p-note" rows={4} maxLength={2000} value={f.note} onChange={set('note')} className={field} placeholder="Languages, specialties, first-time buyers, self-employed, multi-units…" />
          </div>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
          {state.error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={state.status === 'sending'}
              className="rounded-md bg-(--accent) px-5 py-2.5 text-sm font-semibold text-(--accent-ink) transition hover:brightness-110 disabled:opacity-50"
            >
              {state.status === 'sending' ? 'Sending…' : 'Apply'}
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Applying doesn’t commit you to anything. <a className={a} href="/privacy/">Privacy</a>
            </p>
          </div>
        </form>
      )}
      <p className="mt-8 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> We’re starting in Thunder Bay and adding partners city by city across Canada.
      </p>
    </PageShell>
  );
}

function Gets({ icon: Icon, title, items }) {
  return (
    <div className="elevated rounded-xl p-5">
      <p className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
        <Icon className="size-4 text-emerald-600" aria-hidden /> {title}
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({ id, label: text, ...props }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input id={id} {...props} className={field} />
    </div>
  );
}
