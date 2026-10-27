import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, Undo2, X, XCircle } from 'lucide-react';

// App-wide toasts: short confirmations, errors, and Undo for anything
// destructive, so actions can be one click instead of a confirm dialog.

const ToastContext = createContext(() => {});

const ICONS = { ok: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  error: 'text-red-700 dark:text-red-400',
  info: 'text-zinc-500 dark:text-zinc-400',
};

function ToastItem({ t, close }) {
  const Icon = ICONS[t.tone] ?? Info;
  const timer = useRef(0);
  // Stable per toast, so a new toast arriving doesn't restart this one's countdown.
  const onClose = useCallback(() => close(t.id), [close, t.id]);
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onClose, t.duration);
  }, [onClose, t.duration]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      className="glass-strong pop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl py-2.5 pr-2 pl-3.5 text-sm text-zinc-800 dark:text-zinc-100"
      // Hovering or focusing pauses the countdown so Undo stays reachable.
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
      onFocus={() => clearTimeout(timer.current)}
      onBlur={start}
    >
      <Icon className={`size-4 shrink-0 ${TONES[t.tone] ?? TONES.info}`} aria-hidden />
      <span className="min-w-0 flex-1 break-words">{t.text}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action.onClick();
            onClose();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
        >
          <Undo2 className="size-3.5" aria-hidden />
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition dark:text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const close = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback((opts) => {
    seq.current += 1;
    const t = { id: seq.current, tone: 'ok', duration: opts.action ? 7000 : 4000, ...opts };
    // Keep at most three on screen; the newest is last.
    setToasts((ts) => [...ts.slice(-2), t]);
    return t.id;
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="toast-stack pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 print:hidden"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} close={close} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
