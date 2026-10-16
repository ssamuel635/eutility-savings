// Testimonials: what switching could save each type of Singapore home (real
// estimates, with a photo), then home customers in their own words once any
// have agreed to be quoted.
import { initLayout, observeReveals, photoFallbacks } from '../layout.js';
import { homeStories, storyCard } from '../widgets/home-story.js';
import { TESTIMONIALS, quoteCard } from '../data/testimonials.js';
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
