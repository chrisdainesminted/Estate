import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CircleHelp, Cloud, ListChecks, LogOut, FileSpreadsheet, FileText, Inbox, KeyRound, Mail, MessageSquare, Moon, Phone, Plus as PlusIcon, Sun, Users, Wrench } from 'lucide-react';
import { Button, Card, CardHeader, NumberField, Segmented, SelectField, SkeletonCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { PlusOffer, PlusTag, usePlus } from '../components/Plus.jsx';
import { useAccount } from '../hooks/useAccount.js';
import { accountCall } from '../lib/account.js';
import { CITIES, cityByKey } from '../lib/canada.js';
import { normalizeBrrrr } from '../lib/brrrr.js';
import { money, percent } from '../lib/format.js';
import { call, savedWorkspace } from '../lib/landlordApi.js';
import { mailto, smsto } from '../lib/landlord.js';
import { normalizeMarket } from '../lib/market.js';
import { equitySummary, everyoneMailto, initials, landlordAlerts, telLink, tenantMessages, tenantsOf } from '../lib/profile.js';
import { rulesFor } from '../lib/tenancyRules.js';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const linkBtn = 'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm';
const secondaryLink = `${linkBtn} font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100`;
const primaryLink = `${linkBtn} bg-(--accent) font-semibold text-(--accent-ink) hover:brightness-110`;

/**
 * Your profile: what you own and what it's worth to you (total equity, debt,
 * cash flow), each property with a way in, your tenants with what needs
 * doing and a message to each one a tap away, and your settings.
 */
export default function ProfileView({ owned, prospects, hosted, account, syncText, dark, onToggleTheme, onOpen, onView, onLandlord, onAccount, onAddOwned, settings, onSettings, homeCity, exports, dealName, onHelp, onSignOut, onSetup }) {
  const plus = usePlus();
  const [email, setEmail] = useState('');
  useEffect(() => {
    if (!account) return undefined;
    let live = true;
    accountCall(account)
      .then((r) => live && setEmail(r.loginEmail || r.email || ''))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account]);

  const { totals, rows } = useMemo(() => equitySummary(owned), [owned]);
  const landlord = useLandlord();
  const name = email || (hosted ? 'Your Claude page' : account ? 'Your account' : 'Guest');

  return (
    <div className="space-y-6">
      <ViewHeader title="Your profile">Everything you own, your tenants and your settings in one place.</ViewHeader>

      <Card className="overflow-hidden">
        <div className="grid gap-6 bg-[radial-gradient(120%_140%_at_100%_0%,rgba(16,185,129,0.14),transparent_60%)] px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-emerald-600 text-lg font-semibold text-white ring-4 ring-emerald-600/15" aria-hidden>
              {initials(email || (hosted ? 'Claude' : 'Squarely'))}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-zinc-950 dark:text-white">{name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                {plus.active ? <PlusTag /> : <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-(--line-strong) ring-inset">Free</span>}
                <span className="inline-flex items-center gap-1">
                  <Cloud className="size-3.5" aria-hidden /> {syncText}
                </span>
              </p>
            </div>
          </div>
          <div>
            <p className="caption">Total equity</p>
            <p className={`tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl ${rows.length ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>{money(rows.length ? totals.equity : 0)}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {rows.length
                ? `What your ${rows.length === 1 ? 'property is' : `${rows.length} properties are`} worth today, less what you still owe on ${rows.length === 1 ? 'it' : 'them'}.`
                : 'Add a property you own to see what it’s worth to you.'}
            </p>
            {rows.length > 0 && totals.value > 0 && <EquityBar equity={totals.equity} debt={totals.debt} />}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-hairline bg-(--line-strong) sm:grid-cols-4">
          <Tile label="Worth today" value={money(totals.value)} sub={rows.length ? 'From your purchase price and growth' : '—'} />
          <Tile label="Owed on mortgages" value={money(totals.debt)} sub={totals.value > 0 ? `${percent(totals.ltv, 0)} of the value` : '—'} />
          <Tile label="Cash flow a month" value={rows.length ? money(totals.netCashFlow, { signed: true }) : money(0)} valueClass={rows.length ? signedClass(totals.netCashFlow) : ''} sub={rows.length ? `${money(totals.annualCashFlow, { signed: true })} a year` : '—'} />
          <Tile
            label={landlord.data ? 'Rent collected' : 'Units'}
            value={landlord.data ? `${money(landlord.alerts.collected)}` : String(totals.units)}
            sub={landlord.data ? `of ${money(landlord.alerts.rentRoll)} this month` : `${rows.length} propert${rows.length === 1 ? 'y' : 'ies'}`}
          />
        </dl>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Properties rows={rows} prospects={prospects} onOpen={onOpen} onView={onView} onLandlord={onLandlord} onAddOwned={onAddOwned} />
        <Tenants landlord={landlord} homeCity={homeCity} onLandlord={onLandlord} />
      </div>

      <Settings
        plus={plus}
        hosted={hosted}
        settings={settings}
        onSettings={onSettings}
        homeCity={homeCity}
        dark={dark}
        onToggleTheme={onToggleTheme}
        onAccount={onAccount}
        exports={exports}
        count={owned.length + prospects}
        dealName={dealName}
        onHelp={onHelp}
        syncText={syncText}
        account={account}
        onSignOut={onSignOut}
        onSetup={onSetup}
      />
    </div>
  );
}

function Tile({ label, value, sub, valueClass = '' }) {
  return (
    <div className="bg-(--panel) px-5 py-4">
      <dt className="caption">{label}</dt>
      <dd className={`tabular mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white ${valueClass}`}>{value}</dd>
      <dd className="tabular mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</dd>
    </div>
  );
}

/** How much of what you own is yours, against what the bank holds. */
function EquityBar({ equity, debt }) {
  const total = Math.max(equity + debt, 1);
  const pct = Math.min(Math.max(equity / total, 0), 1);
  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10" role="img" aria-label={`${Math.round(pct * 100)}% yours, ${100 - Math.round(pct * 100)}% owed`}>
        <span className="bg-emerald-500" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="tabular mt-1.5 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" aria-hidden />
          Yours {Math.round(pct * 100)}%
        </span>
        <span>
          Owed {100 - Math.round(pct * 100)}%
          <span className="ml-1 inline-block size-2 rounded-full bg-zinc-300 dark:bg-white/20" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function Properties({ rows, prospects, onOpen, onView, onLandlord, onAddOwned }) {
  return (
    <Card>
      <CardHeader
        title="Your properties"
        subtitle={rows.length ? 'Worth today, what you owe and what each one brings in.' : 'The homes and rentals you own.'}
        actions={
          <Button onClick={onAddOwned}>
            <PlusIcon className="size-4" aria-hidden /> Add one you own
          </Button>
        }
      />
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">
          <p>Nothing here yet. Add a home or rental you own with its price, mortgage and rent, and Squarely keeps its value, equity and cash flow up to date.</p>
          {prospects > 0 && (
            <p className="mt-2">
              Already bought one of your saved deals?{' '}
              <button type="button" onClick={() => onView('portfolio')} className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                Mark it as owned
              </button>
              .
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-[15px] font-semibold text-zinc-950 dark:text-white">
                  <Building2 className="size-4 shrink-0 text-emerald-600" aria-hidden /> {r.name}
                </p>
                <p className="tabular mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {r.address ? `${r.address} · ` : ''}
                  {r.units} unit{r.units === 1 ? '' : 's'} · worth {money(r.value)} · owe {money(r.balance)}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10" aria-hidden>
                    <span className="block h-full bg-emerald-500" style={{ width: `${Math.min(Math.max(r.equityPct, 0), 1) * 100}%` }} />
                  </div>
                  <span className="tabular text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-950 dark:text-white">{money(r.equity)}</span> equity
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className={`tabular mr-1 text-sm font-semibold ${signedClass(r.cashFlow)}`}>{money(r.cashFlow, { signed: true })}/mo</span>
                <Button variant="ghost" onClick={() => onOpen(r.id)}>
                  Open
                </Button>
                {r.rent > 0 && (
                  <Button variant="ghost" onClick={() => onLandlord('rent')}>
                    Rent
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-hairline px-5 py-3">
          <Button variant="ghost" onClick={() => onView('portfolio')}>
            Portfolio details <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" onClick={() => onView('plan')}>
            When you could buy the next one <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The landlord workspace on this browser (or the account's latest), loaded once. */
function useLandlord() {
  const account = useAccount();
  const ws = useMemo(() => savedWorkspace() ?? [...(account.data?.workspaces ?? [])].sort((a, b) => b.at - a.at)[0] ?? null, [account.data]);
  const [state, setState] = useState({ status: ws ? 'checking' : 'none', data: null });
  useEffect(() => {
    if (!ws) {
      setState({ status: account.status === 'loading' ? 'checking' : 'none', data: null });
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, status: s.data ? 'ready' : 'checking' }));
    call(`/w/${ws.id}`, { key: ws.key })
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((e) => live && setState({ status: 'error', data: null, error: e.status === 0 || e.status === 404 || e.status === 405 ? 'Landlord tools live on the Squarely website.' : e.message }));
    return () => {
      live = false;
    };
  }, [ws, account.status]);
  const alerts = useMemo(() => landlordAlerts(state.data), [state.data]);
  return { ...state, ws, alerts };
}

function Tenants({ landlord, homeCity, onLandlord }) {
  const { status, data, alerts } = landlord;
  const [open, setOpen] = useState(null);
  const tenants = useMemo(() => tenantsOf(data).rows, [data]);
  const settings = data?.settings ?? {};
  const entryRule = rulesFor(cityByKey(settings.city || homeCity).province)?.entry ?? '';

  return (
    <Card>
      <CardHeader
        title="Tenants & messages"
        subtitle={data ? `${alerts.tenants} tenant${alerts.tenants === 1 ? '' : 's'}${alerts.vacant ? `, ${alerts.vacant} empty unit${alerts.vacant === 1 ? '' : 's'}` : ''}` : 'Rent, repairs and a message to anyone in a tap.'}
        actions={
          data && tenants.length > 1 ? (
            <Button variant="ghost" onClick={() => setOpen(open === 'all' ? null : 'all')} aria-expanded={open === 'all'}>
              <Users className="size-4" aria-hidden /> Message everyone
            </Button>
          ) : null
        }
      />
      {status === 'checking' ? (
        <SkeletonCard className="m-5 h-40" />
      ) : status === 'none' || status === 'error' ? (
        <div className="px-5 py-6 text-sm text-zinc-600 dark:text-zinc-400">
          <p>{status === 'error' ? landlord.error : 'Track rent, take repair requests and message your tenants from here once your landlord tools are set up. Free for your first unit, then 2% of the rent you track.'}</p>
          <Button variant="primary" className="mt-4" onClick={() => onLandlord('inbox')}>
            <KeyRound className="size-4" aria-hidden /> {status === 'error' ? 'Open landlord tools' : 'Set up landlord tools'}
          </Button>
        </div>
      ) : (
        <>
          <NeedsYou alerts={alerts} onLandlord={onLandlord} />
          {open === 'all' && <Everyone rows={tenants} settings={settings} />}
          {tenants.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-600 dark:text-zinc-400">
              No tenants yet. Add each unit and who rents it under{' '}
              <button type="button" onClick={() => onLandlord('rent')} className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                Tenants & rent
              </button>
              .
            </p>
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {tenants.map((t) => (
                <TenantRow key={t.unit.id} t={t} open={open === t.unit.id} onToggle={() => setOpen(open === t.unit.id ? null : t.unit.id)} settings={settings} entryRule={entryRule} onLandlord={onLandlord} />
              ))}
            </ul>
          )}
          <div className="border-t border-hairline px-5 py-3">
            <Button variant="ghost" onClick={() => onLandlord('inbox')}>
              All landlord tools <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** What needs doing, as chips that open the right place. */
function NeedsYou({ alerts, onLandlord }) {
  const items = [
    alerts.late > 0 && { tab: 'rent', icon: AlertTriangle, tone: 'red', text: `${money(alerts.owing)} rent owing (${alerts.late} tenant${alerts.late === 1 ? '' : 's'})` },
    alerts.claims > 0 && { tab: 'rent', icon: Inbox, tone: 'amber', text: `${alerts.claims} e-Transfer${alerts.claims === 1 ? '' : 's'} to confirm` },
    alerts.repairs > 0 && { tab: 'repairs', icon: Wrench, tone: alerts.urgent ? 'red' : 'amber', text: `${alerts.repairs} open repair${alerts.repairs === 1 ? '' : 's'}${alerts.urgent ? `, ${alerts.urgent} urgent` : ''}` },
    alerts.newApplications + alerts.unreadMessages > 0 && { tab: 'inbox', icon: MessageSquare, tone: 'amber', text: `${alerts.newApplications + alerts.unreadMessages} new in your inbox` },
    alerts.leasesEnding > 0 && { tab: 'rent', icon: FileText, tone: 'zinc', text: `${alerts.leasesEnding} lease${alerts.leasesEnding === 1 ? '' : 's'} ending soon` },
  ].filter(Boolean);
  const tones = {
    red: 'bg-red-500/10 text-red-800 ring-red-600/25 dark:text-red-200',
    amber: 'bg-amber-500/10 text-amber-900 ring-amber-600/25 dark:text-amber-200',
    zinc: 'bg-well text-zinc-700 ring-(--line-strong) dark:text-zinc-300',
  };
  if (!items.length) return <p className="px-5 py-3 text-sm text-emerald-700 dark:text-emerald-400">All caught up: rent is in and nothing’s waiting on you.</p>;
  return (
    <div className="flex flex-wrap gap-2 px-5 py-3">
      {items.map((x) => (
        <button key={x.text} type="button" onClick={() => onLandlord(x.tab)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset hover:brightness-95 ${tones[x.tone]}`}>
          <x.icon className="size-3.5" aria-hidden /> {x.text}
        </button>
      ))}
    </div>
  );
}

const PILL = {
  paid: ['Paid', 'text-emerald-700 dark:text-emerald-400'],
  due: ['Due', 'text-zinc-600 dark:text-zinc-400'],
  partial: ['Part paid', 'text-amber-700 dark:text-amber-300'],
  late: ['Late', 'text-red-700 dark:text-red-300'],
  none: ['No rent set', 'text-zinc-500'],
};

function TenantRow({ t, open, onToggle, settings, entryRule, onLandlord }) {
  const { unit, status, repairs } = t;
  const tel = telLink(unit.tenantPhone);
  const [label, tone] = PILL[status.state] ?? PILL.none;
  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-well text-xs font-semibold text-zinc-700 ring-1 ring-(--line-strong) ring-inset dark:text-zinc-200" aria-hidden>
          {initials(unit.tenantName)}
        </span>
        <div className="min-w-0 grow">
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{unit.tenantName}</p>
          <p className="tabular truncate text-xs text-zinc-600 dark:text-zinc-400">
            {unit.label || 'Unit'} · <span className={`font-semibold ${tone}`}>{label}</span>
            {status.owing > 0 && status.state !== 'due' ? ` ${money(status.owing)}` : ''}
            {repairs.length > 0 && (
              <button type="button" onClick={() => onLandlord('repairs')} className="ml-1 text-amber-700 underline-offset-2 hover:underline dark:text-amber-300">
                · {repairs.length} repair{repairs.length === 1 ? '' : 's'}
              </button>
            )}
          </p>
        </div>
        {tel && (
          <a href={tel} aria-label={`Call ${unit.tenantName}`} className="grid size-9 place-items-center rounded-md text-zinc-600 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-300">
            <Phone className="size-4" aria-hidden />
          </a>
        )}
        <Button variant={open ? 'secondary' : 'ghost'} onClick={onToggle} aria-expanded={open}>
          <MessageSquare className="size-4" aria-hidden /> <span className="max-sm:sr-only">Message</span>
        </Button>
      </div>
      {open && <Composer t={t} settings={settings} entryRule={entryRule} />}
    </li>
  );
}

/** A message to one tenant: pick what it's about, change anything, send it from your own email or phone. */
function Composer({ t, settings, entryRule }) {
  const { unit } = t;
  const templates = useMemo(() => tenantMessages({ ...t, settings, entryRule }), [t, settings, entryRule]);
  const [key, setKey] = useState(templates[0].key);
  const [msg, setMsg] = useState({ subject: templates[0].subject, body: templates[0].body });
  const pick = (k) => {
    const m = templates.find((x) => x.key === k);
    setKey(k);
    setMsg({ subject: m.subject, body: m.body });
  };
  const email = String(unit.tenantEmail || '').trim();
  const phone = String(unit.tenantPhone || '').trim();
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-well p-3 ring-1 ring-(--line-strong) ring-inset">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What it’s about">
        {templates.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={key === m.key}
            onClick={() => pick(m.key)}
            className={`max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${key === m.key ? 'bg-emerald-600 text-white ring-emerald-600' : 'text-zinc-700 ring-(--line-strong) hover:bg-(--page) dark:text-zinc-300'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <input aria-label="Subject" value={msg.subject} onChange={(e) => setMsg((m) => ({ ...m, subject: e.target.value }))} className={field} />
      <textarea aria-label="Message" rows={7} value={msg.body} onChange={(e) => setMsg((m) => ({ ...m, body: e.target.value }))} className={`${field} leading-relaxed`} />
      {key === 'entry' && /\[/.test(msg.body) && <p className="text-xs text-amber-800 dark:text-amber-300">Fill in the day, times and reason in [brackets] before you send it.</p>}
      <div className="flex flex-wrap gap-2">
        {email && (
          <a href={mailto(email, msg)} className={primaryLink}>
            <Mail className="size-4" aria-hidden /> Email
          </a>
        )}
        {phone && (
          <a href={smsto(phone, msg)} className={email ? secondaryLink : primaryLink}>
            <MessageSquare className="size-4" aria-hidden /> Text
          </a>
        )}
        {!email && !phone && <p className="text-xs text-zinc-600 dark:text-zinc-400">Add {unit.tenantName.split(' ')[0]}’s email or phone under Tenants & rent to send this.</p>}
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Opens your own email or messages app with this filled in. Nothing goes out until you press send there.</p>
    </div>
  );
}

/** One note to every tenant, from your own email with everyone in Bcc. */
function Everyone({ rows, settings }) {
  const [msg, setMsg] = useState({ subject: 'A note for all tenants', body: `Hi everyone,\n\n\n\n${settings.signature || settings.name || ''}`.trimEnd() });
  const url = everyoneMailto(rows, msg);
  return (
    <div className="mx-5 mb-3 space-y-3 rounded-lg bg-well p-3 ring-1 ring-(--line-strong) ring-inset">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">For notices that go to everyone: water shut-offs, snow clearing, inspections. Each tenant is in Bcc, so no one sees the others’ addresses.</p>
      <input aria-label="Subject" value={msg.subject} onChange={(e) => setMsg((m) => ({ ...m, subject: e.target.value }))} className={field} />
      <textarea aria-label="Message to everyone" rows={5} value={msg.body} onChange={(e) => setMsg((m) => ({ ...m, body: e.target.value }))} className={`${field} leading-relaxed`} />
      {url ? (
        <a href={url} className={primaryLink}>
          <Mail className="size-4" aria-hidden /> Email everyone
        </a>
      ) : (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">None of your tenants has an email address saved yet.</p>
      )}
    </div>
  );
}

function Settings({ plus, hosted, settings, onSettings, homeCity, dark, onToggleTheme, onAccount, exports, count, dealName, onHelp, syncText, account, onSignOut, onSetup }) {
  const market = normalizeMarket(settings.market);
  const brrrr = normalizeBrrrr(settings.brrrr);
  const cities = CITIES.filter((c) => !c.key.endsWith('-other'));
  const others = CITIES.filter((c) => c.key.endsWith('-other'));
  const heading = 'text-sm font-semibold text-zinc-950 dark:text-white';
  return (
    <Card>
      <CardHeader title="Settings" subtitle="Saved as you change them, on every device you’re signed in on." />
      <div className="grid gap-x-8 gap-y-8 px-5 py-5 sm:px-6 lg:grid-cols-3">
        <section className="space-y-4">
          <h3 className={heading}>You</h3>
          <SelectField id="pf-city" label="Your city" value={homeCity} onChange={(e) => (onSettings('home', { city: e.target.value }), onSettings('market', { listingCity: e.target.value }))}>
            <optgroup label="Cities">
              {cities.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}, {c.province}
                </option>
              ))}
            </optgroup>
            <optgroup label="Elsewhere">
              {others.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </SelectField>
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Look</p>
            <Segmented
              label="Look"
              value={dark ? 'dark' : 'light'}
              onChange={(v) => (v === 'dark') !== dark && onToggleTheme()}
              options={[
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'light', label: 'Light', icon: Sun },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Account & sync</p>
            <p className="mb-2 flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <Cloud className="size-4 text-emerald-600" aria-hidden /> {syncText}
            </p>
            {!hosted && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={onAccount}>
                  <Mail className="size-4" aria-hidden /> {account ? 'Account, sync & email alerts' : 'Make an account or sign in'}
                </Button>
                {account && (
                  <Button variant="ghost" onClick={() => confirm('Sign out on this device? Your account stays; sign in again any time.') && onSignOut()}>
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </Button>
                )}
              </div>
            )}
          </div>
          {onSetup && !hosted && (
            <Button variant="ghost" onClick={onSetup} className="-ml-3.5">
              <ListChecks className="size-4" aria-hidden /> Answer the setup questions again
            </Button>
          )}
          <Button variant="ghost" onClick={onHelp} className="-ml-3.5">
            <CircleHelp className="size-4" aria-hidden /> How Squarely works
          </Button>
        </section>

        <section className="space-y-4">
          <h3 className={heading}>Your numbers</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="pf-rate" label="Mortgage rate" value={market.rate} onChange={(rate) => onSettings('market', { rate })} suffix="%" max={20} step={0.05} hint="5-year fixed" />
            <NumberField id="pf-dscr" label="Rental loan rate" value={market.dscrRate} onChange={(dscrRate) => onSettings('market', { dscrRate })} suffix="%" max={20} step={0.05} hint="Qualified on the rent" />
            <NumberField id="pf-rehab" label="BRRRR fix-up budget" value={brrrr.rehab} onChange={(rehab) => onSettings('brrrr', { rehab })} prefix="$" step={1000} decimals={0} hint="For a house" />
            <NumberField id="pf-refi" label="Refinance up to" value={brrrr.refiPct} onChange={(refiPct) => onSettings('brrrr', { refiPct })} suffix="%" max={80} step={1} decimals={0} hint="80% is the most in Canada" />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={`${heading} flex items-center gap-2`}>
            Squarely Plus {plus.active && <PlusTag />}
          </h3>
          {plus.hosted ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Every Plus tool is on for your Claude page.</p>
          ) : plus.comp ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">You have Plus for good, on the house. Every Plus tool is on.</p>
          ) : plus.active ? (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-700 dark:text-emerald-400">You have Plus{plus.cancelAt ? `, until ${new Date(plus.cancelAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.</p>
              <Button onClick={plus.manage}>Card, receipts or cancel</Button>
            </div>
          ) : (
            <PlusOffer compact />
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Your data</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={exports.exportPdf} disabled={!dealName || exports.busy === 'pdf'} className="max-w-full">
                <FileText className="size-4 shrink-0" aria-hidden /> <span className="truncate">Deal memo (PDF){dealName ? `: ${dealName}` : ''}</span>
              </Button>
              <Button variant="ghost" onClick={exports.exportCsv} disabled={!count || exports.busy === 'csv'}>
                <FileSpreadsheet className="size-4" aria-hidden /> All {count} deals (CSV)
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
