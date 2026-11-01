import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { sharesTotal } from '../../lib/landlord.js';
import { fieldInput } from './shared.jsx';

const MAX_OWNERS = 10;

/** Shares that add to exactly 100, as even as two decimals allow; the last owner takes the leftover. */
const evenShares = (n) => {
  const each = Math.floor(10000 / n) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each));
};

/**
 * Who owns the rentals, and each owner's share. With two or more, the tax
 * summary and tax pack split the rent and expenses so each co-owner files
 * their own T776.
 */
export default function Owners({ settings, api }) {
  const saved = Array.isArray(settings?.owners) ? settings.owners : [];
  const [rows, setRows] = useState(() => saved.map((o) => ({ name: o.name ?? '', share: o.share })));
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const total = sharesTotal(rows);
  const names = rows.map((r) => r.name.trim());
  const problem =
    rows.length < 2
      ? ''
      : names.some((n) => !n)
        ? 'Give every owner a name.'
        : new Set(names.map((n) => n.toLowerCase())).size < names.length
          ? 'Each owner needs a different name.'
          : rows.some((r) => !(Number(r.share) > 0))
            ? 'Give every owner a share above 0%.'
            : total !== 100
              ? `The shares add up to ${total}%. They need to make 100%.`
              : '';
  const edit = (i, patch) => {
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDone(false);
  };
  const save = async (list) => {
    try {
      await api.save('settings', 'main', { owners: list.map((r) => ({ name: r.name.trim(), share: Number(r.share) })) });
      setError('');
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };
  const start = () => {
    setRows([
      { name: settings?.name || '', share: 50 },
      { name: '', share: 50 },
    ]);
    setDone(false);
  };
  const solo = async () => {
    setRows([]);
    await save([]);
  };

  return (
    <Card>
      <CardHeader title="Owners" subtitle="Own these rentals with someone? Each co-owner reports their share of the rent and expenses on their own T776." />
      <div className="space-y-4 p-5 text-sm">
        {rows.length < 2 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-zinc-600 dark:text-zinc-400">You’re the only owner, so the tax summary is all yours.</p>
            <Button onClick={start}>
              <Users className="size-4" aria-hidden /> Split with co-owners
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`own-name-${i}`} className={i ? 'sr-only' : 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400'}>
                      Owner’s name{i ? ` ${i + 1}` : ''}
                    </label>
                    <input id={`own-name-${i}`} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder={i ? 'Co-owner’s name' : 'Your name'} maxLength={80} className={fieldInput} />
                  </div>
                  <div className="w-28">
                    <label htmlFor={`own-share-${i}`} className={i ? 'sr-only' : 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400'}>
                      Share{i ? ` of owner ${i + 1}` : ''}
                    </label>
                    <div className="relative">
                      <input
                        id={`own-share-${i}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                        value={r.share ?? ''}
                        onChange={(e) => edit(i, { share: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className={`${fieldInput} pr-7`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" aria-hidden>
                        %
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" aria-label={`Remove ${r.name || `owner ${i + 1}`}`} disabled={rows.length <= 2} onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" className="-ml-2" disabled={rows.length >= MAX_OWNERS} onClick={() => setRows((list) => [...list, { name: '', share: undefined }])}>
                <Plus className="size-4" aria-hidden /> Add an owner
              </Button>
              <Button variant="ghost" onClick={() => setRows((list) => evenShares(list.length).map((share, i) => ({ ...list[i], share })))}>
                Split equally
              </Button>
              <span className={`ml-auto text-xs font-medium ${total === 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>Total {total}%</span>
            </div>
            {(problem || error) && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error || problem}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={Boolean(problem)} onClick={() => save(rows)}>
                Save owners
              </Button>
              <Button variant="ghost" onClick={solo}>
                I’m the only owner
              </Button>
              {done && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved</span>}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Use each owner’s share on the title. Rent and shared expenses split by these shares; an expense one owner paid alone can be marked as theirs when you log it. Each owner claims their own capital cost allowance.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
