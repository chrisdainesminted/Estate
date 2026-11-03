import { useMemo, useState } from 'react';
import { ClipboardCopy, ExternalLink, FileDown, FileUp, Mail, Plus as PlusIcon, Trash2 } from 'lucide-react';
import { FLOORS, PROJECTS, areas, cleanRoom, guessExterior, listText, storeLinks, takeoff } from '../lib/build.js';
import { accountCall } from '../lib/account.js';
import { saveFile } from '../lib/runtime.js';
import { Button, Card, CardHeader, NumberField, Segmented, ViewHeader } from '../components/ui.jsx';
import { PlusGate, PlusTag, usePlus } from '../components/Plus.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const cell = 'field w-full px-2 py-1.5 text-sm tabular-nums';

/** A file as base64, without the data: prefix. */
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Couldn’t open that file.'));
    r.readAsDataURL(file);
  });

/**
 * Build or renovate: a floor plan becomes a shopping list. With Plus, upload
 * the blueprint and Claude reads the rooms; anyone can type them in. The
 * person checks every room, then gets quantities with the rule behind each
 * and a search at the big Canadian stores.
 */
export default function BuildView({ build, onBuild, account, nextStep }) {
  const plus = usePlus();
  const isPhone = useMediaQuery('(max-width: 639px)');
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const rooms = build.rooms;
  const t = useMemo(() => takeoff({ project: build.project, rooms, exterior: build.exterior }), [build.project, rooms, build.exterior]);
  const a = areas(rooms);

  const setRoom = (i, patch) => onBuild({ rooms: rooms.map((r, j) => (j === i ? cleanRoom({ ...r, ...patch }, j) : r)) });
  const addRoom = () => onBuild({ rooms: [...rooms, cleanRoom({ name: `Room ${rooms.length + 1}`, length: 12, width: 10, height: 8, doors: 1, windows: 1 }, rooms.length)] });

  const read = async (file) => {
    if (!file) return;
    setError('');
    setNote('');
    if (file.size > 8 * 1024 * 1024) return setError('That file is over 8 MB. Try a smaller photo or one page.');
    setReading(true);
    try {
      const data = await toBase64(file);
      const r = await accountCall(account, '/blueprint', { method: 'POST', body: { type: file.type, data } });
      if (!r.rooms?.length) throw new Error(r.notes || 'No rooms could be read from that plan. Type them in instead.');
      onBuild({ rooms: r.rooms, exterior: r.exterior || null, notes: r.notes || '' });
      setNote(`Read ${r.rooms.length} room${r.rooms.length === 1 ? '' : 's'}. Check each size against your plan before you order.`);
    } catch (e) {
      setError(e.message);
    }
    setReading(false);
  };

  const text = listText(t, `Materials list: ${PROJECTS.find((p) => p.key === build.project).label}`);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Couldn’t copy here. Select the list and copy it instead.');
    }
  };
  const pdf = async () => {
    try {
      const { buildReportPdf } = await import('../lib/reportPdf.js');
      const blob = await buildReportPdf({
        title: `Materials list: ${PROJECTS.find((p) => p.key === build.project).label}`,
        subtitle: `${Math.round(t.floor).toLocaleString('en-CA')} sq ft over ${t.rooms.length} rooms: ${t.rooms.map((r) => `${r.name} ${r.length}×${r.width} ft`).join(', ')}`,
        sections: t.groups.map((g) => ({ title: g.title, rows: g.items.map((i) => ({ label: i.name, value: `${i.qty.toLocaleString('en-CA')} ${i.unit}`, note: i.rule })) })),
        footer: 'Quantities from Squarely using common estimating rules, not prices. Check them with your builder, and get permits from your city before you build.',
      });
      await saveFile('squarely-materials.pdf', blob);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader title="Build or renovate">Turn a floor plan into a shopping list: how much of each material, and where to buy it.</ViewHeader>
      {nextStep}

      <Card>
        <CardHeader title="1. What are you doing?" />
        <div className="space-y-2 px-5 pb-5">
          {/* Short names on phones so all three fit; the line below says what the chosen one counts. */}
          <Segmented stretch label="Project" value={build.project} onChange={(project) => onBuild({ project })} options={PROJECTS.map((p) => ({ value: p.key, label: isPhone ? p.short : p.label }))} />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {PROJECTS.find((p) => p.key === build.project).label}: counts {PROJECTS.find((p) => p.key === build.project).words}.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Your rooms" subtitle="Upload your blueprint and we’ll read the rooms, or type them in. Sizes in feet." />
        <div className="space-y-4 px-5 pb-5">
          <PlusGate feature="blueprint" compact>
            {plus.hosted ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Reading blueprints works on the Squarely website. Type the rooms in below.</p>
            ) : (
              <div>
                <label htmlFor="plan-file" className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <FileUp className="size-3.5" aria-hidden /> Blueprint or floor plan (PDF, PNG or JPG, up to 8 MB) <PlusTag />
                </label>
                <input
                  id="plan-file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  disabled={reading}
                  onChange={(e) => read(e.target.files?.[0])}
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-well file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 dark:text-zinc-300 dark:file:text-zinc-100"
                />
                {reading && (
                  <p role="status" className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    Reading your plan. This takes up to a minute…
                  </p>
                )}
              </div>
            )}
          </PlusGate>
          {note && (
            <p role="status" className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-900 ring-1 ring-amber-600/20 ring-inset dark:text-amber-200">
              {note}
              {build.notes ? ` From the plan reader: ${build.notes}` : ''}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {rooms.length > 0 && (
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="py-1.5 pr-2 font-medium">Room</th>
                    <th className="px-1 font-medium">Length</th>
                    <th className="px-1 font-medium">Width</th>
                    <th className="px-1 font-medium">Ceiling</th>
                    <th className="px-1 font-medium">Doors</th>
                    <th className="px-1 font-medium">Windows</th>
                    <th className="px-1 font-medium">New floor</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input aria-label={`Room ${i + 1} name`} value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} className={cell} />
                      </td>
                      {['length', 'width', 'height', 'doors', 'windows'].map((k) => (
                        <td key={k} className="px-1 py-1">
                          <input
                            aria-label={`${r.name} ${k === 'height' ? 'ceiling height' : k}`}
                            type="number"
                            min="0"
                            step={k === 'doors' || k === 'windows' ? 1 : 0.5}
                            value={r[k]}
                            onChange={(e) => setRoom(i, { [k]: e.target.value })}
                            className={`${cell} w-20`}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <select aria-label={`${r.name} new floor`} value={r.floor} onChange={(e) => setRoom(i, { floor: e.target.value })} className={`${cell} w-36`}>
                          {FLOORS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Button variant="ghost" className="px-2" aria-label={`Remove ${r.name}`} onClick={() => onBuild({ rooms: rooms.filter((_, j) => j !== i) })}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <Button onClick={addRoom}>
              <PlusIcon className="size-4" aria-hidden /> Add a room
            </Button>
            {build.project !== 'reno' && rooms.length > 0 && (
              <div className="w-56">
                <NumberField
                  id="build-exterior"
                  label={build.project === 'basement' ? 'Foundation walls you’ll frame' : 'Outside walls, all the way round'}
                  suffix="ft"
                  step={1}
                  decimals={0}
                  value={build.exterior ?? guessExterior(a.floor)}
                  onChange={(v) => onBuild({ exterior: v })}
                  hint={build.exterior ? undefined : 'A guess from the floor area: set it from your plan'}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {t.count > 0 && (
        <Card>
          <CardHeader
            title="3. Your materials list"
            subtitle={`${Math.round(t.floor).toLocaleString('en-CA')} sq ft of floor, ${Math.round(t.walls).toLocaleString('en-CA')} sq ft of wall. Quantities, not prices: check today’s prices at your store.`}
          />
          <div className="flex flex-wrap gap-2 px-5 pb-4">
            <Button onClick={copy}>
              <ClipboardCopy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy the list'}
            </Button>
            <a
              href={`mailto:?subject=${encodeURIComponent('Quote request: materials list')}&body=${encodeURIComponent(`Hello,\n\nCould you price this list for pickup or delivery?\n\n${text}`)}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100"
            >
              <Mail className="size-4" aria-hidden /> Ask a local yard for a price
            </a>
            {plus.active ? (
              <Button onClick={pdf}>
                <FileDown className="size-4" aria-hidden /> Download PDF
              </Button>
            ) : (
              <Button onClick={plus.start} title="Part of Squarely Plus">
                <FileDown className="size-4" aria-hidden /> PDF <PlusTag />
              </Button>
            )}
          </div>
          <div className="divide-y divide-hairline border-t border-hairline">
            {t.groups.map((g) => (
              <section key={g.key} className="px-5 py-4">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{g.title}</h3>
                <ul className="mt-2 divide-y divide-hairline">
                  {g.items.map((i) => (
                    <li key={i.key} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100">
                          {i.name}: <strong className="tabular-nums">{i.qty.toLocaleString('en-CA')}</strong> {i.unit}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{i.rule}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {storeLinks(i.search).map((s) => (
                          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                            {s.name} <ExternalLink className="size-3" aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="border-t border-hairline px-5 py-4 text-xs text-zinc-500 dark:text-zinc-400">
            Common estimating rules, shown beside each line. Electrical, plumbing, heating and structure (beams, joists, roof) need a licensed trade or an engineer, and most work needs a
            permit from your city: ask its building department first.
          </p>
        </Card>
      )}
    </div>
  );
}
