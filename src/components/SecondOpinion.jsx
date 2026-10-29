import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, RefreshCw, Square } from 'lucide-react';
import { capability } from '../lib/runtime.js';
import { buildOpinionPrompt, parseOpinion } from '../lib/opinion.js';
import { Button } from './ui.jsx';
import { Section } from './Section.jsx';

// Codes after which the feature hides for this visit (the viewer said no,
// or Claude isn't available to them here).
const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
// Keep answers for five minutes; "Ask again" asks anew and replaces the kept one.
const KEEP = 5 * 60 * 1000;
const MESSAGES = {
  rate_limited: 'Claude is busy or you’ve reached a usage limit. Try again in a little while.',
  session_expired: 'Your Claude session expired. Sign in again, then retry.',
  refused: 'Claude declined to review this deal. Try changing the deal name or notes.',
  empty_completion: 'Claude didn’t return an answer. Try again.',
  prompt_too_large: 'This deal has too much text to send. Shorten its notes and try again.',
};

function Spans({ spans }) {
  return spans.map((s, i) => (s.bold ? <strong key={i} className="font-semibold text-zinc-900 dark:text-white">{s.text}</strong> : <span key={i}>{s.text}</span>));
}

/** Claude reviews the open deal on request, streaming its answer. Hidden where the page can't ask Claude. */
export default function SecondOpinion({ item, targets }) {
  const [sample, setSample] = useState(undefined); // undefined: still checking; null: unavailable
  const [state, setState] = useState({ phase: 'idle', text: '', error: '', askedFor: '' });
  const ctl = useRef(null);
  const prompt = useMemo(() => buildOpinionPrompt(item, targets), [item, targets]);

  useEffect(() => {
    let live = true;
    // sample is a function, so wrap it: React would call a bare one as an updater.
    capability('sample').then((s) => live && setSample(() => s ?? null));
    return () => {
      live = false;
      ctl.current?.abort();
    };
  }, []);

  if (!sample) return null;

  const ask = async (fresh) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setState({ phase: 'thinking', text: '', error: '', askedFor: prompt });
    try {
      const { text, truncated } = await sample(prompt, {
        signal: c.signal,
        cache: fresh ? { gcTime: KEEP, refresh: true } : { gcTime: KEEP },
        onText: ({ text: t }) => setState((s) => ({ ...s, phase: 'streaming', text: t })),
      });
      setState((s) => ({ ...s, phase: 'done', text, error: truncated ? 'Claude’s answer was cut short.' : '' }));
    } catch (e) {
      if (HIDE.has(e?.code)) {
        setSample(null);
        return;
      }
      if (e?.code === 'cancelled') {
        setState((s) => ({ ...s, phase: 'done', text: e.text ?? s.text }));
        return;
      }
      setState((s) => ({
        ...s,
        phase: 'done',
        text: e?.code === 'refused' ? '' : (e?.text ?? s.text),
        error: MESSAGES[e?.code] ?? 'Something went wrong reaching Claude. Try again.',
      }));
    }
  };

  const busy = state.phase === 'thinking' || state.phase === 'streaming';
  const stale = state.askedFor && state.askedFor !== prompt && !busy;
  const blocks = parseOpinion(state.text);

  return (
    <Section
      id="sec-opinion"
      title="Second opinion"
      meaning={
        busy
          ? 'Claude is reading the numbers…'
          : state.phase === 'done' && blocks.length > 0
            ? 'Claude’s review is ready: a verdict, the risks and what to double-check.'
            : 'Ask Claude to check this deal’s numbers and assumptions, like an underwriter would.'
      }
      actions={
        busy ? (
          <Button onClick={() => ctl.current?.abort()}>
            <Square className="size-3.5" aria-hidden /> Stop
          </Button>
        ) : state.phase === 'done' ? (
          <Button onClick={() => ask(true)}>
            <RefreshCw className="size-3.5" aria-hidden /> Ask again
          </Button>
        ) : null
      }
    >
      <div className="p-5">
        {state.phase === 'idle' ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Get a verdict, the biggest risks, which assumptions to double-check, and a negotiation angle based on your max offer. Uses your Claude account.
            </p>
            <Button variant="primary" onClick={() => ask(false)}>
              <MessageSquareText className="size-4" aria-hidden /> Ask Claude about this deal
            </Button>
          </div>
        ) : (
          <div aria-live="polite" aria-busy={busy}>
            {state.phase === 'thinking' && (
              <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex gap-1" aria-hidden>
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                </span>
                Claude is reading the numbers…
              </p>
            )}
            {blocks.length > 0 && (
              <div className="grid max-w-3xl gap-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {blocks.map((b, i) =>
                  b.type === 'heading' ? (
                    <h3 key={i} className="caption mt-3 first:mt-0">
                      <Spans spans={b.spans} />
                    </h3>
                  ) : b.type === 'bullet' ? (
                    <p key={i} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                      <span>
                        <Spans spans={b.spans} />
                      </span>
                    </p>
                  ) : (
                    <p key={i}>
                      <Spans spans={b.spans} />
                    </p>
                  ),
                )}
              </div>
            )}
            {state.error && <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">{state.error}</p>}
            {stale && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">You’ve changed the deal since this review. Ask again for the current numbers.</p>}
            {state.phase === 'done' && blocks.length > 0 && (
              <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">Claude’s view is a starting point, not financial advice. Verify anything you act on.</p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
