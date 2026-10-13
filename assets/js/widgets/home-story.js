// "Homes like yours": photo cards with a real estimate for each type of home,
// worked out from the price sheet. These replace sample testimonials, so
// nothing on the site is a made-up quote. Real, permission-cleared customer
// stories can sit alongside these later.

import { compare, fmtMoney, RATES_DATE } from '../calc.js';
import { CONFIG } from '../config.js';
import { photo } from '../data/photos.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Which photo goes with which home type (labels match CONFIG.homePresets). */
const STORY_PHOTOS = {
  'HDB 3-room': 'voidDeck',
  'HDB 4-room': 'dinner',
  'HDB 5-room': 'hdb',
  Executive: 'livingRoom',
  Condo: 'neighbours',
  Landed: 'kites',
};
const HOME_NAMES = { 'HDB 3-room': '3-room HDB flat', 'HDB 4-room': '4-room HDB flat', 'HDB 5-room': '5-room HDB flat', Executive: 'Executive flat', Condo: 'Condo', Landed: 'Landed home' };
/** The same, mid-sentence ("A 3-room HDB flat using…"). */
const IN_SENTENCE = { 'HDB 3-room': 'a 3-room HDB flat', 'HDB 4-room': 'a 4-room HDB flat', 'HDB 5-room': 'a 5-room HDB flat', Executive: 'an Executive flat', Condo: 'a condo', Landed: 'a landed home' };

/** Stories for the given home types (all of them by default). */
export function homeStories(labels = CONFIG.homePresets.map((p) => p.label)) {
  return labels.map((label) => {
    const preset = CONFIG.homePresets.find((p) => p.label === label);
    if (!preset) return null;
    const r = compare({ kwh: preset.kwh, contract: '24' });
    if (!r.best || r.alreadyBest) return null;
    return { label, kwh: preset.kwh, best: r.best, photo: STORY_PHOTOS[label] };
  }).filter(Boolean);
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function storyCard(s, i = 0) {
  const home = HOME_NAMES[s.label] || s.label;
  return `
  <article class="story-card reveal" style="--d:${i * 0.06}s">
    <div class="story-card__photo photo-frame">${photo(s.photo, { sizes: '(min-width: 768px) 33vw, 100vw' })}<span class="story-card__home">${esc(home)}</span></div>
    <div class="story-card__body">
      <p class="story-card__save">${fmtMoney(s.best.savingYearly)}<small> a year</small></p>
      <p class="story-card__how">${esc(cap(IN_SENTENCE[s.label] || home))} using about ${s.kwh} kWh a month, moving from SP Group’s tariff to ${esc(s.best.plan.retailer)} ${esc(s.best.plan.name)}.</p>
      <p class="story-card__note">Example estimate, retailer rates as at ${esc(RATES_DATE)}.</p>
      <a class="link-arrow" href="calculator.html?kwh=${s.kwh}&run=1">Check your own home</a>
    </div>
  </article>`;
}
