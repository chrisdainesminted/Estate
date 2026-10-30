import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui.jsx';
import { PROVINCES, provinceName } from '../../lib/canada.js';
import { SCREENING, TENANCY_CHECKED, rulesFor } from '../../lib/tenancyRules.js';
import { dateLabel } from '../../lib/when.js';
import { Select } from './shared.jsx';

function Link({ href, children }) {
  if (!href) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 underline dark:text-emerald-400">
      {children} <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** The province's renting rules, in plain words, plus fair screening. */
export default function Rules({ province: home }) {
  const [province, setProvince] = useState(home);
  const r = rulesFor(province);
  const rows = [
    ['How much rent can go up', r.cap == null ? r.capNote : `${r.cap}% in 2026. ${r.capNote}`],
    ['How often', `Once every ${r.gapMonths} months.`],
    ['Notice', r.noticeNote],
    ['Deposit', r.deposit],
    ['Lease', r.lease],
    ['Entering the unit', r.entry],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader
          title={`Renting in ${provinceName(province)}`}
          subtitle={`Checked ${dateLabel(TENANCY_CHECKED)}. Confirm with the province before you act.`}
          actions={
            <Select id="rules-prov" label="Province" value={province} onChange={setProvince}>
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          }
        />
        <dl className="divide-y divide-hairline">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-3.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="font-semibold text-zinc-950 dark:text-white">{k}</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1 border-t border-hairline px-5 py-4 text-sm">
          <p>
            Disputes and forms: <Link href={r.board.url}>{r.board.name}</Link>
          </p>
          {r.leaseUrl && (
            <p>
              <Link href={r.leaseUrl}>The lease form</Link>
            </p>
          )}
          {r.check && <p className="text-xs text-amber-800 dark:text-amber-300">Sources disagreed on some of these for {provinceName(province)}; check them with the province.</p>}
        </div>
      </Card>
      <Card className="self-start">
        <CardHeader title="Choosing a tenant fairly" subtitle="Human rights law applies in every province." />
        <ul className="grid gap-3 p-5 text-sm text-zinc-700 dark:text-zinc-300">
          {SCREENING.map((s) => (
            <li key={s} className="border-l-2 border-hairline pl-3">
              {s}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
