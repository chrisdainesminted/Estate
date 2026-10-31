// Talks to the landlord server at /api (see worker/). The landlord's own
// calls carry the workspace's private key; the public ones (a listing's
// application form, an applicant's status, a tenant's repair form) don't.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function call(path, { method = 'GET', body, key } = {}) {
  let res;
  try {
    const init = { method, headers: key ? { authorization: `Bearer ${key}` } : {} };
    if (body) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Couldn’t reach Bedrock. Check your connection and try again.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON: an error page, or the site without its server (the Claude page).
  }
  if (!res.ok || !data) throw new ApiError(res.status, data?.error || 'Something went wrong. Try again.');
  return data;
}

/** The landlord's workspace, from this browser: { id, key } or null. */
const WS_KEY = 'bedrock-landlord';
export function savedWorkspace() {
  try {
    const w = JSON.parse(localStorage.getItem(WS_KEY) || 'null');
    return w?.id && w?.key ? w : null;
  } catch {
    return null;
  }
}
export function saveWorkspace(w) {
  try {
    if (w) localStorage.setItem(WS_KEY, JSON.stringify({ id: w.id, key: w.key }));
    else localStorage.removeItem(WS_KEY);
  } catch {
    // Without storage the workspace lasts for this visit; the private link brings it back.
  }
}

/** Links built from a workspace. Tokens ride in the #fragment, which never reaches a server log. */
export const links = {
  origin: () => (typeof location !== 'undefined' && /^https?:/.test(location.origin) ? location.origin : 'https://bedrock.signia83.workers.dev'),
  apply: (ws, listingId) => `${links.origin()}/listing/#w=${ws}&l=${listingId}`,
  status: (ws, token) => `${links.origin()}/rent/#w=${ws}&s=${token}`,
  repair: (ws, unit) => `${links.origin()}/rent/#w=${ws}&u=${unit.id}&t=${unit.repairToken}`,
  // The same tenant link, opening on paying rent.
  pay: (ws, unit) => `${links.origin()}/rent/#w=${ws}&u=${unit.id}&t=${unit.repairToken}&v=pay`,
  private: (w) => `${links.origin()}/app/?view=landlord#landlord=${w.id}.${w.key}`,
};

/** "#a=1&b=2" as an object. */
export function hashParams(hash) {
  return Object.fromEntries(new URLSearchParams(String(hash || '').replace(/^#/, '')));
}
