#!/usr/bin/env node
// Makes invitation links in shuffled blocks of four, so each of the four orders (src/experiment/plan.ts SEQUENCES) is
// used equally often. Keep pilot and main cohorts separate. The CSV is private: each link is one participant's.
//
//   node scripts/invites.mjs --count 32 --cohort main --base https://<study host> --out ~/study-private/main-invites.csv

import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const count = Number(arg('count', '4'));
const cohort = arg('cohort', 'pilot');
const base = arg('base', 'http://127.0.0.1:5190').replace(/\/$/, '');
const out = arg('out', null);

if (!Number.isInteger(count) || count < 4 || count % 4 !== 0) {
  console.error('--count must be a multiple of 4 (one block per four people).');
  process.exit(1);
}
if (cohort !== 'pilot' && cohort !== 'main') {
  console.error('--cohort must be pilot or main.');
  process.exit(1);
}

const code = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const seen = new Set();
const rows = [['code', 'sequence', 'cohort', 'link']];
for (let b = 0; b < count / 4; b++) {
  for (const seq of shuffle([0, 1, 2, 3])) {
    let c = code();
    while (seen.has(c)) c = code();
    seen.add(c);
    rows.push([c, String(seq), cohort, `${base}/#i=${c}.${seq}.${cohort === 'pilot' ? 'p' : 'm'}`]);
  }
}

const csv = rows.map((r) => r.join(',')).join('\n') + '\n';
if (out) {
  writeFileSync(out, csv, { mode: 0o600 });
  console.log(`Wrote ${count} ${cohort} invitations to ${out}`);
} else {
  process.stdout.write(csv);
}
