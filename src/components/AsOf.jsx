import { CalendarClock } from 'lucide-react';
import { freshness } from '../lib/freshness.js';

/** When the rate and lending rules behind an answer were checked, with a warning once they're old. */
export default function AsOf({ className = '' }) {
  const f = freshness();
  return (
    <p className={`flex items-start gap-1.5 text-[11px] ${f.stale ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400'} ${className}`}>
      <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {f.text}
        {f.warning ? `. ${f.warning}` : ''}
      </span>
    </p>
  );
}
