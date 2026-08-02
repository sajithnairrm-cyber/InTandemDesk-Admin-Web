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

  /* ── SCHEDULE ─────────────────────────────────────────── */
  const schedule = {
    filter: null,
    mount() {
      if (!D.schedule.length) {
        $('#page-schedule').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Work schedule</p><h1>Schedule of works</h1>
            <p class="phead__sub">No tasks scheduled</p></div></div>
          ${App.empty('No work schedule created.', { icon: 'fa-list-check', hint: 'Tasks, areas and their status will appear here once a project schedule is added.' })}`;
        return;
      }
      const counts = Derive.statusCounts;
      const order = ['Completed', 'Work in progress', 'Final work', 'Installation', 'Material to order', 'Work to start', 'Vendor confirmation', 'Factory', 'No status'];
      const chips = order.filter(s => counts[s]).map(s =>
        `<button class="chip" data-status="${esc(s)}"><span class="pill ${statusClass(s === 'No status' ? null : s)}" style="padding:0;background:none"></span>${esc(s)} <span class="chip__n">${counts[s]}</span></button>`).join('');
      $('#page-schedule').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Work schedule</p><h1>Schedule of works</h1>
          <p class="phead__sub">${D.schedule.length} tasks across ${D.areas.length} areas (I–XI) · data as of ${shortDate(D.meta.reportDate)}</p></div></div>
        <div class="chipbar"><button class="chip is-active" data-status="">All <span class="chip__n">${D.schedule.length}</span></button>${chips}</div>
        <div id="scheduleAreas"></div>`;
      $('.chipbar', $('#page-schedule')).addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        $$('#page-schedule .chip').forEach(x => x.classList.toggle('is-active', x === c));
        this.filter = c.dataset.status || null;
        this.renderAreas();
      });
      $('#page-schedule').addEventListener('click', e => {
        const h = e.target.closest('.area__head'); if (h) h.parentElement.classList.toggle('is-open');
      });
      this.renderAreas();
    },
    renderAreas() {
      const wrap = $('#scheduleAreas');
      wrap.innerHTML = Derive.areaProgress.map(a => {
        let tasks = D.schedule.filter(t => t.area === a.code);
        if (this.filter) tasks = tasks.filter(t => (t.status || 'No status') === this.filter);
        if (!tasks.length) return '';
        return `<div class="area is-open">
          <div class="area__head">
            <span class="area__code">${a.code}</span>
            <span class="area__name">${esc(a.name || '')}</span>
            <span class="area__mini">${this._mini(a.pct)}</span>
            <span class="area__count">${a.done}/${a.total}</span>
            <i class="fa-solid fa-chevron-down area__toggle"></i>
          </div>
          <div class="area__body">${tasks.map(t => this._task(t)).join('')}</div>
        </div>`;
      }).join('') || `<div class="card"><div class="dt__empty">No tasks match this status.</div></div>`;
    },
    _mini(pct) {
      return `<div class="settle" style="--pct:${pct}"><div class="settle__track" style="height:6px"><span class="settle__fill"></span></div></div>`;
    },
    _task(t) {
      const cls = statusClass(t.status);
      const ico = cls === 'completed' ? 'done' : (cls === 'progress' || cls === 'installation' || cls === 'final') ? 'wip' : 'pend';
      const icon = cls === 'completed' ? 'fa-circle-check' : ico === 'wip' ? 'fa-circle-half-stroke' : 'fa-circle';
      return `<div class="task">
        <i class="fa-solid ${icon} task__ico ${ico}"></i>
        <div class="task__body">
          <div class="task__desc">${esc(t.description)}</div>
          <div class="task__meta">
            ${t.status ? `<span class="pill ${cls}">${esc(t.status)}</span>` : '<span class="pill none">No status</span>'}
            ${t.nature ? `<span class="tag">${esc(t.nature)}</span>` : ''}
            ${t.vendor ? `<span class="faint" style="font-size:11px"><i class="fa-solid fa-user"></i> ${esc(t.vendor)}</span>` : ''}
          </div>
        </div>
      </div>`;
    },
    refresh() { }
  };
  App.register('schedule', schedule);

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

