// The rewards catalogue: items and points come from the website's config
// (assets/js/config.js → rewards), photos from mobile/assets/rewards/.

import type { ImageSourcePropType } from 'react-native';
import { CONFIG } from '@/engine';

const IMAGES: Record<string, ImageSourcePropType> = {
  'gift-voucher': require('../../assets/rewards/gift-voucher.jpg'),
  'desk-fan': require('../../assets/rewards/desk-fan.jpg'),
  'rice-cooker': require('../../assets/rewards/rice-cooker.jpg'),
  'air-fryer': require('../../assets/rewards/air-fryer.jpg'),
  'robot-vacuum': require('../../assets/rewards/robot-vacuum.jpg'),
  'nintendo-switch': require('../../assets/rewards/nintendo-switch.jpg'),
  ps5: require('../../assets/rewards/ps5.jpg'),
  'smart-tv': require('../../assets/rewards/smart-tv.jpg'),
};

export interface RewardItem { id: string; name: string; points: number; about?: string; image?: ImageSourcePropType }

export const CATALOGUE: RewardItem[] = CONFIG.rewards.catalogue.map((r) => ({ ...r, image: IMAGES[r.img] }));

/** How redeeming works: shown on every item's detail sheet. */
export const REDEEM_NOTES: string[] = CONFIG.rewards.redeemNotes;

/** What a customer sends friends when they share their code. */
export const shareMessage = (code: string, link: string) =>
  `I switched my electricity plan with Eutility and saved. Check what you could save — use my code ${code}: ${link}`;

/** The WhatsApp message that asks Eutility for an item. */
export const redeemMessage = (item: RewardItem, code: string) =>
  `Hi ${CONFIG.brand}, I'd like to redeem ${pts(item.points)} for: ${item.name}.\nReferral code: ${code}\n(sent from the Eutility app)`;

/** This month's headline reward (CONFIG.rewards.featured). */
export const FEATURED: RewardItem | undefined = CATALOGUE.find((r) => r.id === CONFIG.rewards.featured);

/** Points for a number of friends who switched. */
export const pointsFor = (switched: number) => switched * CONFIG.rewards.pointsPerSwitch;

export const pts = (n: number) => `${n.toLocaleString('en-SG')} pts`;
