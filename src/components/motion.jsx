import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { GLOSSARY } from '../lib/glossary.js';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Charts read this to skip their entrance animation for reduced-motion users. */
export const CHART_ANIMATE = !prefersReducedMotion();

/** Tween a number toward `value` with an ease-out curve. */
export function useAnimatedNumber(value, duration = 650) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isFinite(from.current) || prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const origin = from.current;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = origin + (value - origin) * eased;
      from.current = v;
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return shown;
}

/** A number that counts toward its new value instead of jumping. */
export function Num({ value, format }) {
  const v = useAnimatedNumber(value);
  return <span className="tabular">{format(v)}</span>;
}

/**
 * Small (i) button with a plain-English explanation. Rendered in a portal
 * with fixed positioning so scroll containers and tables never clip it.
 * A mouse previews it on hover; a tap, click or keyboard focus opens it, and
 * Escape, a tap elsewhere, scrolling or leaving with the mouse closes it.
 */
export function InfoTip({ k, className = '' }) {
  const entry = GLOSSARY[k];
  const btn = useRef(null);
  const descId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const half = 136;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 12), window.innerWidth - half - 12);
    const below = r.top < 150;
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8, below });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (e) => e.key === 'Escape' && close();
    // Touch browsers don't always move focus on a tap, so blur alone can't close it.
    const onDown = (e) => !btn.current?.contains(e.target) && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!entry) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`What is ${entry.term}?`}
        aria-describedby={descId}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Opens rather than toggles: a tap also fires focus, which would undo a toggle.
        onClick={() => setOpen(true)}
        className={`inline-grid size-4 shrink-0 place-items-center rounded-full align-middle text-zinc-500/80 transition hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-500 dark:hover:text-emerald-400 ${className}`}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {/* Screen readers get the explanation as the button's description, open or not. */}
      <span id={descId} hidden>
        {entry.body}
      </span>
      {open &&
        pos &&
        createPortal(
          <div
            aria-hidden
            className="popover pointer-events-none fixed z-[100] w-[272px] rounded-2xl px-3.5 py-3 text-left text-xs leading-relaxed normal-case tracking-normal text-zinc-600 dark:text-zinc-300"
            style={{ left: pos.left, top: pos.top, transform: `translate(-50%, ${pos.below ? '0' : '-100%'})` }}
          >
            <div className="mb-0.5 font-semibold text-zinc-900 dark:text-white">{entry.term}</div>
            {entry.body}
          </div>,
          // Inside <main> (see App) so tips sit in a landmark; body outside the app.
          document.getElementById('tip-layer') ?? document.body,
        )}
    </>
  );
}
