// A branded drop-down that stands in for a native <select>.
//
// The <select> stays in the page as the source of truth (value, change events,
// form logic) but is hidden; the picker shows the choice as a field with a
// second line of detail and opens a list of rows. Each <option> may carry
// data-sub (the second line) and data-tag (a small label, e.g. "Most common").
// Options replaced later (e.g. a new retailer's plans) are picked up automatically.
//
// Keyboard: Enter / Space / ↓ opens; ↑ ↓ Home End move; Enter picks; Escape closes.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let uid = 0;

export function enhanceSelect(select) {
  const id = `picker-${++uid}`;
  const wrap = document.createElement('div');
  wrap.className = 'picker';
  wrap.innerHTML = `
    <button type="button" class="picker__btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}">
      <span class="picker__val"><span class="picker__label"></span><span class="picker__sub"></span></span>
      <span class="picker__chev" aria-hidden="true"></span>
    </button>
    <ul class="picker__list" id="${id}" role="listbox" tabindex="-1" hidden></ul>`;
  select.after(wrap);
  select.classList.add('picker__native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const btn = wrap.querySelector('.picker__btn');
  const list = wrap.querySelector('.picker__list');
  // The visible button takes over the select's label.
  const label = select.id && document.querySelector(`label[for="${select.id}"]`);
  if (label) {
    label.id ||= `${select.id}-label`;
    label.htmlFor = '';
    label.addEventListener('click', () => btn.focus());
    btn.setAttribute('aria-labelledby', `${label.id} ${id}-val`);
    list.setAttribute('aria-labelledby', label.id);
  }
  wrap.querySelector('.picker__val').id = `${id}-val`;

  let active = 0;
  const opts = () => [...select.options];
  const rows = () => [...list.children];

  function render() {
    const o = select.selectedOptions[0];
    wrap.querySelector('.picker__label').textContent = o ? o.text : '';
    wrap.querySelector('.picker__sub').textContent = o?.dataset.sub || '';
    list.innerHTML = opts().map((op, i) => `
      <li role="option" id="${id}-o${i}" aria-selected="${op.selected}" class="picker__opt">
        <span class="picker__opt-main"><span class="picker__opt-label">${esc(op.text)}</span>${op.dataset.tag ? `<span class="picker__tag">${esc(op.dataset.tag)}</span>` : ''}</span>
        ${op.dataset.sub ? `<span class="picker__opt-sub">${esc(op.dataset.sub)}</span>` : ''}
      </li>`).join('');
  }

  function setActive(i) {
    const r = rows();
    if (!r.length) return;
    active = Math.max(0, Math.min(r.length - 1, i));
    r.forEach((el, n) => el.classList.toggle('is-active', n === active));
    list.setAttribute('aria-activedescendant', r[active].id);
    r[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (!list.hidden) return;
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    setActive(Math.max(0, select.selectedIndex));
    list.focus({ preventScroll: true });
  }

  function close(refocus = true) {
    if (list.hidden) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    if (refocus) btn.focus({ preventScroll: true });
  }

  function pick(i) {
    if (i >= 0 && i !== select.selectedIndex) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    render();
    close();
  }

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
  });
  list.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: rows().length - 1, PageDown: active + 5, PageUp: active - 5 };
    if (e.key in keys) { e.preventDefault(); setActive(keys[e.key]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); close(e.key === 'Escape'); }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.picker__opt');
    if (li) pick(rows().indexOf(li));
  });
  list.addEventListener('mousemove', (e) => {
    const li = e.target.closest('.picker__opt');
    if (li) setActive(rows().indexOf(li));
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(false); });

  // Keep in step when the page changes the select (new options, or a value set in code).
  new MutationObserver(render).observe(select, { childList: true, subtree: true, attributes: true });
  select.addEventListener('change', render);
  render();
  return { refresh: render, close };
}
