import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical, MapPin, Share2, XCircle } from 'lucide-react';
import { TONE_TEXT, verdict } from '../lib/dscr.js';
import { breakevenSentence, dealSentence } from '../lib/explain.js';
import { money, safeHttpUrl } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { dealPlace } from '../lib/finance.js';
import { provinceName } from '../lib/canada.js';
import { Button, ExampleTag, SummaryCard } from './ui.jsx';
import DealLedgers from './DealLedgers.jsx';
import CalcInputs from './CalcInputs.jsx';

const TONE_ICONS = { bad: XCircle, warn: AlertTriangle, good: CheckCircle2 };

/**
 * The deal at a glance: its name and a plain verdict, then the month and the
 * cash as two ledgers, with the main inputs above them on phones. They step
 * aside during a what-if, whose banner holds the test numbers.
 */
export default function HeroSummary({ deal, a, base, whatIf, onShare, onChange }) {
  const v = verdict(a);
  const VIcon = TONE_ICONS[v.tone];
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const link = safeHttpUrl(deal.listingUrl);
  const rate = Number(deal.rate).toFixed(3).replace(/\.?0+$/, '');
  const facts = [
    deal.status === 'owned' && 'Owned',
    type?.key === 'multiplex' ? `Multiplex, ${a.units} units` : type?.label,
    money(a.price),
    `${Number(deal.downPct)}% down`,
    `${rate}% for ${deal.termYears} years`,
    deal.country === 'ca' && `${provinceName(dealPlace(deal).province)} rules`,
    a.interestOnly && `interest-only for ${a.ioYears} years`,
  ].filter(Boolean);
  const breakeven = breakevenSentence(a);

  return (
    <SummaryCard
      id="sec-summary"
      head={
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight break-words text-zinc-950 sm:text-2xl dark:text-white">
                {deal.name}
                {deal.example && <ExampleTag className="ml-2 inline-block align-middle" />}
              </h2>
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
              <p className="tabular mt-1 text-xs text-zinc-500 dark:text-zinc-400">{facts.join(' · ')}</p>
            </div>
            {onShare && (
              // Just the icon on phones, so the name keeps its room.
              <Button variant="ghost" className="-mt-1 shrink-0 px-2.5 py-1.5" onClick={onShare} title="Share this deal as a link">
                <Share2 className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Share</span>
              </Button>
            )}
          </div>

          <p className={`mt-4 flex items-center gap-1.5 text-[15px] font-semibold ${TONE_TEXT[v.tone]}`}>
            <VIcon className="size-4 shrink-0" aria-hidden />
            {v.label}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {dealSentence(a)}
            {breakeven && <span className="text-zinc-600 dark:text-zinc-400"> {breakeven}</span>}
          </p>
          {deal.estimated && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Taxes and insurance are estimated from the price: edit the deal once you know the real numbers.</p>}

          {whatIf && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100 dark:ring-amber-300/25">
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
        </>
      }
    >
      {onChange && !whatIf && <CalcInputs deal={deal} a={a} onChange={onChange} />}
      <DealLedgers deal={deal} a={a} base={base} />
    </SummaryCard>
  );
}
