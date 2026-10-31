import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Cloud, FileSpreadsheet, FileText, Moon, RotateCcw, Sun, UserRound } from 'lucide-react';

/**
 * The header's one menu: your account and sync, exports, help, the theme,
 * and starting over. Keeps the header to search plus this button.
 */
export default function AppMenu({ synced, syncText, dark, onToggleTheme, onAccount, onHelp, exports, dealName, count, onReset }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const first = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus();
    const away = (e) => !root.current?.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...root.current.querySelectorAll('[role="menuitem"]')];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const act = (fn) => () => {
    setOpen(false);
    fn();
  };
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-well focus-visible:bg-well focus-visible:outline-none dark:text-zinc-200';
  const icon = 'size-4 shrink-0 text-zinc-500 dark:text-zinc-400';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu: account, export, help${synced ? ' (synced)' : ''}`}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 place-items-center rounded-full bg-well text-zinc-700 ring-1 ring-(--line-strong) transition ring-inset hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:text-white"
      >
        <UserRound className="size-4" aria-hidden />
        {synced && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-(--page)" aria-hidden />}
      </button>
      {open && (
        <div role="menu" aria-label="Menu" className="popover pop absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl p-1.5">
          <button ref={first} type="button" role="menuitem" onClick={act(onAccount)} className={`${item} py-2.5`}>
            <Cloud className={`size-4 shrink-0 ${synced ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`} aria-hidden />
            <span className="min-w-0">
              <span className="block font-medium">{synced ? 'Your account' : 'Sync your devices'}</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{syncText}</span>
            </span>
          </button>
          <div className="my-1 border-t border-hairline" />
          <button type="button" role="menuitem" onClick={act(exports.exportPdf)} className={item} disabled={exports.busy === 'pdf'}>
            <FileText className={icon} aria-hidden />
            <span className="min-w-0 truncate">Deal memo (PDF){dealName ? `: ${dealName}` : ''}</span>
          </button>
          <button type="button" role="menuitem" onClick={act(exports.exportCsv)} className={item} disabled={exports.busy === 'csv'}>
            <FileSpreadsheet className={icon} aria-hidden />
            All {count} deals (CSV)
          </button>
          <div className="my-1 border-t border-hairline" />
          <button type="button" role="menuitem" onClick={act(onToggleTheme)} className={item}>
            {dark ? <Sun className={icon} aria-hidden /> : <Moon className={icon} aria-hidden />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" role="menuitem" onClick={act(onHelp)} className={item}>
            <CircleHelp className={icon} aria-hidden />
            How Bedrock works
          </button>
          <button type="button" role="menuitem" onClick={act(onReset)} className={item}>
            <RotateCcw className={icon} aria-hidden />
            Start over with the examples
          </button>
        </div>
      )}
    </div>
  );
}
