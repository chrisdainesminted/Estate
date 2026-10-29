import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { UNIT_TYPES } from '../lib/presets.js';
import { Button, NumberField, Segmented, SelectField } from './ui.jsx';

/** Price, type and rent: the least it takes to see whether a rental would make money. */
export default function QuickCheck({ idPrefix, country = 'us', onCheck }) {
  const [price, setPrice] = useState(300000);
  const [unitType, setUnitType] = useState('sfh');
  const [units, setUnits] = useState(6);
  const [rent, setRent] = useState(2000);
  const [where, setWhere] = useState(country === 'ca' ? 'ca' : 'us');
  const id = (k) => `${idPrefix}-${k}`;
  const single = unitType === 'sfh';

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onCheck({ price, rentPerUnit: rent, unitType, units, country: where });
      }}
    >
      <NumberField id={id('price')} label="Price" prefix="$" value={price} onChange={setPrice} step={5000} decimals={0} />
      <SelectField id={id('type')} label="Type of property" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
        {UNIT_TYPES.map((u) => (
          <option key={u.key} value={u.key}>
            {u.key === 'multiplex' ? 'Building with 5+ units' : u.units > 1 ? `${u.label} · ${u.units} units` : 'House (one unit)'}
          </option>
        ))}
      </SelectField>
      {unitType === 'multiplex' && <NumberField id={id('units')} label="How many units" value={units} onChange={(v) => setUnits(Math.round(v))} min={5} max={500} decimals={0} />}
      <NumberField id={id('rent')} label={single ? 'Monthly rent' : 'Monthly rent for each unit'} prefix="$" suffix="/mo" value={rent} onChange={setRent} step={25} decimals={0} />
      <div>
        <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Where is it?</span>
        <Segmented
          size="sm"
          label="Where is it?"
          value={where}
          onChange={setWhere}
          options={[
            { value: 'us', label: 'US' },
            { value: 'ca', label: 'Canada (Ontario)' },
          ]}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary">
          See if it makes money <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
