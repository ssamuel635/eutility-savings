// The FAQ questions and answers. Used by the FAQ page (live search) and by
// tools/prerender.mjs, which writes the same markup into faq.html so search
// engines and AI tools can read it without running JavaScript.

import { CONFIG, waLink } from '../config.js';
import { MARKET_PLANS, PLAN_COUNT } from '../calc.js';

const retailers = [...new Set(MARKET_PLANS.map((p) => p.retailer))].sort();

// Draft answers — review with Eutility (esp. switching process, fees, how Eutility
// is paid, and data handling) before launch. Written for Singapore homes; company
// facts (founding year, UEN, address) are from the ACRA record for UEN 201624008N.
export const FAQ = [
  {
    group: 'About Eutility',
    items: [
      {
        q: 'Who is Eutility?',
        a: `<p>Eutility is an independent energy and utility management company, founded in Australia in ${CONFIG.company.foundedAu}. We don&rsquo;t sell electricity: we compare what the retailers offer and help Singapore homes switch to a plan that suits them.</p>
            <p>${CONFIG.company.sgEntity} (UEN ${CONFIG.company.sgUen}) has had an office here since ${CONFIG.company.sgIncorporated}, at ${CONFIG.company.sgAddress}.</p>`,
      },
      {
        q: 'Are you an electricity retailer?',
        a: `<p>No, and that&rsquo;s the point. Eutility doesn&rsquo;t generate or supply energy. Our job is independent advice: compare what the retailers are offering, backed by our own data analysis, and tell you which one suits you.</p>
            <p>If your current plan is already the best one for your usage, we&rsquo;ll say so. You stay with SP Group or whoever you&rsquo;re with, and nothing changes. You always pay your retailer directly, never through us.</p>`,
      },
      {
        q: 'Does it cost anything to use Eutility?',
        a: '<p>Checking your savings is free, and there&rsquo;s no obligation to switch. You always pay your retailer directly for your electricity.</p>',
      },
      {
        q: 'Are you actually based in Singapore?',
        a: `<p>Yes. ${CONFIG.company.sgEntity} is registered in Singapore (UEN ${CONFIG.company.sgUen}) and our office is at ${CONFIG.company.sgAddress}. Reach the Singapore team on <a href="${waLink()}" data-wa>WhatsApp</a>, by phone at ${CONFIG.phone}, or by email at <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>.</p>`,
      },
      {
        q: 'Where can I read Eutility&rsquo;s terms and privacy statement?',
        a: `<p>On our <a href="legal.html">Legal page</a>: the <a href="legal.html#privacy">Privacy Statement</a> and the <a href="legal.html#terms">Website Terms and Conditions</a>.</p>`,
      },
      {
        q: 'What does &ldquo;Get control&rdquo; mean?',
        a: '<p>It&rsquo;s Eutility&rsquo;s promise to its clients: don&rsquo;t overpay for energy, and know exactly what you&rsquo;re paying for. For a home, that means knowing whether your plan still makes sense for how much you use, and having someone independent to check it.</p>',
      },
    ],
  },
  {
    group: 'Savings',
    items: [
      {
        q: 'How are my savings calculated?',
        a: `<p>We multiply your monthly usage (kWh) by each plan’s published rate, add any daily charge, and compare that with what you pay on your current plan. The difference × 12 is your yearly saving.</p>
            <ul><li>Discount-off-tariff plans use SP Group’s regulated tariff.</li>
            <li>Time-of-use plans assume a share of your usage is off-peak (30% by default; you can change it under <em>Advanced assumptions</em>).</li>
            <li>Sign-up promotions are shown separately and not added to your savings.</li></ul>
            <p>It’s an estimate. Your real bill depends on your actual usage and the retailer’s contract.</p>`,
      },
      {
        q: 'Which retailers can I compare?',
        a: `<p>We currently compare ${PLAN_COUNT} residential plans from ${retailers.join(', ')}, against SP Group’s regulated tariff as the baseline.</p><p>SP Group revises its tariff every quarter, and we update it when it changes.</p>`,
      },
      {
        q: 'Where do I find my monthly usage?',
        a: '<p>On your electricity bill, look for the electricity usage in kWh for the month. If not, just send a photo of the bill to us via WhatsApp and we’ll read it for you!</p>',
      },
    ],
  },
  {
    group: 'Switching',
    items: [
      {
        q: 'How do I switch?',
        a: `<p>Tap <strong>Switch on WhatsApp</strong> or <strong>Switch by email</strong> on your results. That sends your details to our Singapore office: on WhatsApp, or by email to <a href="mailto:${CONFIG.email}">${CONFIG.email}</a> if you&rsquo;d rather not use WhatsApp. We confirm the plan with you, help you sign up with the retailer, and the retailer confirms your start date.</p><p>Nothing is submitted to a retailer without you agreeing to it first.</p>`,
      },
      {
        q: 'Will my electricity supply be interrupted?',
        a: '<p>No. SP Group continues to deliver electricity through the same grid and meter. Only the company you buy electricity from, and your price, changes.</p>',
      },
      {
        q: 'What if I’m still in a contract?',
        a: '<p>Your current retailer may charge an early termination fee. We show each plan’s fee and deposit where the retailer publishes them, and can help you time the switch to avoid fees.</p>',
      },
      {
        q: 'Is there a deposit?',
        a: '<p>Some retailers ask for a security deposit, usually set by your home type; others waive it or keep your existing SP Services deposit. Each plan’s deposit is shown with your results, under “Fees and deposit” in the full plan list.</p>',
      },
    ],
  },
  {
    group: 'Talking to us',
    items: [
      {
        q: 'How does WhatsApp work?',
        a: `<p>Tap any <strong>Chat on WhatsApp</strong> button. WhatsApp opens with a message already written. Send it with a photo of your bill and someone from our Singapore office replies with your savings, during business hours.</p><p>On a computer without WhatsApp, scan the QR code with your phone instead.</p>`,
      },
      {
        q: 'I don’t use WhatsApp. Can I email instead?',
        a: `<p>Yes. Use <strong>Switch by email</strong> on your results, or <strong>Email us instead</strong> at the bottom of any page, and the same details are sent by email. You can also write to <a href="mailto:${CONFIG.email}">${CONFIG.email}</a> any time, or call <a href="tel:${CONFIG.phone.replace(/\s/g, '')}">${CONFIG.phone}</a>.</p>`,
      },
      {
        q: 'What happens to my bill photo?',
        a: '<p>We use it to read your usage and current plan so we can prepare your estimate and, if you ask, help you switch. See our <a href="legal.html#privacy">Privacy Statement</a> for how data is stored and protected.</p>',
      },
    ],
  },
  {
    group: 'Referrals & rewards',
    items: [
      {
        q: 'How does the referral programme work?',
        a: '<p>Get your personal link on the <a href="referrals.html">Rewards</a> page and share it. When a friend checks their savings and switches through Eutility, the referral counts towards your rewards.</p>',
      },
      {
        q: 'What rewards are available?',
        a: '<p>Rewards and campaigns may include product gifts, vouchers or special prizes. Current campaign details are announced on the Rewards page and on WhatsApp. Terms apply.</p>',
      },
    ],
  },
  {
    group: 'Businesses',
    items: [
      {
        q: 'Can Eutility help my business?',
        a: '<p>If you run a small business, yes. Message us on <a href="#" data-wa data-wa-message="Hi Eutility, I’d like a business electricity quote.">WhatsApp</a> or call <a href="tel:+6597908347">+65 9790 8347</a> and a consultant will quote your sites. Combining usage across locations can unlock a better rate.</p>',
      },
      {
        q: 'Do you only do electricity?',
        a: '<p>Yes. This site compares electricity plans for Singapore homes and small businesses.</p>',
      },
    ],
  },
];

/** Markup for a list of FAQ groups. The first answer starts open unless `allOpen`. */
export function faqMarkup(groups, { allOpen = false } = {}) {
  let first = true;
  return groups.map((g) => `<div class="faq-group"><h2>${g.group}</h2><div class="acc">${g.items.map((it) => {
    const open = allOpen || first;
    first = false;
    return `<details${open ? ' open' : ''}><summary>${it.q}</summary><div class="acc__body">${it.a}</div></details>`;
  }).join('')}</div></div>`).join('');
}
