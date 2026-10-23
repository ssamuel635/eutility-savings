// A drawn WhatsApp chat (wac-* markup) played message by message, like the
// real conversation: replies from Eutility get "typing…" first. Used by How it
// works and the home page's three steps.
import { reducedMotion } from '../fx.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Show one chat's messages in turn; onShow(message) runs as each appears. */
export async function playChat(visual, onShow = () => {}) {
  const msgs = [...visual.querySelectorAll('.wac-msg')];
  const typing = visual.querySelector('.wac__typing');
  const show = (m) => {
    m.classList.add('is-in');
    // The customer's reply greys out the button they tapped, as WhatsApp does
    if (m.classList.contains('wac-msg--out')) visual.querySelectorAll('.is-in [data-tap]').forEach((b) => b.classList.add('is-tapped'));
    onShow(m);
  };
  if (reducedMotion()) { msgs.forEach(show); return; }
  await sleep(350);
  for (const m of msgs) {
    if (m.classList.contains('wac-msg--in')) {
      typing.classList.add('is-on');
      await sleep('quick' in m.dataset ? 650 : 1100);
      typing.classList.remove('is-on');
    } else {
      await sleep(500);
    }
    show(m);
    await sleep(350);
  }
}
