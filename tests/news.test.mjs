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
  assert.ok(!html.includes('<img src=x'), 'the headline is escaped');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('javascript:'));
  assert.equal((html.match(/<img /g) || []).length, 1, 'the only image is our topic photo');
});

test('each headline gets its topic photo; a topic staff chose wins over the keywords', async () => {
  const { topicOf } = await import('../assets/js/data/news-topics.js');
  const t = (title, topic) => topicOf({ title, topic }).key;
  assert.equal(t('Electricity Tariff Revision for the Period 1 October to 31 December 2026'), 'tariff');
  assert.equal(t('Indonesia gas cut unlikely to hit Singapore electricity prices'), 'gas', 'the story is the gas cut');
  assert.equal(t('Singapore launches five-year energy infrastructure plan to meet growing demand, sets new solar target'), 'grid');
  assert.equal(t('Singapore aiming for more solar panels in public spaces'), 'solar');
  assert.equal(t('S’pore to drill deeper into geothermal energy'), 'climate');
  assert.equal(t('New retailer joins the Open Electricity Market'), 'retailer');
  assert.equal(t('Minister speaks on energy security'), 'policy', 'no match: the general photo');
  assert.equal(t('Minister speaks on energy security', 'solar'), 'solar', 'staff choice');
  assert.equal(t('Minister speaks', 'bogus'), 'policy', 'an unknown topic is ignored');
  const html = newsPageMarkup([item('x', '2026-10-01', { title: 'Electricity tariff to rise' })]);
  assert.match(html, /srcset="assets\/img\/news\/tariff-400\.webp 400w, assets\/img\/news\/tariff-800\.webp 800w"/);
  assert.match(html, /src="assets\/img\/news\/tariff\.jpg" alt=""/);
  for (const topic of (await import('../assets/js/data/news-topics.js')).NEWS_TOPICS) {
    for (const f of [`${topic.photo.name}.jpg`, `${topic.photo.name}-400.webp`, `${topic.photo.name}-800.webp`]) {
      assert.ok(fs.existsSync(new URL(`../assets/img/news/${f}`, import.meta.url)), `${f} is missing`);
    }
  }
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
