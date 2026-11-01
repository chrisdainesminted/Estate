// The website's address for a page, from inside the app. On the website the
// app lives at /app/, so a plain path works; the same app published as a
// Claude page runs elsewhere and needs the full address.
export const SITE = 'https://bedrock.signia83.workers.dev';

export const sitePage = (path) => (typeof window !== 'undefined' && window.location.pathname.startsWith('/app') ? path : `${SITE}${path}`);
