import { useEffect, useState } from 'react';
import { Home, Satellite } from 'lucide-react';
import { photoPlace, photoUrl } from '../lib/photos.js';
import { siteConfig } from '../lib/siteConfig.js';

// The site's Google Maps browser key, asked for once per page load. None on
// the Claude page or before the owner adds one: houses show a drawn
// placeholder instead.
let keyPromise = null;
function loadKey() {
  if (!keyPromise) keyPromise = siteConfig().then((c) => String(c.mapsKey || ''));
  return keyPromise;
}

export function useMapsKey() {
  const [key, setKey] = useState('');
  useEffect(() => {
    let live = true;
    loadKey().then((k) => live && setKey(k));
    return () => {
      live = false;
    };
  }, []);
  return key;
}

/**
 * A picture of the house: Street View of its front (kind "street") or the
 * lot from above (kind "satellite"). Falls back to a quiet drawn placeholder
 * when there's no key, no address or no picture there. `label` says what the
 * placeholder stands for; `children` sit on top (badges).
 */
export default function HousePhoto({ address, place, kind = 'street', width = 640, height = 400, className = '', label, iconSize = 'size-8', children }) {
  const key = useMapsKey();
  const where = photoPlace(address, place);
  const src = photoUrl({ kind, where, key, width, height });
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const Icon = kind === 'satellite' ? Satellite : Home;
  const show = src && !failed;
  return (
    <div className={`relative overflow-hidden bg-zinc-100 dark:bg-[#17191a] ${className}`}>
      {show ? (
        <img
          src={src}
          alt={kind === 'satellite' ? `Satellite view of ${address}` : `Street view of ${address}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-600" aria-hidden={!label}>
          <Icon className={iconSize} strokeWidth={1.4} aria-hidden />
          {label && <span className="px-3 text-center text-[11px] text-zinc-500 dark:text-zinc-500">{label}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
