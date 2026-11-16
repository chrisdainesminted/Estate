import { useMemo, useState } from 'react';
import { CalendarDays, Gavel, Plus as PlusIcon, Trash2, UserRound } from 'lucide-react';
import { marketSignals, offerRange, offerStrength, offerTimeline, sizeOf } from '../lib/offerRoom.js';
import { unitsOf } from '../lib/market.js';
import { money } from '../lib/format.js';
import { Button, NumberField } from '../components/ui.jsx';

const TONE = { buyer: 'text-emerald-700 dark:text-emerald-400', seller: 'text-amber-700 dark:text-amber-300', even: 'text-zinc-600 dark:text-zinc-400' };
const METER = { strong: 'bg-emerald-600', good: 'bg-emerald-500', fair: 'bg-amber-500', long: 'bg-red-500' };
const dateLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Making an offer on this home: a range to offer in and why, how strong
 * your offer is with the terms you pick, the dates that follow, sold
 * prices from your agent, and a way to reach an agent.
 */
export default function OfferRoom({ s, offer, onOffer, listings = [], offMarket = [], sold = [], onSold, onAgent, today = new Date().toLocaleDateString('en-CA') }) {
  const l = s.listing;
  const [terms, setTerms] = useState({ financing: true, inspection: true, depositPct: 5, closingDays: 60, flexible: false });
  const kind = sizeOf(unitsOf(l));
  const soldHere = useMemo(() => sold.filter((x) => sizeOf(x.units) === kind), [sold, kind]);
  const m = useMemo(() => marketSignals({ listing: l, listings, offMarket, sold: soldHere, today }), [l, listings, offMarket, soldHere, today]);
  const range = useMemo(() => offerRange(l, m), [l, m]);
  const strength = offerStrength(offer, range, m, terms);
  const timeline = offerTimeline(today, terms);
  const set = (k) => (v) => setTerms((t) => ({ ...t, [k]: v }));

  return (
    <section aria-labelledby="offer-room" className="space-y-5 rounded-2xl bg-(--panel) p-5 ring-1 ring-(--line-strong) ring-inset">
      <div>
        <h3 id="offer-room" className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white">
          <Gavel className="size-5 text-emerald-600" aria-hidden /> Make an offer
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Pick a price, see how strong it is, and what happens next.</p>
      </div>

      {/* The range, and what it's built on. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Low', range.low],
          ['Opening offer', range.open],
          ['Most to go', range.high],
        ].map(([name, v], i) => (
          <button
            key={name}
            type="button"
            onClick={() => onOffer(v)}
            className={`rounded-xl p-3 text-left ring-1 ring-inset transition hover:ring-emerald-500 ${i === 1 ? 'bg-emerald-500/10 ring-emerald-600/40' : 'ring-(--line-strong)'}`}
          >
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">{name}</span>
            <span className="tabular block text-xl font-bold text-zinc-950 dark:text-white">{money(v)}</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{Math.round((v / l.price) * 100)}% of asking · tap to use</span>
          </button>
        ))}
      </div>
      <ul className="space-y-1.5 text-sm">
        {m.signals.map((x) => (
          <li key={x.key} className={`flex gap-2 ${TONE[x.tone]}`}>
            <span aria-hidden>{x.tone === 'buyer' ? '▼' : x.tone === 'seller' ? '▲' : '•'}</span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {range.basis === 'sold' ? 'Based on the sold prices you added.' : 'Based on this listing and similar homes for sale. For a sharper range, add sold prices from an agent below.'}
      </p>

      {/* Your offer and its terms. */}
      <div className="grid gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
        <NumberField id="room-offer" label="Your offer" value={offer} onChange={(v) => onOffer(Math.max(Number(v) || 0, 0))} prefix="$" step={1000} decimals={0} />
        <NumberField id="room-deposit" label="Deposit" value={terms.depositPct} onChange={(v) => set('depositPct')(Number(v) || 0)} suffix="%" step={0.5} max={20} decimals={1} hint={money((offer * terms.depositPct) / 100)} />
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Only buy…</legend>
          {[
            ['financing', 'If my mortgage is approved'],
            ['inspection', 'If the inspection is OK'],
          ].map(([k, label]) => (
            <label key={k} className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" className="mt-1" checked={terms[k]} onChange={(e) => set(k)(e.target.checked)} /> {label}
            </label>
          ))}
        </fieldset>
        <div className="space-y-2 text-sm">
          <label htmlFor="room-closing" className="block font-medium text-zinc-800 dark:text-zinc-200">
            Closing in
          </label>
          <select id="room-closing" className="field w-full px-3 py-2" value={terms.closingDays} onChange={(e) => set('closingDays')(Number(e.target.value))}>
            {[30, 45, 60, 75, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" className="mt-1" checked={terms.flexible} onChange={(e) => set('flexible')(e.target.checked)} /> I can move on the seller’s date
          </label>
        </div>
      </div>

      {/* How strong it is. */}
      <div className="rounded-xl bg-(--soft) p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-zinc-950 dark:text-white">
            Offer strength: <span className="text-emerald-700 dark:text-emerald-400">{strength.label}</span>
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Our estimate, not a guarantee</p>
        </div>
        <div role="meter" aria-label="Offer strength" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={100} aria-valuetext={strength.label} className="mt-2 h-2.5 overflow-hidden rounded-full bg-(--track)">
          <div className={`h-full rounded-full transition-[width] duration-500 ${METER[strength.key]}`} style={{ width: `${strength.score}%` }} />
        </div>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{strength.text}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {strength.reasons.map((r) => (
            <li key={r.text} className={r.good ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-600 dark:text-zinc-400'}>
              {r.good ? '✓' : '–'} {r.text}
            </li>
          ))}
        </ul>
      </div>

      {/* What happens next. */}
      <div>
        <p className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
          <CalendarDays className="size-4 text-emerald-600" aria-hidden /> If you offered today
        </p>
        <ol className="mt-2 space-y-2 border-l border-(--line-strong) pl-4">
          {timeline.map((t) => (
            <li key={t.key} className="text-sm">
              <span className="tabular font-semibold text-zinc-950 dark:text-white">{dateLabel(t.date)}</span> · <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.title}</span>
              <span className="block text-zinc-600 dark:text-zinc-400">{t.text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Typical dates. Your agent sets the real ones.</p>
      </div>

      {onSold && <SoldPrices sold={soldHere} units={unitsOf(l)} onChange={(list) => onSold([...sold.filter((x) => !soldHere.includes(x)), ...list])} />}

      {onAgent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-(--line-strong) ring-inset">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold text-zinc-950 dark:text-white">An agent sends your offer.</span> The seller usually pays them, so it’s free to you.
          </p>
          <Button variant="primary" onClick={() => onAgent(l, { offer, ...terms })}>
            <UserRound className="size-4" aria-hidden /> Talk to an agent about this home
          </Button>
        </div>
      )}
    </section>
  );
}

/** Sold prices the buyer's agent sent them, for homes like this one in this city: the strongest thing to build an offer on. */
function SoldPrices({ sold, units, onChange }) {
  const [price, setPrice] = useState(null);
  const [address, setAddress] = useState('');
  return (
    <details className="rounded-xl p-4 ring-1 ring-(--line-strong) ring-inset" open={sold.length > 0}>
      <summary className="cursor-pointer text-sm font-semibold text-zinc-950 dark:text-white">Add sold prices from an agent {sold.length > 0 && `(${sold.length})`}</summary>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Ask an agent what similar homes nearby sold for. Add two or more and the range uses them.</p>
      {sold.length > 0 && (
        <ul className="mt-2 divide-y divide-hairline text-sm">
          {sold.map((x, i) => (
            <li key={`${x.address}-${x.price}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-zinc-700 dark:text-zinc-300">{x.address || 'A similar home'}</span>
              <span className="tabular font-semibold text-zinc-950 dark:text-white">{money(x.price)}</span>
              <button type="button" aria-label="Remove" onClick={() => onChange(sold.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:bg-well hover:text-zinc-700">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!(Number(price) > 0)) return;
          onChange([...sold, { price: Math.round(Number(price)), address: address.trim().slice(0, 120), units, date: new Date().toLocaleDateString('en-CA') }].slice(-20));
          setPrice(null);
          setAddress('');
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-zinc-700 dark:text-zinc-300">Address (optional)</span>
          <input className="field w-full px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 41 Elm St" />
        </label>
        <NumberField id="sold-price" label="Sold for" value={price} onChange={setPrice} prefix="$" step={1000} decimals={0} />
        <Button type="submit">
          <PlusIcon className="size-4" aria-hidden /> Add
        </Button>
      </form>
    </details>
  );
}
