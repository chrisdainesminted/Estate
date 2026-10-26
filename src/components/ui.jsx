import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import { BAND_CLASSES } from '../lib/dscr.js';
import { ratio } from '../lib/format.js';

export function Card({ className = '', children, ...rest }) {
  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Icon className="size-4" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
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
    <span className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${sz} ${BAND_CLASSES[status.key].chip}`}>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {dscr !== undefined && <span className="tabular font-semibold">{ratio(dscr)}</span>}
      {status.label}
    </span>
  );
}

export function Button({ variant = 'secondary', className = '', children, ...rest }) {
  const styles = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400',
    secondary:
      'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Two-or-more option segmented control. */
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${
              selected
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {o.icon && <o.icon className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function formatForDisplay(v, decimals) {
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/**
 * Numeric input that tolerates partial typing ("", "7.") and shows thousands
 * separators when not focused. Commits only valid numbers, clamped to [min, max].
 */
export function NumberField({ id, label, value, onChange, prefix, suffix, min = 0, max, step = 1, decimals = 2, hint }) {
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
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <div className="flex items-center rounded-lg bg-white ring-1 ring-inset ring-zinc-300 focus-within:ring-2 focus-within:ring-emerald-500 dark:bg-zinc-950 dark:ring-zinc-700">
        {prefix && <span className="pl-3 text-sm text-zinc-400 dark:text-zinc-500">{prefix}</span>}
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
          className="tabular w-full min-w-0 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-100"
        />
        {suffix && <span className="pr-3 text-sm whitespace-nowrap text-zinc-400 dark:text-zinc-500">{suffix}</span>}
      </div>
      {hint && <p className="tabular mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</div>
      <div className="tabular mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      {sub && <div className="tabular text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </div>
  );
}

/** Green/red text for signed money values, plus the sign so color is never the only cue. */
export function signedClass(v) {
  if (v > 0.005) return 'text-green-700 dark:text-green-400';
  if (v < -0.005) return 'text-red-700 dark:text-red-400';
  return 'text-zinc-700 dark:text-zinc-300';
}
