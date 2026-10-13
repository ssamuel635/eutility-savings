// Display formatting. Dates are always shown in Singapore time.

import { fmtMoney } from '@/engine';

const TZ = 'Asia/Singapore';

export const money = (n: number, dp = 0) => fmtMoney(n, dp);

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-GB', { ...opts, timeZone: TZ });
  } catch {
    return d.toLocaleDateString('en-GB', opts);
  }
}

/** "7 Oct" */
export const shortDate = (iso: string) => fmt(iso, { day: 'numeric', month: 'short' });
/** "7 October 2026" */
export const longDate = (iso: string) => fmt(iso, { day: 'numeric', month: 'long', year: 'numeric' });
/** "2026-09" → "September 2026" */
export const monthLabel = (ym: string) => fmt(`${ym}-15T12:00:00+08:00`, { month: 'long', year: 'numeric' });

/** "Just now", "3 hours ago", "2 days ago", else "7 Oct". */
export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return shortDate(iso);
}

/** Hour of day in Singapore, whatever the phone's timezone. */
function sgHour() {
  return Number(new Date(Date.now() + 8 * 3600_000).toISOString().slice(11, 13));
}

export function greeting() {
  const h = sgHour();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || '';

/** "+6591234567" → "9123 4567" */
export const displayPhone = (p: string) => p.replace(/^\+65/, '').replace(/(\d{4})(\d{4})/, '$1 $2');

/** Last n months as { value: "2026-09", label: "September 2026" }, newest first. */
export function recentMonths(n = 6) {
  const out: { value: string; label: string }[] = [];
  const sg = new Date(Date.now() + 8 * 3600_000);
  let y = sg.getUTCFullYear();
  let m = sg.getUTCMonth() + 1;
  for (let i = 0; i < n; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ value, label: monthLabel(value) });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}
