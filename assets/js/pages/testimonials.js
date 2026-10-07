import { initLayout, observeReveals } from '../layout.js';
import { testimonialCard } from '../widgets/testimonial.js';
import { TESTIMONIALS } from '../data/testimonials.js';
initLayout();
const g = document.getElementById('t-grid');
g.innerHTML = TESTIMONIALS.map(testimonialCard).join('');
observeReveals(g);
