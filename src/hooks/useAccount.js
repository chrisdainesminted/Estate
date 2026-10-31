import { useCallback, useEffect, useRef, useState } from 'react';
import { accountCall, accountLink } from '../lib/account.js';

/**
 * The signed-in account on any page: its link, everything saved to it, and
 * a way to change one section (profile, saved, applications, tenancies,
 * workspaces). Changes show at once and are saved in the background.
 * status: 'none' (signed out) | 'loading' | 'ready' | 'error'
 */
/** Every list and the profile present, whatever the server sent back. */
const LISTS = ['saved', 'applications', 'tenancies', 'workspaces', 'alerts'];
function complete(d) {
  const out = d && typeof d === 'object' ? { ...d } : {};
  for (const k of LISTS) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.profile || typeof out.profile !== 'object') out.profile = {};
  return out;
}

export function useAccount() {
  const [link, setLink] = useState(accountLink);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(link ? 'loading' : 'none');
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const on = () => setLink(accountLink());
    window.addEventListener('bedrock-account', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('bedrock-account', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const reload = useCallback(async () => {
    if (!link) {
      setData(null);
      setStatus('none');
      return;
    }
    setStatus('loading');
    try {
      setData(complete(await accountCall(link)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [link]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Change one section with fn(current) → next; saved in the background. */
  const update = useCallback(
    async (name, fn) => {
      if (!link || !dataRef.current) return null;
      const next = fn(dataRef.current[name]);
      setData((d) => ({ ...d, [name]: next }));
      const saved = await accountCall(link, `/s/${name}`, { method: 'PUT', body: { value: next } });
      setData((d) => ({ ...d, [name]: saved[name] }));
      return saved[name];
    },
    [link],
  );

  return { link, data, status, update, reload };
}
