import { initLayout } from '../layout.js';
import { CONFIG, waLink } from '../config.js';
import * as I from '../icons.js';
import { photo } from '../data/photos.js';
// Before initLayout(), so its fade-in and missing-photo handling see the photo
document.querySelectorAll('[data-photo-slot]').forEach((el) => { el.innerHTML = photo(el.dataset.photoSlot, { eager: true, sizes: '(min-width: 768px) 50vw, 100vw' }); });
initLayout();
document.getElementById('contact-list').innerHTML = `
  <li><a href="${waLink()}" data-wa>${I.chat}<span>WhatsApp<small>Fastest — we reply in the chat</small></span></a></li>
  <li><a href="mailto:${CONFIG.email}">${I.mail}<span>Email<small>${CONFIG.email}</small></span></a></li>
  <li><a href="tel:${CONFIG.phone.replace(/\s/g, '')}">${I.phone}<span>Phone<small>${CONFIG.phone}</small></span></a></li>`;
