/* ============================================================
   InTandem Desk — command palette

   ⌘K / Ctrl-K from anywhere. Search and act in one surface.

   WHY THIS EXISTS
   ---------------
   The topbar search could only navigate. Doing anything — creating a
   project, recording a payment — meant navigating to the right page
   first and hunting for a button. This collapses that to three
   keystrokes from any screen.

   EXTENDING IT
   ------------
   Modules register their own actions; the palette knows nothing about
   them. A new module adds its verbs in one call and they appear
   immediately, including in search:

     App.Command.register({
       id:    'client.new',
       label: 'New client',
       group: 'Create',
       icon:  'fa-user-tie',
       hint:  'Add a client record',
       when:  () => App.Roles.isOwner(),   // optional visibility test
       run:   () => clients.openNew()
     });

   Actions live next to the module that owns them, not in a central
   list that every feature has to remember to update.
   ============================================================ */

(function (App) {
  'use strict';

  const { $, $$, esc } = App;

  const ACTIONS = [];
  let el = null;         // palette root
  let rows = [];         // current result set
  let cursor = 0;
  let open = false;

  /* ── Registry ───────────────────────────────────────────── */
  function register(a) {
    if (!a || !a.id || typeof a.run !== 'function') return;
    const i = ACTIONS.findIndex(x => x.id === a.id);
    if (i >= 0) ACTIONS[i] = a; else ACTIONS.push(a);
  }

  /** Actions the current user can actually perform right now. */
  const visibleActions = () => ACTIONS.filter(a => {
    try { return a.when ? !!a.when() : true; } catch { return false; }
  });

  /* ── Matching ───────────────────────────────────────────── */
  /* Subsequence match, so "npr" finds "New project". Cheap, and it is
     what makes a palette feel fast to a keyboard user. */
  function fuzzy(needle, hay) {
    if (!needle) return 0;
    const n = needle.toLowerCase(), h = String(hay || '').toLowerCase();
    if (!h) return -1;
    const direct = h.indexOf(n);
    if (direct === 0) return 100;                 // prefix — best
    if (direct > 0) return 70 - Math.min(direct, 20);
    let i = 0, score = 40, lastHit = -1;
    for (let c = 0; c < h.length && i < n.length; c++) {
      if (h[c] === n[i]) {
        if (lastHit >= 0 && c === lastHit + 1) score += 2;   // adjacency bonus
        lastHit = c; i++;
      }
    }
    return i === n.length ? score : -1;
  }

  function results(q) {
    const query = q.trim();

    // No query: the quick-action menu. This is the "one-click actions"
    // surface — reachable from every screen, not just the dashboard.
    if (!query) {
      return visibleActions()
        .filter(a => a.primary !== false)
        .slice(0, 12)
        .map(a => ({ kind: 'action', a, group: a.group || 'Actions' }));
    }

    const out = [];
    for (const a of visibleActions()) {
      const s = Math.max(fuzzy(query, a.label), fuzzy(query, a.keywords || '') - 15);
      if (s >= 0) out.push({ kind: 'action', a, group: a.group || 'Actions', score: s + 25 });
    }
    for (const x of (App.searchIndex ? App.searchIndex() : [])) {
      const s = Math.max(fuzzy(query, x.label), fuzzy(query, x.sub) - 10);
      if (s >= 0) out.push({ kind: 'link', x, group: x.group, score: s });
    }
    return out.sort((p, q2) => q2.score - p.score).slice(0, 30);
  }

  /* ── Rendering ──────────────────────────────────────────── */
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'cmdk';
    el.id = 'cmdk';
    el.innerHTML = `
      <div class="cmdk__bg" data-cmdk-close></div>
      <div class="cmdk__panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="cmdk__head">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="cmdkInput" type="text" autocomplete="off" spellcheck="false"
                 placeholder="Search or run a command…" aria-label="Search or run a command">
          <kbd>esc</kbd>
        </div>
        <div class="cmdk__list" id="cmdkList"></div>
        <div class="cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cmdk-close]')) return close();
      const row = e.target.closest('.cmdk__row');
      if (row) choose(Number(row.dataset.i));
    });
    $('#cmdkInput', el).addEventListener('input', (e) => draw(e.target.value));
    $('#cmdkInput', el).addEventListener('keydown', onKey);
    return el;
  }

  function draw(q) {
    rows = results(q);
    cursor = 0;
    const list = $('#cmdkList', el);

    if (!rows.length) {
      list.innerHTML = `<p class="cmdk__empty">Nothing matches “${esc(q)}”.</p>`;
      return;
    }

    let html = '', lastGroup = null;
    rows.forEach((r, i) => {
      if (r.group !== lastGroup) { html += `<div class="cmdk__group">${esc(r.group)}</div>`; lastGroup = r.group; }
      const icon = r.kind === 'action' ? (r.a.icon || 'fa-bolt') : (r.x.icon || 'fa-arrow-right');
      const label = r.kind === 'action' ? r.a.label : r.x.label;
      const hint = r.kind === 'action' ? (r.a.hint || '') : (r.x.sub || '');
      html += `<button class="cmdk__row${i === 0 ? ' is-active' : ''}" data-i="${i}" type="button">
        <i class="fa-solid ${esc(icon)}"></i>
        <span class="cmdk__t">${esc(label)}</span>
        ${hint ? `<span class="cmdk__h">${esc(hint)}</span>` : ''}
        ${r.kind === 'action' ? '<kbd class="cmdk__run">run</kbd>' : ''}
      </button>`;
    });
    list.innerHTML = html;
    list.scrollTop = 0;
  }

  function move(delta) {
    if (!rows.length) return;
    cursor = (cursor + delta + rows.length) % rows.length;
    const all = $$('.cmdk__row', el);
    all.forEach((r, i) => r.classList.toggle('is-active', i === cursor));
    const active = all[cursor];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const r = rows[i != null ? i : cursor];
    if (!r) return;
    close();
    // Let the palette finish closing before the action paints, so a
    // modal opened by an action isn't fighting the overlay teardown.
    setTimeout(() => {
      if (r.kind === 'link') { location.hash = r.x.route; return; }
      try { r.a.run(); } catch (err) { console.error('[command]', r.a.id, err); App.toast('Could not run', r.a.label, 'warn'); }
    }, 10);
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  /* ── Open / close ───────────────────────────────────────── */
  function show(prefill) {
    ensure();
    if (App.buildSearchIndex) App.buildSearchIndex();   // pick up anything created since last open
    open = true;
    el.classList.add('is-open');
    const input = $('#cmdkInput', el);
    input.value = prefill || '';
    draw(input.value);
    setTimeout(() => input.focus(), 20);
  }

  function close() {
    if (!el) return;
    open = false;
    el.classList.remove('is-open');
  }

  /* ── Global shortcut ────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : show(); return; }
    if (e.key === '/' && !typing && !open) { e.preventDefault(); show(); }
  });

  App.Command = { register, open: show, close, get isOpen() { return open; }, actions: ACTIONS };

  /* ── Built-in actions ───────────────────────────────────────
     Navigation for every route, plus app-level commands. Module
     verbs (New project, Record payment…) are registered by the
     modules that own them. */
  const NAV = [
    ['dashboard', 'fa-gauge-high', 'Office overview'],
    ['projects', 'fa-diagram-project', 'All projects'],
    /* Budget is no longer a top-level route — it is a tab inside a
       project, like Schedule. Removed from the palette so it cannot
       navigate somewhere that redirects. */
    ['payments', 'fa-file-invoice-dollar', 'Client payments'],
    ['vendors', 'fa-building', 'Vendor accounts'],
    ['ledger', 'fa-receipt', 'Payment ledger'],
    ['staff', 'fa-users', 'Team and access'],
    ['reports', 'fa-file-lines', 'Client report'],
    ['news', 'fa-newspaper', 'Industry feed'],
    ['settings', 'fa-gear', 'Configuration']
  ];
  NAV.forEach(([route, icon, hint]) => register({
    id: 'go.' + route,
    label: 'Go to ' + route[0].toUpperCase() + route.slice(1),
    keywords: route + ' navigate open',
    group: 'Navigate',
    icon, hint,
    primary: false,                                   // keep the empty state short
    when: () => route !== 'settings' || !App.Roles || App.Roles.can.accessSettings(),
    run: () => { location.hash = '#/' + route; }
  }));

  register({
    id: 'app.theme',
    label: 'Toggle theme',
    keywords: 'dark light appearance',
    group: 'App', icon: 'fa-circle-half-stroke',
    hint: 'Switch dark / light',
    primary: false,
    run: () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      App.store.set('theme', next);
      const b = $('#themeBtn'); if (b) $('i', b).className = next === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
      document.dispatchEvent(new CustomEvent('itd:theme', { detail: { theme: next } }));
    }
  });

})(window.App);
