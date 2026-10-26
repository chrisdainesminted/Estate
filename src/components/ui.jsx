import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import { BAND_CLASSES } from '../lib/dscr.js';
import { ratio } from '../lib/format.js';

export function Card({ className = '', children, ...rest }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-lg bg-indigo-50 p-1.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <Icon className="size-4" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
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
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300 dark:disabled:bg-indigo-900',
    secondary:
      'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Two-or-more option segmented control. */
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${
              selected
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </label>
      <div className="flex items-center rounded-lg bg-white ring-1 ring-inset ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 dark:bg-slate-950 dark:ring-slate-700">
        {prefix && <span className="pl-3 text-sm text-slate-400 dark:text-slate-500">{prefix}</span>}
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
          className="tabular w-full min-w-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100"
        />
        {suffix && <span className="pr-3 text-sm whitespace-nowrap text-slate-400 dark:text-slate-500">{suffix}</span>}
      </div>
      {hint && <p className="tabular mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</div>
      <div className="tabular mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {sub && <div className="tabular text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

/** Green/red text for signed money values, plus the sign so color is never the only cue. */
export function signedClass(v) {
  if (v > 0.005) return 'text-green-700 dark:text-green-400';
  if (v < -0.005) return 'text-red-700 dark:text-red-400';
  return 'text-slate-700 dark:text-slate-300';
}
