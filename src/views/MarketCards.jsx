import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, EyeOff, Eye, TrendingDown } from 'lucide-react';
import HousePhoto from '../components/HousePhoto.jsx';
import { Button, NumberField } from '../components/ui.jsx';
import { analyzeDeal } from '../lib/finance.js';
import { money, percent } from '../lib/format.js';
import { CITY_VACANCY, daysListed, isNew, listingPageUrl, siteName, unitsOf } from '../lib/market.js';
import { DISTRESS, distressOf } from '../lib/distress.js';
import { listingSentence } from '../lib/explain.js';

const KIND = { 1: 'House', 2: 'Duplex', 3: 'Triplex', 4: 'Fourplex' };
export const kindOf = (l) => KIND[unitsOf(l)] ?? `${unitsOf(l)} units`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

/** The last price move of a listing: { from, to, change, pct, date } or null. */
export function lastMove(l) {
  const h = Array.isArray(l?.priceHistory) ? l.priceHistory.filter((p) => Number(p.price) > 0) : [];
  if (h.length < 2) return null;
  const from = Number(h[h.length - 2].price);
  const to = Number(h[h.length - 1].price);
  if (from === to) return null;
  return { from, to, change: to - from, pct: (to - from) / from, date: h[h.length - 1].date, first: h[0].date, start: Number(h[0].price) };
}

/** The biggest price cut among listings, as a share of the old price. */
export function biggestMover(items) {
  let best = null;
  for (const s of items) {
    const m = lastMove(s.listing);
    if (m && m.change < 0 && (!best || m.pct < best.m.pct)) best = { s, m };
  }
  return best;
}

const up = 'text-emerald-700 dark:text-[#73ff6a]';
const down = 'text-red-700 dark:text-[#ff8a80]';
const label = 'text-[11px] text-zinc-500 dark:text-zinc-400';

/** A row of the city's figures, like a market ticker. */
export function TickerStrip({ active, items, fresh, place, market, city }) {
  const cuts = active.filter((l) => (lastMove(l)?.change ?? 0) < 0).length;
  const vacancy = CITY_VACANCY[city];
  const cells = [
    ['Median ask', money(median(active.map((l) => Number(l.price) || 0)))],
    ['For sale', String(active.length)],
    ['New', `+${fresh}`, fresh ? up : ''],
    ['Price cuts', String(cuts), cuts ? down : ''],
    ['Beat your targets', String(items.filter((s) => s.meets).length), up],
    ['5-yr fixed', `${market.rate}%`],
    ...(vacancy != null ? [['Vacancy', `${vacancy}%`]] : []),
  ];
  return (
    <div className="tabular thin-scroll flex items-baseline gap-x-7 gap-y-2 overflow-x-auto rounded-xl max-sm:whitespace-nowrap sm:flex-wrap bg-zinc-950/[0.03] px-4 py-3 text-[13px] ring-1 ring-(--line-strong) ring-inset dark:bg-white/[0.03]">
      <span className="font-semibold text-zinc-950 dark:text-white">{place.name}</span>
      {cells.map(([k, v, tone]) => (
        <span key={k} className="whitespace-nowrap">
          <span className="text-zinc-500 dark:text-zinc-400">{k}</span> <strong className={`font-semibold text-zinc-950 dark:text-white ${tone ?? ''}`}>{v}</strong>
        </span>
      ))}
    </div>
  );
}

/** The listing whose price fell furthest, like a market's top mover. */
export function MoverBanner({ mover, onOpen }) {
  if (!mover) return null;
  const { s, m } = mover;
  return (
    <button
      type="button"
      onClick={() => onOpen(s.listing.id)}
      className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl bg-red-500/[0.06] px-4 py-3 text-left ring-1 ring-red-600/20 transition ring-inset hover:bg-red-500/[0.1] dark:ring-red-400/25"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-red-700 uppercase dark:text-[#ff8a80]">
        <TrendingDown className="size-3.5" aria-hidden /> Biggest mover
      </span>
      <span className="font-semibold text-zinc-950 dark:text-white">{s.listing.address}</span>
      <span className="tabular font-bold text-zinc-950 dark:text-white">{money(m.to)}</span>
      <span className={`tabular font-semibold ${down}`}>
        ▼ {money(-m.change)} ({percent(m.pct, 1)})
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {kindOf(s.listing)}
        {!s.needsTax && ` · ${money(s.a.netCashFlow, { signed: true })}/mo`}
      </span>
    </button>
  );
}

function Badge({ tone = 'good', children }) {
  const tones = {
    good: 'bg-emerald-600 text-white dark:bg-[#173a1c] dark:text-[#a6ffa0]',
    bad: 'bg-red-600 text-white dark:bg-[#3a1715] dark:text-[#ffb4ab]',
    plain: 'bg-zinc-900/80 text-white dark:bg-black/70 dark:text-zinc-100',
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${tones[tone]}`}>{children}</span>;
}

/** One listing as a card: its photo, price, what it pays you and how its price has moved. */
export function ListingCard({ s, feed, below, place, onOpen }) {
  const l = s.listing;
  const m = lastMove(l);
  const badges = [
    s.meets && ['good', 'Beats your targets'],
    m && m.change < 0 && ['bad', `▼ Price cut ${percent(-m.pct, 1)}`],
    isNew(l, feed) && ['good', 'New'],
    below > 0 && ['plain', `${Math.round(below * 100)}% under going rate`],
    distressOf(l) && ['plain', DISTRESS[distressOf(l)].label],
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onOpen(l.id)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-(--line-strong) transition ring-inset hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:bg-[#101012]"
    >
      <HousePhoto address={l.address} place={place} className="aspect-[16/10] w-full" label="Street View photo" width={640} height={400}>
        {badges.length > 0 && (
          <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {badges.slice(0, 2).map(([tone, text]) => (
              <Badge key={text} tone={tone}>
                {text}
              </Badge>
            ))}
          </span>
        )}
      </HousePhoto>
      <span className="flex flex-col gap-2.5 p-4">
        <span className="flex items-baseline justify-between gap-2">
          <span className="tabular text-[22px] font-bold tracking-tight text-zinc-950 dark:text-white">{money(s.a.price)}</span>
          {!s.needsTax && <span className={`tabular text-sm font-bold ${s.a.coc >= 0 ? up : down}`}>{percent(s.a.coc, 1)}</span>}
        </span>
        <span>
          <span className="block font-semibold text-zinc-950 dark:text-white">{l.address}</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            {kindOf(l)}
            {l.yearBuilt ? ` · built ${l.yearBuilt}` : ''} · {daysListed(l) ?? 0} days listed
          </span>
        </span>
        <span className="tabular grid grid-cols-3 gap-2 border-t border-hairline pt-2.5 text-xs">
          <span>
            <span className={`block ${label}`}>Cash flow</span>
            <span className={`block font-bold ${s.needsTax ? 'text-zinc-500' : s.a.netCashFlow >= 0 ? up : down}`}>{s.needsTax ? 'Needs tax' : `${money(s.a.netCashFlow, { signed: true })}/mo`}</span>
          </span>
          <span>
            <span className={`block ${label}`}>{s.lens === 'own' ? 'Mortgage' : 'Lender test'}</span>
            <span className="block font-bold text-zinc-950 dark:text-white">{s.lens === 'own' ? `${money(s.a.pi)}/mo` : `${s.a.dscr.toFixed(2)}×`}</span>
          </span>
          <span>
            <span className={`block ${label}`}>Tax bill</span>
            <span className="block font-bold text-zinc-950 dark:text-white">{s.needsTax ? 'Not listed' : money(s.a.taxes * 12)}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

/** The listing's asking price over time, drawn as steps. */
function PriceChart({ l }) {
  const h = (Array.isArray(l.priceHistory) ? l.priceHistory : []).filter((p) => Number(p.price) > 0 && p.date);
  const pts = h.length ? h : [{ date: l.firstSeen ?? '', price: Number(l.price) }];
  const prices = pts.map((p) => Number(p.price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || hi * 0.1 || 1;
  // One price (no changes yet): a flat line across the middle.
  const y = (v) => (hi === lo ? 95 : 170 - ((v - (lo - span * 0.2)) / (span * 1.4)) * 150);
  const step = pts.length > 1 ? 1000 / pts.length : 1000;
  let d = `M0 ${y(prices[0]).toFixed(1)}`;
  pts.forEach((p, i) => {
    if (i) d += ` L${(i * step).toFixed(1)} ${y(prices[i - 1]).toFixed(1)} L${(i * step).toFixed(1)} ${y(prices[i]).toFixed(1)}`;
  });
  d += ` L1000 ${y(prices[prices.length - 1]).toFixed(1)}`;
  const fell = prices[prices.length - 1] < prices[0];
  const rose = prices[prices.length - 1] > prices[0];
  const color = fell ? '#ff8a80' : rose ? '#73ff6a' : '#a1a1aa';
  const day = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '');
  const words = pts.map((p) => `${day(p.date)}: ${money(Number(p.price))}`).join(', ');
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-(--line-strong) ring-inset dark:bg-[#101012]">
      <p className="text-sm font-semibold text-zinc-950 dark:text-white">Asking price</p>
      <svg viewBox="0 0 1000 190" preserveAspectRatio="none" role="img" aria-label={`Asking price over time. ${words}`} className="mt-3 block h-44 w-full">
        <line x1="0" y1="189" x2="1000" y2="189" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="tabular mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {pts.map((p, i) => (
          <span key={`${p.date}-${i}`}>
            {day(p.date)} · {money(Number(p.price))}
          </span>
        ))}
        <span>Today</span>
      </div>
      {pts.length < 2 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No price changes since Squarely first saw it.</p>}
    </div>
  );
}

function Fact({ name, value, tone = '', note }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-(--line-strong) ring-inset dark:bg-[#101012]">
      <p className={label}>{name}</p>
      <p className={`tabular mt-1.5 text-xl font-bold tracking-tight text-zinc-950 dark:text-white ${tone}`}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

/**
 * One listing, laid out like a stock's page: pictures, the price and how
 * it has moved, what it would pay you, and a ticket to try an offer.
 */
export function ListingDetail({ s, place, imported, hidden, onBack, onAnalyze, onHide, onUnhide, onTax }) {
  const l = s.listing;
  const link = listingPageUrl(l.url, l.address);
  const m = lastMove(l);
  const [offer, setOffer] = useState(s.a.price);
  const [downPct, setDownPct] = useState(Number(s.deal.downPct));
  const [rate, setRate] = useState(Number(s.deal.rate));
  const [tax, setTax] = useState('');
  const run = useMemo(() => analyzeDeal({ ...s.deal, price: offer, downPct, rate, refiRate: rate }), [s.deal, offer, downPct, rate]);
  const max = Number.isFinite(s.offer.price) ? s.offer.price : null;
  const sentence = listingSentence(s);
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline dark:text-[#73ff6a]">
        <ArrowLeft className="size-4" aria-hidden /> Back to the market
      </button>

      <div className="grid gap-3 lg:grid-cols-3">
        <HousePhoto address={l.address} place={place} className="min-h-64 rounded-2xl lg:col-span-2 lg:min-h-[22rem]" label="Street View of the front" width={640} height={420} iconSize="size-12" />
        <div className="grid gap-3 max-lg:grid-cols-2">
          <HousePhoto address={l.address} place={place} kind="satellite" className="min-h-40 rounded-2xl" label="Satellite view of the lot" width={640} height={360} />
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-2xl bg-zinc-950/[0.03] p-4 text-center ring-1 ring-(--line-strong) transition ring-inset hover:bg-well dark:bg-white/[0.03]"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950 dark:text-white">
              All listing photos <ExternalLink className="size-4" aria-hidden />
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">on {siteName(link)}</span>
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <section className="min-w-0 flex-[999_1_620px] space-y-6">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {place.name} · {kindOf(l).toLowerCase()}
              {l.yearBuilt ? ` · built ${l.yearBuilt}` : ''}
              {l.mls ? ` · MLS® ${l.mls}` : ''}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">{l.address}</h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="tabular text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">{money(s.a.price)}</span>
              {m ? (
                <span className={`tabular text-base font-bold ${m.change < 0 ? down : up}`}>
                  {m.change < 0 ? '▼' : '▲'} {money(Math.abs(m.change))} ({percent(Math.abs(m.pct), 1)}) <span className="font-normal text-zinc-500 dark:text-zinc-400">on {m.date}</span>
                </span>
              ) : (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{daysListed(l) ?? 0} days listed, no price changes</span>
              )}
            </p>
            {l.highlights && <p className="mt-3 max-w-2xl text-sm text-zinc-700 dark:text-zinc-300">{l.highlights}</p>}
            {sentence && <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{sentence}</p>}
          </div>

          <PriceChart l={l} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact
              name={`Cash flow, ${s.lens === 'own' ? `${s.deal.downPct}% down` : 'DSCR loan'}`}
              value={s.needsTax ? 'Needs the tax bill' : `${money(s.a.netCashFlow, { signed: true })}/mo`}
              tone={s.needsTax ? '' : s.a.netCashFlow >= 0 ? up : down}
            />
            <Fact name="Return on your cash" value={s.needsTax ? '—' : percent(s.a.coc, 1)} />
            <Fact name="Most you should pay" value={max != null ? money(max) : s.offer.price == null ? 'No price works' : 'No limit'} note={max != null ? `${max >= s.a.price ? money(max - s.a.price) + ' over asking' : money(s.a.price - max) + ' under asking'}` : null} />
            <Fact name="Lender test (DSCR)" value={`${s.a.dscr.toFixed(2)}×`} note={s.a.status?.label} />
            <Fact name={`Rent${s.rentSource === 'stated' ? '' : ' (estimated)'}`} value={`${money(s.a.grossRent)}/mo`} />
            <Fact name="Tax bill" value={s.needsTax ? 'Not listed' : `${money(s.a.taxes * 12)}/yr`} />
          </div>
          {s.needsTax && onTax && (
            <form
              className="flex flex-wrap items-end gap-2 rounded-xl bg-amber-500/10 p-4 ring-1 ring-amber-600/20 ring-inset"
              onSubmit={(e) => {
                e.preventDefault();
                const v = Math.round(Number(String(tax).replace(/[^\d.]/g, '')));
                if (v > 0) onTax(l, v);
              }}
            >
              <label className="grow text-sm text-amber-950 dark:text-amber-100">
                <span className="mb-1.5 block">The listing doesn’t give its tax bill. Find it on the listing page and add it for real numbers:</span>
                <input inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Yearly tax, e.g. 4,100" className="field w-full px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </label>
              <Button type="submit" variant="primary">
                Add tax bill
              </Button>
            </form>
          )}
        </section>

        <aside className="min-w-0 flex-[1_1_320px]">
          <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-(--line-strong) ring-inset lg:sticky lg:top-20 dark:bg-[#121214]">
            <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Run an offer</h3>
            <NumberField id="ofr-price" label="Your offer" value={offer} onChange={setOffer} prefix="$" step={5000} decimals={0} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="ofr-down" label="Down payment" value={downPct} onChange={setDownPct} suffix="%" min={5} max={100} step={1} decimals={1} />
              <NumberField id="ofr-rate" label="Rate" value={rate} onChange={setRate} suffix="%" max={20} step={0.05} />
            </div>
            <div className="tabular space-y-2 border-t border-hairline pt-3 text-sm">
              <p className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Cash to buy</span>
                <strong className="text-zinc-950 dark:text-white">{money(run.cashInvested)}</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Mortgage payment</span>
                <strong className="text-zinc-950 dark:text-white">{money(run.pi)}/mo</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Left each month</span>
                <strong className={s.needsTax ? 'text-zinc-500' : run.netCashFlow >= 0 ? up : down}>{s.needsTax ? 'Needs tax' : money(run.netCashFlow, { signed: true })}</strong>
              </p>
              {max != null && (
                <p className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">{offer <= max ? 'Room under your max' : 'Over your max by'}</span>
                  <strong className={offer <= max ? up : down}>{money(Math.abs(max - offer))}</strong>
                </p>
              )}
            </div>
            <Button variant="primary" className="w-full py-3 text-[15px]" onClick={() => onAnalyze(l, { price: offer, downPct, rate, refiRate: rate })}>
              {imported ? 'Open your saved deal' : 'Analyze this deal'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100">
                Listing <ExternalLink className="size-3.5" aria-hidden />
              </a>
              {hidden ? (
                <Button onClick={() => onUnhide(l.id)}>
                  <Eye className="size-4" aria-hidden /> Unhide
                </Button>
              ) : (
                <Button onClick={() => (onHide(l.id), onBack())}>
                  <EyeOff className="size-4" aria-hidden /> Hide
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
