// Homes like yours: a real estimate for each type of home, with a photo.
import { initLayout, observeReveals, photoFallbacks } from '../layout.js';
import { homeStories, storyCard } from '../widgets/home-story.js';
initLayout();
const g = document.getElementById('t-grid');
g.innerHTML = homeStories().map(storyCard).join('');
photoFallbacks(g);
observeReveals(g);
