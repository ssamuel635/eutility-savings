// Write content into the HTML that the browser would otherwise build with JavaScript.
//
//   node tools/prerender.mjs      (npm run seo runs it too)
//
// Search engines, AI tools and link previews often read a page without running its
// scripts, and budget phones show it sooner. This fills two spots, each between
// <!-- prerender:NAME --> and <!-- /prerender:NAME --> markers:
//   faq.html    every question and answer (the page's search re-renders the same markup)
//   plans.html  "Every plan at a glance": one row per plan at the default usage
// Both come from the same data the pages use, so re-run after a price update.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { FAQ, faqMarkup } = await load('assets/js/data/faq.js');
const { CONFIG } = await load('assets/js/config.js');
const { fmtMoney, RATES_DATE } = await load('assets/js/calc.js');
const plans = await load('assets/js/services/plans-service.js');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function planGlance() {
  const kwh = CONFIG.defaultKwh;
  const rows = plans.list({ kwh, sort: 'price' });
  const body = rows.map((r) => `
          <tr><td><strong>${esc(r.plan.retailer)}</strong><span class="muted">${esc(r.plan.name)}</span></td>
            <td>${esc(r.plan.pricingLabel)}${r.plan.category === 'Green' ? '<span class="muted">Green</span>' : ''}</td>
            <td>${esc(r.contract)}</td><td>${esc(r.priceLabel)}</td><td class="num-cell">${fmtMoney(r.monthly)}</td></tr>`).join('');
  return `
  <section class="container plan-glance acc" aria-labelledby="glance-h">
    <details>
      <summary><span><h2 class="h4" id="glance-h">Every plan at a glance</h2><span class="small">${rows.length} plans, cheapest first at ${kwh.toLocaleString('en-SG')} kWh a month</span></span></summary>
      <div class="acc__body stack" style="--stack:12px">
      <div class="table-scroll">
        <table class="plan-table">
          <thead><tr><th>Plan</th><th>Type</th><th>Contract</th><th>Price</th><th class="num-cell">Est./month</th></tr></thead>
          <tbody>${body}
          </tbody>
        </table>
      </div>
      <p class="small">Prices include GST. SP Group tariff ${plans.TARIFF}¢/kWh (${esc(plans.TARIFF_PERIOD)}). Rates as at ${RATES_DATE}, checked against each retailer’s official site.</p>
      </div>
    </details>
  </section>
  `;
}

const SPOTS = [
  { file: 'faq.html', name: 'faq', html: () => faqMarkup(FAQ), after: /<div id="faq-list"[^>]*>/ },
  { file: 'plans.html', name: 'plans', html: planGlance, after: /<div class="plan-grid" id="plan-grid"><\/div>\s*<\/div>\s*<\/section>/ },
];

let failed = false;
for (const spot of SPOTS) {
  const file = path.join(ROOT, spot.file);
  let s = fs.readFileSync(file, 'utf8');
  const open = `<!-- prerender:${spot.name} -->`;
  const close = `<!-- /prerender:${spot.name} -->`;
  const block = `${open}${spot.html()}${close}`;
  if (s.includes(open)) {
    s = s.replace(new RegExp(`${open}[\\s\\S]*?${close}`), () => block);
  } else {
    const m = s.match(spot.after);
    if (!m) { console.error(`${spot.file}: couldn't find where to put the ${spot.name} block`); failed = true; continue; }
    s = s.replace(m[0], () => `${m[0]}\n  ${block}`);
  }
  fs.writeFileSync(file, s);
  console.log(`${spot.file.padEnd(12)} ${spot.name} written`);
}
process.exit(failed ? 1 : 0);
