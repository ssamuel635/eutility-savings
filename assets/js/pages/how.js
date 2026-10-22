// How it works: the WhatsApp assistant's real flow (FXMedia's chatbot script),
// drawn as the WhatsApp chat itself, with the example figures computed live
// from the price sheet. Each chat plays message by message as it scrolls into
// view, with "typing…" before each reply, like the real conversation.
import { initLayout, observeReveals } from '../layout.js';
import { compare, TARIFF, fmtMoney, PLAN_COUNT, rateLabel } from '../calc.js';
import { countUp, reducedMotion } from '../fx.js';
import * as I from '../icons.js';

initLayout();

// Example: a home using 450 kWh a month on SP Group's tariff.
const example = compare({ kwh: 450, contract: '24' });
const best = example.best;
const yearly = Math.max(0, Math.round(best?.savingYearly || 0));
document.querySelectorAll('[data-plan-count]').forEach((e) => { e.textContent = String(PLAN_COUNT); });
document.querySelectorAll('[data-tariff]').forEach((e) => { e.textContent = `${TARIFF}¢/kWh`; });
document.querySelectorAll('[data-logo]').forEach((e) => { e.innerHTML = '<img src="assets/img/eutility-symbol.png" alt="" width="22" height="22">'; });
document.querySelectorAll('[data-icon]').forEach((e) => { e.innerHTML = I[e.dataset.icon] || ''; });
document.querySelector('[data-current]').textContent = `SP Group @ ${TARIFF}¢/kWh`;
document.querySelector('[data-recommended]').textContent = best ? `${best.plan.retailer} @ ${rateLabel(best.plan)}` : '—';
document.querySelector('[data-monthly]').textContent = best ? `That's ${fmtMoney(best.savingMonthly)} a month.` : '';
document.querySelector('[data-example]').textContent = 'Example: a home using 450 kWh a month, on today’s published rates.';
document.querySelector('#step3 .wac').setAttribute('aria-label', best
  ? `Example WhatsApp chat: your savings report. Current: SP Group at ${TARIFF}¢/kWh. Recommended: ${best.plan.retailer} at ${rateLabel(best.plan)}. You save ${fmtMoney(yearly)} a year.`
  : 'Example WhatsApp chat: your savings report.');

const count = document.querySelector('[data-count]');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Show one chat's messages in turn: replies from Eutility get "typing…" first. */
async function play(visual) {
  const msgs = [...visual.querySelectorAll('.wac-msg')];
  const typing = visual.querySelector('.wac__typing');
  const show = (m) => {
    m.classList.add('is-in');
    if (m.contains(count)) countUp(count, yearly);
  };
  if (reducedMotion()) { msgs.forEach(show); return; }
  await sleep(350);
  for (const m of msgs) {
    if (m.classList.contains('wac-msg--in')) {
      typing.classList.add('is-on');
      await sleep('quick' in m.dataset ? 650 : 1100);
      typing.classList.remove('is-on');
    } else {
      await sleep(500);
    }
    show(m);
    await sleep(350);
  }
}

if (reducedMotion()) count.textContent = yearly.toLocaleString('en-SG');
document.querySelectorAll('.journey__visual').forEach((v) => {
  v.addEventListener('inview', () => play(v), { once: true });
});
observeReveals();
