// Write content into the HTML that the browser would otherwise build with JavaScript.
//
//   node tools/prerender.mjs      (npm run seo runs it too)
//
// Search engines, AI tools and link previews often read a page without running its
// scripts, and budget phones show it sooner. This fills these spots, each between
// <!-- prerender:NAME --> and <!-- /prerender:NAME --> markers:
//   faq.html    every question and answer (the page's search re-renders the same markup)
//   news.html   every market news headline; index.html the latest three
// They come from the same data the pages use, so re-run after a price update.
// tools/news/apply.py runs it after publishing news.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { FAQ, faqMarkup } = await load('assets/js/data/faq.js');
const { newsPageMarkup, homeNewsMarkup } = await load('assets/js/services/news-service.js');

const SPOTS = [
  { file: 'faq.html', name: 'faq', html: () => faqMarkup(FAQ), after: /<div id="faq-list"[^>]*>/ },
  { file: 'news.html', name: 'news', html: () => newsPageMarkup(), after: /<div class="news-feed" id="news-feed">/ },
  { file: 'index.html', name: 'news', html: () => homeNewsMarkup(), after: /<!-- Market news[^>]*-->/ },
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
