#!/usr/bin/env node
// Make an account line for the private-preview gate (middleware.js).
//
//   node tools/gate-user.mjs <name> <viewer|admin> <password>
//       → prints  name:role:salt:hash   (add it to GATE_USERS in Vercel, comma-separated)
//   node tools/gate-user.mjs --secret
//       → prints a random value for GATE_SECRET
//
// The password itself is never stored anywhere — only the salted hash.
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../middleware.js';

const [name, role, password] = process.argv.slice(2);

if (name === '--secret') {
  console.log(randomBytes(32).toString('hex'));
  process.exit(0);
}
if (!name || !['viewer', 'admin'].includes(role) || !password) {
  console.error('Usage: node tools/gate-user.mjs <name> <viewer|admin> <password>\n       node tools/gate-user.mjs --secret');
  process.exit(1);
}
if (/[:,\s]/.test(name)) {
  console.error('Name cannot contain spaces, commas or colons.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
console.log(`${name}:${role}:${salt}:${await hashPassword(password, salt)}`);
