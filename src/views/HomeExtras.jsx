import { useContext, useMemo, useState } from 'react';
import { SectionsContext } from '../components/Section.jsx';
import { Check, ExternalLink } from 'lucide-react';
import { Button, NumberField } from '../components/ui.jsx';
import { buyCheck } from '../lib/firstHome.js';
import { cityByKey, provinceName } from '../lib/canada.js';
import { RENT_VS_BUY_DEFAULTS, rentVsBuy } from '../lib/rentVsBuy.js';
import { money } from '../lib/format.js';

const link = 'inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400';
const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
    {children} <ExternalLink className="size-3" aria-hidden />
  </a>
);

/* ---------- Am I ready? ---------- */

/**
 * The steps between "I want to buy" and closing day. Steps Squarely can see
 * for itself (savings, programs) tick themselves; the rest you tick.
 */
export function ReadyChecklist({ p, ready, onReady, ratePct, taxPct, rentEach, benefitsTotal }) {
  const place = cityByKey(p.city);
  const target = buyCheck({ profile: p, price: p.targetPrice, units: p.targetUnits, ratePct, taxesMonthly: (p.targetPrice * taxPct) / 1200, rentFromOthers: rentEach * (p.targetUnits - 1), city: p.city });
  const saved = p.savings >= target.cashNeeded;
  const quebec = place.province === 'QC';
  const sections = useContext(SectionsContext);
  // The broker section starts folded; open it before jumping there.
  const openBroker = () => sections?.setOpen('home-broker', true);
  const steps = [
    {
      id: 'credit',
      title: 'Check your credit report',
      body: (
        <>
          Lenders want a score around 680 or higher for the best rates. Your report is free from Equifax and TransUnion;{' '}
          <Ext href="https://www.canada.ca/en/financial-consumer-agency/services/credit-reports-score/order-credit-report.html">how to get it</Ext>. Fix any mistakes before you
          apply.
        </>
      ),
    },
    {
      id: 'fhsa',
      title: 'Open a First Home Savings Account',
      body: (
        <>
          Up to $8,000 a year comes off your taxable income and comes out tax-free to buy. Open one now even with a little in it: the room starts the year you open it.{' '}
          <Ext href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html">FHSA rules</Ext>
        </>
      ),
    },
    {
      id: 'save',
      auto: saved,
      title: `Save ${money(target.cashNeeded)} for the down payment and closing`,
      body: saved
        ? `You have ${money(p.savings)}, enough for the ${money(p.targetPrice)} home you’re aiming for.`
        : `You have ${money(p.savings)} of ${money(target.cashNeeded)} for a ${money(p.targetPrice)} home (${money(target.down)} down plus closing costs). “When you’ll be ready” below works out how long.`,
    },
    {
      id: 'programs',
      title: `Plan for the ${money(benefitsTotal)} in government money`,
      body: 'Money you can get, above, lists each program. Claim the land transfer tax refund through your lawyer at closing and the buyers’ tax credit on your next return.',
    },
    {
      id: 'docs',
      title: 'Gather your documents',
      body: 'Two years of T4s or Notices of Assessment, recent pay stubs, a letter from your employer, 90 days of bank statements for the down payment, and photo ID. Self-employed: two years of T1 Generals.',
    },
    {
      id: 'preapproval',
      title: 'Get pre-approved',
      body: (
        <>
          A pre-approval holds a rate for 90 to 120 days and tells sellers you’re serious. A broker compares many lenders at once;{' '}
          <a href="#home-broker" onClick={openBroker} className={link}>
            talk to one
          </a>
          .
        </>
      ),
    },
    {
      id: 'lawyer',
      title: quebec ? 'Choose a notary' : 'Choose a real estate lawyer',
      body: quebec
        ? 'In Québec a notary handles the deed and the mortgage. Expect about $1,500 to $2,500.'
        : 'They check the title, hold the money and register the home in your name. Expect about $1,500 to $2,500 with disbursements.',
    },
    {
      id: 'inspection',
      title: 'Book a home inspection',
      body: 'Make your offer conditional on one, about $400 to $600. With a rental unit, ask the inspector to look at fire separation and exits too.',
    },
    {
      id: 'insurance',
      title: 'Line up home insurance',
      body: 'Your lender needs proof before closing. If you’ll rent out a unit, tell the insurer: a landlord policy for that part is a must.',
    },
    {
      id: 'closing',
      title: 'Keep money aside for moving and day one',
      body: 'Movers, utility hook-ups, a few months of repairs, and property tax adjustments at closing. Keep a cushion after the down payment.',
    },
  ];
  const done = (s) => s.auto || ready[s.id] === true;
  const count = steps.filter(done).length;
  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-zinc-900 dark:text-white">
          {count} of {steps.length} done
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved with your numbers</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--track)" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={count} aria-label="Steps done">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500" style={{ width: `${(count / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 divide-y divide-hairline">
        {steps.map((s, i) => {
          const on = done(s);
          return (
            <li key={s.id} className="flex gap-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={s.auto}
                onClick={() => onReady({ [s.id]: !ready[s.id] })}
                aria-label={`${s.title}${s.auto ? ' (done, from your numbers)' : ''}`}
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${on ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950' : 'border-(--line-strong) hover:border-emerald-500'}`}
              >
                {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </button>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${on ? 'text-zinc-500 line-through decoration-zinc-400/60 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                  <span className="mr-1.5 tabular-nums text-zinc-400">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Rent or buy ---------- */

function WorthChart({ rows }) {
  const w = 560;
  const h = 180;
  const pad = { l: 8, r: 92, t: 12, b: 22 };
  const all = rows.flatMap((r) => [r.buyWorth, r.rentWorth, 0]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (i) => pad.l + (i / (rows.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const line = (k) => rows.map((r, i) => `${x(i)},${y(r[k])}`).join(' ');
  const last = rows.at(-1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-2xl" role="img" aria-label={`After ${rows.length} years: buying ${money(last.buyWorth)}, renting ${money(last.rentWorth)}.`}>
      <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} className="stroke-(--color-hairline)" />
      <polyline points={line('rentWorth')} fill="none" strokeWidth="2.5" className="stroke-zinc-400 dark:stroke-zinc-500" />
      <polyline points={line('buyWorth')} fill="none" strokeWidth="2.5" className="stroke-emerald-500" />
      <text x={x(rows.length - 1) + 8} y={y(last.buyWorth) + 4} className="fill-emerald-700 text-[12px] font-semibold dark:fill-emerald-400">
        Buy {money(last.buyWorth / 1000)}k
      </text>
      <text x={x(rows.length - 1) + 8} y={y(last.rentWorth) + 4} className="fill-zinc-500 text-[12px] font-semibold dark:fill-zinc-400">
        Rent {money(last.rentWorth / 1000)}k
      </text>
      {rows.map((r, i) => (i % 2 === 1 || i === 0 ? (
        <text key={r.year} x={x(i)} y={h - 6} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
          {r.year === 1 ? 'Year 1' : r.year}
        </text>
      ) : null))}
    </svg>
  );
}

/** Ten years of renting against buying the home you're aiming for, with a tenant if it has a second unit. */
export function RentVsBuy({ p, rvb, onRvb, ratePct, taxPct, rentEach, insuranceMonthly }) {
  const a = { ...RENT_VS_BUY_DEFAULTS, ...rvb };
  const r = useMemo(
    () =>
      rentVsBuy({
        ...a,
        price: p.targetPrice,
        units: p.targetUnits,
        city: p.city,
        rentNow: p.rentNow,
        rentFromOthers: rentEach * (p.targetUnits - 1),
        ratePct,
        taxPct,
        insuranceMonthly,
      }),
    [p, a.rentGrowthPct, a.appreciationPct, a.investPct, a.maintPct, ratePct, taxPct, rentEach, insuranceMonthly], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const home = p.targetUnits > 1 ? `a ${money(p.targetPrice)} ${['', '', 'duplex', 'triplex', 'fourplex'][p.targetUnits]}, renting the other unit${p.targetUnits > 2 ? 's' : ''}` : `a ${money(p.targetPrice)} home`;
  const ahead = r.ahead >= 0;
  return (
    <div className="space-y-4 p-5">
      <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        Buying {home} instead of paying {money(p.rentNow)} rent:{' '}
        <span className={`font-semibold ${ahead ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}>
          after {a.years} years you’d be about {money(Math.abs(r.ahead))} {ahead ? 'better off buying' : 'better off renting'}
        </span>
        {r.breakEvenYear && r.breakEvenYear > 1 ? `, with buying pulling ahead in year ${r.breakEvenYear}` : ''}. Buying takes {money(r.upfront)} up front and costs about{' '}
        {money(r.buyFirst)} a month to start{p.targetUnits > 1 ? ' after the tenant’s rent' : ''}, against {money(r.rentFirst)} in rent.
      </p>
      <WorthChart rows={r.rows} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        What each is worth: the home after selling costs and the mortgage, plus anything invested, against the renter investing the {money(r.upfront)} and every month’s
        savings. Change the home you’re aiming for under Your numbers.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField id="rvb-app" label="Home value grows" suffix="%/yr" value={a.appreciationPct} onChange={(v) => onRvb({ appreciationPct: v })} max={15} step={0.5} decimals={1} />
        <NumberField id="rvb-rent" label="Rent grows" suffix="%/yr" value={a.rentGrowthPct} onChange={(v) => onRvb({ rentGrowthPct: v })} max={15} step={0.5} decimals={1} />
        <NumberField id="rvb-inv" label="Investments earn" suffix="%/yr" value={a.investPct} onChange={(v) => onRvb({ investPct: v })} max={15} step={0.5} decimals={1} />
        <NumberField id="rvb-maint" label="Upkeep" suffix="% of value" value={a.maintPct} onChange={(v) => onRvb({ maintPct: v })} max={5} step={0.25} decimals={2} />
      </div>
    </div>
  );
}

/* ---------- Talk to a broker ---------- */

const input = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';
const label = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

/** Ask to be put in touch with a mortgage broker, with your numbers attached if you want. */
export function BrokerForm({ p, maxPrice }) {
  const place = cityByKey(p.city);
  const [f, setF] = useState({ name: '', email: '', phone: '', timeline: '3-6 months', note: '', share: true, consent: false, website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const body = { ...f, city: place.name, ...(f.share && p.entered ? { price: maxPrice, income: p.income } : {}) };
      const res = await fetch('/api/broker', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message === 'Failed to fetch' ? 'This works on the Squarely website. Open it there to send.' : err.message });
    }
  };
  if (state.status === 'sent') {
    return (
      <div className="m-5 rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-900 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-100">
        <p className="font-semibold">Thanks, {f.name.split(' ')[0]}. Your request is in.</p>
        <p className="mt-1">We’ll email you at {f.email} to introduce a licensed mortgage broker in {provinceName(place.province)}. There’s no cost and no obligation.</p>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="space-y-4 p-5">
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        A mortgage broker compares many lenders at once, gets you pre-approved, and is usually paid by the lender, not you. Ask, and we’ll introduce you to a licensed broker in{' '}
        {provinceName(place.province)}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="br-name" className={label}>
            Name
          </label>
          <input id="br-name" required autoComplete="name" value={f.name} onChange={set('name')} className={input} />
        </div>
        <div>
          <label htmlFor="br-email" className={label}>
            Email
          </label>
          <input id="br-email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} className={input} />
        </div>
        <div>
          <label htmlFor="br-phone" className={label}>
            Phone (optional)
          </label>
          <input id="br-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} className={input} />
        </div>
        <div>
          <label htmlFor="br-when" className={label}>
            When do you want to buy?
          </label>
          <select id="br-when" value={f.timeline} onChange={set('timeline')} className={input}>
            {['Within 3 months', '3-6 months', '6-12 months', 'More than a year', 'Just exploring'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="br-note" className={label}>
          Anything they should know? (optional)
        </label>
        <textarea id="br-note" rows={2} value={f.note} onChange={set('note')} className={input} placeholder="Self-employed, buying a duplex, new to Canada…" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
      {p.entered && (
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={f.share} onChange={set('share')} className="mt-1 accent-emerald-600" />
          Include my income ({money(p.income)}) and what I could buy ({money(maxPrice)}) so the broker can start faster.
        </label>
      )}
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" required checked={f.consent} onChange={set('consent')} className="mt-1 accent-emerald-600" />
        <span>
          Pass my details to one licensed mortgage broker so they can contact me. Squarely may be paid a referral fee by the broker; it never changes your rate or costs you
          anything. <a href="/privacy/" className="underline underline-offset-2">Privacy</a>
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? 'Sending…' : 'Put me in touch'}
      </Button>
    </form>
  );
}
