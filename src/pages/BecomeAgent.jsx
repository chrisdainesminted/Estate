import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, Check, ExternalLink, GraduationCap, ListChecks, Building2, ShieldCheck, Handshake } from 'lucide-react';
import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';
import { AGENT_RULES_CHECKED, AGENT_STEPS, BROKERAGE_QUESTIONS, FEES, SOURCES, agentDeadlines, agentProgress } from '../lib/agentPath.js';
import { money } from '../lib/format.js';

const KEY = 'squarely-agent-path';
const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const checked = new Date(`${AGENT_RULES_CHECKED}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ticks: v.ticks ?? {}, dates: v.dates ?? {} };
  } catch {
    return { ticks: {}, dates: {} };
  }
};

const OVERVIEW = [
  [GraduationCap, 'Courses', 'Five courses, four exams and two simulation sessions with a RECO-approved provider. Online and at your own pace, within 24 months.'],
  [Building2, 'A brokerage', 'Every agent works under a registered brokerage. One has to take you on before you can register.'],
  [ShieldCheck, 'RECO registration', 'Within 12 months of your courses: your brokerage, a criminal record check and RECO’s insurance.'],
  [ListChecks, 'Your first two years', 'More courses after you register, finished within two years so you can renew.'],
];

function Source({ k }) {
  const [text, href] = SOURCES[k];
  return (
    <a className={`${a} inline-flex items-center gap-1`} href={href} target="_blank" rel="noopener noreferrer">
      {text} <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

/**
 * Become a real estate agent in Ontario: the path explained, a tracker that
 * remembers what's done (in this browser), the deadlines it sets, questions
 * for brokerages, and an introduction to one that's hiring.
 */
export default function BecomeAgent() {
  const [state, setState] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Private browsing: the ticks last for this visit.
    }
  }, [state]);
  const { ticks, dates } = state;
  const tick = (k, on) => setState((s) => ({ ...s, ticks: { ...s.ticks, [k]: on } }));
  const setDate = (k, v) => setState((s) => ({ ...s, dates: { ...s.dates, [k]: v } }));
  const progress = agentProgress(ticks);
  const deadlines = useMemo(() => agentDeadlines(dates, ticks), [dates, ticks]);
  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <PageShell>
      <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-400">Careers · Ontario</p>
      <h1 className={`${h1} mt-3`}>Become a real estate agent</h1>
      <p className={lede}>
        Every step to your licence in Ontario, in plain words, with a tracker that keeps your place and your deadlines. When you’re ready, we’ll introduce you to a brokerage
        that’s hiring.
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {OVERVIEW.map(([Icon, title, body], i) => (
          <li key={title} className="elevated flex gap-3 rounded-xl p-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
              <Icon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Step {i + 1}</span>
              <span className="block font-semibold text-zinc-950 dark:text-white">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</span>
            </span>
          </li>
        ))}
      </ol>

      <h2 className={h2}>What it costs</h2>
      <div className={prose}>
        <p>
          At Humber Polytechnic, the courses before you register were listed at <strong className="text-zinc-950 dark:text-white">{money(FEES.preRegistration)}</strong>, and the
          ones after at <strong className="text-zinc-950 dark:text-white">{money(FEES.postRegistration)}</strong>. Other approved providers set their own prices.
        </p>
        <p>
          On top of that: RECO’s registration fee, its required insurance, the criminal record check, and whatever your brokerage charges (desk, franchise or technology fees).
          Ask each brokerage for its fees in writing.
        </p>
      </div>

      <h2 className={h2} id="tracker">
        Your tracker
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Tick things off as you go. It’s saved in this browser only, and nothing is sent anywhere.</p>

      <div className="elevated mt-5 rounded-xl p-5">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-zinc-950 dark:text-white">{progress.next ? `Next: ${progress.next.title}` : 'Every step done. Congratulations!'}</span>
          <span className="tabular text-zinc-500 dark:text-zinc-400">
            {progress.done} of {progress.total}
          </span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--track)" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to your licence">
          <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {deadlines.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-hairline pt-4">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-sm">
                {d.done ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> : <AlarmClock className={`mt-0.5 size-4 shrink-0 ${d.days < 60 ? 'text-red-600' : 'text-amber-600'}`} aria-hidden />}
                <span className={d.done ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}>
                  {d.label} by <strong>{longDate(d.date)}</strong>
                  {!d.done && <span className="text-zinc-500 dark:text-zinc-400"> · {d.days < 0 ? `${-d.days} days ago: contact RECO` : `${d.days} days left`}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ol className="mt-4 space-y-3">
        {AGENT_STEPS.map((step, i) => {
          const done = step.items.every(([k]) => ticks[k]);
          const isNext = progress.next?.id === step.id;
          return (
            <li key={step.id} className={`elevated rounded-xl p-5 ${isNext ? 'ring-2 ring-emerald-600/60' : ''}`}>
              <p className="flex items-center gap-2.5">
                <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-zinc-950/[0.06] text-zinc-700 dark:bg-white/10 dark:text-zinc-200'}`}>
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className="font-semibold text-zinc-950 dark:text-white">{step.title}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.short}</p>
              <ul className={`mt-3 grid gap-2 ${step.items.length > 4 ? 'sm:grid-cols-2' : ''}`}>
                {step.items.map(([k, text]) => (
                  <li key={k}>
                    <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                      <input type="checkbox" className="mt-0.5 size-4 accent-emerald-600" checked={Boolean(ticks[k])} onChange={(e) => tick(k, e.target.checked)} />
                      <span className={ticks[k] ? 'text-zinc-500 line-through dark:text-zinc-400' : ''}>{text}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {step.date && (
                <div className="mt-3 max-w-xs">
                  <label htmlFor={`d-${step.date[0]}`} className={label}>
                    {step.date[1]}
                  </label>
                  <input id={`d-${step.date[0]}`} type="date" className={field} value={dates[step.date[0]] ?? ''} onChange={(e) => setDate(step.date[0], e.target.value)} />
                </div>
              )}
              {step.id === 'enrol' && (
                <p className="mt-3 text-sm">
                  <Source k="recoProgram" />
                </p>
              )}
              {step.id === 'brokerage' && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">Questions to ask every brokerage</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
                    {BROKERAGE_QUESTIONS.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </details>
              )}
              {step.id === 'register' && (
                <p className="mt-3 text-sm">
                  <Source k="reco" />
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <h2 className={h2} id="brokerage">
        Meet a brokerage that’s hiring
      </h2>
      <p className={lede}>Tell us where you are and how far along. We’ll introduce you to a brokerage that takes on new agents, so you can line one up before your courses end.</p>
      <IntroForm progress={progress} />

      <h2 className={h2}>Official sources</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {Object.keys(SOURCES).map((k) => (
          <li key={k}>
            <Source k={k} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Checked {checked}. NorthKey isn’t an education provider or a brokerage, and isn’t connected to RECO: courses, exams and registration are only through RECO and the providers
        it approves. Rules and fees change, so confirm them on the official pages before you pay for anything.
      </p>
    </PageShell>
  );
}

function IntroForm({ progress }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', city: '', stage: 'courses', note: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const STAGES = { thinking: 'Thinking about it', courses: 'Taking the courses', done: 'Finished the courses', registered: 'Already registered' };

  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    const message = [`New agent looking for a brokerage`, `Where: ${f.city}`, `Stage: ${STAGES[f.stage]}`, `Tracker: ${progress.done} of ${progress.total} done`, f.phone && `Phone: ${f.phone}`, f.note && `Note: ${f.note}`]
      .filter(Boolean)
      .join('\n');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: f.name, email: f.email, topic: 'New agent: brokerage intro', message, website: f.website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message });
    }
  };

  if (state.status === 'sent')
    return (
      <div className="mt-5 rounded-xl bg-emerald-500/10 p-5 text-emerald-900 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-100" role="status">
        <p className="font-semibold">Thanks, {f.name.split(' ')[0]}. You’re on our list.</p>
        <p className="mt-1 text-sm">We’ll email {f.email} when we have a brokerage to introduce you to in {f.city}.</p>
      </div>
    );

  return (
    <form onSubmit={send} className="elevated mt-5 space-y-4 rounded-xl p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="b-name" label="Name" value={f.name} onChange={set('name')} required autoComplete="name" />
        <Field id="b-email" label="Email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        <Field id="b-phone" label="Phone (optional)" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
        <Field id="b-city" label="City" value={f.city} onChange={set('city')} required placeholder="e.g. Thunder Bay" />
      </div>
      <div>
        <label htmlFor="b-stage" className={label}>
          Where you are
        </label>
        <select id="b-stage" value={f.stage} onChange={set('stage')} className={field}>
          {Object.entries(STAGES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="b-note" className={label}>
          Anything else (optional)
        </label>
        <textarea id="b-note" rows={3} maxLength={1500} value={f.note} onChange={set('note')} className={field} placeholder="Languages, part-time or full-time, what kind of real estate interests you…" />
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
          className="inline-flex items-center gap-2 rounded-md bg-(--accent) px-5 py-2.5 text-sm font-semibold text-(--accent-ink) transition hover:brightness-110 disabled:opacity-50"
        >
          <Handshake className="size-4" aria-hidden /> {state.status === 'sending' ? 'Sending…' : 'Introduce me'}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          We share your details only with the brokerage we introduce you to. <a className={a} href="/privacy/">Privacy</a>
        </p>
      </div>
    </form>
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
