#!/usr/bin/env node
/* ============================================================
   InTandem Desk — commit and push BOTH repositories

     node ship.mjs "what changed"

   Files staying in sync is only half of the job. If the mobile repo
   never gets committed, GitHub Pages keeps serving the old build and
   the two published apps drift even though the local files agree.

   This builds both, then commits and pushes both with the same
   message. A repo with nothing to commit is skipped, not an error.

   Nothing runs this automatically — you choose when to publish.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB    = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(WEB, '..', 'InTandemDesk-Admin-Mobile');

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  console.error('\n  usage: npm run ship "what changed"\n');
  process.exit(1);
}

const run = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });

function ship(dir, label) {
  if (!fs.existsSync(dir)) { console.log(`  ${label.padEnd(7)} not found — skipped`); return; }

  // Build first, so docs/ (what Pages serves) matches src/.
  const b = run(dir, process.execPath, ['build.mjs', '--preview']);
  if (b.status !== 0) {
    console.error(`  ${label.padEnd(7)} BUILD FAILED — nothing committed`);
    console.error((b.stderr || b.stdout || '').trim());
    process.exitCode = 1;
    return;
  }

  const status = run(dir, 'git', ['status', '--porcelain']);
  if (!status.stdout.trim()) { console.log(`  ${label.padEnd(7)} no changes`); return; }

  run(dir, 'git', ['add', '-A']);
  const c = run(dir, 'git', ['commit', '-m', message]);
  if (c.status !== 0) {
    console.error(`  ${label.padEnd(7)} COMMIT FAILED`);
    console.error((c.stderr || c.stdout || '').trim());
    process.exitCode = 1;
    return;
  }

  const p = run(dir, 'git', ['push', 'origin', 'main']);
  if (p.status !== 0) {
    console.error(`  ${label.padEnd(7)} PUSH FAILED — commit is local only`);
    console.error((p.stderr || p.stdout || '').trim());
    process.exitCode = 1;
    return;
  }

  const files = status.stdout.trim().split('\n').length;
  console.log(`  ${label.padEnd(7)} ✔ ${files} file${files === 1 ? '' : 's'} committed and pushed`);
}

console.log(`\n  Shipping: "${message}"\n`);
ship(WEB, 'web');
ship(MOBILE, 'mobile');
console.log(process.exitCode ? '\n  Finished with errors — see above.\n' : '\n  Both repositories up to date.\n');
