import { useEffect, useState } from 'react';
import { BellRing, Cloud, Copy, Mail, Trash2 } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { Button } from './ui.jsx';
import { accountCall, accountUrl, createAccount, saveAccountLink } from '../lib/account.js';
import { alertName } from '../lib/market.js';
import { cityByKey } from '../lib/canada.js';

const field = 'field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100';

/**
 * Your Bedrock account: sync your numbers and deals to every device with a
 * private link, and get listing alerts by email. No password; the link is
 * the key, so it's shown with a plain warning.
 */
export default function AccountSheet({ open, onClose, hosted, account, onAccount, alerts, onRemoveAlert }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [remote, setRemote] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState('');

  useEffect(() => {
    if (!open || !account) return;
    accountCall(account)
      .then((r) => (setRemote(r), setEmail((e) => e || r.email || '')))
      .catch((e) => setError(e.message));
  }, [open, account]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const link = account ? accountUrl(account) : '';

  return (
    <Sheet open={open} onClose={onClose} title="Your account" desktop>
      <div className="space-y-6 text-sm">
        {hosted ? (
          <p className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
            <Cloud className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            On your Claude page, your numbers and deals already sync to your Claude account. A Bedrock account is for the website.
          </p>
        ) : !account ? (
          <>
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Keep your numbers on every device</h3>
              <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">
                Right now everything is saved only in this browser. An account keeps your numbers, deals, checklist and listing alerts in sync on your phone and
                computer. No password: you get a private link that opens it.
              </p>
            </div>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const a = await createAccount();
                  saveAccountLink(a);
                  onAccount(a);
                })
              }
            >
              <Cloud className="size-4" aria-hidden /> {busy ? 'Creating…' : 'Create my account'}
            </Button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Free. Your numbers stay private; see the <a href="/privacy/" className="underline">privacy policy</a>.</p>
          </>
        ) : (
          <>
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
                <Cloud className="size-4 text-emerald-600" aria-hidden /> Your account is on
              </h3>
              <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">Open this link on your other devices to sync them. Keep it private: anyone with it can see your numbers.</p>
            </div>
            <input readOnly value={link} aria-label="Your account link" onFocus={(e) => e.target.select()} className={`${field} font-mono text-xs`} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigator.clipboard?.writeText(link).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
                <Copy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy link'}
              </Button>
              <a
                href={`mailto:?subject=${encodeURIComponent('My Bedrock account link')}&body=${encodeURIComponent(`Open this to sync Bedrock on this device:\n\n${link}\n\nKeep it private.`)}`}
                className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100"
              >
                <Mail className="size-4" aria-hidden /> Email it to myself
              </a>
            </div>

            <section className="border-t border-hairline pt-5">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
                <BellRing className="size-4 text-emerald-600" aria-hidden /> Listing alerts
              </h3>
              {alerts.length === 0 ? (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">None yet. On the Listings tab, use “Alert me” to save a search.</p>
              ) : (
                <ul className="mt-2 divide-y divide-hairline rounded-md border border-hairline">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-zinc-800 dark:text-zinc-200">{alertName(a, cityByKey(a.city).name)}</span>
                      <Button variant="ghost" aria-label="Remove this alert" onClick={() => onRemoveAlert(a.id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">New matches show on the Listings tab. Add an email to get a daily digest too.</p>
              {remote?.emailVerified ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-emerald-700 dark:text-emerald-400">Emailing {remote.email}</span>
                  <Button variant="ghost" onClick={() => run(async () => setRemote(await accountCall(account, '/email', { method: 'DELETE' })))}>
                    Stop emails
                  </Button>
                </div>
              ) : sent ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => (setRemote(await accountCall(account, '/email/check', { method: 'POST', body: { code } })), setSent('')));
                  }}
                >
                  <label className="grow">
                    <span className="mb-1.5 block text-xs text-zinc-600 dark:text-zinc-400">Code sent to {sent}</span>
                    <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className={field} />
                  </label>
                  <Button type="submit" variant="primary" disabled={busy}>
                    Confirm
                  </Button>
                </form>
              ) : (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => setSent((await accountCall(account, '/email', { method: 'POST', body: { email } })).email));
                  }}
                >
                  <label className="grow">
                    <span className="mb-1.5 block text-xs text-zinc-600 dark:text-zinc-400">Email for alerts</span>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Send a code
                  </Button>
                </form>
              )}
            </section>

            <section className="flex flex-wrap gap-2 border-t border-hairline pt-5">
              <Button variant="ghost" onClick={() => confirm('Stop syncing on this device? Your account stays; open your link to sync again.') && (saveAccountLink(null), onAccount(null))}>
                Forget on this device
              </Button>
              <Button
                variant="ghost"
                className="text-red-700 dark:text-red-300"
                onClick={() =>
                  confirm('Delete your account? Everything saved to it is erased and the link stops working. This browser keeps its own copy.') &&
                  run(async () => {
                    await accountCall(account, '', { method: 'DELETE' });
                    saveAccountLink(null);
                    onAccount(null);
                  })
                }
              >
                Delete account
              </Button>
            </section>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
