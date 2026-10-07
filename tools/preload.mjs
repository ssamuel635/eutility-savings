// Flatten the JS import waterfall.
//
//   node tools/preload.mjs
//
// Each page loads one module, which imports others, which import others — five
// levels deep. The browser only discovers each level after downloading the one
// above it, so on a phone that's five round trips before the page can render.
// This writes a <link rel="modulepreload"> for every module a page needs, so
// they're all requested at once, in parallel, as soon as the HTML arrives.
//
// Re-run it whenever you add or remove an import. It only touches the block
// between the <!-- modulepreload --> markers, so it's safe to run repeatedly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const START = '<!-- modulepreload -->';
const END = '<!-- /modulepreload -->';

function deps(file) {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)]
    .map((m) => path.normalize(path.join(path.dirname(file), m[1])));
}

function graph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const d of deps(entry)) graph(d, seen);
  return seen;
}

let changed = 0;
for (const html of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const file = path.join(ROOT, html);
  let s = fs.readFileSync(file, 'utf8');
  const m = s.match(/<script type="module" src="([^"]+)"><\/script>/);
  if (!m) continue;
  const entry = path.join(ROOT, m[1]);
  const mods = [...graph(entry)]
    .filter((f) => f !== entry)          // the entry script itself is already requested
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .sort();
  const block = [START, ...mods.map((u) => `<link rel="modulepreload" href="${u}">`), END].join('\n  ');

  if (s.includes(START)) {
    s = s.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    s = s.replace(m[0], `${block}\n  ${m[0]}`);
  }
  fs.writeFileSync(file, s);
  changed++;
  console.log(`${html.padEnd(20)} ${mods.length} modules preloaded`);
}
console.log(`\n${changed} pages updated`);
