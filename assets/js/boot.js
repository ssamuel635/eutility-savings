// Recovery for a page whose scripts never started.
//
// Kenneth's iPhone, 29 Oct 2026: the page showed but none of its modules ran, so
// it stayed half-built (no header, blank photo, blurred text). Every page is one
// graph of ~20 modules and a single refused or dropped request stops all of it.
// The usual cause is a lapsed preview sign-in: the phone shows a page it saved
// earlier, and the gate (middleware.js) then refuses every script. Re-setting the
// accounts (gate-user.mjs --set, 24 Oct) signs everyone out at once.
//
// This is a classic script on purpose: it runs even when the modules can't, and
// the gate serves it without a sign-in. If the page hasn't started shortly after
// loading, it asks the gate whether the sign-in is still good:
//   - signed out (401): reload, which brings up the sign-in form;
//   - otherwise (a dropped request): reload once to fetch the scripts again.
// One automatic reload per page per browser session, so it can never loop.
// The "didn't finish loading" note in styles.css stays as the last resort.
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('no-js')) return;
  var KEY = 'eu_boot_retry:' + location.pathname;
  var WAIT = 2500;
  var checked = false;

  function started() { return !root.classList.contains('no-js'); }
  function store(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }

  function retry() {
    // Without storage there's no way to tell a second attempt from a first: don't risk a loop.
    if (store(function (s) { return s.getItem(KEY); }) !== null) return;
    if (store(function (s) { s.setItem(KEY, '1'); return true; }) !== true) return;
    location.reload();
  }

  function check() {
    if (checked || started()) return;
    checked = true;
    fetch('/__gate/status', { cache: 'no-store', credentials: 'same-origin' })
      .then(retry, function () { /* offline: leave the refresh note */ });
  }

  // A module that can't be fetched fails the whole graph: no need to wait.
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.type === 'module') check();
  }, true);
  addEventListener('load', function () {
    if (started()) { store(function (s) { s.removeItem(KEY); }); return; }
    setTimeout(check, WAIT);
  });
  // A request that hangs holds up the load event; don't wait for it forever.
  setTimeout(check, 10000);
})();
