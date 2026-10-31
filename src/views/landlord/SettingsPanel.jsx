import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import CitySelect from '../../components/CitySelect.jsx';
import { links } from '../../lib/landlordApi.js';
import { CopyButton, Input, TextArea, editable } from './shared.jsx';

/** Your name and contact (shown to applicants once a viewing is confirmed), and your private link. */
export default function SettingsPanel({ settings, api, ws, province, homeCity, config, onForget }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', signature: '', ...settings, city: settings.city || homeCity });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => (setF((x) => ({ ...x, [k]: v })), setSaved(false));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.save('settings', 'main', editable(f));
      setSaved(true);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="About you" subtitle="Your name shows on listing pages. Email and phone show to an applicant once you confirm their viewing." />
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
          <Input id="st-name" label="Name applicants see" value={f.name} onChange={set('name')} className="sm:col-span-2" />
          <Input id="st-email" label="Email" type="email" value={f.email} onChange={set('email')} />
          <Input id="st-phone" label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
          <div className="sm:col-span-2">
            <CitySelect id="st-city" label="Where your rentals are" value={f.city || ''} onChange={set('city')} />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Sets the province rules ({province}) for rent increases and notices.</p>
          </div>
          <div className="border-t border-hairline pt-4 sm:col-span-2">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">Rent by Interac e-Transfer</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Shown on each tenant’s rent page, with a message that says which unit and month it’s for.</p>
          </div>
          <Input id="st-et" label="E-Transfer email" type="email" value={f.etransferEmail || ''} onChange={set('etransferEmail')} />
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={Boolean(f.autodeposit)} onChange={(e) => set('autodeposit')(e.target.checked)} className="accent-emerald-600" />
            Autodeposit is on
          </label>
          <Input id="st-etnote" label="Anything else tenants should know (optional)" value={f.etransferNote || ''} onChange={set('etransferNote')} className="sm:col-span-2" placeholder="Rent is due on the 1st. Cheques also accepted." />
          <TextArea id="st-sig" label="Sign your messages" value={f.signature} onChange={set('signature')} rows={2} className="sm:col-span-2" placeholder={'Chris\n807-555-0100'} />
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            {saved && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved</span>}
          </div>
        </form>
      </Card>
      <div className="space-y-6 self-start">
      {config.verification && <ConfirmEmail settings={settings} api={api} />}
      <Card>
        <CardHeader title="Your private link" subtitle="Opens this workspace on any device. Anyone with it can see your tenants’ details." />
        <div className="space-y-4 p-5 text-sm">
          <input readOnly aria-label="Your private link" value={links.private(ws)} onFocus={(e) => e.target.select()} className="field w-full px-3 py-2.5 font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={links.private(ws)} label="Copy private link" />
            <Button variant="ghost" onClick={() => confirm('Forget the workspace on this device? You’ll need your private link to open it again.') && onForget()}>
              Forget on this device
            </Button>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

/** Confirming the email with a six-digit code, so listings can show in public search. */
function ConfirmEmail({ settings, api }) {
  const [sent, setSent] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (settings.emailVerified)
    return (
      <Card className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-800 dark:text-emerald-300">
        <BadgeCheck className="size-4" aria-hidden /> {settings.email} is confirmed. Your public listings show a “confirmed” mark.
      </Card>
    );
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
  return (
    <Card>
      <CardHeader title="Confirm your email" subtitle="Listings show in Bedrock’s public search once you do. It helps keep fake listings out." />
      <div className="space-y-3 p-5 text-sm">
        {!settings.email ? (
          <p className="text-zinc-600 dark:text-zinc-400">Add your email above and save first.</p>
        ) : (
          <>
            <Button disabled={busy} onClick={() => run(async () => setSent((await api.verifySend()).email))}>
              {sent ? 'Send a new code' : `Email a code to ${settings.email}`}
            </Button>
            {sent && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), run(() => api.verifyCheck(code)))}>
                <Input id="st-code" label={`The 6-digit code sent to ${sent}`} value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
                <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
                  Confirm
                </Button>
              </form>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
