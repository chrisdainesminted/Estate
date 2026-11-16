// Share a result in a sentence: the phone's own share sheet where there is
// one, else the sentence and link copied. Nothing about the person is sent
// anywhere unless they pick where it goes.

import { track } from './track.js';

/** 'shared', 'copied', 'cancelled' (the person closed the sheet) or 'failed'. */
export async function shareResult({ text, url, title = '' }) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url });
      track('share');
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    track('share');
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The sentence for "what could you buy", rounded to $5,000 so it says nothing exact about the person's money. */
export function buyShareText(price, { withSuite = false, place = '' } = {}) {
  const k = Math.round(price / 5000) * 5000;
  return `I could buy up to $${k.toLocaleString('en-CA')}${withSuite ? ' with a rental suite' : ''}${place ? ` in ${place}` : ''}. See what you could buy, free, on Squarely:`;
}
