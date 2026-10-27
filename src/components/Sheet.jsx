import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Slide-up panel for phones and tablets. Locks page scroll while open,
 * closes on Escape or a backdrop tap, and returns focus to the opener.
 */
export default function Sheet({ open, onClose, title, children }) {
  const closeBtn = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] lg:hidden print:hidden">
      <div className="pop absolute inset-0 bg-zinc-950/35 backdrop-blur-[2px] dark:bg-black/55" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet glass-strong absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 pt-3 pb-3">
          <div className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-400/50" aria-hidden />
          <h2 className="pt-1 text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            className="mt-1 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
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
