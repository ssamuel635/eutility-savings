// Log in — mock authentication against accounts held in this browser.
// See services/customer.js: there is no server yet, so "sign in" means
// "match the account this browser created at sign-up (or the demo account)".
import { initLayout, toast } from '../layout.js';
import * as customer from '../services/customer.js';

initLayout();

const form = document.getElementById('login-form');
const emailEl = document.getElementById('li-email');
const pwEl = document.getElementById('li-pw');
const err = (name) => form.querySelector(`[data-error="${name}"]`);

function setError(name, msg) {
  const el = err(name);
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-shown', !!msg);
  const input = name === 'email' ? emailEl : name === 'password' ? pwEl : null;
  input?.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

// Where to go after signing in: back where they came from, else the dashboard.
const params = new URLSearchParams(location.search);
const next = /^[a-z0-9-]+\.html$/i.test(params.get('next') || '') ? params.get('next') : 'account.html';

// Already signed in? No reason to show this page.
if (customer.isSignedIn()) location.replace(next);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  setError('form', '');

  const email = emailEl.value.trim();
  const pw = pwEl.value;
  const emailMsg = customer.validators.email(email);
  setError('email', emailMsg);
  setError('password', pw ? '' : 'Enter your password.');
  if (emailMsg || !pw) return;

  const res = customer.signIn(email, pw);
  if (!res.ok) {
    setError('form', res.error);
    pwEl.select();
    return;
  }

  toast(`Welcome back, ${customer.firstName() || 'there'}`);
  setTimeout(() => location.assign(next), 450);
});

// Clear the form-level error as soon as they start fixing it.
[emailEl, pwEl].forEach((el) => el.addEventListener('input', () => setError('form', '')));
