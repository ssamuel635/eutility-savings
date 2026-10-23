// Home customers in their own words.
//
// SAMPLES (23 Oct 2026, for the Flo Energy demo): the entries below are sample
// testimonials written to show how real ones will look. They are not real
// customers (sample: true). The cards don't show a "Sample" tag for the demo,
// by the owner's choice (23 Oct): replace every one with a real customer's
// words, once that customer agrees to be quoted, BEFORE LAUNCH, and drop the
// `sample` flag. Leaving the list empty hides the quote sections again.
//
// One entry looks like this:
//   { quote: 'Switching took one WhatsApp chat…', name: 'Mei Ling', home: '4-room HDB flat', area: 'Tampines', planId: 'geneco-get-it-fixed-24', kwh: 370 },
// The saving is worked out from the price sheet (SP Group's tariff against the
// plan at that usage), so it stays right when rates change. Use `savedYearly`
// (dollars) instead for a figure the customer gave us.

import { fmtMoney, getPlan, monthlyCost, DEFAULT_CURRENT_ID } from '../calc.js';

export const TESTIMONIALS = [
  {
    sample: true,
    quote: 'I thought changing electricity company would be a lot of paperwork. I sent a photo of my SP bill on WhatsApp and they showed me what I could save. My grandson didn’t even need to help me.',
    name: 'Mdm Tan',
    home: '4-room HDB flat',
    area: 'Tampines',
    planId: 'flo-energy-fixed-12',
    kwh: 370,
  },
  {
    sample: true,
    quote: 'With three kids at home the aircon runs every night. I wanted a fixed price so the bill doesn’t jump around. Eutility compared the plans for me and I signed in the chat.',
    name: 'Encik Hafiz Rahman',
    home: '5-room HDB flat',
    area: 'Woodlands',
    planId: 'senoko-energy-lifepower24',
    kwh: 440,
  },
  {
    sample: true,
    quote: 'We both work from home, so our usage is high. They answered my questions straight away and didn’t push me. Same wires, same power, just a smaller bill.',
    name: 'Mrs Priya Nair',
    home: 'Condo',
    area: 'Clementi',
    planId: 'flo-energy-fixed-12',
    kwh: 500,
  },
  {
    sample: true,
    quote: 'I had been on the SP tariff for years and never compared. One message and they did the work. The switch happened on my next bill with no interruption at all.',
    name: 'Mr Daniel Pereira',
    home: 'Executive flat',
    area: 'Pasir Ris',
    planId: 'senoko-energy-lifepower36',
    kwh: 500,
  },
  {
    sample: true,
    quote: 'I wanted a greener plan but didn’t want to pay more than I do now. They found one that still costs less than the SP tariff for my flat.',
    name: 'Puan Noraini',
    home: '3-room HDB flat',
    area: 'Bedok',
    planId: 'senoko-energy-lifegreen24',
    kwh: 280,
  },
  {
    sample: true,
    quote: 'A landed house uses a lot of power, so even a small difference per unit adds up. Seeing the yearly figure made the decision easy.',
    name: 'Mr and Mrs Lim',
    home: 'Landed home',
    area: 'Serangoon',
    planId: 'flo-energy-fixed-12',
    kwh: 1100,
  },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Yearly saving and plan name: worked out from the sheet when the entry names a plan and usage. */
function saving(t) {
  const plan = t.planId ? getPlan(t.planId) : null;
  const name = plan ? `${plan.retailer} ${plan.name}` : t.plan;
  if (plan && t.kwh) {
    const sp = getPlan(DEFAULT_CURRENT_ID);
    const yearly = Math.round((monthlyCost(sp, t.kwh).total - monthlyCost(plan, t.kwh).total) * 12);
    return { yearly: yearly > 0 ? yearly : 0, name };
  }
  return { yearly: t.savedYearly || 0, name };
}

export function quoteCard(t, i = 0) {
  const where = [t.home, t.area].filter(Boolean).join(', ');
  const s = saving(t);
  return `
  <figure class="t-quote reveal" style="--d:${(i % 3) * 0.06}s">
    <svg class="t-quote__mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 6C6.5 7.3 4.6 9.9 4.6 13.4V18h5.6v-5.6H7.4c0-2 1-3.5 3-4.4zm9 0c-3.1 1.3-5 3.9-5 7.4V18h5.6v-5.6h-2.8c0-2 1-3.5 3-4.4z"/></svg>
    <blockquote>${esc(t.quote)}</blockquote>
    <figcaption><strong>${esc(t.name)}</strong>${where ? `<span>${esc(where)}</span>` : ''}${s.yearly ? `<span>Saves about ${fmtMoney(s.yearly)} a year${s.name ? ` on ${esc(s.name)}` : ''}</span>` : ''}</figcaption>
  </figure>`;
}
