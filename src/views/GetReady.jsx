import { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, UserRound } from 'lucide-react';
import { Button, Card, CardHeader, ViewHeader } from '../components/ui.jsx';
import BrokerForm from '../components/BrokerForm.jsx';
import { ReadyChecklist } from './HomeExtras.jsx';
import PreApproval from './PreApproval.jsx';
import { summaryText } from '../lib/preapproval.js';
import { takeAgentAsk } from '../lib/asks.js';
import { benefits } from '../lib/firstHome.js';
import { myPlan } from '../lib/journey.js';
import { sitePage } from '../lib/site.js';

/**
 * Get ready: every step from checking your credit to moving day, each
 * explained and ticked off as you go, with a mortgage broker one click away.
 */
const ASK = 'squarely-broker-ask';

/** Ask Get ready to open its broker form when it next opens (from a button on another view). */
export function askBroker() {
  try {
    sessionStorage.setItem(ASK, '1');
  } catch {
    // Without storage the page still opens; the form is one tap away.
  }
}

function takeBrokerAsk() {
  try {
    const asked = sessionStorage.getItem(ASK) === '1';
    sessionStorage.removeItem(ASK);
    return asked;
  } catch {
    return false;
  }
}

export default function GetReady({ profile, ready = {}, market, onReady, onView }) {
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
  // The pre-approval summary, sent along with the broker request.
  const [brokerNote, setBrokerNote] = useState('');
  const sendPacket = (rows, docs) => {
    const have = docs.flatMap((g) => g.items).length;
    setBrokerNote(`${summaryText(rows)}\n(Pre-approval summary from Squarely; I have a list of ${have} documents to gather.)`);
    toBroker();
  };
  const agentRef = useRef(null);
  const [agent, setAgent] = useState({ open: false, home: null });
  const toAgent = (home = null) => {
    setAgent({ open: true, home });
    setTimeout(() => {
      agentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      agentRef.current?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
    }, 60);
  };
  // Arriving from "Have a broker call me" or "Talk to an agent" elsewhere in the app: that form, open and in view.
  useEffect(() => {
    if (takeBrokerAsk()) setTimeout(toBroker, 100);
    const ask = takeAgentAsk();
    if (ask) setTimeout(() => toAgent(ask.home), 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-6">
      <ViewHeader title="Get ready">Every step to your keys. Tick each one off as you go.</ViewHeader>
      {/* The checklist below already marks the next step, so the "next step" card isn't repeated here. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 xl:col-span-8">
          <ReadyChecklist p={p} ready={ready} onReady={onReady} ratePct={ratePct} taxPct={plan.local.taxPct} rentEach={plan.local.rent} benefitsTotal={b.total} onBroker={toBroker} onAgent={() => toAgent()} onView={onView} />
        </Card>
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <div ref={broker} id="home-broker" className="scroll-mt-24">
            <Card>
              <CardHeader title="Talk to a mortgage broker" subtitle="Free to you: the lender pays them." />
              {brokerOpen ? (
                <BrokerForm key={brokerNote} p={p} maxPrice={plan.best.price} note={brokerNote} />
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
          <div ref={agentRef} id="home-agent" className="scroll-mt-24">
            <Card>
              <CardHeader title="Talk to a real estate agent" subtitle="For showings, sold prices nearby, and writing your offer." />
              {agent.open ? (
                <BrokerForm key={agent.home?.address ?? 'agent'} kind="agent" home={agent.home} p={p} maxPrice={plan.best.price} />
              ) : (
                <div className="space-y-3 p-5">
                  <Button variant="primary" className="w-full" onClick={() => toAgent()}>
                    <UserRound className="size-4" aria-hidden /> Find me an agent
                  </Button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">In most of Canada the seller pays the buyer’s agent, so it usually costs you nothing.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
        <div className="lg:col-span-7 xl:col-span-8">
          <PreApproval p={p} plan={plan} onSend={sendPacket} />
        </div>
      </div>
    </div>
  );
}
