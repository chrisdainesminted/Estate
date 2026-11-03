import { useMemo, useState } from 'react';
import { ArrowRight, BellPlus, BellRing, ExternalLink } from 'lucide-react';
import { listingPageUrl, listingRent, listingTaxes, listingToDeal, siteName, unitsOf } from '../lib/market.js';
import { homeFor, withGift } from '../lib/firstHome.js';
import { FITS, fitFor } from '../lib/journey.js';
import { cityByKey } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { Button, Card, Segmented, SkeletonCard, ViewHeader } from '../components/ui.jsx';
import { CityPicker } from './ListingsView.jsx';

const KIND = { 1: 'House', 2: 'Duplex', 3: 'Triplex', 4: 'Fourplex' };
const TONE = {
  good: 'bg-emerald-600/10 text-emerald-800 ring-emerald-600/25 dark:text-emerald-300 dark:ring-emerald-400/30',
  warn: 'bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/30',
  muted: 'bg-well text-zinc-600 ring-(--line-strong) dark:text-zinc-400',
};
const ORDER = { fits: 0, stretch: 1, notYet: 2 };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Homes for me: today's listings that a first-time buyer could live in
 * (one to four units), each with what it would cost them a month, the cash
 * to close, and whether it fits them now, is a stretch, or isn't yet.
 * Listings without a published tax bill show last, without a monthly cost:
 * Squarely doesn't guess the tax.
 */
export default function HomesForMe({ feedState, indexState, city, onCity, market, profile, alerts = [], onAlerts, onAnalyze, onView, nextStep }) {
  const { status, feed } = feedState;
  const [show, setShow] = useState('all');
  const [noTax, setNoTax] = useState(false);
  const p = useMemo(() => withGift({ ...profile, city }), [profile, city]);
  const hidden = useMemo(() => new Set(market.hidden ?? []), [market.hidden]);

  const rows = useMemo(() => {
    const list = (feed?.listings ?? []).filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address) && unitsOf(l) <= 4 && !hidden.has(l.id));
    return list
      .map((l) => {
        const deal = listingToDeal(l, market, 'own');
        const taxKnown = listingTaxes(l, market) != null;
        const home = homeFor(deal, p, market.rate);
        const fit = taxKnown ? fitFor(home, p) : null;
        return { l, deal, home, fit, taxKnown, rentSource: listingRent(l, market).source };
      })
      .sort((a, b) => (a.fit ? ORDER[a.fit.key] : 3) - (b.fit ? ORDER[b.fit.key] : 3) || (a.taxKnown && b.taxKnown ? a.home.costToLive - b.home.costToLive : a.l.price - b.l.price));
  }, [feed, market, p, hidden]);

  const count = (k) => rows.filter((r) => r.fit?.key === k).length;
  const withTax = rows.filter((r) => r.taxKnown);
  const untaxed = rows.length - withTax.length;
  // Without the tax bill there's no honest monthly cost: those wait behind a button.
  const shown = show === 'all' ? (noTax ? rows : withTax) : rows.filter((r) => r.fit?.key === show);
  const place = cityByKey(city);
  const alert = alerts.find((a) => a.city === city && a.fits);
  const addAlert = () => onAlerts([...alerts, { city, types: ['single', 'small'], fits: true, since: todayIso(), seen: todayIso() }].slice(-10));

  return (
    <div className="space-y-6">
      <ViewHeader title="Homes for me" aside={<CityPicker city={city} index={indexState?.feed} onCity={onCity} />}>
        Today’s listings in {place.name} you could live in, run through your numbers{profile.gift > 0 ? ' (your family gift counted)' : ''}.
      </ViewHeader>
      {nextStep}

      {!profile.entered && (
        <Card className="p-5 text-sm text-zinc-700 dark:text-zinc-300">
          These use example numbers until you answer the questions on My plan.{' '}
          <button type="button" onClick={() => onView('home')} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Answer them now
          </button>
        </Card>
      )}

      {status === 'checking' && <SkeletonCard className="h-96" />}
      {status !== 'checking' && !rows.length && (
        <Card className="p-6 text-sm text-zinc-600 dark:text-zinc-400">No homes of one to four units listed in {place.name} today. Try a nearby city, or check back tomorrow: listings are found every morning.</Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              stretch
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: 'all', label: `All ${withTax.length}` },
                { value: 'fits', label: `Fits ${count('fits')}` },
                { value: 'stretch', label: `Stretch ${count('stretch')}` },
                { value: 'notYet', label: `Not yet ${count('notYet')}` },
              ]}
            />
            {onAlerts &&
              (alert ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <BellRing className="size-4" aria-hidden /> We’ll tell you when a new home fits
                </span>
              ) : (
                <Button onClick={addAlert}>
                  <BellPlus className="size-4" aria-hidden /> Tell me when a home fits
                </Button>
              ))}
          </div>
          {alert && <p className="-mt-3 text-xs text-zinc-500 dark:text-zinc-400">New matches show here. With an account and email (in the menu), you also get them by email each morning.</p>}

          <Card>
            <ul className="divide-y divide-hairline">
              {shown.map(({ l, home, fit, taxKnown, rentSource }) => {
                const units = unitsOf(l);
                const tone = fit ? TONE[FITS[fit.key].tone] : TONE.muted;
                return (
                  <li key={l.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>{fit ? FITS[fit.key].label : 'Tax bill not listed'}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {KIND[units]}
                          {l.beds?.length ? ` · ${l.beds.filter(Boolean).join(' + ')} bed` : ''}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[15px] font-semibold text-zinc-950 dark:text-white">{l.address}</p>
                      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                        {fit ? fit.reason : 'The listing doesn’t give the property tax, so we can’t say what it would cost you or whether you’d qualify. Ask the listing agent for the tax bill.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-2 sm:justify-end">
                      <Num label="Price" value={money(l.price)} />
                      <Num label="Cash to close" value={money(home.cashNeeded)} />
                      <Num
                        label={units > 1 ? 'Costs you, after rent' : 'Costs you'}
                        value={taxKnown ? `${money(home.costToLive)}/mo` : '—'}
                        sub={taxKnown && profile.rentNow ? `rent now ${money(profile.rentNow)}` : undefined}
                        strong
                      />
                      <div className="flex gap-1.5">
                        <a
                          href={listingPageUrl(l.url, l.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-emerald-700 hover:bg-well dark:text-emerald-400"
                          aria-label={`See ${l.address} on ${siteName(l.url)} (opens in a new tab)`}
                        >
                          Listing <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                        <Button variant="ghost" className="px-2.5" onClick={() => onAnalyze(l)} aria-label={`Every number for ${l.address}`}>
                          Numbers <ArrowRight className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {units > 1 && rentSource !== 'stated' && taxKnown && (
                      <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">Rent from the other unit{units > 2 ? 's' : ''} is the average asking rent in {place.name} (estimate): the listing doesn’t say.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {show === 'all' && untaxed > 0 && (
            <Button variant="ghost" onClick={() => setNoTax((v) => !v)}>
              {noTax ? 'Hide' : 'Show'} {untaxed} home{untaxed === 1 ? '' : 's'} whose listing doesn’t give the tax bill
            </Button>
          )}
          <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
            Each assumes the least down payment at today’s rate, with mortgage insurance, the listing’s own tax bill, insurance and an allowance for repairs. Fits: you’d qualify and
            have the cash. Stretch: you’d qualify and could save the rest within a year. A lender makes the real call.
          </p>
        </>
      )}
    </div>
  );
}

function Num({ label, value, sub, strong = false }) {
  return (
    <div className="text-right">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`tabular text-sm ${strong ? 'font-semibold text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>{value}</p>
      {sub && <p className="tabular text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}
