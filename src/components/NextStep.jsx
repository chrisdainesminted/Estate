import { ArrowRight, Footprints } from 'lucide-react';
import { Button } from './ui.jsx';

/**
 * "Your next step": the one thing a first-time buyer should do now, at the
 * top of each of their pages, with a button that takes them there.
 */
export default function NextStep({ step, onGo }) {
  if (!step) return null;
  return (
    <section aria-label="Your next step" className="rise flex flex-col gap-3 rounded-lg border border-emerald-600/30 bg-emerald-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 dark:border-emerald-400/25 dark:bg-emerald-400/[0.06]">
      <Footprints className="hidden size-5 shrink-0 text-emerald-700 sm:block dark:text-emerald-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-300">
          Your next step{step.count ? ` · ${step.index + 1} of ${step.count}` : ''}
        </p>
        <p className="mt-0.5 text-[15px] font-semibold text-zinc-950 dark:text-white">{step.title}</p>
        <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{step.text}</p>
      </div>
      {step.action && (
        <Button variant="primary" className="shrink-0 self-start sm:self-center" onClick={() => onGo(step)}>
          {step.action} <ArrowRight className="size-4" aria-hidden />
        </Button>
      )}
    </section>
  );
}
