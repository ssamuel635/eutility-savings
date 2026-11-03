// The site's scripts must run on iPhones back to iOS 15 (Safari 15). One
// unsupported call stops a page's whole module graph, and the page stays
// half-built: the same symptom as Kenneth's iPhone on 29 Oct 2026. These are
// the commonest JavaScript features newer than Safari 15.0; use the older
// form instead (shown after each).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const NEWER = [
  [/\bObject\.hasOwn\(/, 'Safari 15.4: use Object.prototype.hasOwnProperty.call(obj, key)'],
  [/\.at\(\s*-?\d/, 'Safari 15.4: use arr[arr.length - 1] / arr[i]'],
  [/\bstructuredClone\(/, 'Safari 15.4: use JSON.parse(JSON.stringify(x))'],
  [/\.findLast(Index)?\(/, 'Safari 15.4: loop from the end'],
  [/\.(toSorted|toReversed|toSpliced)\(/, 'Safari 16: copy with [...arr] first'],
  [/\b(Object|Map)\.groupBy\(/, 'Safari 17.4: group with a loop'],
  [/\bPromise\.withResolvers\(/, 'Safari 17.4: new Promise((resolve, reject) => …)'],
  [/\bArray\.fromAsync\(/, 'Safari 16.4: a for await loop'],
  [/^\s*static\s*\{/m, 'Safari 16.4: class static blocks'],
  [/\bimport\b[^;\n]*\b(with|assert)\s*\{\s*type\s*:/, 'Safari 17.2: import JSON with fetch() instead'],
];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('browser scripts use nothing newer than Safari 15 (iOS 15)', () => {
  const root = new URL('../', import.meta.url);
  const scripts = [...files(new URL('assets/js', root).pathname.replace(/^\/([A-Za-z]:)/, '$1')), ...files(new URL('staff', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'))];
  assert.ok(scripts.length > 20, 'found the site scripts');
  const found = [];
  for (const f of scripts) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // comments
      for (const [re, fix] of NEWER) if (re.test(line)) found.push(`${path.basename(f)}:${i + 1} ${fix}`);
    });
  }
  assert.deepEqual(found, []);
});
