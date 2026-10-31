import { useState } from 'react';
import PageShell, { a, h1, lede } from './PageShell.jsx';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const TOPICS = ['A question', 'A number looks wrong', 'A listing', 'Landlord tools or billing', 'My personal information', 'An idea', 'Something else'];

/** The contact form: notes land in the owner's inbox on the server; no public email address. */
export default function Contact() {
  const [f, setF] = useState({ name: '', email: '', topic: TOPICS[0], message: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message });
    }
  };
  return (
    <PageShell>
      <h1 className={h1}>Get in touch</h1>
      <p className={lede}>
        Questions, corrections, a listing that looks wrong, or a request about your personal information. We read everything and reply by email, usually within two business
        days.
      </p>
      {state.status === 'sent' ? (
        <div className="mt-8 rounded-xl bg-emerald-500/10 p-5 text-emerald-900 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-100" role="status">
          <p className="font-semibold">Thanks, {f.name.split(' ')[0]}. Your message is in.</p>
          <p className="mt-1 text-sm">We’ll reply to {f.email}.</p>
        </div>
      ) : (
        <form onSubmit={send} className="elevated mt-8 space-y-4 rounded-xl p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-name" className={label}>
                Name
              </label>
              <input id="c-name" required autoComplete="name" value={f.name} onChange={set('name')} className={field} />
            </div>
            <div>
              <label htmlFor="c-email" className={label}>
                Email
              </label>
              <input id="c-email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} className={field} />
            </div>
          </div>
          <div>
            <label htmlFor="c-topic" className={label}>
              About
            </label>
            <select id="c-topic" value={f.topic} onChange={set('topic')} className={field}>
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="c-msg" className={label}>
              Message
            </label>
            <textarea id="c-msg" required minLength={5} rows={6} value={f.message} onChange={set('message')} className={field} />
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
              {state.status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We keep your message for up to a year to answer it. <a className={a} href="/privacy/">Privacy</a>
            </p>
          </div>
        </form>
      )}
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        Reporting a listing? Use the Report button on the listing itself so we see which one. Landlords: your workspace link is private, so never send it to us.
      </p>
    </PageShell>
  );
}
