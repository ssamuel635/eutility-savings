// The prize reel: a strip of voucher cards slides past a centre marker, slows
// down and stops on the prize the server picked. It only shows the result; it
// never decides it.
//
// Kept honest on purpose (trade promotion, not a gambling game):
// - the strip shows prizes roughly in line with the real odds, so the top
//   prize passes by once or twice, not everywhere;
// - it never stops right next to the top prize (no "near miss").

import { voucherCard } from './voucher.js';
import { reducedMotion, soundEnabled } from '../fx.js';

const CARDS = 56;
const WIN_AT = 48; // where the prize sits in the strip

/** Strip of prize values: weights flattened (power 0.6) so it isn't all S$5, top prize kept rare. */
export function buildStrip(prizes, winIndex, rand = Math.random) {
  const top = Math.max(...prizes.map((p) => p.value));
  const shown = prizes.map((p) => ({ value: p.value, w: p.value === top ? 0 : Math.pow(p.weight ?? 1, 0.6) }));
  const total = shown.reduce((t, p) => t + p.w, 0);
  const pick = () => {
    let r = rand() * total;
    for (const p of shown) { r -= p.w; if (r < 0) return p.value; }
    return shown[0].value;
  };
  const strip = Array.from({ length: CARDS }, pick);
  // The top prize passes by early, once (twice on longer strips), far from the stop.
  strip[9 + Math.floor(rand() * 8)] = top;
  if (rand() < 0.5) strip[24 + Math.floor(rand() * 8)] = top;
  strip[WIN_AT] = prizes[winIndex].value;
  for (const d of [-2, -1, 1, 2]) if (strip[WIN_AT + d] === top) strip[WIN_AT + d] = prizes[0].value;
  return strip;
}

export const reelMarkup = () => `
  <div class="reel" aria-hidden="true">
    <div class="reel__window"><div class="reel__strip" id="reel-strip"></div></div>
    <span class="reel__marker"></span>
  </div>`;

let audio = null;
function tick() {
  if (!soundEnabled()) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = 1400;
    const t = audio.currentTime;
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.05);
  } catch { /* no audio */ }
}

/** Drives one reel: a slow drift while waiting, then the spin to the prize. */
export function createReel(root, prizes) {
  const strip = root.querySelector('#reel-strip');
  const windowEl = root.querySelector('.reel__window');
  let x = 0;
  let raf = 0;
  let last = performance.now();
  let values = buildStrip(prizes, 0); // the prize slot is filled in when the result arrives
  const render = () => { strip.innerHTML = values.map((v) => voucherCard(v)).join(''); };
  render();

  const step = () => {
    const card = strip.firstElementChild;
    const gap = parseFloat(getComputedStyle(strip).columnGap) || 12;
    return card.getBoundingClientRect().width + gap;
  };
  const place = () => { strip.style.transform = `translate3d(${x}px,0,0)`; };

  // Waiting: drift left slowly so the strip feels alive (for the first 25 cards).
  const drift = (now) => {
    if (-x < 25 * step()) x -= ((now - last) / 1000) * (reducedMotion() ? 0 : 14);
    last = now;
    place();
    raf = requestAnimationFrame(drift);
  };
  raf = requestAnimationFrame((now) => { last = now; drift(now); });

  return {
    /** Spin to prize `index` (from the server). Resolves when it has stopped. */
    spinTo(index) {
      cancelAnimationFrame(raf);
      // Put the real prize in the strip. Cards already on screen stay as they are.
      const s = step();
      const view = windowEl.getBoundingClientRect().width;
      const onScreen = Math.ceil((view - x) / s) + 1;
      const next = buildStrip(prizes, index);
      for (let i = 0; i <= onScreen && i < WIN_AT - 3; i++) next[i] = values[i];
      values = next;
      render();
      const cardW = strip.firstElementChild.getBoundingClientRect().width;
      const jitter = (Math.random() - 0.5) * cardW * 0.5; // stop somewhere on the card, never on its edge
      const target = -(WIN_AT * s + cardW / 2 - view / 2) + jitter;
      const from = Math.max(x, target + 20 * s); // always a good long run
      const ms = reducedMotion() ? 500 : 5200;
      const start = performance.now();
      let lastCard = Math.floor((view / 2 - from) / s);
      return new Promise((resolve) => {
        const frame = (now) => {
          const t = Math.min(1, (now - start) / ms);
          const eased = 1 - Math.pow(1 - t, 4);
          x = from + (target - from) * eased;
          place();
          const card = Math.floor((view / 2 - x) / s);
          if (card !== lastCard) { lastCard = card; tick(); }
          if (t < 1) raf = requestAnimationFrame(frame);
          else {
            strip.children[WIN_AT]?.classList.add('is-win');
            try { navigator.vibrate?.([30, 40, 70]); } catch { /* not supported */ }
            setTimeout(resolve, reducedMotion() ? 200 : 900);
          }
        };
        raf = requestAnimationFrame(frame);
      });
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
