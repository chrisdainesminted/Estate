import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Home, Inbox as InboxIcon, KeyRound, Landmark, ReceiptText, Scale, Settings, Wrench } from 'lucide-react';
import { Button, Card, CardHeader, ViewHeader } from '../../components/ui.jsx';
import { ApiError, call, links, saveWorkspace, savedWorkspace } from '../../lib/landlordApi.js';
import { cityByKey } from '../../lib/canada.js';
import { rentStatus, today } from '../../lib/landlord.js';
import { CopyButton, Input } from './shared.jsx';
import Inbox from './Inbox.jsx';
import Calendar from './Calendar.jsx';
import ListingsPanel from './ListingsPanel.jsx';
import RentPanel from './RentPanel.jsx';
import Repairs from './Repairs.jsx';
import Expenses from './Expenses.jsx';
import Rules from './Rules.jsx';
import SettingsPanel from './SettingsPanel.jsx';

/**
 * A photo made ready to upload: at most 1600 pixels on its long side, as a
 * JPEG, so phone photos (often 4 to 10 MB) go up quickly and fit the limit.
 */
async function shrinkPhoto(file) {
  if (!file.type.startsWith('image/')) throw new ApiError(415, 'Choose a photo (JPEG, PNG or WebP).');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new ApiError(415, 'That photo couldn’t be read. Try a JPEG or PNG.');
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= 1_400_000) return blob;
  }
  throw new ApiError(413, 'That photo is too large.');
}

/** A private link pasted in, or carried in this page's #landlord=id.key. */
function parseWorkspace(text) {
  const m = /landlord=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{16,128})/.exec(String(text || ''));
  return m ? { id: m[1], key: m[2] } : null;
}

const TABS = [
  { key: 'inbox', label: 'Inbox', icon: InboxIcon },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'listings', label: 'Listings', icon: Home },
  { key: 'rent', label: 'Tenants & rent', icon: KeyRound },
  { key: 'repairs', label: 'Repairs', icon: Wrench },
  { key: 'expenses', label: 'Expenses & taxes', icon: ReceiptText },
  { key: 'rules', label: 'Rules', icon: Scale },
  { key: 'settings', label: 'Settings', icon: Settings },
];

/**
 * The landlord's workspace: applicants and viewings, listings, tenants and
 * rent, repairs, expenses for tax time, and the province's rules. Lives on
 * the website's server, opened with the private link made here.
 */
export default function LandlordView({ homeCity }) {
  const [ws, setWs] = useState(() => {
    const fromLink = parseWorkspace(location.hash);
    if (fromLink) {
      saveWorkspace(fromLink);
      history.replaceState(null, '', location.pathname + location.search);
      return fromLink;
    }
    return savedWorkspace();
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('inbox');

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setData(await call(`/w/${ws.id}`, { key: ws.key }));
      setError('');
    } catch (e) {
      setError(e.status === 0 || e.status === 404 || e.status === 405 ? 'offline' : e.message);
      if (e.status === 401) setError('This browser’s private link no longer opens the workspace. Paste the link you saved.');
    }
  }, [ws]);

  useEffect(() => {
    load();
    // Applications and repair reports arrive while the page is open: check every minute and on return.
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  /** Save a record (create when `id` is null) and fold the answer into what's on screen. */
  const save = useCallback(
    async (collection, id, body) => {
      const item = id ? await call(`/w/${ws.id}/${collection}/${id}`, { method: 'PUT', key: ws.key, body }) : await call(`/w/${ws.id}/${collection}`, { method: 'POST', key: ws.key, body });
      if (collection === 'settings') setData((d) => ({ ...d, settings: item }));
      else setData((d) => ({ ...d, [collection]: id ? d[collection].map((x) => (x.id === id ? item : x)) : [...d[collection], item] }));
      // Booking changes move slots and applications together: reload both.
      if (collection === 'applications' && body.status) load();
      return item;
    },
    [ws, load],
  );
  const remove = useCallback(
    async (collection, id) => {
      await call(`/w/${ws.id}/${collection}/${id}`, { method: 'DELETE', key: ws.key });
      await load();
    },
    [ws, load],
  );
  const api = useMemo(
    () => ({
      save,
      remove,
      reload: load,
      addSlots: async (slots) => {
        await call(`/w/${ws?.id}/slots/batch`, { method: 'POST', key: ws?.key, body: { slots } });
        await load();
      },
      moveSlot: async (appId, slotId) => {
        await call(`/w/${ws?.id}/applications/${appId}/slot`, { method: 'POST', key: ws?.key, body: { slotId } });
        await load();
      },
      message: async (applicationId, body) => {
        await call(`/w/${ws?.id}/messages`, { method: 'POST', key: ws?.key, body: { applicationId, body } });
        await load();
      },
      readThread: (appId) => call(`/w/${ws?.id}/applications/${appId}/read`, { method: 'POST', key: ws?.key, body: {} }),
      uploadPhoto: async (listingId, file) => {
        const blob = await shrinkPhoto(file);
        let res;
        try {
          res = await fetch(`/api/w/${ws?.id}/listings/${listingId}/photos`, { method: 'POST', headers: { authorization: `Bearer ${ws?.key}`, 'content-type': blob.type }, body: blob });
        } catch {
          throw new ApiError(0, 'Couldn’t upload. Check your connection.');
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new ApiError(res.status, data?.error || 'Couldn’t upload that photo.');
        await load();
      },
      removePhoto: async (listingId, photoId) => {
        await call(`/w/${ws?.id}/listings/${listingId}/photos/${photoId}`, { method: 'DELETE', key: ws?.key });
        await load();
      },
      coverPhoto: async (listingId, photoId) => {
        await call(`/w/${ws?.id}/listings/${listingId}/cover`, { method: 'POST', key: ws?.key, body: { photoId } });
        await load();
      },
      renew: async (listingId) => {
        await call(`/w/${ws?.id}/listings/${listingId}/renew`, { method: 'POST', key: ws?.key, body: {} });
        await load();
      },
      verifySend: () => call(`/w/${ws?.id}/verify/send`, { method: 'POST', key: ws?.key, body: {} }),
      verifyCheck: async (code) => {
        await call(`/w/${ws?.id}/verify/check`, { method: 'POST', key: ws?.key, body: { code } });
        await load();
      },
    }),
    [save, remove, load, ws],
  );

  if (!ws) return <Start onReady={setWs} />;
  if (error === 'offline') return <Offline />;
  if (error && !data)
    return (
      <div className="space-y-6">
        <Header />
        <Card className="p-5">
          <p role="alert" className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
          <Reconnect onReady={setWs} />
        </Card>
      </div>
    );
  if (!data) return <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">Opening your workspace…</p>;

  const province = cityByKey(data.settings?.city || homeCity).province;
  const unread = data.applications.filter((a) => !a.read && a.status !== 'withdrawn').length + data.maintenance.filter((m) => !m.read).length;
  const config = data.config || {};
  const late = data.units.filter((u) => ['late', 'partial'].includes(rentStatus(u, data.payments, today()).state)).length;
  const openRepairs = data.maintenance.filter((m) => m.status !== 'fixed').length;
  const badge = { inbox: unread, rent: late, repairs: openRepairs };
  const props = { data, api, ws, province, homeCity, config, settings: data.settings || {}, go: setTab };

  return (
    <div className="space-y-6">
      <Header />
      {!data.settings?.name && tab !== 'settings' && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Add your name and contact details first: they go on your listing page and in your replies.</p>
          <Button variant="primary" onClick={() => setTab('settings')}>
            Set up
          </Button>
        </Card>
      )}
      <nav aria-label="Landlord sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-emerald-500 ${
              tab === t.key ? 'bg-zinc-950/[0.06] font-semibold text-zinc-950 shadow-[inset_0_-2px_0_var(--accent)] dark:bg-white/[0.08] dark:text-white' : 'font-medium text-zinc-600 hover:bg-well hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
            {badge[t.key] > 0 && (
              <span className="rounded-full bg-(--accent) px-1.5 text-[11px] font-bold text-(--accent-ink)">
                {badge[t.key]}
                <span className="sr-only"> {t.key === 'inbox' ? 'new' : t.key === 'rent' ? 'unpaid' : 'open'}</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {tab === 'inbox' && <Inbox {...props} />}
      {tab === 'calendar' && <Calendar {...props} />}
      {tab === 'listings' && <ListingsPanel {...props} />}
      {tab === 'rent' && <RentPanel {...props} />}
      {tab === 'repairs' && <Repairs {...props} />}
      {tab === 'expenses' && <Expenses {...props} />}
      {tab === 'rules' && <Rules {...props} />}
      {tab === 'settings' && <SettingsPanel {...props} onForget={() => (saveWorkspace(null), setWs(null), setData(null))} />}
    </div>
  );
}

function Header() {
  return (
    <ViewHeader title="Landlord">
      List a home for rent or for sale, talk to the people who answer, book viewings, and keep tenants, rent, repairs and tax records in one place.{' '}
      <a className="font-medium text-emerald-700 hover:underline dark:text-emerald-400" href="/homes/">
        See public listings
      </a>
    </ViewHeader>
  );
}

function Offline() {
  return (
    <div className="space-y-6">
      <Header />
      <Card className="p-5 text-sm text-zinc-700 dark:text-zinc-300">
        The landlord tools need Bedrock’s server, so they work on the website:{' '}
        <a className="font-medium text-emerald-700 underline dark:text-emerald-400" href="https://bedrock.signia83.workers.dev/app/?view=landlord" target="_blank" rel="noreferrer">
          bedrock.signia83.workers.dev
        </a>
        .
      </Card>
    </div>
  );
}

function Reconnect({ onReady }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const w = parseWorkspace(text);
        if (!w) return setBad(true);
        saveWorkspace(w);
        onReady(w);
      }}
    >
      <Input id="ll-link" label="Your private link" value={text} onChange={(v) => (setText(v), setBad(false))} className="min-w-64 flex-1" hint={bad ? 'That isn’t a Bedrock private link.' : undefined} />
      <Button type="submit">Open</Button>
    </form>
  );
}

function Start({ onReady }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const w = await call('/workspaces', { method: 'POST' });
      saveWorkspace(w);
      setMade(w);
    } catch (e) {
      setError(e instanceof ApiError && (e.status === 0 || e.status === 404 || e.status === 405) ? 'The landlord tools need Bedrock’s server, so they work on the website, not in this copy.' : e.message);
    }
    setBusy(false);
  };
  if (made)
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardHeader title="Save your private link" subtitle="It’s the only key to your workspace. There’s no password to reset." />
          <div className="space-y-4 p-5 text-sm">
            <p className="text-zinc-700 dark:text-zinc-300">
              This browser remembers it. To open your workspace on another device, or if this browser forgets, use this link. Keep it somewhere safe, like a password manager, and don’t share it: anyone with it can see your
              tenants’ details.
            </p>
            <input readOnly aria-label="Your private link" value={links.private(made)} onFocus={(e) => e.target.select()} className="field w-full px-3 py-2.5 font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <CopyButton text={links.private(made)} label="Copy private link" />
              <Button variant="primary" onClick={() => onReady(made)}>
                I’ve saved it, open my workspace
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  return (
    <div className="space-y-6">
      <Header />
      <Card>
        <CardHeader title="Run your rentals from one place" subtitle="Free. No account: a private link opens it." />
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <ul className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            {[
              [InboxIcon, 'A page for each listing where people apply and pick a viewing time from your calendar. Their pick is held until you confirm.'],
              [CalendarDays, 'Set the times you can show the place; confirmed viewings drop into your phone’s calendar.'],
              [KeyRound, 'Who’s paid rent this month, who’s late, and a reminder ready to send.'],
              [Wrench, 'A repair link for each tenant, and a list of jobs from reported to fixed.'],
              [Landmark, 'Expenses sorted by the CRA’s T776 lines, totalled for tax time.'],
              [Scale, 'Your province’s rules: rent increase limits, notice, deposits and leases.'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Replies go out from your own email or phone, written for you and sent only when you press send. Applicants’ details are kept on Bedrock’s server for your workspace only, and closed applications are deleted
              after 180 days.
            </p>
            <Button variant="primary" onClick={create} disabled={busy}>
              {busy ? 'Setting up…' : 'Start my landlord workspace'}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">I already have one</summary>
              <Reconnect onReady={onReady} />
            </details>
          </div>
        </div>
      </Card>
    </div>
  );
}
