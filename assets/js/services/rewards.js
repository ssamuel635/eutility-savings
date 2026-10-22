// Rewards / referral service.
// The member's referral code, link and progress. Counts start at zero and stay
// there until the referral backend reports real switches; nothing is made up.
// Reward amounts and qualifying rules are left out until Eutility confirms them.

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

/** What the member has done so far (counted here until the referral backend exists). */
export function myStatus() {
  const raw = store.read('referral-status', null);
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : d);
  const s = { shared: n(raw?.shared, 0), switched: n(raw?.switched, 0) };
  const target = CONFIG.rewards.nextRewardAt;
  const points = s.switched * CONFIG.rewards.pointsPerSwitch;
  const next = catalogue().find((r) => r.points > points) || null;
  return {
    ...s,
    points,
    next,
    nextPct: next ? Math.min(100, Math.round((points / next.points) * 100)) : 100,
    target,
    toNext: Math.max(0, target - s.switched),
    progressPct: Math.min(100, Math.round((s.switched / target) * 100)),
  };
}

export function monthLabel() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
}

/**
 * Bump when photos in assets/img/rewards/ are replaced under the same names:
 * browsers keep images for a week (vercel.json), so a new ?v= makes them
 * fetch the new files straight away.
 */
const PHOTO_VERSION = '20261022';

/** The rewards catalogue (items and points from config), with each photo's path. */
export function catalogue() {
  return CONFIG.rewards.catalogue.map((r) => ({ ...r, src: `assets/img/rewards/${r.img}.jpg?v=${PHOTO_VERSION}` }));
}

export const fmtPts = (n) => `${Number(n).toLocaleString('en-SG')} pts`;
