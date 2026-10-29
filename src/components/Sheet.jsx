import { useEffect, useEffectEvent, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Slide-up panel for phones and tablets. Locks page scroll while open,
 * closes on Escape or a backdrop tap, and returns focus to the opener.
 * With `desktop`, it also shows on large screens, as a panel on the right.
 */
export default function Sheet({ open, onClose, title, children, desktop = false }) {
  const closeBtn = useRef(null);
  const returnFocus = useRef(null);
  // Callers pass a new onClose on every render. Reading it through an effect
  // event keeps the effect below to opening and closing; re-running it on each
  // keystroke moved focus to Done and dropped the phone keyboard.
  const onEscape = useEffectEvent((e) => e.key === 'Escape' && onClose());

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e) => onEscape(e);
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-[70] print:hidden ${desktop ? '' : 'lg:hidden'}`}>
      <div className="pop absolute inset-0 bg-zinc-950/40 dark:bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet popover absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl ${desktop ? 'lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-4 lg:max-h-none lg:w-[30rem] lg:rounded-3xl' : ''}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 pt-3 pb-3">
          <div className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-400/50 lg:hidden" aria-hidden />
          <h2 className="pt-1 text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            className="mt-1 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-well focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
          >
            Done
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="thin-scroll gutter flex-1 overflow-y-auto py-4">{children}</div>
      </div>
    </div>
  );
}
