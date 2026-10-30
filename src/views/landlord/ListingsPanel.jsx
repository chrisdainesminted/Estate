import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { links } from '../../lib/landlordApi.js';
import { money } from '../../lib/format.js';
import { CopyButton, Empty, Input, Pill, Select, TextArea, editable } from './shared.jsx';

const BLANK = { title: '', unitId: '', area: '', address: '', rent: undefined, beds: undefined, baths: undefined, available: '', utilities: '', parking: '', details: '', active: true };

/** Your rentals' public pages: what applicants see, and the link to share. */
export default function ListingsPanel({ data, api, ws }) {
  const [editing, setEditing] = useState(null); // a listing, or BLANK for a new one
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader
          title="Listings"
          subtitle="Each gets a page where people apply and book a viewing."
          actions={
            <Button onClick={() => setEditing(BLANK)}>
              <Plus className="size-4" aria-hidden /> New listing
            </Button>
          }
        />
        {data.listings.length === 0 ? (
          <Empty>No listings yet. Add one to get its application link.</Empty>
        ) : (
          <ul className="divide-y divide-hairline">
            {data.listings.map((l) => {
              const apps = data.applications.filter((a) => a.listingId === l.id && a.status !== 'withdrawn' && a.status !== 'declined').length;
              const open = data.slots.filter((s) => s.listingId === l.id && s.status === 'open' && Date.parse(s.start) > Date.now()).length;
              return (
                <li key={l.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setEditing(l)} className="min-w-0 text-left">
                      <span className="block truncate font-semibold text-zinc-950 hover:underline dark:text-white">{l.title || 'Untitled listing'}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[l.rent ? `${money(l.rent)}/mo` : null, `${apps} applicant${apps === 1 ? '' : 's'}`, `${open} open time${open === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    {l.active === false ? <Pill>Off</Pill> : <Pill tone="green">Taking applications</Pill>}
                  </div>
                  {l.active !== false && (
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={links.apply(ws.id, l.id)} label="Copy application link" />
                      <a
                        href={links.apply(ws.id, l.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-well dark:text-zinc-300"
                      >
                        <ExternalLink className="size-4" aria-hidden /> See the page
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-hairline px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          Post the link in your Kijiji, Facebook Marketplace or Rentals.ca ad: “Apply and book a viewing here.”
        </p>
      </Card>
      {editing ? <ListingForm key={editing.id || 'new'} listing={editing} data={data} api={api} onDone={() => setEditing(null)} /> : <Card className="p-5 text-sm text-zinc-500 dark:text-zinc-400">Pick a listing to edit it, or add a new one.</Card>}
    </div>
  );
}

function ListingForm({ listing, data, api, onDone }) {
  const [f, setF] = useState({ ...BLANK, ...listing });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const fromUnit = (id) => {
    const u = data.units.find((x) => x.id === id);
    setF((x) => ({ ...x, unitId: id, ...(u && !x.title ? { title: u.label } : {}), ...(u && !x.address ? { address: u.address } : {}), ...(u && !x.rent ? { rent: u.rent } : {}) }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.title) return setError('Give it a title, like “Bright 2-bedroom upper near the lake”.');
    try {
      await api.save('listings', listing.id || null, editable(f));
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Card>
      <CardHeader title={listing.id ? 'Edit listing' : 'New listing'} subtitle="Everything but the address shows on its public page." />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Input id="li-title" label="Title" value={f.title} onChange={set('title')} className="sm:col-span-2" maxLength={120} />
        {data.units.length > 0 && (
          <Select id="li-unit" label="Unit (optional)" value={f.unitId} onChange={fromUnit} className="sm:col-span-2">
            <option value="">Not linked to a unit</option>
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        )}
        <Input id="li-rent" label="Rent a month" type="number" min="0" value={f.rent} onChange={set('rent')} />
        <Input id="li-avail" label="Available" type="date" value={f.available} onChange={set('available')} />
        <Input id="li-beds" label="Bedrooms" type="number" min="0" value={f.beds} onChange={set('beds')} />
        <Input id="li-baths" label="Bathrooms" type="number" min="0" step="0.5" value={f.baths} onChange={set('baths')} />
        <Input id="li-area" label="Area, shown publicly" value={f.area} onChange={set('area')} hint="A neighbourhood or nearby streets" />
        <Input id="li-address" label="Full address, kept private" value={f.address} onChange={set('address')} hint="Shown only once you confirm a viewing" />
        <Input id="li-util" label="Utilities" value={f.utilities} onChange={set('utilities')} hint="e.g. Heat and water included; hydro extra" className="sm:col-span-2" />
        <Input id="li-park" label="Parking" value={f.parking} onChange={set('parking')} className="sm:col-span-2" />
        <TextArea id="li-details" label="Description" value={f.details} onChange={set('details')} rows={6} className="sm:col-span-2" />
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-300">
          <input type="checkbox" checked={f.active !== false} onChange={(e) => set('active')(e.target.checked)} className="size-4 accent-emerald-600" />
          Taking applications
        </label>
        <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">
          Describe the place, not the tenant you want: ads can’t say “no kids”, “professionals only” or anything else that turns people away for who they are.
        </p>
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
            <Button onClick={onDone}>Cancel</Button>
          </div>
          {listing.id && (
            <Button variant="ghost" onClick={() => confirm('Delete this listing and its open viewing times?') && api.remove('listings', listing.id).then(onDone)}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
