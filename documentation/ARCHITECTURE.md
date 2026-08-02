# Architecture

No bundler, no framework, no dependencies. Plain HTML, CSS and ES5-flavoured
JavaScript, plus two ES modules for Firebase. The build is a file copy.

That is a deliberate constraint, not an oversight: the app has to be readable
and fixable by whoever inherits it, without a toolchain to reconstruct first.

---

## Load order

`src/admin/index.html` pulls scripts in this exact order. It matters.

```
window.ITD_APP = 'admin'      ← build identity, must precede everything
shared/itd-config.js          ← window.ITD_FIREBASE
Chart.js (CDN)
shared/itd-data.js            ← window.DATA
shared/itd-core.js            ← window.App   (reads ITD_APP and DATA)
shared/itd-views-1..3.js      ← App.register(route, module) ×11
inline: window.ITDBoot        ← defined, NOT called
itd-admin-auth.js (module)    ← calls ITDBoot() only after verifying the admin
```

The last two lines are the security boundary. `ITDBoot` — which fills the
sidebar counts and calls `App.start()` — is defined but never self-invokes.
Only the auth module calls it, and only after the server has confirmed the
account is an administrator.

## `window.App` — the core

`src/shared/itd-core.js`, one IIFE, ~390 lines.

- **Helpers** — `$`, `$$`, `money()` (lakh/crore compaction), `esc()`,
  `safeUrl()`, `shortDate`, `fromNow`, `monthKey`
- **`store`** — namespaced `localStorage` under `itd.`, try/catch wrapped
- **`Derive`** — an IIFE evaluated once at load that computes vendor rollups,
  monthly ledger totals, area progress and status counts. Eleven view modules
  read from it instead of each re-reducing 638 ledger rows.
- **`Store`** — persisted CRUD for user-created projects, kanban tasks,
  payments and the activity log
- **Router** — parses `#/base/param?query`; `register(route, mod)` builds the
  registry; a `mounted` set means each module gets `mount()` once and
  `refresh()` thereafter
- **`start()`** — idempotent, so a token refresh cannot double-render

## Two data worlds

| | `window.DATA` | `App.Store` |
|---|---|---|
| Source | Weekly PMC workbook via `parse.py` | Created in the app |
| Contents | 85 budget lines, 235 schedule tasks, 56 vendors, 638 ledger rows, 11 areas | Projects, tasks, payments, activity |
| Mutability | Read-only | Full CRUD |
| Storage | Baked into `itd-data.js` | `localStorage`, `itd.` prefix |

The separation is clean and worth preserving: workbook truth is never written
to, and user data is never confused with it.

## One codebase, two apps

The admin and staff builds share `src/shared/` byte-for-byte. The only
divergence is `window.ITD_APP`, which `itd-core.js` turns into:

```js
const APP = window.ITD_APP === 'staff' ? 'staff' : 'admin';
const isAdminApp = APP === 'admin';
```

Views gate admin-only blocks on `App.isAdminApp`:

- `itd-views-1.js` — the Bank / Office-cash KPI cards on the dashboard
- `itd-views-2.js` — the **Staff login access** panel and its `renderFb()` calls

This replaces the previous arrangement, where the two apps were separate
2800-line HTML files that had already started to drift. Adding the staff build
now means an `index.html`, an auth module, and nothing else.

## Authentication

`src/admin/itd-admin-auth.js`.

**How admin status is decided — no client-side list.** The module attempts to
read the entire `staff` collection. Under `firestore.rules` only an email in
`isAdmin()` can do that, so a successful read *is* the proof:

```js
await getDocs(collection(db, 'staff'));   // throws permission-denied for non-admins
state.isAdmin = true;
```

Three consequences worth understanding:

1. The rules file is the single source of truth. Adding an admin is a rules
   publish, not a redeploy.
2. Tampering with the page cannot help. Setting `isAdmin = true` in a console
   reveals the shell, but every Firestore read still fails server-side.
3. **A network error is not a rejection.** `permission-denied` shows "Not an
   administrator" and signs the user out; anything else shows "Can't verify
   access" with a retry. Conflating the two would lock admins out whenever
   their connection dropped.

Session persistence is `browserSessionPersistence` — closing the tab ends the
session.

`window.ITDAdminAuth` exposes `listStaff / addStaff / updateStaff /
deleteStaff / onState / signIn / signOut` for the Staff view's login-management
panel.

## The build

`build.mjs` deletes `public/`, then copies `src/<site>/` and `src/shared/` into
`public/<site>/`. That is all it does — the deployed tree is self-contained
while the source keeps one copy of the shared code.

It **fails** while `itd-config.js` holds `PASTE_` placeholders. An unconfigured
build has a sign-in gate that cannot function, and must never reach a public
URL. `--preview` overrides this for local look-and-feel work only.

---

## The honest limitation

**`window.DATA` ships inside the page.** The gate protects the UI and
everything in Firestore. It does not protect the 246 KB of parsed workbook data
in `itd-data.js`, which is readable in view-source by anyone who can load the
URL.

Today that is bounded — only administrators can load the admin URL. It becomes
a real problem with the staff build, where the same file would ship to every
staff member regardless of role.

**The fix is to move `DATA` into Firestore** behind rules requiring an active
staff record, and load it after auth. That also removes the weekly
rebuild-and-redeploy cycle, since updating the workbook becomes a data write.
It is the next substantial piece of work, and it is why the gate calls
`ITDBoot()` rather than the page booting itself — that seam is where the
Firestore load will go.

## Deliberate deviations from the original single-file app

| Change | Why |
|---|---|
| `esc()` also escapes `'` | Some templates interpolate into single-quoted CSS `url(...)` |
| `safeUrl()` added, used on News links and images | RSS `<link>` was unvalidated; `javascript:` would have become a live link |
| CSV cells starting `= + - @` get an apostrophe | Excel executes them on open, and these exports are opened in Excel |
| `start()` made idempotent, no longer self-invoked | It is now the auth boundary |
| Admin-only blocks gated, not forked | Two hand-maintained copies had already drifted |
