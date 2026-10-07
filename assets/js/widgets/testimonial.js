import { fmtMoney } from '../calc.js';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function testimonialCard(t, i = 0) {
  const initials = t.where.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return `
  <figure class="quote-card reveal reveal-delay-${i % 3}" style="margin:0">
    ${t.sample ? '<span class="pill pill--sample sample-flag">Sample</span>' : ''}
    <p class="quote-card__save">${fmtMoney(t.saved)}<small> saved / year</small></p>
    <blockquote>“${esc(t.quote)}”</blockquote>
    <figcaption class="quote-card__who">
      <span class="avatar-ph" aria-hidden="true">${esc(initials)}</span>
      <span><strong>${esc(t.who)}, ${esc(t.where)}</strong>${esc(t.home)}</span>
    </figcaption>
  </figure>`;
}
