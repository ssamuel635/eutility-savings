// Market news markup, and that the pages carry the headlines in news.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NEWS } from '../assets/js/data/news.js';
import { latest, newsPageMarkup, homeNewsMarkup, niceDate } from '../assets/js/services/news-service.js';

const item = (id, date, extra = {}) => ({ id, date, title: `Headline ${id}`, source: 'SP Group', kind: 'official', url: `https://example.sg/${id}`, ...extra });
const SAMPLE = [item('a', '2026-09-29'), item('b', '2026-10-15', { kind: 'news', source: 'CNA' }), item('c', '2026-10-02'), item('d', '2026-08-01')];

test('latest: newest first, limited', () => {
  assert.deepEqual(latest(3, SAMPLE).map((x) => x.id), ['b', 'c', 'a']);
});

test('dates read the Singapore way', () => {
  assert.equal(niceDate('2026-10-05'), '5 Oct 2026');
});

test('news page groups by month, newest month first', () => {
  const html = newsPageMarkup(SAMPLE);
  const months = [...html.matchAll(/<h2 class="h4">([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(months, ['October 2026', 'September 2026', 'August 2026']);
  assert.match(html, /tag tag--official">Official/);
  assert.match(html, /class="tag">News/);
});

test('headlines are escaped and only https links are used', () => {
  const html = newsPageMarkup([item('x', '2026-10-01', { title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' })]);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
});

test('no news: the page says so and the homepage shows nothing', () => {
  assert.match(newsPageMarkup([]), /No market news yet/);
  assert.match(homeNewsMarkup([]), /No market news yet/);
  assert.equal((homeNewsMarkup(SAMPLE).match(/class="news-card"/g) || []).length, 3);
});

test('news.html and index.html are in step with news.js (run npm run seo if not)', () => {
  const page = fs.readFileSync(new URL('../news.html', import.meta.url), 'utf8');
  const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const it of NEWS) assert.ok(page.includes(`href="${it.url}"`), `news.html is missing ${it.url}`);
  for (const it of latest(3)) assert.ok(home.includes(`href="${it.url}"`), `index.html is missing ${it.url}`);
  assert.equal((page.match(/class="news-item"/g) || []).length, NEWS.length);
});
