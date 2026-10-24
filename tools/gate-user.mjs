#!/usr/bin/env node
// Accounts for the private-preview gate (middleware.js).
//
//   node tools/gate-user.mjs --set kenneth:viewer ebin:admin
//       → asks for each person's password (typed twice, not shown), then
//         replaces GATE_USERS in Vercel (Production) with exactly these
//         accounts. Then redeploy (npx vercel --prod) for it to take effect.
//         Vercel keeps GATE_USERS encrypted, so an edit in the dashboard can't
//         see the accounts already there and wipes them: always list EVERY
//         account here, not just the new one.
//   node tools/gate-user.mjs <name> <viewer|admin> <password>
//       → prints one  name:role:salt:hash  line
//   node tools/gate-user.mjs --secret
//       → prints a random value for GATE_SECRET
//
// The password itself is never stored anywhere — only the salted hash.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { hashPassword } from '../middleware.js';

const USAGE = `Usage: node tools/gate-user.mjs --set <name>:<viewer|admin> [<name>:<role> ...]
       node tools/gate-user.mjs <name> <viewer|admin> <password>
       node tools/gate-user.mjs --secret`;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function check(name, role, password) {
  if (!name || !['viewer', 'admin'].includes(role)) fail(USAGE);
  if (/[:,\s]/.test(name)) fail(`"${name}": a name cannot contain spaces, commas or colons.`);
  if (password !== undefined && password.length < 10) fail(`The password for ${name} must be at least 10 characters.`);
}

async function entry(name, role, password) {
  const salt = randomBytes(16).toString('hex');
  return `${name}:${role}:${salt}:${await hashPassword(password, salt)}`;
}

/** One reader for every prompt; what's typed after a prompt isn't shown. */
function hiddenPrompts() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let prompt = '';
  rl._writeToOutput = (s) => { if (s.startsWith(prompt)) process.stdout.write(s); };
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(question) {
      prompt = question;
      process.stdout.write(question);
      const { value, done } = await lines.next();
      process.stdout.write('\n');
      if (done) fail('No password given. Nothing changed.');
      return value;
    },
    close: () => rl.close(),
  };
}

const args = process.argv.slice(2);

if (args[0] === '--secret') {
  console.log(randomBytes(32).toString('hex'));
} else if (args[0] === '--set') {
  const people = args.slice(1).map((a) => a.split(':'));
  if (!people.length) fail(USAGE);
  people.forEach(([name, role]) => check(name, role));
  if (new Set(people.map(([n]) => n.toLowerCase())).size !== people.length) fail('Each name can only be listed once.');
  if (!people.some(([, role]) => role === 'admin')) fail('List at least one admin, or nobody can use the Review page.');

  const lines = [];
  const prompts = hiddenPrompts();
  for (const [name, role] of people) {
    const pw = await prompts.ask(`Password for ${name} (${role}): `);
    check(name, role, pw);
    if ((await prompts.ask(`Same password again for ${name}: `)) !== pw) fail(`The two passwords for ${name} didn't match. Nothing changed.`);
    lines.push(await entry(name, role, pw));
  }
  prompts.close();

  console.log(`\nReplacing GATE_USERS in Vercel (Production) with: ${people.map(([n, r]) => `${n} (${r})`).join(', ')}`);
  const r = spawnSync('npx vercel env add GATE_USERS production --force --yes', { input: lines.join(','), shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
  if (r.status !== 0) fail('Vercel did not accept the change. Nothing changed; check you are signed in (npx vercel whoami).');
  console.log('Done. Redeploy for it to take effect: npx vercel --prod');
} else {
  const [name, role, password] = args;
  check(name, role, password);
  if (password === undefined) fail(USAGE);
  console.log(await entry(name, role, password));
}
