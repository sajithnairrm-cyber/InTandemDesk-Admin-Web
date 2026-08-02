# InTandemDesk-Admin-Web

Admin/Owner portal for **InTandem Build** — desktop and laptop browsers.

This repository is standalone. Nothing in it imports from, builds against, or
requires the mobile repository at runtime.

> **Development only.** Hosting, deployment, CI/CD and domain configuration are
> deliberately not set up yet. See [Deferred](#deferred).

---

## Run it

Needs Node 18+. No dependencies to install.

```bash
npm run dev
```

<http://localhost:8080>

On localhost the app **opens straight away** — no Google sign-in — with an
amber banner at the bottom saying so. That is a development convenience; see
[Authentication](#authentication).

Other commands:

```bash
npm run build     # src/ → public/
npm run serve     # serve public/ without rebuilding
```

---

## Layout

```
src/
├── shared/      ← identical to the mobile repo (see below)
│   ├── itd-config.js       Firebase config
│   ├── itd-core.css        design system
│   ├── itd-auth.css        sign-in gate + dev banner
│   ├── itd-data.js         data layer — empty, first-run state
│   ├── itd-core.js         registry · router · helpers · Derive · Store
│   ├── itd-roles.js        Owner/Staff roles and permissions
│   ├── itd-auth-settings.js
│   └── itd-views-1..3.js   all eleven views
└── app/         ← this app only
    ├── index.html          desktop shell: sidebar, full topbar
    └── itd-admin-auth.js   auth gate + local dev bypass
public/          build output — generated, gitignored
docs/            architecture, roles spec, firestore.rules (reference)
```

`build.mjs` copies `src/app/` and `src/shared/` into `public/`. That is the
whole build — a file copy, no bundler, no dependencies.

---

## Authentication

The app is gated: `App.start()` is called only after an Admin/Owner account is
verified. Nothing renders behind the gate.

**On localhost that gate is bypassed** so you can work on the interface without
signing in every reload. The only trigger is `location.hostname`, so a page
served from any real domain can never take that path — there is no flag or env
var that enables it elsewhere, and nothing to remember to turn off.

```
http://localhost:8080          → bypassed, banner shown
http://localhost:8080/?auth    → real Google sign-in flow
```

While bypassed, Firestore reads return empty and writes are refused — there is
no signed-in identity to attribute them to.

> A build opened directly from disk (`file://`) also bypasses. Firebase auth
> cannot run over `file://` at all, so the alternative is a dead screen. Note
> that anything baked into `itd-data.js` is readable in view-source regardless
> of the gate — the data is the exposure, not the bypass.

---

## The shared-core rule

`src/shared/` is duplicated in `InTandemDesk-Admin-Mobile`. **Two copies in two
repositories will drift** — it already happened once in this project, where a
dead function and an orphaned handler survived for weeks in a forked file.

The repositories have no build or runtime dependency on each other. This is an
*optional* maintenance aid, run by hand:

```bash
npm run check:shared     # do the two repos agree?
npm run sync:push        # this repo wins
npm run sync:pull        # the other repo wins
```

It expects the two repos cloned as siblings:

```
some-folder/
├── InTandemDesk-Admin-Web/
└── InTandemDesk-Admin-Mobile/
```

If they are not siblings, the command exits with a message and nothing else is
affected. `src/app/` is never synced — that is where the two portals are meant
to differ.

**After editing anything in `src/shared/`: push to the other repo, commit both.**

---

## Pushing to GitHub

```bash
git init
```

```bash
git add . && git commit -m "Initial commit — Admin/Owner web portal"
```

```bash
git remote add origin https://github.com/<you>/InTandemDesk-Admin-Web.git
```

```bash
git push -u origin main
```

`public/` is gitignored — it is generated.

---

## Deferred

Not configured, by design, until development settles:

- Firebase Hosting · deployment · CI/CD · custom domains · production builds
- `docs/firestore.rules` is kept as reference. It is **not** published; the
  Owner/Staff permission split is currently enforced in the UI only.
