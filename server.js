// Zero-dependency local dev server.  Run:  node server.js   (or npm start)
// - Serves the site from this folder
// - Clean URLs: /calculator → calculator.html
// - Referral links: /r/ABC123 → /?ref=ABC123
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
const BLOCKED = /^\/(node_modules|tests|tools|data|\.git|\.vercel)(\/|$)|^\/(server\.js|package\.json|\.env.*)$/;

// Send the same security headers as production (read from vercel.json), so a
// Content-Security-Policy violation shows up here first, not after deploying.
let PROD_HEADERS = {};
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  for (const h of (cfg.headers || []).find((x) => x.source === '/(.*)')?.headers || []) {
    if (h.key !== 'X-Robots-Tag') PROD_HEADERS[h.key] = h.value;
  }
  // Local is plain http — don't ask the browser to upgrade requests to https.
  if (PROD_HEADERS['Content-Security-Policy']) {
    PROD_HEADERS['Content-Security-Policy'] = PROD_HEADERS['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  }
} catch { /* no vercel.json — serve without */ }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);

  const ref = p.match(/^\/r\/([A-Za-z0-9]{4,12})\/?$/);
  if (ref) { res.writeHead(302, { Location: `/?ref=${ref[1].toUpperCase()}` }); return res.end(); }
  if (BLOCKED.test(p)) return send404(res);
  if (p.endsWith('/')) p += 'index.html';
  if (!path.extname(p)) p += '.html';

  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send404(res);
  fs.readFile(file, (err, buf) => {
    if (err) return send404(res);
    res.writeHead(200, { ...PROD_HEADERS, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`\n  Eutility savings site → http://localhost:${PORT}\n`));

function send404(res) {
  fs.readFile(path.join(ROOT, '404.html'), (e, buf) => {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(e ? 'Not found' : buf);
  });
}
