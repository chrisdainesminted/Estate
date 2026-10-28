import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ExternalLink, Eye, EyeOff, Radar, RotateCcw, SlidersHorizontal, Target, TrendingDown } from 'lucide-react';
import { DEFAULT_MARKET, LISTING_TYPES, MARKET, SORTS, droppedInLatestRun, isNew, listingPageUrl, rankListings, siteName, typeOf } from '../lib/market.js';
import { listingSentence } from '../lib/explain.js';
import { money, percent } from '../lib/format.js';
import { Button, Card, CardHeader, DscrChip, NumberField, SelectField, SkeletonCard, signedClass } from '../components/ui.jsx';
import { InfoTip } from '../components/motion.jsx';

const KIND = { 1: 'House', 2: 'Duplex', 3: 'Triplex', 4: 'Fourplex' };
const RENT_TEXT = { stated: 'Rents as listed', mixed: 'Some rents estimated', estimated: 'Rents estimated' };
const STALE_AFTER = 36 * 3600 * 1000;
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

const chip = (on) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-emerald-500 ${
    on
      ? 'bg-emerald-700 text-white ring-emerald-800/40 dark:bg-emerald-400 dark:text-emerald-950'
      : 'bg-white/60 text-zinc-700 ring-zinc-950/10 hover:bg-white dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10'
  }`;

function Badge({ tone, icon: Icon, children }) {
  const tones = {
    green: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20 dark:text-emerald-200 dark:ring-emerald-300/20',
    blue: 'bg-sky-500/10 text-sky-800 ring-sky-600/20 dark:text-sky-200 dark:ring-sky-300/20',
    gray: 'bg-zinc-950/[0.04] text-zinc-700 ring-zinc-950/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-white/10',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

function Metric({ label, tip, children, sub }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow flex items-center gap-1">
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

function ListingRow({ s, rank, feed, imported, hidden, onAnalyze, onHide, onUnhide }) {
  const [open, setOpen] = useState(false);
  const l = s.listing;
  const link = listingPageUrl(l.url, l.address);
  const site = siteName(link);
  const confirmed = l.lastSeen ? `Confirmed for sale ${dayLabel(l.lastSeen)} on ${site}` : null;
  const drop = droppedInLatestRun(l, feed) ? s.drop : 0;
  const room = Number.isFinite(s.offer.price) ? s.offer.price - s.a.price : null;
  const headingId = `listing-${l.id}`;
  const detailsId = `listing-${l.id}-details`;
  const facts = [KIND[l.units] ?? `${l.units} units`, l.units > 1 && l.units <= 4 && `${l.units} units`, money(s.a.price)].filter(Boolean);
  const more = [l.yearBuilt && `Built ${l.yearBuilt}`, l.mls && `MLS® ${l.mls}`].filter(Boolean);
  const badges = s.meets || isNew(l, feed) || drop > 0 || hidden;

  return (
    <li>
      <article aria-labelledby={headingId} className={`glass rise rounded-3xl p-4 sm:p-5 ${hidden ? 'outline-1 outline-zinc-400/60 outline-dashed' : ''}`}>
        <div className="flex gap-3 sm:gap-4">
          <span
            aria-hidden
            className="tabular hidden size-8 shrink-0 place-items-center rounded-full bg-zinc-950/[0.05] text-sm font-semibold text-zinc-600 sm:grid dark:bg-white/[0.07] dark:text-zinc-300"
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id={headingId} className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
                  {l.address}
                </h3>
                <p className="tabular mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{facts.join(' · ')}</p>
              </div>
              <p className="shrink-0 text-right">
                <span className={`tabular block text-lg leading-tight font-semibold ${signedClass(s.perDoor)}`}>{money(s.perDoor, { signed: true })}</span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">per door a month</span>
              </p>
            </div>
            {badges && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.meets && (
                  <Badge tone="green" icon={Check}>
                    Beats your targets
                  </Badge>
                )}
                {isNew(l, feed) && <Badge tone="blue">New</Badge>}
                {drop > 0 && (
                  <Badge tone="blue" icon={TrendingDown}>
                    Down {money(drop)}
                  </Badge>
                )}
                {hidden && <Badge tone="gray">Hidden</Badge>}
              </div>
            )}
            <p className="mt-2 text-sm leading-snug text-zinc-700 dark:text-zinc-300">{listingSentence(s)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button variant="primary" className="px-2.5 py-1.5" onClick={() => onAnalyze(l)}>
                {imported ? 'Open deal' : 'Analyze'} <ArrowRight className="size-4" aria-hidden />
              </Button>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
                >
                  View on {site} <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? detailsId : undefined}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Details
                <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                <span className="sr-only">for {l.address}</span>
              </button>
            </div>

            {open && (
              <div id={detailsId} className="mt-3 border-t border-hairline pt-3">
                {l.highlights && <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.highlights}</p>}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {[...more, confirmed].filter(Boolean).join(' · ')}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                  <Metric label="Cash flow / door" tip="netCashFlow" sub="a month, after every cost">
                    <span className={signedClass(s.perDoor)}>{money(s.perDoor, { signed: true })}</span>
                  </Metric>
                  <Metric label="Asking" sub={`${money(s.a.price / s.a.units)} per door`}>
                    {money(s.a.price)}
                  </Metric>
                  <Metric label="Lender DSCR" tip="dscr">
                    <DscrChip status={s.a.status} dscr={s.a.dscr} size="sm" />
                  </Metric>
                  <Metric label="Cash-on-cash" tip="coc" sub={`on ${money(s.a.cashInvested)}`}>
                    <span className={signedClass(s.a.coc)}>{percent(s.a.coc, 1)}</span>
                  </Metric>
                  <Metric label="Bought outright" tip="allCash" sub={`on ${money(s.cash.cashInvested)}, no loan`}>
                    <span className={signedClass(s.cash.coc)}>{percent(s.cash.coc, 1)}</span>
                  </Metric>
                  <Metric label="Your max offer" tip="maxOffer" sub={room == null ? 'no targets set' : room >= 0 ? `${money(room)} of room` : `${money(-room)} over your max`}>
                    {room == null ? '—' : money(s.offer.price)}
                  </Metric>
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {RENT_TEXT[s.rentSource]}
                    {s.taxesEstimated && ', taxes estimated'}
                    <InfoTip k="listingRents" />
                  </p>
                  <button
                    type="button"
                    onClick={() => (hidden ? onUnhide(l) : onHide(l))}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                    {hidden ? 'Show this listing again' : 'Hide this listing'}
                    <span className="sr-only"> ({l.address})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

function Assumptions({ market, onMarket }) {
  const f = (key, props) => <NumberField id={`mkt-${key}`} value={market[key]} onChange={(v) => onMarket({ [key]: v })} {...props} />;
  const rent = (beds, label) => (
    <NumberField id={`mkt-rent-${beds}`} label={label} prefix="$" suffix="/mo" value={market.rents[beds]} onChange={(v) => onMarket({ rents: { ...market.rents, [beds]: v } })} step={25} decimals={0} />
  );
  return (
    <Card id="listing-assumptions" className="rise">
      <CardHeader
        icon={SlidersHorizontal}
        title="How listings are underwritten"
        subtitle="Applies to every listing here and to your morning alert. Targets come from the Max offer card on Analyze."
        actions={
          <Button onClick={() => onMarket({ ...DEFAULT_MARKET, types: market.types, hidden: market.hidden })}>
            <RotateCcw className="size-3.5" aria-hidden /> Defaults
          </Button>
        }
      />
      <div className="grid gap-8 p-6 lg:grid-cols-3">
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className="eyebrow mb-3">Financing</legend>
          {f('downPct', { label: 'Down payment', suffix: '%', max: 100, step: 1, decimals: 1 })}
          {f('rate', { label: 'Interest rate', suffix: '%', max: 30, step: 0.125, decimals: 3, hint: 'Compounded semi-annually' })}
          <SelectField id="mkt-amort" label="Amortization" value={market.amortYears} onChange={(e) => onMarket({ amortYears: Number(e.target.value) })}>
            {[20, 25, 30, 35, 40].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </SelectField>
          {f('closingPct', { label: 'Other closing costs', tip: 'landTransferTax', suffix: '%', max: 10, step: 0.25, hint: 'Plus land transfer tax' })}
        </fieldset>
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className="eyebrow mb-3">Costs</legend>
          {f('insurancePerUnit', { label: 'Insurance', prefix: '$', suffix: '/unit/yr', step: 50, decimals: 0, hint: 'At least $1,500 a property' })}
          {f('utilitiesPerUnit', { label: 'Owner-paid utilities', tip: 'utilities', prefix: '$', suffix: '/unit/mo', step: 5, decimals: 0, hint: '2+ unit buildings only' })}
          {f('mgmtPct', { label: 'Management', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('maintPct', { label: 'Maintenance', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('vacancyPct', { label: 'Vacancy', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          {f('capexPct', { label: 'CapEx', suffix: '% of rent', max: 50, step: 0.5, decimals: 1 })}
          <div className="col-span-2">{f('taxPct', { label: 'Property tax if not listed', suffix: '% of price', max: 5, step: 0.05, hint: 'Most listings state their taxes' })}</div>
        </fieldset>
        <fieldset className="grid grid-cols-2 content-start gap-3">
          <legend className="eyebrow mb-3">Market rents</legend>
          <p className="col-span-2 -mt-1 text-xs text-zinc-600 dark:text-zinc-400">Used only where a listing doesn’t state a unit’s current rent.</p>
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
      <Icon className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3>
      <div className="mx-auto mt-2 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </Card>
  );
}

/** The Listings tab: Thunder Bay properties for sale, refreshed each morning and ranked by your numbers. */
export default function ListingsView({ feedState, market, targets, importedIds, onMarket, onAnalyze, onHide, onUnhide }) {
  const { status, feed } = feedState;
  const [sort, setSort] = useState('perDoor');
  const [onlyMeets, setOnlyMeets] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // For sale, with a page of its own to check it against (rankListings applies the same rule).
  const active = useMemo(() => (feed?.listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address)), [feed]);
  const ranked = useMemo(() => rankListings(active, market, targets, { sort, showHidden }), [active, market, targets, sort, showHidden]);
  const hiddenSet = useMemo(() => new Set(market.hidden), [market.hidden]);
  const visible = ranked.filter((s) => !hiddenSet.has(s.listing.id));
  const shown = onlyMeets ? ranked.filter((s) => s.meets) : ranked;
  const hiddenCount = active.filter((l) => hiddenSet.has(l.id)).length;
  const countOf = (key) => active.filter((l) => typeOf(l.units) === key && !hiddenSet.has(l.id)).length;
  const best = visible.reduce((m, s) => (!m || s.perDoor > m.perDoor ? s : m), null);
  const run = feed?.lastRun;
  const stale = run && Date.now() - run.at > STALE_AFTER;
  const freshCount = visible.filter((s) => isNew(s.listing, feed)).length;
  const dropCount = visible.filter((s) => droppedInLatestRun(s.listing, feed)).length;
  const targetText = [targets.useDscr && `DSCR ${Number(targets.dscr).toFixed(2)}`, targets.useCashFlow && `$${targets.cashFlowPerDoor}/door`, targets.useCoc && `${targets.coc}% cash-on-cash`]
    .filter(Boolean)
    .join(' · ');

  const toggleType = (key) => {
    const on = market.types.includes(key);
    if (on && market.types.length === 1) return; // keep at least one type
    onMarket({ types: on ? market.types.filter((t) => t !== key) : [...market.types, key] });
  };

  return (
    <>
      <div className="rise px-1 pt-2">
        <p className="eyebrow">
          Listings · {MARKET.city}, {MARKET.region}
        </p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">Today’s best rentals</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Thunder Bay properties for sale, found each morning and run through your numbers under Ontario rules. Most cash per door first.
        </p>
        {run && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Updated {when(run.at)} · {active.length} listings, each linked to its own listing page and confirmed for sale in the last week · {freshCount} new ·{' '}
            {dropCount} price {dropCount === 1 ? 'drop' : 'drops'}
          </p>
        )}
      </div>

      {status === 'checking' && <SkeletonCard className="h-[28rem]" />}
      {status === 'local' && (
        <Notice title="Listings arrive on your hosted Bedrock page">
          The morning run saves Thunder Bay listings to your Claude account, so they show up on your Bedrock page at claude.ai. This copy of the page can’t
          read them.
        </Notice>
      )}
      {status === 'empty' && (
        <Notice title="The first update hasn’t arrived yet">Listings land here every morning at about 6 am Eastern. Check back after the next run.</Notice>
      )}
      {status === 'error' && (
        <Notice icon={AlertTriangle} title="Couldn’t load the listings">
          Reload the page to try again. Your deals aren’t affected.
        </Notice>
      )}

      {status === 'ready' && (
        <>
          {stale && (
            <p className="rise flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-600/20 ring-inset dark:text-amber-100 dark:ring-amber-300/20">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              The last update was {when(run.at)}. A morning run may have failed; the next one will try again.
            </p>
          )}

          <Card delay={40} className="@container">
            <dl className="grid grid-cols-2 @3xl:grid-cols-4">
              {[
                { label: 'Beat your targets', value: `${visible.filter((s) => s.meets).length} of ${visible.length}`, sub: targetText || 'No targets set' },
                { label: 'Best cash flow', value: best ? `${money(best.perDoor, { signed: true })}/door` : '—', sub: best?.listing.address, cls: best ? signedClass(best.perDoor) : '' },
                { label: 'In the latest update', value: `${freshCount} new`, sub: `${dropCount} price ${dropCount === 1 ? 'drop' : 'drops'}` },
                { label: 'Typical asking price', value: money(median(visible.map((s) => s.a.price))), sub: `${money(median(visible.map((s) => s.a.price / s.a.units)))} per door` },
              ].map((t, i) => (
                <div key={t.label} className={`min-w-0 p-4 sm:p-5 ${i % 2 ? 'border-l border-hairline' : ''} ${i >= 2 ? 'border-t border-hairline @3xl:border-t-0 @3xl:border-l' : ''}`}>
                  <dt className="eyebrow">{t.label}</dt>
                  <dd className={`tabular mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white ${t.cls ?? ''}`}>{t.value}</dd>
                  {t.sub && <dd className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{t.sub}</dd>}
                </div>
              ))}
            </dl>
          </Card>

          <Card delay={80} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div role="group" aria-label="Property types" className="flex flex-wrap gap-1.5">
                {LISTING_TYPES.map((t) => {
                  const on = market.types.includes(t.key);
                  return (
                    <button key={t.key} type="button" aria-pressed={on} onClick={() => toggleType(t.key)} className={chip(on)}>
                      {on && <Check className="size-3.5" aria-hidden />}
                      {t.label}
                      <span className="tabular font-semibold">{countOf(t.key)}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" aria-pressed={onlyMeets} onClick={() => setOnlyMeets((v) => !v)} className={chip(onlyMeets)}>
                <Target className="size-3.5" aria-hidden />
                Beats my targets only
              </button>
              {hiddenCount > 0 && (
                <button type="button" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)} className={chip(showHidden)}>
                  <Eye className="size-3.5" aria-hidden />
                  Show hidden ({hiddenCount})
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                <label htmlFor="listing-sort" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Sort
                </label>
                <select id="listing-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="field px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  {Object.entries(SORTS).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Button onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-controls="listing-assumptions">
                  <SlidersHorizontal className="size-4" aria-hidden /> Assumptions
                </Button>
              </div>
            </div>
          </Card>

          {editing && <Assumptions market={market} onMarket={onMarket} />}

          {shown.length > 0 ? (
            <ol className="space-y-3" aria-label="Listings, best first">
              {(showAll ? shown : shown.slice(0, FIRST_PAGE)).map((s, i) => (
                <ListingRow
                  key={s.listing.id}
                  s={s}
                  rank={i + 1}
                  feed={feed}
                  imported={importedIds.has(s.listing.id)}
                  hidden={hiddenSet.has(s.listing.id)}
                  onAnalyze={onAnalyze}
                  onHide={onHide}
                  onUnhide={onUnhide}
                />
              ))}
            </ol>
          ) : (
            <Notice title={active.length ? 'Nothing matches these filters' : 'No listings saved yet'}>
              {active.length ? 'Turn on more property types, or show every listing instead of only the ones that beat your targets.' : 'The next morning run will fill this in.'}
            </Notice>
          )}

          {!showAll && shown.length > FIRST_PAGE && (
            <div className="flex justify-center">
              <Button onClick={() => setShowAll(true)}>
                Show all {shown.length} listings <ChevronDown className="size-4" aria-hidden />
              </Button>
            </div>
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
