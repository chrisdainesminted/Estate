// A Bedrock account on the website: the private link that opens it (kept in
// this browser), calls to /api/a/<id>, and a small adapter that lets the deal
// library sync to it the same way it syncs to a Claude account on the hosted
// page: get, set, and a snapshot listener (here, polling while the tab is open).

const KEY = 'bedrock-account';
const POLL = 60000;

/** The account link saved in this browser ({ id, key }), taking one from the address (#account=id.key) first. */
export function accountLink() {
  if (typeof window === 'undefined') return null;
  try {
    const m = /(?:^|[#&])account=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{16,128})/.exec(window.location.hash);
    if (m) {
      localStorage.setItem(KEY, `${m[1]}.${m[2]}`);
      const rest = window.location.hash.replace(/(?:^#|&)account=[^&]*/, '').replace(/^#?&/, '#');
      window.history.replaceState(null, '', window.location.pathname + window.location.search + (rest === '#' ? '' : rest));
    }
    const saved = localStorage.getItem(KEY);
    if (!saved) return null;
    const [id, key] = saved.split('.');
    return id && key ? { id, key } : null;
  } catch {
    return null;
  }
}

export function saveAccountLink(link) {
  try {
    if (link) localStorage.setItem(KEY, `${link.id}.${link.key}`);
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the account still works for this visit.
  }
}

export const accountUrl = (link) => `${window.location.origin}/app/#account=${link.id}.${link.key}`;

export async function accountCall(link, path = '', { method = 'GET', body } = {}) {
  const res = await fetch(`/api/a/${link.id}${path}`, {
    method,
    headers: { authorization: `Bearer ${link.key}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Couldn’t reach your account. Try again in a minute.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function createAccount() {
  const res = await fetch('/api/accounts', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Couldn’t create an account here. It works on the Bedrock website.');
  return { id: data.id, key: data.key };
}

/** The library's sync target for an account: the same shape as the hosted page's database doc. */
export function accountRef(link) {
  const snap = (r) => ({ exists: Boolean(r?.data), data: () => r.data, metadata: { hasPendingWrites: false } });
  return {
    get: async () => snap(await accountCall(link)),
    set: (body) => accountCall(link, '', { method: 'PUT', body: { data: body, updatedAt: body.updatedAt } }),
    onSnapshot(onNext, onError) {
      let dead = false;
      const pull = () => {
        if (dead || document.visibilityState === 'hidden') return;
        accountCall(link)
          .then((r) => !dead && onNext(snap(r)))
          .catch((e) => !dead && (e.status === 401 || e.status === 404) && onError(e));
      };
      const timer = setInterval(pull, POLL);
      document.addEventListener('visibilitychange', pull);
      return () => {
        dead = true;
        clearInterval(timer);
        document.removeEventListener('visibilitychange', pull);
      };
    },
  };
}

// ---- signing in with an email and password ----

async function authCall(path, body) {
  const res = await fetch(`/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Couldn’t reach Bedrock. Try again in a minute.');
  return data;
}

/** Tell every part of the page (and other tabs) that the account changed. */
export function announceAccount(link) {
  saveAccountLink(link);
  window.dispatchEvent(new CustomEvent('bedrock-account', { detail: link }));
}

/** A new account with this email and password, keeping what this browser already saved to an account. */
export async function signUp(email, password) {
  const link = await authCall('signup', { email, password, account: accountLink() });
  announceAccount({ id: link.id, key: link.key });
  return link;
}

export async function signIn(email, password) {
  const link = await authCall('login', { email, password });
  // Signing in to an existing account: its saved library wins over this browser's, once.
  try {
    sessionStorage.setItem('bedrock-prefer-account', '1');
  } catch {
    // Without it, the newer of the two wins as usual.
  }
  announceAccount({ id: link.id, key: link.key });
  return link;
}

export const changePassword = (email, password, next) => authCall('password', { email, password, next });

export function signOut() {
  announceAccount(null);
}

/** Email a password reset link (the answer is the same whether or not the email has an account). */
export const forgotPassword = (email) => authCall('forgot', { email });

/** Set a new password with the emailed link's token; signs in on this device. */
export async function resetPassword(email, token, password) {
  const link = await authCall('reset', { email, token, password });
  try {
    sessionStorage.setItem('bedrock-prefer-account', '1');
  } catch {
    // Newest wins.
  }
  announceAccount({ id: link.id, key: link.key });
  return link;
}
