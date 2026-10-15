// Testimonials: Eutility's clients in their own words, then what switching
// could save each type of Singapore home (real estimates, with a photo).
import { initLayout, observeReveals, photoFallbacks } from '../layout.js';
import { homeStories, storyCard } from '../widgets/home-story.js';
import { TESTIMONIALS, quoteCard } from '../data/testimonials.js';
initLayout();
document.getElementById('t-quotes').innerHTML = TESTIMONIALS.map(quoteCard).join('');
const g = document.getElementById('t-grid');
g.innerHTML = homeStories().map(storyCard).join('');
photoFallbacks(g);
observeReveals();
