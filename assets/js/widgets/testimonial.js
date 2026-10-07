import { fmtMoney } from '../calc.js';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function testimonialCard(t, i = 0) {
  // Initials from the person's name (without Mdm/Mr/Mrs/Ms/Dr), not the place.
  const name = String(t.who || '').split(',')[0].replace(/^(Mdm|Mr|Mrs|Ms|Dr)\.?\s+/i, '');
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `
  <figure class="quote-card reveal reveal-delay-${i % 3}" style="margin:0">
    ${t.sample ? '<span class="pill pill--sample sample-flag">Sample</span>' : ''}
    <p class="quote-card__save">${fmtMoney(t.saved)}<small> saved/year</small></p>
    <blockquote>“${esc(t.quote)}”</blockquote>
    <figcaption class="quote-card__who">
      <span class="avatar-ph" aria-hidden="true">${esc(initials)}</span>
      <span><strong>${esc(t.who)}, ${esc(t.where)}</strong>${esc(t.home)}</span>
    </figcaption>
  </figure>`;
}
