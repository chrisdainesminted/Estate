import { useState } from 'react';
import { Button, Card, CardHeader } from '../../components/ui.jsx';
import CitySelect from '../../components/CitySelect.jsx';
import { links } from '../../lib/landlordApi.js';
import { CopyButton, Input, TextArea, editable } from './shared.jsx';

/** Your name and contact (shown to applicants once a viewing is confirmed), and your private link. */
export default function SettingsPanel({ settings, api, ws, province, homeCity, onForget }) {
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
      <Card className="self-start">
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
  );
}
