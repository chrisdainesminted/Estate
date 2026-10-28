import { forwardRef, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import { BAND_CLASSES } from '../lib/dscr.js';
import { ratio } from '../lib/format.js';
import { InfoTip } from './motion.jsx';

/** Glass panel. `delay` (ms) staggers its entrance when a view opens. */
export function Card({ className = '', delay = 0, style, children, ...rest }) {
  return (
    <section className={`glass rise rounded-3xl ${className}`} style={{ animationDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </section>
  );
}

export function IconTile({ icon: Icon, className = '' }) {
  return (
    <div
      className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-emerald-400/25 to-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20 ring-inset dark:from-emerald-300/20 dark:to-emerald-500/5 dark:text-emerald-300 dark:ring-emerald-300/20 ${className}`}
    >
      <Icon className="size-[18px]" aria-hidden />
    </div>
  );
}

export function CardHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconTile icon={icon} />}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BAND_ICONS = { negative: XCircle, tight: AlertTriangle, sweet: CheckCircle2, strong: ShieldCheck };

/** Status chip: icon + label + optional value, so status never relies on color alone. */
export function DscrChip({ status, dscr, size = 'md' }) {
  const Icon = BAND_ICONS[status.key] ?? TrendingUp;
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${sz} ${BAND_CLASSES[status.key].chip}`}>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {dscr !== undefined && <span className="tabular font-semibold">{ratio(dscr)}</span>}
      {status.label}
    </span>
  );
}

export const Button = forwardRef(function Button({ variant = 'secondary', className = '', children, ...rest }, ref) {
  const styles = {
    primary:
      'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-semibold shadow-[0_10px_24px_-10px_rgb(5_150_105/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] ring-1 ring-emerald-800/40 ring-inset hover:from-emerald-500 hover:to-emerald-700 disabled:shadow-none',
    secondary:
      'bg-white/60 text-zinc-800 ring-1 ring-zinc-950/10 ring-inset hover:bg-white/90 dark:bg-white/[0.06] dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-white/[0.1]',
    ghost: 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white',
  };
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Two-or-more option segmented control. `stretch` fills the row on phones. */
export function Segmented({ options, value, onChange, label, size = 'md', stretch = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${stretch ? 'flex w-full md:inline-flex md:w-auto' : 'inline-flex'} rounded-xl bg-zinc-950/5 p-1 ring-1 ring-zinc-950/5 ring-inset dark:bg-white/[0.05] dark:ring-white/10`}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center rounded-lg font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-emerald-500 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${stretch ? 'max-md:flex-1 max-md:justify-center max-md:px-1 max-md:text-[13px] max-[400px]:px-0.5! max-[400px]:text-xs! max-[340px]:text-[11px]!' : ''} ${
              selected
                ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.12)] ring-1 ring-zinc-950/5 dark:bg-white/[0.14] dark:text-white dark:ring-white/10'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {o.icon && <o.icon className="mr-1.5 size-3.5 max-sm:hidden" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const fieldText = 'text-sm text-zinc-900 dark:text-zinc-100';

function formatForDisplay(v, decimals) {
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/** Field label; an optional glossary tip sits beside it, outside the <label>, so clicking it never focuses the input. */
export function FieldLabel({ htmlFor, children, tip }) {
  return (
    <div className="mb-1.5 flex items-center gap-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {children}
      </label>
      {tip && <InfoTip k={tip} />}
    </div>
  );
}

/**
 * Numeric input that tolerates partial typing ("", "7.") and shows thousands
 * separators when not focused. Commits only valid numbers, clamped to [min, max].
 */
export function NumberField({ id, label, tip, value, onChange, prefix, suffix, min = 0, max, step = 1, decimals = 2, hint }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(formatForDisplay(value, decimals));

  useEffect(() => {
    if (!focused) setText(formatForDisplay(value, decimals));
  }, [value, focused, decimals]);

  const commit = (raw) => {
    setText(raw);
    const n = parseFloat(raw.replace(/[,$%\s]/g, ''));
    if (Number.isNaN(n)) return;
    let v = n;
    if (min !== undefined) v = Math.max(v, min);
    if (max !== undefined) v = Math.min(v, max);
    onChange(v);
  };

  return (
    <div>
      <FieldLabel htmlFor={id} tip={tip}>
        {label}
      </FieldLabel>
      <div className="field flex items-center">
        {prefix && <span className="pl-3 text-sm text-zinc-500 dark:text-zinc-400">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          // Leave the text untouched on focus: rewriting it would drop the
          // browser's select-all and make typing append instead of replace.
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = (Number(value) || 0) + (e.key === 'ArrowUp' ? step : -step);
              commit(String(Math.round(next * 1e6) / 1e6));
            }
          }}
          className={`tabular w-full min-w-0 bg-transparent px-3 py-2.5 outline-none ${fieldText}`}
        />
        {suffix && <span className="pr-3 text-sm whitespace-nowrap text-zinc-500 dark:text-zinc-400">{suffix}</span>}
      </div>
      {hint && <p className="tabular mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function SelectField({ id, label, tip, value, onChange, children }) {
  return (
    <div>
      <FieldLabel htmlFor={id} tip={tip}>
        {label}
      </FieldLabel>
      <select id={id} value={value} onChange={onChange} className={`field w-full px-3 py-2.5 ${fieldText}`}>
        {children}
      </select>
    </div>
  );
}

export function Stat({ label, value, sub, tip, className = '' }) {
  return (
    <div className={className}>
      <div className="eyebrow flex items-center gap-1">
        {label}
        {tip && <InfoTip k={tip} />}
      </div>
      <div className="tabular mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{value}</div>
      {sub && <div className="tabular text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </div>
  );
}

/**
 * A headline number in a 2×2 (phones) or 1×4 (desktop) grid, with a plain
 * sentence saying what it means. `base` shows the saved value during a what-if.
 */
export function KpiTile({ label, tip, value, valueClass, meaning, extra, base }) {
  return (
    <div className="border-hairline p-4 sm:p-5 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:[&:not(:last-child)]:border-r">
      <dt className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {tip && <InfoTip k={tip} />}
      </dt>
      <dd className={`mt-1.5 text-[26px] leading-none font-semibold tracking-tight sm:text-[32px] ${valueClass || 'text-zinc-900 dark:text-white'}`}>{value}</dd>
      {extra}
      <dd className="mt-2 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{meaning}</dd>
      {base && (
        <dd className="tabular mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Before what-if: <span className="font-medium text-zinc-700 dark:text-zinc-200">{base}</span>
        </dd>
      )}
    </div>
  );
}

/** Green/red text for signed money values, plus the sign so color is never the only cue. */
export function signedClass(v) {
  if (v > 0.005) return 'text-emerald-700 dark:text-emerald-400';
  if (v < -0.005) return 'text-red-700 dark:text-red-400';
  return 'text-zinc-700 dark:text-zinc-300';
}

/**
 * A button that asks before doing something destructive. The question
 * opens in-page, because the hosted viewer blocks window.confirm().
 */
export function ConfirmButton({ label, title, body, confirmLabel, onConfirm, className = '', align = 'right', children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const cancel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancel.current?.focus();
    const onDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        {children}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-label={title}
          className={`glass-strong pop absolute top-full z-50 mt-2 w-72 rounded-2xl p-4 text-left ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button ref={cancel} onClick={() => setOpen(false)} className="px-3 py-1.5">
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Marks a starter deal that ships with the app; it disappears once edited. */
export function ExampleTag() {
  return (
    <span className="shrink-0 rounded-md bg-zinc-950/[0.06] px-1.5 py-px text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-white/10 dark:text-zinc-400">
      Example
    </span>
  );
}

/** Placeholder while a section's code loads. */
export function SkeletonCard({ className = 'h-96' }) {
  return (
    <div className={`glass overflow-hidden rounded-3xl ${className}`} aria-hidden>
      <div className="skeleton h-full w-full" />
    </div>
  );
}
