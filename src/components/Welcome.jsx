import { useState } from 'react';
import { X } from 'lucide-react';
import { Card } from './ui.jsx';
import QuickCheck from './QuickCheck.jsx';

const KEY = 'bedrock-welcomed';

function seen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** First visit: what Bedrock answers, and the quickest way to try it on a property. Shown until it's dismissed in this browser. */
export default function Welcome({ country, city, rents, onQuickCheck }) {
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
    <Card className="relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-zinc-500 transition dark:text-zinc-400 hover:bg-well hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="p-5 pr-12 sm:p-6 sm:pr-14">
        <h2 className="text-lg font-semibold tracking-tight text-balance text-zinc-950 sm:text-xl dark:text-white">Would this rental make you money?</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Type a property’s price and rent. Bedrock fills in typical costs, which you can change later, then shows what you’d keep each month and whether a lender
          would lend on it.
        </p>
      </div>
      <div className="max-w-2xl px-5 pb-5 sm:px-6 sm:pb-6">
        <QuickCheck
          idPrefix="welcome"
          country={country}
          city={city}
          rents={rents}
          onCheck={(fields) => {
            dismiss();
            onQuickCheck(fields);
          }}
        />
        <button
          type="button"
          onClick={dismiss}
          className="mt-3 rounded-lg text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
        >
          Or look at the example deals first
        </button>
      </div>
    </Card>
  );
}
