// Guide pages (the SP Group tariff page and the home-type pages). Their content
// is written into the HTML by tools/prerender.mjs, so this page only needs the
// layout and the scroll reveals.
import { initLayout, observeReveals } from '../layout.js';
initLayout();
observeReveals();
