// A saved savings check keeps the plan as it was, promotion included. Screens
// that show or apply a promotion check it again, so one that has ended since
// (e.g. Geneco's GENECO200, 12 Nov 2026) isn't offered at sign-up.

import { activePromo } from '@/engine';
import type { Promo } from '@/api';

/** The promotion, or null once its end date has passed (Singapore time, same rule as the website). */
export function livePromo(promo: Promo | null | undefined, now = new Date()): Promo | null {
  if (!promo) return null;
  return activePromo({ promo } as Parameters<typeof activePromo>[0], now) ? promo : null;
}
