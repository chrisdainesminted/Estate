const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(v, { cents = false, signed = false } = {}) {
  if (!Number.isFinite(v)) return '—';
  const s = (cents ? usd2 : usd0).format(Math.abs(v));
  // A word joiner (U+2060) keeps the sign on the same line as the amount.
  if (v < 0) return `−\u2060${s}`;
  return signed && v > 0 ? `+\u2060${s}` : s;
}

export function compactMoney(v) {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Fraction → percent string (0.0612 → "6.12%"). */
export function percent(v, digits = 2, { signed = false } = {}) {
  if (!Number.isFinite(v)) return '—';
  const s = `${Math.abs(v * 100).toFixed(digits)}%`;
  if (v < 0) return `−${s}`;
  return signed && v > 0 ? `+${s}` : s;
}

export function ratio(v) {
  if (!Number.isFinite(v)) return '∞';
  return v.toFixed(2);
}

/** A link the page may render: http(s) only, so a pasted javascript: or data: URL never becomes clickable. */
export function safeHttpUrl(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
