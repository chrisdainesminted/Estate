import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Cloud, CloudOff, Columns3, Gauge, HardDrive, LayoutDashboard, Moon, RotateCcw, Sun } from 'lucide-react';
import { useDeals } from './hooks/useDeals.js';
import { useTheme } from './hooks/useTheme.js';
import { analyzeDeal, applyAdjustments, isNeutralAdjustment, projectDeal, saleAnalysis } from './lib/finance.js';
import { MAX_COMPARE } from './lib/presets.js';
import HeroSummary from './components/HeroSummary.jsx';
import DscrGauge from './components/DscrGauge.jsx';
import InputsPanel from './components/InputsPanel.jsx';
import LenderVsReality from './components/LenderVsReality.jsx';
import SensitivitySliders from './components/SensitivitySliders.jsx';
import ComparisonMatrix, { CompareSelector } from './components/ComparisonMatrix.jsx';
import ProjectionChart from './components/ProjectionChart.jsx';
import ExitCard from './components/ExitCard.jsx';
import PortfolioView from './components/PortfolioView.jsx';
import DealPicker from './components/DealPicker.jsx';
import ExportMenu from './components/ExportMenu.jsx';
import DealMemo from './components/DealMemo.jsx';
import Logo, { LogoMark } from './components/Logo.jsx';
import { Button, Card, CardHeader, ConfirmButton, Segmented } from './components/ui.jsx';

const NO_ADJ = { rateDelta: 0, downPct: null, rentPct: 0 };
const YEARS = 10;
const VIEW_KEY = 'bedrock-view';

function build(deal, adjusted = false) {
  const rows = projectDeal(deal, YEARS);
  return { deal, a: analyzeDeal(deal), rows, sale: saleAnalysis(deal, rows), adjusted };
}

const SYNC_TEXT = {
  cloud: { icon: Cloud, text: 'Synced to your Claude account', cls: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { icon: Cloud, text: 'Connecting to your account…', cls: '' },
  error: { icon: CloudOff, text: 'Couldn’t reach your account. Changes are saved in this browser.', cls: 'text-amber-700 dark:text-amber-300' },
  local: { icon: HardDrive, text: 'Saved in this browser', cls: '' },
};

function SyncStatus({ sync }) {
  const s = SYNC_TEXT[sync] ?? SYNC_TEXT.local;
  return (
    <span role="status" className={`flex max-w-56 items-center gap-1.5 ${s.cls}`}>
      <s.icon className="size-3.5 shrink-0" aria-hidden />
      {s.text}
    </span>
  );
}

function useStoredView() {
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return ['portfolio', 'analyze', 'compare'].includes(v) ? v : 'analyze';
    } catch {
      return 'analyze';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // per-viewer convenience only
    }
  }, [view]);
  return [view, setView];
}

export default function App() {
  const lib = useDeals();
  const { deals, active, activeId, compare, slotOf } = lib;
  const { dark, toggle } = useTheme();
  const [view, setView] = useStoredView();
  const [adj, setAdj] = useState(NO_ADJ);
  const [scope, setScope] = useState('active');

  const neutral = isNeutralAdjustment(adj);
  const effectiveScope = compare.length > 1 ? scope : 'active';
  const inCompare = (id) => compare.some((c) => c.id === id);

  // Saved inputs, untouched by the what-if sliders: the portfolio and deal menu use these.
  const baseItems = useMemo(() => deals.map((d) => build(d)), [deals]);

  // What-if adjustments apply to the open deal, or to every compared deal.
  const effective = useMemo(() => {
    const map = new Map();
    baseItems.forEach((x) => {
      const adjusted = !neutral && (effectiveScope === 'compare' ? compare.some((c) => c.id === x.deal.id) : x.deal.id === activeId);
      map.set(x.deal.id, adjusted ? build(applyAdjustments(x.deal, adj), true) : x);
    });
    return map;
  }, [baseItems, adj, neutral, effectiveScope, compare, activeId]);

  const current = effective.get(activeId);
  const base = baseItems.find((x) => x.deal.id === activeId);
  const a = current.a;

  const compared = compare.map((c) => ({ ...effective.get(c.id), slot: c.slot })).filter((x) => x.deal);
  const owned = baseItems.filter((x) => x.deal.status === 'owned');
  const prospects = baseItems.filter((x) => x.deal.status !== 'owned');

  const applyWhatIf = () => {
    const commit = (d) => {
      const e = applyAdjustments(d, adj);
      return { rate: Math.round(e.rate * 1000) / 1000, downPct: e.downPct, rentPerUnit: Math.round(e.rentPerUnit) };
    };
    if (effectiveScope === 'compare') lib.updateMany(compare.map((c) => c.id), commit);
    else lib.updateDeal(active.id, commit(active));
    setAdj(NO_ADJ);
  };

  const openDeal = (id) => {
    lib.setActive(id);
    setView('analyze');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sliders = (
    <SensitivitySliders
      deal={active}
      adj={adj}
      setAdj={setAdj}
      scope={effectiveScope}
      setScope={setScope}
      base={base.a}
      what={a}
      onApply={applyWhatIf}
      compareCount={compare.length}
    />
  );

  return (
    <>
      <div className="relative min-h-screen print:hidden">
        <div aria-hidden className="app-backdrop">
          <div className="app-grid" />
          <div className="app-grain" />
        </div>

        <header className="gutter relative z-30 pt-3 md:sticky md:top-[env(safe-area-inset-top,0px)]">
          <div className="glass mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl px-3 py-2.5 sm:px-4">
            <h1 className="shrink-0">
              <Logo />
            </h1>

            <div className="order-3 w-full overflow-x-auto md:order-none md:flex md:w-auto md:flex-1 md:justify-center">
              <Segmented
                label="View"
                value={view}
                onChange={setView}
                options={[
                  { value: 'portfolio', label: 'Portfolio', icon: Briefcase },
                  { value: 'analyze', label: 'Analyze', icon: LayoutDashboard },
                  { value: 'compare', label: 'Compare', icon: Columns3 },
                ]}
              />
            </div>

            <div className="order-4 w-full md:order-none md:w-auto">
              <DealPicker items={baseItems} activeId={activeId} onSelect={openDeal} onNew={() => (lib.addDeal(), setView('analyze'))} />
            </div>

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <ExportMenu current={current} items={baseItems} />
              <ConfirmButton
                label="Start over with example deals"
                title="Start over with the examples?"
                body={`This replaces all ${deals.length} saved deals with the five examples. It can’t be undone; export a CSV first if you want a copy.`}
                confirmLabel="Replace my deals"
                onConfirm={() => {
                  lib.resetAll();
                  setAdj(NO_ADJ);
                }}
                className="inline-flex items-center rounded-xl px-2.5 py-2 text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <RotateCcw className="size-4" aria-hidden />
              </ConfirmButton>
              <Button variant="ghost" className="px-2.5" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
                {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </header>

        <main className="gutter mx-auto max-w-[1500px] space-y-6 py-6 sm:py-8">
          {view === 'portfolio' && (
            <PortfolioView
              owned={owned}
              prospects={prospects}
              dark={dark}
              onOpen={openDeal}
              onMarkOwned={(id) => lib.updateDeal(id, { status: 'owned', yearsOwned: 0 })}
            />
          )}

          {view === 'analyze' && (
            <>
              <HeroSummary deal={current.deal} a={a} sale={current.sale} base={neutral ? null : base.a} />

              <div className="grid gap-6 lg:grid-cols-12">
                <aside className="lg:col-span-4 xl:col-span-3">
                  <div className="thin-scroll lg:sticky lg:top-28 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:rounded-3xl">
                    <InputsPanel
                      deal={active}
                      a={base.a}
                      onChange={(patch) => lib.updateDeal(active.id, patch)}
                      onDuplicate={() => lib.duplicateDeal(active.id)}
                      onDelete={deals.length > 1 ? () => lib.removeDeal(active.id) : null}
                    />
                  </div>
                </aside>

                <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
                  <div className="grid gap-6 xl:grid-cols-3">
                    <Card delay={60} className="flex flex-col xl:col-span-1">
                      <CardHeader icon={Gauge} title="Lender DSCR" subtitle={a.interestOnly ? 'Rent ÷ PITIA (interest-only payment)' : 'Gross rent ÷ PITIA'} />
                      <div className="grid flex-1 place-items-center p-6">
                        <DscrGauge a={a} />
                      </div>
                    </Card>
                    <div className="xl:col-span-2">{sliders}</div>
                  </div>
                  <LenderVsReality a={a} />
                  <ProjectionChart rows={current.rows} a={a} dark={dark} appreciationPct={Number(current.deal.appreciationPct)} />
                  <ExitCard sale={current.sale} deal={current.deal} />
                </div>
              </div>
            </>
          )}

          {view === 'compare' && (
            <>
              <div className="rise px-1 pt-2">
                <p className="eyebrow">Compare</p>
                <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">Which door pays you?</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  Up to {MAX_COMPARE} deals underwritten side by side: what the lender approves, what actually lands in your account, and what each one is
                  worth when you sell.
                </p>
              </div>
              <CompareSelector items={baseItems} compare={compare} slotOf={slotOf} onToggle={lib.toggleCompare} dark={dark} />
              {compared.length > 0 && sliders}
              <ComparisonMatrix
                items={compared}
                activeId={activeId}
                adjusted={!neutral}
                dark={dark}
                canAdd={compare.length < MAX_COMPARE}
                onAdd={lib.addDeal}
                onDuplicate={lib.duplicateDeal}
                onRemove={lib.toggleCompare}
                onEdit={openDeal}
              />
            </>
          )}

          <footer className="mt-4 flex flex-col gap-4 border-t border-hairline pt-6 pb-10 text-xs leading-relaxed text-zinc-500 sm:flex-row sm:items-start dark:text-zinc-400">
            <div className="flex shrink-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <LogoMark className="size-6" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Bedrock</span>
              </div>
              <SyncStatus sync={lib.sync} />
            </div>
            <p className="max-w-4xl">
              DSCR = gross monthly rent ÷ PITIA (principal, interest, taxes, insurance, HOA), using the interest-only payment during an IO period. Real net
              cash flow also subtracts management, maintenance, vacancy and CapEx reserves. Cash invested = down payment + closing costs + rehab. Profit if
              sold nets selling costs and the loan payoff. Figures are estimates for personal analysis, not lending or investment advice.
            </p>
          </footer>
        </main>
      </div>

      <DealMemo item={current} />
    </>
  );
}
