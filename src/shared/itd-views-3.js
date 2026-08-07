/* Extracted from InTandemDesk_11_2.html by the 2026-07-31 refactor.
   Shared by the admin and staff builds — edit here, never in a built copy. */
/* ============================================================
   InTandem Desk — views (part 3)
   Projects management · Payments · News
   Built on App.Store (persisted) and the existing design system.
   ============================================================ */
(function (App) {
  'use strict';
  const { $, $$, D, money, percent, shortDate, fromNow, esc, Store, catIcon } = App;
  const settleBar = App._settleBar, chart = App._chart, themeColors = App._themeColors, rgba = App._rgba;

  /* ── shared helpers ───────────────────────────────────── */
  const STATUS = {
    'Planning': 'st-planning', 'In Progress': 'st-progress', 'Completed': 'st-completed',
    'On Hold': 'st-hold', 'Cancelled': 'st-cancelled'
  };
  const statusPill = s => `<span class="pill ${STATUS[s] || 'st-planning'}">${esc(s)}</span>`;
  const PRIO = { High: 'prio-high', Medium: 'prio-med', Low: 'prio-low' };
  const prioPill = p => `<span class="pill ${PRIO[p] || 'prio-med'}">${esc(p || 'Medium')}</span>`;
  const avatar = (id, lg) => { const s = App.staffById(id); if (!s) return ''; return `<span class="avatar ${lg ? 'lg' : 'xs'}" style="--h:${s.h}" title="${esc(s.name)}">${esc(s.name.slice(0, 2).toUpperCase())}</span>`; };
  const remaining = p => (p.budget == null ? null : p.budget - (p.spent || 0));
  const genId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function field(id, label, val = '', opts = {}) {
    const t = opts.type || 'text';
    if (t === 'textarea') return `<label class="field"><span>${label}${opts.req ? ' *' : ''}</span><textarea id="${id}" rows="${opts.rows || 3}" placeholder="${opts.ph || ''}">${esc(val)}</textarea><em class="field__err" id="${id}Err"></em></label>`;
    if (t === 'select') return `<label class="field"><span>${label}${opts.req ? ' *' : ''}</span><select id="${id}">${opts.options.map(o => `<option value="${esc(o.v ?? o)}" ${(o.v ?? o) === val ? 'selected' : ''}>${esc(o.l ?? o)}</option>`).join('')}</select><em class="field__err" id="${id}Err"></em></label>`;
    return `<label class="field"><span>${label}${opts.req ? ' *' : ''}</span><input id="${id}" type="${t}" value="${esc(val)}" placeholder="${opts.ph || ''}" ${opts.attr || ''}><em class="field__err" id="${id}Err"></em></label>`;
  }
  const setErr = (id, msg) => { const e = $('#' + id + 'Err'); if (e) e.textContent = msg || ''; const f = $('#' + id); if (f) f.classList.toggle('is-invalid', !!msg); return !msg; };

  /* ══════════════════════════════════════════════════════
     PROJECTS  (list · detail · tasks/kanban · new-project)
     ══════════════════════════════════════════════════════ */
  const project = {
    state: { q: '', status: '', category: '', sort: 'updated', page: 1, per: 6 },
    mount() { this.route(); },
    refresh() { this.route(); },
    route() {
      const id = App.param();
      if (id) { const p = Store.project(id); if (p) return this.detail(p); }
      this.list();
    },

    /* ---------- LIST ---------- */
    list() {
      const all = Store.projects();
      const counts = {
        total: all.length,
        progress: all.filter(p => p.status === 'In Progress').length,
        completed: all.filter(p => p.status === 'Completed').length,
        value: all.reduce((s, p) => s + (p.budget || 0), 0)
      };
      const cats = [...new Set(all.map(p => p.category).filter(Boolean))].sort();
      $('#page-projects').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Project management</p><h1>Projects</h1>
          <p class="phead__sub">${counts.total} projects · ${counts.progress} in progress · ${counts.completed} delivered</p></div>
          <div class="phead__actions"><button class="btn btn--accent" id="newProjBtn"><i class="fa-solid fa-plus"></i> New Project</button></div>
        </div>
        <div class="grid g-4 mb">
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon blue"><i class="fa-solid fa-diagram-project"></i></span></div><div><div class="kpi__label">Total projects</div><div class="kpi__value">${counts.total}</div></div><div class="kpi__foot">${counts.total === 1 ? 'project' : 'projects'} on file</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon"><i class="fa-solid fa-person-digging"></i></span></div><div><div class="kpi__label">In progress</div><div class="kpi__value">${counts.progress}</div></div><div class="kpi__foot">active engagements</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon teal"><i class="fa-solid fa-circle-check"></i></span></div><div><div class="kpi__label">Completed</div><div class="kpi__value">${counts.completed}</div></div><div class="kpi__foot">delivered</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon"><i class="fa-solid fa-sack-dollar"></i></span></div><div><div class="kpi__label">Value under mgmt</div><div class="kpi__value">${money(counts.value, true)}</div></div><div class="kpi__foot">tracked budgets</div></div>
        </div>
        <div class="toolbar">
          <div class="search__field" style="max-width:260px"><i class="fa-solid fa-magnifying-glass"></i><input id="pq" placeholder="Search projects, clients…" value="${esc(this.state.q)}"></div>
          <select class="chip" id="pStatus"><option value="">All statuses</option>${Object.keys(STATUS).map(s => `<option ${this.state.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <select class="chip" id="pCat"><option value="">All categories</option>${cats.map(c => `<option ${this.state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select class="chip" id="pSort">
            <option value="updated" ${this.state.sort === 'updated' ? 'selected' : ''}>Recently updated</option>
            <option value="name" ${this.state.sort === 'name' ? 'selected' : ''}>Name A–Z</option>
            <option value="completion" ${this.state.sort === 'completion' ? 'selected' : ''}>Completion</option>
            <option value="budget" ${this.state.sort === 'budget' ? 'selected' : ''}>Budget</option>
          </select>
        </div>
        <div id="projGrid"></div>
        <div id="projPager" class="pager"></div>`;
      $('#newProjBtn').addEventListener('click', () => this.openNew());
      $('#pq').addEventListener('input', e => { this.state.q = e.target.value; this.state.page = 1; this.renderGrid(); });
      $('#pStatus').addEventListener('change', e => { this.state.status = e.target.value; this.state.page = 1; this.renderGrid(); });
      $('#pCat').addEventListener('change', e => { this.state.category = e.target.value; this.state.page = 1; this.renderGrid(); });
      $('#pSort').addEventListener('change', e => { this.state.sort = e.target.value; this.renderGrid(); });
      this.renderGrid();
    },
    filtered() {
      const s = this.state;
      let list = Store.projects().filter(p =>
        (!s.q || (p.name + ' ' + (p.client || '') + ' ' + (p.location || '')).toLowerCase().includes(s.q.toLowerCase())) &&
        (!s.status || p.status === s.status) && (!s.category || p.category === s.category));
      const sorters = {
        updated: (a, b) => (b.updated || '').localeCompare(a.updated || ''),
        name: (a, b) => a.name.localeCompare(b.name),
        completion: (a, b) => (b.completion || 0) - (a.completion || 0),
        budget: (a, b) => (b.budget || 0) - (a.budget || 0)
      };
      return list.sort(sorters[s.sort] || sorters.updated);
    },
    renderGrid() {
      const list = this.filtered();
      const s = this.state, pages = Math.max(1, Math.ceil(list.length / s.per));
      if (s.page > pages) s.page = pages;
      const slice = list.slice((s.page - 1) * s.per, s.page * s.per);
      /* Two different empties: nothing created yet, versus filters that
         exclude everything. Telling a first-time user their filters are
         wrong when they have simply not started is needlessly confusing. */
      $('#projGrid').innerHTML = slice.length
        ? `<div class="grid g-3">${slice.map(p => this.card(p)).join('')}</div>`
        : (Store.projects().length
            ? App.empty('No projects match your filters.', { icon: 'fa-folder-open', compact: true, hint: 'Try clearing the search or choosing a different status.' })
            : App.empty('No projects have been created yet.', {
                icon: 'fa-diagram-project',
                hint: 'Create your first project to track its budget, schedule, vendors and payments.',
                action: `<button class="btn btn--accent btn--sm" onclick="document.getElementById('fabNewProject').click()"><i class="fa-solid fa-plus"></i> New Project</button>`
              }));
      $$('#projGrid [data-open]').forEach(c => c.addEventListener('click', () => location.hash = '#/projects/' + c.dataset.open));
      // pager
      if (pages > 1) {
        $('#projPager').innerHTML = `
          <button class="pager__btn" ${s.page === 1 ? 'disabled' : ''} data-pg="prev"><i class="fa-solid fa-chevron-left"></i></button>
          ${Array.from({ length: pages }, (_, i) => `<button class="pager__btn ${s.page === i + 1 ? 'is-active' : ''}" data-pg="${i + 1}">${i + 1}</button>`).join('')}
          <button class="pager__btn" ${s.page === pages ? 'disabled' : ''} data-pg="next"><i class="fa-solid fa-chevron-right"></i></button>`;
        $$('#projPager .pager__btn').forEach(b => b.addEventListener('click', () => {
          const v = b.dataset.pg; if (v === 'prev') s.page--; else if (v === 'next') s.page++; else s.page = +v;
          this.renderGrid(); window.scrollTo({ top: 0, behavior: 'smooth' });
        }));
      } else $('#projPager').innerHTML = '';
    },
    card(p) {
      const rem = remaining(p);
      return `<article class="card pcard" data-open="${p.id}" role="button" tabindex="0">
        <div class="pcard__top">
          <span class="pcard__cat"><i class="fa-solid ${catIcon[p.category] || 'fa-building'}"></i> ${esc(p.type || p.category || 'Project')}</span>
          ${statusPill(p.status)}
        </div>
        <h3 class="pcard__name">${esc(p.name)}</h3>
        <div class="pcard__meta"><i class="fa-solid fa-user"></i> ${esc(p.client || '—')} &nbsp;·&nbsp; <i class="fa-solid fa-location-dot"></i> ${esc(p.location || '—')}</div>
        <div class="pcard__prog">
          <div class="pcard__progtop"><span>Completion</span><b>${p.completion || 0}%</b></div>
          <div class="settle" style="--pct:${p.completion || 0}"><div class="settle__track"><span class="settle__fill"></span></div></div>
        </div>
        <div class="pcard__stats">
          <div><span>Budget</span><b>${p.budget == null ? '—' : money(p.budget, true)}</b></div>
          <div><span>Spent</span><b>${p.spent == null ? '—' : money(p.spent, true)}</b></div>
          <div><span>Remaining</span><b>${rem == null ? '—' : money(rem, true)}</b></div>
        </div>
        <div class="pcard__foot">
          <div class="avstack">${(p.staff || []).slice(0, 4).map(id => avatar(id)).join('') || '<span class="faint" style="font-size:11px">No staff assigned</span>'}</div>
          <span class="faint" style="font-size:11px">Updated ${p.updated ? fromNow(p.updated) : '—'}</span>
        </div>
      </article>`;
    },

    /* ---------- DETAIL ---------- */
    detail(p) {
      /* Schedule sits second: after you know what the project is, the next
         question is always whether it is on time. */
      const tabs = ['Overview', 'Schedule', 'Budget', 'Tasks', 'Milestones', 'Payments', 'Documents', 'Reports', 'Team', 'Activity'];
      const active = (App.query().tab || 'overview').toLowerCase();
      $('#page-projects').innerHTML = `
        <a class="btn btn--ghost btn--sm" href="#/projects" style="margin-bottom:1rem"><i class="fa-solid fa-arrow-left"></i> All projects</a>
        <div class="phead">
          <div><p class="eyebrow">${esc(p.category || 'Project')} · ${esc(p.type || '')}</p><h1>${esc(p.name)}</h1>
            <p class="phead__sub"><i class="fa-solid fa-user"></i> ${esc(p.client || '—')} &nbsp;·&nbsp; <i class="fa-solid fa-location-dot"></i> ${esc(p.location || '—')} &nbsp;·&nbsp; ${statusPill(p.status)}</p></div>
          <div class="phead__actions">
            ${p.url ? `<a class="btn btn--ghost" href="${p.url}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Public page</a>` : ''}
            ${p.live ? `<a class="btn btn--accent" href="#/reports"><i class="fa-solid fa-file-lines"></i> Weekly report</a>` : ''}
            <button class="btn btn--ghost" id="pEditBtn"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn btn--ghost" id="pDelBtn" style="color:var(--warn)"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>
        <div class="tabs" id="pTabs">${tabs.map(t => `<button class="tab ${t.toLowerCase() === active ? 'is-active' : ''}" data-tab="${t.toLowerCase()}">${t}</button>`).join('')}</div>
        <div id="pTabBody"></div>`;
      $('#pTabs').addEventListener('click', e => {
        const b = e.target.closest('.tab'); if (!b) return;
        $$('#pTabs .tab').forEach(x => x.classList.toggle('is-active', x === b));
        this.tab(p, b.dataset.tab);
      });
      $('#pEditBtn').addEventListener('click', () => this.openEdit(p));
      $('#pDelBtn').addEventListener('click', () => this.confirmDelete(p));
      this.tab(p, active);
    },
    tab(p, name) {
      const body = $('#pTabBody'); if (!body) return;
      const fns = {
        overview: () => this.tabOverview(p),
        /* Schedule paints itself into the host element, because it owns
           its own chips, filters and modal — so it returns nothing here. */
        schedule: () => '',
        /* Both paint into the host themselves — they own their own
           filters and modals, so they return nothing here. */
        budget: () => '',
        timeline: () => this.tabTimeline(p), tasks: () => this.tabTasks(p),
        milestones: () => this.tabMilestones(p), payments: () => payments.projectPanel(p), documents: () => this.tabDocuments(p),
        reports: () => this.tabReports(p), team: () => this.tabStaff(p), staff: () => this.tabStaff(p),
        activity: () => this.tabActivity(p)
      };
      body.innerHTML = (fns[name] || fns.overview)();
      if (name === 'schedule' && App.ProjectSchedule) App.ProjectSchedule.render(p, body);
      if (name === 'budget' && App.ProjectBudget) App.ProjectBudget.render(p, body);
      if (name === 'milestones') this.bindMilestones(p);
      if (name === 'tasks') this.bindKanban(p);
      if (name === 'overview' && p.live) this.overviewChart();
      if (name === 'payments') payments.bindProjectPanel(p);
    },
    tabOverview(p) {
      const rem = remaining(p);
      const liveBlock = p.live ? `
        <div class="hero mb">
          <div class="hero__figures">
            <div class="hero__big"><span class="lbl">Released to date</span><span class="val teal">${money(D.meta.balanceReleased, true)}</span><span class="hero__of">of ${money(D.meta.balanceReleased + D.meta.balanceOutstanding, true)} committed</span></div>
            <div class="hero__big"><span class="lbl">Outstanding</span><span class="val coral">${money(D.meta.balanceOutstanding, true)}</span><span class="hero__of">${App.Derive.outstandingCount} vendor accounts</span></div>
          </div>
          ${settleBar(D.meta.balanceReleased, D.meta.balanceReleased + D.meta.balanceOutstanding, { lg: true })}
        </div>
        <div class="grid g-4 mb">
          <a class="kpi" href="#/projects/${p.id}?tab=budget" style="cursor:pointer"><div class="kpi__label">Budget lines</div><div class="kpi__value">${D.budget.length}</div><div class="kpi__foot">Open budget →</div></a>
          <a class="kpi" href="#/projects/${p.id}?tab=schedule" style="cursor:pointer"><div class="kpi__label">Schedule tasks</div><div class="kpi__value">${D.schedule.length}</div><div class="kpi__foot">Open schedule →</div></a>
          <a class="kpi" href="#/vendors" style="cursor:pointer"><div class="kpi__label">Vendor accounts</div><div class="kpi__value">${D.vendors.length}</div><div class="kpi__foot">Open vendors →</div></a>
          <a class="kpi" href="#/ledger" style="cursor:pointer"><div class="kpi__label">Transactions</div><div class="kpi__value">${D.ledger.length}</div><div class="kpi__foot">Open ledger →</div></a>
        </div>
        <div class="card mb"><div class="card__head"><div><h2>Schedule status</h2><p class="sub">${D.schedule.length} tasks across ${D.areas.length} areas</p></div></div>
          <div class="card__body"><div class="chartbox"><canvas id="chProjStatus"></canvas></div></div></div>` : '';
      return `
        ${liveBlock}
        <div class="grid g-xl-2">
          <div class="card"><div class="card__head"><div><h2>About</h2></div></div><div class="card__body">
            <p class="muted" style="font-size:13.5px;line-height:1.6">${esc(p.description || 'No description yet.')}</p>
            ${p.notes ? `<p class="faint" style="font-size:12.5px;margin-top:.8rem"><i class="fa-solid fa-note-sticky"></i> ${esc(p.notes)}</p>` : ''}
          </div></div>
          <div class="card"><div class="card__head"><div><h2>Details</h2></div></div><div class="card__body"><dl class="deflist">
            <div><dt>Client</dt><dd>${esc(p.client || '—')}</dd></div>
            ${p.phone ? `<div><dt>Phone</dt><dd>${esc(p.phone)}</dd></div>` : ''}
            ${p.email ? `<div><dt>Email</dt><dd style="font-size:12px">${esc(p.email)}</dd></div>` : ''}
            <div><dt>Type</dt><dd>${esc(p.type || '—')}</dd></div>
            <div><dt>Priority</dt><dd>${prioPill(p.priority)}</dd></div>
            <div><dt>Start</dt><dd>${p.start ? shortDate(p.start) : '—'}</dd></div>
            <div><dt>Expected completion</dt><dd>${p.due ? shortDate(p.due) : '—'}</dd></div>
            <div><dt>Budget</dt><dd>${p.budget == null ? '—' : money(p.budget)}</dd></div>
            <div><dt>Spent</dt><dd>${p.spent == null ? '—' : money(p.spent)}</dd></div>
            <div><dt>Remaining</dt><dd>${rem == null ? '—' : money(rem)}</dd></div>
          </dl></div></div>
        </div>`;
    },
    overviewChart() {
      const t = themeColors();
      const sc = Object.entries(App.Derive.statusCounts).sort((a, b) => b[1] - a[1]);
      const palette = { 'Completed': t.settled, 'Work in progress': t.info, 'Final work': t.accent, 'Installation': t.accent, 'Material to order': t.warn, 'Work to start': t.muted, 'Vendor confirmation': t.purple, 'Factory': t.info, 'No status': t.line };
      chart('chProjStatus', { type: 'doughnut', data: { labels: sc.map(x => x[0]), datasets: [{ data: sc.map(x => x[1]), backgroundColor: sc.map(x => palette[x[0]] || t.muted), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface'), borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8, font: { size: 11 } } } } } });
    },

    /* ----- TASKS / KANBAN ----- */
    tabTasks(p) {
      const cols = ['To Do', 'In Progress', 'Review', 'Completed'];
      const tasks = Store.tasks(p.id);
      return `
        <div class="kbar">
          <p class="muted" style="font-size:13px;margin:0">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</p>
          <button class="btn btn--accent btn--sm" id="addTaskBtn"><i class="fa-solid fa-plus"></i> Add task</button>
        </div>
        <div class="kanban">${cols.map(c => {
        const items = tasks.filter(t => (t.status || 'To Do') === c);
        return `<div class="kcol" data-col="${c}">
            <div class="kcol__head"><span>${c}</span><span class="kcol__n">${items.length}</span></div>
            <div class="kcol__body">${items.map(t => this.taskCard(p, t, cols)).join('') || `<div class="kcol__empty">Drop or add tasks</div>`}</div>
          </div>`;
      }).join('')}</div>`;
    },
    taskCard(p, t, cols) {
      const idx = cols.indexOf(t.status || 'To Do');
      return `<div class="ktask" data-task="${t.id}">
        <div class="ktask__top">${prioPill(t.priority)}${t.assignee ? avatar(t.assignee) : ''}</div>
        <div class="ktask__title">${esc(t.title)}</div>
        ${t.desc ? `<div class="ktask__desc">${esc(t.desc)}</div>` : ''}
        <div class="settle" style="--pct:${t.progress || 0}"><div class="settle__track" style="height:5px"><span class="settle__fill"></span></div></div>
        <div class="ktask__foot">
          <span class="faint"><i class="fa-regular fa-clock"></i> ${t.due ? shortDate(t.due) : 'No date'}</span>
          <span class="ktask__move">
            <button class="ktask__btn" data-move="prev" ${idx === 0 ? 'disabled' : ''} title="Move left"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="ktask__btn" data-edit title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="ktask__btn" data-move="next" ${idx === cols.length - 1 ? 'disabled' : ''} title="Move right"><i class="fa-solid fa-chevron-right"></i></button>
          </span>
        </div>
      </div>`;
    },
    bindKanban(p) {
      const cols = ['To Do', 'In Progress', 'Review', 'Completed'];
      $('#addTaskBtn')?.addEventListener('click', () => this.openTask(p));
      $$('#pTabBody .ktask').forEach(el => {
        const id = el.dataset.task;
        el.querySelector('[data-move="prev"]')?.addEventListener('click', e => { e.stopPropagation(); this.moveTask(p, id, -1); });
        el.querySelector('[data-move="next"]')?.addEventListener('click', e => { e.stopPropagation(); this.moveTask(p, id, 1); });
        el.querySelector('[data-edit]')?.addEventListener('click', e => { e.stopPropagation(); const t = Store.tasks(p.id).find(x => x.id === id); this.openTask(p, t); });
      });
    },
    moveTask(p, id, dir) {
      const cols = ['To Do', 'In Progress', 'Review', 'Completed'];
      const t = Store.tasks(p.id).find(x => x.id === id); if (!t) return;
      const i = Math.min(cols.length - 1, Math.max(0, cols.indexOf(t.status || 'To Do') + dir));
      const patch = { status: cols[i] };
      if (cols[i] === 'Completed') patch.progress = 100;
      Store.updateTask(p.id, id, patch);
      this.tab(p, 'tasks');
    },
    openTask(p, t) {
      const cols = ['To Do', 'In Progress', 'Review', 'Completed'];
      const staffOpts = [{ v: '', l: 'Unassigned' }].concat(App.STAFF.map(s => ({ v: s.id, l: s.name })));
      App.modal({
        title: t ? 'Edit task' : 'Add task',
        body: `<div class="formgrid">
          ${field('tTitle', 'Title', t?.title || '', { req: true, ph: 'e.g. Finalise staircase cladding' })}
          ${field('tDesc', 'Description', t?.desc || '', { type: 'textarea', rows: 2 })}
          <div class="formrow">
            ${field('tAssignee', 'Assigned staff', t?.assignee || '', { type: 'select', options: staffOpts })}
            ${field('tPriority', 'Priority', t?.priority || 'Medium', { type: 'select', options: ['High', 'Medium', 'Low'] })}
          </div>
          <div class="formrow">
            ${field('tStatus', 'Column', t?.status || 'To Do', { type: 'select', options: cols })}
            ${field('tDue', 'Due date', t?.due || '', { type: 'date' })}
          </div>
          ${field('tProgress', 'Progress %', t?.progress ?? 0, { type: 'number', attr: 'min="0" max="100"' })}
        </div>`,
        footer: `${t ? '<button class="btn btn--ghost" id="tDel" style="margin-right:auto">Delete</button>' : ''}<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="tSave">${t ? 'Save' : 'Add task'}</button>`
      });
      $('#tSave').addEventListener('click', () => {
        const title = $('#tTitle').value.trim();
        if (!setErr('tTitle', title ? '' : 'Title is required')) return;
        const data = { title, desc: $('#tDesc').value.trim(), assignee: $('#tAssignee').value, priority: $('#tPriority').value, status: $('#tStatus').value, due: $('#tDue').value, progress: Math.max(0, Math.min(100, +$('#tProgress').value || 0)) };
        if (t) { Store.updateTask(p.id, t.id, data); App.toast('Task updated', title, 'good'); }
        else { data.id = genId('t'); Store.addTask(p.id, data); App.toast('Task added', title, 'good'); }
        App.closeModal(); this.tab(p, 'tasks');
      });
      $('#tDel')?.addEventListener('click', () => {
        const arr = Store.tasks(p.id).filter(x => x.id !== t.id); Store.setTasks(p.id, arr);
        App.closeModal(); this.tab(p, 'tasks'); App.toast('Task deleted', '', 'warn');
      });
    },

    /* ----- TIMELINE ----- */
    tabTimeline(p) {
      const ev = [];
      if (p.start) ev.push({ at: p.start, icon: 'fa-flag', t: 'Project start', s: 'Kick-off' });
      Store.tasks(p.id).filter(t => t.due).forEach(t => ev.push({ at: t.due, icon: 'fa-clipboard-check', t: t.title, s: t.status + ' · ' + (t.progress || 0) + '%' }));
      Store.payments(p.id).forEach(pay => ev.push({ at: pay.invoiceDate || pay.dueDate, icon: 'fa-indian-rupee-sign', t: (pay.invoiceNo || 'Invoice') + ' · ₹' + App.inr.format(pay.amount), s: pay.status }));
      if (p.due) ev.push({ at: p.due, icon: 'fa-flag-checkered', t: 'Expected completion', s: (p.completion || 0) + '% done' });
      ev.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
      if (!ev.length) return this.empty('fa-timeline', 'No timeline events yet', 'Add tasks, milestones or payments to build the timeline.');
      return `<div class="card"><div class="card__body"><ol class="timeline">${ev.map(e => `
        <li class="tl"><span class="tl__dot"><i class="fa-solid ${e.icon}"></i></span>
          <div class="tl__body"><div class="tl__t">${esc(e.t)}</div><div class="tl__s">${esc(e.s)}</div></div>
          <span class="tl__date">${e.at ? shortDate(e.at) : '—'}</span></li>`).join('')}</ol></div></div>`;
    },
    /* ── MILESTONES ─────────────────────────────────────────────────
       Real records per project, not derived flags. Stored under
       itd.milestones keyed by project id, so milestones never leak
       between projects.

         id · name · planned · actual · status · engineer · notes · attachments[]

       The default set is the standard construction sequence; a project
       with none offers to seed it rather than showing a dead end. */
    MS_STATUS: ['Pending', 'In progress', 'Completed', 'Delayed'],
    MS_DEFAULT: ['Foundation', 'Structure', 'Masonry', 'Plumbing', 'Electrical', 'Interior', 'Finishing', 'Handover'],

    msPill(m) {
      const map = { 'Completed': 'completed', 'In progress': 'progress', 'Delayed': 'due', 'Pending': 'none' };
      return `<span class="pill ${map[m.status] || 'none'}">${esc(m.status || 'Pending')}</span>`;
    },

    tabMilestones(p) {
      const ms = Store.milestones(p.id);
      const done = ms.filter(m => m.status === 'Completed').length;

      if (!ms.length) {
        return `<div class="card">
          <div class="card__head"><div><h2>Milestones</h2><p class="sub">Key stages for this project</p></div></div>
          <div class="card__body">
            ${App.empty('No milestones set for this project.', {
              bare: true, icon: 'fa-flag-checkered',
              hint: 'Track the stages that matter — foundation through handover — each with a planned date, an owner and a status.',
              action: `<button class="btn btn--accent btn--sm" id="msSeed"><i class="fa-solid fa-wand-magic-sparkles"></i> Add standard stages</button>
                       <button class="btn btn--ghost btn--sm" id="msAdd" style="margin-left:.5rem"><i class="fa-solid fa-plus"></i> Add one</button>`
            })}
          </div></div>`;
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      return `<div class="card">
        <div class="card__head">
          <div><h2>Milestones</h2><p class="sub">${done} of ${ms.length} reached</p></div>
          <button class="btn btn--ghost btn--sm" id="msAdd"><i class="fa-solid fa-plus"></i> Add milestone</button>
        </div>
        <div class="card__body">
          <div style="margin-bottom:1rem">${settleBar(done, ms.length, { legend: false })}</div>
          <div class="tablewrap" style="box-shadow:none;border:0"><table class="dt" style="min-width:0">
            <thead><tr><th>Milestone</th><th>Planned</th><th>Actual</th><th>Status</th><th class="hide-sm">Engineer</th><th></th></tr></thead>
            <tbody>${ms.map(m => {
              const late = m.status !== 'Completed' && m.planned && m.planned < todayIso;
              return `<tr>
                <td class="strong">${esc(m.name)}${m.notes ? `<div class="faint" style="font-size:11px">${esc(m.notes)}</div>` : ''}</td>
                <td class="num">${m.planned ? shortDate(m.planned) : '—'}${late ? ' <i class="fa-solid fa-triangle-exclamation" style="color:var(--warn);font-size:10px" title="Past the planned date"></i>' : ''}</td>
                <td class="num">${m.actual ? shortDate(m.actual) : '<span class="faint">—</span>'}</td>
                <td>${this.msPill(m)}</td>
                <td class="hide-sm">${esc((App.staffById(m.engineer) || {}).name || '—')}</td>
                <td><button class="btn btn--ghost btn--sm msEdit" data-id="${esc(m.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>
        </div></div>`;
    },

    bindMilestones(p) {
      const seed = $('#msSeed');
      if (seed) seed.addEventListener('click', () => {
        const today = new Date();
        Store.setMilestones(p.id, this.MS_DEFAULT.map((n, i) => {
          const d = new Date(today); d.setDate(d.getDate() + (i + 1) * 30);
          return { id: genId('ms'), name: n, planned: d.toISOString().slice(0, 10),
                   actual: '', status: 'Pending', engineer: '', notes: '', attachments: [] };
        }));
        App.toast('Milestones added', this.MS_DEFAULT.length + ' standard stages', 'good');
        this.tab(p, 'milestones');
      });

      const add = $('#msAdd');
      if (add) add.addEventListener('click', () => this.msForm(p, null));

      $$('#pTabBody .msEdit').forEach(b => b.addEventListener('click', () =>
        this.msForm(p, Store.milestones(p.id).find(m => m.id === b.dataset.id) || null)));
    },

    msForm(p, m) {
      const editing = !!m;
      const rec = m || {};
      const staffOpts = [{ v: '', l: 'Unassigned' }].concat((App.STAFF || []).map(s => ({ v: s.id, l: s.name })));
      App.modal({
        title: editing ? 'Edit milestone' : 'Add milestone',
        body: `<div class="formgrid">
          <label class="field"><span>Milestone name *</span><input id="msName" value="${esc(rec.name || '')}" placeholder="e.g. Structure"><em class="field__err" id="msNameErr"></em></label>
          <div class="formrow">
            <label class="field"><span>Planned date</span><input id="msPlanned" type="date" value="${esc(rec.planned || '')}"></label>
            <label class="field"><span>Actual completion</span><input id="msActual" type="date" value="${esc(rec.actual || '')}"></label>
          </div>
          <div class="formrow">
            <label class="field"><span>Status</span><select id="msStatus">${this.MS_STATUS.map(x => `<option ${((rec.status || 'Pending') === x) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="field"><span>Assigned engineer</span><select id="msEng">${staffOpts.map(o => `<option value="${esc(o.v)}" ${rec.engineer === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Notes</span><textarea id="msNotes" rows="3" placeholder="Site observations, sign-off reference…">${esc(rec.notes || '')}</textarea></label>
          <p class="muted" style="font-size:12px;margin:.2rem 0 0">Attachments arrive with file storage — the field is reserved on the record so nothing has to be migrated later.</p>
        </div>`,
        footer: `${editing ? '<button class="btn btn--ghost" id="msDel" style="color:var(--warn);margin-right:auto"><i class="fa-solid fa-trash"></i> Delete</button>' : ''}
                 <button class="btn btn--ghost" data-close>Cancel</button>
                 <button class="btn btn--accent" id="msSave"><i class="fa-solid fa-check"></i> Save</button>`
      });

      $('#msSave').addEventListener('click', () => {
        const name = $('#msName').value.trim();
        if (!setErr('msName', name ? '' : 'Milestone name is required')) return;
        const data = {
          name, planned: $('#msPlanned').value, actual: $('#msActual').value,
          status: $('#msStatus').value, engineer: $('#msEng').value,
          notes: $('#msNotes').value.trim(), attachments: rec.attachments || []
        };
        /* Recording an actual date without moving the status is the most
           common slip, so complete it for them. */
        if (data.actual && data.status !== 'Completed') data.status = 'Completed';

        const all = Store.milestones(p.id);
        if (editing) {
          const i = all.findIndex(x => x.id === rec.id);
          if (i >= 0) all[i] = Object.assign({}, all[i], data);
        } else {
          all.push(Object.assign({ id: genId('ms') }, data));
        }
        Store.setMilestones(p.id, all);
        App.closeModal();
        App.toast(editing ? 'Milestone updated' : 'Milestone added', name, 'good');
        this.tab(p, 'milestones');
      });

      const del = $('#msDel');
      if (del) del.addEventListener('click', () => {
        Store.setMilestones(p.id, Store.milestones(p.id).filter(x => x.id !== rec.id));
        App.closeModal();
        App.toast('Milestone removed', rec.name || '', 'warn');
        this.tab(p, 'milestones');
      });
    },

    tabDocuments(p) {
      return this.empty('fa-folder-open', 'No documents yet', 'Attachment storage needs a file backend — this app keeps data in the browser only. Drawings, invoices and photos would list here once connected.');
    },
    tabReports(p) {
      return `<div class="grid g-2">
        <a class="card projcard" href="#/reports"><div class="projcard__top"><span class="kpi__icon blue"><i class="fa-solid fa-file-lines"></i></span></div><h3 class="projcard__name" style="font-size:1rem">Weekly PMC report</h3><p class="projcard__meta">Printable client report — budget, payments, schedule roll-up.</p></a>
        <div class="card"><div class="card__body"><h3 style="font-size:1rem;margin-bottom:.5rem">Export</h3><p class="muted" style="font-size:13px;margin-bottom:.8rem">Download this project's tasks and payments.</p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn--ghost btn--sm" id="expTasks"><i class="fa-solid fa-file-csv"></i> Tasks CSV</button><button class="btn btn--ghost btn--sm" id="expPay"><i class="fa-solid fa-file-csv"></i> Payments CSV</button></div></div></div>
      </div>`;
    },
    tabStaff(p) {
      if (!p.staff || !p.staff.length) return this.empty('fa-user-plus', 'No staff assigned', 'Assign team members when creating or editing the project.');
      return `<div class="staffgrid">${p.staff.map(id => {
        const s = App.staffById(id); if (!s) return '';
        const tasks = Store.tasks(p.id).filter(t => t.assignee === id);
        const openT = tasks.filter(t => t.status !== 'Completed').length;
        return `<article class="staff" style="cursor:pointer" onclick="location.hash='#/staff/${s.id}'">
          <div class="staff__top"><span class="avatar" style="--h:${s.h}">${esc(s.name.slice(0, 2).toUpperCase())}</span>
            <div><div class="staff__name">${esc(s.name)}</div><div class="staff__role">${esc(s.role)}</div></div></div>
          <div class="staff__stat"><div><b>${tasks.length}</b><span>Tasks</span></div><div><b>${openT}</b><span>Open</span></div><div><b>${esc((s.availability || 'Available').split(' ')[0])}</b><span>Status</span></div></div>
        </article>`;
      }).join('')}</div>`;
    },
    tabActivity(p) {
      const log = Store.activity(p.id);
      if (!log.length) return this.empty('fa-clock-rotate-left', 'No activity yet', 'Actions on this project — tasks, payments, edits — will appear here.');
      return `<div class="card"><div class="card__body"><ol class="timeline">${log.map(a => `
        <li class="tl"><span class="tl__dot"><i class="fa-solid fa-circle-dot"></i></span>
          <div class="tl__body"><div class="tl__t">${esc(a.msg)}</div><div class="tl__s">${esc(a.who || 'You')}</div></div>
          <span class="tl__date">${fromNow(a.at)}</span></li>`).join('')}</ol></div></div>`;
    },
    empty(icon, title, sub) {
      return `<div class="card"><div class="dt__empty" style="padding:3rem 1rem"><i class="fa-solid ${icon}" style="font-size:28px;opacity:.35"></i><p style="margin:.8rem 0 .2rem;font-weight:600;color:var(--ink)">${esc(title)}</p><p class="muted" style="font-size:13px;max-width:420px;margin:0 auto">${esc(sub)}</p></div></div>`;
    },

    /* ----- NEW PROJECT ----- */
    openNew() { this._form(null); },
    openEdit(p) { this._form(p); },
    /* Shared create/edit form. Pass a project to edit, or null to create. */
    _form(existing) {
      const p = existing || {};
      const isEdit = !!existing;
      const has = ids => new Set(p.staff || []).has(ids);
      const staffChecks = App.STAFF.map(s => `<label class="chk"><input type="checkbox" value="${s.id}" ${has(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('');
      App.modal({
        title: isEdit ? 'Edit project' : 'New project',
        body: `<div class="formgrid">
          ${field('npName', 'Project name', p.name || '', { req: true, ph: 'e.g. Mr. Rao Villa' })}
          <div class="formrow">${field('npClient', 'Client name', p.client || '', { req: true })}${field('npType', 'Project type', p.type || '', { ph: 'e.g. Villa' })}</div>
          <div class="formrow">${field('npPhone', 'Client phone', p.phone || '', { type: 'tel', ph: '+91…' })}${field('npEmail', 'Client email', p.email || '', { type: 'email', ph: 'name@example.com' })}</div>
          ${field('npAddress', 'Project address', p.address || '', { ph: 'Area, City' })}
          <div class="formrow">${field('npCategory', 'Category', p.category || 'Residential', { type: 'select', options: ['Residential', 'Commercial', 'Hospitality', 'Interiors', 'Landscape'] })}${field('npPriority', 'Priority', p.priority || 'Medium', { type: 'select', options: ['High', 'Medium', 'Low'] })}</div>
          <div class="formrow">${field('npStart', 'Start date', p.start || '', { type: 'date' })}${field('npDue', 'Expected completion', p.due || '', { type: 'date' })}</div>
          <div class="formrow">${field('npBudget', 'Budget (₹)', p.budget == null ? '' : p.budget, { type: 'number', attr: 'min="0"', ph: '0' })}${field('npStatus', 'Status', p.status || 'Planning', { type: 'select', options: Object.keys(STATUS) })}</div>
          ${isEdit ? field('npCompletion', 'Completion (%)', p.completion || 0, { type: 'number', attr: 'min="0" max="100"' }) : ''}
          ${field('npDesc', 'Description', p.description || '', { type: 'textarea' })}
          ${field('npNotes', 'Notes', p.notes || '', { type: 'textarea', rows: 2 })}
          <label class="field"><span>Assign staff</span><div class="chkgrid">${staffChecks}</div></label>
          <label class="field"><span>Attachments</span><div class="dropzone"><i class="fa-solid fa-paperclip"></i> Drag files here (stored by name only — no file backend in this build)</div></label>
        </div>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="npSave"><i class="fa-solid fa-check"></i> ${isEdit ? 'Save changes' : 'Create project'}</button>`
      });
      $('#npSave').addEventListener('click', () => this._save(existing));
    },
    _save(existing) {
      const val = id => $('#' + id).value.trim();
      let ok = true;
      ok = setErr('npName', val('npName') ? '' : 'Project name is required') && ok;
      ok = setErr('npClient', val('npClient') ? '' : 'Client name is required') && ok;
      const email = val('npEmail');
      if (email) ok = setErr('npEmail', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? '' : 'Enter a valid email') && ok;
      const phone = val('npPhone');
      if (phone) ok = setErr('npPhone', /^[+\d][\d\s-]{6,}$/.test(phone) ? '' : 'Enter a valid phone') && ok;
      const budget = val('npBudget');
      if (budget) ok = setErr('npBudget', +budget >= 0 ? '' : 'Budget cannot be negative') && ok;
      const start = val('npStart'), due = val('npDue');
      if (start && due) ok = setErr('npDue', due >= start ? '' : 'Completion must be after start') && ok;
      if (!ok) return;
      const staff = $$('.modal .chkgrid input:checked').map(c => c.value);
      const fields = {
        name: val('npName'), client: val('npClient'), phone, email,
        address: val('npAddress'), location: val('npAddress') || 'Hyderabad', type: val('npType'),
        category: $('#npCategory').value, priority: $('#npPriority').value,
        start, due, budget: budget ? +budget : null, status: $('#npStatus').value,
        description: val('npDesc'), notes: val('npNotes'), staff
      };
      if (existing) {
        const c = $('#npCompletion'); if (c) fields.completion = Math.max(0, Math.min(100, +c.value || 0));
        Store.updateProject(existing.id, fields);
        App.closeModal(); App.buildSearchIndex();
        App.toast('Project updated', fields.name, 'good');
        this.route();
      } else {
        const p = { id: genId('p'), ...fields, spent: 0, completion: 0, updated: new Date().toISOString() };
        Store.addProject(p); App.closeModal(); App.buildSearchIndex();
        App.toast('Project created', p.name, 'good');
        location.hash = '#/projects/' + p.id;
      }
    },
    confirmDelete(p) {
      App.modal({
        title: 'Delete project',
        body: `<p style="font-size:14px;line-height:1.6;margin:0">Delete <b>${esc(p.name)}</b>? This removes the project and its tasks, activity and payment records from this browser. This can't be undone.</p>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="pDelYes" style="background:var(--warn);border-color:var(--warn)"><i class="fa-solid fa-trash"></i> Delete project</button>`
      });
      $('#pDelYes').addEventListener('click', () => {
        Store.deleteProject(p.id); App.closeModal(); App.buildSearchIndex();
        App.toast('Project deleted', p.name, 'warn');
        location.hash = '#/projects';
      });
    }
  };
  App.register('projects', project);

  /* Expose CSV helpers + task/payment export */
  /* RFC 4180 quoting, plus a guard against spreadsheet formula injection:
     Excel executes a cell that starts with = + - or @, so a vendor named
     "=cmd|..." would run on open. Prefixing with an apostrophe neutralises
     it and stays invisible in the sheet. */
  function csvCell(c) {
    c = c == null ? '' : String(c);
    if (/^[=+\-@\t\r]/.test(c)) c = "'" + c;
    return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
  }
  function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\n'); }
  function download(name, text, type = 'text/csv') { const b = new Blob([text], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }
  document.addEventListener('click', e => {
    if (e.target.closest('#expTasks')) { const p = Store.project(App.param()); const rows = [['Title', 'Status', 'Priority', 'Assignee', 'Due', 'Progress']].concat(Store.tasks(p.id).map(t => [t.title, t.status, t.priority, (App.staffById(t.assignee)?.name || ''), t.due, t.progress])); download(p.id + '-tasks.csv', toCSV(rows)); App.toast('Exported', 'Tasks CSV downloaded', 'good'); }
    if (e.target.closest('#expPay')) { const p = Store.project(App.param()); const rows = [['Invoice', 'Date', 'Client', 'Amount', 'GST%', 'Status']].concat(Store.payments(p.id).map(x => [x.invoiceNo, x.invoiceDate, x.client, x.amount, x.gst, x.status])); download(p.id + '-payments.csv', toCSV(rows)); App.toast('Exported', 'Payments CSV downloaded', 'good'); }
  });
  App._toCSV = toCSV; App._download = download;

  /* ══════════════════════════════════════════════════════
     PAYMENTS
     ══════════════════════════════════════════════════════ */
  const PAYSTATUS = ['Pending', 'Advance', 'Partial', 'Paid', 'Overdue', 'Cancelled'];
  const paidStates = ['Advance', 'Partial', 'Paid'];
  const payStatusPill = s => `<span class="pill ${{ Paid: 'paid', Advance: 'part', Partial: 'part', Pending: 'due', Overdue: 'due', Cancelled: 'none' }[s] || 'none'}">${esc(s)}</span>`;
  const gstAmt = p => (p.amount || 0) * (p.gst || 0) / 100;
  const grossAmt = p => (p.amount || 0) + gstAmt(p);

  const payments = {
    /* ── Filter state ───────────────────────────────────────
       Persisted under itd.pay.filters so a filtered view survives
       navigating away and back, and paging keeps the filters.
       Status is ONE field — the quick chips and the Status dropdown
       are two controls over the same value, so they can never
       contradict each other. */
    DEFAULTS: {
      q: '', project: '', client: '', status: '',
      from: '', to: '', due: '', min: '', max: '',
      sortKey: 'invoiceDate', sortDir: -1, page: 1, per: 25
    },
    state: null,
    advOpen: false,
    CHIPS: ['All', 'Paid', 'Partial', 'Pending', 'Overdue'],

    loadState() {
      this.state = Object.assign({}, this.DEFAULTS, App.store.get('pay.filters', {}));
      return this.state;
    },
    saveState() { App.store.set('pay.filters', this.state); },
    resetState() { this.state = Object.assign({}, this.DEFAULTS); this.saveState(); },

    mount() { this.loadState(); this.render(); },
    refresh() { this.render(); },

    /* ── Filtering ──────────────────────────────────────────
       Every filter combines (AND). One pass over the array, so the
       cost stays linear as the invoice count grows. */
    filtered() {
      const s = this.state;
      const q = (s.q || '').trim().toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      const weekEnd = plus(6);
      const monthStart = today.slice(0, 8) + '01';
      const monthEnd = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); })();

      const rows = Store.payments().filter(p => {
        if (q) {
          const proj = Store.project(p.projectId);
          const hay = ((p.invoiceNo || '') + ' ' + ((proj && proj.name) || '') + ' ' + (p.client || '')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (s.project && p.projectId !== s.project) return false;
        if (s.client && (p.client || '') !== s.client) return false;
        if (s.status && p.status !== s.status) return false;
        if (s.from && (p.invoiceDate || '') < s.from) return false;
        if (s.to && (p.invoiceDate || '') > s.to) return false;

        if (s.due) {
          const d = p.dueDate || '';
          if (!d) return false;
          if (s.due === 'today' && d !== today) return false;
          if (s.due === 'week' && !(d >= today && d <= weekEnd)) return false;
          if (s.due === 'month' && !(d >= monthStart && d <= monthEnd)) return false;
          /* Overdue = past its due date AND not settled. A paid invoice
             with an old due date is not overdue. */
          if (s.due === 'overdue' && !(d < today && !paidStates.includes(p.status))) return false;
        }

        const total = grossAmt(p);
        if (s.min !== '' && total < +s.min) return false;
        if (s.max !== '' && total > +s.max) return false;
        return true;
      });

      const dir = s.sortDir, key = s.sortKey;
      const val = p => {
        if (key === 'project') { const pr = Store.project(p.projectId); return (pr && pr.name) || ''; }
        if (key === 'total') return grossAmt(p);
        if (key === 'gst') return p.gst || 0;
        if (key === 'amount') return p.amount || 0;
        return p[key] == null ? '' : p[key];
      };
      rows.sort((a, b) => {
        const x = val(a), y = val(b);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x).localeCompare(String(y)) * dir;
      });
      return rows;
    },

    render() {
      if (!this.state) this.loadState();
      const all = Store.payments();
      const projects = Store.projects();
      const value = projects.reduce((s, p) => s + (p.budget || 0), 0);
      const received = all.filter(p => paidStates.includes(p.status)).reduce((s, p) => s + grossAmt(p), 0);
      const pending = all.filter(p => p.status === 'Pending').reduce((s, p) => s + grossAmt(p), 0);
      const overdue = all.filter(p => p.status === 'Overdue').reduce((s, p) => s + grossAmt(p), 0);
      const collPct = App.pctOf(received, value);

      $('#page-payments').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Client payments</p><h1>Payments</h1>
          <p class="phead__sub">Invoicing &amp; collections · always linked to a project</p></div>
          <div class="phead__actions"><button class="btn btn--accent" id="addPayBtn"><i class="fa-solid fa-plus"></i> Add payment</button></div>
        </div>
        <div class="grid g-4 mb">
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon"><i class="fa-solid fa-sack-dollar"></i></span></div><div><div class="kpi__label">Total project value</div><div class="kpi__value">${money(value, true)}</div></div><div class="kpi__foot">${projects.length} projects</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon teal"><i class="fa-solid fa-hand-holding-dollar"></i></span></div><div><div class="kpi__label">Received</div><div class="kpi__value">${money(received, true)}</div></div><div class="kpi__foot">${collPct}% collected</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon blue"><i class="fa-solid fa-hourglass-half"></i></span></div><div><div class="kpi__label">Pending</div><div class="kpi__value">${money(pending, true)}</div></div><div class="kpi__foot">awaiting payment</div></div>
          <div class="kpi"><div class="kpi__top"><span class="kpi__icon coral"><i class="fa-solid fa-triangle-exclamation"></i></span></div><div><div class="kpi__label">Overdue</div><div class="kpi__value">${money(overdue, true)}</div></div><div class="kpi__foot">past due date</div></div>
        </div>
        ${all.length ? `
        <div class="grid g-xl-2 mb">
          <div class="card"><div class="card__head"><div><h2>Monthly collections</h2><p class="sub">Received per month</p></div></div><div class="card__body"><div class="chartbox sm"><canvas id="chPayMonth"></canvas></div></div></div>
          <div class="card"><div class="card__head"><div><h2>By status</h2></div></div><div class="card__body"><div class="chartbox sm"><canvas id="chPayStatus"></canvas></div></div></div>
        </div>
        ${this.toolbar(all)}
        <div id="payTableHost"></div>` : this._empty()}`;

      $('#addPayBtn').addEventListener('click', () => this.openAdd());
      if (all.length) { this.bindToolbar(); this.renderTable(); this.charts(all); }
    },

    /* ── Toolbar ────────────────────────────────────────────
       Quick chips for the common case; a collapsible panel holds the
       rest so the page stays calm until you need them. */
    toolbar(all) {
      const s = this.state;
      const projOpts = Store.projects();
      const clients = [...new Set(all.map(p => p.client).filter(Boolean))].sort();
      const counts = { All: all.length };
      this.CHIPS.slice(1).forEach(c => { counts[c] = all.filter(p => p.status === c).length; });
      const chip = c => `<button class="chip ${(s.status || 'All') === c ? 'is-active' : ''}" data-chip="${esc(c)}">${esc(c)} <span class="chip__n">${counts[c] || 0}</span></button>`;
      const badge = this.activeCount() ? ` <span class="chip__n">${this.activeCount()}</span>` : '';

      return `
        <div class="chipbar" style="margin-bottom:.8rem">
          ${this.CHIPS.map(chip).join('')}
          <span style="flex:1"></span>
          <button class="chip" id="payAdvToggle" aria-expanded="${this.advOpen}"><i class="fa-solid fa-sliders"></i> Filters${badge}</button>
        </div>

        <div class="card mb" id="payAdv" ${this.advOpen ? '' : 'hidden'}>
          <div class="card__body">
            <div class="filterbar">
              <label class="field"><span>Search</span><input id="fq" type="search" placeholder="Invoice no, project or client…" value="${esc(s.q)}"></label>
              <label class="field"><span>Project</span><select id="fproject"><option value="">All projects</option>${projOpts.map(p => `<option value="${esc(p.id)}" ${s.project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
              <label class="field"><span>Client</span><select id="fclient"><option value="">All clients</option>${clients.map(c => `<option ${s.client === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
              <label class="field"><span>Status</span><select id="fstatus"><option value="">All</option>${PAYSTATUS.map(c => `<option ${s.status === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
              <label class="field"><span>Invoice date from</span><input id="ffrom" type="date" value="${esc(s.from)}"></label>
              <label class="field"><span>Invoice date to</span><input id="fto" type="date" value="${esc(s.to)}"></label>
              <label class="field"><span>Due date</span><select id="fdue">
                <option value="">All</option>
                <option value="today" ${s.due === 'today' ? 'selected' : ''}>Due today</option>
                <option value="week" ${s.due === 'week' ? 'selected' : ''}>Due this week</option>
                <option value="month" ${s.due === 'month' ? 'selected' : ''}>Due this month</option>
                <option value="overdue" ${s.due === 'overdue' ? 'selected' : ''}>Overdue</option>
              </select></label>
              <label class="field"><span>Min total (₹)</span><input id="fmin" type="number" min="0" placeholder="0" value="${esc(s.min)}"></label>
              <label class="field"><span>Max total (₹)</span><input id="fmax" type="number" min="0" placeholder="Any" value="${esc(s.max)}"></label>
            </div>
            <div class="toolbar" style="justify-content:flex-end; gap:.5rem; margin-top:.4rem">
              <button class="btn btn--ghost btn--sm" id="fReset"><i class="fa-solid fa-arrow-rotate-left"></i> Reset filters</button>
              <button class="btn btn--accent btn--sm" id="fApply"><i class="fa-solid fa-filter"></i> Apply filters</button>
            </div>
          </div>
        </div>`;
    },

    /** How many filters are narrowing the list — shown on the Filters chip. */
    activeCount() {
      const s = this.state, d = this.DEFAULTS;
      return ['q', 'project', 'client', 'status', 'from', 'to', 'due', 'min', 'max']
        .filter(k => s[k] !== d[k]).length;
    },

    bindToolbar() {
      const rerender = () => { this.saveState(); this.renderTable(); this.repaintToolbar(); };

      $$('#page-payments [data-chip]').forEach(b => b.addEventListener('click', () => {
        this.state.status = b.dataset.chip === 'All' ? '' : b.dataset.chip;
        this.state.page = 1;
        const sel = $('#fstatus'); if (sel) sel.value = this.state.status;
        rerender();
      }));

      const adv = $('#payAdv'), toggle = $('#payAdvToggle');
      if (toggle) toggle.addEventListener('click', () => {
        this.advOpen = !this.advOpen;
        adv.hidden = !this.advOpen;
        toggle.setAttribute('aria-expanded', String(this.advOpen));
      });

      /* Apply is explicit, as specified. Search still filters as you type,
         because a search box that needs a button feels broken. */
      const qEl = $('#fq');
      if (qEl) qEl.addEventListener('input', () => { this.state.q = qEl.value; this.state.page = 1; rerender(); });

      $('#fApply') && $('#fApply').addEventListener('click', () => {
        const g = id => { const e = $('#' + id); return e ? e.value : ''; };
        Object.assign(this.state, {
          project: g('fproject'), client: g('fclient'), status: g('fstatus'),
          from: g('ffrom'), to: g('fto'), due: g('fdue'),
          min: g('fmin'), max: g('fmax'), page: 1
        });
        rerender();
        App.toast('Filters applied', this.filtered().length + ' of ' + Store.payments().length + ' invoices', 'good');
      });

      $('#fReset') && $('#fReset').addEventListener('click', () => {
        const open = this.advOpen;
        this.resetState();
        this.advOpen = open;
        this.render();
        App.toast('Filters cleared', '', 'good');
      });
    },

    /** Repaint chips and the filter badge without disturbing focus. */
    repaintToolbar() {
      $$('#page-payments [data-chip]').forEach(b =>
        b.classList.toggle('is-active', (this.state.status || 'All') === b.dataset.chip));
      const t = $('#payAdvToggle');
      if (t) {
        const n = this.activeCount();
        t.innerHTML = `<i class="fa-solid fa-sliders"></i> Filters${n ? ` <span class="chip__n">${n}</span>` : ''}`;
      }
    },

    /* ── Table ──────────────────────────────────────────────── */
    renderTable() {
      const s = this.state;
      const rows = this.filtered();
      const grand = Store.payments().length;
      const total = rows.length;
      const per = +s.per || 25;
      const pages = Math.max(1, Math.ceil(total / per));
      if (s.page > pages) s.page = pages;
      const from = (s.page - 1) * per;
      const slice = rows.slice(from, from + per);

      const th = (k, l, num) => `<th class="${num ? 'num' : ''}" data-k="${k}">${l}${s.sortKey === k ? `<span class="caret">${s.sortDir > 0 ? '▲' : '▼'}</span>` : ''}</th>`;

      const body = total ? `<div class="tablewrap tablewrap--tall"><table class="dt">
          <thead><tr>
            ${th('invoiceNo', 'Invoice')}${th('project', 'Project')}${th('client', 'Client')}
            ${th('amount', 'Amount', 1)}${th('gst', 'GST', 1)}${th('total', 'Total', 1)}
            ${th('dueDate', 'Due')}${th('status', 'Status')}
            <th class="no-sort" style="text-align:right">Actions</th>
          </tr></thead>
          <tbody>${slice.map(p => {
        const proj = Store.project(p.projectId);
        return `<tr>
              <td class="strong">${esc(p.invoiceNo || '—')}<div class="faint" style="font-size:11px">${p.invoiceDate ? shortDate(p.invoiceDate) : ''}</div></td>
              <td>${proj ? `<a href="#/projects/${esc(proj.id)}" style="color:var(--accent)">${esc(proj.name)}</a>` : '<span class="faint">—</span>'}</td>
              <td>${esc(p.client || '—')}</td>
              <td class="num">${money(p.amount)}</td>
              <td class="num faint">${p.gst ? p.gst + '%' : '—'}</td>
              <td class="num strong">${money(grossAmt(p))}</td>
              <td class="num">${p.dueDate ? shortDate(p.dueDate) : '—'}</td>
              <td>${payStatusPill(p.status)}</td>
              <td class="rowacts">
                <button class="iconbtn payAct" data-act="view" data-id="${esc(p.id)}" title="View"><i class="fa-solid fa-eye"></i></button>
                <button class="iconbtn payAct" data-act="edit" data-id="${esc(p.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="iconbtn payAct" data-act="pdf" data-id="${esc(p.id)}" title="Download PDF"><i class="fa-solid fa-file-pdf"></i></button>
                <button class="iconbtn payAct" data-act="dup" data-id="${esc(p.id)}" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
                <button class="iconbtn payAct" data-act="del" data-id="${esc(p.id)}" title="Delete"><i class="fa-solid fa-trash" style="color:var(--warn)"></i></button>
              </td>
            </tr>`;
      }).join('')}</tbody>
        </table></div>
        ${pages > 1 ? `<div class="pager">
          <button class="pager__btn" data-pg="prev" ${s.page === 1 ? 'disabled' : ''}>‹</button>
          ${Array.from({ length: pages }, (_, i) => i + 1)
          .filter(n => n === 1 || n === pages || Math.abs(n - s.page) <= 2)
          .map((n, i, a) => (i && n - a[i - 1] > 1 ? '<span class="pager__btn" style="border:0;background:none">…</span>' : '') +
            `<button class="pager__btn ${n === s.page ? 'is-active' : ''}" data-pg="${n}">${n}</button>`).join('')}
          <button class="pager__btn" data-pg="next" ${s.page === pages ? 'disabled' : ''}>›</button>
        </div>` : ''}`
        : App.empty('No invoices match these filters.', {
          icon: 'fa-filter-circle-xmark',
          hint: 'Try widening the date range, clearing the status, or resetting the filters.',
          action: `<button class="btn btn--ghost btn--sm" id="fResetInline"><i class="fa-solid fa-arrow-rotate-left"></i> Reset filters</button>`
        });

      $('#payTableHost').innerHTML = `
        <div class="toolbar" style="justify-content:space-between; margin-bottom:.6rem">
          <p class="muted" style="font-size:12.5px;margin:0">
            ${total ? `Showing <b>${from + 1}–${Math.min(from + per, total)}</b> of <b>${total}</b>` : 'No records found'}
            ${total !== grand ? ` <span class="faint">(filtered from ${grand})</span>` : ''}
          </p>
          <label class="field" style="margin:0; display:flex; align-items:center; gap:.5rem">
            <span style="margin:0; white-space:nowrap">Rows</span>
            <select id="payPer" style="width:auto">${[10, 25, 50, 100].map(n => `<option ${per === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </label>
        </div>
        ${body}`;

      this.bindTable();
    },

    bindTable() {
      const s = this.state;
      $$('#payTableHost thead th[data-k]').forEach(th => th.addEventListener('click', () => {
        const k = th.dataset.k;
        if (s.sortKey === k) s.sortDir *= -1; else { s.sortKey = k; s.sortDir = 1; }
        this.saveState(); this.renderTable();
      }));
      const per = $('#payPer');
      if (per) per.addEventListener('change', e => { s.per = +e.target.value; s.page = 1; this.saveState(); this.renderTable(); });
      $$('#payTableHost [data-pg]').forEach(b => b.addEventListener('click', () => {
        const v = b.dataset.pg;
        const pages = Math.max(1, Math.ceil(this.filtered().length / (+s.per || 25)));
        if (v === 'prev') s.page = Math.max(1, s.page - 1);
        else if (v === 'next') s.page = Math.min(pages, s.page + 1);
        else s.page = +v;
        this.saveState(); this.renderTable();
      }));
      const ri = $('#fResetInline');
      if (ri) ri.addEventListener('click', () => { this.resetState(); this.render(); });
      $$('#payTableHost .payAct').forEach(b => b.addEventListener('click', () => {
        const rec = Store.payments().find(x => x.id === b.dataset.id);
        if (!rec) return;
        const acts = {
          view: () => this.viewOne(rec), edit: () => this.openEdit(rec), pdf: () => this.exportPdf(rec),
          dup: () => this.duplicate(rec), del: () => this.confirmDelete(rec)
        };
        (acts[b.dataset.act] || acts.view)();
      }));
    },

    /* ── Row actions ────────────────────────────────────────── */
    viewOne(p) {
      const proj = Store.project(p.projectId);
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      App.modal({
        title: 'Invoice ' + (p.invoiceNo || ''),
        body: `<dl class="deflist">
          ${row('Project', proj ? esc(proj.name) : '—')}
          ${row('Client', esc(p.client || '—'))}
          ${row('Invoice date', p.invoiceDate ? shortDate(p.invoiceDate) : '—')}
          ${row('Due date', p.dueDate ? shortDate(p.dueDate) : '—')}
          ${row('Amount', money(p.amount))}
          ${row('GST', p.gst ? p.gst + '% · ' + money(gstAmt(p)) : '—')}
          ${row('Total', '<b>' + money(grossAmt(p)) + '</b>')}
          ${row('Method', esc(p.method || '—'))}
          ${row('Reference', esc(p.refNo || '—'))}
          ${row('Status', payStatusPill(p.status))}
          ${p.remarks ? row('Remarks', esc(p.remarks)) : ''}
        </dl>`,
        footer: `<button class="btn btn--ghost" data-close>Close</button><button class="btn btn--accent" id="vEdit"><i class="fa-solid fa-pen"></i> Edit</button>`
      });
      $('#vEdit').addEventListener('click', () => { App.closeModal(); this.openEdit(p); });
    },

    duplicate(p) {
      const copy = Object.assign({}, p, {
        id: genId('pay'),
        invoiceNo: (p.invoiceNo || 'INV') + '-COPY',
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: '', status: 'Pending', refNo: ''
      });
      Store.addPayment(copy);
      App.buildSearchIndex();
      this.render();
      App.toast('Invoice duplicated', copy.invoiceNo + ' created as Pending', 'good');
    },

    confirmDelete(p) {
      App.modal({
        title: 'Delete invoice',
        body: `<p style="font-size:14px;line-height:1.6;margin:0">Delete <b>${esc(p.invoiceNo || 'this invoice')}</b> for ${money(grossAmt(p))}? This cannot be undone.</p>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="delYes" style="background:var(--warn);border-color:var(--warn)"><i class="fa-solid fa-trash"></i> Delete</button>`
      });
      $('#delYes').addEventListener('click', () => {
        Store.deletePayment(p.id);
        App.closeModal(); App.buildSearchIndex(); this.render();
        App.toast('Invoice deleted', p.invoiceNo || '', 'warn');
      });
    },

    /* Uses the browser print dialog → "Save as PDF". No PDF library is
       bundled; adding one would be a large dependency for a page every
       browser can already produce. */
    exportPdf(p) {
      const proj = Store.project(p.projectId);
      let host = document.getElementById('printInvoice');
      if (!host) { host = document.createElement('div'); host.id = 'printInvoice'; document.body.appendChild(host); }
      host.innerHTML = `
        <div class="inv">
          <div class="inv__head">
            <div><div class="inv__firm">${esc(D.meta.firm || 'InTandem Build')}</div>
              <div class="inv__sub">${esc(D.meta.nature || '')}</div></div>
            <div style="text-align:right"><div class="inv__label">Invoice</div><div class="inv__no">${esc(p.invoiceNo || '—')}</div></div>
          </div>
          <table class="inv__meta">
            <tr><td>Project</td><td>${proj ? esc(proj.name) : '—'}</td><td>Invoice date</td><td>${p.invoiceDate ? shortDate(p.invoiceDate) : '—'}</td></tr>
            <tr><td>Client</td><td>${esc(p.client || '—')}</td><td>Due date</td><td>${p.dueDate ? shortDate(p.dueDate) : '—'}</td></tr>
            <tr><td>Method</td><td>${esc(p.method || '—')}</td><td>Reference</td><td>${esc(p.refNo || '—')}</td></tr>
          </table>
          <table class="inv__lines">
            <tr><th>Description</th><th class="num">Amount</th></tr>
            <tr><td>${esc(p.remarks || 'Professional services')}</td><td class="num">${money(p.amount)}</td></tr>
            <tr><td>GST @ ${p.gst || 0}%</td><td class="num">${money(gstAmt(p))}</td></tr>
            <tr class="inv__total"><td>Total</td><td class="num">${money(grossAmt(p))}</td></tr>
          </table>
          <p class="inv__foot">Status: ${esc(p.status)} · Generated ${shortDate(new Date().toISOString().slice(0, 10))}</p>
        </div>`;
      document.body.classList.add('printing-invoice');
      const done = () => { document.body.classList.remove('printing-invoice'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1200);
    },

    _empty() {
      return `<div class="card"><div class="dt__empty" style="padding:3rem 1rem">
        <i class="fa-solid fa-file-invoice-dollar" style="font-size:30px;opacity:.35"></i>
        <p style="margin:.9rem 0 .2rem;font-weight:600;color:var(--ink)">No payments recorded yet</p>
        <p class="muted" style="font-size:13px;max-width:440px;margin:0 auto 1rem">Record a client invoice or receipt to start tracking collections. Every payment links to a project — cash-flow and revenue charts populate automatically.</p>
        <button class="btn btn--accent btn--sm" onclick="document.getElementById('addPayBtn').click()"><i class="fa-solid fa-plus"></i> Add first payment</button>
      </div></div>`;
    },
    charts(all) {
      const t = themeColors();
      const byMonth = {};
      all.filter(p => paidStates.includes(p.status)).forEach(p => { const k = (p.invoiceDate || '').slice(0, 7); if (k) byMonth[k] = (byMonth[k] || 0) + grossAmt(p); });
      const keys = Object.keys(byMonth).sort();
      chart('chPayMonth', { type: 'bar', data: { labels: keys.map(App.monthLabel), datasets: [{ data: keys.map(k => byMonth[k]), backgroundColor: rgba(t.settled, .8), borderRadius: 4, maxBarThickness: 26 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => App.money(c.parsed.y, true) } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: t.line }, ticks: { callback: v => '₹' + (v / 1e5).toFixed(0) + 'L' } } } } });
      const sc = {}; all.forEach(p => sc[p.status] = (sc[p.status] || 0) + grossAmt(p));
      const cmap = { Paid: t.settled, Advance: t.info, Partial: t.accent, Pending: t.muted, Overdue: t.warn, Cancelled: t.line };
      const labels = Object.keys(sc);
      chart('chPayStatus', { type: 'doughnut', data: { labels, datasets: [{ data: labels.map(k => sc[k]), backgroundColor: labels.map(k => cmap[k] || t.muted), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface'), borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8, font: { size: 11 } } } } } });
    },
    openAdd(presetProject) { this.openForm(presetProject, null); },
    openEdit(pay) { this.openForm(null, pay); },

    /** One form for add and edit. `existing` is a payment record or null. */
    openForm(presetProject, existing) {
      const ed = !!existing, r = existing || {};
      const projOpts = Store.projects().map(p => ({ v: p.id, l: p.name }));
      App.modal({
        title: ed ? 'Edit payment' : 'Add payment',
        body: `<div class="formgrid">
          ${field('pyProject', 'Project', r.projectId || presetProject || (Store.projects()[0] || {}).id, { type: 'select', options: projOpts, req: true })}
          <div class="formrow">${field('pyInv', 'Invoice number', r.invoiceNo || '', { ph: 'INV-001' })}${field('pyClient', 'Client', r.client || '', { ph: 'auto from project' })}</div>
          <div class="formrow">${field('pyInvDate', 'Invoice date', r.invoiceDate || new Date().toISOString().slice(0, 10), { type: 'date' })}${field('pyDue', 'Due date', '', { type: 'date' })}</div>
          <div class="formrow">${field('pyAmount', 'Amount (₹)', r.amount != null ? r.amount : '', { type: 'number', req: true, attr: 'min="0"', ph: '0' })}${field('pyGst', 'GST %', '18', { type: 'number', attr: 'min="0" max="28"' })}</div>
          <div class="formrow">${field('pyMethod', 'Payment method', 'Bank Transfer', { type: 'select', options: ['Bank Transfer', 'GPay', 'Cash', 'Cheque', 'UPI'] })}${field('pyStatus', 'Status', 'Pending', { type: 'select', options: PAYSTATUS })}</div>
          ${field('pyRef', 'Reference number', r.refNo || '', {})}
          ${field('pyRemarks', 'Remarks', r.remarks || '', { type: 'textarea', rows: 2 })}
          <label class="field"><span>Attachment</span><div class="dropzone"><i class="fa-solid fa-paperclip"></i> Invoice PDF (stored by name only in this build)</div></label>
        </div>`,
        footer: `${ed ? '<button class="btn btn--ghost" id="pyDel" style="color:var(--warn);margin-right:auto"><i class="fa-solid fa-trash"></i> Delete</button>' : ''}
                 <button class="btn btn--ghost" data-close>Cancel</button>
                 <button class="btn btn--accent" id="pySave"><i class="fa-solid fa-check"></i> ${ed ? 'Save changes' : 'Save payment'}</button>`
      });
      // auto-fill client from project
      const fillClient = () => { const proj = Store.project($('#pyProject').value); if (proj && !$('#pyClient').value) $('#pyClient').value = proj.client || ''; };
      fillClient(); $('#pyProject').addEventListener('change', () => { $('#pyClient').value = ''; fillClient(); });
      $('#pySave').addEventListener('click', () => {
        let ok = true;
        const amount = $('#pyAmount').value.trim();
        ok = setErr('pyAmount', amount && +amount > 0 ? '' : 'Enter an amount greater than 0') && ok;
        const inv = $('#pyInvDate').value, due = $('#pyDue').value;
        if (inv && due) ok = setErr('pyDue', due >= inv ? '' : 'Due date must be after invoice date') && ok;
        if (!ok) return;
        const data = {
          projectId: $('#pyProject').value, invoiceNo: $('#pyInv').value.trim(),
          client: $('#pyClient').value.trim() || (Store.project($('#pyProject').value)?.client || ''),
          invoiceDate: inv, dueDate: due, amount: +amount, gst: +$('#pyGst').value || 0,
          method: $('#pyMethod').value, status: $('#pyStatus').value, refNo: $('#pyRef').value.trim(), remarks: $('#pyRemarks').value.trim()
        };
        if (ed) Store.updatePayment(r.id, data);
        else Store.addPayment(Object.assign({ id: genId('pay') }, data));
        App.closeModal(); App.buildSearchIndex();
        App.toast(ed ? 'Payment updated' : 'Payment saved', (data.invoiceNo || '') + ' ₹' + App.inr.format(data.amount), 'good');
        this._after();
      });

      const del = $('#pyDel');
      if (del) del.addEventListener('click', () => {
        Store.deletePayment(r.id);
        App.closeModal(); App.buildSearchIndex();
        App.toast('Payment deleted', r.invoiceNo || '', 'warn');
        this._after();
      });
    },

    /* Repaint whichever surface the user is looking at. */
    _after() {
      const page = App.$('.page.is-active')?.dataset.page;
      if (page === 'payments') this.render();
      else if (page === 'projects') {
        const p = Store.project(App.param());
        if (p) project.tab(p, 'payments');
      }
    },
    /* Per-project Payments tab */
    projectPanel(p) {
      const list = Store.payments(p.id);
      const value = p.budget || 0;
      const received = list.filter(x => paidStates.includes(x.status)).reduce((s, x) => s + grossAmt(x), 0);
      const outstanding = Math.max(0, value - received);
      return `
        <div class="grid g-3 mb">
          <div class="kpi"><div class="kpi__label">Project value</div><div class="kpi__value">${value ? money(value, true) : '—'}</div><div class="kpi__foot">budget</div></div>
          <div class="kpi"><div class="kpi__label">Received</div><div class="kpi__value" style="color:var(--settled)">${money(received, true)}</div><div class="kpi__foot">${value ? Math.round(received / value * 100) : 0}% collected</div></div>
          <div class="kpi"><div class="kpi__label">Outstanding</div><div class="kpi__value" style="color:var(--warn)">${money(outstanding, true)}</div><div class="kpi__foot">${list.length} invoice${list.length !== 1 ? 's' : ''}</div></div>
        </div>
        <div class="kbar"><p class="muted" style="font-size:13px;margin:0">Invoice history</p><button class="btn btn--accent btn--sm" id="projAddPay"><i class="fa-solid fa-plus"></i> Add payment</button></div>
        ${list.length ? `<div class="tablewrap"><table class="dt">
          <thead><tr><th>Invoice</th><th>Date</th><th class="num">Amount</th><th class="num">Total</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>${list.slice().sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '')).map(x => `
            <tr><td class="strong">${esc(x.invoiceNo || '—')}</td><td class="num">${x.invoiceDate ? shortDate(x.invoiceDate) : '—'}</td><td class="num">${money(x.amount)}</td><td class="num strong">${money(grossAmt(x))}</td><td class="num">${x.dueDate ? shortDate(x.dueDate) : '—'}</td><td>${payStatusPill(x.status)}</td></tr>`).join('')}</tbody>
        </table></div>` : project.empty('fa-file-invoice', 'No invoices yet', 'Add a payment to start this project\u2019s invoice history.')}`;
    },
    bindProjectPanel(p) { $('#projAddPay')?.addEventListener('click', () => this.openAdd(p.id)); }
  };
  App.register('payments', payments);

  /* ══════════════════════════════════════════════════════
     NEWS  (live-ready shell; graceful offline/empty states)
     ══════════════════════════════════════════════════════ */
  const news = {
    // Live construction-news feed: Google News RSS (free, no API key) fetched
    // through CORS-open proxies with a fallback chain. Nothing is fabricated —
    // if every source fails, the error state is shown.
    filter: 'All',
    timer: null,
    items: null,
    cats: ['All', 'Construction', 'Architecture', 'Interior Design', 'Technology', 'Government', 'Infrastructure', 'Hyderabad', 'Telangana', 'India'],
    QUERIES: [
      { cat: 'Hyderabad', q: 'Hyderabad construction OR real estate OR infrastructure' },
      { cat: 'Telangana', q: 'Telangana infrastructure OR construction project' },
      { cat: 'India', q: 'India construction OR building industry' },
      { cat: 'Architecture', q: 'architecture design India' },
      { cat: 'Interior Design', q: 'interior design India homes' },
      { cat: 'Technology', q: 'construction technology OR building materials India' }
    ],
    // Build a Google News RSS search URL for a query
    rssUrl(q) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-IN&gl=IN&ceid=IN:en'; },
    // Raw-XML CORS fallbacks (used if the JSON API is unavailable)
    rawProxies(url) {
      return [
        u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),   // returns {contents}
        u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
        u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
      ].map(fn => fn(url));
    },
    mount() { this.render(); this.load(); this.schedule(); },
    refresh() { this.render(); this.load(); },
    schedule() { if (this.timer) clearInterval(this.timer); this.timer = setInterval(() => { if (App.$('.page.is-active')?.dataset.page === 'news') this.load(); }, 30 * 60 * 1000); },
    render() {
      $('#page-news').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Industry feed</p><h1>News & Events</h1>
          <p class="phead__sub">Construction, architecture, interiors & infrastructure · <span id="newsUpdated">—</span></p></div>
          <div class="phead__actions"><button class="btn btn--ghost" id="newsRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button></div>
        </div>
        <div class="chipbar" id="newsCats">${this.cats.map(c => `<button class="chip ${c === this.filter ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
        <div id="newsBody"></div>`;
      $('#newsRefresh').addEventListener('click', () => this.load());
      $('#newsCats').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; this.filter = c.dataset.cat; $$('#newsCats .chip').forEach(x => x.classList.toggle('is-active', x === c)); this.paint(); });
    },
    loading() { const u = $('#newsUpdated'); if (u) u.textContent = 'connecting…'; $('#newsBody').innerHTML = `<div class="grid g-3">${Array.from({ length: 6 }, () => `<div class="card newscard is-skel"><div class="newscard__img skel"></div><div class="card__body"><div class="skel skel--line"></div><div class="skel skel--line" style="width:70%"></div></div></div>`).join('')}</div>`; },
    async load() {
      this.loading();
      try {
        const batches = await Promise.allSettled(this.QUERIES.map(c => this.fetchCategory(c)));
        let items = batches.filter(b => b.status === 'fulfilled').flatMap(b => b.value);
        const seen = new Set();
        items = items.filter(x => { const k = (x.title || '').toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
        items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
        if (!items.length) throw new Error('empty');
        this.items = items;
        const u = $('#newsUpdated'); if (u) u.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        this.paint();
      } catch (err) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false)
          this.offline('You\u2019re offline', 'Reconnect to load the latest construction & design news — it refreshes automatically every 30 minutes.');
        else
          this.offline('Couldn\u2019t load news right now', 'The news service didn\u2019t respond. It retries automatically every 30 minutes, or tap Refresh to try again. Live news needs an internet connection; if the app is opened straight from a file, a public CORS proxy must be reachable.');
      }
    },
    async fetchCategory(c) {
      const rss = this.rssUrl(c.q);
      // 1) rss2json — JSON, reliable open CORS, no key needed for light use
      try {
        const r = await fetch('https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent(rss), { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && j.status === 'ok' && Array.isArray(j.items) && j.items.length)
            return j.items.slice(0, 8).map(it => this.mapItem({ title: it.title, link: it.link, pubDate: it.pubDate, thumbnail: it.thumbnail || (it.enclosure && it.enclosure.link), description: it.description }, c.cat)).filter(Boolean);
        }
      } catch (e) { /* fall through to raw proxies */ }
      // 2) raw-XML CORS proxies
      for (const purl of this.rawProxies(rss)) {
        try {
          const res = await fetch(purl, { cache: 'no-store' });
          if (!res.ok) continue;
          let text = await res.text();
          if (text.trim().startsWith('{')) { try { text = (JSON.parse(text).contents) || ''; } catch (e) { } }  // allorigins /get wraps XML in {contents}
          const items = this.parseRSS(text, c.cat);
          if (items.length) return items.slice(0, 8);
        } catch (e) { /* try the next proxy */ }
      }
      return [];
    },
    mapItem(o, cat) {
      const rawTitle = (o.title || '').trim();
      const link = (o.link || '').trim();
      if (!rawTitle || !link) return null;
      const sep = rawTitle.lastIndexOf(' - ');
      const source = sep > 0 ? rawTitle.slice(sep + 3).trim() : '';
      const title = sep > 0 ? rawTitle.slice(0, sep).trim() : rawTitle;
      let published = '';
      if (o.pubDate) { const d = new Date(o.pubDate.replace(' ', 'T')); if (!isNaN(d.getTime())) published = d.toISOString(); }
      const image = o.thumbnail && /^https?:/.test(o.thumbnail) ? o.thumbnail : null;
      return { title, url: link, source, summary: '', category: cat, image, published };
    },
    parseRSS(xml, cat) {
      const out = [];
      try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        doc.querySelectorAll('item').forEach(it => {
          const item = this.mapItem({
            title: it.querySelector('title')?.textContent || '',
            link: it.querySelector('link')?.textContent || '',
            pubDate: it.querySelector('pubDate')?.textContent || ''
          }, cat);
          if (item) { const src = it.querySelector('source')?.textContent; if (src && !item.source) item.source = src; out.push(item); }
        });
      } catch (e) { /* malformed feed */ }
      return out;
    },
    paint() {
      const items = (this.items || []).filter(x => this.filter === 'All' || (x.category || '').toLowerCase().includes(this.filter.toLowerCase()) || (x.title || '').toLowerCase().includes(this.filter.toLowerCase()));
      if (!items.length) { this.offline('Nothing here yet', 'No stories match this filter.'); return; }
      const marks = new Set(App.store.get('news.marks', []));
      $('#newsBody').innerHTML = `<div class="grid g-3">${items.map((x, i) => `
        <article class="card newscard">
          ${x.image ? `<div class="newscard__img" style="background-image:url('${esc(App.safeUrl(x.image))}')"></div>` : `<div class="newscard__img newscard__img--ph"><i class="fa-solid ${catIcon[x.category] || 'fa-newspaper'}"></i></div>`}
          <div class="card__body">
            <div class="newscard__cat">${esc(x.category || 'News')}</div>
            <h3 class="newscard__title">${esc(x.title || '')}</h3>
            <p class="newscard__sum">${esc(x.summary || '')}</p>
            <div class="newscard__foot">
              <span class="faint">${esc(x.source || '')}${x.published ? ' · ' + fromNow(x.published) : ''}</span>
              <span class="newscard__acts">
                <button class="iconbtn" data-mark="${i}" title="Bookmark"><i class="fa-${marks.has(x.url) ? 'solid' : 'regular'} fa-bookmark"></i></button>
                <button class="iconbtn" data-share="${i}" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
              </span>
            </div>
            ${x.url ? `<a class="btn btn--ghost btn--sm" href="${esc(App.safeUrl(x.url))}" target="_blank" rel="noopener noreferrer" style="margin-top:.6rem">Read more <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
          </div>
        </article>`).join('')}</div>`;
      $$('#newsBody [data-mark]').forEach(b => b.addEventListener('click', () => { const x = items[+b.dataset.mark]; const m = new Set(App.store.get('news.marks', [])); m.has(x.url) ? m.delete(x.url) : m.add(x.url); App.store.set('news.marks', [...m]); this.paint(); }));
      $$('#newsBody [data-share]').forEach(b => b.addEventListener('click', async () => { const x = items[+b.dataset.share]; try { if (navigator.share) await navigator.share({ title: x.title, url: x.url }); else { await navigator.clipboard.writeText(x.url); App.toast('Link copied', '', 'good'); } } catch { } }));
    },
    offline(title, sub) {
      $('#newsBody').innerHTML = `<div class="card"><div class="dt__empty" style="padding:3rem 1rem">
        <i class="fa-solid fa-newspaper" style="font-size:30px;opacity:.35"></i>
        <p style="margin:.9rem 0 .2rem;font-weight:600;color:var(--ink)">${esc(title)}</p>
        <p class="muted" style="font-size:13px;max-width:460px;margin:0 auto">${esc(sub)}</p>
      </div></div>`;
      $('#newsUpdated').textContent = 'not connected';
    }
  };
  App.register('news', news);

  /* ── Floating action button (Projects only) ───────────── */
  /* ── Floating action button (Projects list only) ──────── */
  function toggleFab() {
    const fab = $('#fabNewProject'); if (!fab) return;
    const show = App.$('.page.is-active')?.dataset.page === 'projects' && !App.param();
    fab.hidden = !show;
  }
  document.addEventListener('itd:route', toggleFab);
  window.addEventListener('hashchange', () => setTimeout(toggleFab, 0));
  document.addEventListener('DOMContentLoaded', toggleFab);
  setTimeout(toggleFab, 600);
  $('#fabNewProject')?.addEventListener('click', () => project.openNew());

  /* ── Command palette verbs owned by this file ──────────────────────
     Registered here rather than in the palette, so a module and its
     commands stay together. Each navigates first, because both actions
     open a form that only exists once the page has mounted. */
  if (App.Command) {
    App.Command.register({
      id: 'project.new', label: 'New project', keywords: 'create add project',
      group: 'Create', icon: 'fa-diagram-project', hint: 'Create a project',
      run: () => { location.hash = '#/projects'; App.render(); setTimeout(() => project.openNew(), 30); }
    });
    App.Command.register({
      id: 'payment.new', label: 'Record payment', keywords: 'create add payment invoice receipt money',
      group: 'Create', icon: 'fa-indian-rupee-sign', hint: 'Log a client payment',
      run: () => { location.hash = '#/payments'; App.render(); setTimeout(() => payments.openAdd(), 30); }
    });
  }
})(window.App);

