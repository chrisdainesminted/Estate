import { useEffect, useState } from 'react';
import { capability } from '../lib/runtime.js';
import { MARKET } from '../lib/market.js';

// The copy published beside the public website (public/data/), relative to the page.
// From the site root, so the app finds it under /app/ too.
const WEB_FEED = `/data/${MARKET.doc}.json`;

/**
 * The daily listings feed. On the hosted Claude page it's the copy the
 * morning run saves to the owner's private space in the page's database;
 * on the public website it's the copy published with the site. 'local'
 * means neither is available.
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
        try {
          const res = await fetch(WEB_FEED, { cache: 'no-cache' });
          const feed = res.ok ? await res.json() : null;
          if (!dead) setState(Array.isArray(feed?.listings) ? { status: 'ready', feed } : { status: 'local', feed: null });
        } catch {
          if (!dead) setState({ status: 'local', feed: null });
        }
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
