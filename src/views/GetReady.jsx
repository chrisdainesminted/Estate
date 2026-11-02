import { useMemo, useRef } from 'react';
import { Card, CardHeader, ViewHeader } from '../components/ui.jsx';
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
  const toBroker = () => {
    broker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    broker.current?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
  };
  return (
    <div className="space-y-6">
      <ViewHeader title="Get ready">Every step from your credit report to moving day, in order. Tick each one off as you go: it’s saved with your plan.</ViewHeader>
      {nextStep}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 xl:col-span-8">
          <CardHeader title="Buying your first home, step by step" subtitle="What each step is, what it costs, and who does it." />
          <ReadyChecklist p={p} ready={ready} onReady={onReady} ratePct={ratePct} taxPct={plan.local.taxPct} rentEach={plan.local.rent} benefitsTotal={b.total} onBroker={toBroker} onView={onView} />
        </Card>
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <div ref={broker} id="home-broker" className="scroll-mt-24">
            <Card>
              <CardHeader title="Talk to a mortgage broker" subtitle="Free to you: they’re paid by the lender. One will call to start a pre-approval." />
              <BrokerForm p={p} maxPrice={plan.best.price} />
            </Card>
          </div>
          <Card>
            <CardHeader title="Rather do it yourself?" />
            <p className="px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400">
              Our guide to{' '}
              <a href={sitePage('/lenders/')} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                finding a lender
              </a>{' '}
              covers banks, credit unions and brokers, what to bring, and the questions to ask.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
