import { initLayout } from '../layout.js';
import { CONFIG, waLink } from '../config.js';
import * as I from '../icons.js';
initLayout();
document.getElementById('contact-list').innerHTML = `
  <li><a href="${waLink()}" data-wa>${I.chat}<span>WhatsApp<small>Fastest — we reply in the chat</small></span></a></li>
  <li><a href="mailto:${CONFIG.email}">${I.mail}<span>Email<small>${CONFIG.email}</small></span></a></li>
  <li><a href="tel:${CONFIG.phone.replace(/\s/g, '')}">${I.phone}<span>Phone<small>${CONFIG.phone}</small></span></a></li>
  <li><a href="${CONFIG.links.offices}" target="_blank" rel="noopener">${I.user}<span>International offices<small>Eutility offices outside Singapore ↗</small></span><span class="visually-hidden"> (opens in a new tab)</span></a></li>
  <li><a href="${CONFIG.links.smartview}" target="_blank" rel="noopener">${I.shield}<span>SmartView login<small>For Eutility business clients ↗</small></span><span class="visually-hidden"> (opens in a new tab)</span></a></li>`;
