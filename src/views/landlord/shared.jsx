import { useState } from 'react';
import { Check, Copy, Mail, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { mailto, smsto } from '../../lib/landlord.js';

/** A record without the server's own fields, ready to send back. */
export const editable = (record, drop = []) => Object.fromEntries(Object.entries(record).filter(([k]) => !['id', 'created', 'updated', 'token', 'repairToken', ...drop].includes(k)));

export const fieldLabel = 'mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
export const fieldInput = 'field w-full px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100';

/** A labelled text-like input: text, email, tel, date, time, datetime-local, number. */
export function Input({ id, label, value, onChange, type = 'text', hint, className = '', ...rest }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
        className={fieldInput}
        {...rest}
      />
      {hint && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function TextArea({ id, label, value, onChange, rows = 3, className = '', ...rest }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <textarea id={id} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={fieldInput} {...rest} />
    </div>
  );
}

export function Select({ id, label, value, onChange, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={fieldInput}>
        {children}
      </select>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy link', className = '' }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt('Copy this:', text);
        }
      }}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? 'Copied' : label}
    </Button>
  );
}

/**
 * Send a message from the landlord's own email or phone: opens their mail
 * app or messages with it filled in. Nothing is sent until they press send
 * there. `onSent` runs as the app opens (to record what was sent).
 */
export function SendButtons({ email, phone, message, onSent }) {
  return (
    <div className="flex flex-wrap gap-2">
      {email && (
        <a href={mailto(email, message)} onClick={onSent} className="inline-flex items-center gap-1.5 rounded-md bg-(--accent) px-3.5 py-2 text-sm font-semibold text-(--accent-ink) hover:brightness-110">
          <Mail className="size-4" aria-hidden /> Email it
        </a>
      )}
      {phone && (
        <a href={smsto(phone, message)} onClick={onSent} className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100">
          <MessageSquare className="size-4" aria-hidden /> Text it
        </a>
      )}
      <CopyButton text={`${message.subject}\n\n${message.body}`} label="Copy" />
    </div>
  );
}

export function Empty({ children }) {
  return <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}

export function Pill({ tone = 'zinc', children }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300',
    green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
    red: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200',
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
