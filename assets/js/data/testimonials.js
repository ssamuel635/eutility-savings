// Client testimonials, shortened from the ones Eutility publishes at
// https://eutility.com.sg/testimonials/ (roles and companies as given there).
// They're from Eutility's business clients, so the page says so. Add home
// customers' stories here once they've agreed to be quoted.

export const TESTIMONIALS = [
  { quote: 'Eutility have proved invaluable in the minefield that is energy procurement, with advice that has continually proven itself to be knowledge based and completely sound.', role: 'ManpowerGroup', org: '' },
  { quote: 'They go above and beyond to proactively introduce cost reductions and billing optimisation opportunities.', role: 'National Procurement Manager', org: 'Interactive' },
  { quote: 'We were most impressed with the detailed analysis, professionalism and market knowledge, not to mention the big cost savings achieved.', role: 'Head of Information Technology', org: 'Miele Australia' },
  { quote: 'Their tendering service is comprehensive and takes away all the hassle of procurement. Their advice on the market is always timely and commercial.', role: 'Chief Financial Officer and Company Secretary', org: 'ProTen' },
  { quote: 'They have been responsible for ensuring our energy costs have remained neutral when other management firms predicted steep increases.', role: 'Commercial Strategy & Property', org: 'Vodafone' },
  { quote: 'Delivered in a highly professional manner, securing the group extremely competitive metering and retail rates.', role: 'Supply Chain Manager, Sustainability', org: 'KFC' },
  { quote: 'The overall benefit was significant, cutting our overall IT spend by more than 40%.', role: 'Global IT Support Manager', org: 'Michael Hill Jewellers' },
  { quote: 'A very impressive tool for engineers who are concerned about electricity use.', role: 'Chief Engineer', org: 'Richmond Dairies' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function quoteCard(t, i = 0) {
  return `
  <figure class="t-quote reveal" style="--d:${(i % 3) * 0.06}s">
    <svg class="t-quote__mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 6C6.5 7.3 4.6 9.9 4.6 13.4V18h5.6v-5.6H7.4c0-2 1-3.5 3-4.4zm9 0c-3.1 1.3-5 3.9-5 7.4V18h5.6v-5.6h-2.8c0-2 1-3.5 3-4.4z"/></svg>
    <blockquote>${esc(t.quote)}</blockquote>
    <figcaption><strong>${esc(t.org || t.role)}</strong>${t.org ? `<span>${esc(t.role)}</span>` : ''}</figcaption>
  </figure>`;
}
