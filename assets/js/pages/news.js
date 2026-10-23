// The headlines are written into news.html by tools/prerender.mjs, so this page only needs the layout and its hero photo.
import { initLayout } from '../layout.js';
import { photo } from '../data/photos.js';

// Before initLayout(), so its fade-in and missing-photo handling see the photo
document.querySelectorAll('[data-photo-slot]').forEach((el) => { el.innerHTML = photo(el.dataset.photoSlot, { eager: true, sizes: '(min-width: 768px) 50vw, 100vw' }); });
initLayout();
