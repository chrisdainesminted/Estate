// The landlord's sums and words: whether each unit's rent is in, the year's
// rental income laid out like the CRA's form T776, when rent can next go up,
// and the reply templates the landlord sends from their own email or phone.

import { T776 } from '../../worker/schema.js';
import { rulesFor } from './tenancyRules.js';
import { money } from './format.js';
import { dateLabel, thisMonth, today, whenLabel } from './when.js';

export { T776 };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const plain = (s) => String(s).replace(/\u2060/g, '');
// Ends a sentence with a period, unless it already ends in one (“5:00 p.m.”).
const stop = (s) => (s.endsWith('.') ? s : `${s}.`);

/**
 * This month's rent for a unit: paid, partly paid, due (before or on the due
 * day) or late (after it). `on` is today's date, YYYY-MM-DD.
 */
export function rentStatus(unit, payments, on = today()) {
  const month = on.slice(0, 7);
  const rent = num(unit.rent);
  const paid = payments.filter((p) => p.unitId === unit.id && p.month === month).reduce((s, p) => s + num(p.amount), 0);
  const due = Math.min(Math.max(Math.round(num(unit.dueDay) || 1), 1), 28);
  const day = Number(on.slice(8, 10));
  const owing = Math.max(rent - paid, 0);
  const state = rent <= 0 ? 'none' : owing === 0 ? 'paid' : day > due ? (paid > 0 ? 'partial' : 'late') : paid > 0 ? 'partial' : 'due';
  return { month, rent, paid, owing, dueDay: due, state };
}

/** The year's rental income and expenses, by T776 line, from payments and logged expenses. */
export function yearSummary(payments, expenses, year) {
  const y = String(year);
  const gross = payments.filter((p) => String(p.month || '').startsWith(y)).reduce((s, p) => s + num(p.amount), 0);
  const lines = T776.map((c) => ({ ...c, amount: expenses.filter((e) => e.category === c.key && String(e.date || '').startsWith(y)).reduce((s, e) => s + num(e.amount), 0) }));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { year: y, gross, lines, total, net: gross - total };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;

/** The year's records as a CSV an accountant can open. */
export function yearCsv(summary, payments, expenses, units) {
  const unitName = (id) => units.find((u) => u.id === id)?.label || '';
  const y = summary.year;
  return toCsv([
    [`Rental income ${y}`, '', '', ''],
    ['T776 line', 'Item', 'Amount', ''],
    ['8141', 'Gross rents', summary.gross.toFixed(2), ''],
    ...summary.lines.filter((l) => l.amount).map((l) => [l.line, l.label, l.amount.toFixed(2), '']),
    ['9369', 'Net income (loss) before capital cost allowance', summary.net.toFixed(2), ''],
    [],
    ['Rent received', '', '', ''],
    ['Month', 'Unit', 'Amount', 'Paid on'],
    ...payments.filter((p) => String(p.month).startsWith(y)).map((p) => [p.month, unitName(p.unitId), num(p.amount).toFixed(2), p.paidOn || '']),
    [],
    ['Expenses', '', '', ''],
    ['Date', 'T776 line', 'Amount', 'Vendor / note'],
    ...expenses.filter((e) => String(e.date).startsWith(y)).map((e) => [e.date, T776.find((c) => c.key === e.category)?.line || '', num(e.amount).toFixed(2), [e.vendor, e.note, unitName(e.unitId)].filter(Boolean).join(' · ')]),
  ]);
}

const addMonths = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(y, m - 1 + n, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * When a unit's rent can next go up, and by how much: no sooner than the
 * gap after the last increase (or the lease start), and no sooner than the
 * notice period from today.
 */
export function nextIncrease(unit, province, on = today()) {
  const r = rulesFor(province);
  const since = unit.lastIncrease || unit.leaseStart;
  const earliestByGap = since ? addMonths(since, province === 'SK' && !unit.lastIncrease ? 18 : r.gapMonths) : on;
  const earliestByNotice = addDays(on, r.noticeDays);
  const date = earliestByGap > earliestByNotice ? earliestByGap : earliestByNotice;
  const noticeBy = addDays(date, -r.noticeDays);
  const rent = num(unit.rent);
  return { date, noticeBy: noticeBy < on ? on : noticeBy, cap: r.cap, newRent: r.cap == null ? null : Math.floor(rent * (1 + r.cap / 100)), rules: r };
}

/** Days until a date (negative once it's passed). */
export const daysUntil = (ymd, on = today()) => Math.round((Date.parse(`${ymd}T12:00:00`) - Date.parse(`${on}T12:00:00`)) / 86400000);

// ---- reply templates ----

const sign = (s) => `\n\n${s.signature || s.name || ''}`.trimEnd();
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/**
 * The replies a landlord can send an applicant, filled in. Each is
 * { key, label, status (what the application becomes), subject, body }.
 */
export function applicationReplies({ app, listing, slot, settings, statusLink, openTimes = [] }) {
  const title = listing?.title || 'the rental';
  const hi = `Hi ${first(app.name)},`;
  const times = openTimes.slice(0, 6).map((t) => `- ${whenLabel(t.start)}`).join('\n');
  const out = [];
  if (slot)
    out.push({
      key: 'confirm',
      label: 'Confirm the viewing',
      status: 'viewing',
      subject: `Viewing confirmed: ${title}`,
      body: `${hi}\n\nThanks for applying for ${title}. ${stop(`Your viewing is confirmed for ${whenLabel(slot.start)}${listing?.address ? ` at ${listing.address}` : ''}`)}\n\nIf anything changes, you can pick another time or cancel here: ${statusLink}${sign(settings)}`,
      note: stop(`See you ${whenLabel(slot.start)}`),
    });
  out.push({
    key: 'times',
    label: slot ? 'Ask for a different time' : 'Offer viewing times',
    status: 'new',
    subject: `Viewing times for ${title}`,
    body: `${hi}\n\nThanks for your interest in ${title}.${slot ? ' That time no longer works on my end, sorry.' : ''} ${times ? `These times are open:\n\n${times}\n\nPick` : 'Pick'} one that suits you here: ${statusLink}${sign(settings)}`,
    note: slot ? 'That time doesn’t work after all. Please pick another one below.' : 'Please pick a viewing time below.',
    releaseSlot: Boolean(slot),
  });
  out.push({
    key: 'approve',
    label: 'Offer the place',
    status: 'approved',
    subject: `${title}: I’d like to offer it to you`,
    body: `${hi}\n\nThanks for coming to see ${title}. I’d like to offer it to you${listing?.rent ? ` at ${plain(money(listing.rent))} a month` : ''}. If you’re still interested, reply and I’ll send the lease and the next steps.${sign(settings)}`,
    note: 'I’d like to offer you the place. I’ll be in touch about the lease.',
  });
  out.push({
    key: 'decline',
    label: 'Decline politely',
    status: 'declined',
    subject: `About ${title}`,
    body: `${hi}\n\nThank you for applying for ${title}. I’ve decided to go ahead with another applicant, so it’s no longer available. I wish you the best with your search.${sign(settings)}`,
    note: 'Thank you for applying. The place is no longer available.',
  });
  return out;
}

/** A friendly rent reminder for a unit's tenant. */
export function rentReminder({ unit, status, settings }) {
  const month = new Date(`${status.month}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long' });
  return {
    subject: `Rent for ${month}`,
    body: `Hi ${first(unit.tenantName)},\n\nA quick reminder that ${month}’s rent of ${plain(money(status.owing))}${status.paid ? ` (the rest of ${plain(money(status.rent))})` : ''} ${status.state === 'late' ? `was due on the ${ordinal(status.dueDay)}` : `is due on the ${ordinal(status.dueDay)}`}. If you’ve already sent it, thank you, and please ignore this.${sign(settings)}`,
  };
}

/** The repair link, sent to a tenant. */
export function repairInvite({ unit, settings, link }) {
  return {
    subject: 'Reporting repairs',
    body: `Hi ${first(unit.tenantName)},\n\nIf anything in your unit needs fixing, you can report it any time here: ${link}\n\nIt comes straight to me. For a fire, gas smell or anything dangerous, call 911 first; for a flood or no heat, also phone me right away.${sign(settings)}`,
  };
}

/** A repair update to the tenant who reported it. */
export function repairUpdate({ ticket, settings }) {
  const when = ticket.scheduledFor ? whenLabel(ticket.scheduledFor) : null;
  const body =
    ticket.status === 'fixed'
      ? `The repair you reported (${ticket.title}) is done${ticket.fixedOn ? ` as of ${dateLabel(ticket.fixedOn)}` : ''}. Let me know if anything isn’t right.`
      : when
        ? `About the repair you reported (${ticket.title}): ${stop(`it’s booked for ${when}`)} ${ticket.entryOk ? 'You said it’s fine to go in if you’re not home.' : 'Please let me know if that time doesn’t work.'}`
        : `Thanks for reporting ${ticket.title}. I’m on it and will let you know when it’s booked.`;
  return { subject: `Repair: ${ticket.title}`, body: `Hi ${first(ticket.reportedBy)},\n\n${body}${sign(settings)}` };
}

const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** mailto: and sms: links for a message. */
export const mailto = (to, { subject, body }) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const smsto = (to, { body }) => `sms:${encodeURIComponent((to || '').replace(/[^\d+]/g, ''))}?&body=${encodeURIComponent(body)}`;

export { thisMonth, today };
