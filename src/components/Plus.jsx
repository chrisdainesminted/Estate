import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { accountCall } from '../lib/account.js';
import { track } from '../lib/track.js';
import { Button } from './ui.jsx';

// Squarely Plus, $12 a month: the extras that save real time and money.
// The core of Squarely stays free; landlord tools are free with 2% of the
// rent they track. On the owner's own Claude page everything is on.

export const PLUS_PRICE = '$12/mo';
export const PLUS_YEAR = '$99/yr';
export const TRIAL_DAYS = 7;
// Each one says what you get, not what the tool is called.
export const PLUS_FEATURES = [
  { key: 'offer', text: 'Know the most to pay: an Offer Pack for any home, to take to your agent or lender' },
  { key: 'pro', text: 'Find homes under market: tax, lender, estate and court sales, with the numbers run' },
  { key: 'alerts', text: 'Hear first: a daily email when a price drops or a new home fits you' },
  { key: 'report', text: 'Price your home right: a pricing report as a PDF to share' },
  { key: 'blueprint', text: 'Skip the takeoff: upload a floor plan, get the materials list' },
  { key: 'pdf', text: 'Look prepared: deal memos and materials lists as PDFs' },
  { key: 'ask', text: 'Ask Squarely: answers from your own numbers' },
];
export const GUARANTEE = 'Not worth it? Ask within 30 days of your first payment for a full refund.';

const PlusContext = createContext({ active: false, ready: true, available: false, start: async () => {}, manage: async () => {} });
export const usePlus = () => useContext(PlusContext);

/**
 * Knows whether this account has Plus, and starts or manages the
 * subscription (Stripe's checkout and billing pages). `onNeedAccount` opens
 * the account sheet when someone without an account tries to subscribe.
 */
export function usePlusState({ account, hosted, onNeedAccount }) {
  const [state, setState] = useState({ active: false, ready: !account, status: '' });
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hosted) return undefined;
    let live = true;
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : {}))
      .then((c) => live && setAvailable(Boolean(c.billing)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hosted]);

  useEffect(() => {
    if (hosted || !account) return undefined;
    let live = true;
    // Back from Stripe: the webhook may land a moment after the person does, so look again a few times.
    const welcome = new URLSearchParams(window.location.search).get('plus') === 'welcome';
    let tries = 0;
    const load = () =>
      accountCall(account)
        .then((r) => {
          if (!live) return;
          setState({ active: Boolean(r.plus?.active), comp: Boolean(r.plus?.comp), ready: true, status: r.plus?.status ?? '', cancelAt: r.plus?.cancelAt ?? 0 });
          if (welcome && !r.plus?.active && tries++ < 6) setTimeout(load, 2500);
        })
        .catch(() => live && setState((s) => ({ ...s, ready: true })));
    load();
    return () => {
      live = false;
    };
  }, [account, hosted]);

  const go = useCallback(
    async (path, body = {}) => {
      setError('');
      if (!account) return onNeedAccount?.();
      try {
        const { url } = await accountCall(account, path, { method: 'POST', body });
        if (url) window.location.assign(url);
      } catch (e) {
        setError(e.message);
      }
    },
    [account, onNeedAccount],
  );

  const value = useMemo(
    () => ({
      active: hosted || state.active,
      ready: hosted || state.ready,
      status: state.status,
      cancelAt: state.cancelAt,
      // Plus for good, given by the site: nothing to manage or cancel.
      comp: !hosted && Boolean(state.comp),
      hosted,
      available: !hosted && available,
      hasAccount: Boolean(account),
      error,
      // { interval: 'year' } for the yearly price; a first subscription starts with the free week.
      start: (opts) => (track('plus_click'), go('/plus', opts?.interval === 'year' ? { interval: 'year' } : {})),
      // Someone who has never subscribed gets the free week (the server decides the same way).
      trial: !state.status,
      manage: () => go('/plus/manage'),
    }),
    [hosted, state, available, account, error, go],
  );
  return value;
}

export const PlusProvider = PlusContext.Provider;

/** A small "Plus" mark beside a feature that needs it. */
export function PlusTag({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-300 ${className}`}>
      <Sparkles className="size-2.5" aria-hidden /> Plus
    </span>
  );
}

/**
 * Where a Plus feature would be: what it does, and how to get it. Shows
 * `children` instead once the person has Plus.
 */
export function PlusGate({ feature, children, compact = false }) {
  const plus = usePlus();
  if (plus.active) return children ?? null;
  return <PlusOffer feature={feature} compact={compact} />;
}

export function PlusOffer({ feature, compact = false }) {
  const plus = usePlus();
  const [yearly, setYearly] = useState(true);
  const f = PLUS_FEATURES.find((x) => x.key === feature);
  return (
    <div className={`rounded-lg bg-emerald-500/[0.07] ring-1 ring-emerald-600/20 ring-inset ${compact ? 'p-3' : 'p-4'} text-sm`}>
      <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-950 dark:text-white">
        <PlusTag /> {f ? f.text : 'Part of Squarely Plus'}
      </p>
      {!compact && (
        <ul className="mt-2 grid gap-1 text-xs text-zinc-700 dark:text-zinc-300">
          {PLUS_FEATURES.filter((x) => x.key !== feature).map((x) => (
            <li key={x.key}>· {x.text}</li>
          ))}
        </ul>
      )}
      {plus.available && plus.hasAccount && (
        <div role="radiogroup" aria-label="How to pay" className="mt-3 inline-flex rounded-md bg-(--panel) p-0.5 text-xs ring-1 ring-hairline">
          {[
            [true, `${PLUS_YEAR}`, 'save 31%'],
            [false, PLUS_PRICE, ''],
          ].map(([val, price, note]) => (
            <button
              key={price}
              type="button"
              role="radio"
              aria-checked={yearly === val}
              onClick={() => setYearly(val)}
              className={`rounded px-2.5 py-1 font-medium ${yearly === val ? 'bg-emerald-600 text-white' : 'text-zinc-700 dark:text-zinc-300'}`}
            >
              {price}
              {note && <span className={`ml-1 ${yearly === val ? 'text-white/80' : 'text-emerald-700 dark:text-emerald-300'}`}>{note}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {plus.available ? (
          <Button variant="primary" onClick={() => plus.start({ interval: yearly ? 'year' : 'month' })}>
            {!plus.hasAccount ? 'Make a free account to try Plus' : plus.trial ? `Try it free for ${TRIAL_DAYS} days` : `Get Plus, ${yearly ? PLUS_YEAR : PLUS_PRICE}`}
          </Button>
        ) : (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Plus is coming soon to this site.</span>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {plus.available && plus.hasAccount && plus.trial ? `Then ${yearly ? PLUS_YEAR : PLUS_PRICE}. Cancel before the ${TRIAL_DAYS} days end and pay nothing.` : 'Cancel any time. Plans, checklists and listings stay free.'}
        </span>
      </div>
      {plus.available && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{GUARANTEE}</p>}
      {plus.error && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
          {plus.error}
        </p>
      )}
    </div>
  );
}
