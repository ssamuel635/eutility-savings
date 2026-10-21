// Business (SME) tab: no calculator. Business rates depend on each site's
// usage and contract dates, so a consultant prices them — this just hands off
// to the same WhatsApp number and phone line as every other CTA.
import { CONFIG } from '../config.js';
import * as I from '../icons.js';

const WA_MESSAGE = "Hi Eutility, I'd like a business electricity quote.";

/** bare: no card of its own (when it already sits inside one, like the home hero). */
export function mountSme(root, { bare = false } = {}) {
  const tel = CONFIG.phone.replace(/\s/g, '');
  root.innerHTML = `
  <div class="${bare ? 'stack' : 'card card--blue stack sme-contact'}" style="--stack:16px">
    ${bare ? '' : '<h2 class="h3">Talk to a business consultant</h2>'}
    <p>Business rates depend on your sites, usage and contract dates, so we quote them one to one. Message or call us and a consultant takes it from there. Businesses get a dedicated account manager.</p>
    <div class="btn-row">
      <a class="btn btn--wa" href="#" data-wa data-wa-message="${WA_MESSAGE}">${I.chat}<span>Chat on WhatsApp</span></a>
      <a class="btn btn--secondary" href="tel:${tel}">${I.phone}<span>Call ${CONFIG.phone}</span></a>
    </div>
    <p class="small">Prefer email? <a href="#" data-mail data-wa-message="${WA_MESSAGE}" data-mail-subject="Business electricity quote">Email us instead</a>.</p>
  </div>`;
}
