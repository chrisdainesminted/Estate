import { useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { byDay, downloadIcs, icsFile, slotTimes, timeLabel, today } from '../../lib/when.js';
import { Empty, Input, Pill, Select } from './shared.jsx';

/** Viewing times: add the hours you can show a place, and see who's coming when. */
export default function Calendar({ data, api }) {
  const listings = data.listings;
  const [f, setF] = useState({ listingId: listings[0]?.id || '', date: today(), from: '17:00', to: '19:00', minutes: 30 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const preview = f.date && f.from && f.to ? slotTimes(f.date, f.from, f.to, f.minutes) : [];
  const future = preview.filter((t) => Date.parse(t) > Date.now());

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.listingId) return setError('Add a listing first, then its viewing times.');
    if (!future.length) return setError('Those times are in the past, or the window is shorter than one viewing.');
    setBusy(true);
    try {
      await api.addSlots(future.map((start) => ({ listingId: f.listingId, start, minutes: f.minutes })));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const upcoming = data.slots.filter((s) => Date.parse(s.start) > Date.now() - 2 * 3600000);
  const appOf = (s) => data.applications.find((a) => a.id === s.applicationId);
  const listingOf = (id) => listings.find((l) => l.id === id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader title="Add viewing times" subtitle="Applicants pick from these on the listing’s page." />
        <form onSubmit={add} className="grid grid-cols-2 gap-4 p-5">
          <Select id="cal-listing" label="Listing" value={f.listingId} onChange={set('listingId')} className="col-span-2">
            {listings.length === 0 && <option value="">Add a listing first</option>}
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title || 'Untitled listing'}
              </option>
            ))}
          </Select>
          <Input id="cal-date" label="Day" type="date" value={f.date} onChange={set('date')} min={today()} className="col-span-2" />
          <Input id="cal-from" label="From" type="time" value={f.from} onChange={set('from')} />
          <Input id="cal-to" label="To" type="time" value={f.to} onChange={set('to')} />
          <Select id="cal-len" label="Each viewing" value={String(f.minutes)} onChange={(v) => set('minutes')(Number(v))} className="col-span-2">
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
          <p className="col-span-2 text-xs text-zinc-500 dark:text-zinc-400">{future.length ? `${future.length} times: ${future.map(timeLabel).join(', ')}` : 'No times in that window.'}</p>
          {error && (
            <p role="alert" className="col-span-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="col-span-2">
            <Button type="submit" variant="primary" disabled={busy || !listings.length}>
              {busy ? 'Adding…' : `Add ${future.length || ''} times`}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Coming up" subtitle="Held times wait for you to confirm in the Inbox." />
        {upcoming.length === 0 ? (
          <Empty>No viewing times yet.</Empty>
        ) : (
          <div className="divide-y divide-hairline">
            {byDay(upcoming).map((g) => (
              <section key={g.day} aria-label={g.label} className="px-5 py-4">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{g.label}</h3>
                <ul className="mt-2 grid gap-1.5">
                  {g.list.map((s) => {
                    const app = appOf(s);
                    const l = listingOf(s.listingId);
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="w-20 tabular-nums text-zinc-700 dark:text-zinc-300">{timeLabel(s.start)}</span>
                        {s.status === 'open' ? <Pill>Open</Pill> : s.status === 'held' ? <Pill tone="amber">Asked for</Pill> : <Pill tone="green">Booked</Pill>}
                        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                          {app ? app.name : ''}
                          <span className="text-zinc-500 dark:text-zinc-400">{app ? ' · ' : ''}{l?.title || ''}</span>
                        </span>
                        {s.status === 'booked' && (
                          <Button
                            variant="ghost"
                            aria-label={`Add ${app?.name || 'viewing'} to my calendar`}
                            onClick={() =>
                              downloadIcs(
                                'viewing.ics',
                                icsFile({
                                  title: `Viewing: ${app?.name || ''} · ${l?.title || ''}`,
                                  start: s.start,
                                  minutes: s.minutes || 30,
                                  location: l?.address || '',
                                  description: [app?.phone, app?.email].filter(Boolean).join(' · '),
                                  uid: `${s.id}@bedrock`,
                                }),
                              )
                            }
                          >
                            <CalendarPlus className="size-4" aria-hidden />
                          </Button>
                        )}
                        {s.status === 'open' && (
                          <Button variant="ghost" aria-label={`Remove the ${timeLabel(s.start)} time`} onClick={() => api.remove('slots', s.id)}>
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
