// Testimonials: home customers in their own words (written samples for now,
// each marked as one), then what switching could save each type of Singapore
// home (real estimates, with the retailers' logos).
import { initLayout, observeReveals, photoFallbacks } from '../layout.js';
import { homeStories, storyCard } from '../widgets/home-story.js';
import { TESTIMONIALS, quoteCard } from '../data/testimonials.js';
import { photo } from '../data/photos.js';
// Before initLayout(), so its fade-in and missing-photo handling see the photo
document.querySelectorAll('[data-photo-slot]').forEach((el) => { el.innerHTML = photo(el.dataset.photoSlot, { eager: true, sizes: '(min-width: 768px) 50vw, 100vw' }); });
initLayout();
const g = document.getElementById('t-grid');
g.innerHTML = homeStories().map(storyCard).join('');
photoFallbacks(g);
const quotes = document.getElementById('t-quotes');
if (TESTIMONIALS.length) {
  quotes.innerHTML = TESTIMONIALS.map(quoteCard).join('');
  quotes.closest('section').hidden = false;
}
observeReveals();
