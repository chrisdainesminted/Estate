// The profile dashboard: what you own added up (value, debt, equity, cash
// flow), your tenants at a glance, and messages to them filled in and ready
// to send from your own email or phone.

import { estimateToday, portfolioSummary, positionAt } from './finance.js';
import { daysUntil, rentReminder, rentStatus, repairUpdate, today } from './landlord.js';
import { money } from './format.js';

/**
 * Every property you own, as of today, with the totals. `items` are
 * { deal, a } for deals marked owned. Rows are sorted by equity, largest first.
 */
export function equitySummary(items) {
  const list = Array.isArray(items) ? items : [];
  const totals = portfolioSummary(list);
  const rows = list
    .map(({ deal, a }) => {
      const now = estimateToday(deal);
      return {
        id: deal.id,
        name: deal.name || 'Property',
        address: deal.address || '',
        units: a.units,
        value: now.value,
        balance: now.balance,
        equity: now.value - now.balance,
        equityPct: now.value > 0 ? (now.value - now.balance) / now.value : 0,
        cashFlow: now.netCashFlow,
        rent: a.grossRent,
      };
    })
    .sort((x, y) => y.equity - x.equity);
  return { totals, rows };
}

/** Repairs still open: reported or booked, not yet fixed. */
const openRepair = (m) => m.status !== 'fixed';

/**
 * Each unit with a tenant: rent this month, open repairs, a rent payment the
 * tenant says they've sent, and days left on the lease. Units nobody rents
 * are counted as vacant. Late rent first, then due, then the rest.
 */
export function tenantsOf(data, on = today()) {
  const units = Array.isArray(data?.units) ? data.units : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const repairs = Array.isArray(data?.maintenance) ? data.maintenance : [];
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const ORDER = { late: 0, partial: 1, due: 2, paid: 3, none: 4 };
  const rows = units
    .filter((u) => String(u.tenantName || '').trim())
    .map((unit) => {
      const status = rentStatus(unit, payments, on);
      const open = repairs.filter((m) => m.unitId === unit.id && openRepair(m));
      return {
        unit,
        status,
        repairs: open,
        urgent: open.some((m) => m.urgency === 'urgent'),
        claim: claims.find((c) => c.unitId === unit.id && c.status === 'pending') ?? null,
        leaseDays: unit.leaseEnd ? daysUntil(unit.leaseEnd, on) : null,
      };
    })
    .sort((x, y) => Number(y.urgent) - Number(x.urgent) || ORDER[x.status.state] - ORDER[y.status.state] || String(x.unit.label).localeCompare(String(y.unit.label)));
  return { rows, vacant: units.length - rows.length };
}

/** What needs you across the workspace, counted. */
export function landlordAlerts(data, on = today()) {
  const { rows, vacant } = tenantsOf(data, on);
  const apps = Array.isArray(data?.applications) ? data.applications : [];
  const msgs = Array.isArray(data?.messages) ? data.messages : [];
  return {
    tenants: rows.length,
    vacant,
    late: rows.filter((r) => r.status.state === 'late' || r.status.state === 'partial').length,
    owing: rows.reduce((s, r) => s + (r.status.state === 'late' || r.status.state === 'partial' ? r.status.owing : 0), 0),
    collected: rows.reduce((s, r) => s + r.status.paid, 0),
    rentRoll: rows.reduce((s, r) => s + r.status.rent, 0),
    repairs: rows.reduce((s, r) => s + r.repairs.length, 0),
    urgent: rows.filter((r) => r.urgent).length,
    claims: rows.filter((r) => r.claim).length,
    leasesEnding: rows.filter((r) => r.leaseDays != null && r.leaseDays >= 0 && r.leaseDays <= 90).length,
    newApplications: apps.filter((a) => !a.read).length,
    unreadMessages: msgs.filter((m) => m.from === 'applicant' && !m.read).length,
  };
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
const sign = (s) => `\n\n${s?.signature || s?.name || ''}`.trimEnd();
const plain = (s) => String(s).replace(/−/g, '-');

/**
 * Messages to one tenant, filled in from what's happening with their unit.
 * Each is { key, label, subject, body }; the most useful comes first. The
 * landlord edits any of them before it goes out from their own email or phone.
 */
export function tenantMessages({ unit, status, repairs = [], leaseDays = null, settings = {}, entryRule = '' }) {
  const hi = `Hi ${first(unit.tenantName)},\n\n`;
  const out = [];
  if (status && status.owing > 0 && (status.state === 'late' || status.state === 'partial' || status.state === 'due')) {
    out.push({ key: 'rent', label: status.state === 'due' ? 'Rent reminder' : 'Rent is late', ...rentReminder({ unit, status, settings }) });
  }
  if (status && status.state === 'paid') {
    const month = new Date(`${status.month}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long' });
    out.push({ key: 'thanks', label: 'Rent received', subject: `Rent for ${month} received`, body: `${hi}Thanks, ${month}’s rent of ${plain(money(status.paid))} came in.${sign(settings)}` });
  }
  for (const ticket of repairs.slice(0, 3)) {
    const m = repairUpdate({ ticket: { ...ticket, reportedBy: ticket.reportedBy || unit.tenantName }, settings });
    out.push({ key: `repair-${ticket.id}`, label: `Repair: ${ticket.title}`, ...m });
  }
  out.push({
    key: 'entry',
    label: 'Notice to enter',
    subject: 'Notice to enter your unit',
    body: `${hi}This is notice that I’ll need to enter your unit${unit.label ? ` (${unit.label})` : ''} on [day and date], between [time] and [time], to [reason].${entryRule ? `\n\n(${entryRule})` : ''}\n\nPlease let me know if you have any questions.${sign(settings)}`,
  });
  if (leaseDays != null && leaseDays >= 0 && leaseDays <= 120) {
    out.push({
      key: 'lease',
      label: 'Lease is ending',
      subject: 'Your lease',
      body: `${hi}Your lease ends on ${unit.leaseEnd}. Are you planning to stay on? Let me know and we can sort out what comes next.${sign(settings)}`,
    });
  }
  out.push({ key: 'note', label: 'A quick note', subject: 'A quick note', body: `${hi}${sign(settings) ? `\n${sign(settings)}` : ''}` });
  return out;
}

/** One email to every tenant at once, their addresses in Bcc so no one sees the others'. */
export function everyoneMailto(rows, { subject = 'A note for all tenants', body = '' } = {}) {
  const emails = [...new Set(rows.map((r) => String(r.unit.tenantEmail || '').trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!emails.length) return null;
  return `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** A tel: link, or null without a usable number. */
export function telLink(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  return d.replace(/\D/g, '').length >= 7 ? `tel:${d}` : null;
}

export const initials = (text) =>
  String(text || '')
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'S';

/**
 * Equity a year at a time from today for each owned property and in total:
 * { total: [today, year 1, …], each: Map(id → [...]) }. Values grow and loans
 * pay down the way each deal's own numbers say.
 */
export function projectedEquity(items, years = 10) {
  const list = Array.isArray(items) ? items : [];
  const each = new Map();
  const total = Array(years + 1).fill(0);
  for (const { deal } of list) {
    const age = Math.round(Math.max(Number(deal.yearsOwned) || 0, 0) * 12);
    const path = Array.from({ length: years + 1 }, (_, k) => Math.round(positionAt(deal, age + k * 12).equity));
    each.set(deal.id, path);
    path.forEach((v, k) => (total[k] += v));
  }
  return { total, each };
}
