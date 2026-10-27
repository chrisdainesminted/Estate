import { useCallback, useState } from 'react';
import { dealsToCsv } from '../lib/export.js';
import { saveFile } from '../lib/runtime.js';
import { useToast } from '../components/toast.jsx';

/** PDF memo and CSV export, shared by the Export menu and the command palette. */
export function useExports(current, items) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const run = useCallback(
    async (kind, make) => {
      setBusy(kind);
      try {
        const { filename, data } = await make();
        const result = await saveFile(filename, data);
        if (result === 'saved') toast({ text: `Saved ${filename}` });
      } catch (e) {
        toast({ tone: 'error', text: e?.message || 'Couldn’t save the file.' });
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  const exportPdf = useCallback(
    () =>
      run('pdf', async () => {
        const { buildMemoPdf, memoFilename } = await import('../lib/memoPdf.js');
        return { filename: memoFilename(current.deal), data: await buildMemoPdf(current) };
      }),
    [run, current],
  );

  const exportCsv = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    // The byte-order mark makes Excel read the file as UTF-8.
    return run('csv', async () => ({ filename: `bedrock-deals-${stamp}.csv`, data: `﻿${dealsToCsv(items)}` }));
  }, [run, items]);

  return { busy, exportPdf, exportCsv };
}
