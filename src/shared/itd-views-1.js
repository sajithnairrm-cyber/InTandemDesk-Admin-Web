/* Extracted from InTandemDesk_11_2.html by the 2026-07-31 refactor.
   Shared by the admin and staff builds — edit here, never in a built copy. */
/* ============================================================
   InTandem Desk — views (part 1)
   Dashboard · Project · Schedule · Budget
   ============================================================ */
(function (App) {
  'use strict';
  const { $, $$, D, Derive, money, percent, shortDate, esc, statusClass } = App;

  /* Shared: a settlement bar (the signature element) */
  function settleBar(released, total, opts = {}) {
    const pct = total ? Math.min(100, Math.round(released / total * 100)) : 0;
    const bal = total - released;
    return `<div class="settle ${opts.lg ? 'settle--lg' : ''}" style="--pct:${pct}">
      <div class="settle__track"><span class="settle__fill"></span></div>
      ${opts.legend !== false ? `<div class="settle__legend">
        <span>Released <b>${money(released, true)}</b></span>
        <span class="bal">Balance <b>${money(bal, true)}</b></span>
      </div>` : ''}
    </div>`;
  }

  /* Chart registry so we can destroy on theme change / re-render */
  const charts = {};
  function chart(id, cfg) {
    const el = $('#' + id); if (!el || !window.Chart) return;
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }

    /* Nothing to plot: show a message instead of an empty axis grid.
       Covers every chart in the app, so a first-run install never
       renders a bare set of gridlines. The canvas returns on the next
       render, because each view rebuilds its own markup. */
    const sets = (cfg.data && cfg.data.datasets) || [];
    const hasData = sets.some(s => (s.data || []).some(v => v != null && v !== 0));
    if (!hasData) {
      const box = el.closest('.chartbox') || el.parentElement;
      if (box) box.innerHTML = App.emptyChart('No data available');
      return;
    }
    charts[id] = new Chart(el.getContext('2d'), cfg);
  }
  function themeColors() {
    const c = getComputedStyle(document.documentElement);
    const g = n => c.getPropertyValue(n).trim();
    return { accent: g('--accent'), settled: g('--settled'), info: g('--info'), warn: g('--warn'), purple: g('--purple'), line: g('--line'), muted: g('--muted'), ink: g('--ink') };
  }
  const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };


  // Re-render charts of whichever money view is active when the theme flips.
  document.addEventListener('itd:theme', () => {
    const p = App.$('.page.is-active')?.dataset.page;
    if (p === 'dashboard') dashboard.refresh();
    if (p === 'projects' && App.param()) project.refresh();
  });

  /* Office finance (bank + cash) is not in the project workbook, so the
     firm maintains it here; persisted to this browser under itd.office. */
  function officeFinance() { return App.store.get('office', { bank: null, cash: null, updated: null }); }
  function saveOfficeFinance(v) { v.updated = new Date().toISOString(); App.store.set('office', v); }

  /* Portfolio references. Empty on a first run — SEED_PROJECTS carries no
     entries, so the portfolio card does not render. */
  const PROJECTS = App.SEED_PROJECTS;
  const portfolio = PROJECTS.filter(p => !p.live);
  const catIcon = App.catIcon;

  /* ── DASHBOARD (office home) ───────────────────────────── */
  const dashboard = {
    mount() { this.render(); this.bind(); },
    refresh() { this.render(); this.bind(); },
    render() {
      const d = Derive, m = D.meta, fin = officeFinance();
      const bankCard = (id, label, val, icon, cls) => `
        <div class="kpi editcard" data-edit="${id}" role="button" tabindex="0" style="cursor:pointer">
          <div class="kpi__top">
            <span class="kpi__icon ${cls}"><i class="fa-solid ${icon}"></i></span>
            <span class="editcard__pen"><i class="fa-solid fa-pen"></i></span>
          </div>
          <div><div class="kpi__label">${label}</div>
            <div class="kpi__value">${val == null ? '<span class="faint" style="font-family:var(--body);font-size:15px;font-weight:500">Tap to set</span>' : money(val)}</div></div>
          <div class="kpi__foot">${fin.updated ? 'Updated ' + App.fromNow(fin.updated) : 'Firm-maintained figure'}</div>
        </div>`;

      // Firm rollups. The workbook engagement appears only once one
      // exists — on a first run this is empty and every KPI reads zero.
      const projects = m.project ? [{
        id: 'workbook', name: m.project, location: m.location, client: m.client, pm: m.engineer,
        budget: m.balanceBudget, released: m.balanceReleased, outstanding: m.balanceOutstanding,
        tasks: D.schedule.length, done: d.statusCounts['Completed'] || 0
      }] : [];
      const underMgmt = projects.reduce((s, p) => s + p.budget, 0);
      const relAll = projects.reduce((s, p) => s + p.released, 0);
      const outAll = projects.reduce((s, p) => s + p.outstanding, 0);

      $('#page-dashboard').innerHTML = `
        <div class="phead">
          <div><p class="eyebrow">Office overview</p><h1>${esc(m.firm)}</h1>
            <p class="phead__sub">${esc(m.nature)}${m.reportDate ? ' · data as of ' + shortDate(m.reportDate) : ''}</p></div>
          <div class="phead__actions">
            <a class="btn btn--ghost" href="#/ledger"><i class="fa-solid fa-receipt"></i> Ledger</a>
            <a class="btn btn--accent" href="#/projects"><i class="fa-solid fa-diagram-project"></i> Projects</a>
          </div>
        </div>

        ${App.isAdminApp ? `<div class="grid g-2 mb">
          ${bankCard('bank', 'Bank balance', fin.bank, 'fa-building-columns', 'teal')}
          ${bankCard('cash', 'Office / cash balance', fin.cash, 'fa-wallet', '')}
        </div>` : ''}

        <div class="grid g-4 mb">
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon blue"><i class="fa-solid fa-diagram-project"></i></span></div>
            <div><div class="kpi__label">Active projects</div><div class="kpi__value">${projects.length}</div></div><div class="kpi__foot">${portfolio.length ? 'live · ' + portfolio.length + ' in portfolio' : 'workbook engagement'}</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon"><i class="fa-solid fa-sack-dollar"></i></span></div>
            <div><div class="kpi__label">Value under management</div><div class="kpi__value">${money(underMgmt, true)}</div></div><div class="kpi__foot">approved budgets</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon teal"><i class="fa-solid fa-hand-holding-dollar"></i></span></div>
            <div><div class="kpi__label">Released to date</div><div class="kpi__value">${money(relAll, true)}</div></div><div class="kpi__foot">${App.pctOf(relAll, underMgmt)}% utilised</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon coral"><i class="fa-solid fa-scale-unbalanced"></i></span></div>
            <div><div class="kpi__label">Outstanding</div><div class="kpi__value">${money(outAll, true)}</div></div><div class="kpi__foot">payable to vendors</div></div>
        </div>

        <div class="card mb">
          <div class="card__head"><div><h2>Active projects</h2><p class="sub">Open a project for its budget, schedule, vendors and ledger</p></div></div>
          <div class="card__body">
            ${projects.length ? '' : App.empty('No projects have been created yet.', { bare: true, compact: true, icon: 'fa-diagram-project', hint: 'Add a project to see budget, schedule, vendors and ledger in one place.' })}
            ${projects.map(p => `
              <a class="projrow" href="#/projects/${p.id}">
                <div class="projrow__id">
                  <div class="projrow__name">${esc(p.name)}</div>
                  <div class="projrow__meta">${esc(p.location)} · ${esc(p.client)} · PM ${esc(p.pm)}</div>
                </div>
                <div class="projrow__fig"><span class="l">Released</span><span class="v" style="color:var(--settled)">${money(p.released, true)}</span></div>
                <div class="projrow__fig"><span class="l">Outstanding</span><span class="v" style="color:var(--warn)">${money(p.outstanding, true)}</span></div>
                <div class="projrow__settle">${settleBar(p.released, p.budget, { legend: false })}</div>
                <i class="fa-solid fa-arrow-right projrow__go"></i>
              </a>`).join('')}
          </div>
        </div>

        ${portfolio.length ? `<div class="card mb">
          <div class="card__head"><div><h2>Portfolio</h2><p class="sub">Recent delivered work · intandembuild.com</p></div><span class="tag">${portfolio.length} projects</span></div>
          <div class="card__body">
            <div class="grid g-3">${portfolio.map(p => `
              <a class="miniproj" href="#/projects/${p.id}">
                <span class="miniproj__ico"><i class="fa-solid ${catIcon[p.category] || 'fa-building'}"></i></span>
                <div class="miniproj__id"><div class="miniproj__name">${esc(p.name)}</div>
                  <div class="miniproj__meta">${esc(p.type)} · ${esc(p.location)}</div></div>
                <i class="fa-solid fa-arrow-right faint"></i>
              </a>`).join('')}</div>
          </div>
        </div>` : ''}

        <div class="grid g-xl-2 mb">
          <div class="card">
            <div class="card__head"><div><h2>Monthly cashflow</h2><p class="sub">Payments released per month, all projects</p></div></div>
            <div class="card__body"><div class="chartbox"><canvas id="chSpend"></canvas></div></div>
          </div>
          <div class="card">
            <div class="card__head"><div><h2>Recent payments</h2><p class="sub">Latest ledger activity</p></div><a class="btn btn--ghost btn--sm" href="#/ledger">Full ledger</a></div>
            <div class="card__body"><table class="dt" style="min-width:0"><tbody>${d.recent.length ? '' : App.emptyRow(3, 'No payments recorded.')}${d.recent.map(t => `
              <tr><td class="strong">${esc(t.towards || t.vendor || '—')}<div class="faint" style="font-size:11px">${esc(t.vendor || '')} · ${shortDate(t.date)}</div></td>
              <td class="num">${money(t.amount)}</td><td style="width:70px"><span class="tag">${esc(t.mode)}</span></td></tr>`).join('')}</tbody></table></div>
          </div>
        </div>`;

      // cashflow chart
      const t = themeColors();
      Chart.defaults.font.family = "'Inter',sans-serif"; Chart.defaults.color = t.muted;
      const mo = Derive.monthly;
      chart('chSpend', {
        type: 'bar',
        data: { labels: mo.map(x => x.label), datasets: [{ data: mo.map(x => x.total), backgroundColor: rgba(t.accent, .8), borderRadius: 4, maxBarThickness: 26 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => App.money(c.parsed.y, true) } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { grid: { color: t.line }, ticks: { callback: v => '₹' + (v / 1e5).toFixed(0) + 'L' } } } }
      });
    },
    bind() {
      $$('#page-dashboard .editcard').forEach(c => {
        const open = () => this.edit();
        c.addEventListener('click', open);
        c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    },
    edit() {
      const fin = officeFinance();
      App.modal({
        title: 'Update office finances',
        body: `<p class="muted" style="font-size:13px;margin:0 0 1rem">These figures are maintained by the firm and saved to this browser — they aren't part of the project workbook.</p>
          <label class="field"><span>Bank balance (₹)</span><input id="fBank" type="number" inputmode="numeric" value="${fin.bank ?? ''}" placeholder="e.g. 1250000"></label>
          <label class="field"><span>Office / cash balance (₹)</span><input id="fCash" type="number" inputmode="numeric" value="${fin.cash ?? ''}" placeholder="e.g. 45000"></label>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="fSave">Save</button>`
      });
      $('#fSave').addEventListener('click', () => {
        const b = $('#fBank').value.trim(), c = $('#fCash').value.trim();
        saveOfficeFinance({ bank: b === '' ? null : +b, cash: c === '' ? null : +c });
        App.closeModal(); this.render(); this.bind(); App.toast('Balances updated', 'Saved to this browser.', 'good');
      });
    }
  };
  App.register('dashboard', dashboard);

  /* ── PROJECT SCHEDULE ──────────────────────────────────────────────
     Was a standalone top-level module. A schedule belongs to a project,
     not to the application, so this is now a view the Projects module
     mounts inside a project workspace.

     Nothing was thrown away: the area grouping, status chips and work-item
     rows below are the original renderer, re-pointed at project-scoped
     data. Reached at #/projects/<id>?tab=schedule.

     DATA SOURCE, in order:
       1. Store.schedule(projectId)  — per-project, the future
       2. window.DATA.schedule       — the imported workbook, but only
                                       for the project it belongs to, so
                                       existing data survives the move
                                       until it is migrated properly.  */
  const projectSchedule = {
    filter: null,
    pid: null,

    /** Work items belonging to this project, and nothing from any other. */
    items(p) {
      const own = App.Store.schedule(p.id);
      if (own.length) return own;
      const m = D.meta || {};
      if (m.project && p.name === m.project) return D.schedule;   // the workbook engagement
      return [];
    },

    /** Areas present in THIS project's items, with progress. */
    areasFor(items) {
      const codes = [...new Set(items.map(t => t.area).filter(Boolean))];
      const named = {}; D.areas.forEach(a => (named[a.code] = a.name));
      return codes.map(code => {
        const tasks = items.filter(t => t.area === code);
        const done = tasks.filter(t => t.status === 'Completed').length;
        return {
          code, name: named[code] || (tasks[0] && tasks[0].areaName) || '',
          total: tasks.length, done, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0
        };
      });
    },

    /* ── Timeline ────────────────────────────────────────────────────
       Planned dates live on the project record; a revised completion is
       schedule-specific and stored per project. */
    timeline(p, items) {
      const meta = App.Store.schedMeta(p.id);
      const start = meta.start || p.start || '';
      const planned = meta.planned || p.due || '';
      const revised = meta.revised || '';
      const target = revised || planned;

      const done = items.filter(t => t.status === 'Completed').length;
      const pct = items.length ? Math.round(done / items.length * 100)
                               : (typeof p.completion === 'number' ? p.completion : 0);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end = target ? new Date(target) : null;
      const days = end ? Math.round((end - today) / 86400000) : null;

      /* Delayed when the revised date is later than the plan, or the
         target has passed with work outstanding. */
      const slipped = revised && planned && revised > planned;
      const overdue = end && days < 0 && pct < 100;
      const state = pct >= 100 ? { cls: 'completed', t: 'Completed' }
        : overdue ? { cls: 'due', t: 'Overdue' }
        : slipped ? { cls: 'part', t: 'Delayed' }
        : { cls: 'progress', t: 'On track' };

      const cell = (label, value, extra) =>
        `<div><dt>${label}</dt><dd${extra || ''}>${value}</dd></div>`;

      return `<div class="card mb">
        <div class="card__head">
          <div><h2>Timeline</h2><p class="sub">Planned against actual</p></div>
          <span class="pill ${state.cls}">${state.t}</span>
        </div>
        <div class="card__body">
          <dl class="deflist">
            ${cell('Project start', start ? shortDate(start) : '<span class="faint">Not set</span>')}
            ${cell('Planned completion', planned ? shortDate(planned) : '<span class="faint">Not set</span>')}
            ${cell('Revised completion', revised
              ? `<span style="color:var(--warn)">${shortDate(revised)}</span>`
              : '<span class="faint">None</span>')}
            ${cell('Days remaining', days == null ? '<span class="faint">—</span>'
              : days < 0 ? `<span style="color:var(--warn)">${Math.abs(days)} days overdue</span>`
              : `${days} days`)}
            ${cell('Progress', `${pct}%`)}
          </dl>
          <div style="margin-top:.9rem">${settleBar(pct, 100, { legend: false })}</div>
          <button class="btn btn--ghost btn--sm" id="schedDates" style="margin-top:1rem">
            <i class="fa-solid fa-calendar-days"></i> Edit dates
          </button>
        </div>
      </div>`;
    },

    /** Render into the project workspace tab.

        The host is re-resolved every time. Handlers created when the tab
        opened close over the element that existed then, and anything that
        re-renders the workspace in between — a route change, an edit
        elsewhere — replaces it. Painting into that detached node succeeds
        silently and shows the user nothing, which is the worst kind of
        failure: the data saved, the screen disagreed. */
    render(p, host) {
      if (!host || !host.isConnected) host = document.getElementById('pTabBody') || host;
      if (!host) return;
      this.pid = p.id;
      this.filter = null;
      /* Materialise on first open: the workbook project reads through to
         window.DATA until then, and rows need stable ids to be editable.
         Idempotent — a second open writes nothing. */
      const items = this.ensureOwn(p);

      if (!items.length) {
        host.innerHTML = this.timeline(p, items) + App.empty('No work schedule for this project.', {
          icon: 'fa-list-check',
          hint: 'Break the project into work items — area by area — each with a vendor, dates and a status.',
          action: '<button class="btn btn--accent btn--sm" id="wiAdd"><i class="fa-solid fa-plus"></i> Add work item</button>'
        });
        this.bindDates(p, host);
        this.bindItems(p, host);
        return;
      }

      const counts = {};
      items.forEach(t => { const k = t.status || 'No status'; counts[k] = (counts[k] || 0) + 1; });
      const order = ['Completed', 'Work in progress', 'Final work', 'Installation', 'Material to order', 'Work to start', 'Vendor confirmation', 'Factory', 'No status'];
      const chips = order.filter(s => counts[s]).map(s =>
        `<button class="chip" data-status="${esc(s)}"><span class="pill ${statusClass(s === 'No status' ? null : s)}" style="padding:0;background:none"></span>${esc(s)} <span class="chip__n">${counts[s]}</span></button>`).join('');

      host.innerHTML = this.timeline(p, items) + `
        <div class="fbbar">
          <div class="chipbar fbbar__grow" style="margin:0"><button class="chip is-active" data-status="">All <span class="chip__n">${items.length}</span></button>${chips}</div>
          <div class="fbbar__end">
            <button class="btn btn--accent btn--sm" id="wiAdd"><i class="fa-solid fa-plus"></i> Add work item</button>
          </div>
        </div>
        <div id="schedAreas"></div>`;

      $('.chipbar', host).addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        $$('.chipbar .chip', host).forEach(x => x.classList.toggle('is-active', x === c));
        this.filter = c.dataset.status || null;
        this.renderAreas(p, host);
      });
      host.addEventListener('click', e => {
        const h = e.target.closest('.area__head'); if (h) h.parentElement.classList.toggle('is-open');
      });

      this.bindDates(p, host);
      this.bindItems(p, host);
      this.renderAreas(p, host);
    },

    /* Add button, plus click-to-edit on any work item. Delegated from the
       host so it survives renderAreas() repainting the list. */
    bindItems(p, host) {
      const add = $('#wiAdd', host);
      if (add) add.addEventListener('click', () => this.itemForm(p, null, host));

      if (host.dataset.wiBound) return;      // one delegated listener, not one per repaint
      host.dataset.wiBound = '1';
      host.addEventListener('click', (e) => {
        const row = e.target.closest('.task[data-wi]');
        if (!row) return;
        const item = this.ensureOwn(p).find(x => x.id === row.dataset.wi);
        if (item) this.itemForm(p, item, host);
      });
    },

    bindDates(p, host) {
      const b = $('#schedDates', host);
      if (b) b.addEventListener('click', () => this.editDates(p, host));
    },

    editDates(p, host) {
      const meta = App.Store.schedMeta(p.id);
      const F = (id, label, val, hint) =>
        `<label class="field"><span>${label}</span><input id="${id}" type="date" value="${esc(val || '')}">
         ${hint ? `<em class="faint" style="font-size:11.5px;font-style:normal">${hint}</em>` : ''}</label>`;
      App.modal({
        title: 'Schedule dates',
        body: `<div class="formgrid">
          ${F('sdStart', 'Project start', meta.start || p.start)}
          ${F('sdPlanned', 'Planned completion', meta.planned || p.due)}
          ${F('sdRevised', 'Revised completion', meta.revised, 'Leave empty while the project is on plan. Setting a later date marks it delayed.')}
        </div>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="sdSave"><i class="fa-solid fa-check"></i> Save</button>`
      });
      $('#sdSave').addEventListener('click', () => {
        App.Store.setSchedMeta(p.id, {
          start: $('#sdStart').value || '',
          planned: $('#sdPlanned').value || '',
          revised: $('#sdRevised').value || ''
        });
        App.closeModal();
        App.toast('Schedule updated', p.name, 'good');
        this.render(p, host);
      });
    },

    renderAreas(p, host) {
      const wrap = $('#schedAreas', host); if (!wrap) return;
      const items = this.ensureOwn(p);
      wrap.innerHTML = this.areasFor(items).map(a => {
        let tasks = items.filter(t => t.area === a.code);
        if (this.filter) tasks = tasks.filter(t => (t.status || 'No status') === this.filter);
        if (!tasks.length) return '';
        return `<div class="area is-open">
          <div class="area__head">
            <span class="area__code">${esc(a.code)}</span>
            <span class="area__name">${esc(a.name || '')}</span>
            <span class="area__mini">${this._mini(a.pct)}</span>
            <span class="area__count">${a.done}/${a.total}</span>
            <i class="fa-solid fa-chevron-down area__toggle"></i>
          </div>
          <div class="area__body">${tasks.map(t => this._task(t)).join('')}</div>
        </div>`;
      }).join('') || `<div class="card"><div class="dt__empty">No work items match this status.</div></div>`;
    },

    /* ── Work-item management ───────────────────────────────────────
       Adding, editing and removing schedule items for THIS project. */
    WI_STATUS: ['Work to start', 'Material to order', 'Vendor confirmation', 'Factory',
                'Work in progress', 'Installation', 'Final work', 'Completed'],
    WI_NATURE: ['Supply & Install', 'Supply only', 'Labour only', 'Turnkey'],
    WI_APPROVAL: ['Pending', 'Issued', 'Approved', 'Awaiting', 'Reviewed'],

    /** Stable id for edit/delete. Older imported rows have none. */
    _wid() { return 'wi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); },

    /* The workbook project reads through to window.DATA until it is
       edited. Materialise that into per-project storage on the first
       write, or adding one item would silently replace the imported set. */
    ensureOwn(p) {
      let own = App.Store.schedule(p.id);
      if (!own.length) {
        const seed = this.items(p);
        own = seed.map(x => Object.assign({}, x, { id: x.id || this._wid() }));
        if (own.length) App.Store.setSchedule(p.id, own);
      }
      let dirty = false;
      own.forEach(x => { if (!x.id) { x.id = this._wid(); dirty = true; } });
      if (dirty) App.Store.setSchedule(p.id, own);
      return own;
    },

    /** Areas already used by this project, plus any from the workbook. */
    areaOptions(p) {
      const seen = new Map();
      (D.areas || []).forEach(a => seen.set(a.code, a.name));
      this.items(p).forEach(t => { if (t.area && !seen.has(t.area)) seen.set(t.area, t.areaName || ''); });
      return [...seen.entries()].map(([code, name]) => ({ code, name }));
    },

    /** Next free roman numeral, so a new area gets a sensible code. */
    nextAreaCode(p) {
      const R = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV',
                 'XVI','XVII','XVIII','XIX','XX'];
      const used = new Set(this.areaOptions(p).map(a => a.code));
      return R.find(c => !used.has(c)) || ('A' + (used.size + 1));
    },

    itemForm(p, item, host) {
      const editing = !!item;
      const rec = item || {};
      const areas = this.areaOptions(p);
      const err = (id, m) => {
        const e = $('#' + id + 'Err'); if (e) e.textContent = m || '';
        const f = $('#' + id); if (f) f.classList.toggle('is-invalid', !!m);
        return !m;
      };

      App.modal({
        title: editing ? 'Edit work item' : 'Add work item',
        body: `<div class="formgrid">
          <label class="field"><span>Work description *</span>
            <input id="wiDesc" value="${esc(rec.description || '')}" placeholder="e.g. Internal plastering">
            <em class="field__err" id="wiDescErr"></em></label>

          <div class="formrow">
            <label class="field"><span>Area</span>
              <select id="wiArea">
                ${areas.map(a => `<option value="${esc(a.code)}" ${rec.area === a.code ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name || 'Unnamed')}</option>`).join('')}
                <option value="__new" ${!rec.area && !areas.length ? 'selected' : ''}>+ New area…</option>
              </select></label>
            <label class="field" id="wiNewAreaWrap" hidden><span>New area name</span>
              <input id="wiNewArea" placeholder="e.g. Terrace & Utility"></label>
            <label class="field"><span>Nature of work</span>
              <select id="wiNature">${this.WI_NATURE.map(n => `<option ${rec.nature === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>

          <label class="field"><span>Vendor / contractor</span>
            <input id="wiVendor" value="${esc(rec.vendor || '')}" placeholder="Who is doing this work" list="wiVendorList">
            <datalist id="wiVendorList">${(D.vendors || []).map(v => `<option value="${esc(v.vendor)}"></option>`).join('')}</datalist></label>

          <div class="formrow">
            <label class="field"><span>Planned start</span><input id="wiStart" type="date" value="${esc(rec.start || '')}"></label>
            <label class="field"><span>Planned finish</span><input id="wiEnd" type="date" value="${esc(rec.end || '')}">
              <em class="field__err" id="wiEndErr"></em></label>
          </div>

          <label class="field"><span>Status</span>
            <select id="wiStatus">${this.WI_STATUS.map(s => `<option ${(rec.status || 'Work to start') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>

          <div class="formrow">
            <label class="field"><span>Architect approval</span>
              <select id="wiArch">${['—'].concat(this.WI_APPROVAL).map(s => `<option ${(rec.archStatus || '—') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="field"><span>Client approval</span>
              <select id="wiClient">${['—'].concat(this.WI_APPROVAL).map(s => `<option ${(rec.clientStatus || '—') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          </div>
        </div>`,
        footer: `${editing ? '<button class="btn btn--ghost" id="wiDel" style="color:var(--warn);margin-right:auto"><i class="fa-solid fa-trash"></i> Delete</button>' : ''}
                 <button class="btn btn--ghost" data-close>Cancel</button>
                 <button class="btn btn--accent" id="wiSave"><i class="fa-solid fa-check"></i> ${editing ? 'Save changes' : 'Add work item'}</button>`
      });

      /* Reveal the new-area field only when it is actually needed. */
      const areaSel = $('#wiArea'), newWrap = $('#wiNewAreaWrap');
      const syncArea = () => { newWrap.hidden = areaSel.value !== '__new'; };
      areaSel.addEventListener('change', syncArea); syncArea();

      $('#wiSave').addEventListener('click', () => {
        const desc = $('#wiDesc').value.trim();
        let ok = err('wiDesc', desc ? '' : 'Describe the work');
        const start = $('#wiStart').value, end = $('#wiEnd').value;
        if (start && end) ok = err('wiEnd', end >= start ? '' : 'Finish must be on or after start') && ok;
        if (!ok) return;

        let area = areaSel.value, areaName = '';
        if (area === '__new') {
          areaName = $('#wiNewArea').value.trim() || 'New area';
          area = this.nextAreaCode(p);
        } else {
          areaName = (areas.find(a => a.code === area) || {}).name || '';
        }

        const status = $('#wiStatus').value;
        const data = {
          description: desc, area, areaName,
          nature: $('#wiNature').value, vendor: $('#wiVendor').value.trim(),
          start, end, status, statusRaw: status,
          archStatus: $('#wiArch').value === '—' ? '' : $('#wiArch').value,
          clientStatus: $('#wiClient').value === '—' ? '' : $('#wiClient').value
        };

        const all = this.ensureOwn(p);
        if (editing) {
          const i = all.findIndex(x => x.id === rec.id);
          if (i >= 0) all[i] = Object.assign({}, all[i], data);
        } else {
          all.push(Object.assign({ id: this._wid(), sino: all.length + 1 }, data));
        }
        App.Store.setSchedule(p.id, all);
        App.closeModal();
        App.toast(editing ? 'Work item updated' : 'Work item added', desc, 'good');
        if (App.buildSearchIndex) App.buildSearchIndex();
        this.render(p, host);
      });

      const del = $('#wiDel');
      if (del) del.addEventListener('click', () => {
        const all = this.ensureOwn(p).filter(x => x.id !== rec.id);
        App.Store.setSchedule(p.id, all);
        App.closeModal();
        App.toast('Work item removed', rec.description || '', 'warn');
        if (App.buildSearchIndex) App.buildSearchIndex();
        this.render(p, host);
      });
    },

    _mini(pct) {
      return `<div class="settle" style="--pct:${pct}"><div class="settle__track" style="height:6px"><span class="settle__fill"></span></div></div>`;
    },

    _task(t) {
      const cls = statusClass(t.status);
      const ico = cls === 'completed' ? 'done' : (cls === 'progress' || cls === 'installation' || cls === 'final') ? 'wip' : 'pend';
      const icon = cls === 'completed' ? 'fa-circle-check' : ico === 'wip' ? 'fa-circle-half-stroke' : 'fa-circle';
      return `<div class="task"${t.id ? ` data-wi="${esc(t.id)}" style="cursor:pointer" title="Edit this work item"` : ''}>
        <i class="fa-solid ${icon} task__ico ${ico}"></i>
        <div class="task__body">
          <div class="task__desc">${esc(t.description)}</div>
          <div class="task__meta">
            ${t.status ? `<span class="pill ${cls}">${esc(t.status)}</span>` : '<span class="pill none">No status</span>'}
            ${t.nature ? `<span class="tag">${esc(t.nature)}</span>` : ''}
            ${t.vendor ? `<span class="faint" style="font-size:11px"><i class="fa-solid fa-user"></i> ${esc(t.vendor)}</span>` : ''}
            ${t.end ? `<span class="faint" style="font-size:11px"><i class="fa-regular fa-calendar"></i> ${shortDate(t.end)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }
  };

  /* Exposed for the Projects module. Not registered as a route — that is
     the whole point of the move. */
  App.ProjectSchedule = projectSchedule;

  /* ── BUDGET ───────────────────────────────────────────── */
  const budget = {
    state: { q: '', nature: '', type: '', section: '' },
    sortKey: 'sino', sortDir: 1,
    mount() {
      if (!D.budget.length) {
        $('#page-budget').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Budget sheet</p><h1>Project budget</h1>
            <p class="phead__sub">No budget lines</p></div></div>
          ${App.empty('No budgets created.', { icon: 'fa-sack-dollar', hint: 'Budget line items, quotations and released amounts will appear here once a project budget is added.' })}`;
        return;
      }
      const natures = [...new Set(D.budget.map(b => b.nature).filter(Boolean))].sort();
      const types = [...new Set(D.budget.map(b => b.type).filter(Boolean))].sort();
      $('#page-budget').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Budget sheet</p><h1>Project budget</h1>
          <p class="phead__sub">${D.budget.length} line items · header budget ${money(D.meta.budgetSheetTotal, true)} · data as of ${shortDate(D.meta.reportDate)}</p></div></div>
        <div class="grid g-3 mb">
          <div class="kpi"><div class="kpi__label">GST-inclusive quotes</div><div class="kpi__value">${money(Derive.budgetGst, true)}</div><div class="kpi__foot">${D.budget.filter(b => b.quoteGst).length} priced lines</div></div>
          <div class="kpi"><div class="kpi__label">Natural stone lines</div><div class="kpi__value">${D.budget.filter(b => b.section === 'NATURAL STONE').length}</div><div class="kpi__foot">Summit Inc & others</div></div>
          <div class="kpi"><div class="kpi__label">Header project budget</div><div class="kpi__value">${money(D.meta.budgetSheetTotal, true)}</div><div class="kpi__foot">As printed on the sheet</div></div>
        </div>
        <div class="chipbar">
          <div class="search__field" style="max-width:260px"><i class="fa-solid fa-magnifying-glass"></i><input id="bq" placeholder="Search description…"></div>
          <select class="chip" id="bnature"><option value="">All nature of work</option>${natures.map(n => `<option>${esc(n)}</option>`).join('')}</select>
          <select class="chip" id="btype"><option value="">All types</option>${types.map(n => `<option>${esc(n)}</option>`).join('')}</select>
          <select class="chip" id="bsection"><option value="">All sections</option><option>MAIN</option><option>NATURAL STONE</option></select>
        </div>
        <div class="tablewrap"><table class="dt" id="btable"></table></div>`;
      const rerender = () => this.renderTable();
      $('#bq').addEventListener('input', e => { this.state.q = e.target.value.toLowerCase(); rerender(); });
      $('#bnature').addEventListener('change', e => { this.state.nature = e.target.value; rerender(); });
      $('#btype').addEventListener('change', e => { this.state.type = e.target.value; rerender(); });
      $('#bsection').addEventListener('change', e => { this.state.section = e.target.value; rerender(); });
      this.renderTable();
    },
    rows() {
      const s = this.state;
      let r = D.budget.filter(b =>
        (!s.q || b.description.toLowerCase().includes(s.q) || (b.vendor || '').toLowerCase().includes(s.q)) &&
        (!s.nature || b.nature === s.nature) && (!s.type || b.type === s.type) && (!s.section || b.section === s.section));
      const k = this.sortKey, dir = this.sortDir;
      r.sort((a, b) => { let x = a[k], y = b[k]; if (x == null) x = -Infinity; if (y == null) y = -Infinity; if (typeof x === 'string') return x.localeCompare(y) * dir; return (x - y) * dir; });
      return r;
    },
    renderTable() {
      const rows = this.rows();
      const gst = rows.reduce((s, b) => s + (b.quoteGst || 0), 0);
      const noGst = rows.reduce((s, b) => s + (b.quoteNoGst || 0), 0);
      const th = (k, l, num) => `<th class="${num ? 'num' : ''}" data-k="${k}">${l}${this.sortKey === k ? `<span class="caret">${this.sortDir > 0 ? '▲' : '▼'}</span>` : ''}</th>`;
      $('#btable').innerHTML = `
        <thead><tr>${th('sino', '#')}${th('description', 'Description')}${th('nature', 'Nature')}${th('vendor', 'Vendor')}<th class="no-sort">Type</th>${th('quoteNoGst', 'Quote (no GST)', 1)}${th('quoteGst', 'Quote (GST)', 1)}</tr></thead>
        <tbody>${rows.length ? rows.map(b => `
          <tr>
            <td class="num faint">${b.sino}</td>
            <td class="strong">${esc(b.description)}${b.section === 'NATURAL STONE' ? ' <span class="tag">stone</span>' : ''}</td>
            <td>${b.nature ? esc(b.nature) : '<span class="faint">—</span>'}</td>
            <td>${b.vendor ? esc(b.vendor) : '<span class="faint">—</span>'}</td>
            <td>${b.type ? `<span class="tag">${esc(b.type)}</span>` : '<span class="faint">—</span>'}</td>
            <td class="num">${b.quoteNoGst != null ? money(b.quoteNoGst) : '<span class="faint">—</span>'}</td>
            <td class="num">${b.quoteGst != null ? money(b.quoteGst) : '<span class="faint">—</span>'}</td>
          </tr>`).join('') : `<tr><td colspan="7" class="dt__empty">No lines match these filters.</td></tr>`}
        </tbody>
        <tfoot><tr><td colspan="5">Showing ${rows.length} of ${D.budget.length} lines</td><td class="num">${money(noGst)}</td><td class="num">${money(gst)}</td></tr></tfoot>`;
      $$('#btable thead th[data-k]').forEach(th => th.addEventListener('click', () => {
        const k = th.dataset.k; if (this.sortKey === k) this.sortDir *= -1; else { this.sortKey = k; this.sortDir = 1; }
        this.renderTable();
      }));
    },
    refresh() { }
  };
  App.register('budget', budget);

  // expose settleBar + chart helpers to part 2
  App._settleBar = settleBar; App._chart = chart; App._themeColors = themeColors; App._rgba = rgba;
})(window.App);

