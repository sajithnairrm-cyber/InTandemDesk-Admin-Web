#!/usr/bin/env node
/* ============================================================
   InTandem Desk — build (single app)

     node build.mjs             build into docs/
     node build.mjs --preview   allow a placeholder Firebase config

   No bundler, no dependencies. Copies src/app/ and src/shared/
   into docs/, so the deployed tree is self-contained.

   docs/ is the ONE published artifact: GitHub Pages serves main:/docs,
   and firebase.json points hosting there too. Both hosts therefore serve
   byte-identical files. If those two ever disagree the build refuses to
   run — see the hosting-root check below.

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

/* Hosting root check.

   The bug this exists to prevent: the build output moved to docs/ while
   firebase.json still deployed public/. Both commands kept reporting
   success and Firebase served a days-old tree, because nothing had
   written public/ since the move and .gitignore hid the drift.

   A mismatch is always a config error, never a valid state, so fail
   here rather than let `npm run deploy` (build && firebase deploy) hand
   the CLI a directory this build does not produce. */
const fbConfig = path.join(ROOT, 'firebase.json');
if (fs.existsSync(fbConfig)) {
  /* Strip a leading BOM — a Windows editor can add one, and JSON.parse
     rejects it with a stack trace that says nothing about hosting. */
  const raw = fs.readFileSync(fbConfig, 'utf8').replace(/^\uFEFF/, '');
  const hosting = JSON.parse(raw).hosting ?? [];
  const want = path.relative(ROOT, OUT).replace(/\\/g, '/');
  for (const site of [hosting].flat()) {
    if (!site?.public || path.resolve(ROOT, site.public) === OUT) continue;
    console.error(`
  ✖ firebase.json does not point at the build output.

    build.mjs writes        ${want}/
    hosting${site.target ? ` "${site.target}"` : ''} serves    ${site.public}/

    Deploying would publish a stale directory rather than this build.

    Fix:  set "public": "${want}" in firebase.json
`);
    process.exit(1);
  }
}

console.log(`\n  InTandem Desk · Admin Web${preview ? '  (preview)' : ''}`);
console.log(`  ${app} app + ${shared} shared files → docs/${pruned ? `  (${pruned} stale removed)` : ''}\n`);
if (preview && !configured) console.log('  ⚠  Firebase not configured — sign-in will show "Setup required".\n');
