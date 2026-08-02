#!/usr/bin/env node
/* ============================================================
   InTandem Desk — local static server

     node serve.mjs [port]        default: 8080

   For previewing a build before the Firebase CLI is involved.
   `firebase serve` is more faithful once you have it — it applies
   the headers and rewrites from firebase.json, which this does not.

   Serves over http://localhost, which is what Google sign-in needs
   (it cannot run from a file:// path). localhost is pre-authorised
   in Firebase Auth, so sign-in works here.
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'InTandem Desk · Admin Web';
const PORT = 8080;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(ROOT, 'docs');
const port = Number(process.argv[2]) || PORT;

if (!fs.existsSync(base)) {
  console.error('\n  docs/ does not exist. Run:  npm run build\n');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico':  'image/x-icon'
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(base, url === '/' ? 'index.html' : url);

  // Never serve outside the build directory.
  if (!path.resolve(file).startsWith(path.resolve(base))) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`\n  ${NAME}   →   http://localhost:${port}\n  Ctrl-C to stop\n`);
});
