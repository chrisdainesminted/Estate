import { useMemo, useState } from 'react';
import { Check, Copy, FileDown, Printer, Share2 } from 'lucide-react';
import { hasDetails, shareLink } from '../lib/share.js';
import { saveFile } from '../lib/runtime.js';
import Sheet from './Sheet.jsx';
import { Button } from './ui.jsx';

/** The one-page deal sheet as a PDF: built on demand, so jsPDF loads only when asked for. */
async function makeSheet(deal, targets) {
  const { buildDealSheetPdf, dealSheetFilename, sheetItem } = await import('../lib/dealSheetPdf.js');
  return { blob: await buildDealSheetPdf(sheetItem(deal, targets)), filename: dealSheetFilename(deal) };
}

/**
 * Share a deal: a clean one-page PDF to print or send (the monthly costs,
 * the cash it takes, what's left, ten years of cash flow and the most to
 * pay), or a link to the public site that carries its numbers.
 */
export default function ShareSheet({ deal, item, targets, hosted = false, onClose }) {
  const [pdf, setPdf] = useState('');
  const details = hasDetails(deal);
  const [withDetails, setWithDetails] = useState(true);
  const [status, setStatus] = useState('');
  const link = useMemo(() => shareLink(deal, { withDetails }), [deal, withDetails]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
    } catch {
      // Some embedded pages can't reach the clipboard: select the link to copy by hand.
      const field = document.getElementById('share-link');
      field?.focus();
      field?.select();
      setStatus('select');
    }
  };

  return (
    <Sheet open onClose={onClose} title="Share this deal" desktop>
      <div className="space-y-4 pb-4">
        {item && (
          <section className="space-y-3 border-b border-hairline pb-5">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Print or save as a PDF</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              One clean page: what it costs each month, the down payment and cash to close, what’s left for you, cash flow over 10 years and the most you should pay. Counted as self-managed, with no property management fee.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={pdf === 'busy'}
                onClick={async () => {
                  setPdf('busy');
                  try {
                    const { blob, filename } = await makeSheet(item.deal, targets);
                    const r = await saveFile(filename, blob);
                    setPdf(r === 'saved' ? 'saved' : '');
                  } catch (e) {
                    setPdf(e?.message || 'error');
                  }
                }}
              >
                <FileDown className="size-4" aria-hidden /> {pdf === 'busy' ? 'Making it…' : 'Save PDF'}
              </Button>
              {!hosted && (
                <Button
                  disabled={pdf === 'busy'}
                  onClick={async () => {
                    // Open the PDF in a new tab, where the browser's own Print button prints it as it looks.
                    const tab = window.open('', '_blank');
                    setPdf('busy');
                    try {
                      const { blob } = await makeSheet(item.deal, targets);
                      const url = URL.createObjectURL(blob);
                      if (tab) tab.location.href = url;
                      else window.location.href = url;
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                      setPdf('opened');
                    } catch (e) {
                      tab?.close();
                      setPdf(e?.message || 'error');
                    }
                  }}
                >
                  <Printer className="size-4" aria-hidden /> Print
                </Button>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {pdf === 'saved' ? 'Saved. Print it or attach it to an email.' : pdf === 'opened' ? 'Opened in a new tab: use Print there.' : pdf && pdf !== 'busy' ? (pdf === 'error' ? 'Couldn’t make the PDF. Try again.' : pdf) : ''}
            </p>
          </section>
        )}
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Share a link</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Anyone with this link sees “{deal.name}” with these numbers, and can save a copy of their own. Your other deals aren’t included.
        </p>
        {details && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={withDetails}
              onChange={(e) => {
                setWithDetails(e.target.checked);
                setStatus('');
              }}
              className="mt-0.5 size-4 shrink-0 accent-emerald-600"
            />
            Include the address, listing link and notes
          </label>
        )}
        <div>
          <label htmlFor="share-link" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Link
          </label>
          <input
            id="share-link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={copy}>
            {status === 'copied' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {status === 'copied' ? 'Copied' : 'Copy link'}
          </Button>
          {canShare && (
            <Button onClick={() => navigator.share({ title: deal.name, text: `${deal.name}, on Squarely`, url: link }).catch(() => {})}>
              <Share2 className="size-4" aria-hidden /> Share…
            </Button>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {status === 'copied' ? 'Link copied. Paste it into a text or an email.' : status === 'select' ? 'The link is selected: copy it from there.' : ''}
        </p>
      </div>
    </Sheet>
  );
}
