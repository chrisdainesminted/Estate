import { useMemo, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { Button, Card, CardHeader, ViewHeader } from '../components/ui.jsx';
import BrokerForm from '../components/BrokerForm.jsx';
import { ReadyChecklist } from './HomeExtras.jsx';
import { benefits } from '../lib/firstHome.js';
import { myPlan } from '../lib/journey.js';
import { sitePage } from '../lib/site.js';

/**
 * Get ready: every step from checking your credit to moving day, each
 * explained and ticked off as you go, with a mortgage broker one click away.
 */
export default function GetReady({ profile, ready = {}, market, onReady, onView, nextStep }) {
  const ratePct = Number(market.rate);
  const plan = useMemo(() => myPlan({ profile, ratePct }), [profile, ratePct]);
  const p = plan.profile;
  const b = useMemo(() => benefits({ profile: p, price: p.targetPrice, units: p.targetUnits }), [p]);
  const broker = useRef(null);
  // The broker form waits behind one button, so the page leads with the steps.
  const [brokerOpen, setBrokerOpen] = useState(false);
  const toBroker = () => {
    setBrokerOpen(true);
    broker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => broker.current?.querySelector('input, select, textarea')?.focus({ preventScroll: true }), 50);
  };
  return (
    <div className="space-y-6">
      <ViewHeader title="Get ready">Every step to moving day, one at a time. Tick each off as you go.</ViewHeader>
      {nextStep}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 xl:col-span-8">
          <ReadyChecklist p={p} ready={ready} onReady={onReady} ratePct={ratePct} taxPct={plan.local.taxPct} rentEach={plan.local.rent} benefitsTotal={b.total} onBroker={toBroker} onView={onView} />
        </Card>
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <div ref={broker} id="home-broker" className="scroll-mt-24">
            <Card>
              <CardHeader title="Talk to a mortgage broker" subtitle="Free to you: the lender pays them." />
              {brokerOpen ? (
                <BrokerForm p={p} maxPrice={plan.best.price} />
              ) : (
                <div className="space-y-3 p-5">
                  <Button variant="primary" className="w-full" onClick={() => setBrokerOpen(true)}>
                    <Phone className="size-4" aria-hidden /> Have a broker call me
                  </Button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Rather do it yourself? Read{' '}
                    <a href={sitePage('/lenders/')} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                      how to find a lender
                    </a>
                    .
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
