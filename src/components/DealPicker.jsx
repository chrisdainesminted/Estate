import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Home, Plus, Search } from 'lucide-react';
import { money, ratio } from '../lib/format.js';
import { BAND_CLASSES } from '../lib/dscr.js';
import { ExampleTag, signedClass } from './ui.jsx';

function Group({ title, items, activeId, onPick }) {
  if (!items.length) return null;
  return (
    <div className="py-1.5">
      <div className="eyebrow px-3 pt-1 pb-1.5">
        {title} · {items.length}
      </div>
      {items.map(({ deal, a }) => {
        const selected = deal.id === activeId;
        return (
          <button
            key={deal.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onPick(deal.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
              selected ? 'bg-emerald-500/10 dark:bg-emerald-400/10' : 'hover:bg-zinc-950/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <span className="grid size-5 shrink-0 place-items-center text-emerald-600 dark:text-emerald-400">{selected && <Check className="size-4" aria-hidden />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">{deal.name}</span>
                {deal.example && <ExampleTag />}
              </span>
              <span className="tabular block text-[11px] text-zinc-500 dark:text-zinc-400">
                {a.units} {a.units === 1 ? 'door' : 'doors'} · {money(a.price)}
              </span>
            </span>
            <span className="text-right">
              <span className={`tabular block text-sm font-semibold ${signedClass(a.netCashFlow)}`}>{money(a.netCashFlow, { signed: true })}/mo</span>
              <span className={`tabular block text-[11px] font-medium ${BAND_CLASSES[a.status.key].text}`}>DSCR {ratio(a.dscr)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Header control for switching between any number of saved deals. */
export default function DealPicker({ items, activeId, onSelect, onNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef(null);
  const search = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    search.current?.focus();
    const onDown = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = items.find((x) => x.deal.id === activeId) ?? items[0];
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((x) => `${x.deal.name} ${x.deal.address ?? ''}`.toLowerCase().includes(q)) : items;
  const pick = (id) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-xl bg-white/60 py-1.5 pr-2.5 pl-2 text-left ring-1 ring-zinc-950/10 transition ring-inset hover:bg-white/90 md:w-72 lg:w-60 xl:w-72 dark:bg-white/[0.06] dark:ring-white/10 dark:hover:bg-white/10"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
          <Home className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-semibold text-zinc-900 dark:text-white">{current.deal.name}</span>
          <span className="tabular block text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
            {current.deal.status === 'owned' ? 'Owned' : 'Prospect'} · DSCR {ratio(current.a.dscr)} · {money(current.a.netCashFlow, { signed: true })}/mo
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" aria-hidden />
      </button>

      {open && (
        <div className="glass-strong pop absolute top-full right-0 left-0 z-50 mt-2 w-auto overflow-hidden rounded-2xl md:left-auto md:w-[380px]">
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
            <Search className="size-4 text-zinc-400" aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${items.length} deals`}
              aria-label="Search deals"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
            />
          </div>
          <div role="listbox" aria-label="Deals" className="thin-scroll max-h-[min(60vh,440px)] overflow-y-auto px-1.5">
            <Group title="Prospects" items={shown.filter((x) => x.deal.status !== 'owned')} activeId={activeId} onPick={pick} />
            <Group title="Owned" items={shown.filter((x) => x.deal.status === 'owned')} activeId={activeId} onPick={pick} />
            {!shown.length && <p className="px-3 py-6 text-center text-sm text-zinc-500">No deals match “{query}”.</p>}
          </div>
          <div className="border-t border-hairline p-2">
            <button
              type="button"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
            >
              <Plus className="size-4" aria-hidden /> New deal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
