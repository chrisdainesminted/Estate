import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

// Every word typed must appear somewhere in the command; labels that start
// with the query rank first, then labels that contain it, then the rest.
function rank(commands, query) {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const words = q.split(/\s+/);
  return commands
    .map((c, i) => {
      const label = c.label.toLowerCase();
      const hay = `${label} ${c.group} ${c.keywords ?? ''}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
      return { c, score, i };
    })
    .filter(Boolean)
    .sort((p, q2) => p.score - q2.score || p.i - q2.i)
    .map((x) => x.c);
}

/**
 * Search-and-run box for deals, views, page sections and actions. Mount it
 * only while open, so each open starts with an empty search.
 * commands: [{ id, group, label, hint?, icon, keywords?, run }]
 */
export default function CommandPalette({ onClose, commands }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const returnFocus = useRef(null);

  const results = useMemo(() => rank(commands, query), [commands, query]);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    // The input also has autoFocus; this covers browsers that skip it.
    input.current?.focus();
    return () => {
      root.style.overflow = prev;
      returnFocus.current?.focus?.();
    };
  }, []);

  useEffect(() => setActive(0), [query]);

  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  const run = (c) => {
    onClose();
    // Let the dialog close (and focus return) before the command moves things around.
    setTimeout(() => c.run(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) run(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // The palette is modal: keep focus in the search box.
      e.preventDefault();
    }
  };

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[80] print:hidden" role="presentation">
      <div className="pop absolute inset-0 bg-zinc-950/30 backdrop-blur-[2px] dark:bg-black/50" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search deals and commands"
        className="glass-strong pop absolute left-1/2 flex max-h-[min(70vh,560px)] w-[min(640px,calc(100%-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-3xl"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + min(14vh, 120px))' }}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
          <Search className="size-5 shrink-0 text-zinc-400" aria-hidden />
          <input
            ref={input}
            autoFocus
            id="command-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search deals, views and actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
          />
          <kbd className="hidden rounded-md bg-zinc-950/[0.06] px-1.5 py-0.5 font-sans text-[11px] text-zinc-500 sm:block dark:bg-white/10 dark:text-zinc-400">Esc</kbd>
        </div>
        <ul ref={list} id="command-list" role="listbox" aria-label="Results" className="thin-scroll flex-1 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-zinc-500">Nothing matches “{query}”.</li>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const selected = i === active;
            return (
              <li key={c.id} role="presentation">
                {header && <div className="eyebrow px-3 pt-3 pb-1.5">{header}</div>}
                <div
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${selected ? 'bg-emerald-500/10 dark:bg-emerald-400/10' : ''}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-950/[0.05] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                    <c.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-white">{c.label}</span>
                  {c.hint && <span className="tabular hidden shrink-0 text-xs text-zinc-500 sm:block dark:text-zinc-400">{c.hint}</span>}
                  {selected && <CornerDownLeft className="size-3.5 shrink-0 text-zinc-400" aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-hairline px-4 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span className="ml-auto">{shortcutLabel} anywhere</span>
        </div>
      </div>
    </div>
  );
}
