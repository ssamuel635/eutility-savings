// Write content into the HTML that the browser would otherwise build with JavaScript.
//
//   node tools/prerender.mjs      (npm run seo runs it too)
//
// Search engines, AI tools and link previews often read a page without running its
// scripts, and budget phones show it sooner. This fills these spots, each between
// <!-- prerender:NAME --> and <!-- /prerender:NAME --> markers:
//   faq.html    every question and answer (the page's search re-renders the same markup)
//   news.html   every market news headline; index.html the latest three
//   index.html  "Our picks" and the savings by home type; testimonials.html the
//               savings for every home type
//   electricity-tariff.html and electricity-plans-*.html  the whole page (widgets/guides.js)
//   calculator.html  how it works and each home type's saving, until the calculator mounts
//   every page   the header and footer (shell.js), so their links are in the HTML
// They come from the same data the pages use, so re-run after a price update.
// tools/news/apply.py runs it after publishing news.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { FAQ, faqMarkup } = await load('assets/js/data/faq.js');
const { newsPageMarkup, homeNewsMarkup } = await load('assets/js/services/news-service.js');
const { picksMarkup, picksLead } = await load('assets/js/widgets/picks.js');
const { homeStories, storyCard, HOME_PAGES } = await load('assets/js/widgets/home-story.js');
const { tariffPageMarkup, homeTypePageMarkup, calculatorFallbackMarkup } = await load('assets/js/widgets/guides.js');
const { header, footer } = await load('assets/js/shell.js');
const { photo, HERO_SIZES } = await load('assets/js/data/photos.js');

// The copies are marked data-static: styles.css shows them until the page script runs
// (initLayout() swaps in the live ones) and, with the <noscript> style, when JavaScript is off.
const asCopy = (html) => html.replace(/<(a class="skip-link"|header class="site-header"|footer class="site-footer")/g, '<$1 data-static');
const NOSCRIPT = '<noscript><style>[data-static] { display: block !important; } html:not(.shell-ready) body { padding-top: 0 !important; } .no-js body::after { content: none; }</style></noscript>';

// Every page in the site root, with its body[data-page] key
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
  .map((file) => ({ file, page: fs.readFileSync(path.join(ROOT, file), 'utf8').match(/<body data-page="([^"]+)"/)?.[1] }))
  .filter((p) => p.page);

const SPOTS = [
  { file: 'faq.html', name: 'faq', html: () => faqMarkup(FAQ), after: /<div id="faq-list"[^>]*>/ },
  { file: 'news.html', name: 'news', html: () => newsPageMarkup(), after: /<div class="news-feed" id="news-feed">/ },
  { file: 'index.html', name: 'news', html: () => homeNewsMarkup(), after: /<!-- Market news[^>]*-->/ },
  // Same photo as pages/home.js: in the HTML it starts downloading with the page, scripts or not
  { file: 'index.html', name: 'hero-photo', html: () => photo('sofa', { eager: true, sizes: HERO_SIZES }), after: /<div class="hero__photo photo-frame" id="hero-photo">/ },
  { file: 'index.html', name: 'picks-lead', html: () => picksLead(), after: /<p class="lead" id="picks-lead">/ },
  { file: 'index.html', name: 'picks', html: () => picksMarkup(), after: /<div class="picks" id="plan-teaser">/ },
  // Same three homes as pages/home.js
  { file: 'index.html', name: 'stories', html: () => homeStories(['HDB 3-room', 'HDB 5-room', 'Condo']).map(storyCard).join(''), after: /<div class="grid-3" id="home-testimonials">/ },
  { file: 'testimonials.html', name: 'stories', html: () => homeStories().map(storyCard).join(''), after: /<div class="grid-3" id="t-grid">/ },
  { file: 'calculator.html', name: 'calculator', html: () => calculatorFallbackMarkup(), after: /<div class="calc-layout" id="res-mount">/ },
  { file: 'electricity-tariff.html', name: 'guide', html: () => tariffPageMarkup(), after: /<main id="main">/ },
  ...Object.entries(HOME_PAGES).map(([label, file]) => ({ file, name: 'guide', html: () => homeTypePageMarkup(label), after: /<main id="main">/ })),
  ...PAGES.flatMap(({ file, page }) => [
    { file, name: 'noscript', html: () => NOSCRIPT, after: /<link rel="stylesheet" href="assets\/css\/styles.css">/ },
    { file, name: 'header', html: () => asCopy(header(page)), after: /<body data-page="[^"]+">/ },
    { file, name: 'footer', html: () => asCopy(footer()), before: /<\/body>/ },
  ]),
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
    const m = s.match(spot.after || spot.before);
    if (!m) { console.error(`${spot.file}: couldn't find where to put the ${spot.name} block`); failed = true; continue; }
    s = s.replace(m[0], () => (spot.after ? `${m[0]}\n  ${block}` : `${block}\n${m[0]}`));
  }
  fs.writeFileSync(file, s);
  console.log(`${spot.file.padEnd(12)} ${spot.name} written`);
}
process.exit(failed ? 1 : 0);
