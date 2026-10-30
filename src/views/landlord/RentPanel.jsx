import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, LedgerLine } from '../../components/ui.jsx';
import { daysUntil, nextIncrease, rentReminder, rentStatus, repairInvite, thisMonth, today } from '../../lib/landlord.js';
import { links } from '../../lib/landlordApi.js';
import { money } from '../../lib/format.js';
import { dateLabel } from '../../lib/when.js';
import { CopyButton, Empty, Input, Pill, SendButtons, TextArea, editable } from './shared.jsx';

const STATE = { paid: ['Paid', 'green'], partial: ['Part paid', 'amber'], due: ['Due', 'zinc'], late: ['Late', 'red'], none: ['No rent set', 'zinc'] };
const monthName = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

/** Units and their tenants: this month's rent, payments, reminders, lease dates and increases. */
export default function RentPanel({ data, api, ws, province, settings }) {
  const [openId, setOpenId] = useState(data.units[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const on = today();
  const unit = data.units.find((u) => u.id === openId);
  const totals = data.units.reduce(
    (t, u) => {
      const s = rentStatus(u, data.payments, on);
      return { rent: t.rent + s.rent, paid: t.paid + Math.min(s.paid, s.rent || s.paid), owing: t.owing + s.owing };
    },
    { rent: 0, paid: 0, owing: 0 },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader
          title={`Rent for ${monthName(on.slice(0, 7))}`}
          subtitle={data.units.length ? `${money(totals.paid)} of ${money(totals.rent)} in` : 'Add each unit you rent out'}
          actions={
            <Button onClick={() => (setAdding(true), setOpenId(null))}>
              <Plus className="size-4" aria-hidden /> Add a unit
            </Button>
          }
        />
        {data.units.length === 0 ? (
          <Empty>No units yet.</Empty>
        ) : (
          <ul className="divide-y divide-hairline">
            {data.units.map((u) => {
              const s = rentStatus(u, data.payments, on);
              const [label, tone] = STATE[s.state];
              const leaseDays = u.leaseEnd ? daysUntil(u.leaseEnd, on) : null;
              return (
                <li key={u.id}>
                  <button type="button" onClick={() => (setOpenId(u.id), setAdding(false))} className={`flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-well ${openId === u.id ? 'bg-well' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">{u.label || 'Unit'}</span>
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {u.tenantName || 'No tenant'}
                        {leaseDays != null && leaseDays >= 0 && leaseDays <= 90 ? ` · lease ends in ${leaseDays} days` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <Pill tone={tone}>{label}</Pill>
                      {s.owing > 0 && s.state !== 'none' && <span className="mt-0.5 block text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{money(s.owing)} owing</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div className="space-y-6">
        {adding ? (
          <UnitForm api={api} onDone={(id) => (setAdding(false), setOpenId(id))} />
        ) : unit ? (
          <Unit key={unit.id} unit={unit} data={data} api={api} ws={ws} province={province} settings={settings} on={on} />
        ) : (
          <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Pick a unit, or add one.</Card>
        )}
      </div>
    </div>
  );
}

function Unit({ unit, data, api, ws, province, settings, on }) {
  const s = rentStatus(unit, data.payments, on);
  const [pay, setPay] = useState({ amount: s.owing || unit.rent || undefined, month: thisMonth(), paidOn: on, method: 'e-Transfer' });
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const year = on.slice(0, 4);
  const ledger = data.payments.filter((p) => p.unitId === unit.id && String(p.month).startsWith(year)).sort((a, b) => (a.month < b.month ? 1 : -1));
  const inc = nextIncrease(unit, province, on);
  const repairLink = unit.repairToken ? links.repair(ws.id, unit) : '';
  const leaseDays = unit.leaseEnd ? daysUntil(unit.leaseEnd, on) : null;

  const record = async (e) => {
    e.preventDefault();
    if (!(pay.amount > 0)) return setError('Enter the amount received.');
    try {
      await api.save('payments', null, { ...pay, unitId: unit.id });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (edit) return <UnitForm unit={unit} api={api} onDone={() => setEdit(false)} />;
  return (
    <>
      <Card>
        <CardHeader
          title={unit.label || 'Unit'}
          subtitle={[unit.tenantName, unit.address].filter(Boolean).join(' · ') || 'No tenant yet'}
          actions={<Button onClick={() => setEdit(true)}>Edit</Button>}
        />
        <div className="grid gap-6 p-5 text-sm md:grid-cols-2">
          <div>
            <LedgerLine label="Rent" value={unit.rent ? `${money(unit.rent)}/mo` : 'Not set'} />
            <LedgerLine label="Due on the" value={`${s.dueDay}${s.dueDay === 1 ? 'st' : s.dueDay === 2 ? 'nd' : s.dueDay === 3 ? 'rd' : 'th'}`} />
            <LedgerLine label={`Paid for ${monthName(s.month)}`} value={money(s.paid)} />
            <LedgerLine label="Still owing" value={money(s.owing)} valueClass={s.state === 'late' ? 'text-red-700 dark:text-red-300' : ''} total />
          </div>
          <div>
            {unit.leaseEnd && <LedgerLine label="Lease ends" value={`${dateLabel(unit.leaseEnd)}${leaseDays != null && leaseDays >= 0 ? ` (${leaseDays} days)` : ''}`} />}
            {unit.deposit > 0 && <LedgerLine label="Deposit held" value={money(unit.deposit)} />}
            <LedgerLine label="Rent can next go up" value={dateLabel(inc.date)} />
            <LedgerLine label="Notice by" value={dateLabel(inc.noticeBy)} />
            <LedgerLine label="Up to" value={inc.cap == null ? 'No cap in this province' : `${money(inc.newRent)}/mo (${inc.cap}%)`} />
          </div>
        </div>
        {(s.state === 'late' || s.state === 'partial' || s.state === 'due') && unit.rent > 0 && (unit.tenantEmail || unit.tenantPhone) && (
          <div className="border-t border-hairline px-5 py-4">
            <p className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">Send a reminder</p>
            <SendButtons email={unit.tenantEmail} phone={unit.tenantPhone} message={rentReminder({ unit, status: s, settings })} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Record a payment" subtitle="Counts toward this month’s status and your year-end income." />
        <form onSubmit={record} className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <Input id="pay-amt" label="Amount" type="number" min="0" step="0.01" value={pay.amount} onChange={(v) => setPay((p) => ({ ...p, amount: v }))} />
          <Input id="pay-month" label="For the month" type="month" value={pay.month} onChange={(v) => setPay((p) => ({ ...p, month: v }))} />
          <Input id="pay-date" label="Received" type="date" value={pay.paidOn} onChange={(v) => setPay((p) => ({ ...p, paidOn: v }))} />
          <Input id="pay-how" label="How" value={pay.method} onChange={(v) => setPay((p) => ({ ...p, method: v }))} />
          {error && (
            <p role="alert" className="col-span-full text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="col-span-full">
            <Button type="submit" variant="primary">
              Record payment
            </Button>
          </div>
        </form>
        {ledger.length > 0 && (
          <table className="w-full border-t border-hairline text-sm">
            <caption className="sr-only">Payments in {year}</caption>
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-5 py-2 font-medium">Month</th>
                <th className="px-2 py-2 font-medium">Received</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
                <th className="w-12 px-5 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {ledger.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2">{monthName(p.month)}</td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{p.paidOn ? dateLabel(p.paidOn) : ''}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(p.amount)}</td>
                  <td className="px-5 py-1 text-right">
                    <Button variant="ghost" aria-label={`Remove the ${monthName(p.month)} payment`} onClick={() => api.remove('payments', p.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {repairLink && (
        <Card>
          <CardHeader title="Repair link" subtitle="Your tenant reports problems here; they land in your Inbox and Repairs." />
          <div className="flex flex-wrap gap-2 p-5">
            {(unit.tenantEmail || unit.tenantPhone) && <SendButtons email={unit.tenantEmail} phone={unit.tenantPhone} message={repairInvite({ unit, settings, link: repairLink })} />}
            <CopyButton text={repairLink} label="Copy repair link" />
          </div>
        </Card>
      )}
    </>
  );
}

const BLANK = { label: '', address: '', rent: undefined, dueDay: 1, tenantName: '', tenantEmail: '', tenantPhone: '', leaseStart: '', leaseEnd: '', deposit: undefined, lastIncrease: '', notes: '' };

function UnitForm({ unit, api, onDone }) {
  const [f, setF] = useState({ ...BLANK, ...(unit || {}) });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.label) return setError('Name the unit, like “Upper” or “12 Main St, basement”.');
    try {
      const saved = await api.save('units', unit?.id || null, editable(f));
      onDone(saved.id);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Card>
      <CardHeader title={unit ? 'Edit unit' : 'Add a unit'} subtitle="Only you see this." />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Input id="u-label" label="Unit name" value={f.label} onChange={set('label')} />
        <Input id="u-addr" label="Address" value={f.address} onChange={set('address')} />
        <Input id="u-rent" label="Rent a month" type="number" min="0" value={f.rent} onChange={set('rent')} />
        <Input id="u-due" label="Rent due on day" type="number" min="1" max="28" value={f.dueDay} onChange={set('dueDay')} />
        <Input id="u-tname" label="Tenant’s name" value={f.tenantName} onChange={set('tenantName')} />
        <Input id="u-temail" label="Tenant’s email" type="email" value={f.tenantEmail} onChange={set('tenantEmail')} />
        <Input id="u-tphone" label="Tenant’s phone" type="tel" value={f.tenantPhone} onChange={set('tenantPhone')} />
        <Input id="u-dep" label="Deposit held" type="number" min="0" value={f.deposit} onChange={set('deposit')} />
        <Input id="u-start" label="Lease start" type="date" value={f.leaseStart} onChange={set('leaseStart')} />
        <Input id="u-end" label="Lease end (blank if month to month)" type="date" value={f.leaseEnd} onChange={set('leaseEnd')} />
        <Input id="u-inc" label="Last rent increase" type="date" value={f.lastIncrease} onChange={set('lastIncrease')} />
        <TextArea id="u-notes" label="Notes" value={f.notes} onChange={set('notes')} className="sm:col-span-2" />
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button onClick={() => onDone(unit?.id ?? null)}>Cancel</Button>
          </div>
          {unit && (
            <Button variant="ghost" onClick={() => confirm(`Delete ${unit.label}? Its payments stay in your records.`) && api.remove('units', unit.id).then(() => onDone(null))}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
