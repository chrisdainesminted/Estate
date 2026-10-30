import { useRef, useState } from 'react';
import { ExternalLink, ImagePlus, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import CitySelect from '../../components/CitySelect.jsx';
import { links } from '../../lib/landlordApi.js';
import { money } from '../../lib/format.js';
import { PROPERTY_TYPES } from '../../../worker/schema.js';
import { CopyButton, Empty, Input, Pill, Select, TextArea, editable } from './shared.jsx';

const KEEP_DAYS = 60;
const BLANK = {
  kind: 'rent',
  title: '',
  unitId: '',
  city: '',
  propertyType: 'apartment',
  area: '',
  address: '',
  rent: undefined,
  price: undefined,
  beds: undefined,
  baths: undefined,
  sqft: undefined,
  lot: '',
  taxes: undefined,
  yearBuilt: undefined,
  available: '',
  utilities: '',
  parking: '',
  details: '',
  active: true,
  public: true,
};

/** Days until a public listing drops out of search unless it's renewed. */
const daysLeft = (l) => KEEP_DAYS - Math.floor((Date.now() - (l.renewedAt || l.updated)) / 86400000);

/** Your homes for rent or sale: their public pages, photos, and whether they show in Bedrock's search. */
export default function ListingsPanel({ data, api, ws, homeCity, config, settings, go }) {
  const [editingId, setEditingId] = useState(null); // a listing id, 'new', or null
  const editing = editingId === 'new' ? BLANK : data.listings.find((l) => l.id === editingId);
  const needsEmail = config.verification && !settings.emailVerified;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader
          title="Your listings"
          subtitle="For rent or for sale. Each gets a page where people apply or ask to see it."
          actions={
            <Button onClick={() => setEditingId('new')}>
              <Plus className="size-4" aria-hidden /> New listing
            </Button>
          }
        />
        {needsEmail && (
          <p className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-amber-50 px-5 py-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            Confirm your email to show listings in Bedrock’s public search.
            <Button onClick={() => go('settings')}>Confirm it</Button>
          </p>
        )}
        {data.listings.length === 0 ? (
          <Empty>No listings yet. Add one to get its page and link.</Empty>
        ) : (
          <ul className="divide-y divide-hairline">
            {data.listings.map((l) => {
              const people = data.applications.filter((a) => a.listingId === l.id && a.status !== 'withdrawn' && a.status !== 'declined').length;
              const left = daysLeft(l);
              const shown = l.public && l.active !== false && !needsEmail && left > 0;
              return (
                <li key={l.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-start gap-3">
                    {l.photoIds?.[0] ? (
                      <img src={`/api/w/${ws.id}/photos/${l.photoIds[0]}`} alt="" className="size-14 shrink-0 rounded object-cover" />
                    ) : (
                      <div aria-hidden className="size-14 shrink-0 rounded bg-well" />
                    )}
                    <button type="button" onClick={() => setEditingId(l.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold text-zinc-950 hover:underline dark:text-white">{l.title || 'Untitled listing'}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[l.kind === 'sale' ? (l.price ? money(l.price) : 'For sale') : l.rent ? `${money(l.rent)}/mo` : 'For rent', `${people} ${l.kind === 'sale' ? 'interested' : people === 1 ? 'applicant' : 'applicants'}`].join(' · ')}
                      </span>
                    </button>
                    {l.active === false ? <Pill>Off</Pill> : shown ? <Pill tone="green">In public search</Pill> : <Pill tone="amber">Link only</Pill>}
                  </div>
                  {l.active !== false && (
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton text={links.apply(ws.id, l.id)} label="Copy link" />
                      <a href={links.apply(ws.id, l.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-well dark:text-zinc-300">
                        <ExternalLink className="size-4" aria-hidden /> See the page
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      {l.public && !needsEmail && (
                        <Button variant="ghost" onClick={() => api.renew(l.id)} title="Keeps it in public search for another 60 days">
                          <RefreshCw className="size-4" aria-hidden /> {left > 0 ? `Renew (${left} days left)` : 'Renew to show it again'}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-hairline px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          Listings in public search show on{' '}
          <a href="/homes/" className="underline">
            Bedrock’s homes page
          </a>{' '}
          for 60 days at a time. You can also post the link in a Kijiji, Facebook Marketplace or Rentals.ca ad.
        </p>
      </Card>
      {editing ? (
        <ListingForm key={editingId} listing={editing} data={data} api={api} ws={ws} homeCity={homeCity} onSaved={(id) => setEditingId(id)} onDone={() => setEditingId(null)} />
      ) : (
        <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Pick a listing to edit it, or add a new one.</Card>
      )}
    </div>
  );
}

function ListingForm({ listing, data, api, ws, homeCity, onSaved, onDone }) {
  const [f, setF] = useState({ ...BLANK, city: homeCity, ...listing });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (k) => (v) => (setF((x) => ({ ...x, [k]: v })), setSaved(false));
  const sale = f.kind === 'sale';
  const fromUnit = (id) => {
    const u = data.units.find((x) => x.id === id);
    setF((x) => ({ ...x, unitId: id, ...(u && !x.title ? { title: u.label } : {}), ...(u && !x.address ? { address: u.address } : {}), ...(u && !x.rent ? { rent: u.rent } : {}) }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.title) return setError(sale ? 'Give it a title, like “Brick bungalow with a big yard”.' : 'Give it a title, like “Bright 2-bedroom upper near the lake”.');
    try {
      const item = await api.save('listings', listing.id || null, editable(f, ['photoIds', 'renewedAt']));
      setError('');
      setSaved(true);
      if (!listing.id) onSaved(item.id);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={listing.id ? 'Edit listing' : 'New listing'} subtitle={sale ? 'Everything here shows on its public page.' : 'Everything but the full address shows on its public page.'} />
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">It’s</span>
            <div role="radiogroup" aria-label="Rent or sell" className="inline-flex overflow-hidden rounded-md border border-(--line-strong)">
              {[
                ['rent', 'For rent'],
                ['sale', 'For sale'],
              ].map(([k, l], i) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={f.kind === k}
                  onClick={() => (set('kind')(k), k === 'sale' && f.propertyType === 'apartment' && set('propertyType')('house'))}
                  className={`px-4 py-1.5 text-sm ${i ? 'border-l border-(--line-strong)' : ''} ${f.kind === k ? 'bg-zinc-950/[0.05] font-semibold shadow-[inset_0_-2px_0_var(--accent)] dark:bg-white/[0.07]' : 'font-medium text-zinc-600 dark:text-zinc-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Input id="li-title" label="Title" value={f.title} onChange={set('title')} className="sm:col-span-2" maxLength={120} />
          <div className="sm:col-span-2">
            <CitySelect id="li-city" label="City" value={f.city || homeCity} onChange={set('city')} />
          </div>
          <Select id="li-type" label="Type" value={f.propertyType} onChange={set('propertyType')}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          {sale ? (
            <Input id="li-price" label="Asking price" type="number" min="0" step="1000" value={f.price} onChange={set('price')} />
          ) : (
            <Input id="li-rent" label="Rent a month" type="number" min="0" value={f.rent} onChange={set('rent')} />
          )}
          <Input id="li-beds" label="Bedrooms" type="number" min="0" value={f.beds} onChange={set('beds')} />
          <Input id="li-baths" label="Bathrooms" type="number" min="0" step="0.5" value={f.baths} onChange={set('baths')} />
          <Input id="li-sqft" label="Size (sq ft, optional)" type="number" min="0" value={f.sqft} onChange={set('sqft')} />
          {sale ? (
            <Input id="li-year" label="Year built (optional)" type="number" min="1800" max="2100" value={f.yearBuilt} onChange={set('yearBuilt')} />
          ) : (
            <Input id="li-avail" label="Available" type="date" value={f.available} onChange={set('available')} />
          )}
          <Input id="li-area" label="Neighbourhood or nearby streets" value={f.area} onChange={set('area')} />
          <Input id="li-address" label={sale ? 'Address (shown publicly)' : 'Full address (private until a viewing is confirmed)'} value={f.address} onChange={set('address')} />
          {sale && (
            <>
              <Input id="li-tax" label="Property tax a year" type="number" min="0" value={f.taxes} onChange={set('taxes')} />
              <Input id="li-lot" label="Lot size (optional)" value={f.lot} onChange={set('lot')} hint="e.g. 40 × 120 ft" />
            </>
          )}
          {!sale && <Input id="li-util" label="Utilities" value={f.utilities} onChange={set('utilities')} hint="e.g. Heat and water included; hydro extra" className="sm:col-span-2" />}
          <Input id="li-park" label="Parking" value={f.parking} onChange={set('parking')} className="sm:col-span-2" />
          {!sale && data.units.length > 0 && (
            <Select id="li-unit" label="Unit (optional)" value={f.unitId} onChange={fromUnit} className="sm:col-span-2">
              <option value="">Not linked to a unit</option>
              {data.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
          <TextArea id="li-details" label="Description" value={f.details} onChange={set('details')} rows={6} className="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-300">
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set('active')(e.target.checked)} className="size-4 accent-emerald-600" />
            {sale ? 'Taking requests to see it' : 'Taking applications'}
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-300">
            <input type="checkbox" checked={f.public !== false} onChange={(e) => set('public')(e.target.checked)} className="size-4 accent-emerald-600" />
            Show it in Bedrock’s public search (otherwise only people with the link see it)
          </label>
          <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">
            {sale
              ? 'Describe the home honestly; private sellers must disclose defects they know of. Bedrock isn’t a brokerage: buyers should use a real estate lawyer, and you may want one too.'
              : 'Describe the place, not the tenant you want: ads can’t say “no kids”, “professionals only” or anything else that turns people away for who they are.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary">
                Save
              </Button>
              <Button onClick={onDone}>Close</Button>
              {saved && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved</span>}
            </div>
            {listing.id && (
              <Button variant="ghost" onClick={() => confirm('Delete this listing, its photos and its open viewing times?') && api.remove('listings', listing.id).then(onDone)}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            )}
          </div>
        </form>
      </Card>
      {listing.id ? <Photos listing={listing} api={api} ws={ws} /> : <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Save the listing, then add photos.</Card>}
    </div>
  );
}

function Photos({ listing, api, ws }) {
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ids = listing.photoIds ?? [];
  const upload = async (files) => {
    setError('');
    const list = [...files].slice(0, 10 - ids.length);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      try {
        await api.uploadPhoto(listing.id, list[i]);
      } catch (e) {
        setError(e.message);
        break;
      }
    }
    setBusy('');
  };
  return (
    <Card>
      <CardHeader title="Photos" subtitle={`${ids.length} of 10. The first one is the cover in search.`} />
      <div className="space-y-4 p-5">
        {ids.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {ids.map((id, i) => (
              <li key={id} className="relative">
                <img src={`/api/w/${ws.id}/photos/${id}`} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                <div className="absolute right-1 bottom-1 flex gap-1">
                  {i > 0 && (
                    <button type="button" aria-label={`Make photo ${i + 1} the cover`} onClick={() => api.coverPhoto(listing.id, id)} className="rounded bg-black/70 p-1.5 text-white hover:bg-black">
                      <Star className="size-3.5" aria-hidden />
                    </button>
                  )}
                  <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => api.removePhoto(listing.id, id)} className="rounded bg-black/70 p-1.5 text-white hover:bg-black">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                {i === 0 && <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold text-white">Cover</span>}
              </li>
            ))}
          </ul>
        )}
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" id={`ph-${listing.id}`} aria-label="Add photos" tabIndex={-1} onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
        <Button onClick={() => input.current?.click()} disabled={Boolean(busy) || ids.length >= 10}>
          <ImagePlus className="size-4" aria-hidden /> {busy || 'Add photos'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Phone photos are made smaller before they upload. Leave people and personal papers out of the shots.</p>
      </div>
    </Card>
  );
}
