import { useEffect, useMemo, useState } from 'react';
import { Check, FileDown, Send } from 'lucide-react';
import { DEFAULT_ANSWERS, INCOME_TYPES, SOURCES, docsFor, lenderSummary } from '../lib/preapproval.js';
import { cityByKey } from '../lib/canada.js';
import { drawMarkPdf } from '../lib/brand.js';
import { Button, Card, CardHeader } from '../components/ui.jsx';

const KEY = 'squarely-preapproval';
const load = () => {
  try {
    return { ...DEFAULT_ANSWERS, have: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_ANSWERS, have: {} };
  }
};

/**
 * Get pre-approved, faster: a few answers, then the documents to gather
 * (ticked off as you find them), a one-page summary for the lender, and
 * one tap to send it with a broker request.
 */
export default function PreApproval({ p, plan, onSend }) {
  const [a, setA] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(a));
    } catch {
      // Private browsing: the answers last for this visit.
    }
  }, [a]);
  const place = cityByKey(p.city);
  const docs = useMemo(() => docsFor(a), [a]);
  const rows = useMemo(() => lenderSummary({ profile: p, plan, answers: a, place }), [p, plan, a, place]);
  const all = docs.flatMap((g) => g.items);
  const got = all.filter((d) => a.have?.[d.key]).length;
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v }));
  const toggleSource = (k) => setA((x) => ({ ...x, sources: x.sources.includes(k) ? x.sources.filter((s) => s !== k) : [...x.sources, k] }));

  return (
    <Card id="preapproval" className="scroll-mt-24">
      <CardHeader title="Get pre-approved, faster" subtitle="Answer a few questions. Get your list of papers. Send it all to a broker." />
      <div className="grid gap-4 border-t border-hairline p-5 text-sm sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">How you’re paid</span>
          <select className="field w-full px-3 py-2" value={a.incomeType} onChange={(e) => set('incomeType')(e.target.value)}>
            {INCOME_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">Years in this work</span>
          <select className="field w-full px-3 py-2" value={a.years} onChange={(e) => set('years')(Number(e.target.value))}>
            {[0, 1, 2, 3, 5, 10].map((y) => (
              <option key={y} value={y}>
                {y === 0 ? 'Under a year' : y === 10 ? '10 or more' : `${y}${y === 5 ? ' to 9' : ''}`}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Your down payment comes from</legend>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => {
              const on = a.sources.includes(s.key);
              return (
                <button key={s.key} type="button" aria-pressed={on} onClick={() => toggleSource(s.key)} className={`rounded-full px-3 py-1.5 ring-1 ring-inset ${on ? 'bg-emerald-600 text-white ring-emerald-600' : 'text-zinc-700 ring-(--line-strong) dark:text-zinc-300'}`}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        {[
          ['coBuyer', 'Buying with someone'],
          ['ownsHome', 'I own a home now'],
          ['newToCanada', 'New to Canada (under 5 years)'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={Boolean(a[k])} onChange={(e) => set(k)(e.target.checked)} /> {label}
          </label>
        ))}
      </div>

      <div className="border-t border-hairline p-5">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-zinc-950 dark:text-white">Your documents</span>
          <span className="tabular text-zinc-500 dark:text-zinc-400">
            {got} of {all.length} found
          </span>
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-(--track)" aria-hidden>
          <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${all.length ? (got / all.length) * 100 : 0}%` }} />
        </div>
        {docs.map((g) => (
          <div key={g.group} className="mt-3">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{g.group}</p>
            <ul className="mt-1 space-y-1.5">
              {g.items.map((d) => (
                <li key={d.key}>
                  <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" className="mt-1" checked={Boolean(a.have?.[d.key])} onChange={(e) => setA((x) => ({ ...x, have: { ...x.have, [d.key]: e.target.checked } }))} />
                    <span className={a.have?.[d.key] ? 'line-through opacity-60' : ''}>{d.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline p-5">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">Your summary for the lender</p>
        <dl className="mt-2 grid gap-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
              <dd className="text-right font-medium text-zinc-950 dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onSend(rows, docs, a)}>
            <Send className="size-4" aria-hidden /> Send it to a broker
          </Button>
          <Button onClick={() => downloadPacket(rows, docs, a)}>
            <FileDown className="size-4" aria-hidden /> Download as PDF
          </Button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Your answers and ticks stay in this browser. Nothing is sent until you press send.
        </p>
      </div>
    </Card>
  );
}

const clean = (t) => String(t ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, '-');

/** The packet as a one-page PDF: the summary, then the document checklist with what's found ticked. */
async function downloadPacket(rows, docs, a) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const m = 48;
  const W = 612 - m * 2;
  drawMarkPdf(doc, m, m - 2, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Squarely  ·  Pre-approval summary', m + 22, m + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }), m + W, m + 10, { align: 'right' });
  let y = m + 44;
  doc.setFontSize(9.5);
  for (const [k, v] of rows) {
    doc.setTextColor(90, 90, 100);
    doc.text(clean(k), m, y);
    doc.setTextColor(20, 20, 25);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(clean(v), W * 0.55), m + W, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 16;
  }
  y += 10;
  for (const g of docs) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(clean(g.group).toUpperCase(), m, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 25);
    for (const d of g.items) {
      const lines = doc.splitTextToSize(`${a.have?.[d.key] ? '[x]' : '[  ]'}  ${clean(d.text)}`, W);
      doc.text(lines, m, y);
      y += lines.length * 13 + 3;
    }
    y += 6;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  doc.text(doc.splitTextToSize('From the numbers I entered in Squarely. A lender confirms everything with the documents above.', W), m, 792 - 40);
  doc.save('pre-approval-summary.pdf');
}
