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
  { icon: Gauge, title: 'Check the verdict', body: 'Lender DSCR on one side, the cash you actually keep on the other.' },
  { icon: Target, title: 'Know your number', body: 'Set your targets and get the most you can pay for the deal.' },
  { icon: Sprout, title: 'Plan the next door', body: 'See when your cash covers the next purchase and where ten years leads.' },
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
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-[26rem] rounded-full bg-radial from-emerald-400/30 via-teal-300/10 to-transparent to-70% blur-2xl" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-zinc-500 transition dark:text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div>
          <p className="eyebrow">Welcome to Bedrock</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-3xl dark:text-white">
            A lender can approve a deal that still loses you money.
          </h2>
          <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Bedrock runs every deal two ways, the way your lender sees it and the way your bank account does. The examples below show the difference.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
        <ol className="hidden gap-3 sm:grid sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-2xl bg-well p-4">
              <s.icon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
