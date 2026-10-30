import { useState } from 'react';
import { money } from '../lib/format.js';
import { cityByKey, rentsIn } from '../lib/canada.js';
import { Segmented } from './ui.jsx';

const SIZES = [
  { value: '0', label: 'Studio', words: 'a studio' },
  { value: '1', label: '1', words: '1 bedroom' },
  { value: '2', label: '2', words: '2 bedrooms' },
  { value: '3', label: '3', words: '3 bedrooms' },
  { value: '4', label: '4+', words: '4 or more bedrooms' },
];

/**
 * "Don't know the rent?": pick the bedrooms in each unit and get the going
 * rent in the deal's city: the listing assumptions' rent table, moved there
 * by the two cities' average rents.
 */
export default function RentHelper({ rents: table, city = 'thunder-bay', onPick }) {
  const [open, setOpen] = useState(false);
  const rents = rentsIn(table, city);
  const place = cityByKey(city).name.replace(/^Elsewhere in /, '');
  const [beds, setBeds] = useState(null);
  const size = SIZES.find((s) => s.value === beds);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded text-xs font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-400"
      >
        Don’t know the rent?
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-well p-3">
      <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Bedrooms in each unit</span>
      <Segmented
        size="sm"
        label="Bedrooms in each unit"
        value={beds}
        onChange={(v) => {
          setBeds(v);
          onPick(Number(rents[v]) || 0);
        }}
        options={SIZES}
      />
      <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        {size
          ? `Typical ${place} rent for ${size.words}: ${money(Number(rents[beds]) || 0)}/mo. Change it if you know better.`
          : `Fills in the typical ${place} rent for that size.`}
      </p>
    </div>
  );
}
