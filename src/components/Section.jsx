import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, IconTile } from './ui.jsx';

const KEY = 'bedrock-sections';

/** Which sections are open; App provides it so jumping to a section can open it. */
export const SectionsContext = createContext(null);

function readStored() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Open/closed state for every section, remembered in this browser so a page reads the way you left it. */
export function useSectionsState() {
  const [state, setState] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // per-viewer convenience only
    }
  }, [state]);

  const setOpen = useCallback((id, open) => setState((s) => ({ ...s, [id]: open })), []);
  const setMany = useCallback((ids, open) => setState((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, open])) })), []);
  return useMemo(() => ({ isOpen: (id, fallback = false) => state[id] ?? fallback, setOpen, setMany }), [state, setOpen, setMany]);
}

const useSections = () => useContext(SectionsContext);

/**
 * A card that folds down to one line: its title, its key number and what that
 * number means. Opening it shows the full detail, so nothing is lost, only tucked away.
 */
export function Section({ id, icon, title, value, valueClass = '', meaning, subtitle, actions, defaultOpen = false, delay = 0, className = '', children }) {
  const ctx = useSections();
  const [local, setLocal] = useState(defaultOpen);
  const open = ctx ? ctx.isOpen(id, defaultOpen) : local;
  const toggle = () => (ctx ? ctx.setOpen(id, !open) : setLocal(!open));
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;

  return (
    <Card id={id} delay={delay} className={`@container ${className}`}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={toggle}
          className="flex w-full items-start gap-3 rounded-3xl px-4 py-3.5 text-left transition hover:bg-white/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 sm:px-5 sm:py-4 dark:hover:bg-white/[0.03]"
        >
          {icon && <IconTile icon={icon} className="mt-0.5" />}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span id={titleId} className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">
                {title}
              </span>
              {value != null && <span className={`tabular text-[15px] font-semibold ${valueClass || 'text-zinc-900 dark:text-white'}`}>{value}</span>}
            </span>
            {meaning && <span className="mt-0.5 block text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">{meaning}</span>}
          </span>
          <ChevronDown className={`mt-2.5 size-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </h2>
      {open && (
        <div id={bodyId} role="region" aria-labelledby={titleId} className="border-t border-hairline">
          {(subtitle || actions) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
              {subtitle && <p className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      )}
    </Card>
  );
}
