import { useMemo, useState } from 'react';
import { AlertTriangle, Columns3, Gauge, LayoutDashboard, Moon, Plus, RotateCcw, Sun } from 'lucide-react';
import { useDeals } from './hooks/useDeals.js';
import { useTheme } from './hooks/useTheme.js';
import { analyzeDeal, applyAdjustments, isNeutralAdjustment, projectDeal } from './lib/finance.js';
import { chartTheme } from './lib/chartTheme.js';
import { money, ratio } from './lib/format.js';
import { MAX_DEALS } from './lib/presets.js';
import SummaryCards from './components/SummaryCards.jsx';
import DscrGauge from './components/DscrGauge.jsx';
import InputsPanel from './components/InputsPanel.jsx';
import LenderVsReality from './components/LenderVsReality.jsx';
import SensitivitySliders from './components/SensitivitySliders.jsx';
import ComparisonMatrix from './components/ComparisonMatrix.jsx';
import ProjectionChart from './components/ProjectionChart.jsx';
import Logo from './components/Logo.jsx';
import { Button, Card, CardHeader, Segmented } from './components/ui.jsx';

const NO_ADJ = { rateDelta: 0, downPct: null, rentPct: 0 };
const YEARS = 10;

function TrapBanner({ a }) {
  if (!a.lenderApprovedButNegative) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
      <div>
        <p className="font-semibold">Lender-approved, but cash-flow negative.</p>
        <p className="mt-0.5">
          A DSCR of {ratio(a.dscr)} qualifies with the lender, but after management, maintenance, vacancy and CapEx this deal loses{' '}
          <strong>{money(-a.netCashFlow)}/month</strong> ({money(-a.annualCashFlow)}/year). Rent needs to reach{' '}
          <strong>{money(a.breakevenRent / a.units)}/unit</strong> just to break even.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { deals, active, activeId, updateDeal, updateAll, addDeal, duplicateDeal, removeDeal, setActive, resetAll } = useDeals();
  const { dark, toggle } = useTheme();
  const [view, setView] = useState('analyze');
  const [adj, setAdj] = useState(NO_ADJ);
  const [scope, setScope] = useState('active');

  const neutral = isNeutralAdjustment(adj);
  const effectiveScope = deals.length > 1 ? scope : 'active';

  const items = useMemo(
    () =>
      deals.map((d) => {
        const adjusted = !neutral && (effectiveScope === 'all' || d.id === activeId);
        const deal = adjusted ? applyAdjustments(d, adj) : d;
        return { deal, a: analyzeDeal(deal), rows: projectDeal(deal, YEARS), adjusted };
      }),
    [deals, adj, neutral, effectiveScope, activeId],
  );

  const current = items.find((x) => x.deal.id === activeId) ?? items[0];
  const baseA = useMemo(() => analyzeDeal(active), [active]);
  const a = current.a;

  const applyWhatIf = () => {
    const commit = (d) => {
      const e = applyAdjustments(d, adj);
      return { rate: Math.round(e.rate * 1000) / 1000, downPct: e.downPct, rentPerUnit: Math.round(e.rentPerUnit) };
    };
    if (effectiveScope === 'all') updateAll(commit);
    else updateDeal(active.id, commit(active));
    setAdj(NO_ADJ);
  };

  const theme = chartTheme(dark);

  const sliders = (
    <SensitivitySliders
      deal={active}
      adj={adj}
      setAdj={setAdj}
      scope={effectiveScope}
      setScope={setScope}
      base={baseA}
      what={a}
      onApply={applyWhatIf}
      dealCount={deals.length}
    />
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <h1>
            <Logo />
          </h1>

          <nav aria-label="Deals" className="order-3 flex w-full items-center gap-1.5 overflow-x-auto md:order-none md:w-auto md:flex-1 md:justify-center">
            {deals.map((d) => {
              const x = items.find((i) => i.deal.id === d.id);
              const selected = d.id === activeId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActive(d.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ background: theme.series[d.slot] }} aria-hidden />
                  <span className="max-w-40 truncate">{d.name}</span>
                  <span className={`tabular text-xs ${selected ? 'opacity-70' : 'text-zinc-500 dark:text-zinc-400'}`}>{ratio(x.a.dscr)}</span>
                </button>
              );
            })}
            {deals.length < MAX_DEALS && (
              <button
                type="button"
                onClick={addDeal}
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-zinc-500 ring-1 ring-zinc-300 ring-inset hover:bg-zinc-100 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Add deal"
              >
                <Plus className="size-4" aria-hidden /> Add
              </button>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'analyze', label: 'Analyze', icon: LayoutDashboard },
                { value: 'compare', label: 'Compare', icon: Columns3 },
              ]}
            />
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('Replace all deals with the three starter examples?')) {
                  resetAll();
                  setAdj(NO_ADJ);
                }
              }}
              aria-label="Reset to example deals"
              title="Reset to example deals"
            >
              <RotateCcw className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
              {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
        {view === 'analyze' ? (
          <>
            <SummaryCards a={a} base={neutral ? null : baseA} />
            <TrapBanner a={a} />

            <div className="grid gap-6 lg:grid-cols-12">
              <aside className="lg:col-span-4 xl:col-span-3">
                <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-2xl">
                  <InputsPanel deal={active} a={baseA} onChange={(patch) => updateDeal(active.id, patch)} />
                </div>
              </aside>

              <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
                <div className="grid gap-6 xl:grid-cols-3">
                  <Card className="xl:col-span-1">
                    <CardHeader icon={Gauge} title="Lender DSCR" subtitle="Gross rent ÷ PITIA" />
                    <div className="p-5">
                      <DscrGauge a={a} />
                    </div>
                  </Card>
                  <div className="xl:col-span-2">{sliders}</div>
                </div>
                <LenderVsReality a={a} />
                <ProjectionChart rows={current.rows} a={a} dark={dark} appreciationPct={Number(current.deal.appreciationPct)} />
              </div>
            </div>
          </>
        ) : (
          <>
            {sliders}
            <ComparisonMatrix
              items={items}
              activeId={activeId}
              adjusted={!neutral}
              dark={dark}
              onAdd={addDeal}
              onDuplicate={duplicateDeal}
              onRemove={removeDeal}
              onEdit={(id) => {
                setActive(id);
                setView('analyze');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}

        <footer className="pt-2 pb-8 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Keystone</span> · DSCR = gross monthly rent ÷ PITIA (principal, interest, taxes, insurance, HOA). Real net cash flow also subtracts management,
          maintenance, vacancy and CapEx reserves. Cash out of pocket = down payment + closing costs. Projections assume a fixed-rate loan;
          figures are estimates for personal analysis, not lending or investment advice. Deals are saved in this browser only.
        </footer>
      </main>
    </div>
  );
}
