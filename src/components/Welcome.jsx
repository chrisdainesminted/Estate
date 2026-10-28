import { useState } from 'react';
import { Gauge, Plus, Sprout, Target, X } from 'lucide-react';
import { Button, Card } from './ui.jsx';

const KEY = 'bedrock-welcomed';

function seen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

const STEPS = [
  { icon: Gauge, title: 'Check the verdict', body: 'what a lender says and what you’d keep' },
  { icon: Target, title: 'Know your number', body: 'the most to pay for your targets' },
  { icon: Sprout, title: 'Plan the next door', body: 'when your cash covers the next one' },
];

/** One-time introduction, shown until it's dismissed in this browser. */
export default function Welcome({ onNewDeal }) {
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // A dismissed welcome is a convenience; it may come back without storage.
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[22rem] rounded-full bg-radial from-emerald-400/25 via-teal-300/10 to-transparent to-70% blur-2xl" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-zinc-500 transition dark:text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="relative p-5 pr-12 sm:p-6 sm:pr-14">
        <p className="eyebrow">Welcome to Bedrock</p>
        <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-950 sm:text-xl dark:text-white">A lender can approve a deal that still loses you money.</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Bedrock checks every deal two ways: what a lender would approve, and what actually lands in your bank account. Start with the summary below, then open any
          line for the detail.
        </p>
        <ol className="mt-3 hidden flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600 sm:flex dark:text-zinc-400">
          {STEPS.map((s) => (
            <li key={s.title} className="flex items-center gap-1.5">
              <s.icon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.title}:</span> {s.body}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              dismiss();
              onNewDeal();
            }}
          >
            <Plus className="size-4" aria-hidden /> Start a new deal
          </Button>
          <Button onClick={dismiss}>Explore the examples</Button>
        </div>
      </div>
    </Card>
  );
}
