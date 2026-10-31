import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button, Card, CardHeader, LedgerLine } from '../../components/ui.jsx';
import { PLAN, managerWouldCharge, monthlyBill } from '../../../worker/pricing.js';
import { money } from '../../lib/format.js';
import { Empty, Pill } from './shared.jsx';

const monthName = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
const STATUS = { paid: ['Paid', 'green'], processing: ['Processing', 'zinc'], failed: ['Didn’t go through', 'red'], free: ['Nothing to pay', 'zinc'] };

/** What the rent tracker costs: 2% of each tenanted unit's rent, capped, one unit free. */
export default function BillingPanel({ data, api, config }) {
  const bill = monthlyBill(data.units);
  const manager = managerWouldCharge(data.units);
  const card = data.billing?.card;
  const invoices = data.billing?.invoices ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addCard = async () => {
    setBusy(true);
    setError('');
    try {
      const { url } = await api.billingSetup();
      location.assign(url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Your monthly price" subtitle={`${Math.round(PLAN.rate * 100)}% of each tenanted unit’s rent, at most ${money(PLAN.capPerUnit)} a unit. Your first unit is free.`} />
        <div className="p-5 text-sm">
          {bill.lines.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">Add your units in Tenants & rent to see your price.</p>
          ) : (
            <>
              {bill.lines.map((l) => (
                <LedgerLine
                  key={l.unitId}
                  label={`${l.label}${l.tenanted ? `, ${money(l.rent)} rent` : ', vacant'}`}
                  value={!l.tenanted ? 'Free' : l.free ? 'Free (your free unit)' : money(l.fee)}
                  muted={!l.tenanted || l.free}
                />
              ))}
              <LedgerLine label="Each month" value={money(bill.total)} valueClass="text-lg" total />
              {bill.tenanted > 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">A property manager at 8% would charge about {money(manager)} a month for the same units.</p>}
            </>
          )}
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Vacant units and listings are free, and so is everything for renters and buyers. Bedrock is software you use: you collect rent and run your tenancies yourself. Prices are in Canadian dollars.
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Payment" subtitle={config.billing ? 'Charged on your card once a month, starting next month.' : 'Billing isn’t switched on yet, so the tracker is free for now.'} />
          <div className="space-y-3 p-5 text-sm">
            {card ? (
              <>
                <p className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                  <CreditCard className="size-4" aria-hidden />
                  <span className="capitalize">{card.brand}</span> ending in {card.last4}
                  {card.expMonth ? ` · expires ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={addCard} disabled={busy}>
                    Use a different card
                  </Button>
                  <Button variant="ghost" onClick={() => confirm('Remove your card? You’ll keep your free unit; tracking more needs a card.') && api.billingRemove().catch((e) => setError(e.message))}>
                    Remove card
                  </Button>
                </div>
              </>
            ) : config.billing ? (
              <>
                <p className="text-zinc-700 dark:text-zinc-300">{bill.tenanted > PLAN.freeUnits ? 'Add a card to keep tracking rent for more than one unit.' : 'You only need a card once you track a second tenanted unit.'}</p>
                <Button variant="primary" onClick={addCard} disabled={busy}>
                  <CreditCard className="size-4" aria-hidden /> {busy ? 'Opening Stripe…' : 'Add a card'}
                </Button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  You’ll enter it on Stripe’s secure page; Bedrock never sees your card number. Adding a card means you agree to the{' '}
                  <a href="/terms/#s4" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    fees in our terms
                  </a>
                  .
                </p>
              </>
            ) : null}
            {error && (
              <p role="alert" className="text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Charges" />
          {invoices.length === 0 ? (
            <Empty>No charges yet.</Empty>
          ) : (
            <ul className="divide-y divide-hairline">
              {invoices.map((i) => {
                const [label, tone] = STATUS[i.status] ?? STATUS.processing;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      {monthName(i.month)}
                      {i.status === 'failed' && i.error && <span className="block text-xs text-red-700 dark:text-red-300">{i.error} Update your card to try again.</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{money(i.cents / 100)}</span>
                      <Pill tone={tone}>{label}</Pill>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
