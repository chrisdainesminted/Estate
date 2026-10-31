import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, Repeat } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { simulateGrowth } from '../lib/growth.js';
import { chartTheme, niceScale } from '../lib/chartTheme.js';
import { compactMoney, money } from '../lib/format.js';
import { Card, CardHeader, LedgerLine, NumberField, Segmented, SelectField, SummaryCard, ViewHeader, signedClass } from './ui.jsx';
import { CHART_ANIMATE } from './motion.jsx';
import { Section, SectionGroup } from './Section.jsx';

const YEARS = 10;

function monthLabel(m) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const yearOf = (m) => new Date().getFullYear() + Math.floor((new Date().getMonth() + m) / 12);

/** "Aug 2028, Feb 2032 and Nov 2035", or the first few and a count. */
function whenList(purchases) {
  const names = purchases.map((p) => (p.month === 0 ? 'now' : monthLabel(p.month)));
  const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
}

function MiniTooltip({ active, payload, fmt, label: title }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="popover rounded-xl px-3 py-2 text-xs">
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
      <ViewHeader title="Growth plan">
        Buying “{template?.deal.name ?? 'no deal'}” again whenever your cash covers the next one.
      </ViewHeader>

      <SummaryCard
        head={
          <>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">{title}</h3>
            <p className={`mt-4 flex items-center gap-1.5 text-[15px] font-semibold ${next ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              {next ? (next.month === 0 ? 'You can buy the next one now' : `Next purchase ${monthLabel(next.month)}`) : 'Not affordable yet'}
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {next
                ? `That’s when your cash first covers it: ${money(next.cashInvested)} to buy, plus ${money(next.reserves)} kept for the lender.`
                : 'Your cash never covers another purchase. Add cash or savings, or pick a cheaper deal.'}
            </p>
          </>
        }
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full max-w-2xl text-sm">
            <caption className="sr-only">Your rentals today and in {YEARS} years</caption>
            <thead>
              <tr className="caption border-b border-hairline">
                <th scope="col" className="py-2 text-left font-medium">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">Today</th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">In {YEARS} years</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[
                ['Doors', sim.start.doors, sim.end.doors, String],
                ['Cash flow a month', sim.start.monthlyCashFlow, sim.end.monthlyCashFlow, (v) => money(v, { signed: true }), true],
                ['Equity', sim.start.equity, sim.end.equity, compactMoney],
                ['Cash on hand', sim.start.cash, sim.end.cash, compactMoney],
              ].map(([label, now, later, fmt, signed]) => (
                <tr key={label} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className="py-2 text-left font-normal text-zinc-700 dark:text-zinc-300">
                    {label}
                  </th>
                  <td className={`py-2 pl-4 text-right ${signed ? signedClass(now) : 'text-zinc-700 dark:text-zinc-300'}`}>{fmt(now)}</td>
                  <td className={`py-2 pl-4 text-right font-semibold ${signed ? signedClass(later) : 'text-zinc-950 dark:text-white'}`}>{fmt(later)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {doorsAdded} more {doorsAdded === 1 ? 'door' : 'doors'} from {sim.purchases.length} {sim.purchases.length === 1 ? 'purchase' : 'purchases'}.
          </p>
        </div>
      </SummaryCard>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card delay={80} className="lg:col-span-4 xl:col-span-3">
          <CardHeader title="Your plan" subtitle="Saved with your deals." />
          <div className="grid gap-4 p-5">
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
              <div className="text-sm">
                <LedgerLine label="Each purchase today" value={money(t.cashNeeded)} />
                <LedgerLine label="Adds per month" value={money(t.netCashFlow, { signed: true })} valueClass={signedClass(t.netCashFlow)} />
                {template.refi && (
                  <LedgerLine label="After its refinance" value={money(template.refi.netCashFlow, { signed: true })} valueClass={signedClass(template.refi.netCashFlow)} />
                )}
                {template.deal.refiEnabled && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <Repeat className="size-3.5" aria-hidden /> Refinance cash recycles into the next purchase
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onOpen(template.deal.id)}
                  className="mt-2 rounded text-left text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
                >
                  Open this deal
                </button>
              </div>
            )}
            {t && (t.netCashFlow < 0 || template.refi?.netCashFlow < 0) && (
              <p className="flex gap-2 rounded-md bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t.netCashFlow < 0
                  ? 'This deal loses money each month, so every copy shrinks your cash flow and slows the next purchase.'
                  : `After its refinance this deal loses ${money(-template.refi.netCashFlow)}/mo, so every copy drags cash flow down once it refinances. A lower refinance LTV fixes that.`}
              </p>
            )}
          </div>
        </Card>

        <SectionGroup className="min-w-0 self-start lg:col-span-8 xl:col-span-9">
          <Section id="plan-charts" title="Ten years at a glance" meaning="Doors, monthly cash flow and equity, month by month. Each step up is a purchase." subtitle="Each measure is on its own scale.">
            <div className="grid gap-6 p-5 md:grid-cols-3">
              <MiniChart data={sim.monthly} dataKey="doors" title="Doors" fmt={(v) => Math.round(v).toString()} dark={dark} step />
              <MiniChart data={sim.monthly} dataKey="monthlyCashFlow" title="Cash flow /mo" fmt={compactMoney} dark={dark} step />
              <MiniChart data={sim.monthly} dataKey="equity" title="Equity" fmt={compactMoney} dark={dark} />
            </div>
          </Section>

          <Section
            id="plan-purchases"
            title="Purchases"
            value={sim.purchases.length ? `${sim.purchases.length} in ten years` : null}
            meaning={
              sim.purchases.length
                ? `${whenList(sim.purchases).replace(/^./, (c) => c.toUpperCase())}: each bought as soon as your cash covers it.`
                : 'None yet: your cash never covers a purchase plus the lender’s reserves.'
            }
          >
            {sim.purchases.length > 0 && (
              <div tabIndex={0} role="region" aria-label="Purchases table" className="thin-scroll max-h-96 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-(--panel)">
                    <tr className="caption">
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
          </Section>

          <Section
            id="plan-years"
            title="Year by year"
            meaning="Doors, cash flow, equity and cash at the end of each year. Reserves are cash you keep but can’t spend."
          >
            <div tabIndex={0} role="region" aria-label="Year-by-year table" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="caption">
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
          </Section>
        </SectionGroup>
      </div>
    </div>
  );
}
