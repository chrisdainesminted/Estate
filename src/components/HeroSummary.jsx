import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical, MapPin, Share2, XCircle } from 'lucide-react';
import { BAND_CLASSES, DSCR_BANDS, TONE_CLASSES, TONE_GLOW, verdict } from '../lib/dscr.js';
import { breakevenSentence, cashFlowMeaning, cashInMeaning, cocMeaning, dealSentence, dscrMeaning } from '../lib/explain.js';
import { money, percent, ratio, safeHttpUrl } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { Button, Card, DscrChip, KpiTile, signedClass } from './ui.jsx';
import { Num } from './motion.jsx';

const TONE_ICONS = { bad: XCircle, warn: AlertTriangle, good: CheckCircle2 };

// Piecewise-linear DSCR scale so the narrow 1.20–1.25 sweet spot stays visible.
const STOPS = [0.5, 1.0, 1.2, 1.25, 2.0];
const FRACS = [0, 0.36, 0.6, 0.72, 1];

function toFrac(v) {
  if (!Number.isFinite(v) || v >= STOPS[4]) return 1;
  if (v <= STOPS[0]) return 0;
  const i = STOPS.findIndex((s) => v <= s);
  return FRACS[i - 1] + ((v - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1])) * (FRACS[i] - FRACS[i - 1]);
}

/** Where this DSCR sits among the lender bands. The number, chip and sentence beside it carry the meaning. */
function DscrBar({ a }) {
  return (
    <div aria-hidden className="relative mt-3 mb-6 max-w-56">
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
        {DSCR_BANDS.map((b, i) => (
          <span key={b.key} style={{ width: `${(FRACS[i + 1] - FRACS[i]) * 100}%`, background: b.color, opacity: b.key === a.status.key ? 1 : 0.28 }} />
        ))}
      </div>
      <span
        className="absolute top-[3px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-2 ring-white transition-[left] duration-500 dark:bg-white dark:ring-zinc-900"
        style={{ left: `${toFrac(a.dscr) * 100}%` }}
      />
      {[
        [1, '1.00'],
        [1.25, '1.25'],
      ].map(([v, text]) => (
        <span key={text} className="tabular absolute top-2.5 -translate-x-1/2 text-[10px] text-zinc-500 dark:text-zinc-400" style={{ left: `${toFrac(v) * 100}%` }}>
          {text}
        </span>
      ))}
    </div>
  );
}

/** The deal at a glance: a plain verdict, then the four numbers that decide it (money first), each with what it means. */
export default function HeroSummary({ deal, a, base, targets, whatIf, onShare }) {
  const v = verdict(a);
  const VIcon = TONE_ICONS[v.tone];
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const link = safeHttpUrl(deal.listingUrl);
  const rate = Number(deal.rate).toFixed(3).replace(/\.?0+$/, '');
  const facts = [
    money(a.price),
    type?.key === 'multiplex' ? `Multiplex, ${a.units} units` : type?.label,
    `${Number(deal.downPct)}% down`,
    `${rate}% for ${deal.termYears} years`,
    `${money(a.grossRent)}/mo rent`,
    deal.country === 'ca' && 'Ontario rules',
    a.interestOnly && `interest-only for ${a.ioYears} years`,
  ].filter(Boolean);
  const breakeven = breakevenSentence(a);

  return (
    <Card id="sec-summary" className="relative overflow-hidden">
      {/* Ambient glow keyed to the verdict. */}
      <div aria-hidden className={`pointer-events-none absolute -top-40 -right-24 size-[28rem] rounded-full bg-radial ${TONE_GLOW[v.tone]} to-transparent to-70% blur-2xl`} />

      <div className="relative px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="eyebrow">{deal.status === 'owned' ? 'Owned property' : 'Deal analysis'}</p>
            <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{deal.name}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset backdrop-blur ${TONE_CLASSES[v.tone]}`}>
              <VIcon className="size-4" aria-hidden />
              {v.label}
            </span>
            {onShare && (
              // Just the icon on phones, so the verdict stays on one line.
              <Button variant="ghost" className="px-2.5 py-1.5" onClick={onShare} title="Share this deal as a link">
                <Share2 className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Share</span>
              </Button>
            )}
          </div>
        </div>
        {(deal.address || link) && (
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {deal.address && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{deal.address}</span>
              </span>
            )}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
              >
                View listing <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </p>
        )}
        <p className="tabular mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{facts.join(' · ')}</p>
        {deal.example && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">An example deal: edit it, or add your own.</p>}
        {deal.estimated && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Taxes and insurance are estimated from the price: edit the deal once you know the real numbers.</p>}

        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-zinc-900 sm:text-base dark:text-zinc-100">
          <span className="font-medium">{dealSentence(a)}</span>
          {breakeven && <span className="text-zinc-600 dark:text-zinc-400"> {breakeven}</span>}
        </p>

        {whatIf && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100 dark:ring-amber-300/25">
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{whatIf.text} These numbers aren’t saved yet.</span>
            <span className="flex gap-2">
              <Button variant="ghost" className="px-2.5 py-1" onClick={whatIf.onReset}>
                Reset
              </Button>
              <Button variant="primary" className="px-2.5 py-1" onClick={whatIf.onApply}>
                Apply
              </Button>
            </span>
          </div>
        )}
      </div>

      <dl className="relative mt-5 grid grid-cols-2 border-t border-hairline lg:grid-cols-4">
        <KpiTile
          label="Monthly cash flow"
          tip="netCashFlow"
          value={
            <>
              <Num value={a.netCashFlow} format={(x) => money(x, { signed: true })} />
              <span className="ml-1 text-sm font-medium tracking-normal text-zinc-500 dark:text-zinc-400">/mo</span>
            </>
          }
          valueClass={signedClass(a.netCashFlow)}
          meaning={cashFlowMeaning(a)}
          base={base && `${money(base.netCashFlow, { signed: true })}/mo`}
        />
        <KpiTile
          label="Cash-on-cash return"
          tip="coc"
          value={<Num value={a.coc} format={(x) => percent(x)} />}
          valueClass={signedClass(a.coc)}
          meaning={cocMeaning(a, targets)}
          base={base && percent(base.coc)}
        />
        <KpiTile
          label="Cash you put in"
          tip="cashInvested"
          value={<Num value={a.cashInvested} format={(x) => money(x)} />}
          meaning={cashInMeaning(a)}
          base={base && money(base.cashInvested)}
        />
        <KpiTile
          label="Lender check (DSCR)"
          tip="dscr"
          value={<Num value={a.dscr} format={ratio} />}
          valueClass={BAND_CLASSES[a.status.key].text}
          extra={
            <dd className="mt-2">
              <DscrChip status={a.status} size="sm" />
              <DscrBar a={a} />
            </dd>
          }
          meaning={dscrMeaning(a)}
          base={base && ratio(base.dscr)}
        />
      </dl>
    </Card>
  );
}
