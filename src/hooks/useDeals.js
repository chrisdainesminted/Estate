import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_DEAL, MAX_DEALS, PRESET_DEALS, makeDeal } from '../lib/presets.js';

const STORAGE_KEY = 'dscr-deals-v1';

// Each deal keeps a fixed color slot so removing one never repaints the others.
function freeSlot(deals) {
  for (let i = 0; i < MAX_DEALS; i++) if (!deals.some((d) => d.slot === i)) return i;
  return 0;
}

function freshState() {
  const deals = PRESET_DEALS.map((d, i) => makeDeal({ ...d, slot: i }));
  return { deals, activeId: deals[0].id };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.deals) && saved.deals.length > 0) {
      // Fill in any fields added since the deal was saved.
      const deals = saved.deals.slice(0, MAX_DEALS).map((d, i) => ({
        ...DEFAULT_DEAL,
        ...d,
        id: d.id || makeDeal().id,
        slot: Number.isInteger(d.slot) && d.slot >= 0 && d.slot < MAX_DEALS ? d.slot : i,
      }));
      const activeId = deals.some((d) => d.id === saved.activeId) ? saved.activeId : deals[0].id;
      return { deals, activeId };
    }
  } catch {
    // Storage blocked or corrupt — fall through to presets.
  }
  return freshState();
}

export function useDeals() {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Non-fatal: the app works without persistence.
    }
  }, [state]);

  const updateDeal = useCallback((id, patch) => {
    setState((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }, []);

  const updateAll = useCallback((fn) => {
    setState((s) => ({ ...s, deals: s.deals.map((d) => ({ ...d, ...fn(d) })) }));
  }, []);

  const addDeal = useCallback(() => {
    setState((s) => {
      if (s.deals.length >= MAX_DEALS) return s;
      const deal = makeDeal({ name: `Deal ${s.deals.length + 1}`, slot: freeSlot(s.deals) });
      return { deals: [...s.deals, deal], activeId: deal.id };
    });
  }, []);

  const duplicateDeal = useCallback((id) => {
    setState((s) => {
      const src = s.deals.find((d) => d.id === id);
      if (!src || s.deals.length >= MAX_DEALS) return s;
      const copy = makeDeal({ ...src, name: `${src.name} (copy)`, slot: freeSlot(s.deals) });
      return { deals: [...s.deals, copy], activeId: copy.id };
    });
  }, []);

  const removeDeal = useCallback((id) => {
    setState((s) => {
      if (s.deals.length <= 1) return s;
      const deals = s.deals.filter((d) => d.id !== id);
      const activeId = s.activeId === id ? deals[0].id : s.activeId;
      return { deals, activeId };
    });
  }, []);

  const setActive = useCallback((id) => setState((s) => ({ ...s, activeId: id })), []);
  const resetAll = useCallback(() => setState(freshState()), []);

  const active = state.deals.find((d) => d.id === state.activeId) ?? state.deals[0];

  return {
    deals: state.deals,
    active,
    activeId: active.id,
    updateDeal,
    updateAll,
    addDeal,
    duplicateDeal,
    removeDeal,
    setActive,
    resetAll,
  };
}
