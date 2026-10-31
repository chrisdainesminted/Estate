import { useEffect, useState } from 'react';
import { BadgeCheck, Bath, BedDouble, Home, Plus } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { Button } from '../components/ui.jsx';
import { call } from '../lib/landlordApi.js';
import { CITIES, PROVINCES, cityByKey } from '../lib/canada.js';
import { money } from '../lib/format.js';
import { PROPERTY_TYPES } from '../../worker/schema.js';

/**
 * Bedrock's public listings: homes and rooms for rent, and homes for sale
 * by owner, across Canada. The search lives in the address, so a search
 * can be shared. #admin opens the review of reported listings.
 */
export default function HomesPage() {
  const [admin, setAdmin] = useState(() => location.hash === '#admin');
  useEffect(() => {
    const on = () => setAdmin(location.hash === '#admin');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" aria-label="Bedrock home">
            <Logo />
          </a>
          <nav aria-label="Site" className="flex items-center gap-1 text-sm">
            <a href="/app/" className="hidden rounded-md px-3 py-2 font-medium text-zinc-600 hover:bg-well hover:text-zinc-900 sm:inline-block dark:text-zinc-400 dark:hover:text-white">
              Calculators
            </a>
            <a href="/app/?view=landlord" className="inline-flex items-center gap-1.5 rounded-md bg-(--accent) px-3 py-2 font-semibold text-(--accent-ink) hover:brightness-110">
              <Plus className="size-4" aria-hidden /> List a home
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{admin ? <Review /> : <Search />}</main>
      <SiteFooter />
    </div>
  );
}

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

/** "toronto" for a city, "p:ON" for a whole province, "" for all of Canada. */
function PlaceSelect({ value, onChange }) {
  return (
    <div>
      <label htmlFor="hs-place" className={label}>
        Where
      </label>
      <select id="hs-place" value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">All of Canada</option>
        {PROVINCES.map((p) => (
          <optgroup key={p.code} label={p.name}>
            <option value={`p:${p.code}`}>All of {p.name}</option>
            {CITIES.filter((c) => c.province === p.code && !c.key.endsWith('-other')).map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

const readQuery = () => {
  const q = new URLSearchParams(location.search);
  return { kind: q.get('kind') === 'sale' ? 'sale' : 'rent', place: q.get('place') || '', max: q.get('max') || '', beds: q.get('beds') || '', type: q.get('type') || '', sort: q.get('sort') || 'new', page: Number(q.get('page')) || 1 };
};

function Search() {
  const [q, setQ] = useState(readQuery);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const set = (patch) => setQ((x) => ({ ...x, page: 1, ...patch }));

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'new') && !(k === 'kind' && v === 'rent')) params.set(k, v);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
    const api = new URLSearchParams({ kind: q.kind, sort: q.sort, page: String(q.page) });
    if (q.place.startsWith('p:')) api.set('province', q.place.slice(2));
    else if (q.place) api.set('city', q.place);
    if (q.max) api.set('maxPrice', q.max);
    if (q.beds) api.set('minBeds', q.beds);
    if (q.type) api.set('type', q.type);
    let live = true;
    setError('');
    call(`/listings?${api}`)
      .then((r) => live && setRes(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [q]);

  const sale = q.kind === 'sale';
  const where = q.place.startsWith('p:') ? PROVINCES.find((p) => p.code === q.place.slice(2))?.name : q.place ? cityByKey(q.place).name : 'Canada';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{sale ? `Homes for sale by owner in ${where}` : `Homes for rent in ${where}`}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{sale ? 'Listed by their owners. Book a time to see one and message the seller here.' : 'Apply, book a viewing and message the landlord, all in one place.'}</p>
      </div>
      <div role="radiogroup" aria-label="Rent or buy" className="inline-flex overflow-hidden rounded-md border border-(--line-strong)">
        {[
          ['rent', 'For rent'],
          ['sale', 'For sale'],
        ].map(([k, l], i) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={q.kind === k}
            onClick={() => set({ kind: k, max: '' })}
            className={`px-4 py-2 text-sm ${i ? 'border-l border-(--line-strong)' : ''} ${q.kind === k ? 'bg-zinc-950/[0.05] font-semibold text-zinc-950 shadow-[inset_0_-2px_0_var(--accent)] dark:bg-white/[0.07] dark:text-white' : 'font-medium text-zinc-600 hover:bg-well dark:text-zinc-400'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PlaceSelect value={q.place} onChange={(place) => set({ place })} />
        <div>
          <label htmlFor="hs-max" className={label}>
            {sale ? 'Most I’d pay' : 'Most rent a month'}
          </label>
          <select id="hs-max" value={q.max} onChange={(e) => set({ max: e.target.value })} className={field}>
            <option value="">Any price</option>
            {(sale ? [300000, 400000, 500000, 600000, 750000, 1000000, 1500000] : [1000, 1250, 1500, 1750, 2000, 2500, 3000]).map((v) => (
              <option key={v} value={v}>
                {money(v)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hs-beds" className={label}>
            Bedrooms
          </label>
          <select id="hs-beds" value={q.beds} onChange={(e) => set({ beds: e.target.value })} className={field}>
            <option value="">Any</option>
            {[1, 2, 3, 4].map((b) => (
              <option key={b} value={b}>
                {b}+
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hs-type" className={label}>
            Type
          </label>
          <select id="hs-type" value={q.type} onChange={(e) => set({ type: e.target.value })} className={field}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hs-sort" className={label}>
            Sort
          </label>
          <select id="hs-sort" value={q.sort} onChange={(e) => set({ sort: e.target.value })} className={field}>
            <option value="new">Newest</option>
            <option value="price">Lowest price</option>
            <option value="price-desc">Highest price</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {res ? `${res.total} ${res.total === 1 ? 'home' : 'homes'}` : 'Searching…'}
      </p>
      {res && res.items.length === 0 && (
        <div className="panel p-8 text-center">
          <Home className="mx-auto size-8 text-zinc-400" aria-hidden />
          <p className="mt-3 font-medium text-zinc-900 dark:text-white">No homes listed here yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Try all of Canada, or be the first: listing is free.</p>
          <a href="/app/?view=landlord" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-(--accent) px-4 py-2 text-sm font-semibold text-(--accent-ink)">
            <Plus className="size-4" aria-hidden /> List a home
          </a>
        </div>
      )}
      {res && res.items.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {res.items.map((h) => (
            <li key={h.key}>
              <Card h={h} />
            </li>
          ))}
        </ul>
      )}
      {res && res.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3">
          <Button disabled={q.page <= 1} onClick={() => setQ((x) => ({ ...x, page: x.page - 1 }))}>
            Previous
          </Button>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Page {res.page} of {res.pages}
          </span>
          <Button disabled={q.page >= res.pages} onClick={() => setQ((x) => ({ ...x, page: x.page + 1 }))}>
            Next
          </Button>
        </nav>
      )}
      <p className="border-t border-hairline pt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Listings are posted by their owners; Bedrock isn’t a real estate brokerage and doesn’t check every listing. See a place in person before you pay anything, and report anything that looks wrong.
      </p>
    </div>
  );
}

function Card({ h }) {
  const type = PROPERTY_TYPES.find((t) => t.key === h.propertyType)?.label;
  const place = [h.area, h.city ? cityByKey(h.city).name.replace(/^Elsewhere in /, '') : ''].filter(Boolean).join(', ');
  return (
    <a href={`/listing/#w=${h.ws}&l=${h.id}`} className="tile group block overflow-hidden rounded-xl border border-hairline bg-(--panel) focus-visible:outline-2 focus-visible:outline-(--accent)">
      <div className="aspect-[4/3] bg-zinc-100 dark:bg-white/[0.04]">
        {h.photo ? (
          <img src={`/api/w/${h.ws}/photos/${h.photo}`} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center text-zinc-400">
            <Home className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
          {h.price > 0 ? money(h.price) : 'Ask'}
          {h.kind === 'rent' && h.price > 0 && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400"> /month</span>}
        </p>
        <p className="truncate font-medium text-zinc-800 group-hover:underline dark:text-zinc-200">{h.title}</p>
        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{[type, place].filter(Boolean).join(' · ')}</p>
        <p className="flex items-center gap-3 pt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {h.beds > 0 && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5" aria-hidden /> {h.beds} bed
            </span>
          )}
          {h.baths > 0 && (
            <span className="inline-flex items-center gap-1">
              <Bath className="size-3.5" aria-hidden /> {h.baths} bath
            </span>
          )}
          {h.verified && (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-3.5" aria-hidden /> Email confirmed
            </span>
          )}
        </p>
      </div>
    </a>
  );
}

/** The site owner's review of reported listings (needs the ADMIN_KEY set in Cloudflare). */
function Review() {
  const [key, setKey] = useState(() => sessionStorage.getItem('bedrock-admin') || '');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = async (k = key) => {
    try {
      setList(await call('/admin/reported', { key: k }));
      sessionStorage.setItem('bedrock-admin', k);
      setError('');
    } catch (e) {
      setError(e.status === 401 ? 'That key isn’t right, or ADMIN_KEY isn’t set in Cloudflare.' : e.message);
    }
  };
  const review = async (k, keep) => {
    await call('/admin/review', { method: 'POST', key, body: { key: k, keep } });
    load();
  };
  if (!list)
    return (
      <form
        className="max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Review reported listings</h1>
        <div>
          <label htmlFor="adm-key" className={label}>
            Admin key
          </label>
          <input id="adm-key" type="password" className={field} value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary">
          Open
        </Button>
      </form>
    );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Reported listings</h1>
      {list.length === 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing to review.</p>}
      <ul className="space-y-3">
        {list.map((h) => (
          <li key={h.key} className="panel space-y-2 p-4 text-sm">
            <p className="font-semibold text-zinc-950 dark:text-white">
              <a className="underline" href={`/listing/#w=${h.ws}&l=${h.id}`} target="_blank" rel="noreferrer">
                {h.title}
              </a>{' '}
              · {h.reports} reports {h.hidden ? '· hidden' : ''}
            </p>
            <ul className="text-zinc-600 dark:text-zinc-400">
              {h.reasons.map((r, i) => (
                <li key={i}>
                  {r.reason}
                  {r.note ? `: ${r.note}` : ''}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button onClick={() => review(h.key, true)}>Keep it up</Button>
              <Button variant="primary" onClick={() => review(h.key, false)}>
                Take it down
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
