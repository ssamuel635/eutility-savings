import { initLayout } from '../layout.js';
import { compare, TARIFF, fmtMoney } from '../calc.js';
import { META } from '../data/plans.js';
import { countUp, confetti, reducedMotion } from '../fx.js';

initLayout();

// Example figures are computed live from the price sheet (450 kWh on SP tariff).
const example = compare({ kwh: 450, contract: '24' });
const yearly = Math.round(example.best?.savingYearly || 0);
document.querySelectorAll('[data-plan-count]').forEach((e) => { e.textContent = `all ${META.planCount}`; });
document.querySelector('[data-tariff]').textContent = `${TARIFF}¢/kWh`;
document.querySelector('[data-chat-save]').textContent = fmtMoney(yearly);
document.querySelector('[data-logo]').innerHTML = '<img src="assets/img/eutility-symbol.png" alt="" width="22" height="22">';
document.querySelector('[data-example]').textContent =
  `Example: 450 kWh/month on the SP tariff → ${example.best.plan.retailer} ${example.best.plan.name}`;

if (reducedMotion()) document.querySelector('[data-count]').textContent = yearly.toLocaleString('en-SG');
document.getElementById('step3').addEventListener('inview', () => {
  countUp(document.querySelector('[data-count]'), yearly);
}, { once: true });
document.getElementById('step4').addEventListener('inview', () => confetti({ count: 120 }), { once: true });
