import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { CCA_CLASSES, firstYearFactor } from '../../lib/landlord.js';
import { money } from '../../lib/format.js';
import { Empty, Input, Select } from './shared.jsx';

const pct = (r) => `${Math.round(r * 1000) / 10}%`;

/**
 * Buildings and lasting improvements: claimed over the years as capital cost
 * allowance (CCA) rather than as one year's expense. Shows each one's most
 * allowed claim for the chosen year and what's left to claim after it.
 */
export default function Assets({ assets, year, cca, api, readOnly }) {
  const [f, setF] = useState({ label: '', ccaClass: '1', cost: undefined, available: '', uccYear: undefined, ucc: undefined });
  const [lower, setLower] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const rowFor = (id) => cca.rows.find((r) => r.id === id);

  const add = async (e) => {
    e.preventDefault();
    if (!f.label.trim()) return setError('Say what it is, like “The building” or “New roof”.');
    if (!(f.cost > 0)) return setError('Enter what it cost, without the land.');
    if (!f.available) return setError('Enter when it was first rented out or put to use.');
    try {
      const body = { label: f.label, ccaClass: f.ccaClass, cost: f.cost, available: f.available };
      if (lower && f.uccYear > 0 && f.ucc >= 0) Object.assign(body, { uccYear: f.uccYear, ucc: f.ucc });
      await api.save('assets', null, body);
      setF({ label: '', ccaClass: '1', cost: undefined, available: '', uccYear: undefined, ucc: undefined });
      setLower(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card>
      <CardHeader title="Buildings and improvements" subtitle={`Claimed over years as capital cost allowance (CCA). Most allowed for ${year}: ${money(cca.max)}.`} />
      {assets.length === 0 ? (
        <Empty>{readOnly ? 'None added.' : 'Add the building (without the land) and anything lasting you’ve added, like a roof, furnace or new suite.'}</Empty>
      ) : (
        <ul className="divide-y divide-hairline">
          {assets.map((a) => {
            const r = rowFor(a.id);
            const cls = CCA_CLASSES.find((c) => c.key === a.ccaClass);
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zinc-900 dark:text-zinc-100">{a.label}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Class {a.ccaClass} at {cls ? pct(cls.rate) : '?'} · cost {money(a.cost)} · in use {a.available || '?'}
                    {r ? ` · left to claim after ${year}: ${money(r.uccEnd)}` : ''}
                  </span>
                </span>
                <span className="tabular-nums text-right">
                  {money(r?.max ?? 0)}
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">most for {year}</span>
                </span>
                {!readOnly && (
                  <Button variant="ghost" aria-label={`Remove ${a.label}`} onClick={() => api.remove('assets', a.id)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <form onSubmit={add} className="grid grid-cols-2 gap-4 border-t border-hairline p-5">
          <Input id="as-label" label="What it is" value={f.label} onChange={set('label')} placeholder="The building" className="col-span-2" />
          <Select id="as-class" label="CCA class" value={f.ccaClass} onChange={set('ccaClass')} className="col-span-2">
            {CCA_CLASSES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input id="as-cost" label="Cost, without the land" type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} hint="Include legal fees and land transfer tax for the building’s share." />
          <Input
            id="as-date"
            label="First rented out or used"
            type="date"
            value={f.available}
            onChange={set('available')}
            hint={f.available ? `First year: ${firstYearFactor(f.available) === 1.5 ? '1.5 times' : firstYearFactor(f.available) === 1 ? 'the full' : 'half the'} class rate` : undefined}
          />
          <label className="col-span-2 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} className="mt-1 accent-emerald-600" />
            I claimed less than the most in an earlier year (enter the undepreciated capital cost from that year’s return)
          </label>
          {lower && (
            <>
              <Input id="as-uccyear" label="At the start of year" type="number" min="1990" max="2100" step="1" value={f.uccYear} onChange={set('uccYear')} />
              <Input id="as-ucc" label="Undepreciated capital cost" type="number" min="0" step="0.01" value={f.ucc} onChange={set('ucc')} />
            </>
          )}
          {error && (
            <p role="alert" className="col-span-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="col-span-2">
            <Button type="submit">Add</Button>
          </div>
          <p className="col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
            Assumes the most was claimed each year before unless you enter a later starting balance. Sales and other disposals aren’t handled here: ask your accountant about recapture or a terminal loss.
          </p>
        </form>
      )}
    </Card>
  );
}
