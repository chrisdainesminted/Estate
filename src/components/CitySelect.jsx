import { CITIES, PROVINCES } from '../lib/canada.js';
import { SelectField } from './ui.jsx';

/** Where in Canada: cities grouped by province, each province ending with "Elsewhere in …". */
export default function CitySelect({ id, label = 'Where you’re buying', value, onChange, tip }) {
  return (
    <SelectField id={id} label={label} tip={tip} value={value} onChange={(e) => onChange(e.target.value)}>
      {PROVINCES.map((p) => (
        <optgroup key={p.code} label={p.name}>
          {CITIES.filter((c) => c.province === p.code).map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
