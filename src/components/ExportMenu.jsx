import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, XCircle } from 'lucide-react';
import { dealsToCsv } from '../lib/export.js';
import { saveFile } from '../lib/runtime.js';

function MenuItem({ icon: Icon, title, sub, onClick, busy }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-950/[0.04] disabled:opacity-60 dark:hover:bg-white/[0.06]"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-900 dark:text-white">{title}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      </span>
    </button>
  );
}

export default function ExportMenu({ current, items }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const run = async (kind, make) => {
    setBusy(kind);
    try {
      const { filename, data } = await make();
      const result = await saveFile(filename, data);
      setOpen(false);
      if (result === 'saved') setStatus({ ok: true, text: `Saved ${filename}` });
    } catch (e) {
      setStatus({ ok: false, text: e.message || 'Couldn’t save the file.' });
    } finally {
      setBusy(null);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Export"
        className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Download className="size-4" aria-hidden />
        <span className="max-lg:sr-only">Export</span>
      </button>
      {open && (
        <div role="menu" className="glass-strong pop absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl p-1.5">
          <MenuItem
            icon={FileText}
            title="Deal memo (PDF)"
            sub={`One page on “${current.deal.name}”: DSCR, cash flow, cash needed and the year-10 sale.`}
            busy={busy === 'pdf'}
            onClick={() =>
              run('pdf', async () => {
                const { buildMemoPdf, memoFilename } = await import('../lib/memoPdf.js');
                return { filename: memoFilename(current.deal), data: await buildMemoPdf(current) };
              })
            }
          />
          <MenuItem
            icon={FileSpreadsheet}
            title="All deals (CSV)"
            sub={`${items.length} deals with inputs and results, for Excel or Sheets.`}
            busy={busy === 'csv'}
            // The byte-order mark makes Excel read the file as UTF-8.
            onClick={() => run('csv', async () => ({ filename: `bedrock-deals-${stamp}.csv`, data: `﻿${dealsToCsv(items)}` }))}
          />
        </div>
      )}
      {status && (
        <div
          role="status"
          className={`glass-strong pop absolute top-full right-0 z-50 mt-2 flex w-72 items-start gap-2 rounded-2xl px-3.5 py-3 text-sm ${
            status.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-700 dark:text-red-300'
          }`}
        >
          {status.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span className="min-w-0 break-words">{status.text}</span>
        </div>
      )}
    </div>
  );
}
