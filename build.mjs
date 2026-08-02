#!/usr/bin/env node
/* ============================================================
   InTandem Desk — build (single app)

     node build.mjs             build into public/
     node build.mjs --preview   allow a placeholder Firebase config

   No bundler, no dependencies. Copies src/app/ and src/shared/
   into public/, so the deployed tree is self-contained.

   The build FAILS while src/shared/itd-config.js still holds
   PASTE_ placeholders — an unconfigured build has no working
   sign-in and must never reach a public URL.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = path.dirname(fileURLToPath(import.meta.url));
const SRC    = path.join(ROOT, 'src');
const SHARED = path.join(SRC, 'shared');
const APP    = path.join(SRC, 'app');
const OUT    = path.join(ROOT, 'docs');

const preview = process.argv.includes('--preview');

const configured = !/apiKey:\s*["']PASTE/.test(fs.readFileSync(path.join(SHARED, 'itd-config.js'), 'utf8'));
if (!configured && !preview) {
  console.error(`
  ✖ Firebase is not configured.

    src/shared/itd-config.js still contains PASTE_ placeholders, so the
    sign-in gate cannot work and this build would be unsafe to deploy.

    Fix:     paste your Firebase web config into src/shared/itd-config.js
    Preview: node build.mjs --preview   (local look-and-feel only)
`);
  process.exit(1);
}

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(s, d); else { fs.copyFileSync(s, d); n++; }
  }
  return n;
};

fs.rmSync(OUT, { recursive: true, force: true });
const app = copyDir(APP, OUT);
const shared = copyDir(SHARED, path.join(OUT, 'shared'));

console.log(`\n  InTandem Desk · Admin Web${preview ? '  (PREVIEW — unconfigured)' : ''}`);
console.log(`  ${app} app + ${shared} shared files → docs/\n`);
if (preview) console.log('  ⚠  Sign-in will show "Setup required". Do not deploy this.\n');
