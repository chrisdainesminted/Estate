import { useEffect, useMemo, useState } from 'react';

/**
 * Map points for a city's listings, from the site's /api/geo (OpenStreetMap,
 * cached on the server, a few new addresses at a time). Returns a Map of
 * listing id → [lat, lng] that fills in as addresses are found. Off the
 * Squarely website (the Claude page) there's no /api/geo: it stays empty and
 * callers fall back to the whole city.
 */
export function useListingPoints(listings, cityName) {
  const [points, setPoints] = useState(() => new Map());
  const wanted = useMemo(() => (listings ?? []).filter((l) => l?.address).map((l) => ({ id: l.id, q: `${l.address}, ${cityName}` })), [listings, cityName]);
  const key = wanted.map((w) => w.id).join(',');

  useEffect(() => {
    if (!wanted.length || typeof fetch === 'undefined') return undefined;
    let dead = false;
    (async () => {
      for (let round = 0; round < 30 && !dead; round++) {
        try {
          const res = await fetch('/api/geo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries: wanted.map((w) => w.q) }) });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.points || dead) return;
          setPoints(new Map(wanted.filter((w) => data.points[w.q]).map((w) => [w.id, data.points[w.q]])));
          if (!data.pending) return;
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          return;
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return points;
}
