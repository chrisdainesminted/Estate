import { useRef, useState } from 'react';
import { Camera, Download, FileText, Paperclip, Trash2, X } from 'lucide-react';
import { Button, Card, CardHeader, LedgerLine } from '../../components/ui.jsx';
import { T776, ccaYear, ownerSplit, ownersOf, today, yearCsv, yearSummary } from '../../lib/landlord.js';
import { money } from '../../lib/format.js';
import { saveFile } from '../../lib/runtime.js';
import { dateLabel } from '../../lib/when.js';
import { Empty, Input, Select } from './shared.jsx';
import Owners from './Owners.jsx';
import Assets from './Assets.jsx';
import ShareBooks from './ShareBooks.jsx';
import BankImport from './BankImport.jsx';
import PortfolioTax from './PortfolioTax.jsx';

/** Opens a receipt photo in a new tab (it's private, so it's fetched with the link's key first). */
async function openReceipt(api, receiptId) {
  const tab = window.open('', '_blank');
  const blob = await api.receiptBlob(receiptId);
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** One expense's receipt: open it, or (for the owner) add, replace or remove the photo. */
function Receipt({ e, api, readOnly, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadReceipt(e.id, file);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  };
  return (
    <span className="flex items-center gap-1">
      {e.receiptId && (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openReceipt(api, e.receiptId).catch((err) => onError(err.message))}>
          <Paperclip className="size-3.5" aria-hidden /> Receipt
        </Button>
      )}
      {!readOnly && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(ev) => upload(ev.target.files?.[0])} aria-hidden tabIndex={-1} />
          {e.receiptId ? (
            <Button variant="ghost" className="px-2 py-1" aria-label={`Remove the receipt for the ${money(e.amount)} expense`} onClick={() => api.removeReceipt(e.id).catch((err) => onError(err.message))}>
              <X className="size-3.5" aria-hidden />
            </Button>
          ) : (
            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => input.current?.click()} aria-label={`Add a receipt photo for the ${money(e.amount)} expense`}>
              <Camera className="size-3.5" aria-hidden /> {busy ? 'Adding…' : 'Add receipt'}
            </Button>
          )}
        </>
      )}
    </span>
  );
}

/**
 * Expenses by the CRA's T776 lines, the buildings and improvements that are
 * claimed as capital cost allowance, receipts, and the year's rental income
 * for each owner's tax return. `readOnly` is the co-owner's view-only link.
 */
export default function Expenses({ data, api, readOnly = false, ownedDeals = [] }) {
  const thisYear = Number(today().slice(0, 4));
  const years = [...new Set([thisYear, thisYear - 1, ...data.expenses.map((e) => Number(String(e.date).slice(0, 4))), ...data.payments.map((p) => Number(String(p.month).slice(0, 4)))])].filter(Boolean).sort((a, b) => b - a);
  const [year, setYear] = useState(thisYear);
  const [f, setF] = useState({ date: today(), amount: undefined, category: 'repairs', unitId: '', vendor: '', note: '', paidBy: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const receiptInput = useRef(null);
  const [packFor, setPackFor] = useState('');
  const [remind, setRemind] = useState(Boolean(data.settings?.taxReminder));
  // Co-owners each file their own T776 with their share; an expense one of them paid alone is theirs only.
  const owners = ownersOf(data.settings);
  const isOwner = (name) => owners.some((o) => o.name === name);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const assets = data.assets ?? [];
  const summary = yearSummary(data.payments, data.expenses, year, owners);
  const split = owners.length ? ownerSplit(summary, owners) : [];
  const cca = ccaYear(assets, year, summary, owners);
  const ccaOf = (name) => cca.owners.find((o) => o.name === name);
  const personalTotal = split.reduce((sum, o) => sum + o.personal, 0);
  const packOwner = owners.find((o) => o.name === packFor) ? packFor : '';
  const list = data.expenses.filter((e) => String(e.date).startsWith(String(year))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const withReceipts = list.filter((e) => e.receiptId).length;

  const add = async (e) => {
    e.preventDefault();
    if (!(f.amount > 0)) return setError('Enter the amount.');
    try {
      const item = await api.save('expenses', null, { ...f, paidBy: isOwner(f.paidBy) ? f.paidBy : '' });
      if (receiptFile) await api.uploadReceipt(item.id, receiptFile);
      setF((x) => ({ ...x, amount: undefined, vendor: '', note: '', paidBy: '' }));
      setReceiptFile(null);
      if (receiptInput.current) receiptInput.current.value = '';
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
      const blob = await buildTaxPdf({ year, payments: data.payments, expenses: data.expenses, units: data.units, settings: data.settings ?? {}, owners, forOwner: packOwner, assets, receipt: api.receiptBlob });
      await saveFile(`Rental income and expenses ${year}${packOwner ? ` - ${packOwner}` : ''} - Squarely.pdf`, blob);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const download = () => saveFile(`rental-income-${year}.csv`, yearCsv(summary, data.payments, data.expenses, data.units, owners, cca)).catch((err) => setError(err.message));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {!readOnly && (
          <Card>
            <CardHeader title="Log an expense" subtitle="Add a photo of the receipt: the CRA can ask for it for six years." />
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
              <div className="col-span-2">
                <label htmlFor="ex-receipt" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Receipt photo (optional)
                </label>
                <input
                  ref={receiptInput}
                  id="ex-receipt"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(ev) => setReceiptFile(ev.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-well file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 dark:text-zinc-300 dark:file:text-zinc-100"
                />
              </div>
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
              Improvements that last (a new roof, a furnace, a new suite) are capital, not repairs: add them under Buildings and improvements instead. If you live in part of the home, only the rented share of shared costs counts.
            </p>
          </Card>
        )}
        {!readOnly && <BankImport expenses={data.expenses} api={api} />}
        <Card>
          <CardHeader title={`Expenses in ${year}`} subtitle={list.length ? `${withReceipts} of ${list.length} with a receipt photo` : undefined} />
          {readOnly && error && (
            <p role="alert" className="px-5 pt-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {list.length === 0 ? (
            <Empty>None logged for {year}.</Empty>
          ) : (
            <ul className="divide-y divide-hairline">
              {list.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-900 dark:text-zinc-100">{[e.vendor, e.note].filter(Boolean).join(' · ') || T776.find((c) => c.key === e.category)?.label}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {dateLabel(e.date)} · {T776.find((c) => c.key === e.category)?.label}
                      {isOwner(e.paidBy) && ` · only ${e.paidBy}`}
                    </span>
                  </span>
                  <Receipt e={e} api={api} readOnly={readOnly} onError={setError} />
                  <span className="tabular-nums">{money(e.amount)}</span>
                  {!readOnly && (
                    <Button variant="ghost" aria-label={`Remove the ${money(e.amount)} expense`} onClick={() => api.remove('expenses', e.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Assets assets={assets} year={year} cca={cca} api={api} readOnly={readOnly} />
      </div>
      <div className="space-y-6 self-start">
        {readOnly ? (
          owners.length > 0 && (
            <Card>
              <CardHeader title="Owners" />
              <ul className="divide-y divide-hairline text-sm">
                {owners.map((o) => (
                  <li key={o.name} className="flex justify-between px-5 py-2.5">
                    <span>{o.name}</span>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{o.share}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        ) : (
          <>
            <Owners settings={data.settings ?? {}} api={api} />
            {owners.length > 0 && <ShareBooks api={api} shared={Boolean(data.config?.booksShared)} />}
          </>
        )}
        {ownedDeals.length > 0 && <PortfolioTax ownedDeals={ownedDeals} year={year} data={data} api={api} readOnly={readOnly} />}
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
            <LedgerLine label="Net income before adjustments (9369)" value={money(summary.net)} valueClass={owners.length ? 'text-lg' : ''} total={Boolean(owners.length)} sum={!owners.length} />
            {!owners.length && (
              <>
                <LedgerLine label="Capital cost allowance (9936)" value={money(-cca.claim)} />
                <LedgerLine label="Net income (loss) (9946)" value={money(cca.net)} valueClass="text-lg" total />
                {cca.limited && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">CCA stops at {money(cca.claim)} of the {money(cca.max)} allowed: it can’t create or increase a rental loss.</p>}
              </>
            )}
            {personalTotal > 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Not in these totals: {money(personalTotal)} of expenses one owner paid alone, claimed only by them below.</p>}
            {split.length > 0 && (
              <div className="mt-5 space-y-4 border-t border-hairline pt-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">Each owner’s T776</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Each owner enters the whole property’s rent and expenses above, then their own share of line 9369.</p>
                </div>
                {split.map((o) => {
                  const c = ccaOf(o.name);
                  return (
                    <div key={o.name}>
                      <p className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{o.name}</span>
                        <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{o.share}% owner</span>
                      </p>
                      <LedgerLine label="Share of gross rents" value={money(o.gross)} />
                      <LedgerLine label="Share of expenses" value={money(-o.total)} />
                      <LedgerLine label="Your share of line 9369" value={money(o.net)} sum />
                      {o.personal > 0 && <LedgerLine label="Less expenses they paid alone" value={money(-o.personal)} />}
                      <LedgerLine label="Capital cost allowance on their share (9936)" value={money(-(c?.claim ?? 0))} />
                      <LedgerLine label="Net income (loss) (9946)" value={money(c?.net ?? o.after)} total />
                      {c?.limited && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">CCA stops at {money(c.claim)} of their {money(c.max)}: it can’t create or increase a rental loss.</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Gross rents come from the payments recorded. CCA shown is the most allowed; claiming less, or nothing, is your choice, and the limit counts all your rental properties together.
              {owners.length ? ' Each owner reports their own share.' : readOnly ? '' : ' Own it with someone? Add them under Owners.'} This is a summary to bring to your tax software or accountant, not tax advice.
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
            {readOnly && error && (
              <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <Button variant="primary" className="mt-4 mr-2" onClick={taxPack} disabled={busy}>
              <FileText className="size-4" aria-hidden /> {busy ? 'Making it…' : `${year} tax pack${packOwner ? ` for ${packOwner}` : ''} (PDF)`}
            </Button>
            <Button className="mt-4" onClick={download}>
              <Download className="size-4" aria-hidden /> Download {year} as a spreadsheet (CSV)
            </Button>
            {withReceipts > 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">The tax pack ends with the {withReceipts} receipt photo{withReceipts === 1 ? '' : 's'} for {year}.</p>}
            {!readOnly && (
              <label className="mt-4 flex items-start gap-2 border-t border-hairline pt-4 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setRemind(on);
                    api.save('settings', 'main', { taxReminder: on }).catch((err) => (setRemind(!on), setError(err.message)));
                  }}
                  className="mt-1 accent-emerald-600"
                />
                <span>
                  Email me each February when last year’s tax pack is ready, with any expenses still missing a receipt.
                  {!data.settings?.email && <span className="block text-xs text-zinc-500 dark:text-zinc-400">Add your email under Settings first.</span>}
                </span>
              </label>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
