import { useMemo, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { T776 } from '../../lib/landlord.js';
import { guessColumns, parseCsv, statementExpenses } from '../../lib/bankCsv.js';
import { money } from '../../lib/format.js';
import { dateLabel } from '../../lib/when.js';
import { Select } from './shared.jsx';

const MODES = [
  ['out', 'Spending is negative (most bank accounts)'],
  ['positive', 'Spending is positive (most credit cards)'],
  ['debit', 'This column is money out only'],
];

/**
 * Log many expenses at once from a bank or credit-card statement saved as
 * CSV. Nothing is added until the landlord ticks the rows that were for the
 * rentals and checks each one's T776 line. The file stays in the browser.
 */
export default function BankImport({ expenses, api }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState(null);
  const [mode, setMode] = useState('out');
  const [picked, setPicked] = useState({});
  const [lines, setLines] = useState({});
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const read = async (file) => {
    if (!file) return;
    setNote('');
    try {
      if (file.size > 5_000_000) throw new Error('That file is too large. Export a shorter date range.');
      const parsed = parseCsv(await file.text());
      if (parsed.length < 1) throw new Error('That file has no rows.');
      const guess = guessColumns(parsed);
      setRows(parsed);
      setCols(guess);
      setMode(guess.debit != null ? 'debit' : 'out');
      setPicked({});
      setLines({});
    } catch (err) {
      setNote(err.message);
    }
  };

  const moneyCol = cols ? (mode === 'debit' ? cols.debit ?? cols.amount : cols.amount ?? cols.debit) : null;
  const found = useMemo(() => {
    if (!rows || !cols) return [];
    const c = mode === 'debit' ? { ...cols, debit: moneyCol, amount: null } : { ...cols, amount: moneyCol, debit: null };
    return statementExpenses(rows, c, { spendingPositive: mode === 'positive', existing: expenses });
  }, [rows, cols, mode, moneyCol, expenses]);
  const isPicked = (r) => picked[r.key] ?? false;
  const chosen = found.filter(isPicked);
  const setCol = (k) => (v) => setCols((c) => ({ ...c, [k]: v === '' ? null : Number(v) }));
  const colOptions = cols ? cols.names.map((n, i) => ({ i, label: n || `Column ${i + 1}`, sample: rows[cols.header ? 1 : 0]?.[i] ?? '' })) : [];

  const add = async () => {
    let done = 0;
    try {
      for (const r of chosen) {
        setBusy(`Adding ${done + 1} of ${chosen.length}…`);
        await api.save('expenses', null, { date: r.date, amount: r.amount, category: lines[r.key] ?? r.category, vendor: r.description, unitId: '', note: 'From a bank statement', paidBy: '' });
        done += 1;
      }
      setNote(`Added ${done} expense${done === 1 ? '' : 's'}. Add receipt photos to them in the list.`);
      setRows(null);
      setCols(null);
    } catch (err) {
      setNote(`Added ${done}, then: ${err.message}`);
    }
    setBusy('');
  };

  return (
    <Card>
      <CardHeader title="Import from a bank statement" subtitle="Save a statement as CSV from your bank’s website, then tick the rental expenses. The file stays on this device." />
      <div className="space-y-4 p-5 text-sm">
        {!open && !rows ? (
          <Button onClick={() => setOpen(true)}>
            <FileSpreadsheet className="size-4" aria-hidden /> Choose a statement
          </Button>
        ) : (
          <div>
            <label htmlFor="bank-file" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Statement file (.csv)
            </label>
            <input
              id="bank-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => read(e.target.files?.[0])}
              className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-well file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 dark:text-zinc-300 dark:file:text-zinc-100"
            />
          </div>
        )}
        {cols && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select id="bank-date" label="Date column" value={String(cols.date)} onChange={setCol('date')}>
                {colOptions.map((o) => (
                  <option key={o.i} value={o.i}>
                    {o.label}
                    {o.sample ? ` (${o.sample.slice(0, 20)})` : ''}
                  </option>
                ))}
              </Select>
              <Select id="bank-desc" label="Description column" value={cols.description == null ? '' : String(cols.description)} onChange={setCol('description')}>
                <option value="">None</option>
                {colOptions.map((o) => (
                  <option key={o.i} value={o.i}>
                    {o.label}
                    {o.sample ? ` (${o.sample.slice(0, 20)})` : ''}
                  </option>
                ))}
              </Select>
              <Select id="bank-money" label="Money column" value={moneyCol == null ? '' : String(moneyCol)} onChange={(v) => setCols((c) => ({ ...c, [mode === 'debit' ? 'debit' : 'amount']: v === '' ? null : Number(v) }))}>
                <option value="">Choose…</option>
                {colOptions.map((o) => (
                  <option key={o.i} value={o.i}>
                    {o.label}
                    {o.sample ? ` (${o.sample.slice(0, 20)})` : ''}
                  </option>
                ))}
              </Select>
              <Select id="bank-mode" label="How it shows spending" value={mode} onChange={setMode}>
                {MODES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={cols.dayFirst} onChange={(e) => setCols((c) => ({ ...c, dayFirst: e.target.checked }))} className="accent-emerald-600" />
              Dates are day first (03/04 is 3 April)
            </label>
            {found.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">No money going out found with these columns. Try another money column or way of showing spending.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {found.length} payments out · {chosen.length} ticked
                  </span>
                  <Button variant="ghost" className="ml-auto px-2 py-1 text-xs" onClick={() => setPicked(Object.fromEntries(found.filter((r) => !r.duplicate).map((r) => [r.key, true])))}>
                    Tick all new
                  </Button>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setPicked({})}>
                    Untick all
                  </Button>
                </div>
                <ul className="max-h-[28rem] divide-y divide-hairline overflow-y-auto rounded-md border border-hairline">
                  {found.map((r) => (
                    <li key={r.key} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${r.duplicate ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isPicked(r)}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.key]: e.target.checked }))}
                        aria-label={`Rental expense: ${r.description || 'payment'} on ${r.date}, ${money(r.amount)}`}
                        className="accent-emerald-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-zinc-900 dark:text-zinc-100">{r.description || 'Payment'}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {dateLabel(r.date)}
                          {r.duplicate && ' · already logged'}
                        </span>
                      </span>
                      <span className="tabular-nums">{money(r.amount, { cents: true })}</span>
                      {isPicked(r) && (
                        <select
                          aria-label={`T776 line for ${r.description || 'this payment'}`}
                          value={lines[r.key] ?? r.category}
                          onChange={(e) => setLines((l) => ({ ...l, [r.key]: e.target.value }))}
                          className="field basis-full px-2 py-1 text-xs sm:basis-auto"
                        >
                          {T776.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label} ({c.line})
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
                <Button variant="primary" disabled={!chosen.length || Boolean(busy)} onClick={add}>
                  <Upload className="size-4" aria-hidden /> {busy || `Add ${chosen.length} expense${chosen.length === 1 ? '' : 's'}`}
                </Button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Only tick what was for the rentals. Each line is a guess from the description: check it. Improvements that last go under Buildings and improvements instead.</p>
              </>
            )}
          </>
        )}
        {note && (
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
            {note}
          </p>
        )}
      </div>
    </Card>
  );
}
