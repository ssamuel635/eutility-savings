// ─────────────────────────────────────────────────────────────
// Private-preview gate (Vercel Routing Middleware).
//
// Runs on Vercel before ANY file is served, so while the site is in
// development nothing — pages, scripts, plan data — is reachable without
// signing in. No database: accounts live in two environment variables.
//
//   GATE_SECRET  random string used to sign the session cookie
//                (change it to sign everyone out)
//   GATE_USERS   comma-separated  name:role:salt:hash
//                role is "admin" or "viewer"; make entries with
//                  node tools/gate-user.mjs <name> <role> <password>
//
// If either variable is missing the gate stays shut (fails closed).
// This is a temporary measure — remove this file (or the env vars' use)
// when the site goes public or real accounts arrive with the Phase 2 backend.
// ─────────────────────────────────────────────────────────────

const COOKIE = 'eu_gate';
const SESSION_DAYS = 14;
const PBKDF2_ITERATIONS = 60000;

// Served without signing in: only what the gate page itself needs.
const PUBLIC = [
  /^\/assets\/fonts\/inter-var\.woff2$/,
  /^\/assets\/img\/(eutility-logo\.png|favicon-64\.png|apple-touch-icon\.png)$/,
  /^\/robots\.txt$/,
  /^\/site\.webmanifest$/, // browsers fetch this without cookies
];

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const hexToBytes = (h) => Uint8Array.from(h.match(/.{2}/g) || [], (x) => parseInt(x, 16));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function env(name) {
  try { return (typeof process !== 'undefined' && process.env && process.env[name]) || ''; } catch { return ''; }
}

/** Parse GATE_USERS → Map(name → {role, salt, hash}). */
export function parseUsers(raw = env('GATE_USERS')) {
  const users = new Map();
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [name, role, salt, hash] = entry.split(':');
    if (name && (role === 'admin' || role === 'viewer') && salt && hash) users.set(name.toLowerCase(), { name, role, salt, hash });
  }
  return users;
}

export async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function checkLogin(username, password) {
  const users = parseUsers();
  const user = users.get(String(username || '').trim().toLowerCase());
  // Hash even for unknown names so response time doesn't reveal which names exist.
  const digest = await hashPassword(String(password || ''), user ? user.salt : '00'.repeat(16));
  return user && sameString(digest, user.hash) ? user : null;
}

async function hmacKey() {
  return crypto.subtle.importKey('raw', enc.encode(env('GATE_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function makeSession(user, now = Date.now()) {
  // h ties the session to the current password: change it in GATE_USERS and old sessions stop working.
  const payload = b64url(enc.encode(JSON.stringify({ u: user.name, r: user.role, h: user.hash.slice(0, 16), exp: now + SESSION_DAYS * 864e5 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload)));
  return `${payload}.${sig}`;
}

export async function readSession(request, now = Date.now()) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), unb64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (!data.exp || data.exp < now) return null;
    // The account must still exist with the same role (removing it from GATE_USERS locks it out).
    const user = parseUsers().get(String(data.u).toLowerCase());
    return user && user.role === data.r && data.h === user.hash.slice(0, 16) ? { name: user.name, role: user.role, exp: data.exp } : null;
  } catch {
    return null;
  }
}

/**
 * Only same-site paths are allowed as the post-login destination. Control
 * characters and backslashes are refused outright (browsers drop tabs/newlines
 * from Location, which can turn "/\t/evil.com" into "//evil.com"), and the result
 * is re-parsed to make sure it stays on this origin.
 */
export function safeNext(v) {
  const s = String(v || '/');
  if (!s.startsWith('/') || /[\u0000-\u001F\u007F\\]/.test(s)) return '/';
  try {
    const base = 'https://gate.invalid';
    const u = new URL(s, base);
    if (u.origin !== base) return '/';
    if (u.pathname.startsWith('/__gate') && u.pathname !== '/__gate/admin') return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}

/** Sign-in posts must come from this site's own form (blocks cross-site login posts). */
function sameOriginPost(request, url) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && origin !== url.origin) return false;
  return true;
}

const continueRequest = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      ...extra,
    },
  });
}

const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// ── Pages ──────────────────────────────────────────────────────

const STYLE = `
@font-face{font-family:Inter;src:url(/assets/fonts/inter-var.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root{--blue:#26649B;--navy:#173a5e;--text:#1d2939;--muted:#5b6472;--line:#dfe3e8;--bg:#f4f6f9;--err:#b42318;--orange:#d86a00}
*{box-sizing:border-box}html,body{margin:0}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:radial-gradient(1200px 600px at 10% -10%,#e3edf7,transparent),radial-gradient(900px 500px at 110% 110%,#fbeee0,transparent),var(--bg);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text)}
.card{width:100%;max-width:400px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:32px 28px;box-shadow:0 20px 50px -24px rgba(23,58,94,.35)}
.logo{display:block;height:44px;width:auto;margin-bottom:24px}
.tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--orange);margin:0 0 8px}
h1{font-size:26px;line-height:1.2;letter-spacing:-.02em;margin:0 0 8px;color:var(--navy)}
p{margin:0 0 20px;color:var(--muted)}
label{display:block;font-size:14px;font-weight:600;margin:0 0 6px}
input{width:100%;font:inherit;font-size:16px;padding:12px 14px;border:1px solid #c9d0d8;border-radius:12px;margin:0 0 16px;background:#fff;color:var(--text)}
input:focus{outline:3px solid rgba(38,100,155,.25);border-color:var(--blue)}
button,.btn{display:inline-flex;justify-content:center;align-items:center;width:100%;min-height:48px;font:inherit;font-weight:700;color:#fff;background:var(--blue);border:0;border-radius:12px;cursor:pointer;text-decoration:none}
button:hover,.btn:hover{background:#1f5486}
.btn--ghost{background:#fff;color:var(--blue);border:1px solid var(--blue);margin-top:10px}.btn--ghost:hover{background:#eef4fa}
.err{color:var(--err);background:#fef3f2;border:1px solid #fecdca;border-radius:10px;padding:10px 12px;font-size:14px;margin:0 0 16px}
.small{font-size:13px;color:var(--muted);margin:20px 0 0}
table{width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px}td,th{text-align:left;padding:8px 0;border-bottom:1px solid var(--line)}
code{font-size:13px;background:#f2f4f7;padding:2px 6px;border-radius:6px}
ol{padding-left:20px;margin:0 0 20px;color:var(--muted);font-size:14px}li{margin:0 0 6px}
.card--wide{max-width:560px}`;

function page(title, inner, wide = false) {
  return `<!doctype html><html lang="en-SG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/assets/img/favicon-64.png" type="image/png">
<style>${STYLE}</style></head><body><main class="card${wide ? ' card--wide' : ''}">
<img class="logo" src="/assets/img/eutility-logo.png" alt="Eutility" width="123" height="44">${inner}</main></body></html>`;
}

function gatePage(next, { error = '', notConfigured = false } = {}) {
  if (notConfigured) {
    return page('Private preview — Eutility', `<p class="tag">Private preview</p><h1>Not available yet</h1>
      <p>Access to this preview hasn’t been set up yet. Please check back soon.</p>`);
  }
  return page('Private preview — Eutility', `<p class="tag">Private preview</p><h1>Sign in to continue</h1>
    <p>This site is still in development and only open to the Eutility team.</p>
    ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
    <form method="post" action="/__gate/login">
      <input type="hidden" name="next" value="${esc(next)}">
      <label for="u">Username</label><input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
      <label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Continue</button>
    </form>
    <p class="small">Trouble signing in? Ask your Eutility contact for access.</p>`);
}

function adminPage(session) {
  const rows = [...parseUsers().values()].map((u) => `<tr><td>${esc(u.name)}</td><td>${u.role}</td></tr>`).join('');
  const until = new Date(session.exp).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' });
  return page('Preview access — Eutility', `<p class="tag">Admin</p><h1>Preview access</h1>
    <p>Signed in as <strong>${esc(session.name)}</strong> until ${esc(until)} (SGT).</p>
    <table><thead><tr><th>Account</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>
    <ol>
      <li>Add or change an account: run <code>node tools/gate-user.mjs &lt;name&gt; &lt;viewer|admin&gt; &lt;password&gt;</code>, put the line it prints into <code>GATE_USERS</code> in Vercel, then redeploy.</li>
      <li>Remove someone: delete their entry from <code>GATE_USERS</code> and redeploy. Their session stops working straight away.</li>
      <li>Sign everyone out: change <code>GATE_SECRET</code> and redeploy.</li>
    </ol>
    <a class="btn" href="/staff/review.html">Review waiting news</a><a class="btn btn--ghost" href="/">Go to the site</a><a class="btn btn--ghost" href="/__gate/logout">Sign out</a>`, true);
}

// ── Middleware ─────────────────────────────────────────────────

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC.some((re) => re.test(path))) return continueRequest();

  const configured = !!env('GATE_SECRET') && parseUsers().size > 0;
  if (!configured) return html(gatePage('/', { notConfigured: true }), 503);

  if (path === '/__gate/login') {
    if (request.method !== 'POST') return new Response(null, { status: 303, headers: { location: '/' } });
    if (!sameOriginPost(request, url)) return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
    let form;
    try { form = await request.formData(); } catch { form = new FormData(); }
    const next = safeNext(form.get('next'));
    const user = await checkLogin(form.get('username'), form.get('password'));
    if (!user) {
      await new Promise((r) => setTimeout(r, 600)); // slow down guessing
      return html(gatePage(next, { error: 'That username and password don’t match. Try again.' }), 401);
    }
    return new Response(null, {
      status: 303,
      headers: { location: next, 'set-cookie': cookie(await makeSession(user), SESSION_DAYS * 86400), 'cache-control': 'no-store' },
    });
  }

  if (path === '/__gate/logout') {
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': cookie('', 0), 'cache-control': 'no-store' } });
  }

  const session = await readSession(request);

  if (path === '/__gate' || path === '/__gate/admin') {
    if (!session) return html(gatePage(path), 401);
    if (session.role !== 'admin') return html(page('Not allowed — Eutility', '<h1>Admins only</h1><p>This page is for the site admin.</p><a class="btn" href="/">Go to the site</a>'), 403);
    return html(adminPage(session));
  }

  // Staff pages (the Review page) are for admins; /api/review checks the role again itself.
  if (path.startsWith('/staff/') && session && session.role !== 'admin') {
    return html(page('Not allowed — Eutility', '<h1>Admins only</h1><p>This page is for the site admin.</p><a class="btn" href="/">Go to the site</a>'), 403);
  }

  if (session) return continueRequest();

  // Page visits get the sign-in form at the same address (so they land back
  // here after signing in); everything else — scripts, data, images — is refused.
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html');
  if (wantsPage) return html(gatePage(path + url.search), 401);
  return new Response('Sign-in required', { status: 401, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
