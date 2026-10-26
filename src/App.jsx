import { useMemo, useState } from 'react';
import { Columns3, Gauge, LayoutDashboard, Moon, Plus, RotateCcw, Sun } from 'lucide-react';
import { useDeals } from './hooks/useDeals.js';
import { useTheme } from './hooks/useTheme.js';
import { analyzeDeal, applyAdjustments, isNeutralAdjustment, projectDeal } from './lib/finance.js';
import { chartTheme } from './lib/chartTheme.js';
import { ratio } from './lib/format.js';
import { MAX_DEALS } from './lib/presets.js';
import HeroSummary from './components/HeroSummary.jsx';
import DscrGauge from './components/DscrGauge.jsx';
import InputsPanel from './components/InputsPanel.jsx';
import LenderVsReality from './components/LenderVsReality.jsx';
import SensitivitySliders from './components/SensitivitySliders.jsx';
import ComparisonMatrix from './components/ComparisonMatrix.jsx';
import ProjectionChart from './components/ProjectionChart.jsx';
import Logo, { LogoMark } from './components/Logo.jsx';
import { Button, Card, CardHeader, Segmented } from './components/ui.jsx';

const NO_ADJ = { rateDelta: 0, downPct: null, rentPct: 0 };
const YEARS = 10;

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
    <div className="relative min-h-screen">
      <div aria-hidden className="app-backdrop">
        <div className="app-grid" />
        <div className="app-grain" />
      </div>

      <header className="relative z-30 px-3 pt-3 sm:px-6 md:sticky md:top-0">
        <div className="glass mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-3 py-2.5 sm:px-4">
          <h1>
            <Logo />
          </h1>

          <nav aria-label="Deals" className="thin-scroll order-3 -mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 md:order-none md:mx-0 md:w-auto md:flex-1 md:justify-center">
            {deals.map((d) => {
              const x = items.find((i) => i.deal.id === d.id);
              const selected = d.id === activeId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActive(d.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    selected
                      ? 'bg-zinc-950 text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)] dark:bg-white dark:text-zinc-950'
                      : 'bg-white/50 text-zinc-700 ring-1 ring-zinc-950/5 ring-inset hover:bg-white/80 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="size-2 rounded-full ring-2 ring-white/40" style={{ background: theme.series[d.slot] }} aria-hidden />
                  <span className="max-w-40 truncate">{d.name}</span>
                  <span className={`tabular text-xs ${selected ? 'opacity-60' : 'text-zinc-500 dark:text-zinc-400'}`}>{ratio(x.a.dscr)}</span>
                </button>
              );
            })}
            {deals.length < MAX_DEALS && (
              <button
                type="button"
                onClick={addDeal}
                className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-500 ring-1 ring-zinc-950/10 ring-inset hover:bg-white/60 hover:text-zinc-800 dark:text-zinc-400 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Add deal"
              >
                <Plus className="size-4" aria-hidden /> Add
              </button>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
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
              className="px-2.5"
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
            <Button variant="ghost" className="px-2.5" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
              {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-3 py-6 sm:px-6 sm:py-8">
        {view === 'analyze' ? (
          <>
            <HeroSummary deal={current.deal} a={a} base={neutral ? null : baseA} />

            <div className="grid gap-6 lg:grid-cols-12">
              <aside className="lg:col-span-4 xl:col-span-3">
                <div className="thin-scroll lg:sticky lg:top-28 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:rounded-3xl">
                  <InputsPanel deal={active} a={baseA} onChange={(patch) => updateDeal(active.id, patch)} />
                </div>
              </aside>

              <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
                <div className="grid gap-6 xl:grid-cols-3">
                  <Card className="flex flex-col xl:col-span-1">
                    <CardHeader icon={Gauge} title="Lender DSCR" subtitle="Gross rent ÷ PITIA" />
                    <div className="grid flex-1 place-items-center p-6">
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
            <div className="px-1 pt-2">
              <p className="eyebrow">Compare</p>
              <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">Which door pays you?</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Up to three deals underwritten side by side: what the lender approves, what actually lands in your account, and what each one builds over ten years.
              </p>
            </div>
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

        <footer className="mt-4 flex flex-col gap-4 border-t border-hairline pt-6 pb-10 text-xs leading-relaxed text-zinc-500 sm:flex-row sm:items-start dark:text-zinc-400">
          <div className="flex shrink-0 items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Bedrock</span>
          </div>
          <p className="max-w-4xl">
            DSCR = gross monthly rent ÷ PITIA (principal, interest, taxes, insurance, HOA). Real net cash flow also subtracts management, maintenance,
            vacancy and CapEx reserves. Cash out of pocket = down payment + closing costs. Projections assume a fixed-rate loan; figures are estimates
            for personal analysis, not lending or investment advice. Deals are saved in this browser only.
          </p>
        </footer>
      </main>
    </div>
  );
}
