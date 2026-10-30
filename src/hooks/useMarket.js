import { useEffect, useState } from 'react';
import { capability } from '../lib/runtime.js';
import { INDEX_DOC, feedDoc } from '../lib/market.js';

/**
 * One document the morning run keeps. On the hosted Claude page it's the
 * copy the run saves to the owner's private space in the page's database;
 * on the public website it's the copy published with the site, under
 * /data/ from the site root (so the app finds it under /app/ too). 'local'
 * means neither is available.
 * status: 'checking' | 'local' | 'empty' | 'ready' | 'error'
 */
function useRunDoc(doc, isValid) {
  const [state, setState] = useState({ status: 'checking', feed: null, doc });

  useEffect(() => {
    let dead = false;
    let unsub = null;
    setState({ status: 'checking', feed: null, doc });
    (async () => {
      const [db, user] = await Promise.all([capability('db'), capability('user')]);
      const uid = db && user ? await Promise.resolve(user.id()).catch(() => null) : null;
      if (dead) return;
      if (!uid) {
        try {
          const res = await fetch(`/data/${doc}.json`, { cache: 'no-cache' });
          const feed = res.ok ? await res.json().catch(() => null) : null;
          // A city the run hasn't reached yet has no file (or the site's fallback page): empty, not broken.
          if (!dead) setState(isValid(feed) ? { status: 'ready', feed, doc } : { status: res.ok || res.status === 404 ? 'empty' : 'local', feed: null, doc });
        } catch {
          if (!dead) setState({ status: 'local', feed: null, doc });
        }
        return;
      }
      try {
        unsub = db.doc(`data/users/${uid}/${doc}`).onSnapshot(
          (snap) => !dead && setState(snap.exists ? { status: 'ready', feed: snap.data(), doc } : { status: 'empty', feed: null, doc }),
          () => !dead && setState((s) => ({ ...s, status: 'error' })),
        );
      } catch {
        setState({ status: 'error', feed: null, doc });
      }
    })();
    return () => {
      dead = true;
      unsub?.();
    };
  }, [doc, isValid]);

  // Until the effect catches up with a new city, say it's loading rather than show the last city's list.
  return state.doc === doc ? state : { status: 'checking', feed: null, doc };
}

const isFeed = (f) => Array.isArray(f?.listings);
const isIndex = (f) => !!f?.cities && typeof f.cities === 'object';

/** The daily listings feed for one city. */
export const useMarket = (cityKey) => useRunDoc(feedDoc(cityKey), isFeed);

/** Every city's feed at a glance: { cities: { key: { date, count } } }. */
export const useMarketIndex = () => useRunDoc(INDEX_DOC, isIndex);
