import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { GLOSSARY } from '../lib/glossary.js';
import Sheet from './Sheet.jsx';
import QuickCheck from './QuickCheck.jsx';

const TERMS = Object.entries(GLOSSARY).sort(([, x], [, y]) => x.term.localeCompare(y.term));

function Heading({ id, children }) {
  return (
    <h3 id={id} className="text-sm font-semibold text-zinc-900 dark:text-white">
      {children}
    </h3>
  );
}

/** How Bedrock works: a quick check, what each tab is for, and the words it uses. */
export default function HelpSheet({ onClose, views, country, rents, onQuickCheck, moreHidden, onShowAll }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return words ? TERMS.filter(([, t]) => `${t.term} ${t.body}`.toLowerCase().includes(words)) : TERMS;
  }, [q]);

  return (
    <Sheet open onClose={onClose} title="How Bedrock works" desktop>
      <div className="space-y-7 pb-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Bedrock tells you whether a rental property would put money in your pocket each month, and whether a lender would lend on it.
        </p>

        <section aria-labelledby="help-check" className="space-y-3">
          <Heading id="help-check">Check a property</Heading>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Type its price and rent. Taxes, insurance and running costs start at typical values you can change.</p>
          <QuickCheck idPrefix="help" country={country} rents={rents} onCheck={onQuickCheck} />
        </section>

        <section aria-labelledby="help-tabs" className="space-y-3">
          <Heading id="help-tabs">What each tab does</Heading>
          <dl className="divide-y divide-hairline rounded-md border border-hairline">
            {views.map((v) => (
              <div key={v.value} className="flex gap-3 px-4 py-3">
                <dt className="w-20 shrink-0 self-start text-sm font-medium text-zinc-900 dark:text-white">{v.label}</dt>
                <dd className="text-sm text-zinc-600 dark:text-zinc-400">{v.about}</dd>
              </div>
            ))}
          </dl>
          {moreHidden && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Portfolio, Compare and Plan wait under <span className="font-medium text-zinc-900 dark:text-white">More</span> until you have two deals of your own or own a
              property.{' '}
              <button
                type="button"
                onClick={onShowAll}
                className="rounded font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-400"
              >
                Show them now
              </button>
            </p>
          )}
        </section>

        <section aria-labelledby="help-words" className="space-y-3">
          <Heading id="help-words">Words to know</Heading>
          <label htmlFor="help-find" className="sr-only">
            Find a word
          </label>
          <div className="field flex items-center">
            <Search className="ml-3 size-4 shrink-0 text-zinc-400" aria-hidden />
            <input
              id="help-find"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a word, like DSCR"
              autoComplete="off"
              className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
          </div>
          {shown.length ? (
            <dl className="space-y-3">
              {shown.map(([key, t]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-zinc-900 dark:text-white">{t.term}</dt>
                  <dd className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{t.body}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No words match “{q.trim()}”.</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
