// How fresh the figures behind every answer are: the mortgage rate and the
// lending rules are checked by hand, so each answer says when, and warns
// once they're old enough that they may have changed.

import { MARKET_SOURCES } from './market.js';
import { RULES_CHECKED } from './firstHome.js';

// Rates move with the Bank of Canada (eight announcements a year); rules change less often.
export const STALE_AFTER_DAYS = { rate: 45, rules: 180 };

const daysSince = (iso, today) => {
  const t = Date.parse(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(t) ? Math.floor((today.getTime() - t) / 86400000) : null;
};

const shortDate = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

/** { text, stale } for the rate and rules behind an answer, as of `today`. */
export function freshness(today = new Date(), { rateChecked = MARKET_SOURCES.checked, rulesChecked = RULES_CHECKED } = {}) {
  const rateAge = daysSince(rateChecked, today);
  const rulesAge = daysSince(rulesChecked, today);
  const staleRate = rateAge != null && rateAge > STALE_AFTER_DAYS.rate;
  const staleRules = rulesAge != null && rulesAge > STALE_AFTER_DAYS.rules;
  const text = `Rates checked ${shortDate(rateChecked)} · lending rules ${shortDate(rulesChecked)}`;
  const warning =
    staleRate || staleRules
      ? `${[staleRate && 'Rates', staleRules && 'lending rules'].filter(Boolean).join(' and ').replace(/^l/, 'L')} may have changed since then: a lender or broker has today’s.`
      : null;
  return { text, stale: Boolean(warning), warning };
}
