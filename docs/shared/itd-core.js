/* Extracted from InTandemDesk_11_2.html by the 2026-07-31 refactor.
   Shared by the admin and staff builds — edit here, never in a built copy. */
/* ============================================================
   InTandem Desk — application core
   Owns: module registry, hash router, shared helpers, derived
   data (Derive.*), theme, sidebar, global search, toasts, modal,
   boot. localStorage prefix is `itd.`  Everything reads from the
   single window.DATA object parsed from the weekly PMC workbook.
   ============================================================ */
window.App = (function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D  = window.DATA;

  /* ── Build identity ───────────────────────────────────────
     Each index.html sets window.ITD_APP before these scripts load.
     The view files are shared byte-for-byte between the two builds;
     anything admin-only is gated on isAdminApp rather than forked
     into a second copy of the file. */
  const APP = window.ITD_APP === 'staff' ? 'staff' : 'admin';
  const isAdminApp = APP === 'admin';

  /* ── Formatting (en-IN, lakh/crore) ───────────────────── */
  const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  function money(v, compact = false) {
    if (v == null) return '—';
    const n = Math.round(v);
    if (!compact) return '₹' + inr.format(n);
    if (Math.abs(v) >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
    if (Math.abs(v) >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
    return '₹' + inr.format(n);
  }
  const percent = (v, d = 1) => (v == null ? '—' : v.toFixed(d) + '%');

  function shortDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthLabel(key) {
    const [y, m] = key.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  function fromNow(iso) {
    const days = Math.round((Date.now() - new Date(iso)) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    const mo = Math.round(days / 30);
    return mo === 1 ? 'a month ago' : mo + ' months ago';
  }
  /* Escapes the five characters that can break out of an HTML attribute or
     text node. The apostrophe matters because a few templates interpolate
     into single-quoted CSS url(...) values. */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Only http(s) survives. Anything else — javascript:, data:, vbscript: —
     comes back as '#', so a hostile feed item can't become a live link. */
  const safeUrl = u => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#');

  /* ── Empty states ─────────────────────────────────────────
     One component, used by every module, so a first-run install
     reads consistently instead of eleven different blanks.

       empty('No projects have been created yet.', {
         icon: 'fa-diagram-project',
         hint: 'Create your first project to get started.',
         action: '<button class="btn btn--accent" id="x">New</button>'
       })

     `bare: true` returns the inner block without the card wrapper,
     for use inside a card that already exists. */
  function empty(title, opts) {
    const o = opts || {};
    const inner = `<div class="dt__empty" style="padding:${o.compact ? '1.6rem 1rem' : '3rem 1rem'}">
      <i class="fa-solid ${esc(o.icon || 'fa-inbox')}" style="font-size:${o.compact ? '22px' : '28px'};opacity:.35;display:block"></i>
      <p style="margin:.9rem 0 .2rem;font-weight:600;color:var(--ink);font-size:14px">${esc(title)}</p>
      ${o.hint ? `<p class="muted" style="font-size:12.5px;max-width:420px;margin:0 auto;line-height:1.6">${esc(o.hint)}</p>` : ''}
      ${o.action ? `<div style="margin-top:1.1rem">${o.action}</div>` : ''}
    </div>`;
    return o.bare ? inner : `<div class="card">${inner}</div>`;
  }

  /** Empty state sized to sit inside a chart well. */
  function emptyChart(msg) {
    return `<div class="dt__empty" style="padding:2.2rem 1rem">
      <i class="fa-solid fa-chart-column" style="font-size:22px;opacity:.3;display:block"></i>
      <p class="muted" style="margin:.7rem 0 0;font-size:12.5px">${esc(msg || 'No data available')}</p>
    </div>`;
  }

  /** A row spanning a table, for "no records found". */
  const emptyRow = (cols, msg) =>
    `<tr><td colspan="${cols}" class="dt__empty">${esc(msg || 'No records found')}</td></tr>`;

  /** Percentage that stays 0 instead of NaN when the base is zero. */
  const pctOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

  /* ── Persistence ──────────────────────────────────────── */
  const store = {
    get(k, f) { try { const r = localStorage.getItem('itd.' + k); return r ? JSON.parse(r) : f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem('itd.' + k, JSON.stringify(v)); } catch { } },
    del(k) { try { localStorage.removeItem('itd.' + k); } catch { } }
  };

  /* ── Derived data — computed once, reused everywhere ──── */
  const Derive = (() => {
    const vendors = D.vendors;
    const ledger = D.ledger;

    // Balance-sheet rollups (authoritative headline figures)
    const quoteTotal = vendors.reduce((s, v) => s + (v.quotation || 0), 0);
    const relTotal   = vendors.reduce((s, v) => s + (v.released || 0), 0);
    const balTotal   = vendors.reduce((s, v) => s + (v.balance != null ? v.balance : (v.quotation || 0) - (v.released || 0)), 0);

    // Ledger sum (actual transactions)
    const ledgerTotal = ledger.reduce((s, t) => s + t.amount, 0);

    // Schedule status counts
    const statusCounts = {};
    D.schedule.forEach(t => { const k = t.status || 'No status'; statusCounts[k] = (statusCounts[k] || 0) + 1; });

    // Per-area progress
    const areaProgress = D.areas.map(a => {
      const tasks = D.schedule.filter(t => t.area === a.code);
      const done = tasks.filter(t => t.status === 'Completed').length;
      return { ...a, total: tasks.length, done, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
    });

    // Monthly spend from ledger (sorted)
    const byMonth = {};
    ledger.forEach(t => { const k = monthKey(t.date); byMonth[k] = (byMonth[k] || 0) + t.amount; });
    const months = Object.keys(byMonth).sort();
    const monthly = months.map(k => ({ key: k, label: monthLabel(k), total: byMonth[k] }));

    // Ledger grouped by balance-sheet account (for vendor drill-down)
    const ledgerByAccount = {};
    ledger.forEach(t => { const k = (t.account || '').toLowerCase(); (ledgerByAccount[k] = ledgerByAccount[k] || []).push(t); });

    // Vendors enriched with paid% and settled flag
    const vendorsRich = vendors.map(v => {
      const q = v.quotation || 0;
      const rel = v.released || 0;
      const bal = v.balance != null ? v.balance : q - rel;
      const pct = q ? Math.round(rel / q * 100) : (rel ? 100 : 0);
      return { ...v, bal, pct, settled: bal <= 0 && q > 0, txns: ledgerByAccount[(v.account || '').toLowerCase()] || [] };
    });

    // Top vendors by outstanding balance
    const topOutstanding = [...vendorsRich].filter(v => v.bal > 0).sort((a, b) => b.bal - a.bal).slice(0, 8);

    // Budget rollups
    const budgetGst = D.budget.reduce((s, b) => s + (b.quoteGst || 0), 0);
    const budgetReleased = D.budget.reduce((s, b) => s + (b.released || 0), 0);

    // Recent ledger activity
    const recent = [...ledger].slice(-12).reverse();

    return {
      quoteTotal, relTotal, balTotal, ledgerTotal,
      statusCounts, areaProgress, monthly, months,
      ledgerByAccount, vendorsRich, topOutstanding,
      budgetGst, budgetReleased, recent,
      settledCount: vendorsRich.filter(v => v.settled).length,
      outstandingCount: vendorsRich.filter(v => v.bal > 0).length
    };
  })();

  /* Schedule status → css class + short label */
  function statusClass(s) {
    if (!s) return 'none';
    const k = s.toLowerCase();
    if (k.includes('completed')) return 'completed';
    if (k.includes('progress')) return 'progress';
    if (k.includes('final')) return 'final';
    if (k.includes('installation')) return 'installation';
    if (k.includes('material')) return 'material';
    if (k.includes('start')) return 'start';
    if (k.includes('vendor')) return 'vendor';
    if (k.includes('factory')) return 'factory';
    if (k.includes('details')) return 'details';
    return 'none';
  }

  /* ── Entity store (persisted CRUD for the management modules) ──
     User-created projects, tasks, payments and activity persist under
     itd.* keys. There is no seed data — a first run starts empty. */
  const catIcon = { Hospitality: 'fa-martini-glass', Residential: 'fa-house', Interiors: 'fa-couch', Commercial: 'fa-building', Landscape: 'fa-tree' };
  /* No seed projects. The Projects tab starts empty; the user creates
     the first one with the New Project button. */
  const SEED_PROJECTS = [];

  function logActivity(pid, msg, who = 'You') {
    const all = store.get('activity', {}); (all[pid] = all[pid] || []); all[pid].unshift({ msg, who, at: new Date().toISOString() }); store.set('activity', all);
  }
  const Store = {
    _user() { return store.get('projects', []); },
    projects() { return SEED_PROJECTS.concat(this._user()); },
    project(id) { return this.projects().find(p => p.id === id); },
    addProject(p) { const a = this._user(); a.push(p); store.set('projects', a); logActivity(p.id, 'Project created'); notifyPush({ type: 'project', icon: 'fa-diagram-project', title: 'New project created', body: p.name, route: '#/projects/' + p.id }); },
    updateProject(id, patch) { const a = this._user(); const i = a.findIndex(p => p.id === id); if (i >= 0) { a[i] = { ...a[i], ...patch, updated: new Date().toISOString() }; store.set('projects', a); logActivity(id, 'Project details updated'); } },
    deleteProject(id) {
      store.set('projects', this._user().filter(p => p.id !== id));
      const t = store.get('tasks', {}); delete t[id]; store.set('tasks', t);
      const act = store.get('activity', {}); delete act[id]; store.set('activity', act);
      store.set('payments', store.get('payments', []).filter(x => x.projectId !== id));
      notifyPush({ type: 'project', icon: 'fa-trash', title: 'Project deleted', body: id, route: '#/projects' });
    },
    tasks(pid) { return store.get('tasks', {})[pid] || []; },
    setTasks(pid, arr) { const all = store.get('tasks', {}); all[pid] = arr; store.set('tasks', all); },
    addTask(pid, t) { const a = this.tasks(pid); a.push(t); this.setTasks(pid, a); logActivity(pid, 'Task added — ' + t.title); notifyPush({ type: 'task', icon: 'fa-clipboard-check', title: 'Task assigned', body: t.title, route: '#/projects/' + pid + '?tab=tasks' }); },
    updateTask(pid, tid, patch) { const a = this.tasks(pid); const i = a.findIndex(t => t.id === tid); if (i >= 0) { a[i] = { ...a[i], ...patch }; this.setTasks(pid, a); } },
    payments(pid) { const a = store.get('payments', []); return pid ? a.filter(p => p.projectId === pid) : a; },
    addPayment(p) { const a = store.get('payments', []); a.push(p); store.set('payments', a); logActivity(p.projectId, 'Payment recorded — ₹' + inr.format(p.amount)); notifyPush({ type: 'payment', icon: 'fa-indian-rupee-sign', title: 'Payment recorded', body: (p.invoiceNo ? p.invoiceNo + ' · ' : '') + '₹' + inr.format(p.amount), route: '#/payments' }); },
    activity(pid) { return store.get('activity', {})[pid] || []; }
  };

  /* No seed data. A first run starts with an empty Projects tab and the
     user creates the first project. The previous build seeded a sample
     "Thanal" project here; that has been removed.

     Anyone upgrading from that build still has it in localStorage, so
     clear it once — keyed on a flag so a project the user genuinely
     named "Thanal" later is never touched. */
  (function clearLegacySeed() {
    if (store.get('seed.cleared', false)) return;
    const a = store.get('projects', []);
    const pruned = a.filter(p => !(p.id === 'thanal' && !p.client && !p.budget && !p.start));
    if (pruned.length !== a.length) {
      store.set('projects', pruned);
      const t = store.get('tasks', {}); delete t.thanal; store.set('tasks', t);
      const act = store.get('activity', {}); delete act.thanal; store.set('activity', act);
    }
    store.del('seed.thanal');
    store.set('seed.cleared', true);
  })();

  /* ── Notifications ────────────────────────────────────── */
  function notifyPush(n) { const a = store.get('notif.pushed', []); n.id = 'n' + Date.now() + Math.random().toString(36).slice(2, 5); n.at = new Date().toISOString(); a.unshift(n); store.set('notif.pushed', a.slice(0, 60)); document.dispatchEvent(new CustomEvent('itd:notify')); }
  function notifications() {
    const read = new Set(store.get('notif.read', []));
    const list = store.get('notif.pushed', []).slice();
    // Derived: overdue / due-soon invoices
    const today = new Date().toISOString().slice(0, 10);
    Store.payments().forEach(p => {
      if (!p.dueDate) return;
      if ((p.status === 'Pending' || p.status === 'Partial' || p.status === 'Overdue') && p.dueDate < today)
        list.push({ id: 'due-' + p.id, type: 'payment', icon: 'fa-triangle-exclamation', title: 'Payment overdue', body: (p.invoiceNo || 'Invoice') + ' · ₹' + inr.format(p.amount), route: '#/payments', at: p.dueDate + 'T09:00:00' });
    });
    list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return list.map(n => ({ ...n, read: read.has(n.id) }));
  }
  const notifApi = {
    all: notifications,
    unread() { return notifications().filter(n => !n.read).length; },
    markRead(id) { const s = new Set(store.get('notif.read', [])); s.add(id); store.set('notif.read', [...s]); document.dispatchEvent(new CustomEvent('itd:notify')); },
    markAllRead() { store.set('notif.read', notifications().map(n => n.id)); document.dispatchEvent(new CustomEvent('itd:notify')); }
  };

  /* ── Module registry + router ─────────────────────────── */
  const modules = {};
  const mounted = new Set();
  const ROUTES = ['dashboard', 'projects', 'schedule', 'budget', 'payments', 'vendors', 'ledger', 'staff', 'reports', 'news', 'settings'];
  function register(route, mod) { modules[route] = mod; }

  function parts() {
    const full = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = full.split('?');
    const [base, ...rest] = path.split('/');
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); query[k] = decodeURIComponent(v || ''); });
    return { base: ROUTES.includes(base) ? base : 'dashboard', param: rest.join('/') || null, query };
  }
  const currentRoute = () => parts().base;
  const param = () => parts().param;
  const query = () => parts().query;

  function go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); }

  function render() {
    const route = currentRoute();
    $$('.page').forEach(p => p.classList.toggle('is-active', p.dataset.page === route));
    $$('.navlink').forEach(l => l.classList.toggle('is-active', l.dataset.route === route));
    const mod = modules[route];
    if (mod) {
      if (!mounted.has(route)) { try { mod.mount?.(); } catch (e) { console.error('[mount]', route, e); } mounted.add(route); }
      else { try { mod.refresh?.(); } catch (e) { console.error('[refresh]', route, e); } }
    }
    const titles = { dashboard: 'Dashboard', projects: 'Projects', schedule: 'Schedule', budget: 'Budget', payments: 'Payments', vendors: 'Vendors', ledger: 'Ledger', staff: 'Staff', reports: 'Reports', news: 'News', settings: 'Settings' };
    document.title = (titles[route] || 'InTandem') + ' · InTandem Desk';
    closeNav();
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent('itd:route', { detail: { route, param: param() } }));
  }

  /* ── Theme ────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const b = $('#themeBtn'); if (b) { $('i', b).className = t === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon'; b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
    store.set('theme', t);
    document.dispatchEvent(new CustomEvent('itd:theme', { detail: { theme: t } }));
  }
  function initTheme() {
    applyTheme(store.get('theme', 'dark'));
    $('#themeBtn')?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  }

  /* ── Sidebar ──────────────────────────────────────────── */
  function openNav() { document.body.classList.add('nav-open'); const s = $('#scrim'); if (s) s.hidden = false; }
  function closeNav() { document.body.classList.remove('nav-open'); const s = $('#scrim'); if (s) s.hidden = true; }
  function initSidebar() {
    $('#navToggle')?.addEventListener('click', () => {
      if (window.innerWidth <= 1024) document.body.classList.contains('nav-open') ? closeNav() : openNav();
      else { const r = !document.body.classList.contains('is-railed'); document.body.classList.toggle('is-railed', r); store.set('railed', r); }
    });
    if (store.get('railed', false) && window.innerWidth > 1024) document.body.classList.add('is-railed');
    $('#scrim')?.addEventListener('click', closeNav);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
  }

  /* ── Toast ────────────────────────────────────────────── */
  function toast(msg, detail = '', kind = 'info') {
    const icons = { info: 'fa-circle-info', good: 'fa-circle-check', warn: 'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.setAttribute('role', 'status');
    el.innerHTML = `<i class="fa-solid ${icons[kind] || icons.info}"></i><p>${esc(msg)}${detail ? `<small>${esc(detail)}</small>` : ''}</p>`;
    $('#toaster').appendChild(el);
    setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove()); }, 3600);
  }

  /* ── Modal ────────────────────────────────────────────── */
  function modal({ title, body, footer }) {
    const m = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalFoot').innerHTML = footer || '<button class="btn btn--ghost" data-close>Close</button>';
    m.classList.add('is-open');
    return m;
  }
  function closeModal() { $('#modal').classList.remove('is-open'); }

  /* ── Global search ────────────────────────────────────── */
  let searchIndex = [];
  function buildSearchIndex() {
    searchIndex = [];
    ROUTES.forEach(r => searchIndex.push({ group: 'Pages', icon: 'fa-arrow-right', label: r[0].toUpperCase() + r.slice(1), sub: 'page', route: '#/' + r }));
    Store.projects().forEach(p => {
      searchIndex.push({ group: 'Projects', icon: 'fa-diagram-project', label: p.name, sub: p.location || p.type || 'project', route: '#/projects/' + p.id });
      if (p.client) searchIndex.push({ group: 'Clients', icon: 'fa-user-tie', label: p.client, sub: p.name, route: '#/projects/' + p.id });
      Store.tasks(p.id).forEach(t => searchIndex.push({ group: 'Tasks', icon: 'fa-clipboard-check', label: t.title, sub: p.name, route: '#/projects/' + p.id + '?tab=tasks' }));
    });
    Store.payments().forEach(p => searchIndex.push({ group: 'Payments', icon: 'fa-indian-rupee-sign', label: (p.invoiceNo || 'Invoice') + ' · ₹' + inr.format(p.amount), sub: p.client || 'payment', route: '#/payments' }));
    Derive.vendorsRich.forEach(v => searchIndex.push({ group: 'Vendors', icon: 'fa-building', label: v.account, sub: v.vendor || 'vendor', route: '#/vendors/' + v.sino }));
    D.budget.forEach(b => searchIndex.push({ group: 'Budget', icon: 'fa-list-check', label: b.description, sub: b.nature || 'budget line', route: '#/budget' }));
    D.schedule.forEach(t => searchIndex.push({ group: 'Schedule', icon: 'fa-diagram-project', label: t.description, sub: (t.areaName || 'task'), route: '#/schedule' }));
    D.ledger.forEach(t => searchIndex.push({ group: 'Ledger', icon: 'fa-receipt', label: (t.towards || t.vendor || 'payment'), sub: shortDate(t.date), route: '#/ledger' }));
  }
  function initSearch() {
    buildSearchIndex();
    const input = $('#searchInput'), panel = $('#searchPanel');
    /* Shells are free to omit the topbar field entirely — the mobile app
       goes straight to the command palette from its search button. */
    if (!input || !panel) return;
    const close = () => { panel.hidden = true; panel.innerHTML = ''; };
    const draw = q => {
      q = q.trim().toLowerCase();
      if (q.length < 2) return close();
      const hits = searchIndex.filter(x => x.label.toLowerCase().includes(q) || (x.sub && x.sub.toLowerCase().includes(q))).slice(0, 24);
      if (!hits.length) { panel.innerHTML = `<p class="search__empty">Nothing matches “${esc(q)}”.</p>`; panel.hidden = false; return; }
      const groups = {};
      hits.forEach(h => (groups[h.group] = groups[h.group] || []).push(h));
      panel.innerHTML = Object.entries(groups).map(([g, items]) =>
        `<div class="search__group">${g}</div>` + items.map(h =>
          `<button class="search__row" data-route="${h.route}"><i class="fa-solid ${h.icon}"></i><span class="t">${esc(h.label)}</span><small>${esc(h.sub || '')}</small></button>`).join('')
      ).join('');
      panel.hidden = false;
    };
    /* The topbar field is now a doorway to the command palette rather than
       a second search implementation. It looks identical; focusing it opens
       the palette, which can act as well as navigate. */
    if (App.Command) {
      input.addEventListener('focus', () => { input.blur(); App.Command.open(input.value); });
      input.addEventListener('click', () => App.Command.open(input.value));
      return;
    }

    input.addEventListener('input', e => draw(e.target.value));
    input.addEventListener('focus', e => { if (e.target.value) draw(e.target.value); });
    panel.addEventListener('click', e => { const r = e.target.closest('.search__row'); if (!r) return; location.hash = r.dataset.route; input.value = ''; close(); });
    document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
      if (e.key === 'Escape') { close(); input.blur(); }
    });
  }

  /* ── Modal / global click delegation ──────────────────── */
  function initGlobal() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal();
    });
  }

  /* ── Boot ─────────────────────────────────────────────── */
  /* ── Notification center ──────────────────────────────── */
  function renderNotif() {
    const list = notifApi.all(), unread = list.filter(n => !n.read).length;
    const dot = $('#notifDot'); if (dot) dot.classList.toggle('is-hidden', unread === 0);
    const badge = $('#notifCount'); if (badge) badge.textContent = unread || '';
    const panel = $('#notifList'); if (!panel) return;
    panel.innerHTML = list.length ? list.slice(0, 30).map(n => `
      <button class="notif ${n.read ? '' : 'is-unread'}" data-id="${n.id}" ${n.route ? `data-route="${n.route}"` : ''}>
        <span class="notif__ico"><i class="fa-solid ${n.icon || 'fa-bell'}"></i></span>
        <span class="notif__body"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<small>${fromNow(n.at)}</small></span>
      </button>`).join('') : `<p class="search__empty">You're all caught up.</p>`;
  }
  function initNotif() {
    const btn = $('#notifBtn'), panel = $('#notifPanel'); if (!btn || !panel) return;
    btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; if (!panel.hidden) renderNotif(); });
    document.addEventListener('click', e => { if (!e.target.closest('.notifwrap')) panel.hidden = true; });
    $('#notifClear')?.addEventListener('click', () => { notifApi.markAllRead(); renderNotif(); });
    panel.addEventListener('click', e => {
      const n = e.target.closest('.notif'); if (!n) return;
      notifApi.markRead(n.dataset.id);
      if (n.dataset.route) { location.hash = n.dataset.route; panel.hidden = true; }
      renderNotif();
    });
    document.addEventListener('itd:notify', renderNotif);
    renderNotif();
  }

  /* start() is called by the auth module once the signed-in account has been
     verified — never automatically. Nothing renders before that. It is
     idempotent so a re-auth (token refresh, account switch) is harmless. */
  let started = false;
  function start() {
    if (started) return; started = true;
    [initTheme, initSidebar, initSearch, initGlobal, initNotif].forEach(fn => { try { fn(); } catch (e) { console.error('[init]', fn.name, e); } });
    window.addEventListener('hashchange', render);
    if (!location.hash) location.replace('#/dashboard');
    try { render(); } catch (e) { console.error('[render]', e); }
    const done = () => $('#boot')?.classList.add('done');
    setTimeout(done, 500); setTimeout(done, 3500);
  }

  return {
    $, $$, D, Derive, start, go, register, param, query, render,
    money, percent, shortDate, monthLabel, monthKey, fromNow, inr, esc, safeUrl,
    empty, emptyChart, emptyRow, pctOf,
    store, toast, modal, closeModal, statusClass, buildSearchIndex,
    /* Read access to the search index, so the command palette can search
       the same records the topbar does without a second implementation. */
    searchIndex: () => searchIndex,
    Store, notif: notifApi, catIcon, SEED_PROJECTS,
    APP, isAdminApp
  };
})();

