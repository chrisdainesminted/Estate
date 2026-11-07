// Pictures of a listed house that Squarely may show: Google Street View of
// the address and a satellite view of the lot, through Google's Static APIs
// with the site's browser key. Photos from listing sites belong to their
// brokerages and photographers, so Squarely links to them instead.

const STREET = 'https://maps.googleapis.com/maps/api/streetview';
const STATIC = 'https://maps.googleapis.com/maps/api/staticmap';

/** "230 Brodie Street N, Thunder Bay, ON": what Google looks up. */
export function photoPlace(address, place) {
  const a = String(address || '').trim();
  if (!a) return '';
  const city = place?.name && !/^Elsewhere in /.test(place.name) && !a.toLowerCase().includes(place.name.toLowerCase()) ? `, ${place.name}` : '';
  return `${a}${city}${place?.province ? `, ${place.province}` : ''}`;
}

/**
 * The image URL for a house: kind 'street' (the front, from the road) or
 * 'satellite' (the lot from above). Null without a key or an address.
 * Street View answers 404 where it has no picture, so the image falls back.
 */
export function photoUrl({ kind = 'street', where, key, width = 640, height = 400 }) {
  if (!key || !where) return null;
  const size = `${Math.min(Math.round(width), 640)}x${Math.min(Math.round(height), 640)}`;
  const q = new URLSearchParams(
    kind === 'satellite'
      ? { center: where, zoom: '19', size, maptype: 'satellite', scale: '2', key }
      : { location: where, size, fov: '80', source: 'outdoor', return_error_code: 'true', key },
  );
  return `${kind === 'satellite' ? STATIC : STREET}?${q}`;
}
