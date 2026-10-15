import { initLayout } from '../layout.js';
import { FAQ, faqMarkup } from '../data/faq.js';
import * as I from '../icons.js';

initLayout();

const list = document.getElementById('faq-list');
document.querySelector('[data-icon-search]').outerHTML = I.search;

function render(filter = '') {
  const f = filter.trim().toLowerCase().replace(/[’‘]/g, "'");
  // Compare against the text people actually read: tags removed, entities decoded,
  // curly apostrophes treated like straight ones.
  const scratch = document.createElement('div');
  const plain = (h) => { scratch.innerHTML = h; return (scratch.textContent || '').toLowerCase().replace(/[’‘]/g, "'"); };
  const groups = FAQ.map((g) => ({ ...g, items: g.items.filter((it) => !f || plain(it.q).includes(f) || plain(it.a).includes(f)) }))
    .filter((g) => g.items.length);
  const html = faqMarkup(groups, { allOpen: !!f });
  list.innerHTML = html || `<div class="faq-empty"><p class="h4" style="color:var(--text)">No matches for “${filter.replace(/</g, '&lt;')}”</p><p style="margin-top:8px">Try another word, or <a href="#" data-wa data-wa-message="Hi Eutility, I have a question.">ask us on WhatsApp</a>.</p></div>`;

  // One item open at a time (when not searching)
  list.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open && !document.getElementById('faq-q').value) {
      list.querySelectorAll('details[open]').forEach((o) => { if (o !== d) o.open = false; });
    }
  }));
}
render();
document.getElementById('faq-q').addEventListener('input', (e) => render(e.target.value));
