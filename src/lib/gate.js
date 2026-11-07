// The app on the website needs a Squarely account. Signed out, a visit to
// /app/ goes to the account page to make one (or sign in), and comes back to
// where it was headed. The Claude page (not under /app/) syncs to the Claude
// account instead, and a co-owner's view-only books link opens without one.

/** A co-owner's view-only link to a landlord's books (#books=…): it opens without an account. */
export const isBooksLink = (hash) => /(?:^#|[#&])books=/.test(String(hash || ''));

/** Where a signed-out visit goes instead, or null to open the app. */
export function signInRedirect(loc, account) {
  if (!loc || !String(loc.pathname || '').startsWith('/app')) return null;
  if (account) return null;
  if (isBooksLink(loc.hash)) return null;
  const back = `${loc.pathname}${loc.search || ''}${loc.hash || ''}`;
  return `/account/?next=${encodeURIComponent(back)}`;
}

/**
 * Where to go once signed in, from the account page's `next`: a view name
 * ("profile") or a path in the app ("/app/?view=listings#deal=…"). Anything
 * else (another site, a protocol-relative link) is ignored.
 */
export function safeNext(next) {
  const n = String(next || '');
  if (!n) return null;
  if (/^[a-z]{2,20}$/.test(n)) return `/app/?view=${n}`;
  if (/^\/app(?:\/|\?|#|$)/.test(n) && !/[\\\s]/.test(n)) return n;
  return null;
}
