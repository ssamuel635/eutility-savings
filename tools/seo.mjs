// Search and sharing tags for every page, from one table.
//
//   node tools/seo.mjs            (or: npm run seo)
//
// Writes each page's <title>, meta description, robots, canonical link and
// social-share (Open Graph) tags. Titles are what Google shows as the blue
// link, so they lead with what people search for; the on-page headings keep
// the brand's voice and are not touched.
//
// Counts and the rates month come from assets/js/data/plans.js, so re-run this
// after the weekly price check is applied (build_data.py) to keep them current.
//
// LAUNCH DAY: set SITE_URL to the real domain (or run with SITE_URL=...).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_URL = (process.env.SITE_URL || 'https://eutility-savings.vercel.app').replace(/\/$/, '');

const { META } = await import(pathToFileURL(path.join(ROOT, 'assets/js/data/plans.js')).href);
const rates = new Date(`${META.ratesAsAt}T00:00:00+08:00`);
const month = rates.toLocaleDateString('en-SG', { month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });
const day = rates.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
const { planCount: plans, retailerCount: retailers } = META;

// index: false keeps a page out of search results (account pages, errors).
const PAGES = {
  'index.html': {
    title: 'Compare Singapore Electricity Plans — Eutility',
    description: `Compare all ${plans} home electricity plans from Singapore’s ${retailers} retailers for your usage, or send us your bill on WhatsApp and we’ll handle the switch. Free.`,
  },
  'plans.html': {
    title: `Singapore Electricity Plans & Prices, ${month} — Eutility`,
    description: `Every home electricity plan in Singapore, priced for your usage: fixed, discount, no lock-in and green plans from ${retailers} retailers. Rates as at ${day}.`,
  },
  'calculator.html': {
    title: 'Singapore Electricity Savings Calculator — Eutility',
    description: 'Enter your usage and current plan to see the cheapest Singapore electricity plans for you and your yearly saving. Businesses can check savings across sites.',
  },
  'how-it-works.html': {
    title: 'How to Switch Electricity Retailer in Singapore — Eutility',
    description: 'Send a photo of your electricity bill on WhatsApp. Eutility checks it independently, shows your savings and helps you switch to your new retailer.',
  },
  'faq.html': {
    title: 'Switching Electricity Retailer in Singapore: FAQ — Eutility',
    description: 'Switching electricity retailer in Singapore: how we work out savings, which retailers we compare, contracts, WhatsApp, referrals and business services.',
  },
  'about.html': {
    title: 'About Eutility: Independent Energy Experts Since 1979',
    description: 'Eutility is an independent, family-owned energy and utility management company, founded in Australia in 1979, with an office in Singapore.',
  },
  'testimonials.html': {
    title: 'Eutility Reviews: What Our Clients Say',
    description: 'What Eutility’s clients say, and what switching could save a typical Singapore home.',
  },
  'referrals.html': {
    title: 'Refer a Friend, Earn Rewards — Eutility',
    description: 'Get your friends switched to a better electricity plan, climb the leaderboard and earn rewards with Eutility.',
  },
  'legal.html': {
    title: 'Privacy Policy & Terms — Eutility',
    description: 'Eutility Singapore’s Privacy Statement, Website Terms and Conditions and Master Services Agreement terms.',
  },
  'login.html': { title: 'Log in — Eutility', description: 'Log in to your Eutility account to see your savings checks, bills and rewards.', index: false },
  'signup.html': { title: 'Create your account — Eutility', description: 'Set up your Eutility account: your details, your home, your electricity details and, if you like, your latest bill.', index: false },
  'account.html': { title: 'My account — Eutility', description: 'Your Eutility account: profile, electricity details, saved savings checks, bills and rewards.', index: false },
  '404.html': { title: 'Page not found — Eutility', description: 'Page not found.', index: false, canonical: false },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const urlOf = (file) => `${SITE_URL}/${file === 'index.html' ? '' : file}`;

function block(file, p) {
  const tags = [];
  if (p.index === false) tags.push('<meta name="robots" content="noindex">');
  if (p.canonical !== false) tags.push(`<link rel="canonical" href="${urlOf(file)}">`);
  tags.push(
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Eutility Singapore">',
    '<meta property="og:locale" content="en_SG">',
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:url" content="${urlOf(file)}">`,
    `<meta property="og:image" content="${SITE_URL}/assets/img/og-image.jpg">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="Eutility: Stop overpaying for electricity. Compare Singapore home electricity plans in about a minute.">',
    '<meta name="twitter:card" content="summary_large_image">',
  );
  return ['<!-- social -->', ...tags, '<!-- /social -->'].join('\n  ');
}

const problems = [];
for (const [file, p] of Object.entries(PAGES)) {
  const full = path.join(ROOT, file);
  let s = fs.readFileSync(full, 'utf8');
  const before = s;
  s = s.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`);
  s = s.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.description)}">`);
  s = s.replace(/[ \t]*<meta name="robots"[^>]*>\n/g, '');
  // The block runs from the marker to its end marker (or, the first time, to the twitter:card line).
  const end = s.includes('<!-- /social -->') ? /<!-- social -->[\s\S]*?<!-- \/social -->/ : /<!-- social -->[\s\S]*?<meta name="twitter:card"[^>]*>/;
  s = s.replace(end, block(file, p));
  if (!s.includes('<!-- /social -->')) problems.push(`${file}: no <!-- social --> block`);
  if (p.title.length > 60) problems.push(`${file}: title is ${p.title.length} characters (Google cuts off around 60)`);
  if (p.description.length > 160) problems.push(`${file}: description is ${p.description.length} characters (aim for 160 or fewer)`);
  if (s !== before) fs.writeFileSync(full, s);
  console.log(`${file.padEnd(18)} ${p.index === false ? 'noindex ' : ''}${p.title}`);
}

const missing = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !PAGES[f]);
if (missing.length) problems.push(`not in the table: ${missing.join(', ')}`);
if (problems.length) {
  console.error(`\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\nSite address: ${SITE_URL}`);
