// ─────────────────────────────────────────────────────────────
// Storage adapter — the ONLY place the prototype touches the browser.
// Swap the body of read/write/remove for fetch() calls when the real
// API exists; nothing above the services layer changes.
// ─────────────────────────────────────────────────────────────

const PREFIX = 'eutility:v1:';
export const MOCK = true; // prototype flag — false once a backend is wired up

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export const store = {
  read(key, fallback = null) {
    return safe(() => {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    }, fallback);
  },
  /** read() that only ever returns an array (old or corrupted data can't break a page). */
  readList(key) {
    const v = this.read(key, []);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
  },
  /** read() that only ever returns a plain object, or the fallback. */
  readObject(key, fallback = null) {
    const v = this.read(key, fallback);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
  },
  write(key, value) {
    return safe(() => {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('eu:store', { detail: { key } }));
      return true;
    }, false);
  },
  remove(key) {
    return safe(() => { localStorage.removeItem(PREFIX + key); window.dispatchEvent(new CustomEvent('eu:store', { detail: { key } })); return true; }, false);
  },
  clearAll() {
    return safe(() => {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent('eu:store', { detail: { key: '*' } }));
      return true;
    }, false);
  },
};

export const uid = (n = 8) => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => a[b % a.length]).join('');
};

export const nowISO = () => new Date().toISOString();
