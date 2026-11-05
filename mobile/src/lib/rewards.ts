// Eutility Rewards in the app: the referral lucky draw. The rules (bonus draws,
// prizes) come from the website's config and services/draws.js, so the app and
// the website always agree. The draw itself runs on the website's draw page.

import { CONFIG } from '@/engine';
import type { ReferralStatus } from '@/api';

export const SITE = 'https://eutility-savings.vercel.app';
export const RULES_URL = `${SITE}/draw.html#rules`;

/** Where a friend is up to. Friends are numbered, never named. */
export const FRIEND_STATUS: Record<ReferralStatus, { label: string; tone: 'blue' | 'orange' | 'success' }> = {
  invited: { label: CONFIG.rewards.friendSteps[0], tone: 'blue' },
  signed_up: { label: CONFIG.rewards.friendSteps[1], tone: 'blue' },
  switching: { label: CONFIG.rewards.friendSteps[2], tone: 'orange' },
  switched: { label: CONFIG.rewards.friendSteps[3], tone: 'success' },
};

/** What a customer sends friends when they share their code. */
export const shareMessage = (code: string, link: string) =>
  `I checked my electricity plan with Eutility. See what you could save, and we both get a lucky draw if you switch. Use my code ${code}: ${link}`;

export const sgd = (n: number) => `S$${n.toLocaleString('en-SG')}`;

export const ordinal = (n: number) => {
  const end = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10];
  return `${n}${end && ![11, 12, 13].includes(n % 100) ? end : 'th'}`;
};
