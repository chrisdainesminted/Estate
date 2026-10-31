import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Briefcase,
  Building2,
  Building,
  Calculator,
  CircleHelp,
  Cloud,
  CloudOff,
  Columns3,
  Copy,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Home,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Moon,
  Plus,
  Radar,
  RotateCcw,
  Search,
  Share2,
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
import { useMarket, useMarketIndex } from './hooks/useMarket.js';
import { OWN_DOWN_PCT, analyzeDeal, applyAdjustments, isNeutralAdjustment, maxOffer, ownMoney, projectDeal, refiAnalysis, saleAnalysis } from './lib/finance.js';
import { money, percent, ratio } from './lib/format.js';
import { DEFAULT_DEAL, MAX_COMPARE, switchRules } from './lib/presets.js';
import { LISTING_CITIES, homePatch, listingCity, listingToDeal, localMarket, normalizeMarket, rankListings } from './lib/market.js';
import { quickDeal } from './lib/quick.js';
import { readShared, sameDeal } from './lib/share.js';
import { whatIfSummary } from './lib/explain.js';
import HeroSummary from './components/HeroSummary.jsx';
import InputsPanel from './components/InputsPanel.jsx';
import LenderVsReality from './components/LenderVsReality.jsx';
import SensitivitySliders from './components/SensitivitySliders.jsx';
import ExitCard from './components/ExitCard.jsx';
import MaxOfferCard from './components/MaxOfferCard.jsx';
import RefiCard from './components/RefiCard.jsx';
import StressTestCard from './components/StressTestCard.jsx';
import TaxCard from './components/TaxCard.jsx';
import ProjectionChart from './components/ProjectionChart.jsx';
import SecondOpinion from './components/SecondOpinion.jsx';
import DealPicker from './components/DealPicker.jsx';
import ExportMenu from './components/ExportMenu.jsx';
import DealMemo from './components/DealMemo.jsx';
import CommandPalette, { shortcutLabel } from './components/CommandPalette.jsx';
import Sheet from './components/Sheet.jsx';
import Welcome from './components/Welcome.jsx';
import { SectionGroup, SectionsContext, useSectionsState } from './components/Section.jsx';
import Dock from './components/Dock.jsx';
import Logo, { LogoMark } from './components/Logo.jsx';
import { useToast } from './components/toast.jsx';
import { Button, ConfirmButton, SkeletonCard, signedClass } from './components/ui.jsx';
import { normalizeProfile } from './lib/firstHome.js';
import { guessCity } from './lib/canada.js';

// Views and charts load on demand so the first screen arrives quickly.
const PortfolioView = lazy(() => import('./components/PortfolioView.jsx'));
const PlanView = lazy(() => import('./components/PlanView.jsx'));
const CompareView = lazy(() => import('./views/CompareView.jsx'));
const ListingsView = lazy(() => import('./views/ListingsView.jsx'));
const CashView = lazy(() => import('./views/CashView.jsx'));
const HomeView = lazy(() => import('./views/HomeView.jsx'));
const LandlordView = lazy(() => import('./views/landlord/LandlordView.jsx'));
const HelpSheet = lazy(() => import('./components/HelpSheet.jsx'));
const ShareSheet = lazy(() => import('./components/ShareSheet.jsx'));

const NO_ADJ = { rateDelta: 0, downPct: null, rentPct: 0 };
const YEARS = 10;
const VIEW_KEY = 'bedrock-view';
const TABS_KEY = 'bedrock-all-tabs';

// `about` is what the help panel says each tab is for. The `basic` tabs
// always show; the rest wait behind More until they're useful.
const VIEWS = [
  {
    value: 'home',
    label: 'Home',
    icon: KeyRound,
    basic: true,
    keywords: 'first home buy afford qualify down payment fhsa savings grants rebate suite permit build',
    about: 'Your first home: what you could buy, the government money you can get, when you’ll be ready, and how to add a rental suite.',
  },
  { value: 'analyze', label: 'Analyze', icon: LayoutDashboard, basic: true, about: 'One deal in detail: what you’d keep each month, what a lender would say, and the most you should pay.' },
  {
    value: 'cash',
    label: 'Cash',
    icon: Banknote,
    basic: true,
    keywords: 'own money cash flow cash on cash 20% down mortgage payment income',
    about: 'Your own money as a 20% down payment: the cash flow after the mortgage payment, and the return on your cash.',
  },
  { value: 'listings', label: 'Listings', icon: Radar, basic: true, about: 'Real Thunder Bay properties for sale, found every morning and checked against your targets.' },
  { value: 'portfolio', label: 'Portfolio', icon: Briefcase, about: 'The properties you own, added up: what they bring in each month and what they’re worth today.' },
  { value: 'compare', label: 'Compare', icon: Columns3, about: 'Up to three deals side by side, with the best of each row marked.' },
  { value: 'plan', label: 'Plan', icon: Sprout, about: 'When your savings and rent could buy the next property, and where that leads in 10 years.' },
  {
    value: 'landlord',
    label: 'Landlord',
    icon: Building2,
    keywords: 'tenant applicant viewing booking calendar rent payment late repair maintenance expense t776 tax lease notice deposit',
    about: 'Run your rentals: listing pages where people apply and book viewings, rent tracking, repair requests, expenses for tax time, and your province’s rules.',
  },
];
const BASIC_VIEWS = new Set(VIEWS.filter((v) => v.basic).map((v) => v.value));

// Analyze sections the command palette can jump to. The detail sections fold
// down to one line; jumping to one opens it.
const SECTIONS = [
  { id: 'sec-summary', label: 'Summary', keywords: 'verdict dscr cash flow' },
  { id: 'sec-inputs', label: 'Deal inputs', keywords: 'edit' },
  { id: 'sec-lender', label: 'Where the rent goes', keywords: 'lender math real world pitia opex dscr gauge cap rate breakeven', folds: true },
  { id: 'sec-offer', label: 'Most you should pay', keywords: 'max offer price targets', folds: true },
  { id: 'sec-whatif', label: 'Try a what-if', keywords: 'sensitivity sliders rate down payment rent', folds: true },
  { id: 'sec-stress', label: 'Stress test', keywords: 'grid rent rate', folds: true },
  { id: 'sec-projection', label: '10-year outlook and loan schedule', keywords: 'projection wealth chart equity', folds: true },
  { id: 'sec-refi', label: 'Cash-out refinance', keywords: 'brrrr', folds: true },
  { id: 'sec-exit', label: 'If you sell in year 10', keywords: 'sale exit profit irr', folds: true },
  { id: 'sec-tax', label: 'Taxes', keywords: 'depreciation cca', folds: true },
  { id: 'sec-opinion', label: 'Second opinion from Claude', keywords: 'review ai', folds: true },
];
const DETAIL_IDS = SECTIONS.filter((x) => x.folds).map((x) => x.id);

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

/** Whether Portfolio, Compare and Plan were brought out from under More in this browser. */
function useAllTabs() {
  const [all, setAll] = useState(() => {
    try {
      return localStorage.getItem(TABS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const showAll = useCallback(() => {
    setAll(true);
    try {
      localStorage.setItem(TABS_KEY, '1');
    } catch {
      // per-viewer convenience only
    }
  }, []);
  return [all, showAll];
}

// The website's home page: the site root when the app runs on the website at /app/; from
// anywhere else (the hosted Claude page) the public site, opened in a new tab.
const HOME_PAGE = typeof window !== 'undefined' && window.location.pathname.startsWith('/app') ? '/' : 'https://bedrock.signia83.workers.dev/';

/** A view named in the address (?view=listings), as the homepage's links use; read once, then tidied away. */
function viewFromAddress() {
  const v = new URLSearchParams(window.location.search).get('view');
  if (!VIEWS.some((x) => x.value === v)) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('view');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return v;
}

/** A listings city named in the address (?city=calgary), from the homepage's link; read once, then tidied away. */
function cityFromAddress() {
  const c = new URLSearchParams(window.location.search).get('city');
  if (!c) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('city');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return LISTING_CITIES.includes(c) ? c : null;
}

function useStoredView() {
  const [view, setView] = useState(() => {
    const linked = viewFromAddress();
    if (linked) return linked;
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return VIEWS.some((x) => x.value === v) ? v : 'home';
    } catch {
      return 'home';
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
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-well hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:text-white';

const tabClass = (current) =>
  `flex shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
    current ? 'border-(--accent) font-semibold text-zinc-950 dark:text-white' : 'border-transparent font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
  }`;

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  // The deal the Home tab tries living in; the open deal until you pick another.
  const [liveDealId, setLiveDealId] = useState(null);
  const [allTabs, showAllTabs] = useAllTabs();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const sections = useSectionsState();
  const { setOpen: openSection } = sections;

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

  const pickDeal = useCallback(
    (id) => {
      if (view !== 'cash') return openDeal(id);
      lib.setActive(id);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [view, lib, openDeal],
  );

  // New deals follow the open deal's rules; Canadian ones start from your listing financing.
  // New deals and quick checks start on Canadian rules, unless you're working in a US deal of your own,
  // in the city on your Home numbers (or the one your time zone suggests).
  const homeRules = !active.example && active.country === 'us' ? 'us' : 'ca';
  const homeProfile = normalizeProfile(lib.settings.home);
  const homeCity = homeProfile.entered ? homeProfile.city : guessCity();

  const newDeal = useCallback(() => {
    const m = lib.settings.market;
    lib.insertDeal(homeRules === 'ca' ? { ...switchRules(DEFAULT_DEAL, 'ca'), city: homeCity, downPct: OWN_DOWN_PCT, rate: m.rate, refiRate: m.rate, termYears: m.amortYears } : {});
    setView('analyze');
    if (!isDesktop) setSheetOpen(true);
    toast({ tone: 'info', text: 'New deal started. Fill in the inputs and everything updates as you type.' });
  }, [lib, homeRules, homeCity, setView, isDesktop, toast]);

  // The quick check: a new deal from a price, a type and a rent, with everything else typical.
  const quickCheck = useCallback(
    (fields) => {
      lib.insertDeal(quickDeal(fields, lib.settings.market));
      setHelpOpen(false);
      setView('analyze');
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      toast({
        tone: 'info',
        text: `Here’s your property. Taxes, insurance and running costs are typical estimates: ${isDesktop ? 'change them in the inputs on the left' : 'tap Edit deal to change them'}.`,
      });
    },
    [lib, setView, isDesktop, toast],
  );

  // A shared link (#deal=…) opens that deal: saved once, then the address bar is tidied.
  const linkRead = useRef(false);
  useEffect(() => {
    if (linkRead.current) return;
    linkRead.current = true;
    const shared = readShared(window.location.hash);
    if (!shared) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setFromLink(true);
    setView('analyze');
    const saved = deals.find((d) => shared.sharedId && d.sharedId === shared.sharedId && sameDeal(d, shared.fields));
    if (saved) {
      lib.setActive(saved.id);
      toast({ tone: 'info', text: `Opened “${saved.name}”, saved from this link before.` });
      return;
    }
    withUndo(`Added “${shared.fields.name}” from a shared link`, () => lib.insertDeal({ ...shared.fields, ...(shared.sharedId ? { sharedId: shared.sharedId } : {}) }));
  }, [deals, lib, setView, toast, withUndo]);

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
  const baseMarket = lib.settings.market;
  const rents = useMemo(() => normalizeMarket(baseMarket).rents, [baseMarket]);
  // Listings for one city at a time: the one picked on the Listings tab, else where you're buying.
  const marketIndex = useMarketIndex();
  // The homepage links to a city's listings; open on that city and remember it as the one picked.
  const [linkedCity] = useState(cityFromAddress);
  useEffect(() => {
    if (linkedCity) lib.updateSettings('market', { listingCity: linkedCity });
  }, [linkedCity]); // eslint-disable-line react-hooks/exhaustive-deps
  const listCity = listingCity(baseMarket?.listingCity ?? linkedCity, homeCity, marketIndex.feed);
  const market = useMemo(() => localMarket(baseMarket, listCity), [baseMarket, listCity]);
  const marketFeed = useMarket(listCity);

  // Portfolio, Compare and Plan wait behind More until you have two deals of your own or own a property.
  const ownDeals = deals.filter((d) => !d.example);
  const tabsUnlocked = allTabs || ownDeals.length >= 2 || ownDeals.some((d) => d.status === 'owned');
  const tabs = tabsUnlocked ? VIEWS : VIEWS.filter((v) => v.basic);
  // Going to one of them any other way (search, a saved view) brings them all out.
  useEffect(() => {
    if (!BASIC_VIEWS.has(view)) showAllTabs();
  }, [view, showAllTabs]);
  const revealTabs = () => {
    showAllTabs();
    // The More button goes away: hand focus to the first tab it brought out.
    requestAnimationFrame(() => document.querySelector(`header nav[aria-label="Views"] button:nth-child(${BASIC_VIEWS.size + 1})`)?.focus());
  };
  const importedIds = useMemo(() => new Set(deals.map((d) => d.listingId).filter(Boolean)), [deals]);
  // A listing opens as a deal with the loan its view counts: a DSCR loan on
  // Analyze, or your own 20% down on Cash.
  const analyzeListing = useCallback(
    (listing) => {
      const tab = normalizeMarket(market).lens === 'own' ? 'cash' : 'analyze';
      const existing = deals.find((d) => d.listingId === listing.id);
      if (existing) lib.setActive(existing.id);
      else withUndo(`Added “${listing.address}” to your deals`, () => lib.insertDeal(listingToDeal(listing, market)));
      setView(tab);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [deals, market, withUndo, lib, setView],
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

  // Jump to an Analyze section, opening it first; on phones the inputs open in their sheet.
  const jump = useCallback(
    (id) => {
      if (DETAIL_IDS.includes(id)) openSection(id, true);
      const go = (tries = 0) => {
        if (id === 'sec-inputs' && !isDesktop) {
          setSheetOpen(true);
          return;
        }
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        else if (tries < 12) setTimeout(() => go(tries + 1), 100); // lazy sections may still be loading
      };
      // Scroll once the view (or the newly opened section) has rendered: a page
      // that's still folded may be too short to bring the section to the top.
      if (view !== 'analyze') setView('analyze');
      if (view !== 'analyze' || DETAIL_IDS.includes(id)) setTimeout(() => go(), 50);
      else go();
    },
    [view, setView, isDesktop, openSection],
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
      ...VIEWS.map((v) => ({ id: `view-${v.value}`, group: 'Go to', label: v.label, icon: v.icon, keywords: `view tab page ${v.keywords ?? ''}`, run: () => setView(v.value) })),
      ...baseItems.map((x) => ({
        id: `deal-${x.deal.id}`,
        group: 'Deals',
        label: x.deal.name,
        hint: `DSCR ${ratio(x.a.dscr)} · ${money(x.a.netCashFlow, { signed: true })}/mo`,
        icon: x.deal.status === 'owned' ? Building : Home,
        keywords: `${x.deal.address ?? ''} ${x.deal.status} open deal`,
        run: () => pickDeal(x.deal.id),
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
      { id: 'act-quick', group: 'Actions', label: 'Quick check a property', icon: Calculator, keywords: 'price rent simple fast beginner try', run: () => setHelpOpen(true) },
      { id: 'act-help', group: 'Actions', label: 'How Bedrock works', icon: CircleHelp, keywords: 'help guide words terms glossary meaning tabs start beginner', run: () => setHelpOpen(true) },
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
      { id: 'act-share', group: 'Actions', label: `Share “${active.name}” as a link`, icon: Share2, keywords: 'send url copy partner lender friend', run: () => setShareOpen(true) },
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
      ...SECTIONS.map((s) => ({ id: `jump-${s.id}`, group: 'Jump to section', label: s.label, icon: s.id === 'sec-opinion' ? Sparkles : ListTree, keywords: `section scroll analyze ${s.keywords}`, run: () => jump(s.id) })),
    ];
    return list;
  }, [baseItems, topListings, analyzeListing, active, inCompare, compare.length, exports, dark, toggle, neutral, deals.length, newDeal, duplicateDeal, deleteDeal, jump, pickDeal, lib, toast, setView, withUndo]);

  // "Open all" ignores the second opinion, which only shows inside Claude.
  const allOpen = DETAIL_IDS.filter((id) => id !== 'sec-opinion' && (id !== 'sec-refi' || current.refi)).every((id) => sections.isOpen(id));

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

  // On a phone, the bar above the tabs keeps the deal's result in view: the
  // DSCR loan on Analyze (with any what-if), your own 20% down on Cash.
  const own = useMemo(() => analyzeDeal(ownMoney(active)), [active]);
  const dockResult =
    view === 'analyze'
      ? { value: money(a.netCashFlow, { signed: true }), valueClass: signedClass(a.netCashFlow), sub: `${percent(a.coc, 1)} return · DSCR ${ratio(a.dscr)}` }
      : view === 'cash'
        ? { value: money(own.netCashFlow, { signed: true }), valueClass: signedClass(own.netCashFlow), sub: `${percent(own.coc, 1)} return · ${money(own.pi)} mortgage` }
        : null;

  const editActive = useCallback((patch) => lib.updateDeal(active.id, patch), [lib, active.id]);

  const inputs = (bare = false) => (
    <InputsPanel
      bare={bare}
      deal={active}
      a={base.a}
      rents={rents}
      onShare={() => setShareOpen(true)}
      onChange={editActive}
      onDuplicate={() => duplicateDeal(active)}
      onDelete={deals.length > 1 ? () => deleteDeal(active) : null}
    />
  );

  return (
    <SectionsContext.Provider value={sections}>
      <div className="relative min-h-screen bg-(--page) print:hidden">
        <a
          href="#main"
          className="sr-only z-[100] rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <header className="relative z-30 border-b border-hairline bg-(--page) lg:sticky lg:top-[env(safe-area-inset-top,0px)]">
          <div className="gutter mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 py-2 lg:flex-nowrap lg:py-0">
            <h1 className="shrink-0 lg:py-3">
              <a
                href={HOME_PAGE}
                {...(HOME_PAGE.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                aria-label="Bedrock home page"
                title="Bedrock home page"
                className="block rounded-sm transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500"
              >
                <Logo />
              </a>
            </h1>

            {/* From lg up the views are text tabs here; phones and tablets get them along the bottom (Dock). */}
            <nav aria-label="Views" className="thin-scroll hidden min-w-0 flex-1 self-stretch overflow-x-auto lg:flex">
              {tabs.map((v) => (
                <button key={v.value} type="button" aria-current={v.value === view ? 'page' : undefined} onClick={() => setView(v.value)} className={tabClass(v.value === view)}>
                  {v.label}
                </button>
              ))}
              {!tabsUnlocked && (
                <button type="button" onClick={revealTabs} className={tabClass(false)} aria-label="More tabs: Portfolio, Compare and Plan" title="More tabs">
                  <Ellipsis className="size-4" aria-hidden /> More
                </button>
              )}
            </nav>

            <div className="order-4 w-full pb-1 lg:order-none lg:w-auto lg:pb-0">
              <DealPicker items={baseItems} activeId={activeId} onSelect={pickDeal} onNew={newDeal} />
            </div>

            <div className="ml-auto flex items-center gap-1 lg:ml-0">
              <button type="button" onClick={() => setPaletteOpen(true)} className={headerIcon} aria-label="Search deals and commands" title={`Search (${shortcutLabel})`}>
                <Search className="size-4" aria-hidden />
                <kbd className="hidden rounded-[3px] px-1.5 py-0.5 font-sans text-[11px] text-zinc-500 ring-1 ring-(--line-strong) ring-inset min-[1400px]:inline dark:text-zinc-400">{shortcutLabel}</kbd>
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
              <button type="button" onClick={() => setHelpOpen(true)} className={headerIcon} aria-label="How Bedrock works" title="How Bedrock works">
                <CircleHelp className="size-4" aria-hidden />
              </button>
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

            {view === 'landlord' && <LandlordView homeCity={homeCity} />}

            {view === 'plan' && (
              <PlanView owned={owned} deals={baseItems} plan={lib.settings.plan} onPlan={(patch) => lib.updateSettings('plan', patch)} dark={dark} onOpen={openDeal} />
            )}

            {view === 'home' && (
              <HomeView
                profile={lib.settings.home}
                suite={lib.settings.suite}
                market={normalizeMarket(baseMarket)}
                items={baseItems}
                liveDealId={liveDealId ?? activeId}
                onHome={(patch) => lib.updateSettings('home', patch)}
                onSuite={(patch) => lib.updateSettings('suite', patch)}
                onPickDeal={setLiveDealId}
                onOpen={openDeal}
              />
            )}

            {view === 'listings' && (
              <ListingsView
                feedState={marketFeed}
                indexState={marketIndex}
                city={listCity}
                onCity={(listingCity) => lib.updateSettings('market', { listingCity })}
                market={market}
                targets={targets}
                profile={lib.settings.home}
                importedIds={importedIds}
                onMarket={(patch) => lib.updateSettings('market', homePatch(patch, market))}
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
              {!fromLink && <Welcome country={homeRules} city={homeCity} rents={rents} onQuickCheck={quickCheck} />}
              <HeroSummary
                deal={current.deal}
                a={a}
                base={neutral ? null : base.a}
                onShare={() => setShareOpen(true)}
                onChange={editActive}
                whatIf={neutral ? null : { text: whatIfSummary(active, adj) ?? 'Testing new numbers.', onReset: () => setAdj(NO_ADJ), onApply: applyWhatIf }}
              />

              <div className="grid gap-6 lg:grid-cols-12">
                {isDesktop && (
                  <aside className="lg:col-span-4 xl:col-span-3" aria-label="Deal inputs">
                    <div className="thin-scroll lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:rounded-md">{inputs()}</div>
                  </aside>
                )}

                <div className="min-w-0 space-y-3 lg:col-span-8 xl:col-span-9">
                  <div className="flex items-end justify-between gap-3 px-1 pt-1">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-white">The details</span>
                      Each line sums up one part of the deal. Open it to see how the number adds up.
                    </p>
                    <Button variant="ghost" className="shrink-0 px-2.5 py-1.5 text-xs" onClick={() => sections.setMany(DETAIL_IDS, !allOpen)}>
                      {allOpen ? 'Close all' : 'Open all'}
                    </Button>
                  </div>
                  <SectionGroup>
                    <LenderVsReality a={a} />
                    <MaxOfferCard
                      deal={current.deal}
                      targets={targets}
                      onTargets={(patch) => lib.updateSettings('targets', patch)}
                      onUsePrice={(price) => withUndo(`Price set to ${money(price)}`, () => lib.updateDeal(active.id, { price }))}
                    />
                    {sliders}
                    <StressTestCard deal={active} adj={adj} onPick={(p) => setAdj((x) => ({ ...x, ...p }))} />
                    <ProjectionChart rows={current.rows} a={a} deal={current.deal} dark={dark} appreciationPct={Number(current.deal.appreciationPct)} />
                    {current.refi && <RefiCard refi={current.refi} a={a} deal={current.deal} />}
                    <ExitCard sale={current.sale} deal={current.deal} />
                    <TaxCard deal={current.deal} tax={lib.settings.tax} onTax={(patch) => lib.updateSettings('tax', patch)} />
                    <SecondOpinion item={current} targets={targets} />
                  </SectionGroup>
                </div>
              </div>
            </>
          )}

          {view === 'cash' && (
            <div className="grid gap-6 lg:grid-cols-12">
              {isDesktop && (
                <aside className="lg:col-span-4 xl:col-span-3" aria-label="Deal inputs">
                  <div className="thin-scroll lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:rounded-md">{inputs()}</div>
                </aside>
              )}
              <div className="min-w-0 lg:col-span-8 xl:col-span-9">
                <Suspense fallback={<SkeletonCard className="h-[28rem]" />}>
                  <CashView
                    deal={active}
                    items={baseItems}
                    targets={targets}
                    onTargets={(patch) => lib.updateSettings('targets', patch)}
                    tax={lib.settings.tax}
                    onTax={(patch) => lib.updateSettings('tax', patch)}
                    onSelect={pickDeal}
                    onUsePrice={(price) => withUndo(`Price set to ${money(price)}`, () => lib.updateDeal(active.id, { price }))}
                    onChange={editActive}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {(view === 'analyze' || view === 'cash') && !isDesktop && (
            // display: contents keeps main's space-y margin off the fixed sheet, which would shorten it.
            <div className="contents">
              <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Edit “${active.name}”`}>
                {inputs(true)}
              </Sheet>
            </div>
          )}

          <footer className="dock-space mt-4 flex flex-col gap-4 border-t border-hairline pt-6 text-xs leading-relaxed text-zinc-500 sm:flex-row sm:items-start dark:text-zinc-400">
            <div className="flex shrink-0 flex-col gap-2">
              <a href={HOME_PAGE} {...(HOME_PAGE.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})} className="flex items-center gap-2 hover:opacity-80">
                <LogoMark className="size-6" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Bedrock</span>
              </a>
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
        {!isDesktop && <Dock views={VIEWS} view={view} onView={setView} result={dockResult} onEdit={() => setSheetOpen(true)} />}
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} />}
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpSheet
            onClose={() => setHelpOpen(false)}
            views={VIEWS}
            country={homeRules}
            city={homeCity}
            rents={rents}
            onQuickCheck={quickCheck}
            moreHidden={isDesktop && !tabsUnlocked}
            onShowAll={showAllTabs}
          />
        </Suspense>
      )}
      {shareOpen && (
        <Suspense fallback={null}>
          <ShareSheet deal={active} onClose={() => setShareOpen(false)} />
        </Suspense>
      )}
      <DealMemo item={current} />
    </SectionsContext.Provider>
  );
}
