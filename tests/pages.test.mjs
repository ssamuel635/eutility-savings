// Pages built from the price sheet: the home page picks, the SP Group tariff
// page and the home-type pages, and that the HTML on disk matches the current
// prices (run `npm run seo` after a price update if this fails).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare, TARIFF, TARIFF_PERIOD } from '../assets/js/calc.js';
import { CONFIG } from '../assets/js/config.js';
import { picks, picksMarkup, picksLead } from '../assets/js/widgets/picks.js';
import { HOME_PAGES, homeStories, storyCard } from '../assets/js/widgets/home-story.js';
import { homeFacts, homeTypePageMarkup, tariffPageMarkup } from '../assets/js/widgets/guides.js';

const block = (file, name) => {
  // Git may check the pages out with Windows line endings; compare the text only.
  const s = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const m = s.match(new RegExp(`<!-- prerender:${name} -->([\\s\\S]*?)<!-- /prerender:${name} -->`));
  return m ? m[1] : null;
};

test('picks come only from the featured retailers (any, when none are set), no plan twice', () => {
  const list = picks();
  assert.ok(list.length > 0);
  const only = CONFIG.featuredRetailers;
  for (const [, r] of list) assert.ok(!only.length || only.includes(r.plan.retailer), r.plan.retailer);
  assert.equal(new Set(list.map(([, r]) => r.id)).size, list.length);
});

test('every home preset has its own page file', () => {
  for (const p of CONFIG.homePresets) {
    const file = HOME_PAGES[p.label];
    assert.ok(file, `no page for ${p.label}`);
    assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `${file} is missing`);
  }
});

test('home-type page leads with the cheapest plan at that usage', () => {
  for (const p of CONFIG.homePresets) {
    const f = homeFacts(p.label);
    const best = compare({ kwh: p.kwh, contract: 'any' }).results[0];
    assert.equal(f.results[0].plan.id, best.plan.id);
    const html = homeTypePageMarkup(p.label);
    assert.match(html, new RegExp(`about ${p.kwh} kWh`));
    assert.ok(html.includes(`${best.plan.retailer}</strong> · ${best.plan.name}`));
    assert.ok(!html.includes(`href="${HOME_PAGES[p.label]}"`), 'a page should not link to itself');
  }
});

test('tariff page shows this quarter’s tariff and links every home page', () => {
  const html = tariffPageMarkup();
  assert.ok(html.includes(`${TARIFF}¢`));
  assert.ok(html.includes(TARIFF_PERIOD));
  for (const file of Object.values(HOME_PAGES)) assert.ok(html.includes(`href="${file}"`), file);
});

test('the HTML matches the current prices (run npm run seo if not)', () => {
  assert.equal(block('index.html', 'picks'), picksMarkup());
  assert.equal(block('index.html', 'picks-lead'), picksLead());
  assert.equal(block('index.html', 'stories'), homeStories(['HDB 3-room', 'HDB 5-room', 'Condo']).map(storyCard).join(''));
  assert.equal(block('testimonials.html', 'stories'), homeStories().map(storyCard).join(''));
  assert.equal(block('electricity-tariff.html', 'guide'), tariffPageMarkup());
  for (const [label, file] of Object.entries(HOME_PAGES)) assert.equal(block(file, 'guide'), homeTypePageMarkup(label), file);
});

test('every page starts with its doctype, with the header and footer copies inside <body>', () => {
  // Anything before <!doctype html> puts browsers in quirks mode (27 Oct 2026: the
  // footer copy landed there and pages looked unstyled while loading).
  for (const file of fs.readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'))) {
    const s = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(s, /^<!doctype html>/i, `${file} doesn't start with <!doctype html>`);
    const body = s.indexOf('<body'), end = s.lastIndexOf('</body>');
    for (const name of ['header', 'footer']) {
      const at = s.indexOf(`<!-- prerender:${name} -->`);
      assert.ok(at > body && at < end, `${file}: the ${name} copy isn't inside <body>`);
    }
    assert.ok(!/<(header|footer) class="site-(header|footer)"(?! data-static)/.test(s), `${file}: a header or footer copy without data-static`);
  }
});
