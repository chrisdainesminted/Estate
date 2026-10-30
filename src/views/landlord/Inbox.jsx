import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Plus, Send, Trash2, Wrench } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { applicationReplies } from '../../lib/landlord.js';
import { links } from '../../lib/landlordApi.js';
import { dateLabel, whenLabel } from '../../lib/when.js';
import { Empty, Input, Pill, Select, SendButtons, TextArea } from './shared.jsx';

const STATUS = {
  new: ['New', 'amber'],
  viewing: ['Viewing booked', 'green'],
  approved: ['Offered', 'green'],
  declined: ['Declined', 'zinc'],
  withdrawn: ['Withdrawn', 'zinc'],
};
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${Math.max(m, 1)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

/** New applications and repair reports, newest first; pick one to read and reply. */
export default function Inbox({ data, api, ws, settings, go }) {
  const items = useMemo(() => {
    const apps = data.applications.map((a) => ({ kind: 'app', id: a.id, t: a.created, unread: !a.read, item: a }));
    const fixes = data.maintenance.filter((m) => !m.read || m.status === 'reported').map((m) => ({ kind: 'fix', id: m.id, t: m.created, unread: !m.read, item: m }));
    return [...apps, ...fixes].sort((a, b) => Number(b.unread) - Number(a.unread) || b.t - a.t);
  }, [data]);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const open = items.find((x) => x.id === openId);

  useEffect(() => {
    // Opening something marks it read.
    if (open?.unread) api.save(open.kind === 'app' ? 'applications' : 'maintenance', open.id, { read: true }).catch(() => {});
  }, [open, api]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader
          title="Inbox"
          subtitle={`${items.filter((x) => x.unread).length} new`}
          actions={
            <Button onClick={() => (setAdding(true), setOpenId(null))}>
              <Plus className="size-4" aria-hidden /> Add an applicant
            </Button>
          }
        />
        {items.length === 0 ? (
          <Empty>Nothing yet. Share a listing’s link and applications show up here.</Empty>
        ) : (
          <ul className="divide-y divide-hairline">
            {items.map((x) => {
              const listing = x.kind === 'app' ? data.listings.find((l) => l.id === x.item.listingId) : null;
              const unit = x.kind === 'fix' ? data.units.find((u) => u.id === x.item.unitId) : null;
              const [label, tone] = x.kind === 'app' ? (STATUS[x.item.status] ?? STATUS.new) : [x.item.urgency === 'urgent' ? 'Urgent repair' : 'Repair', x.item.urgency === 'urgent' ? 'red' : 'amber'];
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => (setOpenId(x.id), setAdding(false))}
                    aria-current={openId === x.id ? 'true' : undefined}
                    className={`flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-well ${openId === x.id ? 'bg-well' : ''}`}
                  >
                    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${x.unread ? 'bg-(--accent)' : 'bg-transparent'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${x.unread ? 'font-semibold text-zinc-950 dark:text-white' : 'font-medium text-zinc-800 dark:text-zinc-200'}`}>
                          {x.kind === 'app' ? x.item.name : x.item.title}
                          {x.unread && <span className="sr-only"> (new)</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">{ago(x.t)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <Pill tone={tone}>{label}</Pill>
                        <span className="truncate">{x.kind === 'app' ? listing?.title || 'Listing' : unit?.label || 'Unit'}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div>
        {adding ? (
          <AddApplicant data={data} api={api} onDone={(id) => (setAdding(false), setOpenId(id))} />
        ) : open?.kind === 'app' ? (
          <Application key={open.id} app={open.item} data={data} api={api} ws={ws} settings={settings} />
        ) : open?.kind === 'fix' ? (
          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
              <Wrench className="size-4" aria-hidden /> {open.item.title}
            </p>
            {open.item.details && <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{open.item.details}</p>}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              From {open.item.reportedBy || 'your tenant'}
              {open.item.contact ? ` · ${open.item.contact}` : ''} · {open.item.entryOk ? 'OK to enter if they’re out' : 'Arrange a time to enter'}
            </p>
            <Button onClick={() => go('repairs')}>
              Open in Repairs <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Card>
        ) : (
          <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Pick something on the left to read it and reply.</Card>
        )}
      </div>
    </div>
  );
}

function Application({ app, data, api, ws, settings }) {
  const listing = data.listings.find((l) => l.id === app.listingId);
  const slot = app.slotId ? data.slots.find((s) => s.id === app.slotId) : null;
  const openTimes = data.slots.filter((s) => s.listingId === app.listingId && s.status === 'open' && Date.parse(s.start) > Date.now());
  const statusLink = app.token ? links.status(ws.id, app.token) : '';
  const replies = applicationReplies({ app, listing, slot, settings, statusLink, openTimes });
  const [pick, setPick] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reply = replies.find((r) => r.key === pick);
  const [label, tone] = STATUS[app.status] ?? STATUS.new;

  const choose = (r) => {
    setPick(r.key);
    setBody(r.body);
  };
  /**
   * As a reply goes out, move the application along. Sent in Bedrock, the
   * message itself is on the applicant's page; sent by email or text, a
   * short note goes there instead.
   */
  const record = async (inBedrock = false) => {
    if (!reply) return;
    setBusy(true);
    setError('');
    try {
      if (reply.releaseSlot && slot) await api.moveSlot(app.id, '');
      if (inBedrock) await api.message(app.id, body);
      await api.save('applications', app.id, { status: reply.status, ...(inBedrock ? {} : { note: reply.note }), read: true });
      if (inBedrock) setPick(null);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const thread = (data.messages || []).filter((m) => m.applicationId === app.id);
  useEffect(() => {
    if (thread.some((m) => m.from === 'applicant' && !m.read)) api.readThread(app.id).catch(() => {});
  }, [thread, app.id, api]);

  return (
    <Card>
      <CardHeader title={app.name} subtitle={`${listing?.title || 'Listing'} · applied ${new Date(app.created).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}`} actions={<Pill tone={tone}>{label}</Pill>} />
      <div className="space-y-5 p-5 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {app.email && (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd>
                <a className="text-emerald-700 underline dark:text-emerald-400" href={`mailto:${app.email}`}>
                  {app.email}
                </a>
              </dd>
            </div>
          )}
          {app.phone && (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Phone</dt>
              <dd>
                <a className="text-emerald-700 underline dark:text-emerald-400" href={`tel:${app.phone}`}>
                  {app.phone}
                </a>
              </dd>
            </div>
          )}
          {app.moveIn && (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Move in</dt>
              <dd>{dateLabel(app.moveIn)}</dd>
            </div>
          )}
          {app.people > 0 && (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">People</dt>
              <dd>{app.people}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Viewing</dt>
            <dd className="font-medium text-zinc-900 dark:text-white">{slot ? `${whenLabel(slot.start)}${slot.status === 'booked' ? ' (confirmed)' : ' (asked for, not confirmed yet)'}` : 'No time picked'}</dd>
          </div>
        </dl>
        {app.message && <p className="border-l-2 border-hairline pl-3 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{app.message}</p>}
        <Conversation app={app} thread={thread} api={api} />

        {app.status !== 'withdrawn' && (
          <section aria-labelledby={`reply-${app.id}`} className="border-t border-hairline pt-4">
            <h3 id={`reply-${app.id}`} className="font-semibold text-zinc-950 dark:text-white">
              Reply
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {replies.map((r) => (
                <Button key={r.key} variant={pick === r.key ? 'primary' : 'secondary'} onClick={() => choose(r)}>
                  {r.label}
                </Button>
              ))}
            </div>
            {reply && (
              <div className="mt-4 space-y-3">
                <TextArea id={`body-${app.id}`} label={`Message: ${reply.subject}`} value={body} onChange={setBody} rows={8} />
                <div className="flex flex-wrap items-center gap-2">
                  {app.token && (
                    <Button variant="primary" disabled={busy} onClick={() => record(true)}>
                      <Send className="size-4" aria-hidden /> Send in Bedrock
                    </Button>
                  )}
                  {(app.email || app.phone) && <SendButtons email={app.email} phone={app.phone} message={{ subject: reply.subject, body }} onSent={() => record(false)} secondary />}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  In Bedrock, it shows on {first(app.name)}’s page, where they can reply. Email or text opens your own app with it filled in. Either way the application moves to “{(STATUS[reply.status] ?? STATUS.new)[0]}”.
                </p>
                {busy && <p className="text-xs text-zinc-500">Saving…</p>}
              </div>
            )}
          </section>
        )}

        {app.status === 'new' && openTimes.length > 0 && (
          <Select id={`move-${app.id}`} label="Move to another open time" value="" onChange={(v) => v && api.moveSlot(app.id, v).catch((e) => setError(e.message))} className="max-w-sm">
            <option value="">Choose a time…</option>
            {openTimes.map((s) => (
              <option key={s.id} value={s.id}>
                {whenLabel(s.start)}
              </option>
            ))}
          </Select>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
          {statusLink && <span className="text-xs text-zinc-500 dark:text-zinc-400">The applicant’s own page shows their status and lets them change time or withdraw.</span>}
          <Button variant="ghost" onClick={() => confirm(`Delete ${app.name}’s application? This can’t be undone.`) && api.remove('applications', app.id)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'the applicant';

/** The messages with one applicant, and a box to write your own. */
function Conversation({ app, thread, api }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!app.token) return null; // added by hand: they have no page to read replies on
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.message(app.id, text);
      setText('');
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <section aria-labelledby={`conv-${app.id}`} className="border-t border-hairline pt-4">
      <h3 id={`conv-${app.id}`} className="font-semibold text-zinc-950 dark:text-white">
        Messages
      </h3>
      <ol className="mt-3 space-y-2" aria-live="polite">
        {thread.length === 0 && <li className="text-zinc-500 dark:text-zinc-400">No messages yet.</li>}
        {thread.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-md px-3 py-2 ${m.from === 'landlord' ? 'ml-auto bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-50' : 'bg-zinc-100 text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-100'}`}>
            <p className="sr-only">{m.from === 'landlord' ? 'You' : app.name}:</p>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="mt-1 text-[11px] opacity-70">
              {new Date(m.created).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {m.from === 'landlord' && (m.read ? ' · Seen' : ' · Sent')}
            </p>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`write-${app.id}`} className="sr-only">
            Message {app.name}
          </label>
          <textarea id={`write-${app.id}`} rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={`Message ${first(app.name)}`} className="field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100" />
        </div>
        <Button type="submit" variant="primary" disabled={busy || !text.trim()} aria-label="Send message">
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}

/** An applicant who reached you somewhere else (Kijiji, Facebook, a phone call). */
function AddApplicant({ data, api, onDone }) {
  const [f, setF] = useState({ listingId: data.listings[0]?.id || '', name: '', email: '', phone: '', message: '' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name) return setError('Add their name.');
    try {
      const a = await api.save('applications', null, { ...f, status: 'new', read: true });
      onDone(a.id);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Card>
      <CardHeader title="Add an applicant" subtitle="Someone who reached you elsewhere: paste their message, then reply from here." />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Select id="add-listing" label="Listing" value={f.listingId} onChange={set('listingId')} className="sm:col-span-2">
          {data.listings.length === 0 && <option value="">Add a listing first</option>}
          {data.listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title || 'Untitled listing'}
            </option>
          ))}
        </Select>
        <Input id="add-name" label="Name" value={f.name} onChange={set('name')} className="sm:col-span-2" />
        <Input id="add-email" label="Email" type="email" value={f.email} onChange={set('email')} />
        <Input id="add-phone" label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
        <TextArea id="add-msg" label="Their message" value={f.message} onChange={set('message')} rows={5} className="sm:col-span-2" />
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={!f.listingId}>
            Add
          </Button>
        </div>
      </form>
    </Card>
  );
}
