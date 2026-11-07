// What the website's server says is switched on (/api/config), asked for
// once per page load. On the Claude page, or offline, it's empty.

let promise = null;

export function siteConfig() {
  if (!promise) {
    const web = typeof fetch === 'function' && typeof window !== 'undefined' && /^https?:/.test(window.location.protocol);
    promise = web
      ? (async () => {
          const stop = typeof AbortController === 'function' ? new AbortController() : null;
          const timer = setTimeout(() => stop?.abort(), 5000);
          try {
            const r = await fetch('/api/config', { signal: stop?.signal });
            const type = r.headers.get('content-type') || '';
            return r.ok && type.includes('json') ? await r.json() : {};
          } catch {
            return {};
          } finally {
            clearTimeout(timer);
          }
        })()
      : Promise.resolve({});
  }
  return promise;
}
