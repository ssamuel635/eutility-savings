// Guide pages worked out from the price sheet: SP Group's tariff this quarter
// (electricity-tariff.html) and one page per home type ("Electricity plans for
// a 4-room HDB flat"). tools/prerender.mjs writes this markup into the pages,
// so they need no script to show it and stay current after every price update
// (`npm run seo` rewrites them). Search titles are in tools/seo.mjs.
import { compare, monthlyCost, getPlan, rateLabel, contractLabel, fmtMoney, MARKET_PLANS, CONTRACT_FILTERS, DEFAULT_CURRENT_ID, TARIFF, TARIFF_PERIOD, RATES_DATE, PLAN_COUNT } from '../calc.js';
import { CONFIG } from '../config.js';
import { HOME_NAMES, IN_SENTENCE, HOME_PAGES } from './home-story.js';
import { tariffNewsMarkup } from '../services/news-service.js';
import * as I from '../icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const tariffBill = (kwh) => monthlyCost(getPlan(DEFAULT_CURRENT_ID), kwh).total;

/** One home type's numbers: usage, bill on the tariff, every plan cheapest first. */
export function homeFacts(label) {
  const preset = CONFIG.homePresets.find((p) => p.label === label);
  if (!preset) return null;
  const r = compare({ kwh: preset.kwh, contract: 'any' });
  return {
    label,
    kwh: preset.kwh,
    name: HOME_NAMES[label] || label,
    inSentence: IN_SENTENCE[label] || label,
    href: HOME_PAGES[label],
    onTariff: tariffBill(preset.kwh),
    results: r.results,
    best: r.best,
  };
}

/** The lowest fixed rate on sale for contracts of up to 24 months, no daily charge (as the home page hero). */
export function lowestFixedRate() {
  const upTo24 = CONTRACT_FILTERS['24'].test;
  return Math.min(...MARKET_PLANS.filter((p) => p.pricingType === 'fixed' && !p.dailyCharge && upTo24(p.contractMonths)).map((p) => p.rate));
}

const planRow = (r, i) => `
            <tr class="${i === 0 ? 'is-best' : ''}">
              <td><strong>${esc(r.plan.retailer)}</strong> · ${esc(r.plan.name)}<span class="muted">${contractLabel(r.plan.contractMonths)}${r.plan.category === 'Green' ? ' · Green' : ''}</span></td>
              <td class="col-price">${esc(rateLabel(r.plan))}</td>
              <td class="num-cell">${fmtMoney(r.total, 2)}</td>
              <td class="num-cell ${r.savingYearly >= 0 ? 'save-pos' : 'save-neg'}">${fmtMoney(r.savingYearly)}</td>
            </tr>`;

const ctaBanner = (kwh, waMessage) => `
  <section class="section container">
    <div class="banner banner--blue">
      <div class="stack" style="--stack:6px"><h2 class="h3">Your own bill is the real test.</h2><p>Use your actual usage in the calculator, or send us a photo of your bill on WhatsApp and we&rsquo;ll check it for you.</p></div>
      <div class="btn-row">
        <a class="btn" href="calculator.html${kwh ? `?kwh=${kwh}&run=1` : ''}">Check my savings</a>
        <a class="btn btn--wa" href="#" data-wa data-wa-message="${esc(waMessage)}">${I.chat}<span>Send my bill on WhatsApp</span></a>
      </div>
    </div>
  </section>`;

/** Links to every home-type page except the current one, plus the tariff page. */
function otherPages(current) {
  const links = CONFIG.homePresets.filter((p) => p.label !== current && HOME_PAGES[p.label])
    .map((p) => `<li><a class="link-arrow" href="${HOME_PAGES[p.label]}">${esc(cap(HOME_NAMES[p.label] || p.label))}</a></li>`);
  if (current) links.push(`<li><a class="link-arrow" href="electricity-tariff.html">SP Group&rsquo;s tariff for ${esc(TARIFF_PERIOD)}</a></li>`);
  return `<ul class="guide-links">${links.join('')}</ul>`;
}

/** The page for one home type. */
export function homeTypePageMarkup(label, { rows = 8 } = {}) {
  const f = homeFacts(label);
  if (!f) return '';
  const top = f.results.slice(0, rows);
  const best = top[0];
  const save = best ? Math.max(0, best.savingYearly) : 0;
  return `
  <section class="hero container" style="padding-bottom:32px">
    <div class="stack" style="--stack:20px;max-width:820px">
      <p class="eyebrow reveal">Electricity plans by home</p>
      <h1 class="display reveal reveal-delay-1">Electricity plans for ${esc(f.inSentence)}.</h1>
      <p class="lead reveal reveal-delay-2">${esc(cap(f.inSentence))} uses about ${f.kwh} kWh of electricity a month. On SP Group&rsquo;s tariff (${TARIFF}¢/kWh for ${esc(TARIFF_PERIOD)}) that comes to about ${fmtMoney(f.onTariff)} a month. These are the plans that cost least at that usage.</p>
    </div>
    <div class="stats guide-stats reveal" style="margin-top:32px">
      <div class="stat"><span class="stat__num">${fmtMoney(f.onTariff)}</span><span class="stat__label">a month on SP Group&rsquo;s tariff</span></div>
      <div class="stat"><span class="stat__num">${best ? fmtMoney(best.total) : '—'}</span><span class="stat__label">a month on the lowest plan${best ? `, ${esc(best.plan.retailer)} ${esc(best.plan.name)}` : ''}</span></div>
      <div class="stat"><span class="stat__num">${fmtMoney(save)}</span><span class="stat__label">a year you could save</span></div>
    </div>
  </section>

  <section class="container" style="padding-bottom:clamp(48px,8vw,96px)">
    <div class="section-head">
      <h2 class="h2">The lowest-cost plans at ${f.kwh} kWh a month.</h2>
      <p class="lead">Every plan we track, priced for ${esc(f.inSentence)} and ranked by the monthly bill. Savings are against SP Group&rsquo;s tariff.</p>
    </div>
    <div class="table-scroll guide-table">
      <table class="plan-table">
        <thead><tr><th>Plan</th><th class="col-price">Price</th><th class="num-cell">Est. bill/mo</th><th class="num-cell">Save/yr</th></tr></thead>
        <tbody>${top.map(planRow).join('')}
        </tbody>
      </table>
    </div>
    <p class="small muted-note" style="margin-top:12px">Estimates at ${f.kwh} kWh a month, using retailer rates as at ${esc(RATES_DATE)}. Time-of-use plans assume ${Math.round(CONFIG.defaultOffPeakShare * 100)}% of your usage is off-peak. Promotions are not included. <a href="calculator.html?kwh=${f.kwh}&run=1">See all ${f.results.length} plans in the calculator</a>.</p>
  </section>

  <section class="section section--cloud container">
    <div class="grid-2 grid-2--top">
      <div class="stack" style="--stack:14px">
        <h2 class="h2">Is your home typical?</h2>
        <p>${f.kwh} kWh is a rounded average for ${esc(f.inSentence)}. Yours depends on how many people live with you, how long the aircon runs and your appliances.</p>
        <p>Your SP Group bill shows your actual usage under &ldquo;Electricity&rdquo;, in kWh. The average of your last few months gives you the best estimate.</p>
      </div>
      <div class="stack" style="--stack:14px">
        <h2 class="h2">Other homes.</h2>
        ${otherPages(label)}
      </div>
    </div>
  </section>
  ${ctaBanner(f.kwh, `Hi Eutility, I live in ${f.inSentence} and I'd like to check my electricity savings.`)}`;
}

/** The SP Group tariff page. */
export function tariffPageMarkup() {
  const kwh = CONFIG.defaultKwh;
  const typical = compare({ kwh, contract: 'any' });
  const cheaper = typical.results.filter((r) => r.savingMonthly > 0).length;
  const homes = CONFIG.homePresets.map((p) => homeFacts(p.label)).filter(Boolean);
  const news = tariffNewsMarkup();
  return `
  <section class="hero container" style="padding-bottom:32px">
    <div class="stack" style="--stack:20px;max-width:820px">
      <p class="eyebrow reveal">SP Group tariff</p>
      <h1 class="display reveal reveal-delay-1">SP Group&rsquo;s electricity tariff for ${esc(TARIFF_PERIOD)}.</h1>
      <p class="lead reveal reveal-delay-2">If you&rsquo;ve never switched electricity retailer, you pay SP Group&rsquo;s regulated tariff: ${TARIFF}¢ per kWh, including GST, for ${esc(TARIFF_PERIOD)}. It changes every quarter. Here&rsquo;s what it costs a typical home, and what the plans on the market cost instead.</p>
    </div>
    <div class="stats guide-stats reveal" style="margin-top:32px">
      <div class="stat"><span class="stat__num">${TARIFF}¢</span><span class="stat__label">per kWh, incl. GST, ${esc(TARIFF_PERIOD)}</span></div>
      <div class="stat"><span class="stat__num">${cheaper} of ${PLAN_COUNT}</span><span class="stat__label">plans cost less than the tariff for a home using ${kwh} kWh a month</span></div>
      <div class="stat"><span class="stat__num">${lowestFixedRate().toFixed(2)}¢</span><span class="stat__label">lowest fixed rate on a contract of up to 24 months</span></div>
    </div>
  </section>

  <section class="container" style="padding-bottom:clamp(48px,8vw,96px)">
    <div class="section-head">
      <h2 class="h2">What the tariff costs each type of home.</h2>
      <p class="lead">A typical monthly bill on SP Group&rsquo;s tariff, next to the lowest-cost plan at the same usage.</p>
    </div>
    <div class="table-scroll guide-table">
      <table class="plan-table">
        <thead><tr><th>Home</th><th class="num-cell">On the tariff</th><th>Lowest plan</th><th class="num-cell">Save/yr</th></tr></thead>
        <tbody>${homes.map((h) => `
            <tr>
              <td><a href="${h.href}"><strong>${esc(cap(h.name))}</strong></a><span class="muted">about ${h.kwh} kWh a month</span></td>
              <td class="num-cell">${fmtMoney(h.onTariff, 2)}</td>
              <td>${h.best ? `${esc(h.best.plan.retailer)} · ${esc(h.best.plan.name)}<span class="muted">${esc(rateLabel(h.best.plan))} · ${fmtMoney(h.best.total, 2)}/mo</span>` : '—'}</td>
              <td class="num-cell save-pos">${h.best ? fmtMoney(Math.max(0, h.best.savingYearly)) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="small muted-note" style="margin-top:12px">Retailer rates as at ${esc(RATES_DATE)}. Promotions are not included. Usage figures are rounded averages: your SP Group bill shows your own.</p>
  </section>

  <section class="section section--cloud container">
    <div class="grid-2 grid-2--top">
      <div class="stack" style="--stack:14px">
        <h2 class="h2">How the tariff works.</h2>
        <ul class="guide-list">
          <li>SP Group reviews the tariff every quarter, for January, April, July and October, and the Energy Market Authority (EMA) approves it.</li>
          <li>It follows the cost of the fuel used to generate electricity, so it can go up or down each quarter.</li>
          <li>A fixed-price plan keeps the same rate for its whole contract, whatever happens to the tariff. A discount-off-tariff plan moves with the tariff.</li>
          <li>You don&rsquo;t have to stay on the tariff. Homes can buy electricity from a retailer instead, and SP Group still delivers it through the same wires and meter.</li>
        </ul>
      </div>
      <div class="stack" style="--stack:14px">
        <h2 class="h2">Plans by home.</h2>
        ${otherPages(null)}${news ? `
        <h2 class="h3" style="margin-top:16px">Tariff news.</h2>
        ${news}` : ''}
      </div>
    </div>
  </section>
  ${ctaBanner(null, "Hi Eutility, I'm on SP Group's tariff and I'd like to check my electricity savings.")}`;
}
