import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { repairUpdate, today } from '../../lib/landlord.js';
import { money } from '../../lib/format.js';
import { whenLabel } from '../../lib/when.js';
import { Empty, Input, Pill, Select, SendButtons, TextArea } from './shared.jsx';

const STATUS = { reported: ['Reported', 'amber'], scheduled: ['Booked', 'zinc'], fixed: ['Fixed', 'green'] };
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Repair jobs from reported to fixed, with what each cost. */
export default function Repairs({ data, api, settings }) {
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const order = { reported: 0, scheduled: 1, fixed: 2 };
  const jobs = [...data.maintenance].sort((a, b) => order[a.status] - order[b.status] || (a.urgency === 'urgent' ? -1 : 0) - (b.urgency === 'urgent' ? -1 : 0) || b.created - a.created);
  const job = jobs.find((m) => m.id === openId);
  const unitName = (id) => data.units.find((u) => u.id === id)?.label || 'Unit';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader
          title="Repairs"
          subtitle={`${jobs.filter((j) => j.status !== 'fixed').length} open`}
          actions={
            <Button onClick={() => (setAdding(true), setOpenId(null))}>
              <Plus className="size-4" aria-hidden /> Add a job
            </Button>
          }
        />
        {jobs.length === 0 ? (
          <Empty>No repairs. Send each tenant their repair link from Tenants & rent.</Empty>
        ) : (
          <ul className="divide-y divide-hairline">
            {jobs.map((j) => {
              const [label, tone] = STATUS[j.status] ?? STATUS.reported;
              return (
                <li key={j.id}>
                  <button type="button" onClick={() => (setOpenId(j.id), setAdding(false))} className={`flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-well ${openId === j.id ? 'bg-well' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">{j.title}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {unitName(j.unitId)}
                        {j.scheduledFor && j.status === 'scheduled' ? ` · ${whenLabel(j.scheduledFor)}` : ''}
                      </span>
                    </span>
                    {j.urgency === 'urgent' && j.status !== 'fixed' && <Pill tone="red">Urgent</Pill>}
                    <Pill tone={tone}>{label}</Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {adding ? (
        <JobForm data={data} api={api} onDone={(id) => (setAdding(false), setOpenId(id))} />
      ) : job ? (
        <Job key={job.id} job={job} data={data} api={api} settings={settings} unitName={unitName(job.unitId)} />
      ) : (
        <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Pick a job to update it.</Card>
      )}
    </div>
  );
}

function Job({ job, data, api, settings, unitName }) {
  const [f, setF] = useState({ status: job.status, scheduledFor: toLocalInput(job.scheduledFor), cost: job.cost, fixedOn: job.fixedOn || '', notes: job.notes || '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => (setF((x) => ({ ...x, [k]: v })), setSaved(false));
  const contact = job.contact || '';
  const email = /@/.test(contact) ? contact : data.units.find((u) => u.id === job.unitId)?.tenantEmail;
  const phone = /@/.test(contact) ? data.units.find((u) => u.id === job.unitId)?.tenantPhone : contact;

  const save = async (e) => {
    e?.preventDefault();
    try {
      const body = { ...f, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : undefined, read: true };
      if (f.status === 'fixed' && !f.fixedOn) body.fixedOn = today();
      if (!body.scheduledFor) delete body.scheduledFor;
      await api.save('maintenance', job.id, body);
      setSaved(true);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  const logExpense = async () => {
    try {
      await api.save('expenses', null, { date: f.fixedOn || today(), amount: f.cost, category: 'repairs', unitId: job.unitId, note: job.title });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  };
  const update = repairUpdate({ ticket: { ...job, ...f, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : '' }, settings });

  return (
    <Card>
      <CardHeader title={job.title} subtitle={`${unitName} · reported ${new Date(job.created).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}${job.reportedBy ? ` by ${job.reportedBy}` : ''}`} />
      <div className="space-y-5 p-5 text-sm">
        {job.details && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{job.details}</p>}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {job.contact ? `Contact: ${job.contact} · ` : ''}
          {job.entryOk ? 'OK to enter if they’re out (still give the notice your province requires).' : 'Arrange a time to enter.'}
        </p>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Select id="job-status" label="Status" value={f.status} onChange={set('status')}>
            <option value="reported">Reported</option>
            <option value="scheduled">Booked</option>
            <option value="fixed">Fixed</option>
          </Select>
          <Input id="job-when" label="Booked for" type="datetime-local" value={f.scheduledFor} onChange={set('scheduledFor')} />
          <Input id="job-cost" label="Cost" type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} />
          <Input id="job-fixed" label="Fixed on" type="date" value={f.fixedOn} onChange={set('fixedOn')} />
          <TextArea id="job-notes" label="Notes (contractor, parts, warranty)" value={f.notes} onChange={set('notes')} className="sm:col-span-2" />
          {error && (
            <p role="alert" className="text-red-700 sm:col-span-2 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            {f.cost > 0 && <Button onClick={logExpense}>Add {money(f.cost)} to expenses</Button>}
            {saved && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved</span>}
          </div>
        </form>
        {(email || phone) && (
          <div className="border-t border-hairline pt-4">
            <p className="mb-2 font-semibold text-zinc-950 dark:text-white">Update your tenant</p>
            <SendButtons email={email} phone={phone} message={update} />
          </div>
        )}
        <div className="border-t border-hairline pt-4 text-right">
          <Button variant="ghost" onClick={() => confirm('Delete this job?') && api.remove('maintenance', job.id)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

function JobForm({ data, api, onDone }) {
  const [f, setF] = useState({ unitId: data.units[0]?.id || '', title: '', details: '', urgency: 'normal' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.title) return setError('Say what needs doing.');
    try {
      const m = await api.save('maintenance', null, { ...f, status: 'reported', read: true });
      onDone(m.id);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Card>
      <CardHeader title="Add a job" subtitle="Something you spotted, or a call from a tenant." />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Select id="nj-unit" label="Unit" value={f.unitId} onChange={set('unitId')}>
          {data.units.length === 0 && <option value="">No units yet</option>}
          {data.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
        <Select id="nj-urg" label="Urgency" value={f.urgency} onChange={set('urgency')}>
          <option value="low">Whenever</option>
          <option value="normal">Soon</option>
          <option value="urgent">Urgent</option>
        </Select>
        <Input id="nj-title" label="What needs doing" value={f.title} onChange={set('title')} className="sm:col-span-2" />
        <TextArea id="nj-details" label="Details" value={f.details} onChange={set('details')} className="sm:col-span-2" />
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary">
            Add
          </Button>
          <Button onClick={() => onDone(null)}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
