import { forwardRef, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import { BAND_CLASSES } from '../lib/dscr.js';
import { ratio } from '../lib/format.js';
import { InfoTip } from './motion.jsx';

/** Flat panel with a hairline edge. `delay` (ms) staggers its fade-in when a view opens. */
export function Card({ className = '', delay = 0, style, children, ...rest }) {
  return (
    <section className={`panel rise ${className}`} style={{ animationDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A view's summary: the name, verdict and a sentence on the left, and the
 * ledgers (or table) beside them on wide screens, below them otherwise.
 */
export function SummaryCard({ id, head, children }) {
  return (
    <Card id={id} className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 px-5 py-5 sm:px-6">{head}</div>
      <div className="min-w-0 border-t border-hairline px-5 py-5 sm:px-6 xl:border-t-0 xl:border-l">{children}</div>
    </Card>
  );
}

/** The top of a view: its title, a line on what it's for, and optional controls on the right. */
export function ViewHeader({ title, children, aside }) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1">
      <div className="min-w-0">
        <h2 className="text-[22px] font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
        {children && <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

/** A ledger's heading: a short title over a rule, with an optional note on the right. */
export function LedgerHeading({ children, aside, as: Tag = 'h3' }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
      <Tag className="text-sm font-semibold text-zinc-900 dark:text-white">{children}</Tag>
      {aside && <span className="tabular text-xs text-zinc-500 dark:text-zinc-400">{aside}</span>}
    </div>
  );
}

/**
 * One line of a ledger: the label, a dotted leader, the amount. `sum` draws a
 * rule above a subtotal; `total` the double rule above a bottom line.
 */
export function LedgerLine({ label, value, valueClass = '', tip, sum = false, total = false, muted = false }) {
  const ruled = sum || total;
  const tone = ruled ? 'font-semibold text-zinc-900 dark:text-white' : muted ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300';
  return (
    <div className={`flex items-baseline gap-2 py-[3px] ${tone} ${total ? 'mt-1.5 border-t-[3px] border-double border-rule pt-2' : sum ? 'mt-1 border-t border-rule pt-1.5' : ''}`}>
      <span className="flex min-w-0 items-center gap-1">
        {label}
        {tip && <InfoTip k={tip} />}
      </span>
      <span aria-hidden className={`min-w-3 flex-1 ${ruled ? '' : 'mb-[0.3em] border-b border-dotted border-rule'}`} />
      <span className={`tabular shrink-0 text-right ${valueClass || (ruled ? '' : 'text-zinc-900 dark:text-zinc-100')}`}>{value}</span>
    </div>
  );
}

/** A headline figure in a ruled box: a caption, the number, then a line on what it means. */
export function Figure({ label, tip, value, valueClass = '', className = '', children }) {
  return (
    <div className={`rounded-md border border-hairline p-5 ${className}`}>
      <div className="caption flex items-center gap-1">
        {label}
        {tip && <InfoTip k={tip} />}
      </div>
      <div className={`tabular mt-1.5 text-4xl font-semibold tracking-tight ${valueClass || 'text-zinc-950 dark:text-white'}`}>{value}</div>
      {children && <div className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>}
    </div>
  );
}

const BAND_ICONS = { negative: XCircle, tight: AlertTriangle, sweet: CheckCircle2, strong: ShieldCheck };

/** Status tag: icon + label + optional value, so status never relies on color alone. */
export function DscrChip({ status, dscr, size = 'md' }) {
  const Icon = BAND_ICONS[status.key] ?? TrendingUp;
  const sz = size === 'sm' ? 'px-1.5 py-0.5 text-[11px] gap-1' : 'px-2 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-[3px] font-medium whitespace-nowrap ring-1 ring-inset ${sz} ${BAND_CLASSES[status.key].chip}`}>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {dscr !== undefined && <span className="tabular font-semibold">{ratio(dscr)}</span>}
      {status.label}
    </span>
  );
}

export const Button = forwardRef(function Button({ variant = 'secondary', className = '', children, ...rest }, ref) {
  const styles = {
    primary: 'bg-(--accent) font-semibold text-(--accent-ink) hover:brightness-110',
    secondary: 'font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100',
    ghost: 'font-medium text-zinc-600 hover:bg-well hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white',
  };
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Joined buttons for picking one of a few options; the pick is underlined in the accent. `stretch` fills the row on phones. */
export function Segmented({ options, value, onChange, label, size = 'md', stretch = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${stretch ? 'flex w-full md:inline-flex md:w-auto' : 'inline-flex'} overflow-hidden rounded-md border border-(--line-strong)`}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
              i ? 'border-l border-(--line-strong)' : ''
            } ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              stretch ? 'max-md:flex-1 max-md:px-1 max-md:text-[13px] max-[400px]:px-0.5! max-[400px]:text-xs! max-[340px]:text-[11px]!' : ''
            } ${
              selected
                ? 'bg-zinc-950/[0.05] font-semibold text-zinc-950 shadow-[inset_0_-2px_0_var(--accent)] dark:bg-white/[0.07] dark:text-white'
                : 'font-medium text-zinc-600 hover:bg-well hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
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
      <div className="caption flex items-center gap-1">
        {label}
        {tip && <InfoTip k={tip} />}
      </div>
      <div className="tabular mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{value}</div>
      {sub && <div className="tabular text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</div>}
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
          className={`popover pop absolute top-full z-50 mt-2 w-72 rounded-2xl p-4 text-left ${align === 'right' ? 'right-0' : 'left-0'}`}
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
export function ExampleTag({ className = '' }) {
  return (
    <span className={`shrink-0 rounded-[3px] px-1.5 py-px text-[11px] font-medium tracking-normal text-zinc-500 ring-1 ring-(--line-strong) ring-inset dark:text-zinc-400 ${className}`}>
      Example
    </span>
  );
}

/** Placeholder while a section's code loads. */
export function SkeletonCard({ className = 'h-96' }) {
  return (
    <div className={`panel overflow-hidden rounded-3xl ${className}`} aria-hidden>
      <div className="skeleton h-full w-full" />
    </div>
  );
}
