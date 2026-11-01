import { useState } from 'react';
import { Button } from './ui.jsx';
import { cityByKey, provinceName } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { sitePage } from '../lib/site.js';

const input = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

/** Ask to be put in touch with a mortgage broker, with your numbers attached if you want. */
export default function BrokerForm({ p, maxPrice, guide = false }) {
  const place = cityByKey(p.city);
  const [f, setF] = useState({ name: '', email: '', phone: '', timeline: '3-6 months', note: '', share: true, consent: false, website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const body = { ...f, city: place.name, ...(f.share && p.entered ? { price: maxPrice, income: p.income } : {}) };
      const res = await fetch('/api/broker', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message === 'Failed to fetch' ? 'This works on the Squarely website. Open it there to send.' : err.message });
    }
  };
  if (state.status === 'sent') {
    return (
      <div className="m-5 rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-900 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-100">
        <p className="font-semibold">Thanks, {f.name.split(' ')[0]}. Your request is in.</p>
        <p className="mt-1">We’ll email you at {f.email} to introduce a licensed mortgage broker in {provinceName(place.province)}. There’s no cost and no obligation.</p>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="space-y-4 p-5">
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        A mortgage broker compares many lenders at once, gets you pre-approved, and is usually paid by the lender, not you. Ask, and we’ll introduce you to a licensed broker in{' '}
        {provinceName(place.province)}.{' '}
        {!guide && (
          <a href={sitePage('/lenders/')} className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
            New to this? Read how to find a lender.
          </a>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="br-name" className={label}>
            Name
          </label>
          <input id="br-name" required autoComplete="name" value={f.name} onChange={set('name')} className={input} />
        </div>
        <div>
          <label htmlFor="br-email" className={label}>
            Email
          </label>
          <input id="br-email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} className={input} />
        </div>
        <div>
          <label htmlFor="br-phone" className={label}>
            Phone (optional)
          </label>
          <input id="br-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} className={input} />
        </div>
        <div>
          <label htmlFor="br-when" className={label}>
            When do you want to buy?
          </label>
          <select id="br-when" value={f.timeline} onChange={set('timeline')} className={input}>
            {['Within 3 months', '3-6 months', '6-12 months', 'More than a year', 'Just exploring'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="br-note" className={label}>
          Anything they should know? (optional)
        </label>
        <textarea id="br-note" rows={2} value={f.note} onChange={set('note')} className={input} placeholder="Self-employed, buying a duplex, new to Canada…" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
      {p.entered && (
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={f.share} onChange={set('share')} className="mt-1 accent-emerald-600" />
          Include my income ({money(p.income)}) and what I could buy ({money(maxPrice)}) so the broker can start faster.
        </label>
      )}
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" required checked={f.consent} onChange={set('consent')} className="mt-1 accent-emerald-600" />
        <span>
          Pass my details to one licensed mortgage broker so they can contact me. Squarely may be paid a referral fee by the broker; it never changes your rate or costs you
          anything. <a href={sitePage('/privacy/')} className="underline underline-offset-2">Privacy</a>
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? 'Sending…' : 'Put me in touch'}
      </Button>
    </form>
  );
}
