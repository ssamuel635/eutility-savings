// Referral lucky draw rules the pages show: how many draws a referrer has
// earned and when the next bonus comes. No browser code, so tests use it too.
import { CONFIG } from '../config.js';

const R = CONFIG.rewards;

/** Extra draws the referrer gets when their nth friend's supply starts. */
export function bonusAt(n) {
  const fixed = R.bonusDraws.find((b) => b.at === n);
  if (fixed) return fixed.extra;
  const last = R.bonusDraws[R.bonusDraws.length - 1].at;
  return n > last && (n - last) % R.repeatEvery === 0 ? R.repeatExtra : 0;
}

/** Draws a referrer has earned once n friends' supply has started: 1 each plus bonuses. */
export function drawsEarned(n) {
  let t = 0;
  for (let i = 1; i <= n; i++) t += 1 + bonusAt(i);
  return t;
}

/** The next bonus after n friends: { at, extra, toGo }. */
export function nextBonus(n) {
  for (let i = n + 1; i < n + 1000; i++) {
    const extra = bonusAt(i);
    if (extra) return { at: i, extra, toGo: i - n };
  }
  return null;
}

const values = () => R.prizes.map((p) => p.value);
export const prizeMin = () => Math.min(...values());
export const prizeMax = () => Math.max(...values());
export const topOdds = () => {
  const top = R.prizes.reduce((a, b) => (b.value > a.value ? b : a));
  return `${(top.weight / 100).toLocaleString('en-SG', { maximumFractionDigits: 2 })}%`;
};
export const money = (n) => `S$${Number(n).toLocaleString('en-SG')}`;
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
