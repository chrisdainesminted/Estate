import { useMemo, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { hasDetails, shareLink } from '../lib/share.js';
import Sheet from './Sheet.jsx';
import { Button } from './ui.jsx';

/** Share a deal: a link to the public site that carries its numbers. */
export default function ShareSheet({ deal, onClose }) {
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
