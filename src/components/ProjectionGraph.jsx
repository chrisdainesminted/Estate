import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactMoney, money } from '../lib/format.js';
import { signedClass } from './ui.jsx';
import { CHART_ANIMATE } from './motion.jsx';

// The chart library loads with this file, only once someone opens the outlook.

function ProjectionTooltip({ active, payload, label, theme, series }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="popover min-w-56 rounded-2xl p-3.5 text-xs">
      <div className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Year {label}</div>
      {series.map((s, i) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="size-2.5 rounded-sm" style={{ background: theme.series[i] }} aria-hidden />
            {s.label}
          </span>
          <span className="tabular font-medium text-zinc-900 dark:text-zinc-100">{money(row[s.key], { signed: true })}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-hairline pt-1.5">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="h-0.5 w-3 rounded-full" style={{ background: theme.total }} aria-hidden />
          Total return
        </span>
        <span className="tabular font-semibold text-zinc-900 dark:text-zinc-100">{money(row.totalReturn, { signed: true })}</span>
      </div>
      <div className="tabular mt-1.5 flex justify-between gap-4 text-zinc-500 dark:text-zinc-400">
        <span>If sold this year</span>
        <span className={`font-medium ${signedClass(row.profitIfSold)}`}>{money(row.profitIfSold, { signed: true })}</span>
      </div>
    </div>
  );
}

/** The stacked wealth chart: cash flow, paydown and appreciation each year, with the total as a line. */
export default function ProjectionGraph({ data, series, scale, theme, dark }) {
  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300" aria-label="Legend">
        {series.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: theme.series[i] }} aria-hidden />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: theme.total }} aria-hidden />
          Total return
        </li>
      </ul>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: theme.axis }} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={(y) => `Y${y}`} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.tick, fontSize: 11 }}
              tickFormatter={compactMoney}
              width={56}
              domain={scale.domain}
              ticks={scale.ticks}
              allowDataOverflow
            />
            <ReferenceLine y={0} stroke={theme.zero} />
            <Tooltip content={<ProjectionTooltip theme={theme} series={series} />} cursor={{ fill: dark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="wealth"
                fill={theme.series[i]}
                stroke={theme.surface}
                strokeWidth={2}
                maxBarSize={28}
                radius={s.key === 'cumAppreciation' ? [2, 2, 0, 0] : 0}
                isAnimationActive={CHART_ANIMATE} animationDuration={700}
              />
            ))}
            <Line
              dataKey="totalReturn"
              type="monotone"
              stroke={theme.total}
              strokeWidth={2}
              dot={{ r: 4, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
              isAnimationActive={CHART_ANIMATE} animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
