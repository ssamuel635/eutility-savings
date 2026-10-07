import { initLayout } from '../layout.js';
import { CONFIG } from '../config.js';
import { AVAILABLE_PLANS, TARIFF } from '../calc.js';
import { META } from '../data/plans.js';
import * as I from '../icons.js';

initLayout();

const retailers = [...new Set(AVAILABLE_PLANS.map((p) => p.retailer))].filter((r) => r !== 'SP Group');

// Draft answers — review with Eutility (esp. switching process, fees, how Eutility
// is paid, and data handling) before launch. Company facts below are taken from
// eutility.com.au, eutility.com.sg (About, FAQs, Procurement pages) and the ACRA record for UEN 201624008N.
const FAQ = [
  {
    group: 'About Eutility',
    items: [
      {
        q: 'Who is Eutility?',
        a: `<p>Eutility is an independent energy and utility management company. It was founded in Australia in ${CONFIG.company.foundedAu}, is still family owned, and helps businesses lower their utility, carbon and telecommunications costs. Today that&rsquo;s ${CONFIG.company.scale}.</p>
            <p>${CONFIG.company.sgEntity} (UEN ${CONFIG.company.sgUen}) has had an office here since ${CONFIG.company.sgIncorporated}, at ${CONFIG.company.sgAddress}. This site brings the same independent advice to Singapore homes and small businesses.</p>`,
      },
      {
        q: 'Are you an electricity retailer?',
        a: `<p>No, and that&rsquo;s the point. Eutility doesn&rsquo;t generate or supply energy. We&rsquo;re registered here as a broker and agent for electric power, and our job is independent advice: compare what the retailers are offering, backed by our own data analysis, and tell you which one suits you.</p>
            <p>If your current plan is already the best one for your usage, we&rsquo;ll say so. You stay with SP Group or whoever you&rsquo;re with, and nothing changes. You always pay your retailer directly, never through us.</p>`,
      },
      {
        q: 'Does it cost anything to use Eutility?',
        a: '<p>Checking your savings is free, and there&rsquo;s no obligation to switch.</p><p class="small"><em>Draft — Eutility to confirm the full commercial arrangement before launch.</em></p>',
      },
      {
        q: 'Are you actually based in Singapore?',
        a: `<p>Yes. ${CONFIG.company.sgEntity} is registered in Singapore (UEN ${CONFIG.company.sgUen}) and our office is at ${CONFIG.company.sgAddress}. Reach the Singapore team on WhatsApp at ${CONFIG.phone}, or by email at <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>.</p>`,
      },
      {
        q: 'Where can I read Eutility&rsquo;s terms and privacy statement?',
        a: `<p>On our <a href="legal.html">Legal page</a>: the <a href="legal.html#privacy">Privacy Statement</a>, the <a href="legal.html#terms">Website Terms and Conditions</a>, and the <a href="legal.html#msa">Master Services Agreement</a> terms that apply to business services.</p>
            <p>For energy terms such as MSS account, contestability or tariff, see Eutility&rsquo;s <a href="${CONFIG.links.glossary}" target="_blank" rel="noopener">glossary of terms</a>. Business clients can also read the <a href="${CONFIG.links.faqs}" target="_blank" rel="noopener">eutility.com.sg FAQs</a>.</p>`,
      },
      {
        q: 'What does &ldquo;Get control&rdquo; mean?',
        a: '<p>It&rsquo;s been Eutility&rsquo;s promise to its clients for decades: don&rsquo;t overpay for energy, and know exactly what you&rsquo;re paying for. For a home, that means knowing whether your plan still makes sense for how much you use, and having someone independent to check it.</p>',
      },
    ],
  },
  {
    group: 'Savings',
    items: [
      {
        q: 'How are my savings calculated?',
        a: `<p>We multiply your monthly usage (kWh) by each plan’s published rate, add any daily charge, and compare that with what you pay on your current plan. The difference × 12 is your yearly saving.</p>
            <ul><li>Discount-off-tariff plans use SP Group’s current regulated tariff (${TARIFF}¢/kWh).</li>
            <li>Time-of-use plans assume a share of your usage is at night (30% by default — you can change it under <em>Advanced assumptions</em>).</li>
            <li>Sign-up promotions are shown separately and not added to your savings.</li></ul>
            <p>It’s an estimate — your real bill depends on your actual usage and the retailer’s contract.</p>`,
      },
      {
        q: 'Which retailers can I compare?',
        a: `<p>We currently compare ${META.planCount} residential plans from: ${retailers.join(', ')} — plus SP Group’s regulated tariff as the baseline.</p><p>Rates are refreshed from our price sheet (last updated ${META.generated}).</p>`,
      },
      {
        q: 'Where do I find my monthly usage?',
        a: '<p>On your SP Group bill, look for the electricity usage in kWh for the month. If you’d rather not look it up, just send a photo of the bill on WhatsApp and we’ll read it for you.</p>',
      },
      {
        q: 'What if switching won’t save me anything?',
        a: '<p>Then we tell you that. If your current plan already beats everything else at your usage, the result says so and there&rsquo;s nothing to do. We&rsquo;d rather you came back next time rates move than switched for no reason.</p>',
      },
    ],
  },
  {
    group: 'Switching',
    items: [
      {
        q: 'How do I switch?',
        a: `<p>Tap <strong>Switch to this plan</strong> on your results. That sends your details to the Singapore team — on WhatsApp, or by email to <a href="mailto:${CONFIG.email}">${CONFIG.email}</a> if you&rsquo;d rather not use WhatsApp. We confirm the plan with you, help you sign up with the retailer, and the retailer confirms your start date.</p><p>Nothing is submitted to a retailer without you agreeing to it first.</p>`,
      },
      {
        q: 'Will my electricity supply be interrupted?',
        a: '<p>No. SP Group continues to deliver electricity through the same grid and meter. Only the company you buy electricity from — and your price — changes.</p>',
      },
      {
        q: 'What if I’m still in a contract?',
        a: '<p>Your current retailer may charge an early termination fee. We show each plan’s fee and deposit where the retailer publishes them, and can help you time the switch to avoid fees.</p>',
      },
      {
        q: 'Is there a deposit?',
        a: '<p>Some retailers ask for a security deposit depending on your home type and citizenship/residency status; others waive it. The deposit for the recommended plan is shown on your results.</p>',
      },
    ],
  },
  {
    group: 'Talking to us',
    items: [
      {
        q: 'How does WhatsApp work?',
        a: `<p>Tap any <strong>Chat on WhatsApp</strong> button. WhatsApp opens with a message already written. Send it with a photo of your bill and we&rsquo;ll reply with your savings.</p><p>On a computer without WhatsApp, scan the QR code with your phone instead.</p>`,
      },
      {
        q: 'I don’t use WhatsApp. Can I email instead?',
        a: `<p>Yes — every WhatsApp button has an email option beside it, and it sends the same details. Write to <a href="mailto:${CONFIG.email}">${CONFIG.email}</a> any time, or call ${CONFIG.phone}.</p>`,
      },
      {
        q: 'What happens to my bill photo?',
        a: '<p>It&rsquo;s used to read your usage and current plan so we can prepare your estimate. See our <a href="legal.html#privacy">Privacy Statement</a> for how data is stored and protected.</p>',
      },
    ],
  },
  {
    group: 'Referrals & rewards',
    items: [
      {
        q: 'How does the referral programme work?',
        a: '<p>Get your personal link on the <a href="referrals.html">Referrals</a> page and share it. When a friend checks their savings and switches through Eutility, the referral counts towards your rewards.</p>',
      },
      {
        q: 'What rewards are available?',
        a: '<p>Rewards and campaigns may include product gifts, vouchers or special prizes. Current campaign details are announced on the Referrals page and on WhatsApp.</p>',
      },
    ],
  },
  {
    group: 'Businesses',
    items: [
      {
        q: 'Can Eutility help my business?',
        a: '<p>Yes. Businesses are what Eutility has done since 1979. Use the <a href="calculator.html#sme">SME calculator</a> to add each of your sites. Combining usage across locations can unlock a better aggregated rate, and a consultant then confirms a quote. Business clients get a dedicated account manager and help desk.</p>',
      },
      {
        q: 'Do you only do electricity?',
        a: `<p>On this site, yes. For businesses, Eutility also offers:</p>
            <ul><li><strong>SmartProcure</strong>: compares multi-year price offers and runs market tenders for competitive retail contracts.</li>
            <li><strong>SmartValidation</strong>: batches, audits and processes multi-site utility invoices to catch errors.</li>
            <li><strong>SmartView</strong>: a 24/7 online portal for live consumption, billing data and financial forecasts.</li>
            <li><strong>Trading services</strong>: wholesale energy, risk management and power purchase agreements (PPAs) for large users.</li>
            <li><strong>Sustainability</strong>: carbon tracking, solar asset management and planning towards net zero.</li></ul>
            <p>Telecommunications costs are covered too. If any of this is relevant to your business, say so when you message us.</p>`,
      },
    ],
  },
];

const list = document.getElementById('faq-list');
document.querySelector('[data-icon-search]').outerHTML = I.search;

function render(filter = '') {
  const f = filter.trim().toLowerCase();
  const strip = (h) => h.replace(/<[^>]+>/g, ' ').toLowerCase();
  let firstOpen = !f;
  const html = FAQ.map((g) => {
    const items = g.items.filter((it) => !f || it.q.toLowerCase().includes(f) || strip(it.a).includes(f));
    if (!items.length) return '';
    return `<div class="faq-group"><h2>${g.group}</h2><div class="acc">${items.map((it) => {
      const open = firstOpen || !!f;
      firstOpen = false;
      return `<details${open ? ' open' : ''}><summary>${it.q}</summary><div class="acc__body">${it.a}</div></details>`;
    }).join('')}</div></div>`;
  }).join('');
  list.innerHTML = html || `<div class="faq-empty"><p class="h4" style="color:var(--text)">No matches for “${filter.replace(/</g, '&lt;')}”</p><p style="margin-top:8px">Try another word, or <a href="#" data-wa data-wa-message="Hi Eutility, I have a question.">ask us on WhatsApp</a>.</p></div>`;

  // One item open at a time (when not searching)
  list.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open && !document.getElementById('faq-q').value) {
      list.querySelectorAll('details[open]').forEach((o) => { if (o !== d) o.open = false; });
    }
  }));
}
render();
document.getElementById('faq-q').addEventListener('input', (e) => render(e.target.value));
