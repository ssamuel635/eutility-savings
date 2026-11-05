// ─────────────────────────────────────────────────────────────
// Referral lucky draw: tokens, prizes and the result.
// Shared by the Vercel Function (api/draw.mjs) and the local server (server.js).
// Files in api/ that start with "_" are not endpoints on Vercel.
//
// A draw link carries a signed token: { d: draw id, k: kind, e: expiry, s: sample }.
// The token holds no phone number or name. Who the draw belongs to (the
// customer and the referral record) is kept with the draw id in the CRM.
//
// The result is worked out on the server from the draw id and DRAW_SECRET, so
// it is fixed the moment the draw is created. Spinning again, refreshing or
// using another device always shows the same prize. The page only animates it.
//
// Environment:
//   DRAW_MODE    "sample" (default) or "live". Live needs DRAW_SECRET and a CRM
//                store; sample links are for previews and never pay out.
//   DRAW_SECRET  long random string, server-side only.
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../assets/js/config.js';

const env = (name) => {
  try { return (typeof process !== 'undefined' && process.env && process.env[name]) || ''; } catch { return ''; }
};

// Sample links only. Anyone could make one, which is fine: they never pay out.
const SAMPLE_SECRET = 'eutility-sample-draws-only-never-pays-out';

export const KINDS = {
  referrer: 'Your friend has switched',
  friend: 'Welcome to Eutility',
  bonus: 'Bonus draw',
};

export function mode() { return env('DRAW_MODE') === 'live' ? 'live' : 'sample'; }

function secretFor(sample) {
  if (sample) return SAMPLE_SECRET;
  const s = env('DRAW_SECRET');
  if (s.length < 32) throw Object.assign(new Error('Draws are not set up yet'), { status: 503 });
  return s;
}

/** Prizes from config, checked: weights add up to 10,000 and the top prize is at most 0.1%. */
export function prizes(list = CONFIG.rewards.prizes) {
  const total = list.reduce((t, p) => t + p.weight, 0);
  if (total !== 10000) throw new Error(`Prize weights add up to ${total}, not 10000`);
  const top = list.reduce((a, b) => (b.value > a.value ? b : a));
  if (top.weight > 10) throw new Error('The top prize must be 0.1% or less');
  return list.map((p) => ({ ...p, label: `S$${p.value}`, odds: `${(p.weight / 100).toLocaleString('en-SG', { maximumFractionDigits: 2 })}%` }));
}

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i];
  return x === 0;
}

const DRAW_ID = /^[A-Za-z0-9-]{6,40}$/;

/** A signed draw link token. `days` defaults to how long draws stay valid. */
export async function issueToken({ drawId, kind, sample = mode() === 'sample', days = CONFIG.rewards.drawDays, now = Date.now() }) {
  if (!DRAW_ID.test(drawId || '')) throw new Error('Bad draw id');
  if (!KINDS[kind]) throw new Error('Bad draw kind');
  const body = b64url(enc.encode(JSON.stringify({ d: drawId, k: kind, e: Math.floor(now / 1000) + days * 86400, s: sample ? 1 : 0 })));
  return `${body}.${b64url(await hmac(secretFor(sample), body))}`;
}

/** Reads a token. Returns { drawId, kind, sample, expires } or { error: 'invalid' | 'expired' }. */
export async function readToken(token, now = Date.now()) {
  const m = /^([A-Za-z0-9_-]{10,400})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
  if (!m) return { error: 'invalid' };
  let p;
  try { p = JSON.parse(new TextDecoder().decode(unb64url(m[1]))); } catch { return { error: 'invalid' }; }
  if (!p || !DRAW_ID.test(p.d || '') || !KINDS[p.k] || !Number.isFinite(p.e)) return { error: 'invalid' };
  const sample = p.s === 1;
  if (!sample && mode() !== 'live') return { error: 'invalid' };
  if (sample && mode() === 'live') return { error: 'invalid' };
  if (!sameBytes(await hmac(secretFor(sample), m[1]), unb64url(m[2]))) return { error: 'invalid' };
  if (p.e * 1000 < now) return { error: 'expired' };
  return { drawId: p.d, kind: p.k, sample, expires: new Date(p.e * 1000).toISOString() };
}

/** The prize for a draw: fixed by the draw id, picked with the configured odds. */
export async function outcome(drawId, sample) {
  const h = await hmac(secretFor(sample), `outcome:${drawId}`);
  const roll = (((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3]) % 10000;
  const list = prizes();
  let at = 0;
  for (let i = 0; i < list.length; i++) {
    at += list[i].weight;
    if (roll < at) return { index: i, prize: list[i] };
  }
  return { index: 0, prize: list[0] };
}

/**
 * Where drawn results are kept. In memory for now, so sample draws can say
 * "already drawn" within one server. Live draws will keep this in the CRM
 * (with the customer, the referral record and the voucher sent).
 */
export function memoryStore() {
  const drawn = new Map();
  return {
    async get(drawId) { return drawn.get(drawId) || null; },
    async markDrawn(drawId, result) { if (!drawn.has(drawId)) drawn.set(drawId, { ...result, at: new Date().toISOString() }); return drawn.get(drawId); },
  };
}

const sampleId = () => `S-${[...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;

/** A fresh sample draw link token (previews only). */
export async function sampleToken(kind = 'referrer') {
  if (mode() !== 'sample') throw Object.assign(new Error('Sample draws are off'), { status: 404 });
  return issueToken({ drawId: sampleId(), kind: KINDS[kind] ? kind : 'referrer', sample: true });
}
