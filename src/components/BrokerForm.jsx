import { useState } from 'react';
import { Button } from './ui.jsx';
import { cityByKey, provinceName } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { sitePage } from '../lib/site.js';

const input = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

/**
 * Ask to be put in touch with a mortgage broker (`kind` 'broker') or a
 * real estate agent ('agent'), with your numbers attached if you want. An
 * agent request can name the home it's about (`home`: { address, url, price }).
 */
export default function BrokerForm({ p, maxPrice, guide = false, note = '', kind = 'broker', home = null }) {
  const place = cityByKey(p.city);
  const agent = kind === 'agent';
  const [f, setF] = useState({ name: '', email: '', phone: '', timeline: home ? 'Within 3 months' : '3-6 months', note, share: true, consent: false, website: '', side: 'buy' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const body = {
        ...f,
        // About one home: its city, not the one in the person's own numbers.
        city: (agent && home?.city) || place.name,
        ...(f.share && p.entered ? { price: maxPrice, income: p.income } : {}),
        ...(agent && home ? { home: home.address, url: home.url, price: home.price || maxPrice } : {}),
      };
      const res = await fetch(`/api/${agent ? 'agent' : 'broker'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
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
        <p className="mt-1">
          We’ll email you at {f.email} to introduce a licensed {agent ? 'real estate agent' : 'mortgage broker'} in {provinceName(place.province)}. There’s no cost and no obligation.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="space-y-4 p-5">
      {agent ? (
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          A buyer’s agent books showings, pulls what similar homes sold for, writes your offer and negotiates it. In most of Canada the seller pays them, so it usually costs you
          nothing. Ask, and we’ll introduce you to a licensed agent in {place.name}.
          {home && <span className="mt-1 block font-medium text-zinc-950 dark:text-white">About: {home.address}</span>}
        </p>
      ) : (
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        A mortgage broker compares many lenders at once, gets you pre-approved, and is usually paid by the lender, not you. Ask, and we’ll introduce you to a licensed broker in{' '}
        {provinceName(place.province)}.{' '}
        {!guide && (
          <a href={sitePage('/lenders/')} className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
            New to this? Read how to find a lender.
          </a>
        )}
      </p>
      )}
      {agent && !home && (
        <div role="radiogroup" aria-label="Buying or selling" className="inline-flex rounded-md p-0.5 text-sm ring-1 ring-(--line-strong) ring-inset">
          {[
            ['buy', 'Buying'],
            ['sell', 'Selling'],
          ].map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={f.side === v} onClick={() => setF((x) => ({ ...x, side: v }))} className={`rounded px-3 py-1 ${f.side === v ? 'bg-emerald-600 text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {t}
            </button>
          ))}
        </div>
      )}
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
          Include my income ({money(p.income)}) and what I could buy ({money(maxPrice)}) so the {agent ? 'agent' : 'broker'} can start faster.
        </label>
      )}
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" required checked={f.consent} onChange={set('consent')} className="mt-1 accent-emerald-600" />
        <span>
          {agent
            ? 'Pass my details to one licensed real estate agent so they can contact me. Squarely isn’t paid by agents for this. '
            : 'Pass my details to one licensed mortgage broker so they can contact me. Squarely may be paid a referral fee by the broker; it never changes your rate or costs you anything. '}
          <a href={sitePage('/privacy/')} className="underline underline-offset-2">Privacy</a>
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
