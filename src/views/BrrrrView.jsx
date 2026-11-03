import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ExternalLink, Wrench } from 'lucide-react';
import { GRADES, rankBrrrr } from '../lib/brrrr.js';
import { cityByKey } from '../lib/canada.js';
import { money, percent } from '../lib/format.js';
import { siteName, taxSource } from '../lib/market.js';
import { Button, Card, CardHeader, NumberField, SkeletonCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { CityPicker } from './ListingsView.jsx';
import { useListingPoints } from '../hooks/useListingPoints.js';

const TONE = {
  good: 'bg-emerald-600/10 text-emerald-800 ring-emerald-600/25 dark:text-emerald-300 dark:ring-emerald-400/30',
  warn: 'bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/30',
  muted: 'bg-well text-zinc-600 ring-(--line-strong) dark:text-zinc-400',
};
const KIND = { 1: 'House', 2: 'Duplex', 3: 'Triplex', 4: 'Fourplex' };
const STEPS = [
  ['Buy', 'a home priced well under the homes like it'],
  ['Rehab', 'it so it’s worth what they are'],
  ['Rent', 'it out'],
  ['Refinance', 'at the new value to take your cash back out'],
  ['Repeat', 'with the same cash'],
];

/**
 * BRRRR: today's listings ranked for buy, rehab, rent, refinance, repeat.
 * Each is set against similar homes for sale nearby (its likely value once
 * fixed up), then run through the plan with your renovation budget.
 */
export default function BrrrrView({ feedState, indexState, city, onCity, market, plan, onPlan, onOpen, onTax, nextStep }) {
  const { status, feed } = feedState;
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const place = cityByKey(city);
  // Where each listing is, so it's compared with similar homes on nearby streets first.
  const points = useListingPoints(feed?.listings, `${place.name.replace(/^Elsewhere in /, '')}, ${place.province}`);
  const { ranked, unranked } = useMemo(() => rankBrrrr(feed?.listings ?? [], market, plan, city, { hidden: market.hidden, points }), [feed, market, plan, city, points]);
  const nearby = ranked.filter((r) => r.arv.radiusKm != null).length;
  const shown = showAll ? ranked : ranked.slice(0, 15);
  const setRehab = (id, v) => onPlan({ rehabs: { ...plan.rehabs, [id]: v } });
  const clearRehab = (id) => {
    const { [id]: _drop, ...rest } = plan.rehabs;
    onPlan({ rehabs: rest });
  };

  return (
    <div className="space-y-6">
      <ViewHeader title="BRRRR" aside={<CityPicker city={city} index={indexState?.feed} onCity={onCity} />}>
        Homes in {place.name} ranked for buy, rehab, rent, refinance, repeat: the ones priced furthest under the homes like them, once the work is paid for.
      </ViewHeader>
      {nextStep}

      <Card>
        <ol className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm sm:grid-cols-5">
          {STEPS.map(([t, b], i) => (
            <li key={t}>
              <span className="text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">{i + 1}</span>{' '}
              <strong className="font-semibold text-zinc-950 dark:text-white">{t}</strong> <span className="text-zinc-600 dark:text-zinc-400">{b}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Your plan" subtitle="Applies to every home below. Set your own rehab number on any one of them." />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-6">
          <NumberField id="brrrr-rehab" label="Rehab, a house" prefix="$" value={plan.rehab} onChange={(v) => onPlan({ rehab: v })} step={5000} decimals={0} />
          <NumberField id="brrrr-unit" label="Plus each extra unit" prefix="$" value={plan.rehabPerUnit} onChange={(v) => onPlan({ rehabPerUnit: v })} step={5000} decimals={0} />
          <NumberField id="brrrr-months" label="Months to refinance" value={plan.months} onChange={(v) => onPlan({ months: v })} step={1} decimals={0} hint="No rent while you fix it" />
          <NumberField id="brrrr-down" label="Down payment" suffix="%" value={plan.downPct} onChange={(v) => onPlan({ downPct: v })} step={5} decimals={0} hint="20% least on a rental" />
          <NumberField id="brrrr-refi" label="Refinance to" suffix="% of value" value={plan.refiPct} onChange={(v) => onPlan({ refiPct: v })} max={80} step={5} decimals={0} hint="80% most in Canada" />
          <NumberField id="brrrr-refi-cost" label="Refinance costs" suffix="% of loan" value={plan.refiCostPct} onChange={(v) => onPlan({ refiCostPct: v })} step={0.25} decimals={2} hint="Appraisal, legal, fees" />
        </div>
      </Card>

      {status === 'loading' && <SkeletonCard className="h-96" />}
      {status !== 'loading' && ranked.length === 0 && (
        <Card className="p-6 text-sm text-zinc-600 dark:text-zinc-400">Not enough similar homes for sale in {place.name} today to compare. Try a bigger city nearby, or check back tomorrow.</Card>
      )}

      {ranked.length > 0 && (
        <Card>
          <CardHeader
            title={`${ranked.length} homes ranked`}
            subtitle={`At ${market.rate}% for the purchase and the refinance, ${market.amortYears}-year amortization. ${nearby ? `${nearby} compared with homes within a few km; ` : ''}${nearby < ranked.length ? `${nearby ? 'the rest' : 'all'} with similar homes across ${place.name}${points.size < (feed?.listings?.length ?? 0) && nearby ? ' while the map finds the rest' : ''}.` : ''}`}
          />
          <ol className="divide-y divide-hairline border-t border-hairline">
            {shown.map((r) => {
              const g = GRADES[r.grade];
              const isOpen = open === r.listing.id;
              return (
                <li key={r.listing.id} className="px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center">
                    <span className="text-2xl font-semibold text-zinc-400 tabular-nums">#{r.rank}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[g.tone]}`}>{g.label}</span>
                        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">Score {r.score}/100</span>
                        {r.fixer && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                            <Wrench className="size-3" aria-hidden /> Listed as needing work
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[15px] font-semibold text-zinc-950 dark:text-white">{r.listing.address}</p>
                      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                        {money(r.price)}, {percent(r.discount, 0)} under the {money(r.arv.value)} middle of {r.arv.count} similar {r.arv.condo ? 'condos' : (KIND[r.units] ?? `${r.units}-unit`).toLowerCase() + 's'} for sale{' '}
                        {r.arv.radiusKm != null ? `within ${r.arv.radiusKm} km` : `in ${place.name}`}
                        {r.arv.byBeds ? '' : ' (any size)'}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-x-5 gap-y-2 sm:justify-end">
                      <Num label="Value added" value={money(r.created)} cls={signedClass(r.created)} strong />
                      <Num label="Cash left in" value={r.cashLeft <= 0 ? `${money(-r.cashLeft)} out` : money(r.cashLeft)} cls={r.cashLeft <= 0 ? 'text-emerald-700 dark:text-emerald-400' : ''} />
                      {r.cashFlow == null ? (
                        <button type="button" onClick={() => setOpen(r.listing.id)} className="text-right">
                          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Cash flow after</span>
                          <span className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">Add the tax bill</span>
                        </button>
                      ) : (
                        <Num label="Cash flow after" value={`${money(r.cashFlow, { signed: true })}/mo`} cls={signedClass(r.cashFlow)} />
                      )}
                      <Button variant="ghost" className="px-2" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.listing.id)}>
                        {isOpen ? 'Less' : 'The numbers'} <ChevronDown className={`size-4 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-4 grid gap-6 rounded-md bg-well/50 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Buy and fix it</p>
                        <Line l="Price" v={money(r.price)} />
                        <Line l="Closing and land transfer tax" v={money(r.closing)} />
                        <Line l={`Rehab${r.rehabOwn ? ' (your number)' : ''}`} v={money(r.rehab)} />
                        <Line l={`Holding for ${plan.months} months${r.taxKnown ? '' : ', before tax'}`} v={money(r.holding)} />
                        <Line l="All in" v={money(r.allIn)} strong />
                        <Line l={`Your cash in (${plan.downPct}% down plus the rest)`} v={money(r.cashIn)} />
                        <div className="mt-3 flex items-end gap-2">
                          <div className="w-40">
                            <NumberField id={`rehab-${r.listing.id}`} label="Your rehab estimate" prefix="$" value={r.rehab} onChange={(v) => setRehab(r.listing.id, v)} step={5000} decimals={0} />
                          </div>
                          {r.rehabOwn && (
                            <Button variant="ghost" className="px-2 text-xs" onClick={() => clearRehab(r.listing.id)}>
                              Use the plan’s
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Refinance and rent</p>
                        <Line l="Likely value once fixed" v={money(r.arv.value)} />
                        <Line l={`New loan, ${plan.refiPct}%`} v={money(r.newLoan)} />
                        <Line l="Pays off the first loan" v={money(-r.loan)} />
                        <Line l="Refinance costs" v={money(-r.refiCost)} />
                        <Line l="Cash back to you" v={money(r.cashBack)} strong />
                        <Line l="Equity you keep" v={money(r.equity)} />
                        <Line l={`Rent${r.rentSource === 'stated' ? '' : ' (typical CMHC rent, estimate)'}`} v={`${money(r.rent)}/mo`} />
                        <Line l="Mortgage payment after" v={`${money(r.payment)}/mo`} />
                        <Line l="Cash flow after" v={r.cashFlow == null ? 'Needs the tax bill' : `${money(r.cashFlow, { signed: true })}/mo`} strong />
                        {onTax && (r.cashFlow == null || taxSource(r.listing, market) === 'you') && (
                          <TaxBox
                            id={r.listing.id}
                            own={taxSource(r.listing, market) === 'you' ? market.taxes[r.listing.id] : undefined}
                            url={r.url}
                            onTax={onTax}
                          />
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button onClick={() => onOpen(r)}>
                            Open in Analyze <ArrowRight className="size-4" aria-hidden />
                          </Button>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-well dark:text-emerald-400">
                              {siteName(r.url)} <ExternalLink className="size-3.5" aria-hidden />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {ranked.length > 15 && (
            <div className="border-t border-hairline px-5 py-3">
              <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show the top 15' : `Show all ${ranked.length}`}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5 text-sm text-zinc-700 dark:text-zinc-300">
        <h3 className="font-semibold text-zinc-950 dark:text-white">How the rank works</h3>
        <ul className="mt-2 grid gap-1.5 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Likely value once fixed:</strong> the middle asking price of similar homes for sale nearby (same number of units, within a bedroom, condos only against condos): within 1 km if there are three, then 2 km, then 4 km, then the whole city. Asking prices, not sales: an appraiser decides the real value at the refinance.
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Value added</strong> is that value less everything you spend: price, closing, land transfer tax, rehab, and holding costs while it’s empty. Up to 60 points.
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Cash back:</strong> how much of your cash the refinance returns. Up to 25 points.
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Cash flow after:</strong> rent less the new mortgage, tax, insurance and an allowance for management, repairs and empty months. Up to 15 points. Without a tax bill it isn’t guessed.
          </li>
          <li>A home far under its neighbours is often under for a reason (foundation, roof, a busy road). Walk it with a contractor before you trust any rehab number.</li>
        </ul>
        {unranked.length > 0 && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{unranked.length} listings had fewer than three similar homes to compare with, so they aren’t ranked.</p>}
      </Card>
    </div>
  );
}

function Num({ label, value, cls = '', strong = false }) {
  return (
    <div className="text-right">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`tabular text-sm ${strong ? 'font-semibold' : ''} ${cls || 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
    </div>
  );
}

function Line({ l, v, strong = false }) {
  return (
    <p className={`flex justify-between gap-3 py-0.5 ${strong ? 'border-t border-hairline pt-1.5 font-semibold text-zinc-950 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
      <span>{l}</span>
      <span className="tabular-nums">{v}</span>
    </p>
  );
}

/**
 * The yearly tax bill for a listing that doesn't state one: typed in from
 * the listing page or the agent, so its cash flow can be worked out.
 * Squarely never fills this in itself.
 */
function TaxBox({ id, own, url, onTax }) {
  const [v, setV] = useState(own);
  return (
    <div className="mt-3 rounded-md border border-hairline p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <NumberField id={`tax-${id}`} label="Yearly property tax" prefix="$" value={v} onChange={setV} step={100} decimals={0} />
        </div>
        <Button variant="primary" disabled={!(v > 0)} onClick={() => onTax(id, v)}>
          {own != null ? 'Update' : 'Use this bill'}
        </Button>
        {own != null && (
          <Button variant="ghost" className="text-xs" onClick={() => (setV(undefined), onTax(id, null))}>
            Remove
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {own != null ? 'Your number, from the listing or the agent. ' : 'The listing doesn’t state it. '}
        Find it further down the {url ? 'listing page' : 'listing'}, or ask the listing agent. Saved for you, and used everywhere in Squarely.
      </p>
    </div>
  );
}
