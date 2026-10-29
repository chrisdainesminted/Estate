import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

function MenuItem({ icon: Icon, title, sub, onClick, busy }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-start gap-3 rounded-[3px] px-3 py-2.5 text-left transition hover:bg-well disabled:opacity-60"
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-900 dark:text-white">{title}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      </span>
    </button>
  );
}

/** Header menu for the PDF memo and CSV; the work lives in useExports. */
export default function ExportMenu({ current, count, exports }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Export"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-well hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-zinc-300 dark:hover:text-white"
      >
        <Download className="size-4" aria-hidden />
        <span className="max-[1400px]:sr-only">Export</span>
      </button>
      {open && (
        <div role="menu" className="popover pop absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl p-1.5">
          <MenuItem
            icon={FileText}
            title="Deal memo (PDF)"
            sub={`One page on “${current.deal.name}”: DSCR, cash flow, cash needed and the year-10 sale.`}
            busy={exports.busy === 'pdf'}
            onClick={async () => {
              await exports.exportPdf();
              setOpen(false);
            }}
          />
          <MenuItem
            icon={FileSpreadsheet}
            title="All deals (CSV)"
            sub={`${count} deals with inputs and results, for Excel or Sheets.`}
            busy={exports.busy === 'csv'}
            onClick={async () => {
              await exports.exportCsv();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
