import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, DoorOpen, PiggyBank, Repeat, ShoppingCart, Sprout, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { simulateGrowth } from '../lib/growth.js';
import { chartTheme, niceScale } from '../lib/chartTheme.js';
import { compactMoney, money } from '../lib/format.js';
import { Card, CardHeader, NumberField, Segmented, SelectField, signedClass } from './ui.jsx';
import { CHART_ANIMATE, Num } from './motion.jsx';

const YEARS = 10;

function monthLabel(m) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const yearOf = (m) => new Date().getFullYear() + Math.floor((new Date().getMonth() + m) / 12);

function Kpi({ icon: Icon, label, short, children, sub }) {
  return (
    <div className="border-hairline p-5 sm:p-7 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:[&:not(:last-child)]:border-r">
      <dt className="eyebrow flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate sm:hidden">{short ?? label}</span>
        <span className="truncate max-sm:hidden">{label}</span>
      </dt>
      <dd className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-zinc-900 sm:text-[40px] dark:text-white">{children}</dd>
      <dd className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{sub}</dd>
    </div>
  );
}

function MiniTooltip({ active, payload, fmt, label: title }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <div className="text-zinc-500 dark:text-zinc-400">{monthLabel(r.month)}</div>
      <div className="tabular font-semibold text-zinc-900 dark:text-white">
        {title}: {fmt(payload[0].value)}
      </div>
    </div>
  );
}

/** One measure over the plan, as its own small chart (no shared axes). */
function MiniChart({ data, dataKey, title, fmt, dark, step }) {
  const theme = chartTheme(dark);
  const vals = data.map((d) => d[dataKey]);
  const scale = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  return (
    <div className="min-w-0">
      <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, YEARS * 12]}
              ticks={[0, 24, 48, 72, 96, 120]}
              tickFormatter={(m) => `’${String(yearOf(m)).slice(2)}`}
              tickLine={false}
              axisLine={{ stroke: theme.axis }}
              tick={{ fill: theme.tick, fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={fmt} width={48} domain={scale.domain} ticks={scale.ticks} allowDataOverflow />
            <Tooltip content={<MiniTooltip fmt={fmt} label={title} />} cursor={{ stroke: theme.axis }} />
            <Area
              type={step ? 'stepAfter' : 'monotone'}
              dataKey={dataKey}
              stroke={theme.series[0]}
              strokeWidth={2}
              fill={`url(#fill-${dataKey})`}
              isAnimationActive={CHART_ANIMATE}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PlanView({ owned, deals, plan, onPlan, dark, onOpen }) {
  // Until you pick one, repeat your best prospect by cash-on-cash.
  const bestProspect = deals.filter((x) => x.deal.status !== 'owned').sort((p, q) => q.a.coc - p.a.coc)[0];
  const template = deals.find((x) => x.deal.id === plan.templateId) ?? bestProspect ?? deals[0];
  const sim = useMemo(
    () => simulateGrowth({ owned: owned.map((x) => x.deal), template: template?.deal ?? null, plan, years: YEARS }),
    [owned, template, plan],
  );
  const next = sim.nextPurchase;
  const t = template?.a;
  const doorsAdded = sim.end.doors - sim.start.doors;
  const reached = Number(plan.targetDoors) > 0 && sim.end.doors >= Number(plan.targetDoors);

  const title = !next
    ? 'No purchase in the next 10 years'
    : reached
      ? `${sim.end.doors} doors by ${monthLabel(sim.purchases[sim.purchases.length - 1].month)}`
      : `${sim.end.doors} doors by ${yearOf(YEARS * 12)}`;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-24 size-[28rem] rounded-full bg-radial from-emerald-400/35 via-teal-300/10 to-transparent to-70% blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5 px-5 pt-6 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="eyebrow">Growth plan</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[34px] sm:leading-tight dark:text-white">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Buying “{template?.deal.name ?? 'no deal'}” whenever your cash covers the down payment, closing, rehab and every lender’s reserves. Prices and
              rents move with the deal’s own growth rates.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ring-inset backdrop-blur ${
              next
                ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-300/25'
                : 'bg-amber-400/15 text-amber-800 ring-amber-500/30 dark:text-amber-200 dark:ring-amber-300/25'
            }`}
          >
            <CalendarClock className="size-4" aria-hidden />
            {next ? (next.month === 0 ? 'You can buy now' : `Next purchase ${monthLabel(next.month)}`) : 'Not affordable yet'}
          </span>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 border-t border-hairline lg:grid-cols-4">
          <Kpi icon={ShoppingCart} label="Next purchase" short="Next buy" sub={next ? `${money(next.cashInvested)} in + ${money(next.reserves)} reserves` : 'Add cash or savings, or pick a cheaper deal'}>
            {next ? (next.month === 0 ? 'Now' : `${next.month} mo`) : '—'}
          </Kpi>
          <Kpi icon={DoorOpen} label="Doors in 10 years" short="Doors, yr 10" sub={`${sim.start.doors} today, +${doorsAdded} from ${sim.purchases.length} purchases`}>
            <Num value={sim.end.doors} format={(v) => Math.round(v).toString()} />
          </Kpi>
          <Kpi icon={Wallet} label="Cash flow in 10 years" short="Cash flow, yr 10" sub={`${money(sim.start.monthlyCashFlow, { signed: true })}/mo today`}>
            <span className={signedClass(sim.end.monthlyCashFlow)}>
              <Num value={sim.end.monthlyCashFlow} format={(v) => money(v, { signed: true })} />
              <span className="ml-1 text-sm font-medium tracking-normal text-zinc-400 sm:text-base dark:text-zinc-500">/mo</span>
            </span>
          </Kpi>
          <Kpi icon={PiggyBank} label="Equity in 10 years" short="Equity, yr 10" sub={`${compactMoney(sim.start.equity)} today · ${compactMoney(sim.end.cash)} cash on hand`}>
            <Num value={sim.end.equity} format={(v) => compactMoney(v)} />
          </Kpi>
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card delay={80} className="lg:col-span-4 xl:col-span-3">
          <CardHeader icon={Sprout} title="Your plan" subtitle="Saved with your deals." />
          <div className="grid gap-4 p-6">
            <NumberField id="plan-cash" label="Cash on hand today" prefix="$" value={plan.cashOnHand} onChange={(v) => onPlan({ cashOnHand: v })} step={5000} decimals={0} />
            <NumberField id="plan-save" label="Saved from income each month" prefix="$" suffix="/mo" value={plan.monthlySavings} onChange={(v) => onPlan({ monthlySavings: v })} step={250} decimals={0} />
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Rental cash flow</span>
              <Segmented
                size="sm"
                label="Rental cash flow"
                value={plan.reinvest ? 'reinvest' : 'spend'}
                onChange={(v) => onPlan({ reinvest: v === 'reinvest' })}
                options={[
                  { value: 'reinvest', label: 'Reinvest it' },
                  { value: 'spend', label: 'Spend it' },
                ]}
              />
            </div>
            <SelectField id="plan-template" label="Deal to repeat" value={template?.deal.id ?? ''} onChange={(e) => onPlan({ templateId: e.target.value })}>
              {deals.map((x) => (
                <option key={x.deal.id} value={x.deal.id}>
                  {x.deal.name}
                </option>
              ))}
            </SelectField>
            <NumberField
              id="plan-doors"
              label="Stop at this many doors"
              value={plan.targetDoors}
              onChange={(v) => onPlan({ targetDoors: Math.round(v) })}
              max={1000}
              step={1}
              decimals={0}
              hint="0 means keep buying"
            />
            {t && (
              <div className="grid gap-1.5 rounded-2xl bg-well p-3.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400">Each purchase today</span>
                  <span className="tabular font-semibold text-zinc-900 dark:text-white">{money(t.cashNeeded)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400">Adds per month</span>
                  <span className={`tabular font-semibold ${signedClass(t.netCashFlow)}`}>{money(t.netCashFlow, { signed: true })}</span>
                </div>
                {template.refi && (
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">After its refinance</span>
                    <span className={`tabular font-semibold ${signedClass(template.refi.netCashFlow)}`}>{money(template.refi.netCashFlow, { signed: true })}</span>
                  </div>
                )}
                {template.deal.refiEnabled && (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <Repeat className="size-3.5" aria-hidden /> Refinance cash recycles into the next purchase
                  </div>
                )}
                <button type="button" onClick={() => onOpen(template.deal.id)} className="mt-1 text-left font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                  Open this deal
                </button>
              </div>
            )}
            {t && (t.netCashFlow < 0 || template.refi?.netCashFlow < 0) && (
              <p className="flex gap-2 rounded-2xl bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t.netCashFlow < 0
                  ? 'This deal loses money each month, so every copy shrinks your cash flow and slows the next purchase.'
                  : `After its refinance this deal loses ${money(-template.refi.netCashFlow)}/mo, so every copy drags cash flow down once it refinances. A lower refinance LTV fixes that.`}
              </p>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
          <Card delay={140}>
            <CardHeader icon={Sprout} title="Ten years at a glance" subtitle="Each measure on its own scale. Steps are purchases." />
            <div className="grid gap-6 p-6 md:grid-cols-3">
              <MiniChart data={sim.monthly} dataKey="doors" title="Doors" fmt={(v) => Math.round(v).toString()} dark={dark} step />
              <MiniChart data={sim.monthly} dataKey="monthlyCashFlow" title="Cash flow /mo" fmt={compactMoney} dark={dark} step />
              <MiniChart data={sim.monthly} dataKey="equity" title="Equity" fmt={compactMoney} dark={dark} />
            </div>
          </Card>

          <Card delay={200}>
            <CardHeader icon={ShoppingCart} title="Purchases" subtitle={sim.purchases.length ? `${sim.purchases.length} over ten years.` : 'None yet: cash never covers a purchase plus reserves.'} />
            {sim.purchases.length > 0 && (
              <div className="thin-scroll max-h-96 overflow-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-(--glass-strong) backdrop-blur-xl">
                    <tr className="eyebrow">
                      {['#', 'When', 'Price', 'Cash in', 'Adds /mo', 'Doors after'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 font-medium first:pl-6 last:pr-6 ${i < 2 ? 'text-left' : 'text-right'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {sim.purchases.map((p, i) => (
                      <tr key={i} className="border-t border-hairline text-zinc-700 dark:text-zinc-300">
                        <td className="py-2.5 pr-4 pl-6 text-zinc-500">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-white">{p.month === 0 ? 'Now' : monthLabel(p.month)}</td>
                        <td className="px-4 py-2.5 text-right">{money(p.price)}</td>
                        <td className="px-4 py-2.5 text-right">{money(p.cashInvested)}</td>
                        <td className={`px-4 py-2.5 text-right ${signedClass(p.monthlyCashFlow)}`}>{money(p.monthlyCashFlow, { signed: true })}</td>
                        <td className="py-2.5 pr-6 pl-4 text-right font-semibold text-zinc-900 dark:text-white">{p.doorsAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card delay={260}>
            <CardHeader icon={CalendarClock} title="Year by year" subtitle="End of each year. Reserves are cash you keep but can’t spend." />
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="eyebrow">
                    {['Year', 'Doors', 'Cash flow /mo', 'Equity', 'Cash on hand', 'Reserves held'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-medium first:pl-6 last:pr-6 ${i ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {sim.yearly.map((y) => (
                    <tr key={y.year} className="border-t border-hairline text-zinc-700 dark:text-zinc-300">
                      <td className="py-2.5 pr-4 pl-6 font-medium text-zinc-900 dark:text-white">{y.year === 0 ? 'Today' : yearOf(y.month)}</td>
                      <td className="px-4 py-2.5 text-right">{y.doors}</td>
                      <td className={`px-4 py-2.5 text-right ${signedClass(y.monthlyCashFlow)}`}>{money(y.monthlyCashFlow, { signed: true })}</td>
                      <td className="px-4 py-2.5 text-right">{money(y.equity)}</td>
                      <td className="px-4 py-2.5 text-right">{money(y.cash)}</td>
                      <td className="py-2.5 pr-6 pl-4 text-right">{money(y.reserves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
