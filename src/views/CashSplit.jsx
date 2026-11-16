import { useMemo, useState } from 'react';
import { ArrowRight, Coins, Lock } from 'lucide-react';
import { bestOption, cashOptions } from '../lib/cashSplit.js';
import { unitsOf } from '../lib/market.js';
import { money, percent } from '../lib/format.js';
import { Button, Card, CardHeader, NumberField } from '../components/ui.jsx';
import { PlusOffer, usePlus } from '../components/Plus.jsx';

// Fixed class names, so the stylesheet keeps them.
const COLS = { 1: 'sm:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };
const label = (n) => (n === 0 ? 'Keep it saved' : n === 1 ? 'One home' : `${n === 2 ? 'Two' : 'Three'} homes`);

/**
 * Your cash, compared (Pro): what you have saved, put into one home, or
 * split across two or three, from today's listings in your city. Without
 * Plus, the totals show and the homes behind them stay locked.
 */
export default function CashSplit({ listings, market, place, savings = 0, onAnalyze }) {
  const plus = usePlus();
  const [cash, setCash] = useState(() => (savings > 0 ? Math.round(savings / 1000) * 1000 : 100000));
  const [rate, setRate] = useState(0);
  const options = useMemo(() => cashOptions({ listings, market, cash, savingsPct: Number(rate) || 0 }), [listings, market, cash, rate]);
  const best = bestOption(options);
  const homesOnly = options.filter((o) => o.count > 0);
  const estimated = homesOnly.some((o) => o.homes.some((s) => s.rentSource !== 'stated'));

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Coins className="size-4 text-emerald-600" aria-hidden /> Your cash, compared
          </span>
        }
        subtitle={`One home, or two or three? The best ways to put your cash to work in ${place.name}, from today’s listings, by what each makes you in the first year.`}
      />
      <div className="grid gap-3 border-t border-hairline px-5 py-4 sm:grid-cols-2">
        <NumberField id="split-cash" label="Cash you could invest" value={cash} onChange={(v) => setCash(Math.max(Number(v) || 0, 0))} prefix="$" step={5000} decimals={0} />
        <NumberField
          id="split-rate"
          label="Or keep it saved at (optional)"
          value={rate}
          onChange={(v) => setRate(Math.max(Number(v) || 0, 0))}
          suffix="%"
          step={0.25}
          max={20}
          decimals={2}
          hint="Your savings or GIC rate, to compare (0 leaves it out)"
        />
      </div>

      {homesOnly.length === 0 ? (
        <p className="border-t border-hairline px-5 py-4 text-sm text-zinc-600 dark:text-zinc-400">
          No home in {place.name} today pays for itself with {money(cash)} as 20% down plus closing costs, among listings that give their tax bill. Try more cash, or another city.
        </p>
      ) : (
        <ul className={`grid gap-px border-t border-hairline bg-(--line) sm:grid-cols-2 ${COLS[options.length] ?? 'lg:grid-cols-4'}`}>
          {options.map((o) => {
            const top = o === best;
            return (
              <li key={o.count} className={`bg-(--panel) p-4 ${top ? 'ring-2 ring-emerald-600/70 ring-inset' : ''}`}>
                <p className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {label(o.count)}
                  {top && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white normal-case">Best this year</span>}
                </p>
                <p className="tabular mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{money(o.total)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">first year, {percent(o.returnPct, 1)} on your {money(cash)}</p>
                <dl className="tabular mt-3 grid gap-1 text-sm">
                  {o.count > 0 && (
                    <>
                      <Row name="Cash flow" value={`${money(o.monthly, { signed: true })}/mo`} />
                      <Row name="Paid down by tenants" value={`${money(o.principal)}/yr`} />
                      <Row name="Rental units" value={o.doors} />
                    </>
                  )}
                  {o.interest > 0 && <Row name="Interest on the rest" value={`${money(o.interest)}/yr`} />}
                  <Row name={o.count ? 'Cash left over' : 'Kept saved'} value={money(o.left)} />
                </dl>
                {o.count > 0 &&
                  (plus.active ? (
                    <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-sm">
                      {o.homes.map((s) => (
                        <li key={s.listing.id}>
                          <button type="button" onClick={() => onAnalyze?.(s.listing)} className="group w-full text-left">
                            <span className="block truncate font-medium text-zinc-950 group-hover:underline dark:text-white">{s.listing.address}</span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                              {money(s.a.price)} · {unitsOf(s.listing) === 1 ? 'house' : `${unitsOf(s.listing)} units`} · {money(s.a.netCashFlow, { signed: true })}/mo
                              {s.rentSource === 'stated' ? '' : ' · rent estimated'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <Lock className="size-3.5" aria-hidden /> Which {o.count === 1 ? 'home' : `${o.count} homes`}: with Plus
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      {!plus.active && homesOnly.length > 0 && (
        <div className="border-t border-hairline p-4">
          <PlusOffer feature="split" compact />
        </div>
      )}

      <div className="space-y-1.5 border-t border-hairline px-5 py-4 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          Each home bought as a rental: 20% down at a bank’s 5-year fixed rate, with land transfer tax and closing costs in the cash. Only homes that give their real tax bill and
          leave at least $0 a month after the mortgage and every cost. The first year counts the cash flow and the mortgage your tenants pay down; not price changes, which nobody
          can promise.
        </p>
        {estimated && <p>Most rents here are estimates from {place.name}’s average asking rents, not the listing: check each one before you rely on it.</p>}
        <p>
          More homes means more mortgages: a lender has to approve each one on your income and credit, and two or three vacancies or repairs can land in the same month. Keep a
          cushion.
        </p>
        {plus.active && homesOnly.length > 0 && (
          <Button variant="ghost" className="-ml-2 px-2" onClick={() => onAnalyze?.(best?.homes?.[0]?.listing)} disabled={!best?.homes?.length}>
            Open the best option’s first home <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
}

function Row({ name, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-600 dark:text-zinc-400">{name}</dt>
      <dd className="font-semibold text-zinc-950 dark:text-white">{value}</dd>
    </div>
  );
}
