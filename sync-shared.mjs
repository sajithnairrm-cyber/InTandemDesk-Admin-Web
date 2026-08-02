#!/usr/bin/env node
/* ============================================================
   Shared-core sync and drift check

     node sync-shared.mjs check  ../InTandemDesk-Admin-Mobile
     node sync-shared.mjs pull   ../InTandemDesk-Admin-Mobile
     node sync-shared.mjs push   ../InTandemDesk-Admin-Mobile

   THE PROBLEM THIS EXISTS TO MANAGE
   ---------------------------------
   src/shared/ is duplicated across the Web and Mobile repositories.
   Two copies of the same code in two repos WILL drift — that is not
   a risk, it is a certainty, and it is exactly what happened to the
   earlier admin/staff split in this project (a dead function and an
   orphaned event handler survived for weeks because nobody could see
   both files at once).

   The rule: edit src/shared/ in ONE repo, then `push` to the other,
   then commit both. `check` tells you whether they currently agree —
   wire it into CI or run it before you start work.

   src/app/ is intentionally NOT synced. That is where the two apps
   are allowed to differ.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HERE = path.join(ROOT, 'src', 'shared');

const [mode, peerArg] = process.argv.slice(2);
if (!['check', 'pull', 'push'].includes(mode) || !peerArg) {
  console.error('\n  usage: node sync-shared.mjs <check|pull|push> <path-to-other-repo>\n');
  process.exit(1);
}

const peer = path.resolve(ROOT, peerArg, 'src', 'shared');
if (!fs.existsSync(peer)) {
  console.error(`\n  ✖ Not found: ${peer}\n    Clone the other repository beside this one.\n`);
  process.exit(1);
}

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const list = d => fs.readdirSync(d).filter(f => !f.startsWith('.')).sort();

const names = [...new Set([...list(HERE), ...list(peer)])];
const diffs = [];

for (const n of names) {
  const a = path.join(HERE, n), b = path.join(peer, n);
  const ha = fs.existsSync(a) ? sha(a) : null;
  const hb = fs.existsSync(b) ? sha(b) : null;
  if (ha !== hb) diffs.push({ n, ha, hb });
}

if (mode === 'check') {
  if (!diffs.length) { console.log(`\n  ✔ shared core matches — ${names.length} files identical\n`); process.exit(0); }
  console.error(`\n  ✖ shared core has DRIFTED — ${diffs.length} of ${names.length} files differ:\n`);
  diffs.forEach(d => console.error(`      ${d.n.padEnd(24)} here:${d.ha || '(missing)'}  there:${d.hb || '(missing)'}`));
  console.error(`\n    Resolve with:  node sync-shared.mjs push ${peerArg}   (this repo wins)`);
  console.error(`               or: node sync-shared.mjs pull ${peerArg}   (other repo wins)\n`);
  process.exit(1);
}

const [from, to] = mode === 'push' ? [HERE, peer] : [peer, HERE];
let n = 0;
for (const f of list(from)) { fs.copyFileSync(path.join(from, f), path.join(to, f)); n++; }
for (const f of list(to)) if (!fs.existsSync(path.join(from, f))) { fs.rmSync(path.join(to, f)); console.log(`  removed ${f}`); }

console.log(`\n  ✔ ${mode} complete — ${n} files copied ${mode === 'push' ? 'to' : 'from'} ${peerArg}`);
console.log(`    Commit in BOTH repositories, or they drift again.\n`);
