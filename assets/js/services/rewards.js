// Rewards / referral service.
// SAMPLE DATA: the leaderboard, activity and counters below are made up so the
// screen can be reviewed. Reward amounts and qualifying rules are deliberately
// left blank until Eutility confirms them. Swap these functions for API calls later.

import { store, uid } from './store.js';
import { CONFIG } from '../config.js';
import * as customer from './customer.js';

const CODE = 'referral-code';

export function myCode() {
  const c = customer.get();
  if (c?.referralCode) return c.referralCode;
  let code = store.read(CODE);
  if (!code) { code = uid(6); store.write(CODE, code); }
  return code;
}

export function myLink() {
  const host = CONFIG.referralHost || (typeof location !== 'undefined' ? location.host : 'eutility-savings.vercel.app');
  const scheme = CONFIG.referralHost || (typeof location !== 'undefined' && location.protocol === 'https:') ? 'https' : 'http';
  return `${scheme}://${host}/r/${myCode()}`;
}

/** SAMPLE: what the signed-in member has done so far. */
export function myStatus() {
  const raw = store.read('referral-status', null);
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : d);
  const s = { shared: n(raw?.shared, 5), switched: n(raw?.switched, 3) };
  const target = CONFIG.rewards.nextRewardAt;
  return {
    ...s,
    sample: true,
    target,
    toNext: Math.max(0, target - s.switched),
    progressPct: Math.min(100, Math.round((s.switched / target) * 100)),
  };
}

/** SAMPLE: this month's top referrers, with the member slotted in. */
export function leaderboard() {
  const me = myStatus();
  const name = customer.firstName() || 'You';
  const rows = [
    { name: 'Siti', switches: 12 },
    { name: 'Daniel', switches: 9 },
    { name: 'Marcus', switches: 7 },
    { name: 'Wei Ling', switches: 6 },
    { name, switches: me.switched, isMe: true },
    { name: 'Aravind', switches: 2 },
  ].sort((a, b) => b.switches - a.switches);
  return rows.map((r, i) => ({ ...r, rank: i + 1, sample: !r.isMe }));
}

/** SAMPLE: recent activity feed. */
export function activity() {
  return [
    { at: '2 days ago', text: 'Your friend checked their savings', icon: 'chat' },
    { at: '1 week ago', text: 'A referral switched and counted towards your next reward', icon: 'trophy' },
    { at: '2 weeks ago', text: 'You shared your link on WhatsApp', icon: 'gift' },
  ];
}

export function monthLabel() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
}
