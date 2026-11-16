// Asks from one view to another that opens later (it may not be loaded
// yet): "open the agent form about this home". Kept for the visit only.

const AGENT = 'squarely-agent-ask';

/** Ask Get ready to open its agent form when it next opens, about one home ({ address, city, url, price }) or none. */
export function askAgent(home = null) {
  try {
    sessionStorage.setItem(AGENT, JSON.stringify(home ?? {}));
  } catch {
    // Without storage the page still opens; the form is one tap away.
  }
}

/** The pending agent ask, once: { home } (home null for a general ask), or null. */
export function takeAgentAsk() {
  try {
    const raw = sessionStorage.getItem(AGENT);
    sessionStorage.removeItem(AGENT);
    if (raw == null) return null;
    const home = JSON.parse(raw);
    return { home: home?.address ? home : null };
  } catch {
    return null;
  }
}
