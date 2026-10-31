import { useEffect, useState } from 'react';
import { BellRing, Building2, Calculator, Copy, ExternalLink, FileText, Heart, Home, KeyRound, LogOut, Trash2, UserRound, Wallet } from 'lucide-react';
import PageShell, { h1 } from './PageShell.jsx';
import AuthForm from '../components/AuthForm.jsx';
import { useAccount } from '../hooks/useAccount.js';
import { accountCall, accountUrl, changePassword, resetPassword, signOut } from '../lib/account.js';
import { saveWorkspace } from '../lib/landlordApi.js';
import { money } from '../lib/format.js';
import { cityByKey } from '../lib/canada.js';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium ring-1 ring-(--line-strong) ring-inset hover:bg-well';
const primary = 'inline-flex items-center justify-center gap-1.5 rounded-md bg-(--accent) px-4 py-2 text-sm font-semibold text-(--accent-ink) hover:brightness-110 disabled:opacity-50';
const ago = (at) => (at ? new Date(at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '');

function Panel({ icon: Icon, title, subtitle, action, children, id }) {
  return (
    <section id={id} className="panel scroll-mt-6">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:text-emerald-400">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-950 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}

function Rows({ items, render }) {
  return <ul className="-my-2 divide-y divide-hairline">{items.map(render)}</ul>;
}

/** The renter's application details, saved once and filled into every application. */
function RentalProfile({ profile, onSave }) {
  const [f, setF] = useState(profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(profile), [profile]);
  const set = (k) => (e) => (setF((x) => ({ ...x, [k]: e.target.value })), setSaved(false));
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const fields = [
    ['name', 'Full name', 'text', 'name'],
    ['email', 'Email', 'email', 'email'],
    ['phone', 'Phone', 'tel', 'tel'],
    ['people', 'People who’d live with you (including you)', 'number'],
    ['income', 'Household income, a month before tax', 'number'],
    ['employer', 'Where you work', 'text', 'organization'],
    ['workYears', 'Years there', 'number'],
    ['pets', 'Pets', 'text'],
    ['refName', 'A current or past landlord', 'text'],
    ['refPhone', 'Their phone', 'tel'],
  ];
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ ...f, people: num(f.people), income: num(f.income), workYears: num(f.workYears) });
        setSaved(true);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([k, t, type, ac]) => (
          <div key={k}>
            <label htmlFor={`pf-${k}`} className={label}>
              {t}
            </label>
            <input id={`pf-${k}`} type={type} autoComplete={ac} value={f[k] ?? ''} onChange={set(k)} className={field} />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="pf-msg" className={label}>
          A few words about you, for landlords
        </label>
        <textarea id="pf-msg" rows={3} value={f.message ?? ''} onChange={set('message')} className={field} maxLength={2000} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className={primary}>
          Save profile
        </button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved. Your next application fills itself in.</span>}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Only the landlords you apply to see these, and only when you apply. Never add your Social Insurance Number.</p>
    </form>
  );
}

function Settings({ data, link }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6 text-sm">
      {data.loginEmail ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await changePassword(data.loginEmail, cur, next);
              setMsg('Password changed.');
              setCur('');
              setNext('');
            } catch (err) {
              setMsg(err.message);
            }
          }}
        >
          <div>
            <label htmlFor="pw-cur" className={label}>
              Current password
            </label>
            <input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={field} required />
          </div>
          <div>
            <label htmlFor="pw-new" className={label}>
              New password
            </label>
            <input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={field} required />
          </div>
          <button type="submit" className={btn}>
            Change password
          </button>
          {msg && <p className="text-zinc-600 sm:col-span-3 dark:text-zinc-400">{msg}</p>}
        </form>
      ) : (
        <div>
          <p className="mb-3 font-medium text-zinc-900 dark:text-white">Add an email and password, so you can sign in anywhere</p>
          <AuthForm start="signup" compact onDone={() => window.location.reload()} />
        </div>
      )}
      <div>
        <p className="font-medium text-zinc-900 dark:text-white">Backup link</p>
        <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">Opens your account without a password. Keep it somewhere safe and private.</p>
        <div className="mt-2 flex gap-2">
          <input readOnly value={accountUrl(link)} onFocus={(e) => e.target.select()} aria-label="Backup link" className={`${field} font-mono text-xs`} />
          <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(accountUrl(link)).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
            <Copy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-hairline pt-5">
        <button type="button" className={btn} onClick={signOut}>
          <LogOut className="size-4" aria-hidden /> Sign out on this device
        </button>
        <button
          type="button"
          className={`${btn} text-red-700 dark:text-red-300`}
          onClick={async () => {
            if (!confirm('Delete your account? Everything saved to it is erased, and your email and password stop working. Landlord workspaces themselves are not deleted.')) return;
            await accountCall(link, '', { method: 'DELETE' });
            signOut();
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Delete account
        </button>
      </div>
    </div>
  );
}

/** The emailed reset link lands here (#reset=…&email=…): choose a new password. */
function readReset() {
  const q = new URLSearchParams(window.location.hash.slice(1));
  return q.get('reset') && q.get('email') ? { token: q.get('reset'), email: q.get('email') } : null;
}

function ResetPassword({ reset, onDone }) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== again) return setError('The two passwords don’t match.');
        setBusy(true);
        setError('');
        try {
          await resetPassword(reset.email, reset.token, pw);
          window.history.replaceState(null, '', '/account/');
          onDone();
        } catch (err) {
          setError(err.message);
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="text-lg font-semibold text-zinc-950 dark:text-white">Choose a new password</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">For {reset.email}. You’ll be signed in here; sign in again on your other devices.</p>
      </div>
      <div>
        <label htmlFor="rs-pw" className={label}>
          New password (8 characters or more)
        </label>
        <input id="rs-pw" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="rs-again" className={label}>
          The same again
        </label>
        <input id="rs-again" type="password" required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={field} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${primary} w-full`}>
        {busy ? 'Saving…' : 'Save my new password'}
      </button>
    </form>
  );
}

export default function Account() {
  const { link, data, status, update } = useAccount();
  const [reset, setReset] = useState(readReset);

  if (reset) {
    return (
      <PageShell width="max-w-5xl">
        <div className="elevated mx-auto max-w-md rounded-2xl p-6">
          <ResetPassword reset={reset} onDone={() => setReset(null)} />
        </div>
      </PageShell>
    );
  }

  if (status === 'none' || (status === 'error' && !data)) {
    return (
      <PageShell width="max-w-5xl">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_24rem]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Your Bedrock account</p>
            <h1 className={`${h1} mt-3`}>Everything you’re working on, in one place.</h1>
            {status === 'error' && <p className="mt-3 text-sm text-red-700 dark:text-red-300">Couldn’t open the account saved on this device. Sign in again.</p>}
            <ul className="mt-8 space-y-5">
              {[
                [Home, 'Renting', 'Save homes, apply in one tap with your saved profile, follow every application, and pay rent from one page.'],
                [Calculator, 'Buying', 'Your numbers, deals, checklist and listing alerts, the same on your phone and computer.'],
                [Building2, 'Landlords', 'Your workspaces open wherever you sign in. No private link to keep track of.'],
              ].map(([Icon, t, b]) => (
                <li key={t} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:text-emerald-400">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold text-zinc-950 dark:text-white">{t}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="elevated rounded-2xl p-6">
            <AuthForm start={new URLSearchParams(window.location.search).get('mode') === 'signin' ? 'signin' : 'signup'} />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell width="max-w-5xl">
        <div className="skeleton h-64 rounded-2xl" />
      </PageShell>
    );
  }

  const openWorkspace = (w) => {
    saveWorkspace(w);
    window.location.href = `/app/?view=landlord#landlord=${w.id}.${w.key}`;
  };

  return (
    <PageShell width="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <UserRound className="size-4" aria-hidden /> {data.loginEmail || 'Signed in with your backup link'}
          </p>
          <h1 className={`${h1} mt-1`}>{data.profile?.name ? `Hi, ${data.profile.name.split(' ')[0]}` : 'Your account'}</h1>
        </div>
        <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
          {[
            ['#renting', 'Renting'],
            ['#buying', 'Buying'],
            ['#landlord', 'Landlord'],
            ['#settings', 'Settings'],
          ].map(([h, t]) => (
            <a key={h} href={h} className="rounded-full border border-hairline px-3 py-1 text-zinc-600 hover:border-(--line-strong) hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              {t}
            </a>
          ))}
        </nav>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Saved homes', data.saved.length],
          ['Applications', data.applications.length],
          ['Rentals', data.tenancies.length],
          ['Workspaces', data.workspaces.length],
        ].map(([t, v]) => (
          <div key={t} className="panel px-4 py-3">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div id="renting" className="mt-10 grid scroll-mt-6 items-start gap-6 lg:grid-cols-2">
        <Panel icon={Heart} title="Saved homes" subtitle="Tap the heart on any home to save it here." action={<a href="/homes/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Find homes</a>}>
          {data.saved.length === 0 ? (
            <Empty>No saved homes yet.</Empty>
          ) : (
            <Rows
              items={data.saved}
              render={(h) => (
                <li key={`${h.ws}:${h.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <a href={`/listing/#w=${h.ws}&l=${h.id}`} className="min-w-0">
                    <span className="block truncate font-medium text-zinc-950 hover:underline dark:text-white">{h.title || 'A home'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {[h.price ? `${money(h.price)}${h.kind === 'rent' ? '/mo' : ''}` : '', h.area, h.city ? cityByKey(h.city).name : ''].filter(Boolean).join(' · ')}
                    </span>
                  </a>
                  <button type="button" aria-label="Remove from saved" className="rounded-md p-1.5 text-zinc-400 hover:bg-well hover:text-zinc-700" onClick={() => update('saved', (s) => s.filter((x) => !(x.ws === h.ws && x.id === h.id)))}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              )}
            />
          )}
        </Panel>
        <Panel icon={FileText} title="Your applications" subtitle="Each one keeps its status page and messages.">
          {data.applications.length === 0 ? (
            <Empty>Applications you send while signed in show up here.</Empty>
          ) : (
            <Rows
              items={data.applications}
              render={(a) => (
                <li key={a.token} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <a href={`/rent/#w=${a.ws}&s=${a.token}`} className="min-w-0">
                    <span className="block truncate font-medium text-zinc-950 hover:underline dark:text-white">{a.title || 'Application'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Sent {ago(a.at)} · see status and messages</span>
                  </a>
                  <ExternalLink className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </li>
              )}
            />
          )}
        </Panel>
        <Panel icon={Wallet} title="Your rentals" subtitle="Pay rent, get receipts and report repairs.">
          {data.tenancies.length === 0 ? (
            <Empty>Open the tenant link your landlord sent you and tap “Save to my account”.</Empty>
          ) : (
            <Rows
              items={data.tenancies}
              render={(t) => (
                <li key={`${t.ws}:${t.unitId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <a href={`/rent/#w=${t.ws}&u=${t.unitId}&t=${t.token}&v=pay`} className="min-w-0">
                    <span className="block truncate font-medium text-zinc-950 hover:underline dark:text-white">{t.label || 'Your rental'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t.landlord ? `With ${t.landlord} · ` : ''}pay rent, receipts, repairs</span>
                  </a>
                  <button type="button" aria-label="Remove" className="rounded-md p-1.5 text-zinc-400 hover:bg-well hover:text-zinc-700" onClick={() => update('tenancies', (s) => s.filter((x) => !(x.ws === t.ws && x.unitId === t.unitId)))}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              )}
            />
          )}
        </Panel>
        <Panel icon={UserRound} title="Rental profile" subtitle="Fills in every application for you.">
          <RentalProfile profile={data.profile} onSave={(p) => update('profile', () => p)} />
        </Panel>
      </div>

      <div id="buying" className="mt-6 scroll-mt-6">
        <Panel icon={Calculator} title="Buying" subtitle="Your numbers, deals, checklist and listing alerts sync to this account in the app.">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href="/app/?view=home" className={primary}>
              Open your first-home plan
            </a>
            <a href="/app/?view=listings" className={btn}>
              <BellRing className="size-4" aria-hidden /> {data.alerts.length ? `${data.alerts.length} listing alert${data.alerts.length === 1 ? '' : 's'}` : 'Set a listing alert'}
            </a>
            <span className="text-zinc-500 dark:text-zinc-400">{data.data?.deals?.length ? `${data.data.deals.length} deals saved` : 'Nothing saved from the app yet'}</span>
          </div>
        </Panel>
      </div>

      <div id="landlord" className="mt-6 scroll-mt-6">
        <Panel icon={KeyRound} title="Landlord workspaces" subtitle="Listings, applicants, tenants, rent and taxes. Opening one while signed in saves it here." action={<a href="/app/?view=landlord" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Start one</a>}>
          {data.workspaces.length === 0 ? (
            <Empty>No workspaces yet. List a home or add your rentals to start one.</Empty>
          ) : (
            <Rows
              items={data.workspaces}
              render={(w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-medium text-zinc-950 dark:text-white">{w.name || 'Landlord workspace'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved {ago(w.at)}</span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className={primary} onClick={() => openWorkspace(w)}>
                      Open
                    </button>
                    <button type="button" aria-label="Remove from account" className="rounded-md p-1.5 text-zinc-400 hover:bg-well hover:text-zinc-700" onClick={() => confirm('Remove this workspace from your account? The workspace itself stays, and its private link still opens it.') && update('workspaces', (s) => s.filter((x) => x.id !== w.id))}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </span>
                </li>
              )}
            />
          )}
        </Panel>
      </div>

      <div id="settings" className="mt-6 scroll-mt-6">
        <Panel icon={UserRound} title="Settings">
          <Settings data={data} link={link} />
        </Panel>
      </div>
    </PageShell>
  );
}
