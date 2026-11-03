// "Ask Squarely" on the website: a question, the facts the app gathered about
// the person, and the last few turns go to Claude; its answer comes back as
// text. Plus members only, since every question costs the site money.

import Anthropic from '@anthropic-ai/sdk';
import { ASK_SYSTEM } from '../src/lib/ask.js';
import { StoreError } from './store.js';

const clip = (s, n) => String(s ?? '').slice(0, n);

export async function askSquarely(apiKey, { question, context, history }) {
  const q = clip(question, 1000).trim();
  if (!q) throw new StoreError(400, 'Ask a question.');
  const turns = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role, content: clip(m.text, 2000) }));
  // The API wants turns to start with the person; drop a leading answer.
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  let response;
  try {
    response = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: `${ASK_SYSTEM}\n\nFacts about them:\n${clip(context, 8000)}`,
      messages: [...turns, { role: 'user', content: q }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new StoreError(429, 'Lots of questions right now. Try again in a minute.');
    if (e instanceof Anthropic.APIError) throw new StoreError(502, 'Ask Squarely isn’t answering right now. Try again later.');
    throw new StoreError(502, 'Couldn’t reach Ask Squarely. Try again in a minute.');
  }
  if (response.stop_reason === 'refusal') return { text: 'I can’t help with that one. Try asking about your plan, a home or a deal.' };
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return { text: text || 'No answer came back. Try asking another way.' };
}
