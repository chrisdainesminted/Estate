import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Briefcase, Building, CheckCircle2, LineChart, ShoppingCart, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { estimateToday, portfolioSummary } from '../lib/finance.js';
import { BAND_CLASSES, TONE_CLASSES, verdict } from '../lib/dscr.js';
import { chartTheme } from '../lib/chartTheme.js';
import { cocMeaning, equityMeaning, portfolioCashMeaning, portfolioDscrMeaning } from '../lib/explain.js';
import { compactMoney, money, percent, ratio } from '../lib/format.js';
import { Button, Card, CardHeader, DscrChip, ExampleTag, KpiTile, SelectField, Stat, signedClass } from './ui.jsx';
import { CHART_ANIMATE, InfoTip, Num } from './motion.jsx';
import { Section } from './Section.jsx';

const POS = { light: '#059669', dark: '#34d399' };
const NEG = { light: '#dc2626', dark: '#f87171' };

function CashFlowTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="glass-strong rounded-2xl p-3.5 text-xs">
      <div className="mb-1 font-semibold text-zinc-900 dark:text-white">{r.name}</div>
      <div className="tabular flex justify-between gap-6 text-zinc-600 dark:text-zinc-300">
        <span>Net cash flow</span>
        <span className={`font-semibold ${signedClass(r.cf)}`}>{money(r.cf, { signed: true })}/mo</span>
      </div>
      <div className="tabular flex justify-between gap-6 text-zinc-600 dark:text-zinc-300">
        <span>DSCR</span>
        <span className="font-medium text-zinc-900 dark:text-white">{ratio(r.dscr)}</span>
      </div>
    </div>
  );
}

function useNarrow() {
  const query = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

/** Best and worst property by today's cash flow, in one sentence. */
function cashFlowRanking(owned) {
  const ranked = owned.map((x) => ({ name: x.deal.name, cf: estimateToday(x.deal).netCashFlow })).sort((p, q) => q.cf - p.cf);
  if (!ranked.length) return null;
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const each = (r) => `${money(r.cf, { signed: true })}/mo`;
  if (ranked.length === 1) return `${best.name}: ${each(best)} after the loan payment and running costs.`;
  return `${best.name} brings in the most (${each(best)}); ${worst.name} the least (${each(worst)}).`;
}

function CashFlowChart({ owned, dark, onOpen }) {
  const theme = chartTheme(dark);
  const narrow = useNarrow();
  const nameWidth = narrow ? 96 : 150;
  const maxChars = narrow ? 13 : 22;
  const mode = dark ? 'dark' : 'light';
  const data = [...owned]
    .map((x) => ({ x, now: estimateToday(x.deal) }))
    .sort((p, q) => q.now.netCashFlow - p.now.netCashFlow)
    .map(({ x, now }) => ({ id: x.deal.id, name: x.deal.name, cf: now.netCashFlow, dscr: now.dscr }));
  const minHeight = Math.max(data.length * 46 + 36, 200);

  // Grows to fill the card when the neighbouring card is taller.
  return (
    <div className="h-full" style={{ minHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={theme.grid} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={compactMoney} />
          <YAxis
            type="category"
            dataKey="name"
            width={nameWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.tick, fontSize: narrow ? 11 : 12 }}
            tickFormatter={(n) => (n.length > maxChars ? `${n.slice(0, maxChars - 1)}…` : n)}
          />
          <ReferenceLine x={0} stroke={theme.zero} />
          <Tooltip content={<CashFlowTooltip />} cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(9,9,11,0.03)' }} />
          <Bar dataKey="cf" maxBarSize={22} radius={[0, 4, 4, 0]} isAnimationActive={CHART_ANIMATE} animationDuration={700} onClick={(d) => onOpen(d.id)} className="cursor-pointer">
            {data.map((d) => (
              <Cell key={d.id} fill={d.cf >= 0 ? POS[mode] : NEG[mode]} radius={d.cf >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]} />
            ))}
            <LabelList
              dataKey="cf"
              position="right"
              formatter={(v) => `${money(v, { signed: true })}/mo`}
              style={{ fill: theme.tick, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ImpactRow({ label, tip, before, after, fmt, betterWhen = 'higher' }) {
  const d = after - before;
  const good = betterWhen === 'higher' ? d > 1e-9 : d < -1e-9;
  const bad = betterWhen === 'higher' ? d < -1e-9 : d > 1e-9;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline py-2.5 text-sm first:border-t-0">
      <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
        {label}
        {tip && <InfoTip k={tip} />}
      </span>
      <span className="tabular flex items-center gap-2">
        <span className="text-zinc-500 dark:text-zinc-400">{fmt(before)}</span>
        <ArrowRight className="size-3.5 text-zinc-400" aria-hidden />
        <span className={`font-semibold ${good ? 'text-emerald-700 dark:text-emerald-400' : bad ? 'text-red-700 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
          {fmt(after)}
        </span>
      </span>
    </div>
  );
}

function ImpactCard({ owned, prospects, onOpen, onMarkOwned }) {
  const [pickId, setPickId] = useState(prospects[0]?.deal.id);
  const pick = prospects.find((x) => x.deal.id === pickId) ?? prospects[0];
  const before = useMemo(() => portfolioSummary(owned), [owned]);
  const after = useMemo(() => (pick ? portfolioSummary([...owned, pick]) : null), [owned, pick]);

  return (
    <Section
      id="pf-impact"
      icon={ShoppingCart}
      title="What if you buy it?"
      meaning={
        pick
          ? `Buying “${pick.deal.name}” would move your monthly cash flow from ${money(before.netCashFlow, { signed: true })} to ${money(after.netCashFlow, { signed: true })}.`
          : 'Add a prospect to see how buying it would change your totals.'
      }
      subtitle="See how a prospect changes the whole portfolio."
    >
      {!pick ? (
        <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Add a prospect from the deal menu to see its impact here.</p>
      ) : (
        <div className="flex flex-1 flex-col p-6">
          <SelectField id="impact-pick" label="Prospect" value={pick.deal.id} onChange={(e) => setPickId(e.target.value)}>
            {prospects.map((x) => (
              <option key={x.deal.id} value={x.deal.id}>
                {x.deal.name}
              </option>
            ))}
          </SelectField>

          <p className="mt-4 rounded-2xl bg-well p-3.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Buying <strong className="text-zinc-900 dark:text-white">{pick.deal.name}</strong>{' '}
            {pick.a.netCashFlow >= 0 ? 'adds' : 'takes'}{' '}
            <strong className={signedClass(pick.a.netCashFlow)}>{money(Math.abs(pick.a.netCashFlow))}/mo</strong>{' '}
            {pick.a.netCashFlow >= 0 ? 'to' : 'from'} your cash flow and needs{' '}
            <strong className="text-zinc-900 dark:text-white">{money(pick.a.cashNeeded)}</strong> available, including {money(pick.a.reserves)} of lender
            reserves.
          </p>

          <div className="mt-4">
            <ImpactRow label="Net cash flow /mo" tip="netCashFlow" before={before.netCashFlow} after={after.netCashFlow} fmt={(v) => money(v, { signed: true })} />
            <ImpactRow label="Global DSCR" tip="globalDscr" before={before.dscr} after={after.dscr} fmt={ratio} />
            <ImpactRow label="Cash-on-cash" tip="coc" before={before.coc} after={after.coc} fmt={(v) => percent(v)} />
            <ImpactRow label="Doors" before={before.units} after={after.units} fmt={String} />
            <ImpactRow label="10-yr projected equity" tip="equity" before={before.year10Equity} after={after.year10Equity} fmt={compactMoney} />
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button variant="primary" onClick={() => onMarkOwned(pick.deal.id)}>
              <CheckCircle2 className="size-4" aria-hidden /> I bought it
            </Button>
            <Button onClick={() => onOpen(pick.deal.id)}>Open deal</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function PropertiesTable({ owned, onOpen }) {
  return (
    <Card delay={240}>
      <CardHeader icon={Building} title="Properties" subtitle="Click a property to open its full analysis." />
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="eyebrow">
              {['Property', 'Doors', 'Rent /mo', 'PITIA', 'Net cash flow', 'DSCR', 'Cash-on-cash', 'Equity today', 'Verdict'].map((h, i) => (
                <th key={h} className={`px-4 py-3 font-medium first:pl-6 last:pr-6 ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {owned.map((x) => {
              const today = estimateToday(x.deal);
              // Verdict on today's numbers: the payment may have changed since purchase.
              const v = verdict({ ...x.a, netCashFlow: today.netCashFlow, status: today.status, lenderApprovedButNegative: today.lenderApprovedButNegative });
              const coc = x.a.cashInvested > 0 ? (today.netCashFlow * 12) / x.a.cashInvested : 0;
              return (
                <tr key={x.deal.id} className="border-t border-hairline transition hover:bg-zinc-950/[0.025] dark:hover:bg-white/[0.03]">
                  <td className="py-3 pr-4 pl-6">
                    <button type="button" onClick={() => onOpen(x.deal.id)} className="text-left font-medium text-zinc-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300">
                      {x.deal.name}
                    </button>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Owned {Number(x.deal.yearsOwned) || 0} {Number(x.deal.yearsOwned) === 1 ? 'year' : 'years'}
                      {x.deal.example && <ExampleTag />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{x.a.units}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{money(x.a.grossRent)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{money(today.pitia)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${signedClass(today.netCashFlow)}`}>{money(today.netCashFlow, { signed: true })}</td>
                  <td className="px-4 py-3 text-right">
                    <DscrChip status={today.status} dscr={today.dscr} size="sm" />
                  </td>
                  <td className={`px-4 py-3 text-right ${signedClass(coc)}`}>{percent(coc)}</td>
                  <td className="px-4 py-3 text-right text-zinc-900 dark:text-white">{money(today.equity)}</td>
                  <td className="py-3 pr-6 pl-4 text-right">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${TONE_CLASSES[v.tone]}`}>{v.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function PortfolioView({ owned, prospects, dark, onOpen, onMarkOwned }) {
  const p = useMemo(() => portfolioSummary(owned), [owned]);

  if (!owned.length) {
    return (
      <Card className="relative overflow-hidden p-8 text-center sm:p-14">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20 dark:text-emerald-300">
          <Briefcase className="size-6" aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">No owned properties yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Set a deal’s status to <strong>Owned</strong> in its inputs and it rolls up here: combined cash flow, global DSCR, equity, and what each new purchase
          would do to the whole portfolio.
        </p>
        {prospects[0] && (
          <Button variant="primary" className="mt-6" onClick={() => onMarkOwned(prospects[0].deal.id)}>
            Mark “{prospects[0].deal.name}” as owned
          </Button>
        )}
      </Card>
    );
  }

  const tone = p.negative > 0 ? 'bad' : p.status.key === 'tight' ? 'warn' : 'good';
  const ToneIcon = tone === 'good' ? CheckCircle2 : XCircle;
  const badge =
    p.negative > 0 ? `${p.negative} of ${p.properties} losing money` : tone === 'warn' ? 'All cash flowing, DSCR tight' : 'Every property cash flows';

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-40 -right-24 size-[28rem] rounded-full bg-radial ${
            tone === 'bad' ? 'from-red-500/25 via-rose-400/10' : 'from-emerald-400/35 via-teal-300/10'
          } to-transparent to-70% blur-2xl`}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5 px-5 pt-6 sm:px-7 sm:pt-7">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[34px] sm:leading-tight dark:text-white">
              {p.properties} {p.properties === 1 ? 'property' : 'properties'} · {p.units} doors
            </h2>
            <p className="tabular mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Est. value {money(p.value)} · loans {money(p.debt)} · {percent(p.ltv, 0)} LTV
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ring-inset backdrop-blur ${TONE_CLASSES[tone]}`}>
            <ToneIcon className="size-4" aria-hidden />
            {badge}
          </span>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 border-t border-hairline lg:grid-cols-4">
          <KpiTile
            label="Monthly cash flow"
            tip="netCashFlow"
            value={
              <>
                <Num value={p.netCashFlow} format={(v) => money(v, { signed: true })} />
                <span className="ml-1 text-sm font-medium tracking-normal text-zinc-500 dark:text-zinc-400">/mo</span>
              </>
            }
            valueClass={signedClass(p.netCashFlow)}
            meaning={portfolioCashMeaning(p)}
          />
          <KpiTile
            label="Lender check (DSCR)"
            tip="globalDscr"
            value={<Num value={p.dscr} format={ratio} />}
            valueClass={BAND_CLASSES[p.status.key].text}
            extra={
              <dd className="mt-2">
                <DscrChip status={p.status} size="sm" />
              </dd>
            }
            meaning={portfolioDscrMeaning(p)}
          />
          <KpiTile label="Cash-on-cash return" tip="coc" value={<Num value={p.coc} format={(v) => percent(v)} />} valueClass={signedClass(p.coc)} meaning={cocMeaning(p)} />
          <KpiTile
            label="Equity today"
            tip="equity"
            value={<Num value={p.equity} format={(v) => money(v)} />}
            meaning={`${equityMeaning(p)} Projected ${compactMoney(p.year10Equity)} in 10 years.`}
          />
        </dl>
      </Card>

      <PropertiesTable owned={owned} onOpen={onOpen} />

      <div className="space-y-3">
        <Section id="pf-cashflow" icon={LineChart} title="Cash flow by property" meaning={cashFlowRanking(owned)} subtitle="Monthly, after the loan payment and running costs. Tap a bar to open that property.">
          <div className="p-6">
            <CashFlowChart owned={owned} dark={dark} onOpen={onOpen} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-hairline px-6 py-5 sm:grid-cols-4">
            <Stat label="Monthly rent" value={money(p.grossRent)} sub={`${money(p.pitia)} PITIA`} tip="pitia" />
            <Stat label="Operating costs" value={money(p.opex)} sub="per month" tip="opex" />
            <Stat label="Reserves to hold" value={money(p.reserves)} sub="lender requirement" tip="reserves" />
            <Stat label="If all sold in 10 yrs" value={money(p.year10Proceeds)} sub="cash after costs and payoffs" tip="saleProceeds" />
          </div>
        </Section>
        <ImpactCard owned={owned} prospects={prospects} onOpen={onOpen} onMarkOwned={onMarkOwned} />
      </div>
    </div>
  );
}
