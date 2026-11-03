import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { accountCall } from '../lib/account.js';
import { Button } from './ui.jsx';

// Squarely Plus, $12 a month: the extras that save real time and money.
// The core of Squarely stays free; landlord tools are free with 2% of the
// rent they track. On the owner's own Claude page everything is on.

export const PLUS_PRICE = '$12/mo';
export const PLUS_FEATURES = [
  { key: 'blueprint', text: 'Blueprints read for you: upload a floor plan, get a materials list' },
  { key: 'alerts', text: 'Daily emails when a listing drops its price or a new one fits you' },
  { key: 'report', text: 'Pricing report for your home, as a PDF to share' },
  { key: 'pdf', text: 'Deal memos and materials lists as PDFs' },
  { key: 'pro', text: 'Pro deals: tax sales and lender, estate and court sales, with the numbers run' },
  { key: 'ask', text: 'Ask Squarely: questions answered from your own numbers' },
];

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
    async (path) => {
      setError('');
      if (!account) return onNeedAccount?.();
      try {
        const { url } = await accountCall(account, path, { method: 'POST', body: {} });
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
      start: () => go('/plus'),
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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {plus.available ? (
          <Button variant="primary" onClick={plus.start}>
            {plus.hasAccount ? `Get Plus, ${PLUS_PRICE}` : 'Make a free account to get Plus'}
          </Button>
        ) : (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Plus is coming soon to this site.</span>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Cancel any time. Plans, checklists and listings stay free.</span>
      </div>
      {plus.error && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
          {plus.error}
        </p>
      )}
    </div>
  );
}
