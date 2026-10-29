import { initLayout } from '../layout.js';
import { PHOTOS } from '../data/photos.js';
import { NEWS_TOPICS } from '../data/news-topics.js';
initLayout();

// Photo credits, from the same list the pages use, so they never drift apart.
const credits = document.getElementById('photo-credits');
if (credits) {
  credits.innerHTML = [...Object.values(PHOTOS), ...NEWS_TOPICS.map((t) => t.photo)]
    .map((p) => `<li>${p.alt}: <a href="${p.page}" target="_blank" rel="noopener">${p.credit}</a></li>`)
    .join('');
}
