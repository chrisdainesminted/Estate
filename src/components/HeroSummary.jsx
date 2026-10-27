import { AlertTriangle, CheckCircle2, ExternalLink, Gauge, MapPin, Percent, PiggyBank, Wallet, XCircle } from 'lucide-react';
import { BAND_CLASSES, TONE_CLASSES, verdict } from '../lib/dscr.js';
import { money, percent, ratio, safeHttpUrl } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { Card, DscrChip, signedClass } from './ui.jsx';
import { InfoTip, Num } from './motion.jsx';

const TONE_ICONS = { bad: XCircle, warn: AlertTriangle, good: CheckCircle2 };
const TONE_GLOW = {
  bad: 'from-red-500/30 via-rose-400/10',
  warn: 'from-amber-400/30 via-yellow-300/10',
  good: 'from-emerald-400/35 via-teal-300/10',
};

function MetaPill({ children }) {
  return (
    <span className="tabular inline-flex items-center rounded-full bg-white/50 px-2.5 py-1 text-xs text-zinc-600 ring-1 ring-zinc-950/5 ring-inset dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10">
      {children}
    </span>
  );
}

function Kpi({ icon: Icon, label, short, tip, value, valueClass, sub, base }) {
  return (
    <div className="border-hairline p-5 sm:p-7 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:[&:not(:last-child)]:border-r">
      <dt className="eyebrow flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {/* Phones get a shorter label so it never wraps under the icon. */}
        <span className="truncate sm:hidden">{short ?? label}</span>
        <span className="truncate max-sm:hidden">{label}</span>
        {tip && <InfoTip k={tip} />}
      </dt>
      <dd className={`mt-3 text-[28px] leading-none font-semibold tracking-tight sm:text-[40px] ${valueClass || 'text-zinc-900 dark:text-white'}`}>{value}</dd>
      <dd className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{sub}</dd>
      {base && (
        <dd className="tabular mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Before what-if: <span className="font-medium text-zinc-700 dark:text-zinc-200">{base}</span>
        </dd>
      )}
    </div>
  );
}

export default function HeroSummary({ deal, a, sale, base }) {
  const v = verdict(a);
  const VIcon = TONE_ICONS[v.tone];
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const link = safeHttpUrl(deal.listingUrl);

  return (
    <Card id="sec-summary" className="relative overflow-hidden">
      {/* Ambient glow keyed to the verdict. */}
      <div aria-hidden className={`pointer-events-none absolute -top-40 -right-24 size-[28rem] rounded-full bg-radial ${TONE_GLOW[v.tone]} to-transparent to-70% blur-2xl`} />

      <div className="relative flex flex-wrap items-start justify-between gap-5 px-5 pt-6 sm:px-7 sm:pt-7">
        <div className="min-w-0">
          <p className="eyebrow">{deal.status === 'owned' ? 'Owned property' : 'Deal analysis'}</p>
          <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[34px] sm:leading-tight dark:text-white">{deal.name}</h2>
          {(deal.address || link) && (
            <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
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
                </a>
              )}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {deal.example && <MetaPill>Example deal: edit it or add your own</MetaPill>}
            <MetaPill>{money(a.price)}</MetaPill>
            <MetaPill>
              {type?.key === 'multiplex' ? `Multiplex · ${a.units} units` : type?.label}
            </MetaPill>
            <MetaPill>{Number(deal.downPct)}% down</MetaPill>
            <MetaPill>
              {Number(deal.rate).toFixed(3).replace(/0$/, '')}% · {deal.termYears}-yr
            </MetaPill>
            <MetaPill>{money(a.grossRent)}/mo rent</MetaPill>
            {a.interestOnly && <MetaPill>Interest-only {a.ioYears} yrs</MetaPill>}
            {sale && Number.isFinite(sale.irr) && <MetaPill>{percent(sale.irr, 1)} IRR if sold yr {sale.year}</MetaPill>}
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ring-inset backdrop-blur ${TONE_CLASSES[v.tone]}`}>
          <VIcon className="size-4" aria-hidden />
          {v.label}
        </span>
      </div>

      <dl className="relative mt-6 grid grid-cols-2 border-t border-hairline lg:grid-cols-4">
        <Kpi
          icon={Gauge}
          label="Lender DSCR"
          short="DSCR"
          tip="dscr"
          value={<Num value={a.dscr} format={ratio} />}
          valueClass={BAND_CLASSES[a.status.key].text}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <DscrChip status={a.status} size="sm" />
              <span className="max-sm:hidden">Rent ÷ PITIA</span>
            </span>
          }
          base={base && ratio(base.dscr)}
        />
        <Kpi
          icon={Wallet}
          label="Real net cash flow"
          short="Cash flow"
          tip="netCashFlow"
          value={
            <>
              <Num value={a.netCashFlow} format={(v) => money(v, { signed: true })} />
              <span className="ml-1 text-sm font-medium tracking-normal text-zinc-500 sm:text-base dark:text-zinc-400">/mo</span>
            </>
          }
          valueClass={signedClass(a.netCashFlow)}
          sub={`${money(a.annualCashFlow, { signed: true })}/yr after PITIA + OpEx`}
          base={base && `${money(base.netCashFlow, { signed: true })}/mo`}
        />
        <Kpi
          icon={Percent}
          label="Cash-on-cash"
          short="CoC"
          tip="coc"
          value={<Num value={a.coc} format={(v) => percent(v)} />}
          valueClass={signedClass(a.coc)}
          sub={`On ${money(a.cashInvested)} invested`}
          base={base && percent(base.coc)}
        />
        <Kpi
          icon={PiggyBank}
          label="Cash invested"
          short="Invested"
          tip="cashInvested"
          value={<Num value={a.cashInvested} format={(v) => money(v)} />}
          sub={
            <>
              {money(a.downPayment)} down + {money(a.closingCosts)} closing{a.rehab > 0 && ` + ${money(a.rehab)} rehab`}
              <span className="mt-0.5 block">Plus {money(a.reserves)} reserves to hold</span>
            </>
          }
          base={base && money(base.cashInvested)}
        />
      </dl>

      {a.lenderApprovedButNegative && (
        <div role="alert" className="relative mx-4 mb-4 flex gap-3 rounded-2xl bg-red-500/[0.07] p-4 text-sm text-red-900 ring-1 ring-red-500/20 ring-inset sm:mx-6 sm:mb-6 dark:bg-red-500/10 dark:text-red-100 dark:ring-red-400/20">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-300">
            <AlertTriangle className="size-4" aria-hidden />
          </div>
          <div>
            <p className="font-semibold">Lender-approved, but cash-flow negative.</p>
            <p className="mt-0.5 text-red-800/90 dark:text-red-100/80">
              A {ratio(a.dscr)} DSCR qualifies with the lender, but after management, maintenance, vacancy and CapEx this deal loses{' '}
              <strong className="text-red-900 dark:text-red-100">{money(-a.netCashFlow)}/month</strong> ({money(-a.annualCashFlow)}/year). Rent needs to reach{' '}
              <strong className="text-red-900 dark:text-red-100">{money(a.breakevenRent / a.units)}/unit</strong> to break even.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
