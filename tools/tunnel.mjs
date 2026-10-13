// Give the local server a public https address for remote tests, so testers
// anywhere (site or app) write into the workbook on this computer.
//
//   1. npm start            (in one terminal)
//   2. npm run tunnel       (in another)
//
// Uses a free Cloudflare quick tunnel: no account, a new random address each
// time, and it stops when you close this. Anyone with the address can open the
// site, so share it only with your testers.

import { spawn, spawnSync } from 'node:child_process';

const PORT = Number(process.env.PORT) || 5173;
const local = `http://localhost:${PORT}`;

const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' });
if (which.status !== 0) {
  console.log(`
  cloudflared isn't installed. Install it once, then run npm run tunnel again:

    Windows:  winget install --id Cloudflare.cloudflared
    macOS:    brew install cloudflared

  (Open a new terminal after installing so it's on your PATH.)
`);
  process.exit(1);
}

try {
  const r = await fetch(`${local}/api/crm/health`, { signal: AbortSignal.timeout(3000) });
  const h = await r.json();
  console.log(`\n  Local server is up (CRM: ${h.provider}).`);
} catch {
  console.log(`\n  Nothing answering at ${local}. Start the site first with: npm start\n`);
  process.exit(1);
}

console.log('  Opening a tunnel…');
const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', local], { stdio: ['ignore', 'pipe', 'pipe'] });
let shown = false;
const watch = (buf) => {
  const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || shown) return;
  shown = true;
  console.log(`
  ┌───────────────────────────────────────────────────────────────
  │ Website for testers:   ${m[0]}
  │
  │ App testers (Expo):    put this in mobile/.env, then restart
  │                        npx expo start --tunnel
  │   EXPO_PUBLIC_CRM_URL=${m[0]}
  │
  │ Records land in data/crm/eutility-customers.xlsx on this PC.
  │ Keep this window open; Ctrl+C ends the tunnel.
  └───────────────────────────────────────────────────────────────
`);
};
cf.stdout.on('data', watch);
cf.stderr.on('data', watch);
cf.on('exit', (code) => { console.log(`  Tunnel closed${code ? ` (code ${code})` : ''}.`); process.exit(code || 0); });
process.on('SIGINT', () => cf.kill('SIGINT'));
