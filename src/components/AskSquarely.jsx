import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Send, X } from 'lucide-react';
import { ASK_STARTERS, askPrompt } from '../lib/ask.js';
import { accountCall } from '../lib/account.js';
import { capability } from '../lib/runtime.js';
import { Button } from './ui.jsx';
import { PlusOffer, usePlus } from './Plus.jsx';

const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

/**
 * "Ask Squarely": a question box that answers from the person's own numbers.
 * On the Claude page it uses the viewer's Claude account; on the website it
 * goes through the site's server, for Plus members.
 */
export default function AskSquarely({ context, mode, account }) {
  const plus = usePlus();
  const [open, setOpen] = useState(false);
  const [sample, setSample] = useState(undefined);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    let live = true;
    capability('sample').then((s) => live && setSample(() => s ?? null));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [history, busy]);

  const viaClaude = Boolean(sample);
  const canAsk = viaClaude || (plus.active && account);

  const ask = async (q) => {
    const question = q.trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    const before = history;
    setHistory([...before, { role: 'user', text: question }]);
    setBusy(true);
    try {
      let text;
      if (viaClaude) {
        let streamed = '';
        const r = await sample(askPrompt(context, before, question), {
          onText: ({ text: t }) => {
            streamed = t;
            setHistory([...before, { role: 'user', text: question }, { role: 'assistant', text: t }]);
          },
        });
        text = r?.text ?? streamed;
      } else {
        text = (await accountCall(account, '/ask', { method: 'POST', body: { question, context, history: before } })).text;
      }
      setHistory([...before, { role: 'user', text: question }, { role: 'assistant', text }]);
    } catch (e) {
      if (HIDE.has(e?.code)) setSample(null);
      setHistory(before);
      setDraft(question);
      setError(e?.message || 'Something went wrong. Try again.');
    }
    setBusy(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Squarely"
          className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-500 p-3 text-sm sm:px-4 font-semibold text-zinc-950 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 print:hidden"
          style={{ bottom: 'calc(var(--dock, 0px) + 1rem)' }}
        >
          <MessageCircleQuestion className="size-5 sm:size-4" aria-hidden /> <span className="max-sm:sr-only">Ask Squarely</span>
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-label="Ask Squarely"
          className="fixed inset-x-2 z-50 flex max-h-[min(36rem,75vh)] flex-col overflow-hidden rounded-xl border border-hairline bg-(--panel) shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[26rem] print:hidden"
          style={{ bottom: 'calc(var(--dock, 0px) + 0.75rem)' }}
        >
          <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Ask Squarely</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Answers from your own numbers. Not financial advice.</p>
            </div>
            <Button variant="ghost" className="px-2" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="size-4" aria-hidden />
            </Button>
          </header>

          <div ref={box} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
            {!canAsk ? (
              plus.hosted || sample === undefined ? (
                <p className="text-zinc-600 dark:text-zinc-400">{sample === undefined ? 'Getting ready…' : 'Ask Squarely isn’t available in this view.'}</p>
              ) : (
                <PlusOffer feature="ask" />
              )
            ) : history.length === 0 ? (
              <div>
                <p className="text-zinc-700 dark:text-zinc-300">Ask anything about your plan, a home, or a deal. Try:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(ASK_STARTERS[mode] ?? ASK_STARTERS.buy).map((q) => (
                    <button key={q} type="button" onClick={() => ask(q)} className="rounded-full bg-well px-3 py-1.5 text-left text-xs font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'ml-8 rounded-lg bg-emerald-500/15 px-3 py-2 text-zinc-900 dark:text-zinc-100' : 'mr-4 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200'}>
                  {m.text}
                </div>
              ))
            )}
            {busy && history.at(-1)?.role === 'user' && <p className="text-zinc-500 dark:text-zinc-400">Thinking…</p>}
            {error && (
              <p role="alert" className="text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          {canAsk && (
            <form
              className="flex items-end gap-2 border-t border-hairline p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
            >
              <label htmlFor="ask-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="ask-input"
                ref={input}
                rows={1}
                maxLength={1000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(draft);
                  }
                }}
                placeholder="Ask a question…"
                className="field max-h-28 min-h-10 flex-1 resize-none px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary" disabled={busy || !draft.trim()} aria-label="Send">
                <Send className="size-4" aria-hidden />
              </Button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
