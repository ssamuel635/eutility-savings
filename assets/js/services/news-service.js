// Market news: the markup for news.html and the homepage, from assets/js/data/news.js.
// tools/prerender.mjs writes it into the HTML, so the pages need no script to show it.
// Headlines only: each links to the original on the publisher's site. The photo
// is our own stock photo for the headline's topic (data/news-topics.js), not the outlet's.
import { NEWS } from '../data/news.js';
import { photoFor } from '../data/news-topics.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https:\/\//.test(u) ? u : '#');

export function niceDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Newest first. */
export function latest(n = Infinity, items = NEWS) {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, n);
}

/** The topic photo: decorative (the headline says what the story is), so no alt text. */
function photoMarkup(p, sizes) {
  return `<picture class="news-photo"><source type="image/webp" srcset="${p.webp}" sizes="${sizes}"><img src="${p.jpg}" alt="" width="800" height="500" loading="lazy" decoding="async"></picture>`;
}

/** The list items, each photo different from the one above it where the topic allows. */
function itemsMarkup(items, cls, join) {
  let prev = '';
  return items.map((it) => {
    const p = photoFor(it, prev);
    prev = p.name;
    return itemMarkup(it, cls, p);
  }).join(join);
}

function itemMarkup(it, cls, photo) {
  const official = it.kind === 'official';
  const sizes = cls === 'news-card' ? '(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw' : '120px';
  return `<li class="${cls}">
          ${photoMarkup(photo, sizes)}
          <div class="news-body">
          <p class="news-meta"><span class="tag${official ? ' tag--official' : ''}">${official ? 'Official' : 'News'}</span><span>${esc(it.source)}</span><time datetime="${esc(it.date)}">${niceDate(it.date)}</time></p>
          <a class="news-title" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.title)}<span class="visually-hidden"> (${esc(it.source)}, opens in a new tab)</span><span aria-hidden="true"> ↗</span></a>
          </div>
        </li>`;
}

/** The Market news page: every headline, grouped by month. */
export function newsPageMarkup(items = NEWS) {
  if (!items.length) {
    return `<div class="news-empty card"><p class="h4">No market news yet.</p><p>We check SP Group, the Open Electricity Market and Singapore&rsquo;s news sites every day. Tariff changes and retailer news will appear here.</p></div>`;
  }
  const groups = [];
  for (const it of latest(Infinity, items)) {
    const [y, m] = it.date.split('-').map(Number);
    const label = `${MONTHS_LONG[m - 1]} ${y}`;
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(it);
  }
  return groups.map((g) => `
      <section class="news-month" aria-label="${g.label}">
        <h2 class="h4">${g.label}</h2>
        <ul class="news-list">
        ${itemsMarkup(g.items, 'news-item', '\n        ')}
        </ul>
      </section>`).join('');
}

/** Headlines about the SP Group tariff (the tariff page), newest first; empty when there are none. */
export function tariffNewsMarkup(n = 4, items = NEWS) {
  const top = latest(Infinity, items).filter((it) => /tariff/i.test(it.title)).slice(0, n);
  if (!top.length) return '';
  return `<ul class="news-list">
        ${itemsMarkup(top, 'news-item', '\n        ')}
        </ul>`;
}

/** The homepage section: the latest three, or a short note while there's no news yet. */
export function homeNewsMarkup(items = NEWS) {
  const top = latest(3, items);
  const body = top.length
    ? `<ul class="news-cards">
        ${itemsMarkup(top, 'news-card', '\n        ')}
    </ul>`
    : `<div class="news-empty card"><p class="h4">No market news yet.</p><p>We check SP Group, the Open Electricity Market and Singapore&rsquo;s news sites every day. Tariff changes and retailer news will appear here.</p></div>`;
  return `
  <section class="section container" aria-labelledby="home-news-h">
    <div class="section-head">
      <h2 class="h2" id="home-news-h">Electricity market news.</h2>
      <p class="lead">The latest on tariffs and retailers, from official sources and Singapore&rsquo;s news sites.</p>
    </div>
    ${body}
    <p style="margin-top:24px"><a class="link-arrow" href="news.html">All market news</a></p>
  </section>
  `;
}
