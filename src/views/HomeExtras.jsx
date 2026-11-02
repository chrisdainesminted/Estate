import { useMemo, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Button, NumberField } from '../components/ui.jsx';
import { buyCheck } from '../lib/firstHome.js';
import { stepsFor } from '../lib/journey.js';
import { cityByKey, provinceName } from '../lib/canada.js';
import { RENT_VS_BUY_DEFAULTS, rentVsBuy } from '../lib/rentVsBuy.js';
import { money } from '../lib/format.js';
import { sitePage } from '../lib/site.js';

const link = 'inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400';
const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
    {children} <ExternalLink className="size-3" aria-hidden />
  </a>
);

/* ---------- Get ready: every step to moving day ---------- */

/**
 * Every step between "I want to buy" and moving day, each explained, in
 * order. Saving ticks itself from the person's numbers; the rest they tick,
 * and the ticks are saved with their numbers (and their account, if any).
 */
export function ReadyChecklist({ p, ready, onReady, ratePct, taxPct, rentEach, benefitsTotal, onBroker, onView }) {
  const place = cityByKey(p.city);
  const target = buyCheck({ profile: p, price: p.targetPrice, units: p.targetUnits, ratePct, taxesMonthly: (p.targetPrice * taxPct) / 1200, rentFromOthers: rentEach * (p.targetUnits - 1), city: p.city });
  const saved = p.savings >= target.cashNeeded;
  const quebec = place.province === 'QC';
  const c = target.closing;
  const rental = p.targetUnits > 1;
  const go = (view) => (e) => {
    e.preventDefault();
    onView?.(view);
  };
  const bodies = {
    credit: (
      <>
        Lenders want a score around 680 or higher for the best rates; 600 is about the least most will take. Your report is free from Equifax and TransUnion:{' '}
        <Ext href="https://www.canada.ca/en/financial-consumer-agency/services/credit-reports-score/order-credit-report.html">how to get it</Ext>. Fix any mistakes, pay every bill
        on time, and keep card balances under a third of the limit.
      </>
    ),
    fhsa: (
      <>
        Up to $8,000 a year comes off your taxable income and comes out tax-free to buy. Open one now even with a little in it: the room starts the year you open it. Any bank or
        online brokerage can open one. <Ext href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html">FHSA rules</Ext>
      </>
    ),
    save: saved ? (
      `You have ${money(p.savings)}, enough for the ${money(p.targetPrice)} home you’re aiming for (${money(target.down)} down plus ${money(c.total)} closing).`
    ) : (
      <>
        You have {money(p.savings)} of {money(target.cashNeeded)} for a {money(p.targetPrice)} home: {money(target.down)} down plus {money(c.total)} closing.{' '}
        <a href="#plan-gap" onClick={go('home')} className={link}>
          See your plan and shortcuts
        </a>
        . There’s also about {money(benefitsTotal)} in government money.
      </>
    ),
    docs: 'Two years of T4s or Notices of Assessment, your two latest pay stubs, a letter from your employer with your salary and start date, 90 days of bank statements showing the down payment, and photo ID. Self-employed: two years of T1 Generals. A gift: a signed letter saying it isn’t a loan.',
    preapproval: (
      <>
        A pre-approval checks your income and credit, holds a rate for 90 to 120 days, and tells sellers you’re serious. Do it once you’re within a few months of buying. A
        mortgage broker compares many lenders at once and is usually free to you.{' '}
        <button type="button" onClick={onBroker} className={link}>
          Get a broker to call you
        </button>{' '}
        or read{' '}
        <a href={sitePage('/lenders/')} className={link}>
          how to find a lender
        </a>
        .
      </>
    ),
    realtor: 'A buyer’s agent finds homes, books showings, writes your offer and negotiates. The seller usually pays their commission. Talk to two or three: ask how many first-time buyers they helped last year, and how they price an offer. You’ll sign a buyer agreement: read how long it lasts.',
    search: (
      <>
        <a href="#homes" onClick={go('homes')} className={link}>
          Homes for me
        </a>{' '}
        shows today’s listings with what each would cost you a month and the cash to close, marked fits, stretch or not yet. Go to viewings with your realtor; look at the roof,
        windows, furnace age and water in the basement.{rental ? ' For a rental unit, check it has its own entrance and is legal.' : ''}
      </>
    ),
    offer: `Your realtor writes it. Put in conditions: financing (5 to 7 days for your lender to approve this home) and inspection, so you can walk away and keep your deposit if either fails. The deposit, often 2 to 5% of the price, is due within a day of acceptance and comes out of your down payment.${rental ? ' Ask for the current rent and leases if a unit is rented.' : ''}`,
    inspection: `A home inspector spends two or three hours checking the structure, roof, plumbing, wiring and heating, for about $400 to $600. Go along. If something big turns up, ask for a lower price or walk away before the condition ends.${rental ? ' Ask them to look at fire separation and exits for the rental unit.' : ''}`,
    insurance: `Your lender needs proof of home insurance before closing. Get two or three quotes once your offer is firm.${rental ? ' Tell the insurer you’ll rent out a unit: it needs landlord coverage.' : ''}`,
    lawyer: (
      <>
        {quebec ? 'In Québec a notary' : 'A real estate lawyer'} checks the title, moves the money and registers the home in your name, for about $1,500 to $2,500. Have this ready
        for closing day, on top of the down payment: {money(c.ltt)} land transfer tax
        {c.refund > 0 ? `, less ${money(c.refund)} first-time buyer rebate` : ''}, about {money(c.other)} in legal and other costs
        {c.premiumPst > 0 ? `, and ${money(c.premiumPst)} sales tax on the mortgage insurance` : ''}. That’s {money(c.total)} in all for a {money(p.targetPrice)} home.
      </>
    ),
    moving: 'Book movers early for month-end. Put hydro, gas, water and internet in your name from closing day. Change your address with Canada Post and the CRA. Keep a cushion for the first repairs, and claim the $1,500 home buyers’ tax credit on your next return.',
  };
  const steps = stepsFor(p).map((s) => ({ ...s, auto: s.id === 'save' ? saved : false, body: bodies[s.id] }));
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
            <li key={s.id} id={`step-${s.id}`} className="flex scroll-mt-24 gap-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={s.id === 'save'}
                onClick={() => onReady({ [s.id]: !ready[s.id] })}
                aria-label={`${s.title}${s.id === 'save' ? (on ? ' (done, from your numbers)' : ' (ticks itself once your savings cover it)') : ''}`}
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

export { default as BrokerForm } from '../components/BrokerForm.jsx';
