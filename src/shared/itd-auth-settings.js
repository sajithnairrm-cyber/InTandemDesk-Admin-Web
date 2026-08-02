/* ============================================================
   InTandem Desk — Authentication & Security settings

   UI and state only. This file deliberately contains NO Firebase
   code: no SDK import, no initialisation, no auth calls. It is the
   shape Firebase plugs into later.

   The contract for that later work is small and explicit:

     1. Read state from  App.AuthSettings.config  — never from the DOM.
     2. Write state with App.AuthSettings.save({ … }). It persists and
        fires `itd:authconfig`. It deliberately does NOT re-render:
        replacing the controls while someone is using them would steal
        focus mid-interaction.
     3. To light up the Firebase panel, call
        App.AuthSettings.setFirebaseStatus({ projectName, authStatus,
        providers, lastSync, activeUsers }). That repaints the section
        on its own. The panel is fully data-driven — no markup changes.

   Note the surrounding Settings module has an empty refresh(), so the
   page renders once per load. This module therefore repaints only its
   own container, never the whole page.

   Nothing here is hardcoded into HTML — every label, option and
   default lives in the objects below.
   ============================================================ */

(function (App) {
  'use strict';

  const { $, $$, esc } = App;

  /* ── State ──────────────────────────────────────────────────
     The canonical config object. Firebase integration reads and
     writes exactly these keys. */
  const DEFAULTS = {
    provider: 'google',
    firebaseConnected: false,

    // Login preferences
    allowGoogleSignIn: true,
    allowEmailLogin: false,
    allowMicrosoftLogin: false,
    rememberSession: true,
    autoSessionRestore: true,

    // Security
    sessionTimeout: 60,               // minutes · 0 = never
    forceLogoutMultipleDevices: true, // inverse of the spec's `allowMultipleDevices`
    requireSecureSession: true,
    enableActivityLogs: true
  };

  /* Populated by the future Firebase integration. While
     `firebaseConnected` is false the panel ignores it entirely. */
  const EMPTY_STATUS = {
    projectName: null,
    authStatus: null,
    providers: [],
    lastSync: null,
    activeUsers: null
  };

  const KEY = 'auth.config';
  let config = Object.assign({}, DEFAULTS, App.store.get(KEY, {}));
  let firebaseStatus = Object.assign({}, EMPTY_STATUS);

  function load() {
    config = Object.assign({}, DEFAULTS, App.store.get(KEY, {}));
    return config;
  }

  function save(patch) {
    config = Object.assign({}, config, patch);
    App.store.set(KEY, config);
    document.dispatchEvent(new CustomEvent('itd:authconfig', { detail: config }));
    return config;
  }

  function reset() {
    config = Object.assign({}, DEFAULTS);
    App.store.set(KEY, config);
    return config;
  }

  /* ── Reference data ─────────────────────────────────────────
     Only Google is enabled. The other two are shown so the choice
     is visible and so enabling one later is a data change. */
  const PROVIDERS = [
    { id: 'google',    label: 'Google Authentication', icon: 'fa-brands fa-google',    enabled: true,  hint: 'Sign in with a Google Workspace or Gmail account' },
    { id: 'microsoft', label: 'Microsoft',             icon: 'fa-brands fa-microsoft', enabled: false, hint: 'Not available' },
    { id: 'password',  label: 'Email & Password',      icon: 'fa-solid fa-key',        enabled: false, hint: 'Not available' }
  ];

  const TIMEOUTS = [
    { v: 15,  l: '15 Minutes' },
    { v: 30,  l: '30 Minutes' },
    { v: 60,  l: '1 Hour' },
    { v: 240, l: '4 Hours' },
    { v: 0,   l: 'Never' }
  ];

  /* Placeholder account. Replaced by the signed-in Firebase user later. */
  const ACCOUNT_KEY = 'auth.account';
  const ACCOUNT_DEFAULTS = {
    name: 'Administrator',
    email: 'admin@intandembuild.com',
    role: 'Super Admin',
    status: 'Active',
    photo: '',
    hue: 205
  };
  let account = Object.assign({}, ACCOUNT_DEFAULTS, App.store.get(ACCOUNT_KEY, {}));

  function saveAccount(patch) {
    account = Object.assign({}, account, patch);
    App.store.set(ACCOUNT_KEY, account);
    return account;
  }

  /* Fields the panel will show once Firebase is connected. Listing
     them here means the "what you'll get" copy and the real panel
     can never drift apart. */
  const STATUS_FIELDS = [
    { key: 'projectName',  label: 'Project Name' },
    { key: 'authStatus',   label: 'Authentication Status' },
    { key: 'providers',    label: 'Connected Providers' },
    { key: 'lastSync',     label: 'Last Sync Time' },
    { key: 'activeUsers',  label: 'Active Users' }
  ];

  /* ── Render helpers ─────────────────────────────────────────
     Small, composable, and reused by every card below. */

  /** A labelled on/off row. `key` is the config key it controls. */
  function switchRow(key, title, desc, opts) {
    const o = opts || {};
    const on = o.forceOn != null ? o.forceOn : !!config[key];
    return `
      <div class="swrow${o.disabled ? ' is-off' : ''}">
        <div class="swrow__id">
          <div class="swrow__t">${esc(title)}</div>
          ${desc ? `<div class="swrow__d">${esc(desc)}</div>` : ''}
        </div>
        <label class="sw" title="${esc(o.disabled ? 'Not available' : title)}">
          <input type="checkbox" data-auth="${esc(key)}" ${on ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}>
          <span class="sw__t"></span>
        </label>
      </div>`;
  }

  function providerRow(p) {
    const active = config.provider === p.id && p.enabled;
    return `
      <div class="provrow${p.enabled ? '' : ' is-off'}">
        <span class="provrow__ico"><i class="${esc(p.icon)}"></i></span>
        <div class="swrow__id">
          <div class="swrow__t">${esc(p.label)}${p.enabled ? '' : ' <span class="faint">(Disabled)</span>'}</div>
          <div class="swrow__d">${esc(p.hint)}</div>
        </div>
        ${active
          ? `<span class="pill completed">Active</span>`
          : `<span class="pill none">${p.enabled ? 'Available' : 'Disabled'}</span>`}
      </div>`;
  }

  function adminAccountCard() {
    const initials = (account.name || '?').trim().slice(0, 2).toUpperCase();
    const photo = account.photo
      ? `<img class="authacct__img" src="${esc(App.safeUrl(account.photo))}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar lg" style="--h:${Number(account.hue) || 205}">${esc(initials)}</span>`;
    return `
      <div class="card">
        <div class="card__head">
          <div><h2>Admin Account</h2><p class="sub">The account that administers this portal</p></div>
          <button class="btn btn--ghost btn--sm" id="authAcctEdit"><i class="fa-solid fa-pen"></i> Edit</button>
        </div>
        <div class="card__body">
          <div class="authacct">
            ${photo}
            <div class="authacct__id">
              <div class="authacct__nm">${esc(account.name)}</div>
              <div class="authacct__em num">${esc(account.email)}</div>
            </div>
          </div>
          <dl class="deflist" style="margin-top:1rem">
            <div><dt>Role</dt><dd>${App.Roles ? App.Roles.badge(App.Roles.currentRole()) : esc(account.role)}</dd></div>
            <div><dt>Status</dt><dd><span class="pill ${account.status === 'Active' ? 'completed' : 'none'}">${esc(account.status)}</span></dd></div>
          </dl>
        </div>
      </div>`;
  }

  function firebasePanel() {
    const on = !!config.firebaseConnected;
    const rows = STATUS_FIELDS.map(f => {
      let v = firebaseStatus[f.key];
      if (Array.isArray(v)) v = v.length ? v.join(', ') : null;
      return `<div><dt>${esc(f.label)}</dt><dd>${v == null ? '<span class="faint">—</span>' : esc(String(v))}</dd></div>`;
    }).join('');

    return `
      <div class="card" style="margin-top:1rem">
        <div class="card__head">
          <div><h2>Firebase Authentication</h2><p class="sub">Backend authentication service</p></div>
          <span class="pill ${on ? 'completed' : 'none'}">${on ? 'Connected' : 'Not Connected'}</span>
        </div>
        <div class="card__body">
          ${on ? '' : `<p class="muted" style="font-size:13px; margin:0 0 1rem; line-height:1.65">
            Firebase Authentication has not yet been configured. Once it is integrated,
            this panel will display the values below automatically.</p>`}
          <dl class="deflist">${rows}</dl>
        </div>
      </div>`;
  }

  /* ── The section ────────────────────────────────────────────
     `render()` wraps `sectionInner()` in a container so the module can
     repaint itself without the host page needing a refresh() of its own. */
  const HOST_ID = 'authSection';

  function render() {
    return `<div id="${HOST_ID}">${sectionInner()}</div>`;
  }

  /** Repaint just this section, then rebind. Safe to call any time. */
  function refresh() {
    const host = document.getElementById(HOST_ID);
    if (!host) return false;
    host.innerHTML = sectionInner();
    bind(host);
    return true;
  }

  function sectionInner() {
    return `
      <div class="navgroup" style="margin:1.6rem 0 .9rem; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint)">Authentication</div>

      <div class="card">
        <div class="card__head"><div><h2>Authentication &amp; Security</h2><p class="sub">How people sign in to this portal</p></div></div>
        <div class="card__body">
          ${PROVIDERS.map(providerRow).join('')}
          <p class="muted" style="font-size:12.5px; margin:1rem 0 0; line-height:1.6">
            <i class="fa-solid fa-circle-info" style="color:var(--info)"></i>
            Google Authentication will be connected to Firebase in a future update.
          </p>
        </div>
      </div>

      <div class="grid g-2" style="margin-top:1rem">
        ${adminAccountCard()}
        <div class="card">
          <div class="card__head"><div><h2>Login Preferences</h2><p class="sub">Which sign-in methods are offered</p></div></div>
          <div class="card__body">
            ${switchRow('allowGoogleSignIn', 'Allow Google Sign-In', 'The only method currently available')}
            ${switchRow('allowEmailLogin', 'Allow Email Login', 'Not available', { disabled: true, forceOn: false })}
            ${switchRow('allowMicrosoftLogin', 'Allow Microsoft Login', 'Not available', { disabled: true, forceOn: false })}
            ${switchRow('rememberSession', 'Remember Last Login', 'Pre-fill the last account used')}
            ${switchRow('autoSessionRestore', 'Auto Session Restore', 'Resume an unexpired session on return')}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:1rem">
        <div class="card__head"><div><h2>Security</h2><p class="sub">Session handling and audit</p></div></div>
        <div class="card__body">
          <label class="field" style="max-width:280px; margin-bottom:1.2rem">
            <span>Session Timeout</span>
            <select id="authTimeout">
              ${TIMEOUTS.map(t => `<option value="${t.v}" ${Number(config.sessionTimeout) === t.v ? 'selected' : ''}>${esc(t.l)}</option>`).join('')}
            </select>
          </label>
          ${switchRow('forceLogoutMultipleDevices', 'Force Logout on Multiple Devices', 'Signing in elsewhere ends the earlier session')}
          ${switchRow('requireSecureSession', 'Require Secure Session', 'Refuse to run over an insecure connection')}
          ${switchRow('enableActivityLogs', 'Enable Activity Logs', 'Record sign-ins and administrative actions')}
        </div>
      </div>

      ${firebasePanel()}`;
  }

  /* ── Events ─────────────────────────────────────────────────
     Delegated where possible so a re-render never leaves a stale
     listener behind. */
  function bind(root) {
    const host = root || document;

    $$('[data-auth]', host).forEach(el => {
      if (el.disabled) return;
      el.addEventListener('change', () => {
        save({ [el.dataset.auth]: el.checked });
        App.toast('Setting saved', el.checked ? 'Enabled' : 'Disabled', 'good');
      });
    });

    const sel = $('#authTimeout', host);
    if (sel) sel.addEventListener('change', () => {
      save({ sessionTimeout: Number(sel.value) });
      const t = TIMEOUTS.find(x => x.v === Number(sel.value));
      App.toast('Session timeout updated', t ? t.l : '', 'good');
    });

    const edit = $('#authAcctEdit', host);
    if (edit) edit.addEventListener('click', openAccountModal);
  }

  function openAccountModal() {
    const F = (id, label, val, type) =>
      `<label class="field"><span>${label}</span><input id="${id}" type="${type || 'text'}" value="${esc(val || '')}"></label>`;
    App.modal({
      title: 'Edit admin account',
      body: `<div class="formgrid">
        ${F('aaName', 'Full name', account.name)}
        ${F('aaEmail', 'Admin email', account.email, 'email')}
        <div class="formrow">
          ${F('aaRole', 'Role', account.role)}
          <label class="field"><span>Status</span><select id="aaStatus">
            ${['Active', 'Inactive', 'Suspended'].map(s => `<option ${account.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select></label>
        </div>
        <p class="muted" style="font-size:12px; margin:.2rem 0 0; line-height:1.6">
          Placeholder details, saved to this browser only. Once Firebase Authentication is
          connected these fields come from the signed-in account and become read-only.</p>
      </div>`,
      footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="aaSave"><i class="fa-solid fa-check"></i> Save</button>`
    });
    $('#aaSave').addEventListener('click', () => {
      saveAccount({
        name: ($('#aaName').value || '').trim() || 'Administrator',
        email: ($('#aaEmail').value || '').trim(),
        role: ($('#aaRole').value || '').trim(),
        status: $('#aaStatus').value
      });
      App.closeModal();
      App.toast('Account updated', 'Saved to this browser.', 'good');
      document.dispatchEvent(new CustomEvent('itd:authaccount', { detail: account }));
    });
  }

  /* ── Public API ─────────────────────────────────────────────
     The whole Firebase integration surface. */
  App.AuthSettings = {
    get config() { return config; },
    get account() { return account; },
    get status() { return firebaseStatus; },
    /** Called by the future Firebase layer to light up the panel. */
    setFirebaseStatus(s) {
      firebaseStatus = Object.assign({}, EMPTY_STATUS, s || {});
      save({ firebaseConnected: true });
      refresh();
      return firebaseStatus;
    },
    /** Return the panel to its unconfigured state. */
    clearFirebaseStatus() {
      firebaseStatus = Object.assign({}, EMPTY_STATUS);
      save({ firebaseConnected: false });
      refresh();
      return firebaseStatus;
    },
    DEFAULTS, PROVIDERS, TIMEOUTS, STATUS_FIELDS,
    load, save, reset, saveAccount, render, refresh, bind
  };

})(window.App);
