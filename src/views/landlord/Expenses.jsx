import { useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, LedgerLine } from '../../components/ui.jsx';
import { T776, ownerSplit, ownersOf, today, yearCsv, yearSummary } from '../../lib/landlord.js';
import { money } from '../../lib/format.js';
import { saveFile } from '../../lib/runtime.js';
import { dateLabel } from '../../lib/when.js';
import { Empty, Input, Select } from './shared.jsx';
import Owners from './Owners.jsx';

/** Expenses by the CRA's T776 lines, and the year's rental income for your tax return. */
export default function Expenses({ data, api }) {
  const thisYear = Number(today().slice(0, 4));
  const years = [...new Set([thisYear, thisYear - 1, ...data.expenses.map((e) => Number(String(e.date).slice(0, 4))), ...data.payments.map((p) => Number(String(p.month).slice(0, 4)))])].filter(Boolean).sort((a, b) => b - a);
  const [year, setYear] = useState(thisYear);
  const [f, setF] = useState({ date: today(), amount: undefined, category: 'repairs', unitId: '', vendor: '', note: '', paidBy: '' });
  const [packFor, setPackFor] = useState('');
  // Co-owners each file their own T776 with their share; an expense one of them paid alone is theirs only.
  const owners = ownersOf(data.settings);
  const isOwner = (name) => owners.some((o) => o.name === name);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const summary = yearSummary(data.payments, data.expenses, year, owners);
  const split = owners.length ? ownerSplit(summary, owners) : [];
  const personalTotal = split.reduce((sum, o) => sum + o.personal, 0);
  const packOwner = owners.find((o) => o.name === packFor) ? packFor : '';
  const list = data.expenses.filter((e) => String(e.date).startsWith(String(year))).sort((a, b) => (a.date < b.date ? 1 : -1));

  const add = async (e) => {
    e.preventDefault();
    if (!(f.amount > 0)) return setError('Enter the amount.');
    try {
      await api.save('expenses', null, { ...f, paidBy: isOwner(f.paidBy) ? f.paidBy : '' });
      setF((x) => ({ ...x, amount: undefined, vendor: '', note: '', paidBy: '' }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  const [busy, setBusy] = useState(false);
  const taxPack = async () => {
    setBusy(true);
    try {
      const { buildTaxPdf } = await import('../../lib/taxPdf.js');
      const blob = await buildTaxPdf({ year, payments: data.payments, expenses: data.expenses, units: data.units, settings: data.settings ?? {}, owners, forOwner: packOwner });
      await saveFile(`Rental income and expenses ${year}${packOwner ? ` - ${packOwner}` : ''} - Squarely.pdf`, blob);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const download = () => saveFile(`rental-income-${year}.csv`, yearCsv(summary, data.payments, data.expenses, data.units, owners)).catch((err) => setError(err.message));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Log an expense" subtitle="Keep the receipt; the CRA can ask for it for six years." />
          <form onSubmit={add} className="grid grid-cols-2 gap-4 p-5">
            <Input id="ex-date" label="Date" type="date" value={f.date} onChange={set('date')} />
            <Input id="ex-amt" label="Amount" type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} />
            <Select id="ex-cat" label="What for (T776 line)" value={f.category} onChange={set('category')} className="col-span-2">
              {T776.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.line})
                </option>
              ))}
            </Select>
            <Select id="ex-unit" label="Unit" value={f.unitId} onChange={set('unitId')}>
              <option value="">The whole property</option>
              {data.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Input id="ex-vendor" label="Paid to" value={f.vendor} onChange={set('vendor')} />
            {owners.length > 0 && (
              <Select id="ex-paidby" label="Who it’s for" value={isOwner(f.paidBy) ? f.paidBy : ''} onChange={set('paidBy')} className="col-span-2">
                <option value="">Shared: split by ownership</option>
                {owners.map((o) => (
                  <option key={o.name} value={o.name}>
                    Only {o.name}: they paid it alone
                  </option>
                ))}
              </Select>
            )}
            <Input id="ex-note" label="Note" value={f.note} onChange={set('note')} className="col-span-2" />
            {error && (
              <p role="alert" className="col-span-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="col-span-2">
              <Button type="submit" variant="primary">
                Add expense
              </Button>
            </div>
          </form>
          <p className="border-t border-hairline px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
            Improvements that last (a new roof, a furnace, a new suite) are capital, not repairs: they’re claimed over years as capital cost allowance, so ask your accountant. If you live in part of the home, only the rented
            share of shared costs counts.
          </p>
        </Card>
        <Card>
          <CardHeader title={`Expenses in ${year}`} />
          {list.length === 0 ? (
            <Empty>None logged for {year}.</Empty>
          ) : (
            <ul className="divide-y divide-hairline">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-900 dark:text-zinc-100">{[e.vendor, e.note].filter(Boolean).join(' · ') || T776.find((c) => c.key === e.category)?.label}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {dateLabel(e.date)} · {T776.find((c) => c.key === e.category)?.label}
                      {isOwner(e.paidBy) && ` · only ${e.paidBy}`}
                    </span>
                  </span>
                  <span className="tabular-nums">{money(e.amount)}</span>
                  <Button variant="ghost" aria-label={`Remove the ${money(e.amount)} expense`} onClick={() => api.remove('expenses', e.id)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="space-y-6 self-start">
      <Owners settings={data.settings ?? {}} api={api} />
      <Card>
        <CardHeader
          title="Rental income for tax time"
          subtitle="Laid out like the CRA’s form T776."
          actions={
            <Select id="ex-year" label="Year" value={String(year)} onChange={(v) => setYear(Number(v))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          }
        />
        <div className="p-5 text-sm">
          <LedgerLine label="Gross rents (8141)" value={money(summary.gross)} />
          {summary.lines
            .filter((l) => l.amount)
            .map((l) => (
              <LedgerLine key={l.key} label={`${l.label} (${l.line})`} value={money(-l.amount)} />
            ))}
          <LedgerLine label="Total expenses (9949)" value={money(-summary.total)} sum />
          <LedgerLine label="Net income before capital cost allowance (9369)" value={money(summary.net)} valueClass="text-lg" total />
          {personalTotal > 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Not in these totals: {money(personalTotal)} of expenses one owner paid alone, claimed only by them below.</p>}
          {split.length > 0 && (
            <div className="mt-5 space-y-4 border-t border-hairline pt-4">
              <div>
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">Each owner’s T776</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Each owner enters the whole property’s rent and expenses above, then their own share of line 9369.</p>
              </div>
              {split.map((o) => (
                <div key={o.name}>
                  <p className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{o.name}</span>
                    <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{o.share}% owner</span>
                  </p>
                  <LedgerLine label="Share of gross rents" value={money(o.gross)} />
                  <LedgerLine label="Share of expenses" value={money(-o.total)} />
                  <LedgerLine label="Your share of line 9369" value={money(o.net)} sum />
                  {o.personal > 0 && <LedgerLine label="Less expenses they paid alone" value={money(-o.personal)} />}
                  <LedgerLine label="Net income before capital cost allowance" value={money(o.after)} total />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Gross rents come from the payments you recorded.{owners.length ? ' Each owner reports their own share and claims their own capital cost allowance.' : ' Own it with someone? Add them under Owners.'} This is a summary to bring to your tax software or accountant, not tax advice.
          </p>
          {owners.length > 0 && (
            <Select id="ex-packfor" label="Tax pack for" value={packOwner} onChange={setPackFor} className="mt-4 max-w-xs">
              <option value="">Every owner (one page each)</option>
              {owners.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} only
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" className="mt-4 mr-2" onClick={taxPack} disabled={busy}>
            <FileText className="size-4" aria-hidden /> {busy ? 'Making it…' : `${year} tax pack${packOwner ? ` for ${packOwner}` : ''} (PDF)`}
          </Button>
          <Button className="mt-4" onClick={download}>
            <Download className="size-4" aria-hidden /> Download {year} as a spreadsheet (CSV)
          </Button>
        </div>
      </Card>
      </div>
    </div>
  );
}
