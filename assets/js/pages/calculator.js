import { initLayout, pauseBarAction, resumeBarAction } from '../layout.js';
import { PLAN_COUNT, RETAILER_COUNT } from '../calc.js';
import { mountResidential } from '../widgets/residential.js';
import { mountSme } from '../widgets/sme.js';

initLayout();

const q = new URLSearchParams(location.search);
const resMount = document.getElementById('res-mount');
const calc = mountResidential(resMount, {
  mode: 'full',
  initial: { kwh: q.get('kwh'), plan: q.get('plan'), contract: q.get('contract') },
});

// Empty state until the first calculation
const results = resMount.querySelector('.res-results');
results.innerHTML = `
  <div class="results-empty">
    <div class="ghost-bars" aria-hidden="true"><span style="width:90%"></span><span style="width:70%"></span><span style="width:78%"></span><span style="width:55%"></span></div>
    <p class="h4" style="color:var(--text)">Your results will appear here</p>
    <p class="small">Set your usage and current plan, then tap Calculate my savings.</p>
  </div>`;

const panelRes = document.getElementById('panel-res');
const panelSme = document.getElementById('panel-sme');
const lead = document.getElementById('calc-lead');
let smeMounted = false;

function setMode(mode, push) {
  const sme = mode === 'sme';
  document.getElementById(sme ? 'mode-sme' : 'mode-res').checked = true;
  panelRes.hidden = sme;
  panelSme.hidden = !sme;
  lead.textContent = sme
    ? 'For businesses, a consultant quotes all your sites together.'
    : `Compare your current plan against ${PLAN_COUNT} residential plans from ${RETAILER_COUNT} Singapore retailers.`;
  // The phone bar's "Switch & save" belongs to the household result, not the SME tab.
  if (sme) pauseBarAction(); else resumeBarAction();
  if (sme && !smeMounted) { mountSme(panelSme); smeMounted = true; }
  const shown = sme ? panelSme : panelRes;
  shown.classList.remove('panel-in'); void shown.offsetWidth; shown.classList.add('panel-in');
  if (push) history.replaceState(null, '', sme ? '#sme' : location.pathname + location.search);
}

document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => setMode(r.value, true)));
setMode(location.hash === '#sme' ? 'sme' : 'residential');
addEventListener('hashchange', () => setMode(location.hash === '#sme' ? 'sme' : 'residential'));

if (q.get('run') === '1') calc.run();
