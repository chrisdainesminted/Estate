import { useMemo, useState } from 'react';
import { Check, ExternalLink, FileDown } from 'lucide-react';
import { SELL_STEPS, homeWorth, netProceeds, totalBeds } from '../lib/selling.js';
import { listingPageUrl, siteName } from '../lib/market.js';
import { cityByKey } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { saveFile } from '../lib/runtime.js';
import { Button, Card, CardHeader, LedgerLine, NumberField, Segmented, SelectField, SkeletonCard, SummaryCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { PlusGate, usePlus } from '../components/Plus.jsx';
import { CityPicker } from './ListingsView.jsx';

const KINDS = ['House', 'Duplex', 'Triplex', 'Fourplex', '5+ units'];
const yesNo = [
  { value: 'agent', label: 'With an agent' },
  { value: 'private', label: 'Privately' },
];

/**
 * Selling: what your home is likely worth from similar homes for sale now,
 * and what you'd walk away with once commission, the mortgage and the rest
 * are paid. The pricing report as a PDF is part of Plus.
 */
export function SellWorth({ sell, onSell, feedState, indexState, city, onCity, nextStep }) {
  const plus = usePlus();
  const { status, feed } = feedState;
  const [error, setError] = useState('');
  const place = cityByKey(city);
  const worth = useMemo(() => homeWorth({ units: sell.units, beds: sell.beds, listings: feed?.listings ?? [] }), [sell.units, sell.beds, feed]);
  const price = sell.price ?? worth?.estimate ?? 0;
  const n = netProceeds({ ...sell, price, province: place.province });

  const report = async () => {
    try {
      const { buildReportPdf } = await import('../lib/reportPdf.js');
      const blob = await buildReportPdf({
        title: `What a ${KINDS[sell.units - 1].toLowerCase()} with ${sell.beds} bedrooms is worth in ${place.name}`,
        subtitle: worth ? `From the asking prices of ${worth.count} similar homes for sale on ${new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}. Homes usually sell for a little less than they ask.` : '',
        sections: [
          worth && {
            title: 'Likely price',
            rows: [
              { label: 'Middle of similar homes', value: money(worth.estimate), strong: true },
              { label: 'Most ask between', value: `${money(worth.low)} and ${money(worth.high)}` },
            ],
          },
          worth && {
            title: 'Homes compared',
            rows: worth.comps.map((l) => ({ label: l.address, value: money(l.price), note: `${totalBeds(l) ?? '?'} bedrooms${l.url ? ` · ${siteName(l.url)}` : ''}` })),
          },
          {
            title: `What you'd walk away with, selling at ${money(price)}`,
            rows: [...n.lines.map((l) => ({ label: l.label, value: money(-l.amount) })), { label: 'In your pocket', value: money(n.net), strong: true }],
          },
        ].filter(Boolean),
        footer: 'An estimate from listings Squarely finds each morning, not an appraisal. An agent’s market analysis uses recent sale prices; ask for one before you set a price.',
      });
      await saveFile('squarely-pricing-report.pdf', blob);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader title="What it’s worth" aside={<CityPicker city={city} index={indexState?.feed} onCity={onCity} />}>
        What your home in {place.name} is likely worth, and what you’d walk away with after selling it.
      </ViewHeader>
      {nextStep}

      <Card>
        <CardHeader title="Your home" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-4">
          <SelectField id="sell-units" label="Type" value={sell.units} onChange={(e) => onSell({ units: Number(e.target.value) })}>
            {KINDS.map((k, i) => (
              <option key={k} value={i + 1}>
                {k}
              </option>
            ))}
          </SelectField>
          <NumberField id="sell-beds" label={sell.units > 1 ? 'Bedrooms, all units' : 'Bedrooms'} value={sell.beds} onChange={(v) => onSell({ beds: v })} step={1} decimals={0} hint="Count a basement bedroom" />
        </div>
      </Card>

      {status === 'loading' ? (
        <SkeletonCard className="h-64" />
      ) : (
        <SummaryCard
          id="sell-worth"
          head={
            worth ? (
              <>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">About {money(worth.estimate)}</h2>
                <p className="mt-2 text-[15px] text-zinc-700 dark:text-zinc-300">
                  Similar homes in {place.name} are asking {money(worth.low)} to {money(worth.high)}.
                </p>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  From {worth.count} {worth.byBeds ? `${KINDS[sell.units - 1].toLowerCase()}s within a bedroom of yours` : `${KINDS[sell.units - 1].toLowerCase()}s of any size`} for sale now. These are asking prices: homes usually sell for a little less, and condition and
                  street matter. An agent’s market analysis uses recent sales.
                </p>
                <div className="mt-4">
                  {plus.active ? (
                    <Button onClick={report}>
                      <FileDown className="size-4" aria-hidden /> Pricing report (PDF)
                    </Button>
                  ) : (
                    <PlusGate feature="report" compact />
                  )}
                </div>
                {error && (
                  <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Not enough to compare yet</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Fewer than three {KINDS[sell.units - 1].toLowerCase()}s are for sale in {place.name} today. Try a nearby city, or check back: listings are found every morning.
                </p>
              </>
            )
          }
        >
          {worth && (
            <div className="text-sm">
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Homes compared</p>
              <ul className="divide-y divide-hairline">
                {worth.comps.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <a href={listingPageUrl(l.url, l.address)} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                        {l.address} <ExternalLink className="inline size-3" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{totalBeds(l) ?? '?'} bedrooms</span>
                    </span>
                    <span className="tabular shrink-0 font-semibold">{money(l.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SummaryCard>
      )}

      <Card>
        <CardHeader title="What you’d walk away with" subtitle="After the agent, the mortgage and the costs of selling." />
        <div className="grid gap-6 px-5 pb-5 @3xl:grid-cols-2 lg:grid-cols-2">
          <div className="grid content-start grid-cols-2 gap-3">
            <NumberField id="sell-price" label="Selling price" prefix="$" value={price} onChange={(v) => onSell({ price: v })} step={5000} decimals={0} hint={sell.price == null ? 'The estimate above' : undefined} />
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Selling</span>
              <Segmented size="sm" label="Selling" value={sell.privateSale ? 'private' : 'agent'} onChange={(v) => onSell({ privateSale: v === 'private' })} options={yesNo} />
            </div>
            {!sell.privateSale && <NumberField id="sell-commission" label="Commission, both agents" suffix="%" value={sell.commissionPct} onChange={(v) => onSell({ commissionPct: v })} step={0.25} decimals={2} hint="It’s negotiable: ask" />}
            <NumberField id="sell-mortgage" label="Mortgage left" prefix="$" value={sell.mortgage} onChange={(v) => onSell({ mortgage: v })} step={1000} decimals={0} />
            {sell.mortgage > 0 && (
              <>
                <NumberField id="sell-rate" label="Its rate" suffix="%" value={sell.ratePct} onChange={(v) => onSell({ ratePct: v })} step={0.05} decimals={2} />
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Rate type</span>
                  <Segmented size="sm" label="Rate type" value={sell.fixed ? 'fixed' : 'variable'} onChange={(v) => onSell({ fixed: v === 'fixed' })} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'variable', label: 'Variable' }]} />
                </div>
                <NumberField id="sell-penalty" label="Penalty from your lender" prefix="$" value={sell.penalty ?? undefined} onChange={(v) => onSell({ penalty: v })} step={100} decimals={0} hint="From your payout statement; blank estimates it" />
              </>
            )}
            <NumberField id="sell-legal" label="Lawyer or notary" prefix="$" value={sell.legal} onChange={(v) => onSell({ legal: v })} step={100} decimals={0} />
            <NumberField id="sell-repairs" label="Repairs and staging" prefix="$" value={sell.repairs} onChange={(v) => onSell({ repairs: v })} step={500} decimals={0} />
            <NumberField id="sell-moving" label="Moving" prefix="$" value={sell.moving} onChange={(v) => onSell({ moving: v })} step={100} decimals={0} />
          </div>
          <div className="text-sm">
            <LedgerLine label="Selling price" value={money(price)} />
            {n.lines.map((l) => (
              <LedgerLine key={l.key} label={l.label} value={money(-l.amount)} />
            ))}
            <LedgerLine label="In your pocket" value={money(n.net)} valueClass={`text-xl ${signedClass(n.net)}`} total />
            {n.penaltyEstimated && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                The penalty is estimated as three months’ interest.{n.fixed ? ' On a fixed rate it’s often more (the interest rate differential): ask your lender for a payout statement.' : ''}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Selling the home you live in: no tax on the gain under the principal residence exemption. A rental or second home is different: ask an accountant.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Getting a home ready to sell, step by step, ticked off as you go. */
export function SellReady({ sell, onSell, onView, nextStep }) {
  const done = sell.done;
  const count = SELL_STEPS.filter((s) => done[s.id]).length;
  return (
    <div className="space-y-6">
      <ViewHeader title="Sell-ready">Every step from deciding to sell to closing day. Tick each one off as you go: it’s saved with your numbers.</ViewHeader>
      {nextStep}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-zinc-900 dark:text-white">
              {count} of {SELL_STEPS.length} done
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--track)" role="progressbar" aria-valuemin={0} aria-valuemax={SELL_STEPS.length} aria-valuenow={count} aria-label="Steps done">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500" style={{ width: `${(count / SELL_STEPS.length) * 100}%` }} />
          </div>
          <ol className="mt-4 divide-y divide-hairline">
            {SELL_STEPS.map((s, i) => {
              const on = done[s.id] === true;
              return (
                <li key={s.id} id={`sell-${s.id}`} className="flex scroll-mt-24 gap-3 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={s.title}
                    onClick={() => onSell({ done: { ...done, [s.id]: !on } })}
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${on ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950' : 'border-(--line-strong) hover:border-emerald-500'}`}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${on ? 'text-zinc-500 line-through decoration-zinc-400/60 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                      <span className="mr-1.5 tabular-nums text-zinc-400">{i + 1}.</span>
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {s.short}{' '}
                      {s.id === 'worth' && (
                        <button type="button" onClick={() => onView('sell')} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                          See what yours is worth
                        </button>
                      )}
                      {s.id === 'list' && (
                        <button type="button" onClick={() => onView('selllist')} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                          List it on Squarely
                        </button>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>
    </div>
  );
}

