// Home customers in their own words. Add one only once the customer has agreed
// to be quoted on this site and in the app: nothing here is ever made up.
// While the list is empty, the quote sections on the home and Testimonials
// pages stay hidden and the pages show savings by home type instead.
//
// One entry looks like this (savedYearly in dollars, optional):
//   { quote: 'Switching took one WhatsApp chat…', name: 'Mei Ling', home: '4-room HDB flat', area: 'Tampines', plan: 'Geneco Get It Fixed 24', savedYearly: 180 },

import { fmtMoney } from '../calc.js';

export const TESTIMONIALS = [];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function quoteCard(t, i = 0) {
  const where = [t.home, t.area].filter(Boolean).join(', ');
  return `
  <figure class="t-quote reveal" style="--d:${(i % 3) * 0.06}s">
    <svg class="t-quote__mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 6C6.5 7.3 4.6 9.9 4.6 13.4V18h5.6v-5.6H7.4c0-2 1-3.5 3-4.4zm9 0c-3.1 1.3-5 3.9-5 7.4V18h5.6v-5.6h-2.8c0-2 1-3.5 3-4.4z"/></svg>
    <blockquote>${esc(t.quote)}</blockquote>
    <figcaption><strong>${esc(t.name)}</strong>${where ? `<span>${esc(where)}</span>` : ''}${t.savedYearly ? `<span>Saves ${fmtMoney(t.savedYearly)} a year${t.plan ? ` on ${esc(t.plan)}` : ''}</span>` : ''}</figcaption>
  </figure>`;
}
