// How it works: the WhatsApp assistant's real flow (FXMedia's chatbot script),
// with the example figures computed live from the price sheet.
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
document.querySelector('[data-monthly]').textContent = best ? `That's ${fmtMoney(best.savingMonthly)} a month` : '';
document.querySelector('[data-example]').textContent = 'Example: a home using 450 kWh a month, on today’s published rates.';

if (reducedMotion()) document.querySelector('[data-count]').textContent = yearly.toLocaleString('en-SG');
document.getElementById('step3').addEventListener('inview', () => {
  countUp(document.querySelector('[data-count]'), yearly);
}, { once: true });
observeReveals();
