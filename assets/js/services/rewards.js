// Eutility Rewards: the referral lucky draw.
// The member's referral code and link, their friends' progress (never named),
// their draws and other customers' success stories.
//
// Nothing is made up for real visitors: until the CRM reports referrals, they
// see empty states. The demo account (or ?sample=1) shows labelled sample data
// so the pages can be reviewed. Sample draws open real sample draw links.

import { store, uid } from './store.js';
import { CONFIG } from '../config.js';
import { compare } from '../calc.js';
import * as customer from './customer.js';
import { drawsEarned, nextBonus } from './draws.js';

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

/** Sample data: for the demo account, or after opening a page with ?sample=1 (until ?sample=0). */
export function sampleMode() {
  try {
    const q = new URLSearchParams(location.search).get('sample');
    if (q === '1') sessionStorage.setItem('eu_sample', '1');
    if (q === '0') sessionStorage.removeItem('eu_sample');
    if (sessionStorage.getItem('eu_sample') === '1') return true;
  } catch { /* no storage: fall through */ }
  return customer.get()?.email === customer.DEMO.email;
}

// Sample: five friends used the link, two have supply started (so two referrer
// draws: one used, one waiting) and one more switch unlocks the first bonus.
const SAMPLE_FRIENDS = [3, 3, 2, 1, 0];
const SAMPLE_DRAWS = [
  { id: 'd1', kind: 'referrer', friend: 1, status: 'drawn', prize: 5, at: '2026-10-21' },
  { id: 'd2', kind: 'referrer', friend: 2, status: 'ready', at: '2026-11-03' },
];

/**
 * The member's referrals: friends (numbered, never named) and their step,
 * draws waiting and used, and how far to the next bonus draw.
 */
export function myReferrals() {
  const sample = sampleMode();
  const friends = (sample ? SAMPLE_FRIENDS : []).map((step, i) => ({ n: i + 1, step }));
  const draws = sample ? SAMPLE_DRAWS : [];
  const switched = friends.filter((f) => f.step === CONFIG.rewards.friendSteps.length - 1).length;
  return {
    sample,
    friends,
    switched,
    draws,
    waiting: draws.filter((d) => d.status === 'ready'),
    earned: drawsEarned(switched),
    next: nextBonus(switched),
  };
}

// Sample success stories: savings are worked out from today's rates for that
// home type, so they stay believable. Real stories come from the CRM, with the
// customer's consent, and only once there are some.
const SAMPLE_STORIES = [
  { name: 'Wei L.', area: 'Tampines', home: 'HDB 4-room', prize: 20, ago: '2 hours ago' },
  { name: 'Priya S.', area: 'Punggol', home: 'HDB 5-room', prize: 5, ago: 'Yesterday' },
  { name: 'Marcus T.', area: 'Bukit Timah', home: 'Condo', prize: 50, ago: '3 days ago' },
];

/** Recent winners with their estimated yearly saving vs the SP tariff. */
export function stories() {
  if (!sampleMode()) return [];
  return SAMPLE_STORIES.map((s) => {
    const kwh = CONFIG.homePresets.find((p) => p.label === s.home)?.kwh;
    const best = kwh ? compare({ kwh, contract: 'any' }).results[0] : null;
    return { ...s, saving: best ? Math.round(best.savingYearly) : null, sample: true };
  });
}

/** A link to a draw. Sample draws get a fresh sample link from the server. */
export async function drawLink(draw) {
  if (!sampleMode()) return null; // live draws arrive as links on WhatsApp
  const r = await fetch(`/api/draw?sample=${encodeURIComponent(draw.kind)}`, { headers: { accept: 'application/json' } });
  const { token } = await r.json();
  if (!token) throw new Error('No sample link');
  return `draw.html?t=${encodeURIComponent(token)}`;
}
