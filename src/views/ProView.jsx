import { useMemo } from 'react';
import { ArrowRight, ExternalLink, FileDown, Gavel, Hammer, MessageCircleQuestion, Repeat, BellRing } from 'lucide-react';
import { DISTRESS, TAX_SALE_STEPS, distressOf } from '../lib/distress.js';
import { rankBrrrr } from '../lib/brrrr.js';
import { cityByKey } from '../lib/canada.js';
import { listingPageUrl, siteName } from '../lib/market.js';
import { money } from '../lib/format.js';
import { Button, Card, CardHeader, SkeletonCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { PlusOffer, PlusTag, usePlus } from '../components/Plus.jsx';
import { CityPicker } from './ListingsView.jsx';

const dateLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
// Where each city publishes its tax sales, where we know it.
const TAX_SALE_PAGES = { 'thunder-bay': 'https://www.thunderbay.ca/en/news/tax-sale-properties.aspx' };

/**
 * Pro, for Squarely Plus members: properties a lender, an estate, a court
 * or a city is selling, often below what similar homes ask, run through the
 * BRRRR numbers; the city's tax sales with their minimum bids; and the
 * other Plus tools in one place.
 */
export default function ProView({ feedState, indexState, city, onCity, market, plan, taxSales, onView, onAnalyze }) {
  const plus = usePlus();
  const { status, feed } = feedState;
  const place = cityByKey(city);
  const scored = useMemo(() => {
    const { ranked } = rankBrrrr(feed?.listings ?? [], market, plan, city, { hidden: market.hidden });
    return new Map(ranked.map((r) => [r.listing.id, r]));
  }, [feed, market, plan, city]);
  const distressed = useMemo(
    () =>
      (feed?.listings ?? [])
        .filter((l) => (l.status ?? 'active') === 'active' && listingPageUrl(l.url, l.address))
        .map((l) => ({ l, kind: distressOf(l), r: scored.get(l.id) }))
        .filter((x) => x.kind)
        .sort((a, b) => (b.r?.score ?? -1) - (a.r?.score ?? -1)),
    [feed, scored],
  );
  const sales = taxSales.feed?.cities?.[city]?.sales ?? [];
  const checked = taxSales.feed?.cities?.[city]?.checked;

  return (
    <div className="space-y-6">
      <ViewHeader
        title={
          <span className="inline-flex items-center gap-2">
            Pro <PlusTag />
          </span>
        }
        aside={<CityPicker city={city} index={indexState?.feed} onCity={onCity} />}
      >
        Below-market properties in {place.name}: lender, estate and court sales, and the city’s tax sales, with the numbers already run.
      </ViewHeader>

      {!plus.active ? (
        <Card className="p-5">
          <p className="text-[15px] font-semibold text-zinc-950 dark:text-white">
            {status === 'checking' ? 'Counting…' : `${distressed.length} distressed listing${distressed.length === 1 ? '' : 's'} and ${sales.length} open tax sale${sales.length === 1 ? '' : 's'} in ${place.name} right now.`}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">See every one with its BRRRR numbers, minimum bids and deadlines.</p>
          <div className="mt-4">
            <PlusOffer feature="pro" />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Distressed listings" subtitle="For sale now, where the listing says it’s a power of sale, bank-owned, court-ordered, estate or as-is sale. Best BRRRR score first." />
            {status === 'checking' ? (
              <SkeletonCard className="m-5 h-40" />
            ) : distressed.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400">None listed in {place.name} today. The morning run looks for them every time it searches here.</p>
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {distressed.map(({ l, kind, r }) => (
                  <li key={l.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/25 ring-inset dark:text-amber-300">{DISTRESS[kind].label}</span>
                      <p className="mt-1 truncate text-[15px] font-semibold text-zinc-950 dark:text-white">{l.address}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {money(l.price)}
                        {r ? `, ${Math.round(r.discount * 100)}% under similar homes nearby. Score ${r.score}/100.` : '. Not enough similar homes to compare.'} {DISTRESS[kind].text}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
                      {r && (
                        <div className="text-right">
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Value added</p>
                          <p className={`tabular text-sm font-semibold ${signedClass(r.created)}`}>{money(r.created)}</p>
                        </div>
                      )}
                      <a href={listingPageUrl(l.url, l.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                        {siteName(l.url)} <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      {r && (
                        <Button variant="ghost" className="px-2" onClick={() => onAnalyze(r)}>
                          Analyze <ArrowRight className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Gavel className="size-4 text-emerald-600" aria-hidden /> Tax sales in {place.name}
                </span>
              }
              subtitle={`Land the city sells by public tender for unpaid property tax, from the city’s own notice.${checked ? ` Last checked ${dateLabel(checked)}.` : ''}`}
            />
            {sales.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  No open tax sales found in {place.name}.{' '}
                  {city === 'thunder-bay' ? 'Thunder Bay holds one each June, advertised in the spring.' : 'Most cities hold one or two a year.'} The morning run checks the city’s notices and the provincial gazette, and they’ll show here as soon as one is announced.
                </p>
                {TAX_SALE_PAGES[city] && (
                  <a href={TAX_SALE_PAGES[city]} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                    The City’s tax sale page <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {sales.map((s) => (
                  <li key={s.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-zinc-950 dark:text-white">{s.address || s.legal}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {[s.roll && `Roll ${s.roll}`, s.size, s.address && s.legal, s.notes].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
                      <div className="text-right">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Minimum bid</p>
                        <p className="tabular text-sm font-semibold text-zinc-950 dark:text-white">{money(s.minimumBid)}</p>
                      </div>
                      {s.deadline && (
                        <div className="text-right">
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Tenders due</p>
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">{dateLabel(s.deadline)}</p>
                        </div>
                      )}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                        Official notice <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-hairline px-5 py-4 text-sm">
              <p className="font-semibold text-zinc-950 dark:text-white">How a tax sale works{place.province === 'ON' ? ' in Ontario' : ''}</p>
              {place.province !== 'ON' && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Rules differ by province (some sell at public auction): read the city’s notice for the exact terms.</p>}
              <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-zinc-700 dark:text-zinc-300">
                {TAX_SALE_STEPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          </Card>
        </>
      )}

      <Card>
        <CardHeader title="Your Pro tools" />
        <ul className="grid gap-px border-t border-hairline bg-(--line) sm:grid-cols-2">
          {[
            [Repeat, 'BRRRR rankings', 'Every listing ranked against similar homes on nearby streets.', () => onView('brrrr')],
            [Hammer, 'Blueprint to materials list', 'Upload a floor plan; get quantities and where to buy.', () => onView('build')],
            [FileDown, 'Pricing report', 'What a home is worth, as a PDF to share.', () => onView('sell')],
            [MessageCircleQuestion, 'Ask Squarely', 'Questions answered from your own numbers: the button in the corner.', null],
            [BellRing, 'Daily emails', 'New listings that fit and price drops, every morning.', () => onView('listings')],
          ].map(([Icon, t, b, go]) => (
            <li key={t} className="bg-(--panel)">
              <button type="button" disabled={!go} onClick={go ?? undefined} className="flex h-full w-full items-start gap-3 p-4 text-left enabled:hover:bg-well">
                <Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-zinc-950 dark:text-white">{t}</span>
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">{b}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        From public listings and official municipal notices only. Distressed sales are usually as is: inspect, check the title with a lawyer, and confirm the numbers before you offer or bid.
      </p>
    </div>
  );
}
