// Dates and times for viewings, shown in the viewer's own time zone.

const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
export const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
export const whenLabel = (iso) => `${dayLabel(iso)} at ${timeLabel(iso)}`;
export const dateLabel = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const thisMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Group items with an ISO `start` by local day, in order. */
export function byDay(items) {
  const groups = new Map();
  for (const it of [...items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const k = dayKey(it.start);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, label: dayLabel(list[0].start), list }));
}

/**
 * Viewing slots from an availability block: every `minutes` from `from` to
 * `to` on a local date, as ISO times.
 */
export function slotTimes(dateYmd, from, to, minutes) {
  const out = [];
  const [y, m, d] = dateYmd.split('-').map(Number);
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const step = Math.max(Number(minutes) || 30, 10);
  for (let t = fh * 60 + fm; t + step <= th * 60 + tm; t += step) out.push(new Date(y, m - 1, d, Math.floor(t / 60), t % 60).toISOString());
  return out.slice(0, 48);
}

/** An .ics calendar file for one event. */
export function icsFile({ title, start, minutes = 30, location = '', description = '', uid }) {
  const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
  const end = Date.parse(start) + minutes * 60000;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Squarely//Viewing//EN',
    'BEGIN:VEVENT',
    `UID:${uid || `${stamp(start)}@bedrock`}`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location && `LOCATION:${esc(location)}`,
    description && `DESCRIPTION:${esc(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function downloadIcs(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
