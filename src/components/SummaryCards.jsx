import { Gauge, PiggyBank, Percent, Wallet } from 'lucide-react';
import { BAND_CLASSES } from '../lib/dscr.js';
import { money, percent, ratio } from '../lib/format.js';
import { Card, DscrChip, signedClass } from './ui.jsx';

function Tile({ icon: Icon, label, value, valueClass = '', sub, base, accent }) {
  return (
    <Card className="relative overflow-hidden p-4">
      {accent && <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} aria-hidden />}
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${valueClass || 'text-zinc-900 dark:text-zinc-100'}`}>{value}</div>
      <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>
      {base && (
        <div className="tabular mt-2 border-t border-dashed border-zinc-200 pt-2 text-[11px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Before what-if: <span className="font-medium text-zinc-700 dark:text-zinc-300">{base}</span>
        </div>
      )}
    </Card>
  );
}

export default function SummaryCards({ a, base }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={Gauge}
        label="Lender DSCR"
        value={ratio(a.dscr)}
        valueClass={BAND_CLASSES[a.status.key].text}
        accent={BAND_CLASSES[a.status.key].bar}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <DscrChip status={a.status} size="sm" />
            <span>Rent ÷ PITIA</span>
          </span>
        }
        base={base && ratio(base.dscr)}
      />
      <Tile
        icon={Wallet}
        label="Real Net Cash Flow"
        value={
          <>
            {money(a.netCashFlow, { signed: true })}
            <span className="ml-1 text-base font-medium text-zinc-400 dark:text-zinc-500">/mo</span>
          </>
        }
        valueClass={signedClass(a.netCashFlow)}
        sub={`${money(a.annualCashFlow, { signed: true })} per year after PITIA + OpEx`}
        base={base && `${money(base.netCashFlow, { signed: true })}/mo`}
      />
      <Tile
        icon={Percent}
        label="Cash-on-Cash Return"
        value={percent(a.coc)}
        valueClass={signedClass(a.coc)}
        sub={`Annual cash flow ÷ ${money(a.cashToClose)} invested`}
        base={base && percent(base.coc)}
      />
      <Tile
        icon={PiggyBank}
        label="Total Cash Out of Pocket"
        value={money(a.cashToClose)}
        sub={`${money(a.downPayment)} down + ${money(a.closingCosts)} closing`}
        base={base && money(base.cashToClose)}
      />
    </div>
  );
}
