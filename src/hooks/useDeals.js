import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DEAL, MAX_COMPARE, makeDeal, switchRules } from '../lib/presets.js';
import { guessCity } from '../lib/canada.js';
import { capability } from '../lib/runtime.js';
import { accountLink, accountRef } from '../lib/account.js';
import { cleanAlert } from '../../worker/account.js';
import { DEFAULT_TARGETS, DEFAULT_TAX, OWN_DOWN_PCT } from '../lib/finance.js';
import { DEFAULT_PLAN } from '../lib/growth.js';
import { DEFAULT_MARKET, normalizeMarket } from '../lib/market.js';
import { DEFAULT_PROFILE, normalizeProfile } from '../lib/firstHome.js';
import { DEFAULT_SUITE, normalizeSuite } from '../lib/suites.js';

// Per-library settings that travel with the deals: offer targets, the growth
// plan, tax inputs, the assumptions used to underwrite daily listings, your
// first-home numbers and your progress on adding a suite.
const DEFAULT_SETTINGS = { targets: DEFAULT_TARGETS, plan: DEFAULT_PLAN, tax: DEFAULT_TAX, market: DEFAULT_MARKET, home: DEFAULT_PROFILE, suite: DEFAULT_SUITE, ready: {}, rvb: {}, alerts: [] };

function normalizeSettings(s) {
  return {
    targets: { ...DEFAULT_TARGETS, ...(s?.targets ?? {}) },
    plan: { ...DEFAULT_PLAN, ...(s?.plan ?? {}) },
    tax: { ...DEFAULT_TAX, ...(s?.tax ?? {}) },
    market: normalizeMarket(s?.market),
    home: normalizeProfile(s?.home),
    suite: normalizeSuite(s?.suite),
    // The "Am I ready?" checklist: step id → true once done.
    ready: Object.fromEntries(Object.entries(s?.ready && typeof s.ready === 'object' ? s.ready : {}).filter(([, v]) => v === true)),
    // Rent vs buy: your own growth and return assumptions, if you changed them.
    // Saved listing searches: a city, property types and limits.
    alerts: (Array.isArray(s?.alerts) ? s.alerts : []).slice(0, 10).map((a, i) => (cleanAlert(a, i) ? { ...cleanAlert(a, i), ...(typeof a.seen === 'string' ? { seen: a.seen } : {}) } : null)).filter(Boolean),
    rvb: Object.fromEntries(Object.entries(s?.rvb && typeof s.rvb === 'object' ? s.rvb : {}).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])),
  };
}

const STORAGE_KEY = 'bedrock-library-v2';
const LEGACY_KEY = 'dscr-deals-v1';
const SYNC_DELAY = 700;

// Each compared deal keeps a fixed color slot, so removing one never repaints the others.
function freeSlot(compare) {
  for (let i = 0; i < MAX_COMPARE; i++) if (!compare.some((c) => c.slot === i)) return i;
  return -1;
}

/** One blank property to start from: Canadian rules, in the city this browser's time zone suggests. */
function blankDeal() {
  const m = DEFAULT_MARKET;
  let city;
  try {
    city = guessCity();
  } catch {
    city = undefined;
  }
  return makeDeal({ ...switchRules(DEFAULT_DEAL, 'ca'), ...(city ? { city } : {}), name: 'My first property', downPct: OWN_DOWN_PCT, rate: m.rate, refiRate: m.rate, termYears: m.amortYears });
}

function freshState(updatedAt = 0) {
  const deal = blankDeal();
  return {
    deals: [deal],
    activeId: deal.id,
    compare: [{ id: deal.id, slot: 0 }],
    settings: normalizeSettings(DEFAULT_SETTINGS),
    updatedAt,
  };
}

function normalize(saved, activeId) {
  // Fill in any fields added since the deal was saved.
  // Untouched example deals from older versions are dropped; edited ones were
  // already marked as the person's own.
  const kept = saved.deals.filter((d) => !d.example);
  const deals = (kept.length ? kept : [blankDeal()]).map((d) => {
    const { slot, ...rest } = d; // v1 stored color slots on deals
    return { ...DEFAULT_DEAL, ...rest, id: d.id || makeDeal().id };
  });
  const ids = new Set(deals.map((d) => d.id));
  let compare = Array.isArray(saved.compare) ? saved.compare.filter((c) => ids.has(c.id) && c.slot >= 0 && c.slot < MAX_COMPARE) : null;
  if (!compare) {
    // v1: every deal was compared, using its own slot.
    compare = deals.slice(0, MAX_COMPARE).map((d, i) => ({ id: d.id, slot: Number.isInteger(d.slot) ? d.slot : i }));
  }
  if (!compare.length) compare = [{ id: deals[0].id, slot: 0 }];
  const want = activeId ?? saved.activeId;
  return {
    deals,
    activeId: ids.has(want) ? want : deals[0].id,
    compare: compare.slice(0, MAX_COMPARE),
    settings: normalizeSettings(saved.settings),
    updatedAt: Number(saved.updatedAt) || 0,
  };
}

function loadLocal() {
  try {
    for (const key of [STORAGE_KEY, LEGACY_KEY]) {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Array.isArray(saved.deals) && saved.deals.length > 0) return normalize(saved);
    }
  } catch {
    // Storage blocked or corrupt — fall through to a blank property.
  }
  return freshState();
}

// What goes to the account: the library itself. Which deal is open stays per device.
const toCloud = (s) => ({ version: 2, deals: s.deals, compare: s.compare, settings: s.settings, updatedAt: s.updatedAt });

/**
 * The deal library. Always saved in this browser; in the hosted viewer it
 * also syncs to the viewer's private space in their Claude account, so the
 * same deals appear on every device. The newest edit wins.
 */
export function useDeals() {
  const [state, setState] = useState(loadLocal);
  // 'local' (browser only), 'connecting', 'cloud' (synced to account), 'error'
  const [sync, setSync] = useState('local');
  // A Squarely account (website only): set when this browser has its private link.
  const [account, setAccount] = useState(accountLink);
  // Signing in or out anywhere on the page (or in another tab) switches the sync target.
  useEffect(() => {
    const on = () => setAccount(accountLink());
    window.addEventListener('bedrock-account', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('bedrock-account', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;
  const cloud = useRef(null);
  const syncedAt = useRef(-1);
  const writing = useRef(Promise.resolve());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Non-fatal: the app works without persistence.
    }
  }, [state]);

  // Connect to the account store once, reconcile, then follow other devices.
  useEffect(() => {
    let dead = false;
    let unsub = null;
    (async () => {
      const [db, user] = await Promise.all([capability('db'), capability('user')]);
      if (dead) return;
      let ref;
      if (db && user) {
        const uid = await user.id();
        if (!uid || dead) return;
        try {
          ref = db.doc(`data/users/${uid}/bedrock`);
        } catch {
          return;
        }
      } else if (account) {
        ref = accountRef(account);
      } else {
        setSync('local');
        return;
      }
      setSync('connecting');
      try {
        const snap = await ref.get();
        if (dead) return;
        const remote = snap.exists ? snap.data() : null;
        const local = stateRef.current;
        let preferRemote = false;
        try {
          preferRemote = sessionStorage.getItem('bedrock-prefer-account') === '1';
          sessionStorage.removeItem('bedrock-prefer-account');
        } catch {
          // Newest wins.
        }
        if (remote && Array.isArray(remote.deals) && remote.deals.length && (preferRemote || (Number(remote.updatedAt) || 0) >= local.updatedAt)) {
          syncedAt.current = Number(remote.updatedAt) || 0;
          setState((s) => normalize(remote, s.activeId));
        } else {
          // Nothing saved to the account yet, or this browser has newer edits.
          const body = toCloud({ ...local, updatedAt: Math.max(local.updatedAt, 1) });
          syncedAt.current = body.updatedAt;
          await ref.set(body);
        }
      } catch {
        if (!dead) setSync('error');
        return;
      }
      if (dead) return;
      cloud.current = ref;
      setSync('cloud');
      unsub = ref.onSnapshot(
        (snap) => {
          if (!snap.exists || snap.metadata.hasPendingWrites) return;
          const remote = snap.data();
          const at = Number(remote.updatedAt) || 0;
          if (at > syncedAt.current && at > stateRef.current.updatedAt && Array.isArray(remote.deals) && remote.deals.length) {
            syncedAt.current = at;
            setState((s) => normalize(remote, s.activeId));
          }
        },
        () => setSync('error'),
      );
    })();
    return () => {
      dead = true;
      unsub?.();
      cloud.current = null;
    };
  }, [account]);

  // Push local edits to the account, one write at a time, after typing pauses.
  useEffect(() => {
    if (sync !== 'cloud' || !cloud.current || state.updatedAt <= syncedAt.current) return undefined;
    const t = setTimeout(() => {
      const body = toCloud(stateRef.current);
      syncedAt.current = body.updatedAt;
      writing.current = writing.current.then(() => cloud.current.set(body)).catch(() => setSync('error'));
    }, SYNC_DELAY);
    return () => clearTimeout(t);
  }, [state, sync]);

  // Every library change goes through here so it gets a timestamp for syncing.
  const commit = useCallback((fn) => {
    setState((s) => {
      const next = fn(s);
      return next === s ? s : { ...next, updatedAt: Math.max(Date.now(), s.updatedAt + 1) };
    });
  }, []);

  // Editing an example makes it the user's own; typing real taxes or
  // insurance replaces a quick check's estimates.
  const updateDeal = useCallback(
    (id, patch) =>
      commit((s) => ({
        ...s,
        deals: s.deals.map((d) =>
          d.id === id ? { ...d, ...patch, example: false, ...('taxesAnnual' in patch || 'insuranceAnnual' in patch ? { estimated: false } : {}) } : d,
        ),
      })),
    [commit],
  );

  const updateMany = useCallback(
    (ids, fn) => {
      const set = new Set(ids);
      commit((s) => ({ ...s, deals: s.deals.map((d) => (set.has(d.id) ? { ...d, ...fn(d), example: false } : d)) }));
    },
    [commit],
  );

  // New and duplicated deals open straight away and join Compare if there's room.
  const insert = (s, deal) => {
    const slot = freeSlot(s.compare);
    return {
      ...s,
      deals: [...s.deals, deal],
      activeId: deal.id,
      compare: slot >= 0 ? [...s.compare, { id: deal.id, slot }] : s.compare,
    };
  };

  const addDeal = useCallback(() => commit((s) => insert(s, makeDeal({ name: `Deal ${s.deals.length + 1}` }))), [commit]);

  // A deal built elsewhere (a listing, or a new deal under Canadian rules).
  const insertDeal = useCallback((fields) => commit((s) => insert(s, makeDeal({ name: `Deal ${s.deals.length + 1}`, ...fields }))), [commit]);

  const duplicateDeal = useCallback(
    (id) =>
      commit((s) => {
        const src = s.deals.find((d) => d.id === id);
        return src ? insert(s, makeDeal({ ...src, name: `${src.name} (copy)`, example: false })) : s;
      }),
    [commit],
  );

  const removeDeal = useCallback(
    (id) =>
      commit((s) => {
        if (s.deals.length <= 1) return s;
        const deals = s.deals.filter((d) => d.id !== id);
        return {
          ...s,
          deals,
          activeId: s.activeId === id ? deals[0].id : s.activeId,
          compare: s.compare.filter((c) => c.id !== id),
        };
      }),
    [commit],
  );

  const toggleCompare = useCallback(
    (id) =>
      commit((s) => {
        if (s.compare.some((c) => c.id === id)) return { ...s, compare: s.compare.filter((c) => c.id !== id) };
        const slot = freeSlot(s.compare);
        return slot < 0 ? s : { ...s, compare: [...s.compare, { id, slot }] };
      }),
    [commit],
  );

  // section is 'targets', 'plan', 'tax' or 'market'.
  const updateSettings = useCallback(
    (section, patch) => commit((s) => ({ ...s, settings: { ...s.settings, [section]: { ...s.settings[section], ...patch } } })),
    [commit],
  );

  // Which deal is open is per device, so it doesn't count as a library change.
  const setActive = useCallback((id) => setState((s) => ({ ...s, activeId: id })), []);
  const resetAll = useCallback(() => commit(() => freshState()), [commit]);

  // Undo support: capture the library before a change, put it back later.
  const snapshot = useCallback(() => stateRef.current, []);
  const restore = useCallback((snap) => commit(() => ({ ...snap })), [commit]);

  const active = state.deals.find((d) => d.id === state.activeId) ?? state.deals[0];
  const slotOf = (id) => state.compare.find((c) => c.id === id)?.slot;

  return {
    deals: state.deals,
    active,
    activeId: active.id,
    compare: state.compare,
    slotOf,
    sync,
    settings: state.settings,
    updateSettings,
    account,
    setAccount,
    replaceAlerts: (alerts) => commit((s) => ({ ...s, settings: { ...s.settings, alerts } })),
    updateDeal,
    updateMany,
    addDeal,
    insertDeal,
    duplicateDeal,
    removeDeal,
    toggleCompare,
    setActive,
    resetAll,
    snapshot,
    restore,
  };
}
