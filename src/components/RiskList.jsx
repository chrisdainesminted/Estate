import { useState } from 'react';
import { ChevronDown, ShieldQuestion } from 'lucide-react';
import { propertyRisks } from '../lib/risks.js';

/**
 * "Before you offer": what to check about this property (legal units,
 * tenants, its age, condo fees), from what the listing says. `compact`
 * folds the list behind one line.
 */
export default function RiskList({ property, compact = false, className = '' }) {
  const risks = propertyRisks(property);
  const [open, setOpen] = useState(!compact);
  if (!risks.length) return null;
  return (
    <div className={`rounded-lg bg-amber-400/[0.06] ring-1 ring-amber-500/25 ring-inset ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-900 dark:text-amber-200"
      >
        <span className="inline-flex items-center gap-2">
          <ShieldQuestion className="size-4 shrink-0" aria-hidden />
          Before you offer: {risks.length} thing{risks.length === 1 ? '' : 's'} to check
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="grid gap-3 border-t border-amber-500/20 px-4 py-3">
          {risks.map((r) => (
            <li key={r.key} className="text-sm">
              <p className="font-semibold text-zinc-900 dark:text-white">{r.title}</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
