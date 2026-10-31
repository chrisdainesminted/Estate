import { Suspense, lazy, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BellPlus, BellRing, Check, ChevronDown, ExternalLink, Eye, EyeOff, Radar, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { DEFAULT_MARKET, LISTING_CITIES, LISTING_TYPES, SORTS, localMarket, alertMatches, alertName, daysListed, droppedInLatestRun, freshMatches, isNew, priceStory, underMarket, lensTargets, listingPageUrl, listingToDeal, rankListings, siteName, typeOf } from '../lib/market.js';
import { homeFor } from '../lib/firstHome.js';
import { PROVINCES, cityByKey, provinceName } from '../lib/canada.js';
import { listingSentence } from '../lib/explain.js';
import { money, percent } from '../lib/format.js';
import { Button, Card, CardHeader, DscrChip, NumberField, Segmented, SelectField, SkeletonCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { InfoTip } from '../components/motion.jsx';

const ListingsMap = lazy(() => import('../components/ListingsMap.jsx'));

const KIND = { 1: 'House', 2: 'Duplex', 3: 'Triplex', 4: 'Fourplex' };
// Shorter type names so the three filters fit across a phone.
const SHORT_TYPE = { single: 'Singles' };
const RENT_TEXT = { stated: 'Rents as listed', mixed: 'Some rents estimated', estimated: 'Rents estimated' };
const STALE_AFTER = 36 * 3600 * 1000;
const ROTATION_STALE_AFTER = 10 * 86400 * 1000;
// The best few show first; the rest are a tap away.
const FIRST_PAGE = 10;

function when(at) {
  if (!Number.isFinite(at)) return null;
  const d = new Date(at);
  const day = (offset) => new Date(Date.now() - offset * 86400000).toDateString();
  const label = d.toDateString() === day(0) ? 'today' : d.toDateString() === day(1) ? 'yesterday' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${label} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const median = (values) => {
  const v = values.filter(Number.isFinite).sort((p, q) => p - q);
  if (!v.length) return NaN;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** A filter that switches on and off; on, it gets a tick and a darker edge. */
const toggle = (on) =>
  `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
    on
      ? 'bg-zinc-950/[0.05] font-semibold text-zinc-950 ring-zinc-500 dark:bg-white/[0.07] dark:text-white'
      : 'font-medium text-zinc-600 ring-(--line-strong) hover:bg-well hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
  }`;

function Tag({ accent, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-px text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${
        accent ? 'text-emerald-800 ring-emerald-600/40 dark:text-emerald-300 dark:ring-emerald-400/40' : 'text-zinc-600 ring-(--line-strong) dark:text-zinc-300'
      }`}
    >
      {accent && <Check className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

function Metric({ label, tip, children, sub }) {
  return (
    <div className="min-w-0">
      <dt className="caption flex items-center gap-1">
        {label}
        {tip && <InfoTip k={tip} />}
      </dt>
      <dd className="tabular mt-1 text-[15px] font-semibold text-zinc-900 dark:text-white">{children}</dd>
      {sub && <dd className="tabular text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</dd>}
    </div>
  );
}

/** "today", "yesterday" or "Oct 26", for a YYYY-MM-DD date. */
function dayLabel(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  const daysAgo = Math.round((new Date().setHours(12, 0, 0, 0) - d.getTime()) / 86400000);
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** How long it's been for sale, how its price has moved, and how it compares with the rest of the list. */
function History({ days, story, below }) {
  const { points, first, now, change, moves } = story;
  const w = 120;
  const h = 28;
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const xy = points.map((p, i) => [points.length > 1 ? (i / (points.length - 1)) * w : w / 2, hi === lo ? h / 2 : h - 3 - ((p.price - lo) / (hi - lo)) * (h - 6)]);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
      {days != null && (
        <span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{days === 0 ? 'New today' : `${days} day${days === 1 ? '' : 's'}`}</span> on Bedrock’s list
        </span>
      )}
      <span className="inline-flex items-center gap-2">
        {moves > 0 && (
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
            <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth="2" className={change < 0 ? 'stroke-emerald-500' : 'stroke-amber-500'} />
            {xy.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" className={change < 0 ? 'fill-emerald-500' : 'fill-amber-500'} />
            ))}
          </svg>
        )}
        {moves === 0 ? (
          'No price changes yet'
        ) : (
          <span>
            {money(first)} → <span className="font-semibold text-zinc-900 dark:text-zinc-100">{money(now)}</span>{' '}
            <span className={change < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
              ({change < 0 ? '−' : '+'}
              {money(Math.abs(change))}, {moves} change{moves === 1 ? '' : 's'})
            </span>
          </span>
        )}
      </span>
      {below > 0 && <span className="font-medium text-emerald-700 dark:text-emerald-400">Priced {Math.round(below * 100)}% under similar homes on this list, per door</span>}
    </div>
  );
}

const todayIso = () => new Date().toLocaleDateString('en-CA');
const dayAfter = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** New or cheaper homes that match your saved alerts in this city, since you last looked. */
function AlertBanners({ alerts, feed, market, profile, onSeen, place }) {
  const rows = alerts
    .map((a) => ({ a, fresh: freshMatches(alertMatches(a, feed, { market, profile, homeFor }), a.seen ? dayAfter(a.seen) : a.since) }))
    .filter((x) => x.fresh.length);
  if (!rows.length) return null;
  return rows.map(({ a, fresh }) => (
    <div key={a.id} className="rise rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-50 dark:ring-emerald-400/20">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 font-semibold">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          {fresh.length} new or cheaper: {alertName(a, place.name)}
        </p>
        <button type="button" onClick={() => onSeen(a.id)} className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium hover:bg-emerald-500/15">
          Mark as seen
        </button>
      </div>
      <ul className="mt-1.5 space-y-0.5 pl-6">
        {fresh.slice(0, 5).map(({ listing: l, costToLive, perDoor }) => (
          <li key={l.id}>
            {l.address}, {money(l.price)}
            <span className="text-emerald-800/80 dark:text-emerald-200/80">
              {costToLive != null ? ` · ${money(costToLive)}/mo to live in` : ''} · {money(perDoor, { signed: true })}/door
            </span>
          </li>
        ))}
      </ul>
    </div>
  ));
}

/** Save the search: this city, these property types, and the limits you set. */
function AlertForm({ city, place, types, onCancel, onSave }) {
  const [f, setF] = useState({ types, maxPrice: '', maxLive: '', minPerDoor: '' });
  const n = (v) => (v === '' ? null : Number(v));
  return (
    <Card className="p-4 sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ city, types: f.types, maxPrice: n(f.maxPrice), maxLive: n(f.maxLive), minPerDoor: n(f.minPerDoor) });
        }}
        className="space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-zinc-950 dark:text-white">Alert me about new listings in {place.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">New and cheaper matches show here; with an account and email, you also get a daily email.</p>
          </div>
          <Button variant="ghost" onClick={onCancel} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Property types">
          {LISTING_TYPES.map((t) => {
            const on = f.types.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setF((x) => ({ ...x, types: on && x.types.length > 1 ? x.types.filter((k) => k !== t.key) : on ? x.types : [...x.types, t.key] }))}
                className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset ${on ? 'bg-emerald-500/10 font-semibold text-emerald-800 ring-emerald-600/30 dark:text-emerald-300' : 'text-zinc-600 ring-(--line-strong) dark:text-zinc-400'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="al-price" label="Most you’d pay" prefix="$" value={f.maxPrice === '' ? undefined : f.maxPrice} onChange={(v) => setF((x) => ({ ...x, maxPrice: v || '' }))} step={10000} decimals={0} hint="Leave blank for any" />
          <NumberField id="al-live" label="Most to live in" prefix="$" suffix="/mo" value={f.maxLive === '' ? undefined : f.maxLive} onChange={(v) => setF((x) => ({ ...x, maxLive: v || '' }))} step={50} decimals={0} hint="Uses your Home numbers" />
          <NumberField id="al-door" label="Least cash flow" prefix="$" suffix="/door" value={f.minPerDoor === '' ? undefined : f.minPerDoor} onChange={(v) => setF((x) => ({ ...x, minPerDoor: v ?? '' }))} step={25} decimals={0} min={-5000} hint="For investors" />
        </div>
        <Button type="submit" variant="primary">
          <BellPlus className="size-4" aria-hidden /> Save alert
        </Button>
      </form>
    </Card>
  );
}

const COLUMNS = 8;
// Sorted here rather than in rankListings: it needs your Home numbers.
const LIVE_SORT = { key: 'live', label: 'Cheapest to live in' };

/** One listing as a table row; opening it adds a row under it with the details and what to do next. */
function ListingRow({ s, home, rank, sort, feed, below, imported, hidden, onAnalyze, onHide, onUnhide }) {
  const [open, setOpen] = useState(false);
  const l = s.listing;
  const link = listingPageUrl(l.url, l.address);
  const site = siteName(link);
  const confirmed = l.lastSeen ? `Confirmed for sale ${dayLabel(l.lastSeen)} on ${site}` : null;
  const drop = droppedInLatestRun(l, feed) ? s.drop : 0;
  const room = Number.isFinite(s.offer.price) ? s.offer.price - s.a.price : null;
  const detailsId = `listing-${l.id}-details`;
  const kind = KIND[l.units] ?? `${l.units} units`;
  const more = [l.yearBuilt && `Built ${l.yearBuilt}`, l.mls && `MLS® ${l.mls}`].filter(Boolean);
  const days = daysListed(l);
  const story = priceStory(l);
  const tags = [
    s.meets && 'Beats your targets',
    isNew(l, feed) && 'New',
    drop > 0 && `Down ${money(drop)}`,
    below > 0 && `${Math.round(below * 100)}% under the going rate`,
    hidden && 'Hidden',
  ].filter(Boolean);
  const cell = 'px-2 py-3 text-right align-top';

  return (
    <>
      {/* The row's click opens it; the address button gives keyboards and screen readers the same control. */}
      <tr onClick={() => setOpen((v) => !v)} className={`cursor-pointer border-t border-hairline transition hover:bg-well ${open ? 'bg-well' : ''} ${hidden ? 'opacity-60' : ''}`}>
        <td className="tabular hidden py-3 pr-1 pl-5 text-right align-top text-zinc-500 sm:table-cell dark:text-zinc-400">{rank}</td>
        <td className="py-3 pr-2 pl-4 align-top sm:pl-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailsId : undefined}
            className="rounded-[3px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            <span className="block font-medium text-zinc-950 dark:text-white">{l.address}</span>
            <span className="tabular mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {kind}
              <span className="md:hidden"> · {money(s.a.price)}</span>
              {home && <span className="md:hidden"> · live in: {money(home.costToLive)}/mo</span>}
            </span>
          </button>
          {tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((t, i) => (
                <Tag key={t} accent={s.meets && i === 0}>
                  {t}
                </Tag>
              ))}
            </span>
          )}
        </td>
        <td className={`${cell} hidden text-zinc-700 md:table-cell dark:text-zinc-300`}>{money(s.a.price)}</td>
        <td className={`${cell} hidden md:table-cell ${sort === 'live' ? 'font-semibold' : ''}`}>
          {home ? (
            <>
              <span className="block text-zinc-900 dark:text-zinc-100">{money(home.costToLive)}/mo</span>
              {home.known && home.canBuy && <span className="mt-0.5 block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">You qualify</span>}
            </>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">—</span>
          )}
        </td>
        <td className={`${cell} font-semibold ${signedClass(s.perDoor)}`}>{money(s.perDoor, { signed: true })}</td>
        <td className={`${cell} hidden lg:table-cell`}>{s.lens === 'own' ? <span className="text-zinc-700 dark:text-zinc-300">{money(s.a.pi)}/mo</span> : <DscrChip status={s.a.status} dscr={s.a.dscr} size="sm" />}</td>
        <td className={`${cell} ${sort === 'coc' ? 'font-semibold' : ''} ${signedClass(s.a.coc)}`}>{percent(s.a.coc, 1)}</td>
        <td className="py-3 pr-3 pl-1 align-top sm:pr-4">
          <ChevronDown className={`mt-0.5 size-4 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </td>
      </tr>
      {open && (
        <tr id={detailsId} className="bg-well">
          <td colSpan={COLUMNS} className="px-4 pt-1 pb-4 sm:px-5">
            <div className="sm:pl-6">
              <p className="max-w-3xl text-sm leading-snug text-zinc-800 dark:text-zinc-200">{listingSentence(s)}</p>
              {l.highlights && <p className="mt-1.5 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{l.highlights}</p>}
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{[...more, confirmed].filter(Boolean).join(' · ')}</p>
              <History days={days} story={story} below={below} />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                <Metric label="Cash flow / door" tip="netCashFlow" sub="a month, after every cost">
                  <span className={signedClass(s.perDoor)}>{money(s.perDoor, { signed: true })}</span>
                </Metric>
                <Metric label="Asking" sub={`${money(s.a.price / s.a.units)} per door`}>
                  {money(s.a.price)}
                </Metric>
                {s.lens === 'own' ? (
                  <Metric label="Mortgage payment" tip="mortgagePayment" sub={`on a ${money(s.a.loanAmount)} loan`}>
                    {money(s.a.pi)}/mo
                  </Metric>
                ) : (
                  <Metric label="Lender DSCR" tip="dscr">
                    <DscrChip status={s.a.status} dscr={s.a.dscr} size="sm" />
                  </Metric>
                )}
                <Metric label="Cash-on-cash" tip="coc" sub={`on ${money(s.a.cashInvested)}${s.lens === 'own' ? ' of your own' : ''}`}>
                  <span className={signedClass(s.a.coc)}>{percent(s.a.coc, 1)}</span>
                </Metric>
                <Metric label="Bought outright" tip="allCash" sub={`on ${money(s.cash.cashInvested)}, no loan`}>
                  <span className={signedClass(s.cash.coc)}>{percent(s.cash.coc, 1)}</span>
                </Metric>
                {home && (
                  <Metric label="If you live in it" sub={!home.known ? 'add your numbers on Home to see if you qualify' : home.canBuy ? `you could buy it, ${money(home.down)} down` : home.qualifies ? `${money(home.shortCash)} short of the cash` : 'not yet on your income'}>
                    {money(home.costToLive)}/mo
                  </Metric>
                )}
                <Metric label="Your max offer" tip="maxOffer" sub={room == null ? 'no targets set' : room >= 0 ? `${money(room)} of room` : `${money(-room)} over your max`}>
                  {room == null ? '—' : money(s.offer.price)}
                </Metric>
              </dl>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {RENT_TEXT[s.rentSource]}
                {s.taxesEstimated && ', taxes estimated'}
                <InfoTip k="listingRents" />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" className="px-3 py-1.5" onClick={() => onAnalyze(l)}>
                  {imported ? 'Open deal' : s.lens === 'own' ? 'Open in Cash' : 'Analyze'} <ArrowRight className="size-4" aria-hidden />
                </Button>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-well focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
                  >
                    View on {site} <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => (hidden ? onUnhide(l) : onHide(l))}>
                  {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                  {hidden ? 'Show this listing again' : 'Hide this listing'}
                  <span className="sr-only"> ({l.address})</span>
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Assumptions({ market, onMarket }) {
  const f = (key, props) => <NumberField id={`mkt-${key}`} value={market[key]} onChange={(v) => onMarket({ [key]: v })} {...props} />;
  const rent = (beds, label) => (
    <NumberField id={`mkt-rent-${beds}`} label={label} prefix="$" suffix="/mo" value={market.rents[beds]} onChange={(v) => onMarket({ rents: { ...market.rents, [beds]: v } })} step={25} decimals={0} />
  );
  const legend = 'mb-3 border-b border-hairline pb-1.5 text-sm font-semibold text-zinc-900 dark:text-white';
  return (
    <Card id="listing-assumptions">
      <CardHeader
        title="How listings are underwritten"
        subtitle="Applies to every listing here and to your morning alert. Targets come from the Max offer card on Analyze."
        actions={
          <Button onClick={() => onMarket({ ...localMarket(DEFAULT_MARKET, market.city), types: market.types, hidden: market.hidden })}>
            <RotateCcw className="size-3.5" aria-hidden /> Defaults
          </Button>
        }
      />
      <div className="grid gap-8 p-5 lg:grid-cols-3">
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className={`${legend} w-full`}>Financing</legend>
          <p className="col-span-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">DSCR loan</p>
          {f('dscrDownPct', { label: 'Down payment', suffix: '%', max: 100, step: 1, decimals: 1 })}
          {f('dscrRate', { label: 'Interest rate', suffix: '%', max: 30, step: 0.125, decimals: 3, hint: 'Usually above a regular mortgage' })}
          <p className="col-span-2 mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">Own money, 20% down</p>
          <div className="col-span-2">{f('rate', { label: 'Regular mortgage rate', suffix: '%', max: 30, step: 0.125, decimals: 3, hint: 'Compounded semi-annually' })}</div>
          <SelectField id="mkt-amort" label="Paid off over" value={market.amortYears} onChange={(e) => onMarket({ amortYears: Number(e.target.value) })}>
            {[20, 25, 30, 35, 40].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </SelectField>
          {f('closingPct', { label: 'Other closing costs', tip: 'landTransferTax', suffix: '%', max: 10, step: 0.25, hint: 'Plus land transfer tax' })}
        </fieldset>
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className={`${legend} w-full`}>Costs</legend>
          {f('insurancePerUnit', { label: 'Insurance', prefix: '$', suffix: '/unit/yr', step: 50, decimals: 0, hint: 'At least $1,500 a property' })}
          {f('utilitiesPerUnit', { label: 'Owner-paid utilities', tip: 'utilities', prefix: '$', suffix: '/unit/mo', step: 5, decimals: 0, hint: '2+ unit buildings only' })}
          {f('mgmtPct', { label: 'Management', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('maintPct', { label: 'Maintenance', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('vacancyPct', { label: 'Vacancy', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('capexPct', { label: 'CapEx', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          <div className="col-span-2">{f('taxPct', { label: 'Property tax if not listed', suffix: '% of price', max: 5, step: 0.05, hint: 'Most listings state their taxes' })}</div>
        </fieldset>
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className={`${legend} w-full`}>Market rents in {cityByKey(market.city).name}</legend>
          <p className="col-span-2 text-xs text-zinc-600 dark:text-zinc-400">
            Used only where a listing doesn’t state a unit’s current rent. Other cities move these by their average rent, so change them once.
          </p>
          {rent(0, 'Bachelor')}
          {rent(1, '1 bedroom')}
          {rent(2, '2 bedrooms')}
          {rent(3, '3 bedrooms')}
          {rent(4, '4+ bedrooms')}
        </fieldset>
      </div>
    </Card>
  );
}

function Notice({ icon: Icon = Radar, title, children }) {
  return (
    <Card className="p-8 text-center sm:p-12">
      <Icon className="mx-auto size-7 text-zinc-500 dark:text-zinc-400" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3>
      <div className="mx-auto mt-2 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </Card>
  );
}

/** Which city's listings: every covered city by province, with how many listings each has. */
function CityPicker({ city, index, onCity }) {
  const cities = index?.cities ?? {};
  return (
    <div className="max-w-sm">
      <SelectField id="listing-city" label="Listings in" value={city} onChange={(e) => onCity(e.target.value)}>
        {PROVINCES.map((p) => {
          const keys = LISTING_CITIES.filter((k) => cityByKey(k).province === p.code);
          if (!keys.length) return null;
          return (
            <optgroup key={p.code} label={p.name}>
              {keys.map((k) => {
                const n = cities[k]?.count;
                return (
                  <option key={k} value={k}>
                    {cityByKey(k).name}
                    {!index ? '' : cities[k] ? ` (${n} listing${n === 1 ? '' : 's'})` : ', coming soon'}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </SelectField>
    </div>
  );
}

/** The Listings tab: properties for sale in one Canadian city, refreshed by the morning run and ranked by your numbers. */
export default function ListingsView({ feedState, indexState, city, onCity, market, baseMarket, alerts = [], onAlerts, targets, profile, importedIds, onMarket, onAnalyze, onHide, onUnhide }) {
  const { status, feed } = feedState;
  const [sort, setSort] = useState('perDoor');
  const [layout, setLayout] = useState('list');
  const [alerting, setAlerting] = useState(false);
  const [onlyMeets, setOnlyMeets] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // For sale, with a page of its own to check it against (rankListings applies the same rule).
  const active = useMemo(() => (feed?.listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address)), [feed]);
  // Until someone gives their own numbers on Home, the cost to live in still holds (it doesn't depend on them), but whether they'd qualify is unknown.
  const homes = useMemo(
    () =>
      new Map(
        active.map((l) => {
          const h = profile ? homeFor(listingToDeal(l, market, 'own'), profile, market.rate) : null;
          return [l.id, h && { ...h, known: profile.entered !== false }];
        }),
      ),
    [active, market, profile],
  );
  const ranked = useMemo(() => {
    const list = rankListings(active, market, targets, { sort: sort === LIVE_SORT.key ? 'perDoor' : sort, showHidden });
    if (sort !== LIVE_SORT.key) return list;
    const cost = (s) => homes.get(s.listing.id)?.costToLive ?? Infinity;
    return [...list].sort((x, y) => cost(x) - cost(y));
  }, [active, market, targets, sort, showHidden, homes]);
  const hiddenSet = useMemo(() => new Set(market.hidden), [market.hidden]);
  const belowMap = useMemo(() => underMarket(active), [active]);
  const visible = ranked.filter((s) => !hiddenSet.has(s.listing.id));
  const shown = onlyMeets ? ranked.filter((s) => s.meets) : ranked;
  const hiddenCount = active.filter((l) => hiddenSet.has(l.id)).length;
  const countOf = (key) => active.filter((l) => typeOf(l.units) === key && !hiddenSet.has(l.id)).length;
  const best = visible.reduce((m, s) => (!m || s.perDoor > m.perDoor ? s : m), null);
  const run = feed?.lastRun;
  const place = cityByKey(city);
  // Thunder Bay is searched every morning; the other cities take turns, about once a week.
  const stale = run && Date.now() - run.at > (city === 'thunder-bay' ? STALE_AFTER : ROTATION_STALE_AFTER);
  const freshCount = visible.filter((s) => isNew(s.listing, feed)).length;
  const dropCount = visible.filter((s) => droppedInLatestRun(s.listing, feed)).length;
  const counted = lensTargets(targets, market.lens);
  const targetText = [counted.useDscr && `DSCR ${Number(counted.dscr).toFixed(2)}`, counted.useCashFlow && `$${counted.cashFlowPerDoor}/door`, counted.useCoc && `${counted.coc}% cash-on-cash`]
    .filter(Boolean)
    .join(' · ');
  const th = 'px-2 py-2.5 text-right font-medium whitespace-nowrap';

  const toggleType = (key) => {
    const on = market.types.includes(key);
    if (on && market.types.length === 1) return; // keep at least one type
    onMarket({ types: on ? market.types.filter((t) => t !== key) : [...market.types, key] });
  };

  return (
    <>
      <ViewHeader title="Listings">
        {place.name}, {place.province}: properties for sale, found by the morning run and run through your numbers under {provinceName(place.province)} rules.
        {run && ` Updated ${when(run.at)}.`}
      </ViewHeader>

      <CityPicker city={city} index={indexState?.feed} onCity={onCity} />

      {status === 'ready' && onAlerts && (
        <AlertBanners alerts={alerts.filter((a) => a.city === city)} feed={feed} market={baseMarket ?? market} profile={profile} onSeen={(id) => onAlerts(alerts.map((a) => (a.id === id ? { ...a, seen: todayIso() } : a)))} place={place} />
      )}
      {alerting && onAlerts && (
        <AlertForm
          city={city}
          place={place}
          types={market.types}
          onCancel={() => setAlerting(false)}
          onSave={(a) => (onAlerts([...alerts, { ...a, since: todayIso(), seen: todayIso() }].slice(-10)), setAlerting(false))}
        />
      )}

      {status === 'checking' && <SkeletonCard className="h-[28rem]" />}
      {status === 'local' && (
        <Notice title="Listings arrive on your hosted Bedrock page">
          The morning run saves listings to your Claude account, so they show up on your Bedrock page at claude.ai. This copy of the page can’t
          read them.
        </Notice>
      )}
      {status === 'empty' && (
        <Notice title={`${place.name} hasn’t been searched yet`}>
          The morning run searches Thunder Bay every day and a few more cities each morning in turn, so every city gets fresh listings about once a week. {place.name}{' '}
          should have its first listings within a week. Pick another city above to see what’s already in.
        </Notice>
      )}
      {status === 'error' && (
        <Notice icon={AlertTriangle} title="Couldn’t load the listings">
          Reload the page to try again. Your deals aren’t affected.
        </Notice>
      )}

      {status === 'ready' && (
        <>
          {stale && (
            <p className="rise flex items-start gap-2 rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-600/20 ring-inset dark:text-amber-100 dark:ring-amber-300/20">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              The last update was {when(run.at)}. A morning run may have failed; the next one will try again.
            </p>
          )}

          <Card className="divide-y divide-hairline">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 max-w-xl">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Count the income with</p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {market.lens === 'own'
                    ? `Your own money as a 20% down payment, with a regular mortgage at ${Number(market.rate)}%. No lender’s DSCR test: just the income and the return on your cash.`
                    : `A DSCR loan, where the lender qualifies the property on its rent: ${Number(market.dscrDownPct)}% down at ${Number(market.dscrRate)}%, and it has to pass the lender’s DSCR test.`}
                </p>
              </div>
              <Segmented
                label="Count the income with"
                value={market.lens}
                onChange={(lens) => onMarket({ lens })}
                options={[
                  { value: 'dscr', label: 'DSCR loan' },
                  { value: 'own', label: 'Own money, 20% down' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5 sm:px-5">
              <div role="group" aria-label="Property types" className="inline-flex overflow-hidden rounded-md border border-(--line-strong)">
                {LISTING_TYPES.map((t, i) => {
                  const on = market.types.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(t.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
                        i ? 'border-l border-(--line-strong)' : ''
                      } ${on ? 'bg-zinc-950/[0.05] font-semibold text-zinc-950 dark:bg-white/[0.07] dark:text-white' : 'font-medium text-zinc-500 hover:bg-well hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                    >
                      {SHORT_TYPE[t.key] ? (
                        <>
                          <span className="sm:hidden">{SHORT_TYPE[t.key]}</span>
                          <span className="max-sm:hidden">{t.label}</span>
                        </>
                      ) : (
                        t.label
                      )}
                      <span className={`tabular ${on ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{countOf(t.key)}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" aria-pressed={onlyMeets} onClick={() => setOnlyMeets((v) => !v)} className={toggle(onlyMeets)}>
                {onlyMeets && <Check className="size-3.5" aria-hidden />}
                Beats my targets only
              </button>
              {hiddenCount > 0 && (
                <button type="button" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)} className={toggle(showHidden)}>
                  {showHidden && <Check className="size-3.5" aria-hidden />}
                  Show hidden ({hiddenCount})
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                <Segmented
                  label="Show as"
                  value={layout}
                  onChange={setLayout}
                  options={[
                    { value: 'list', label: 'List' },
                    { value: 'map', label: 'Map' },
                  ]}
                />
                <label htmlFor="listing-sort" className="text-xs font-medium text-zinc-600 max-sm:sr-only dark:text-zinc-400">
                  Sort
                </label>
                <select id="listing-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="field px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100">
                  {Object.entries(SORTS).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label}
                    </option>
                  ))}
                  {profile && <option value={LIVE_SORT.key}>{LIVE_SORT.label}</option>}
                </select>
                {onAlerts && (
                  <Button className="py-1.5" onClick={() => setAlerting((v) => !v)} aria-expanded={alerting}>
                    <BellPlus className="size-4" aria-hidden /> Alert me
                  </Button>
                )}
                <Button className="py-1.5" onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-controls="listing-assumptions">
                  <SlidersHorizontal className="size-4" aria-hidden /> Assumptions
                </Button>
              </div>
            </div>
          </Card>

          {editing && <Assumptions market={market} onMarket={onMarket} />}

          <Card className="@container">
            <dl className="grid grid-cols-2 @3xl:grid-cols-4">
              {[
                { label: 'Beat your targets', value: `${visible.filter((s) => s.meets).length} of ${visible.length}`, sub: targetText || 'No targets set' },
                { label: 'Best cash flow', value: best ? `${money(best.perDoor, { signed: true })}/door` : '—', sub: best?.listing.address, cls: best ? signedClass(best.perDoor) : '' },
                { label: 'In the latest update', value: `${freshCount} new`, sub: `${dropCount} price ${dropCount === 1 ? 'drop' : 'drops'}` },
                { label: 'Typical asking price', value: money(median(visible.map((s) => s.a.price))), sub: `${money(median(visible.map((s) => s.a.price / s.a.units)))} per door` },
              ].map((t, i) => (
                <div key={t.label} className={`min-w-0 px-4 py-3.5 sm:px-5 ${i % 2 ? 'border-l border-hairline' : ''} ${i >= 2 ? 'border-t border-hairline @3xl:border-t-0 @3xl:border-l' : ''}`}>
                  <dt className="caption">{t.label}</dt>
                  <dd className={`tabular mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white ${t.cls ?? ''}`}>{t.value}</dd>
                  {t.sub && <dd className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{t.sub}</dd>}
                </div>
              ))}
            </dl>
          </Card>

          {layout === 'map' && shown.length > 0 ? (
            <Card className="p-3 sm:p-4">
              <Suspense fallback={<div className="skeleton h-[28rem] rounded-md" />}>
                <ListingsMap items={shown} place={place} homes={homes} />
              </Suspense>
            </Card>
          ) : shown.length > 0 ? (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <caption className="sr-only">Listings, best first. Open a row for its details.</caption>
                <thead>
                  <tr className="caption border-b-[3px] border-double border-rule">
                    <th scope="col" className="hidden py-2.5 pr-1 pl-5 text-right font-medium sm:table-cell">
                      <span aria-hidden>#</span>
                      <span className="sr-only">Rank</span>
                    </th>
                    <th scope="col" className="py-2.5 pr-2 pl-4 text-left font-medium sm:pl-3">
                      Address
                    </th>
                    <th scope="col" className={`${th} hidden md:table-cell`}>
                      Price
                    </th>
                    <th scope="col" className={`${th} hidden md:table-cell`}>
                      To live in{sort === LIVE_SORT.key && <span aria-hidden> ↓</span>}
                    </th>
                    <th scope="col" className={th}>
                      Per door{sort === 'perDoor' && <span aria-hidden> ↓</span>}
                    </th>
                    <th scope="col" className={`${th} hidden lg:table-cell`}>
                      {market.lens === 'own' ? 'Mortgage' : 'Lender DSCR'}
                    </th>
                    <th scope="col" className={th}>
                      Return{sort === 'coc' && <span aria-hidden> ↓</span>}
                    </th>
                    <th scope="col" className="w-8 pr-3 sm:pr-4">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {(showAll ? shown : shown.slice(0, FIRST_PAGE)).map((s, i) => (
                    <ListingRow
                      key={s.listing.id}
                      s={s}
                      home={homes.get(s.listing.id)}
                      rank={i + 1}
                      sort={sort}
                      feed={feed}
                      below={belowMap.get(s.listing.id)}
                      imported={importedIds.has(s.listing.id)}
                      hidden={hiddenSet.has(s.listing.id)}
                      onAnalyze={onAnalyze}
                      onHide={onHide}
                      onUnhide={onUnhide}
                    />
                  ))}
                </tbody>
              </table>
              {!showAll && shown.length > FIRST_PAGE && (
                <div className="border-t border-hairline px-4 py-2 sm:px-5">
                  <Button variant="ghost" className="-ml-2.5" onClick={() => setShowAll(true)}>
                    Show all {shown.length} listings <ChevronDown className="size-4" aria-hidden />
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Notice title={active.length ? 'Nothing matches these filters' : 'No listings saved yet'}>
              {active.length ? 'Turn on more property types, or show every listing instead of only the ones that beat your targets.' : 'The next morning run will fill this in.'}
            </Notice>
          )}

          <p className="px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Found by searching public listing sites, so some listings will be missing. Each one links to its own listing page and was confirmed for sale by a
            search in the last week; listings that can’t be confirmed drop off. Search results can lag a few days, and this isn’t from REALTOR.ca or the MLS®
            system directly. Rents marked estimated come from your rent table. Confirm everything with the listing agent before you make an offer.
          </p>
        </>
      )}
    </>
  );
}
