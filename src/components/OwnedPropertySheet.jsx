import { useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import CitySelect from './CitySelect.jsx';
import { Button, FieldLabel, LedgerLine, NumberField } from './ui.jsx';
import { EMPTY_OWNED, ownedDeal } from '../lib/ownedHome.js';
import { estimateToday } from '../lib/finance.js';
import { cityInAddress } from '../lib/place.js';
import { money, percent } from '../lib/format.js';

const TYPES = [
  { value: 1, label: 'House' },
  { value: 2, label: 'Duplex' },
  { value: 3, label: 'Triplex' },
  { value: 4, label: 'Fourplex' },
  { value: 5, label: '5+ units' },
];
const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Add a property you already own from what you know about it. The down
 * payment %, the interest rate (from your payment), what you owe today and
 * how its value has grown are worked out and shown as you type.
 */
export default function OwnedPropertySheet({ open, onClose, onSave, market, homeCity }) {
  const [f, setF] = useState({ ...EMPTY_OWNED, city: homeCity });
  const [cityTouched, setCityTouched] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => (setF((x) => ({ ...x, [k]: v })), setError(''));
  const r = useMemo(() => ownedDeal(f, market), [f, market]);
  const now = useMemo(() => (r ? estimateToday(r.deal) : null), [r]);
  const bigBuilding = f.units >= 5;

  const save = (another) => {
    if (!String(f.address).trim()) return setError('Add the address.');
    if (!r) return setError('Add what you paid for it.');
    if (!(Number(f.rent) >= 0) || f.rent == null) return setError('Add the rent you collect each month (0 if you live in it).');
    onSave(r.deal);
    if (another) {
      setF({ ...EMPTY_OWNED, city: f.city });
      setCityTouched(false);
    } else onClose();
  };

  const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
  const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
  const note = { payment: 'worked out from your payment', you: 'as you entered it', today: 'today’s typical rate; add your payment to use yours' };

  return (
    <Sheet open={open} onClose={onClose} title="Add a property you own" desktop>
      <form
        className="space-y-6 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <section className="space-y-4">
          <div>
            <label htmlFor="own-address" className={label}>
              Address
            </label>
            <input
              id="own-address"
              className={field}
              autoComplete="street-address"
              placeholder="230 Brodie Street N, Thunder Bay"
              value={f.address}
              onChange={(e) => {
                const address = e.target.value;
                const found = cityInAddress(address);
                setF((x) => ({ ...x, address, ...(found && !cityTouched ? { city: found } : {}) }));
                setError('');
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CitySelect id="own-city" label="City" value={f.city} onChange={(c) => (setCityTouched(true), set('city')(c))} />
            <div>
              <span className={label}>Type</span>
              <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={t.value === 5 ? bigBuilding : f.units === t.value}
                    onClick={() => set('units')(t.value === 5 ? Math.max(f.units, 5) : t.value)}
                    className={`h-9 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset transition ${
                      (t.value === 5 ? bigBuilding : f.units === t.value) ? 'bg-emerald-600 text-white ring-emerald-600 dark:bg-[#73ff6a] dark:text-black dark:ring-[#73ff6a]' : 'text-zinc-700 ring-(--line-strong) hover:bg-well dark:text-zinc-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {bigBuilding && <NumberField id="own-units" label="Units in the building" value={f.units} onChange={(v) => set('units')(Math.max(Math.round(v), 5))} min={5} max={200} decimals={0} />}
        </section>

        <section className="space-y-4 border-t border-hairline pt-5">
          <h3 className="font-semibold text-zinc-950 dark:text-white">The purchase</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="own-price" label="Bought for" prefix="$" step={5000} decimals={0} value={f.price} onChange={set('price')} />
            <div>
              <FieldLabel htmlFor="own-bought">Bought in</FieldLabel>
              <input id="own-bought" type="month" max={thisMonth()} className={field} value={f.bought} onChange={(e) => set('bought')(e.target.value)} />
            </div>
            <NumberField id="own-down" label="Down payment" prefix="$" step={5000} decimals={0} value={f.down} onChange={set('down')} hint={r ? `${percent(r.downPct / 100, 1)} of the price` : 'Blank uses 20%'} />
            <NumberField id="own-worth" label="Worth today (optional)" prefix="$" step={5000} decimals={0} value={f.worth} onChange={set('worth')} hint="Your best guess. Blank grows it 3% a year" />
          </div>
        </section>

        <section className="space-y-4 border-t border-hairline pt-5">
          <h3 className="font-semibold text-zinc-950 dark:text-white">The mortgage</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="own-payment" label="Payment" prefix="$" suffix="/mo" step={50} decimals={0} value={f.payment} onChange={set('payment')} hint="Principal and interest" />
            <NumberField id="own-rate" label="Rate, if you know it" suffix="%" step={0.05} decimals={2} max={30} value={f.rate} onChange={set('rate')} />
            <NumberField id="own-amort" label="Amortization" suffix="yrs" step={1} decimals={0} min={1} max={40} value={f.amortYears} onChange={set('amortYears')} hint="Usually 25 or 30" />
          </div>
          <label className="flex items-start gap-2.5 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={f.dscrLoan} onChange={(e) => set('dscrLoan')(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
            <span>
              I got this mortgage from a rental (DSCR) lender
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">Then Portfolio also shows the lender’s rent check (DSCR) for it.</span>
            </span>
          </label>
        </section>

        <section className="space-y-4 border-t border-hairline pt-5">
          <h3 className="font-semibold text-zinc-950 dark:text-white">Rent and costs</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="own-rent" label="Rent collected" prefix="$" suffix="/mo" step={50} decimals={0} value={f.rent} onChange={set('rent')} hint="All units together; 0 if you live in it" />
            <NumberField id="own-taxes" label="Property tax (optional)" prefix="$" suffix="/yr" step={100} decimals={0} value={f.taxes} onChange={set('taxes')} hint="Blank uses the city’s typical rate" />
          </div>
        </section>

        {r && now && (
          <section aria-label="Worked out for you" className="rounded-xl bg-well p-4">
            <h3 className="mb-2 font-semibold text-zinc-950 dark:text-white">Worked out for you</h3>
            <LedgerLine label="Down payment" value={`${money(r.deal.price * (r.downPct / 100))} (${percent(r.downPct / 100, 1)})`} />
            <LedgerLine label={`Interest rate, ${note[r.rateFrom]}`} value={`${r.rate.toFixed(2)}%`} />
            <LedgerLine label={`Value growth, ${r.growthFrom === 'worth' ? 'from what it’s worth now' : 'typical'}`} value={`${r.appreciationPct}%/yr`} />
            <LedgerLine label={r.years > 0 ? `Worth today, after ${r.years < 1 ? `${Math.round(r.years * 12)} months` : `${Math.round(r.years * 10) / 10} years`}` : 'Worth today'} value={money(now.value)} />
            <LedgerLine label="Owed today" value={money(now.balance)} />
            <LedgerLine label="Your equity" value={money(now.equity)} sum />
            <LedgerLine
              label={`Cash flow a month, after the mortgage, ${r.taxesFrom === 'you' ? 'tax' : 'typical tax'}, insurance and upkeep`}
              value={`${money(now.netCashFlow, { signed: true })}`}
              valueClass={now.netCashFlow >= 0 ? 'text-emerald-700 dark:text-[#73ff6a]' : 'text-red-700 dark:text-[#ff8a80]'}
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Change any of it later from the property’s Edit button in Portfolio.</p>
          </section>
        )}

        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          <Button onClick={() => save(true)}>Save and add another</Button>
          <Button type="submit" variant="primary">
            Add to my portfolio
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
