import { money } from '../lib/format.js';
import { NumberField } from './ui.jsx';

/**
 * The numbers people change most, as calculator cells right above the
 * ledgers on phones and tablets (from lg up the inputs panel sits beside
 * them). `ownDown` fixes the down payment, as the Cash tab's 20% does.
 */
export default function CalcInputs({ deal, a, onChange, ownDown }) {
  const id = (k) => `${deal.id}-calc-${k}`;
  const set = (k) => (v) => onChange({ [k]: v });
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:hidden">
      <NumberField id={id('price')} label="Price" prefix="$" value={deal.price} onChange={set('price')} step={5000} decimals={0} />
      <NumberField
        id={id('rent')}
        label={a.units > 1 ? 'Rent per unit' : 'Monthly rent'}
        prefix="$"
        suffix="/mo"
        value={deal.rentPerUnit}
        onChange={set('rentPerUnit')}
        step={25}
        decimals={0}
      />
      {ownDown == null ? (
        <NumberField id={id('down')} label="Down payment" suffix="%" value={deal.downPct} onChange={set('downPct')} max={100} step={1} />
      ) : (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Down payment</span>
          <p className="tabular py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
            {ownDown}%, {money(a.downPayment)}
          </p>
        </div>
      )}
      <NumberField id={id('rate')} label="Interest rate" suffix="%" value={deal.rate} onChange={set('rate')} max={30} step={0.125} decimals={3} />
    </div>
  );
}
