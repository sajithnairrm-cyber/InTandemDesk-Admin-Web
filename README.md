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

**This is the whole local setup in one command.** It syncs the shared core to
the mobile repo, builds both apps, serves both, then watches for changes and
repeats — so editing here keeps the mobile app in step automatically.

| | |
|---|---|
| 💻 Web | http://localhost:8080 |
| 📱 Mobile | http://localhost:8081 |

It also prints your Wi-Fi address so you can open the mobile app **on a real
phone** — e.g. `http://192.168.1.7:8081`. Test the mobile UI there, not in a
desktop emulator: touch targets, momentum scrolling and the iOS safe area only
behave honestly on a device.

Both apps open straight past the login gate with an amber banner. See
[Authentication](#authentication).

Other commands:

```bash
npm run dev:web    # web only, no mobile
npm run build      # src/ -> docs/ once
npm run serve      # serve docs/ without building
npm run ship "…"   # build, commit and push BOTH repos
```

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
│   ├── itd-views-1..3.js   all eleven views
│   └── itd-admin-auth.js   auth gate + local dev bypass
└── app/         ← this app only
    └── index.html          desktop shell: sidebar, full topbar
docs/            build output — COMMITTED, served by GitHub Pages
documentation/   architecture, roles spec, firestore.rules
```

`build.mjs` copies `src/app/` and `src/shared/` into `docs/`. That is the
whole build — a file copy, no bundler, no dependencies. It outputs to `docs/`
because GitHub Pages can only publish from the repo root or `/docs`.

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

`src/shared/` (11 files) is duplicated in `InTandemDesk-Admin-Mobile`. **Two copies in two
repositories will drift** — it already happened twice in one day with
`itd-admin-auth.js`, which is why that file now lives in `shared/` rather
than `app/`.

`npm run dev` removes the problem while you work: every save to
`src/shared/` is mirrored to the mobile repo and both apps rebuild. You do not
run a sync command.

Manual commands, if the watcher is not running:

```bash
npm run check:shared     # do the two repos agree?
npm run sync:push        # this repo wins
npm run sync:pull        # the other repo wins
```

Both repositories must be cloned as siblings:

```
some-folder/
├── InTandemDesk-Admin-Web/
└── InTandemDesk-Admin-Mobile/
```

`src/app/` is never synced — that is where the two portals are meant to differ:

| | `src/app/` holds |
|---|---|
| Web | `index.html` |
| Mobile | `index.html`, `itd-mobile.css`, `itd-mobile-nav.js` |

**Committing is still manual.** Files staying in sync does not commit them —
if the mobile repo is never pushed, GitHub Pages keeps serving the old build.
`npm run ship "message"` in the web repo commits and pushes both together.

## Committing

Both repos are already on GitHub. From the **web** repo:

```bash
npm run ship "what changed"
```

That builds both, then commits and pushes both with the same message —
skipping either if it has nothing to commit. Use plain `git` if you'd rather
handle them separately.

`docs/` **is committed** — GitHub Pages serves the app from it. `npm run build`
regenerates it; never edit it by hand.

Repo: <https://github.com/sajithnairrm-cyber/InTandemDesk-Admin-Web>

---

## Deferred

Not configured, by design, until development settles:

- Firebase Hosting · deployment · CI/CD · custom domains · production builds
- `docs/firestore.rules` is kept as reference. It is **not** published; the
  Owner/Staff permission split is currently enforced in the UI only.
