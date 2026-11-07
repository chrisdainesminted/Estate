import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui.jsx';
import { T776 } from '../../lib/landlord.js';
import { money } from '../../lib/format.js';
import { portfolioTaxLines } from '../../lib/portfolioTax.js';

const lineOf = (category) => T776.find((c) => c.key === category);
const same = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

/**
 * The year's tax lines from the homes you own in Portfolio: mortgage
 * interest, property tax, insurance, utilities and repairs as expenses, and
 * improvements as capital cost allowance. They're added to the books by
 * themselves and kept in step with Portfolio; untick one to leave it out.
 */
export default function PortfolioTax({ ownedDeals, year, data, api, readOnly }) {
  const lines = useMemo(() => portfolioTaxLines(ownedDeals, year), [ownedDeals, year]);
  // What's left out: as saved, with this screen's own ticks on top so they show (and hold) at once.
  const [ticks, setTicks] = useState({});
  const off = useMemo(() => {
    const keys = new Set((data.settings?.portfolioOff ?? []).map((o) => o.key));
    for (const [k, on] of Object.entries(ticks)) on ? keys.delete(k) : keys.add(k);
    return keys;
  }, [data.settings, ticks]);
  const [error, setError] = useState('');
  const running = useRef(false);
  const yr = String(year);

  // Bring the books in step: add what's new, update what changed, remove what Portfolio no longer has for this year.
  const plan = useMemo(() => {
    const ops = [];
    const have = new Map((data.expenses ?? []).filter((e) => e.source?.startsWith('pf:')).map((e) => [e.source, e]));
    const haveA = new Map((data.assets ?? []).filter((a) => a.source?.startsWith('pf:')).map((a) => [a.source, a]));
    const want = new Set();
    for (const l of lines.expenses) {
      want.add(l.source);
      if (off.has(l.source)) continue;
      const e = have.get(l.source);
      const body = { date: l.date, amount: l.amount, category: l.category, note: l.note, source: l.source };
      if (!e) ops.push(['save', 'expenses', null, body]);
      else if (!same(e.amount, l.amount) || e.date !== l.date || e.category !== l.category || e.note !== l.note) ops.push(['save', 'expenses', e.id, body]);
    }
    for (const a of lines.assets) {
      want.add(a.source);
      if (off.has(a.source)) continue;
      const x = haveA.get(a.source);
      const body = { label: a.label, ccaClass: a.ccaClass, cost: a.cost, available: a.available, note: 'From Portfolio', source: a.source };
      if (!x) ops.push(['save', 'assets', null, body]);
      else if (!same(x.cost, a.cost) || x.available !== a.available || x.label !== a.label || x.ccaClass !== a.ccaClass) ops.push(['save', 'assets', x.id, body]);
    }
    // This year's lines Portfolio no longer has (a home sold or removed, a job changed): out of the books.
    for (const [src, e] of have) if (String(e.date).startsWith(yr) && !want.has(src)) ops.push(['remove', 'expenses', e.id]);
    for (const [src, a] of haveA) if (String(a.available).startsWith(yr) && !want.has(src)) ops.push(['remove', 'assets', a.id]);
    return ops;
  }, [lines, off, data.expenses, data.assets, yr]);

  useEffect(() => {
    if (readOnly || !plan.length || running.current) return;
    running.current = true;
    (async () => {
      try {
        for (const [op, col, id, body] of plan) {
          if (op === 'save') await api.save(col, id, body);
          else await api.remove(col, id);
        }
        setError('');
      } catch (err) {
        setError(err.message);
      }
      running.current = false;
    })();
  }, [plan, api, readOnly]);

  const toggle = async (source, include) => {
    setTicks((t) => ({ ...t, [source]: include }));
    const keys = new Set(off);
    if (include) keys.delete(source);
    else keys.add(source);
    try {
      await api.save('settings', 'main', { portfolioOff: [...keys].map((key) => ({ key })) });
      if (!include) {
        const e = (data.expenses ?? []).find((x) => x.source === source);
        const a = (data.assets ?? []).find((x) => x.source === source);
        if (e) await api.remove('expenses', e.id);
        if (a) await api.remove('assets', a.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (!lines.expenses.length && !lines.assets.length && !lines.undated.length) return null;
  const homes = [...new Set([...lines.expenses, ...lines.assets].map((l) => l.home))];
  const counted = lines.expenses.filter((l) => !off.has(l.source)).reduce((t, l) => t + l.amount, 0);
  const row = (key, label, sub, amount, estimate) => (
    <li key={key} className="flex items-start gap-3 py-1.5">
      <input type="checkbox" checked={!off.has(key)} disabled={readOnly} onChange={(e) => toggle(key, e.target.checked)} aria-label={`Include ${label}`} className="mt-1 accent-emerald-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-zinc-900 dark:text-zinc-100">{label}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {sub}
          {estimate && <span className="ml-1.5 rounded bg-amber-400/15 px-1 py-px text-[10px] font-medium text-amber-800 dark:text-amber-200">estimate</span>}
        </span>
      </span>
      <span className={`tabular shrink-0 text-sm ${off.has(key) ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-white'}`}>{money(amount)}</span>
    </li>
  );

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Briefcase className="size-4 text-emerald-600" aria-hidden /> From your Portfolio, {yr}
          </span>
        }
        subtitle={`${money(counted)} in expenses added for you, kept in step with Portfolio. Untick anything you’ve also logged yourself.`}
      />
      <div className="space-y-4 px-5 pb-5">
        {homes.map((home) => (
          <div key={home}>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{home}</p>
            <ul className="divide-y divide-hairline">
              {lines.expenses
                .filter((l) => l.home === home)
                .map((l) => row(l.source, l.label.replace(/^./, (c) => c.toUpperCase()), `T776 line ${lineOf(l.category)?.line} · ${lineOf(l.category)?.label}`, l.amount, l.estimate))}
              {lines.assets
                .filter((a) => a.home === home)
                .map((a) => row(a.source, a.label.replace(`${home}: `, ''), `Improvement: capital cost allowance, class ${a.ccaClass}`, a.cost, false))}
            </ul>
          </div>
        ))}
        {lines.undated.length > 0 && (
          <p className="rounded-md bg-amber-400/15 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-500/30 ring-inset dark:text-amber-100">
            {lines.undated.map((u) => `${u.home}: ${u.what} (${money(u.cost)})`).join('; ')} {lines.undated.length === 1 ? 'has' : 'have'} no date. Set when it was done in Portfolio (Edit, then Work you’ve put in) and it’s added to the right year.
          </p>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Interest comes from your mortgage’s schedule; property tax, insurance and utilities from Portfolio, for the months you owned it. Items marked estimate are worth checking against your statements. Repairs are expenses that year; improvements are written off over years. Change them in Portfolio.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
