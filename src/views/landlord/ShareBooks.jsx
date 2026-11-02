import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import { CopyButton } from './shared.jsx';

/**
 * A view-only link for co-owners: it opens just the books (rent received,
 * expenses, receipts, CCA and each owner's tax pack), with no tenants'
 * contact details and no way to change anything. Only one link at a time:
 * making a new one turns the old one off.
 */
export default function ShareBooks({ api, shared }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const make = () => run(async () => setLink(await api.shareBooks()));
  const stop = () =>
    run(async () => {
      await api.unshareBooks();
      setLink('');
    });

  return (
    <Card>
      <CardHeader title="Co-owners’ view-only link" subtitle="Lets a co-owner open the books and download their own tax pack. They can’t change anything or see tenants’ contact details." />
      <div className="space-y-3 p-5 text-sm">
        {link ? (
          <>
            <input readOnly aria-label="View-only link" value={link} onFocus={(e) => e.target.select()} className="field w-full px-3 py-2.5 font-mono text-xs" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Copy it now and send it to your co-owners: for safety it isn’t shown again. You can always make a new one.</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={link} label="Copy link" />
              <Button variant="ghost" disabled={busy} onClick={stop}>
                Turn it off
              </Button>
            </div>
          </>
        ) : shared ? (
          <>
            <p className="text-zinc-700 dark:text-zinc-300">A view-only link is on. Making a new one turns the old one off.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={make}>
                <Link2 className="size-4" aria-hidden /> Make a new link
              </Button>
              <Button variant="ghost" disabled={busy} onClick={stop}>
                Turn it off
              </Button>
            </div>
          </>
        ) : (
          <Button disabled={busy} onClick={make}>
            <Link2 className="size-4" aria-hidden /> Make a view-only link
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
