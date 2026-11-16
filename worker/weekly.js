// The free weekly email: the three best homes of the week that match
// someone's alerts, for everyone without Plus (Plus sends alerts daily).

import { topPicks } from '../src/lib/market.js';

/** Mondays only. `today` is YYYY-MM-DD. */
export const weeklyDay = (today) => new Date(`${today}T12:00:00Z`).getUTCDay() === 1;

/** The day a week before `today`, as YYYY-MM-DD. */
export const weekBefore = (today) => new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10);

const dollars = (n) => `$${Math.abs(Math.round(n)).toLocaleString('en-CA')}`;

/** { subject, text } from the week's matches across every alert, or null with none. */
export function weeklyEmail(matches, origin) {
  const picks = topPicks(matches);
  if (!picks.length) return null;
  const total = new Set(matches.map((x) => x.listing.id)).size;
  const lines = picks.map(({ listing: l, costToLive, perDoor }) =>
    [`- ${l.address}, ${dollars(l.price)}`, costToLive != null ? `, about ${dollars(costToLive)}/mo to live in` : '', perDoor != null ? `, ${perDoor >= 0 ? '+' : '-'}${dollars(perDoor)}/door as a rental` : '', `\n  ${l.url}`].join(''),
  );
  return {
    subject: `Squarely: ${picks.length === 1 ? 'a home' : `${picks.length} homes`} that fit you this week`,
    text: [
      `The best of ${total} new or cheaper home${total === 1 ? '' : 's'} matching your alerts this week:`,
      lines.join('\n'),
      `See them all in Squarely: ${origin}/app/?view=listings`,
      `Want to hear the morning a price drops or a new home fits? Squarely Plus emails you every day. Try it free for 7 days: ${origin}/app/?view=pro`,
      'To stop these emails, open Squarely and turn off email alerts in your account.',
    ].join('\n\n'),
  };
}
