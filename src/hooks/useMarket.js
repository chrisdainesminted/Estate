import { useEffect, useState } from 'react';
import { capability } from '../lib/runtime.js';
import { MARKET } from '../lib/market.js';

/**
 * The daily listings feed the morning run saves to the owner's private
 * space in the page's database. Only the hosted page has that database;
 * elsewhere the status is 'local'.
 * status: 'checking' | 'local' | 'empty' | 'ready' | 'error'
 */
export function useMarket() {
  const [state, setState] = useState({ status: 'checking', feed: null });

  useEffect(() => {
    let dead = false;
    let unsub = null;
    (async () => {
      const [db, user] = await Promise.all([capability('db'), capability('user')]);
      const uid = db && user ? await Promise.resolve(user.id()).catch(() => null) : null;
      if (dead) return;
      if (!uid) {
        setState({ status: 'local', feed: null });
        return;
      }
      try {
        unsub = db.doc(`data/users/${uid}/${MARKET.doc}`).onSnapshot(
          (snap) => !dead && setState(snap.exists ? { status: 'ready', feed: snap.data() } : { status: 'empty', feed: null }),
          () => !dead && setState((s) => ({ ...s, status: 'error' })),
        );
      } catch {
        setState({ status: 'error', feed: null });
      }
    })();
    return () => {
      dead = true;
      unsub?.();
    };
  }, []);

  return state;
}
