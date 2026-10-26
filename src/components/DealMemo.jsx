import { verdict } from '../lib/dscr.js';
import { money, percent, ratio } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { LogoMark } from './Logo.jsx';

// One-page printable summary of a deal. Hidden on screen; window.print()
// shows only this (the app shell is print:hidden). Fixed light colors so it
// prints the same from dark mode.

function Box({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
      <div className="text-[8pt] font-medium tracking-wider text-zinc-500 uppercase">{label}</div>
      <div className="mt-0.5 text-[17pt] leading-tight font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-[8pt] text-zinc-500">{sub}</div>}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-4 py-[3px] ${strong ? 'mt-0.5 border-t border-zinc-300 pt-1 font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-zinc-600'}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-1 border-b border-zinc-900 pb-0.5 text-[8pt] font-semibold tracking-wider uppercase">{title}</h3>
      {children}
    </div>
  );
}

export default function DealMemo({ item }) {
  const { deal, a, rows, sale, refi, offer } = item;
  const v = verdict(a);
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const pick = [1, 3, 5, 7, 10].map((y) => rows[y - 1]).filter(Boolean);

  return (
    <article className="memo hidden bg-white text-[9.5pt] leading-snug text-zinc-900 print:block" aria-hidden>
      <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[9pt] font-semibold">
            <LogoMark className="size-5" /> Bedrock · Deal memo
          </div>
          <h1 className="mt-2 text-[22pt] leading-tight font-semibold tracking-tight">{deal.name}</h1>
          <p className="tabular mt-0.5 text-zinc-600">
            {money(a.price)} · {type?.key === 'multiplex' ? `${a.units}-unit multiplex` : type?.label} · {Number(deal.downPct)}% down ·{' '}
            {Number(deal.rate)}% {deal.termYears}-yr{a.interestOnly ? `, ${a.ioYears}-yr interest-only` : ''} · {money(a.grossRent)}/mo rent
          </p>
        </div>
        <div className="text-right text-[8pt] text-zinc-500">
          <div>{today}</div>
          <div className="mt-1 inline-block rounded-full border border-zinc-900 px-2 py-0.5 font-semibold text-zinc-900">{v.label}</div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-4 gap-2.5">
        <Box label="Lender DSCR" value={ratio(a.dscr)} sub={a.status.label} />
        <Box label="Net cash flow" value={`${money(a.netCashFlow, { signed: true })}/mo`} sub={`${money(a.annualCashFlow, { signed: true })}/yr`} />
        <Box label="Cash-on-cash" value={percent(a.coc)} sub={`on ${money(a.cashInvested)}`} />
        <Box label={`IRR, sold yr ${sale.year}`} value={Number.isFinite(sale.irr) ? percent(sale.irr, 1) : '—'} sub={`${Number.isFinite(sale.equityMultiple) ? sale.equityMultiple.toFixed(2) : '—'}× equity multiple`} />
      </div>

      {offer && offer.feasible && Number.isFinite(offer.price) && (
        <p className="mt-3 font-semibold text-emerald-800">
          Max offer at your targets: {money(offer.price)} ({offer.vsAsking >= 0 ? `${money(offer.vsAsking)} above` : `${money(-offer.vsAsking)} below`} asking).
        </p>
      )}

      {a.lenderApprovedButNegative && (
        <p className="mt-3 rounded-lg border border-zinc-900 px-3 py-2 font-medium">
          Lender-approved but cash-flow negative: a {ratio(a.dscr)} DSCR qualifies, yet the deal loses {money(-a.netCashFlow)}/month after operating
          expenses. Break-even rent is {money(a.breakevenRent / a.units)}/unit.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
        <Section title="What the lender sees">
          <Row label="Gross rent" value={money(a.grossRent)} />
          <Row label={a.interestOnly ? 'Interest only' : 'Principal & interest'} value={money(a.pi)} />
          <Row label="Taxes" value={money(a.taxes)} />
          <Row label="Insurance" value={money(a.insurance)} />
          <Row label="HOA" value={money(a.hoa)} />
          <Row label="PITIA" value={money(a.pitia)} strong />
          <Row label="DSCR (rent ÷ PITIA)" value={ratio(a.dscr)} />
        </Section>

        <Section title="What hits your account">
          <Row label="Gross rent" value={money(a.grossRent)} />
          <Row label="PITIA" value={`−${money(a.pitia)}`} />
          <Row label="Management" value={`−${money(a.opex.management)}`} />
          <Row label="Maintenance" value={`−${money(a.opex.maintenance)}`} />
          <Row label="Vacancy" value={`−${money(a.opex.vacancy)}`} />
          <Row label="CapEx" value={`−${money(a.opex.capex)}`} />
          <Row label="Net cash flow" value={money(a.netCashFlow, { signed: true })} strong />
        </Section>

        <Section title="Cash required">
          <Row label="Down payment" value={money(a.downPayment)} />
          <Row label="Closing costs" value={money(a.closingCosts)} />
          <Row label="Rehab" value={money(a.rehab)} />
          <Row label="Cash invested" value={money(a.cashInvested)} strong />
          <Row label={`Reserves (${Number(deal.reserveMonths) || 0} mo PITIA)`} value={money(a.reserves)} />
          <Row label="Cash needed" value={money(a.cashNeeded)} strong />
          {refi && <Row label={`Cash back at refinance (yr ${refi.year})`} value={money(refi.cashOut, { signed: true })} />}
          {refi && <Row label="Cash left in deal" value={money(refi.cashLeft)} strong />}
        </Section>

        <Section title={`If sold in year ${sale.year}`}>
          <Row label="Sale price" value={money(sale.salePrice)} />
          <Row label={`Selling costs (${Number(deal.sellingCostPct) || 0}%)`} value={`−${money(sale.sellingCosts)}`} />
          <Row label="Loan payoff" value={`−${money(sale.loanPayoff)}`} />
          {sale.prepayPenalty > 0 && <Row label="Prepayment penalty" value={`−${money(sale.prepayPenalty)}`} />}
          <Row label="Net proceeds" value={money(sale.netProceeds)} strong />
          <Row label={`${sale.year} years of cash flow`} value={money(sale.totalCashFlow, { signed: true })} />
          {sale.cashOut !== 0 && <Row label="Cash from refinance" value={money(sale.cashOut, { signed: true })} />}
          <Row label="Profit after cash invested" value={money(sale.profit, { signed: true })} strong />
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Projection">
          <table className="tabular w-full">
            <thead>
              <tr className="text-[8pt] text-zinc-500">
                {['Year', 'Cash flow', 'Principal paid', 'Value', 'Loan balance', 'Equity', 'Profit if sold'].map((h, i) => (
                  <th key={h} className={`py-1 font-medium ${i ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pick.map((r) => (
                <tr key={r.year} className="border-t border-zinc-200">
                  <td className="py-[3px]">{r.year}</td>
                  <td className="text-right">{money(r.cashFlow, { signed: true })}</td>
                  <td className="text-right">{money(r.cumPrincipal)}</td>
                  <td className="text-right">{money(r.value)}</td>
                  <td className="text-right">{money(r.balance)}</td>
                  <td className="text-right">{money(r.equity)}</td>
                  <td className="text-right">{money(r.profitIfSold, { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <p className="mt-4 border-t border-zinc-200 pt-2 text-[7.5pt] text-zinc-500">
        Assumptions: OpEx {Number(deal.mgmtPct)}% management, {Number(deal.maintPct)}% maintenance, {Number(deal.vacancyPct)}% vacancy, {Number(deal.capexPct)}%
        CapEx; {Number(deal.appreciationPct)}%/yr appreciation, {Number(deal.rentGrowthPct)}%/yr rent growth, {Number(deal.expenseGrowthPct)}%/yr tax and
        insurance growth. Estimates for personal analysis, not lending or investment advice. Generated by Bedrock.
      </p>
    </article>
  );
}
