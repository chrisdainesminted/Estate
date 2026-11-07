import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './ui.jsx';
import { money } from '../lib/format.js';
import { VALUE_SOURCES, judgeWork, kindOf, valueAdded } from '../lib/workValue.js';

const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const field = 'field w-full px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100';
const KINDS = [
  { value: 'improvement', label: 'Improvement' },
  { value: 'repair', label: 'Repair' },
];

/**
 * What one job adds to the home's value, and why: from what it is and the
 * cost studies, or the person's own figure.
 */
function JobValue({ w, onChange, idPrefix }) {
  const [editing, setEditing] = useState(false);
  const j = judgeWork(w.what);
  const add = valueAdded(w);
  const own = w.addsValue != null;
  if (!w.what && !own) return null;
  if (editing || own) {
    return (
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <NumberField id={idPrefix} label="Adds to its value" prefix="$" value={add} onChange={(v) => onChange({ addsValue: v })} step={500} decimals={0} />
        </div>
        <button type="button" onClick={() => (onChange({ addsValue: null }), setEditing(false))} className="pb-2.5 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          Use our estimate
        </button>
      </div>
    );
  }
  const tone = add > 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-600 dark:text-zinc-400';
  return (
    <p className={`mt-2 text-xs leading-relaxed ${tone}`}>
      {add > 0 ? (
        <>
          Adds about <strong className="tabular font-semibold">{money(add)}</strong> to its value.{' '}
          <span className="text-zinc-500 dark:text-zinc-400">
            {j.sure ? `${j.label}: about ${Math.round(j.pct)}% of the cost comes back in value (${VALUE_SOURCES[j.source]}).` : `${VALUE_SOURCES.guess}.`}{' '}
          </span>
        </>
      ) : (
        <>
          <strong className="font-semibold">Doesn’t add to its value</strong>
          {j.label ? ` (${j.label.toLowerCase()}: upkeep that keeps the home as it was)` : ''}, but it still counts for your taxes.{' '}
        </>
      )}
      <button type="button" onClick={() => setEditing(true)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
        Change
      </button>
    </p>
  );
}

/**
 * Jobs done on a home, each on its own line (what, cost, when, and whether
 * it's a repair or an improvement), with + to add another and the total.
 * `items` in, the whole new list out through `onChange`.
 */
export default function WorkItems({ items, onChange, idPrefix }) {
  const setItem = (i, patch) => onChange(items.map((w, k) => (k === i ? { ...w, ...patch } : w)));
  const total = items.reduce((t, w) => t + (Number(w.cost) || 0), 0);
  const added = items.reduce((t, w) => t + valueAdded(w), 0);
  return (
    <div className="col-span-2 space-y-3">
      {items.map((w, i) => (
        <div key={w.id ?? i} className="rounded-lg p-3 ring-1 ring-(--line-strong) ring-inset">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${idPrefix}-what-${i}`} className={label}>
                What you did
              </label>
              <input id={`${idPrefix}-what-${i}`} value={w.what ?? ''} maxLength={200} placeholder="New windows" onChange={(e) => setItem(i, { what: e.target.value })} className={field} />
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, k) => k !== i))}
              aria-label={`Remove ${w.what || 'this job'}`}
              className="mt-6 rounded-md p-1.5 text-zinc-500 transition hover:bg-well hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField id={`${idPrefix}-cost-${i}`} label="Cost" prefix="$" value={w.cost} onChange={(v) => setItem(i, { cost: v })} step={500} decimals={0} />
            <div>
              <label htmlFor={`${idPrefix}-when-${i}`} className={label}>
                When
              </label>
              <input id={`${idPrefix}-when-${i}`} type="month" value={w.when ?? ''} onChange={(e) => setItem(i, { when: e.target.value })} className={field} />
            </div>
          </div>
          <JobValue w={w} idPrefix={`${idPrefix}-value-${i}`} onChange={(patch) => setItem(i, patch)} />
          <div role="radiogroup" aria-label={`Repair or improvement: ${w.what || 'this job'}`} className="mt-2 flex flex-wrap items-center gap-1.5">
            {KINDS.map((k) => {
              const on = kindOf(w) === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setItem(i, { kind: k.value })}
                  className={`h-7 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset transition ${on ? 'bg-emerald-600 text-white ring-emerald-600 dark:bg-[#73ff6a] dark:text-black dark:ring-[#73ff6a]' : 'text-zinc-600 ring-(--line-strong) hover:bg-well dark:text-zinc-300'}`}
                >
                  {k.label}
                </button>
              );
            })}
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {kindOf(w) === 'repair' ? 'For tax: an expense the year it’s done' : 'For tax: claimed over years (capital)'}
              {!w.kind && w.what ? ', going by what you wrote' : ''}
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange([...items, { what: '', cost: 0, when: '' }])}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-emerald-400"
        >
          <Plus className="size-4" aria-hidden /> Add work
        </button>
        {items.length > 0 && (
          <span className="tabular text-right text-sm text-zinc-600 dark:text-zinc-400">
            Total {money(total)}
            <span className="block text-xs">adds {money(added)} to its value</span>
          </span>
        )}
      </div>
    </div>
  );
}
