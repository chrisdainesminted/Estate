import { useMemo, useState } from 'react';
import { Search, X as Close } from 'lucide-react';
import { Check, ExternalLink, FileDown } from 'lucide-react';
import { SELL_STEPS, homeWorth, netProceeds, totalBeds } from '../lib/selling.js';
import { listingPageUrl, siteName } from '../lib/market.js';
import { cityByKey } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { saveFile } from '../lib/runtime.js';
import { Button, Card, CardHeader, LedgerLine, NumberField, Segmented, SelectField, SkeletonCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { Section, SectionGroup } from '../components/Section.jsx';
import { ASSESSMENT_LOOKUP, CONFIDENCE, valueEstimate } from '../lib/valuation.js';
import { PlusGate, usePlus } from '../components/Plus.jsx';
import { CityPicker } from './ListingsView.jsx';

const KINDS = ['House', 'Duplex', 'Triplex', 'Fourplex', '5+ units'];
const yesNo = [
  { value: 'agent', label: 'Agent' },
  { value: 'private', label: 'Private' },
];

/**
 * Selling: what your home is likely worth from similar homes for sale now,
 * and what you'd walk away with once commission, the mortgage and the rest
 * are paid. The pricing report as a PDF is part of Plus.
 */
const CONF_TONE = {
  high: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/30 dark:text-emerald-300',
  medium: 'bg-amber-400/10 text-amber-900 ring-amber-500/30 dark:text-amber-200',
  low: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300',
};

/**
 * The home's assessment: looked up from its address where the city publishes
 * every assessment (Calgary, Edmonton, Winnipeg), or typed from the tax bill
 * or assessment notice anywhere else.
 */
function Assessment({ sell, onSell, city, province }) {
  const [state, setState] = useState({ status: 'idle', matches: [], hood: null, error: '', source: '' });
  const a = sell.assessment;
  const canLook = ASSESSMENT_LOOKUP.includes(city);
  const find = async () => {
    setState({ status: 'busy', matches: [], hood: null, error: '', source: '' });
    try {
      const res = await fetch(`/api/assessment?city=${encodeURIComponent(city)}&address=${encodeURIComponent(sell.address)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t look that up. Try again in a minute.');
      if (!data.matches?.length) throw new Error('No home at that address in the city’s assessments. Check the number and street.');
      setState({ status: 'done', matches: data.matches, hood: data.hood, error: '', source: data.source });
    } catch (e) {
      setState({ status: 'idle', matches: [], hood: null, error: e.message, source: '' });
    }
  };
  const pick = (m) => {
    onSell({ assessment: { ...m, source: 'city', hood: state.hood } });
    setState((s) => ({ ...s, matches: [] }));
  };
  const field = 'field w-full px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100';
  return (
    <div className="border-t border-hairline px-5 py-4">
      {a ? (
        <div className="flex items-start justify-between gap-3 text-sm">
          <p className="text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold text-zinc-950 dark:text-white">{a.address || 'Your home'}</span>: assessed at <strong className="tabular">{money(a.value)}</strong>
            {a.valuedAt ? (a.source === 'city' ? `, its value on ${new Date(`${a.valuedAt}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}` : ` in ${a.valuedAt.slice(0, 4)}`) : ''}
            {a.yearBuilt ? ` · built ${a.yearBuilt}` : ''}
            {a.livingArea ? ` · ${a.livingArea.toLocaleString('en-CA')} sq ft` : ''}
            {a.hood ? `. Homes in ${a.hood.name} are mostly assessed at ${money(a.hood.low)} to ${money(a.hood.high)}.` : '.'}
          </p>
          <button type="button" onClick={() => onSell({ assessment: null })} className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-well" aria-label="Remove the assessment">
            <Close className="size-4" aria-hidden />
          </button>
        </div>
      ) : canLook ? (
        <div>
          <label htmlFor="sell-address" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Your address, for the city’s assessment (optional)
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (sell.address.trim()) find();
            }}
          >
            <input id="sell-address" className={field} placeholder="15 Deermeade Place SE" value={sell.address} onChange={(e) => onSell({ address: e.target.value })} autoComplete="street-address" />
            <Button type="submit" disabled={state.status === 'busy' || !sell.address.trim()}>
              <Search className="size-4" aria-hidden /> {state.status === 'busy' ? 'Looking…' : 'Find'}
            </Button>
          </form>
          {state.error && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{state.error}</p>}
          {state.matches.length > 0 && (
            <ul className="mt-2 divide-y divide-hairline rounded-md ring-1 ring-(--line-strong) ring-inset">
              {state.matches.map((m) => (
                <li key={`${m.address}-${m.value}`}>
                  <button type="button" onClick={() => pick(m)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-well">
                    <span>{m.address}</span>
                    <span className="tabular font-semibold">{money(m.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">From the city’s open assessment data, under its Open Government Licence.</p>
        </div>
      ) : (
        <TypedAssessment province={province} onSave={(assessment) => onSell({ assessment })} />
      )}
    </div>
  );
}

/** An assessment typed from the notice: the value, and the year it values the home at (it's on the notice). */
function TypedAssessment({ province, onSave }) {
  const [value, setValue] = useState(undefined);
  const [year, setYear] = useState(province === 'ON' ? 2016 : new Date().getFullYear() - 1);
  const save = () => value > 0 && year >= 2000 && onSave({ value, valuedAt: `${year}-07-01`, source: 'you' });
  return (
    <div className="grid grid-cols-[1fr_7rem_auto] items-end gap-3">
      <NumberField id="sell-assessed" label="Assessed value (optional)" prefix="$" value={value} onChange={setValue} step={5000} decimals={0} />
      <div>
        <label htmlFor="sell-assessed-year" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Value as of
        </label>
        <input
          id="sell-assessed-year"
          type="number"
          inputMode="numeric"
          min="2000"
          max={new Date().getFullYear()}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="field w-full px-3 py-2 text-sm tabular-nums text-zinc-900 dark:text-zinc-100"
        />
      </div>
      <Button onClick={save} disabled={!(value > 0)}>
        Use it
      </Button>
      <p className="col-span-3 -mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        {province === 'ON'
          ? 'Ontario’s assessments are still at 2016 values, so we show yours but don’t use it as today’s price.'
          : 'On your assessment notice or tax bill, with the date it values your home at.'}
      </p>
    </div>
  );
}

export function SellWorth({ sell, onSell, feedState, indexState, city, onCity, nextStep }) {
  const plus = usePlus();
  const { status, feed } = feedState;
  const [error, setError] = useState('');
  const place = cityByKey(city);
  const worth = useMemo(() => homeWorth({ units: sell.units, beds: sell.beds, listings: feed?.listings ?? [] }), [sell.units, sell.beds, feed]);
  // The estimate: the city's assessment where we have it, else similar homes' asking prices, always with a range and how sure we are.
  const v = useMemo(() => valueEstimate({ assessment: sell.assessment, comps: worth, province: place.province }), [sell.assessment, worth, place.province]);
  const price = sell.price ?? v?.estimate ?? 0;
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
              { label: 'Likely price', value: money(v?.estimate ?? worth.estimate), strong: true },
              { label: 'Similar homes ask between', value: `${money(worth.low)} and ${money(worth.high)}` },
              ...(v ? [{ label: 'Based on', value: v.basis.join('; ').replace(/^./, (c) => c.toUpperCase()) }, { label: 'How sure', value: CONFIDENCE[v.confidence].label }] : []),
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
        <Assessment sell={sell} onSell={onSell} city={city} province={place.province} />
      </Card>

      {status === 'checking' ? (
        <SkeletonCard className="h-64" />
      ) : (
        <Card id="sell-worth" className="px-5 py-5 sm:px-6">
          {v ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">About {money(v.estimate)}</h2>
                <span title={CONFIDENCE[v.confidence].text} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${CONF_TONE[v.confidence]}`}>
                  {CONFIDENCE[v.confidence].label}
                </span>
              </div>
              {v.low != null && (
                <p className="mt-2 text-[15px] text-zinc-700 dark:text-zinc-300">
                  Similar homes in {place.name} are asking {money(v.low)} to {money(v.high)}.
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                From {v.basis.join(', and ')}. {v.notes[0]}
              </p>
              <p className="mt-3 text-[15px] text-zinc-700 dark:text-zinc-300">
                You’d walk away with about <strong className={`tabular font-semibold ${signedClass(n.net)}`}>{money(n.net)}</strong> after the agent and the costs of selling.
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
                Fewer than three {KINDS[sell.units - 1].toLowerCase()}s are for sale in {place.name} today. Add your home’s assessed value above, try a nearby city, or check back: listings are found every morning.
              </p>
            </>
          )}
        </Card>
      )}

      <SectionGroup>
        {worth && (
          <Section id="sell-comps" title="Homes compared" value={`${worth.count} for sale`} meaning="The similar homes for sale now that the estimate comes from.">
            <div className="px-5 pb-3 text-sm sm:px-6">
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
          </Section>
        )}
        <Section id="sell-net" title="What you’d walk away with" value={money(n.net)} valueClass={signedClass(n.net)} meaning="Change the price, the commission, your mortgage and the costs.">
          <div className="grid gap-6 p-5 @3xl:grid-cols-2 lg:grid-cols-2">
            <div className="grid content-start grid-cols-2 gap-3">
              <NumberField id="sell-price" label="Selling price" prefix="$" value={price} onChange={(v) => onSell({ price: v })} step={5000} decimals={0} hint={sell.price == null ? 'The estimate above' : undefined} />
              <div>
                <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Selling</span>
                <Segmented stretch size="sm" label="Selling with an agent or privately" value={sell.privateSale ? 'private' : 'agent'} onChange={(v) => onSell({ privateSale: v === 'private' })} options={yesNo} />
              </div>
              {!sell.privateSale && <NumberField id="sell-commission" label="Commission, both agents" suffix="%" value={sell.commissionPct} onChange={(v) => onSell({ commissionPct: v })} step={0.25} decimals={2} hint="It’s negotiable: ask" />}
              <NumberField id="sell-mortgage" label="Mortgage left" prefix="$" value={sell.mortgage} onChange={(v) => onSell({ mortgage: v })} step={1000} decimals={0} />
              {sell.mortgage > 0 && (
                <>
                  <NumberField id="sell-rate" label="Its rate" suffix="%" value={sell.ratePct} onChange={(v) => onSell({ ratePct: v })} step={0.05} decimals={2} />
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Rate type</span>
                    <Segmented stretch size="sm" label="Rate type" value={sell.fixed ? 'fixed' : 'variable'} onChange={(v) => onSell({ fixed: v === 'fixed' })} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'variable', label: 'Variable' }]} />
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
        </Section>
      </SectionGroup>
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
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-500" style={{ width: `${(count / SELL_STEPS.length) * 100}%` }} />
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

