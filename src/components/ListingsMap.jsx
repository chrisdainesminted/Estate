import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { money } from '../lib/format.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The listings on a map. Addresses become points through the site's /api/geo,
 * which remembers each one, so the first visit to a city fills in a few at a
 * time. Green dots make money each month (per door); grey ones don't.
 */
export default function ListingsMap({ items, place, homes }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [state, setState] = useState({ status: 'loading', shown: 0, pending: 0 });
  const where = `${place.name.replace(/^Elsewhere in /, '')}, ${place.province}`;
  // The parent rebuilds its list each render; redraw only when the listings themselves change.
  const latest = useRef({ items, homes });
  latest.current = { items, homes };
  const idsKey = items.map((s) => `${s.listing.id}:${s.perDoor}`).join('|');

  useEffect(() => {
    if (!box.current || map.current) return undefined;
    map.current = L.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView([56, -96], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'map-tiles',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    const { items, homes } = latest.current;
    const queries = items.map((s) => `${s.listing.address}, ${where}`);
    const draw = (points) => {
      layer.current.clearLayers();
      const bounds = [];
      items.forEach((s, i) => {
        const p = points[queries[i]];
        if (!p) return;
        bounds.push(p);
        const good = s.perDoor >= 0;
        const home = homes?.get(s.listing.id);
        L.circleMarker(p, { radius: 8, weight: 2, color: good ? '#059669' : '#71717a', fillColor: good ? '#34d399' : '#a1a1aa', fillOpacity: 0.85 })
          .bindPopup(
            `<strong>${esc(s.listing.address)}</strong><br>${esc(money(s.a.price))} · ${esc(s.a.units)} unit${s.a.units === 1 ? '' : 's'}<br>` +
              `${esc(money(s.perDoor, { signed: true }))}/door a month${home ? `<br>Live in: ${esc(money(home.costToLive))}/mo` : ''}` +
              (s.listing.url ? `<br><a href="${esc(s.listing.url)}" target="_blank" rel="noopener noreferrer">Listing page</a>` : ''),
          )
          .addTo(layer.current);
      });
      if (bounds.length) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      else if (points[where]) map.current.setView(points[where], 11);
      return bounds.length;
    };
    (async () => {
      for (let round = 0; round < 20 && !dead; round++) {
        try {
          const res = await fetch('/api/geo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries: [where, ...queries] }) });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.points) throw new Error(data?.error || 'no map');
          if (dead) return;
          const shown = draw(data.points);
          setState({ status: 'ready', shown, pending: data.pending });
          if (!data.pending) return;
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          if (!dead) setState((s) => (s.status === 'ready' ? s : { status: 'error', shown: 0, pending: 0 }));
          return;
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [idsKey, where]);

  return (
    <div className="relative">
      <div ref={box} className="listing-map h-[28rem] w-full overflow-hidden rounded-md sm:h-[34rem]" role="region" aria-label={`Map of listings in ${where}`} />
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {state.status === 'loading' && 'Placing listings on the map…'}
        {state.status === 'error' && 'The map works on the Bedrock website; it couldn’t load here.'}
        {state.status === 'ready' &&
          `${state.shown} of ${items.length} listings placed${state.pending ? `; finding the rest (${state.pending} to go)…` : '.'} Green dots make money each month per door; grey ones don’t.`}
      </p>
    </div>
  );
}
