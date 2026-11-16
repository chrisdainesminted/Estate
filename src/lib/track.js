// The funnel: tells the site that one step happened (its name only, no
// numbers, nothing about the person), so we can see where people stop.
// The server keeps a count a day of each (worker/directory.js FUNNEL).

const ONCE = new Set(['quick_check', 'plan_done', 'account']);

/** Count `name` once; steps in ONCE count once per browser. Never throws, never waits. */
export function track(name) {
  try {
    if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return;
    if (ONCE.has(name)) {
      const key = `squarely-step-${name}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    }
    const body = JSON.stringify({ name });
    if (navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Counting is never worth breaking the page for.
  }
}
