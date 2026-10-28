import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building,
  Cloud,
  CloudOff,
  Columns3,
  Copy,
  FileSpreadsheet,
  FileText,
  Gauge,
  HardDrive,
  Home,
  LayoutDashboard,
  ListTree,
  Moon,
  Pencil,
  Plus,
  Radar,
  RotateCcw,
  Search,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  Undo2,
  Flag,
} from 'lucide-react';
import { useDeals } from './hooks/useDeals.js';
import { useTheme } from './hooks/useTheme.js';
import { useExports } from './hooks/useExports.js';
import { useMediaQuery, prefersReducedMotion } from './hooks/useMediaQuery.js';
import { useMarket } from './hooks/useMarket.js';
import { analyzeDeal, applyAdjustments, isNeutralAdjustment, maxOffer, projectDeal, refiAnalysis, saleAnalysis } from './lib/finance.js';
import { money, ratio } from './lib/format.js';
import { DEFAULT_DEAL, MAX_COMPARE, switchRules } from './lib/presets.js';
import { listingToDeal, rankListings } from './lib/market.js';
import HeroSummary from './components/HeroSummary.jsx';
import DscrGauge from './components/DscrGauge.jsx';
import InputsPanel from './components/InputsPanel.jsx';
import LenderVsReality from './components/LenderVsReality.jsx';
import SensitivitySliders from './components/SensitivitySliders.jsx';
import ExitCard from './components/ExitCard.jsx';
import MaxOfferCard from './components/MaxOfferCard.jsx';
import RefiCard from './components/RefiCard.jsx';
import StressTestCard from './components/StressTestCard.jsx';
import TaxCard from './components/TaxCard.jsx';
import SecondOpinion from './components/SecondOpinion.jsx';
import DealPicker from './components/DealPicker.jsx';
import ExportMenu from './components/ExportMenu.jsx';
import DealMemo from './components/DealMemo.jsx';
import CommandPalette, { shortcutLabel } from './components/CommandPalette.jsx';
import Sheet from './components/Sheet.jsx';
import Welcome from './components/Welcome.jsx';
import Logo, { LogoMark } from './components/Logo.jsx';
import { useToast } from './components/toast.jsx';
import { Button, Card, CardHeader, ConfirmButton, Segmented, SkeletonCard } from './components/ui.jsx';

// Views and charts load on demand so the first screen arrives quickly.
const PortfolioView = lazy(() => import('./components/PortfolioView.jsx'));
const PlanView = lazy(() => import('./components/PlanView.jsx'));
const CompareView = lazy(() => import('./views/CompareView.jsx'));
const ProjectionChart = lazy(() => import('./components/ProjectionChart.jsx'));
const ListingsView = lazy(() => import('./views/ListingsView.jsx'));

const NO_ADJ = { rateDelta: 0, downPct: null, rentPct: 0 };
const YEARS = 10;
const VIEW_KEY = 'bedrock-view';

const VIEWS = [
  { value: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { value: 'analyze', label: 'Analyze', icon: LayoutDashboard },
  { value: 'compare', label: 'Compare', icon: Columns3 },
  { value: 'plan', label: 'Plan', icon: Sprout },
  { value: 'listings', label: 'Listings', icon: Radar },
];

// Analyze sections the command palette can jump to.
const SECTIONS = [
  { id: 'sec-summary', label: 'Summary' },
  { id: 'sec-inputs', label: 'Deal inputs' },
  { id: 'sec-dscr', label: 'Lender DSCR gauge' },
  { id: 'sec-whatif', label: 'What-if sensitivity' },
  { id: 'sec-stress', label: 'Stress test' },
  { id: 'sec-offer', label: 'Max offer price' },
  { id: 'sec-lender', label: 'Lender math vs. real-world math' },
  { id: 'sec-projection', label: '10-year projection and loan schedule' },
  { id: 'sec-refi', label: 'Cash-out refinance' },
  { id: 'sec-exit', label: 'If you sell in year 10' },
  { id: 'sec-tax', label: 'Taxes' },
  { id: 'sec-opinion', label: 'Second opinion from Claude' },
];

function build(deal, targets, adjusted = false) {
  const rows = projectDeal(deal, YEARS);
  return {
    deal,
    a: analyzeDeal(deal),
    rows,
    sale: saleAnalysis(deal, rows),
    refi: refiAnalysis(deal, YEARS),
    offer: maxOffer(deal, targets),
    adjusted,
  };
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
    <span className={`flex max-w-56 items-center gap-1.5 ${s.cls}`}>
      <s.icon className="size-3.5 shrink-0" aria-hidden />
      {s.text}
    </span>
  );
}

function useStoredView() {
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return VIEWS.some((x) => x.value === v) ? v : 'analyze';
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

const headerIcon =
  'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white';

export default function App() {
  const lib = useDeals();
  const { deals, active, activeId, compare, slotOf } = lib;
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const [view, setView] = useStoredView();
  const [adj, setAdj] = useState(NO_ADJ);
  const [scope, setScope] = useState('active');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const marketFeed = useMarket();

  const neutral = isNeutralAdjustment(adj);
  const effectiveScope = compare.length > 1 ? scope : 'active';

  // Saved inputs, untouched by the what-if sliders: the portfolio and deal menu use these.
  const targets = lib.settings.targets;
  const baseItems = useMemo(() => deals.map((d) => build(d, targets)), [deals, targets]);

  // What-if adjustments apply to the open deal, or to every compared deal.
  const effective = useMemo(() => {
    const map = new Map();
    baseItems.forEach((x) => {
      const adjusted = !neutral && (effectiveScope === 'compare' ? compare.some((c) => c.id === x.deal.id) : x.deal.id === activeId);
      map.set(x.deal.id, adjusted ? build(applyAdjustments(x.deal, adj), targets, true) : x);
    });
    return map;
  }, [baseItems, adj, neutral, effectiveScope, compare, activeId, targets]);

  const current = effective.get(activeId);
  const base = baseItems.find((x) => x.deal.id === activeId);
  const a = current.a;

  const compared = compare.map((c) => ({ ...effective.get(c.id), slot: c.slot })).filter((x) => x.deal);
  const owned = useMemo(() => baseItems.filter((x) => x.deal.status === 'owned'), [baseItems]);
  const prospects = useMemo(() => baseItems.filter((x) => x.deal.status !== 'owned'), [baseItems]);
  const exports = useExports(current, baseItems);

  // Any change worth taking back: do it, then offer Undo in a toast.
  const withUndo = useCallback(
    (text, change) => {
      const snap = lib.snapshot();
      change();
      toast({ text, action: { label: 'Undo', onClick: () => lib.restore(snap) } });
    },
    [lib, toast],
  );

  const applyWhatIf = () => {
    const commit = (d) => {
      const e = applyAdjustments(d, adj);
      return { rate: Math.round(e.rate * 1000) / 1000, downPct: e.downPct, rentPerUnit: Math.round(e.rentPerUnit) };
    };
    withUndo(effectiveScope === 'compare' ? `Applied the what-if to ${compare.length} deals` : `Applied the what-if to “${active.name}”`, () => {
      if (effectiveScope === 'compare') lib.updateMany(compare.map((c) => c.id), commit);
      else lib.updateDeal(active.id, commit(active));
    });
    setAdj(NO_ADJ);
  };

  const openDeal = useCallback(
    (id) => {
      lib.setActive(id);
      setView('analyze');
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [lib, setView],
  );

  // New deals follow the open deal's rules; Canadian ones start from your listing financing.
  const newDeal = useCallback(() => {
    const m = lib.settings.market;
    lib.insertDeal(
      active.country === 'ca' ? { ...switchRules(DEFAULT_DEAL, 'ca'), downPct: m.downPct, rate: m.rate, refiRate: m.rate, termYears: m.amortYears } : {},
    );
    setView('analyze');
    if (!isDesktop) setSheetOpen(true);
    toast({ tone: 'info', text: 'New deal started. Fill in the inputs and everything updates as you type.' });
  }, [lib, active.country, setView, isDesktop, toast]);

  const deleteDeal = useCallback(
    (deal) => {
      if (deals.length <= 1) return;
      setSheetOpen(false);
      withUndo(`Deleted “${deal.name}”`, () => lib.removeDeal(deal.id));
    },
    [deals.length, withUndo, lib],
  );

  const duplicateDeal = useCallback(
    (deal) => withUndo(`Duplicated “${deal.name}”`, () => lib.duplicateDeal(deal.id)),
    [withUndo, lib],
  );

  // Listings: open one as a deal (once), or hide it from the list.
  const market = lib.settings.market;
  const importedIds = useMemo(() => new Set(deals.map((d) => d.listingId).filter(Boolean)), [deals]);
  const analyzeListing = useCallback(
    (listing) => {
      const existing = deals.find((d) => d.listingId === listing.id);
      if (existing) {
        openDeal(existing.id);
        return;
      }
      withUndo(`Added “${listing.address}” to your deals`, () => lib.insertDeal(listingToDeal(listing, market)));
      setView('analyze');
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [deals, market, openDeal, withUndo, lib, setView],
  );
  const hideListing = useCallback(
    (listing) => withUndo(`Hid “${listing.address}”`, () => lib.updateSettings('market', { hidden: [...market.hidden, listing.id] })),
    [withUndo, lib, market.hidden],
  );
  const unhideListing = useCallback(
    (listing) => lib.updateSettings('market', { hidden: market.hidden.filter((id) => id !== listing.id) }),
    [lib, market.hidden],
  );
  const topListings = useMemo(
    () => (marketFeed.status === 'ready' ? rankListings(marketFeed.feed?.listings, market, targets).slice(0, 8) : []),
    [marketFeed, market, targets],
  );

  // Jump to an Analyze section; on phones the inputs open in their sheet.
  const jump = useCallback(
    (id) => {
      const go = (tries = 0) => {
        if (id === 'sec-inputs' && !isDesktop) {
          setSheetOpen(true);
          return;
        }
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        else if (tries < 12) setTimeout(() => go(tries + 1), 100); // lazy sections may still be loading
      };
      if (view !== 'analyze') {
        setView('analyze');
        setTimeout(() => go(), 50);
      } else go();
    },
    [view, setView, isDesktop],
  );

  // Ctrl/⌘ K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inCompare = compare.some((c) => c.id === activeId);
  const commands = useMemo(() => {
    const list = [
      ...VIEWS.map((v) => ({ id: `view-${v.value}`, group: 'Go to', label: v.label, icon: v.icon, keywords: 'view tab page', run: () => setView(v.value) })),
      ...baseItems.map((x) => ({
        id: `deal-${x.deal.id}`,
        group: 'Deals',
        label: x.deal.name,
        hint: `DSCR ${ratio(x.a.dscr)} · ${money(x.a.netCashFlow, { signed: true })}/mo`,
        icon: x.deal.status === 'owned' ? Building : Home,
        keywords: `${x.deal.address ?? ''} ${x.deal.status} open deal`,
        run: () => openDeal(x.deal.id),
      })),
      ...topListings.map((x) => ({
        id: `listing-${x.listing.id}`,
        group: 'Listings',
        label: x.listing.address,
        hint: `${money(x.perDoor, { signed: true })}/door · ${money(x.a.price)}`,
        icon: Radar,
        keywords: 'thunder bay listing for sale analyze',
        run: () => analyzeListing(x.listing),
      })),
      { id: 'act-new', group: 'Actions', label: 'New deal', icon: Plus, keywords: 'add create', run: newDeal },
      {
        id: 'act-rules',
        group: 'Actions',
        label: active.country === 'ca' ? `Use US rules for “${active.name}”` : `Use Canadian rules for “${active.name}”`,
        icon: Flag,
        keywords: 'canada ontario us united states rules mortgage tax land transfer',
        run: () => {
          const to = active.country === 'ca' ? 'us' : 'ca';
          withUndo(`“${active.name}” now uses ${to === 'ca' ? 'Canadian' : 'US'} rules`, () => lib.updateDeal(active.id, switchRules(active, to)));
        },
      },
      { id: 'act-dup', group: 'Actions', label: `Duplicate “${active.name}”`, icon: Copy, keywords: 'copy clone', run: () => duplicateDeal(active) },
      {
        id: 'act-compare',
        group: 'Actions',
        label: inCompare ? `Remove “${active.name}” from comparison` : `Add “${active.name}” to comparison`,
        icon: Columns3,
        keywords: 'compare side by side',
        run: () => {
          if (!inCompare && compare.length >= MAX_COMPARE) {
            toast({ tone: 'error', text: `Compare holds ${MAX_COMPARE} deals. Remove one first.` });
            return;
          }
          lib.toggleCompare(active.id);
          toast({ text: inCompare ? 'Removed from comparison' : 'Added to comparison' });
        },
      },
      { id: 'act-pdf', group: 'Actions', label: 'Export deal memo (PDF)', icon: FileText, keywords: 'download print memo', run: exports.exportPdf },
      { id: 'act-csv', group: 'Actions', label: 'Export all deals (CSV)', icon: FileSpreadsheet, keywords: 'download spreadsheet excel sheets', run: exports.exportCsv },
      { id: 'act-theme', group: 'Actions', label: dark ? 'Switch to light mode' : 'Switch to dark mode', icon: dark ? Sun : Moon, keywords: 'theme dark light', run: toggle },
      ...(neutral ? [] : [{ id: 'act-clear', group: 'Actions', label: 'Clear the what-if', icon: Undo2, keywords: 'reset sliders', run: () => setAdj(NO_ADJ) }]),
      ...(deals.length > 1 ? [{ id: 'act-delete', group: 'Actions', label: `Delete “${active.name}”`, icon: Trash2, keywords: 'remove', run: () => deleteDeal(active) }] : []),
      {
        id: 'act-reset',
        group: 'Actions',
        label: 'Start over with the example deals',
        icon: RotateCcw,
        keywords: 'reset examples',
        run: () => {
          withUndo('Replaced your deals with the examples', lib.resetAll);
          setAdj(NO_ADJ);
        },
      },
      ...SECTIONS.map((s) => ({ id: `jump-${s.id}`, group: 'Jump to section', label: s.label, icon: s.id === 'sec-opinion' ? Sparkles : ListTree, keywords: 'section scroll analyze', run: () => jump(s.id) })),
    ];
    return list;
  }, [baseItems, topListings, analyzeListing, active, inCompare, compare.length, exports, dark, toggle, neutral, deals.length, newDeal, duplicateDeal, deleteDeal, jump, openDeal, lib, toast, setView, withUndo]);

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

  const inputs = (
    <InputsPanel
      deal={active}
      a={base.a}
      onChange={(patch) => lib.updateDeal(active.id, patch)}
      onDuplicate={() => duplicateDeal(active)}
      onDelete={deals.length > 1 ? () => deleteDeal(active) : null}
    />
  );

  return (
    <>
      <div className="relative min-h-screen print:hidden">
        <div aria-hidden className="app-backdrop">
          <div className="app-grid" />
          <div className="app-grain" />
        </div>
        <a
          href="#main"
          className="sr-only z-[100] rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <header className="gutter relative z-30 pt-3 lg:sticky lg:top-[env(safe-area-inset-top,0px)]">
          <div className="glass mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl px-3 py-2.5 sm:px-4">
            <h1 className="shrink-0">
              <Logo />
            </h1>

            {/* Phones and tablets: views get their own row. From lg up everything shares one row; icons drop until xl to make room. */}
            <nav
              aria-label="Views"
              className="order-3 w-full overflow-x-auto lg:order-none lg:flex lg:w-auto lg:min-w-0 lg:flex-1 lg:justify-center-safe lg:max-xl:[&_svg]:hidden"
            >
              <Segmented label="View" value={view} onChange={setView} options={VIEWS} stretch />
            </nav>

            <div className="order-4 w-full md:order-none md:ml-auto md:w-auto lg:ml-0">
              <DealPicker items={baseItems} activeId={activeId} onSelect={openDeal} onNew={newDeal} />
            </div>

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <button type="button" onClick={() => setPaletteOpen(true)} className={headerIcon} aria-label="Search deals and commands" title={`Search (${shortcutLabel})`}>
                <Search className="size-4" aria-hidden />
                <kbd className="hidden rounded-md bg-zinc-950/[0.06] px-1.5 py-0.5 font-sans text-[11px] text-zinc-500 min-[1400px]:inline dark:bg-white/10 dark:text-zinc-400">{shortcutLabel}</kbd>
              </button>
              {/* On phones, export and start-over live in the search menu to keep the header to one row. */}
              <div className="max-sm:hidden">
                <ExportMenu current={current} count={baseItems.length} exports={exports} />
              </div>
              <div className="max-sm:hidden">
                <ConfirmButton
                  label="Start over with example deals"
                  title="Start over with the examples?"
                  body={`This replaces all ${deals.length} saved deals with the five examples. You can undo it right after.`}
                  confirmLabel="Replace my deals"
                  onConfirm={() => {
                    withUndo('Replaced your deals with the examples', lib.resetAll);
                    setAdj(NO_ADJ);
                  }}
                  className={headerIcon}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
              <Button variant="ghost" className="px-2.5" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
                {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="gutter mx-auto max-w-[1500px] space-y-6 py-6 outline-none sm:py-8">
          {/* Portal target for glossary tips; display: contents keeps it out of the layout. */}
          <div id="tip-layer" className="contents" />
          <Suspense fallback={<SkeletonCard className="h-[32rem]" />}>
            {view === 'portfolio' && (
              <PortfolioView
                owned={owned}
                prospects={prospects}
                dark={dark}
                onOpen={openDeal}
                onMarkOwned={(id) => {
                  const d = deals.find((x) => x.id === id);
                  withUndo(`Moved “${d?.name}” to your portfolio`, () => lib.updateDeal(id, { status: 'owned', yearsOwned: 0 }));
                }}
              />
            )}

            {view === 'plan' && (
              <PlanView owned={owned} deals={baseItems} plan={lib.settings.plan} onPlan={(patch) => lib.updateSettings('plan', patch)} dark={dark} onOpen={openDeal} />
            )}

            {view === 'listings' && (
              <ListingsView
                feedState={marketFeed}
                market={market}
                targets={targets}
                importedIds={importedIds}
                onMarket={(patch) => lib.updateSettings('market', patch)}
                onAnalyze={analyzeListing}
                onHide={hideListing}
                onUnhide={unhideListing}
              />
            )}

            {view === 'compare' && (
              <CompareView
                items={baseItems}
                compare={compare}
                slotOf={slotOf}
                compared={compared}
                sliders={sliders}
                activeId={activeId}
                adjusted={!neutral}
                dark={dark}
                lib={{ ...lib, addDeal: newDeal, duplicateDeal: (id) => duplicateDeal(deals.find((d) => d.id === id)) }}
                onOpen={openDeal}
              />
            )}
          </Suspense>

          {view === 'analyze' && (
            <>
              <Welcome onNewDeal={newDeal} />
              <HeroSummary deal={current.deal} a={a} sale={current.sale} base={neutral ? null : base.a} />

              <div className="grid gap-6 lg:grid-cols-12">
                {isDesktop && (
                  <aside className="lg:col-span-4 xl:col-span-3" aria-label="Deal inputs">
                    <div className="thin-scroll lg:sticky lg:top-28 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:rounded-3xl">{inputs}</div>
                  </aside>
                )}

                <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
                  <div className="grid gap-6 xl:grid-cols-3">
                    <Card id="sec-dscr" delay={60} className="flex flex-col xl:col-span-1">
                      <CardHeader icon={Gauge} title="Lender DSCR" subtitle={a.interestOnly ? 'Rent ÷ PITIA (interest-only payment)' : 'Gross rent ÷ PITIA'} />
                      <div className="grid flex-1 place-items-center p-6">
                        <DscrGauge a={a} />
                      </div>
                    </Card>
                    <div className="xl:col-span-2">{sliders}</div>
                  </div>
                  <StressTestCard deal={active} adj={adj} onPick={(p) => setAdj((x) => ({ ...x, ...p }))} />
                  <MaxOfferCard
                    deal={current.deal}
                    targets={targets}
                    onTargets={(patch) => lib.updateSettings('targets', patch)}
                    onUsePrice={(price) => withUndo(`Price set to ${money(price)}`, () => lib.updateDeal(active.id, { price }))}
                  />
                  <LenderVsReality a={a} />
                  <Suspense fallback={<SkeletonCard className="h-[30rem]" />}>
                    <ProjectionChart rows={current.rows} a={a} deal={current.deal} dark={dark} appreciationPct={Number(current.deal.appreciationPct)} />
                  </Suspense>
                  {current.refi && <RefiCard refi={current.refi} a={a} deal={current.deal} />}
                  <ExitCard sale={current.sale} deal={current.deal} />
                  <TaxCard deal={current.deal} tax={lib.settings.tax} onTax={(patch) => lib.updateSettings('tax', patch)} />
                  <SecondOpinion item={current} targets={targets} />
                </div>
              </div>

              {!isDesktop && (
                // display: contents keeps main's space-y margin off these fixed overlays.
                <div className="contents">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="fixed z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-emerald-600 to-emerald-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_-12px_rgb(5_150_105/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] ring-1 ring-emerald-800/40 transition ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-[0.98] print:hidden"
                    style={{ right: 'max(16px, env(safe-area-inset-right, 0px))', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                  >
                    <Pencil className="size-4" aria-hidden /> Edit deal
                  </button>
                  <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Edit “${active.name}”`}>
                    {inputs}
                  </Sheet>
                </div>
              )}
            </>
          )}

          <footer className="mt-4 flex flex-col gap-4 border-t border-hairline pt-6 pb-24 text-xs leading-relaxed text-zinc-500 sm:flex-row sm:items-start lg:pb-10 dark:text-zinc-400">
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
              sold nets selling costs and the loan payoff. Figures are estimates for personal analysis, not lending, tax or investment advice.
              <span className="pointer-coarse:hidden"> Press {shortcutLabel} to search.</span>
            </p>
          </footer>
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} />}
      <DealMemo item={current} />
    </>
  );
}
