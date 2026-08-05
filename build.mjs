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

/* Copy over the existing output, then prune what is no longer produced.

   NOT rmSync-then-copy. That leaves a window — small, but real — where
   docs/index.html does not exist, and anything hitting the dev server in
   that moment gets a 404. It happens whenever a build overlaps a watcher
   rebuild, which is exactly when you are working fastest. */
const expected = new Set();
const copyTracked = (from, to, prefix) => {
  fs.mkdirSync(to, { recursive: true });
  /* Register the destination directory itself, not just its contents.
     Without this, prune sees `shared/` as unexpected and deletes the
     whole tree — which is precisely what happened the first time. */
  if (prefix) expected.add(prefix);
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isDirectory()) { expected.add(rel); n += copyTracked(s, d, rel); }
    else { fs.copyFileSync(s, d); expected.add(rel); n++; }
  }
  return n;
};

const app = copyTracked(APP, OUT, '');
const shared = copyTracked(SHARED, path.join(OUT, 'shared'), 'shared');

/* Remove anything left from a previous build that the sources no longer
   contain — a renamed or deleted file must not linger in the output. */
let pruned = 0;
const prune = (dir, prefix) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + e.name : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!expected.has(rel)) { fs.rmSync(full, { recursive: true, force: true }); pruned++; }
      else prune(full, rel);
    } else if (!expected.has(rel)) { fs.rmSync(full, { force: true }); pruned++; }
  }
};
if (fs.existsSync(OUT)) prune(OUT, '');

console.log(`\n  InTandem Desk · Admin Web${preview ? '  (preview)' : ''}`);
console.log(`  ${app} app + ${shared} shared files → docs/${pruned ? `  (${pruned} stale removed)` : ''}\n`);
if (preview && !configured) console.log('  ⚠  Firebase not configured — sign-in will show "Setup required".\n');
