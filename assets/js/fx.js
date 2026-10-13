// Motion helpers: count-up, confetti, optional "ding". All respect prefers-reduced-motion.

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a number from 0 → target inside `el` (brief §6: 1.5s count-up). */
export function countUp(el, target, { duration = 1500, format = (n) => Math.round(n).toLocaleString('en-SG') } = {}) {
  // Size the figure for its final width up front so the card never reflows mid-count.
  el.closest('.reveal-num__big')?.style.setProperty('--len', format(target).length);
  return new Promise((resolve) => {
    if (reducedMotion() || duration <= 0) {
      el.textContent = format(target);
      return resolve();
    }
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = format(target * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** Confetti burst in Eutility Blue, Energy Orange and Signal Red. */
export function confetti({ count = 160, duration = 2600 } = {}) {
  // Budget phones get a lighter burst (see isLite in layout.js).
  if (document.documentElement.classList.contains('lite')) { count = Math.min(count, 50); duration = Math.min(duration, 1800); }
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const colors = ['#1E88E5', '#F57C00', '#E53935', '#0D47A1', '#FFB300'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 6,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// ── Optional sound (brief §3.5: user-controlled, off by default) ──
const SOUND_KEY = 'eu_sound';
export function soundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}
export function setSound(on) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}
export function ding() {
  if (!soundEnabled()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    [880, 1320].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ac.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch { /* audio unavailable */ }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 150) : ms));
