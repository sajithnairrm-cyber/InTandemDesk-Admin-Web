/* ============================================================
   InTandem Desk — administrator authentication (admin build)

   Two jobs:

   1. Gate the whole application. Nothing renders until a Google
      account has signed in AND proved it is an administrator.
      App.start() is called from here and nowhere else.

   2. Expose window.ITDAdminAuth so the Staff view can manage the
      `staff` collection (the login directory for the staff app).

   How "is an administrator" is decided: we do NOT keep a second
   list in the client. We attempt to read the whole `staff`
   collection. Under firestore.rules only an email in isAdmin()
   can do that, so the read succeeding IS the proof. The rules
   file stays the single source of truth, and a non-admin can
   never talk itself past this check by editing the page.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

window.__itdAuthUp = true;

(function () {
  'use strict';

  const CONFIG     = window.ITD_FIREBASE || {};
  const CONFIGURED = !!window.ITD_CONFIGURED;

  const gate    = document.getElementById('authGate');
  const card    = document.getElementById('authCard');
  const toastEl = document.getElementById('authToast');

  /* ── Local development bypass ───────────────────────────────
     Signing in with Google on every reload makes UI work painful,
     so on localhost the app opens straight away.

     WHY THIS IS SAFE: the only trigger is location.hostname. A page
     served from any real domain can never match, so this cannot be
     reached in production no matter how the app is built or hosted.
     There is no flag, no env var and no build step that turns it on
     elsewhere — and nothing to remember to switch off.

     A banner is always visible while it is active, so nobody mistakes
     a bypassed session for a real one. Add ?auth to the URL to
     exercise the genuine sign-in flow locally.

     Private LAN addresses count as local too, so you can open the app on
     a real phone over Wi-Fi. Every pattern below is non-routable on the
     public internet — RFC 1918 ranges, loopback, and mDNS .local names —
     so a hostile site can never present one of these to a browser. */
  function isLocalHostname(h) {
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === ''
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)                  // 192.168.0.0/16
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)               // 10.0.0.0/8
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)   // 172.16.0.0/12
      || /\.local$/.test(h);                                     // mDNS
  }

  const IS_LOCAL   = isLocalHostname(location.hostname);
  const FORCE_AUTH = new URLSearchParams(location.search).has('auth');
  const DEV_BYPASS = IS_LOCAL && !FORCE_AUTH;

  if (DEV_BYPASS) {
    startDevMode();
    return;
  }

  function startDevMode() {
    window.__itdAuthUp = true;

    /* Stand in for the Firestore layer so the member panel renders
       instead of throwing. Reads return empty; writes are refused
       loudly, because there is no signed-in identity to attribute
       them to and silently pretending would be worse. */
    const refuse = () => Promise.reject(new Error('dev-mode: not signed in — add ?auth to the URL to use Firebase'));
    const devState = {
      user: { uid: 'dev', name: 'Developer', email: 'dev@localhost', photo: '' },
      isAdmin: true, configured: CONFIGURED, ready: true
    };
    window.ITDAdminAuth = {
      get configured() { return CONFIGURED; },
      get state() { return devState; },
      onState(fn) { fn(devState); return () => {}; },
      signIn: refuse, signOut: refuse,
      listStaff: () => Promise.resolve([]),
      addStaff: refuse, updateStaff: refuse, deleteStaff: refuse
    };

    if (gate) gate.hidden = true;

    const banner = document.createElement('div');
    banner.id = 'devBanner';
    banner.innerHTML =
      '<i class="fa-solid fa-code"></i> Local development — authentication bypassed. ' +
      '<a href="?auth">Sign in for real</a>';
    document.body.appendChild(banner);

    if (typeof window.ITDBoot === 'function') window.ITDBoot();
    if (window.App && window.App.Roles) window.App.Roles.applyNav();
    document.dispatchEvent(new CustomEvent('itd:auth', {
      detail: { uid: 'dev', name: 'Developer', email: 'dev@localhost', role: 'Owner' }
    }));
  }

  /* Same five-character escape the app core uses. Duplicated here on
     purpose: this module runs before itd-core.js is guaranteed to have
     evaluated, and an auth screen must never depend on app code. */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastT;
  const toast = (m) => {
    if (!toastEl) return;
    toastEl.textContent = m;
    toastEl.style.display = 'block';
    clearTimeout(toastT);
    toastT = setTimeout(() => (toastEl.style.display = 'none'), 5200);
  };

  const GLOGO = `<svg class="gbtn__g" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

  /* ── Gate views ─────────────────────────────────────────── */
  const V = {
    loading: (m) => `<div class="authspin"></div><p class="authmsg">${esc(m || 'Loading…')}</p>`,

    login: () => `<div class="authcard__mark">ID</div><h1>InTandem Desk</h1>
      <p class="authcard__sub">Admin/Owner access. Sign in with your InTandem Admin or Owner Google account.</p>
      <button class="gbtn" id="gGoogleBtn">${GLOGO}<span>Continue with Google</span></button>
      <p class="authnote">This console holds full project, vendor and ledger data. Access is limited to Admin/Owner accounts listed in the Firestore security rules.</p>`,

    denied: (email) => `<div class="authcard__mark"><i class="fa-solid fa-ban"></i></div><h1>Not an Admin/Owner</h1>
      <p class="authmsg">${email ? `<b>${esc(email)}</b> is not` : 'This account is not'} authorised to open the Admin/Owner console.<br>
      Staff members should use the staff app instead.</p>
      <button class="gbtn" id="gRetryBtn" style="margin-top:1.3rem"><span>Try another account</span></button>`,

    offline: () => `<div class="authcard__mark"><i class="fa-solid fa-plug-circle-exclamation"></i></div><h1>Can't verify access</h1>
      <p class="authmsg">We couldn't reach Firebase to confirm your account. Check your connection and try again.</p>
      <button class="gbtn" id="gRetryBtn" style="margin-top:1.3rem"><span>Retry</span></button>`,

    setup: () => `<div class="authcard__mark"><i class="fa-solid fa-gear"></i></div><h1>Setup required</h1>
      <p class="authmsg">Firebase isn't configured. Paste your project values into
      <code>src/shared/itd-config.js</code>, then rebuild.</p>
      <p class="authnote">See <code>docs/DEPLOYMENT.md</code>.</p>`
  };

  const show = (view, arg) => {
    if (!card) return;
    card.className = 'authcard' + ((view === 'denied' || view === 'offline') ? ' authcard--warn' : '');
    card.innerHTML = (V[view] || V.loading)(arg);
  };

  const friendlyErr = (e) => {
    const c = (e && (e.code || e.message)) || '';
    if (/popup-closed|cancelled-popup|popup-blocked/.test(c)) return 'Sign-in was cancelled or the popup was blocked.';
    if (/unauthorized-domain/.test(c)) return "This domain isn't authorised in Firebase Auth settings.";
    if (/network|unavailable/.test(c)) return 'Network error — check your connection.';
    if (/permission-denied/.test(c)) return 'Permission denied — check your Firestore security rules.';
    return 'Sign-in failed. Please try again.';
  };

  /* ── ITDAdminAuth: the API the Staff view calls ─────────── */
  let auth, db, provider;
  const listeners = new Set();
  const state = { user: null, isAdmin: false, configured: CONFIGURED, ready: false };
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error('[auth listener]', e); } });

  window.ITDAdminAuth = {
    get configured() { return CONFIGURED; },
    get state() { return state; },
    onState(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    async signIn() { if (!CONFIGURED) throw new Error('not-configured'); await doSignIn(); },
    async signOut() { if (auth) await signOut(auth); },
    async listStaff() {
      const snap = await getDocs(collection(db, 'staff'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
    async addStaff(data) {
      const email = (data.email || '').trim().toLowerCase();
      /* `role` is the permission field — "Owner" or "Staff" — and is
         required. The job description lives in `jobTitle`. Anything
         unrecognised normalises to Staff, which grants nothing. */
      const role = (window.App && window.App.Roles) ? window.App.Roles.norm(data.role) : 'Staff';
      return addDoc(collection(db, 'staff'), {
        name: (data.name || '').trim(),
        email,
        phone: (data.phone || '').trim(),
        role,
        jobTitle: (data.jobTitle || '').trim(),
        department: (data.department || '').trim(),
        status: data.status || 'Active',
        photo: '',
        createdAt: serverTimestamp()
      });
    },
    async updateStaff(id, patch) { return updateDoc(doc(db, 'staff', id), patch); },
    async deleteStaff(id) { return deleteDoc(doc(db, 'staff', id)); }
  };

  if (!CONFIGURED) { show('setup'); state.ready = true; emit(); return; }

  /* ── Boot ───────────────────────────────────────────────── */
  const app = initializeApp(CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (gate) gate.addEventListener('click', (e) => {
    if (e.target.closest('#gGoogleBtn') || e.target.closest('#gRetryBtn')) doSignIn();
  });

  async function doSignIn() {
    show('loading', 'Signing you in…');
    try {
      // Session persistence: closing the tab ends the admin session.
      await setPersistence(auth, browserSessionPersistence);
      await signInWithPopup(auth, provider);
    } catch (err) {
      show('login');
      toast(friendlyErr(err));
    }
  }

  onAuthStateChanged(auth, async (user) => {
    state.user = user
      ? { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL }
      : null;
    state.isAdmin = false;

    if (!user) { state.ready = true; emit(); show('login'); return; }

    show('loading', 'Verifying Admin/Owner access…');
    try {
      // The capability probe. Only an isAdmin() email can read the collection.
      await getDocs(collection(db, 'staff'));
      state.isAdmin = true;
      state.ready = true;
      emit();
      reveal(user);
    } catch (err) {
      const code = (err && (err.code || err.message)) || '';
      state.ready = true;
      emit();
      if (/permission-denied|insufficient/i.test(code)) {
        const email = user.email || '';
        await signOut(auth);
        show('denied', email);
      } else {
        // A network failure must not be mistaken for a rejection.
        show('offline');
        toast(friendlyErr(err));
      }
    }
  });

  /* ── Reveal the application ─────────────────────────────── */
  let revealed = false;
  function reveal(user) {
    if (gate) gate.hidden = true;

    const host = document.getElementById('authUser');
    if (host) {
      const name = user.displayName || (user.email || '').split('@')[0] || 'Administrator';
      const ph = user.photoURL
        ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
        : `<span class="authuser__ph">${esc(name.slice(0, 2).toUpperCase())}</span>`;
      host.innerHTML =
        `${ph}<span class="authuser__nm" title="${esc(name)} · ${esc((window.App && window.App.Roles) ? window.App.Roles.currentRole() : 'Owner')}">${esc(name)}</span>` +
        `<button class="authuser__out" id="authOut" title="Sign out"><i class="fa-solid fa-right-from-bracket"></i></button>`;
      host.hidden = false;
      document.getElementById('authOut')?.addEventListener('click', () => signOut(auth));
    }

    // Boot the app exactly once; a token refresh must not re-render it.
    if (!revealed) {
      revealed = true;
      if (typeof window.ITDBoot === 'function') window.ITDBoot();
    }
    // Hide navigation this role cannot use.
    if (window.App && window.App.Roles) window.App.Roles.applyNav();
    document.dispatchEvent(new CustomEvent('itd:auth', {
      detail: { uid: user.uid, name: user.displayName, email: user.email, role: (window.App && window.App.Roles) ? window.App.Roles.currentRole() : 'Owner' }
    }));
  }
})();
